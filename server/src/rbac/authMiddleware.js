import { verifyToken } from '../utils/jwtUtil.js';
import * as permissionService from './permissionService.js';
import { query } from '../config/database.js';

/**
 * Middleware to verify JWT and attach auth info to request
 */
export const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        // Support both Scaloz token payload and XeSkillz local token payload
        const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || '';
        let subdomainTenant = null;
        
        // Match .skillztest.scaloz.com or .localhost (for local dev like rohan-local-dev.localhost:8083)
        const hostSubdomainMatch = hostHeader.match(/^([a-zA-Z0-9-]+)\.(skillztest\.scaloz\.com|localhost)(:\d+)?$/i);
        
        if (hostSubdomainMatch && hostSubdomainMatch[1] !== 'skillztest' && hostSubdomainMatch[1] !== 'www') {
            subdomainTenant = hostSubdomainMatch[1];
            // In local dev, scaloz passes "rohan-local-dev" but the actual tenant in db might be just "rohan"
            // If it ends with "-local-dev", strip it out to match the DB prefix
            if (subdomainTenant.endsWith('-local-dev')) {
                subdomainTenant = subdomainTenant.replace('-local-dev', '');
            }
        }

        const tenantId = decoded.tenant || decoded.tenantId || decoded.tenant_id || decoded.domain || decoded.organizationId || decoded.orgId || decoded.tenantName || subdomainTenant;
        const tenantName = decoded.tenantName || tenantId || null;
        const employeeId = decoded.employeeId || decoded.employee_id;
        let userId = decoded.userId || decoded.user_id || decoded.id || (decoded.sub && !decoded.sub.includes('@') ? decoded.sub : null);

        // Extract real identity from Scaloz JWT claims
        const ssoEmail = decoded.email || decoded.user_email || (decoded.sub && decoded.sub.includes('@') ? decoded.sub : null);
        const firstName = decoded.firstName || decoded.first_name || null;
        const lastName = decoded.lastName || decoded.last_name || null;
        const ssoName = decoded.name ||
            (firstName && lastName ? `${firstName} ${lastName}`.trim() : null) ||
            firstName || null;

        if (!userId && tenantId && (employeeId || ssoEmail)) {
            const empOrEmail = employeeId || ssoEmail;
            const cleanEmpId = empOrEmail.includes('_')
                ? empOrEmail.substring(empOrEmail.lastIndexOf('_') + 1)
                : empOrEmail;
            userId = `${tenantId}_${cleanEmpId}`;
        }

        if (!tenantId || !userId) {
            console.error('[Auth Middleware] Invalid token claims:', { tenantId, userId, decoded });
            return res.status(401).json({
                success: false,
                message: 'Invalid token claims'
            });
        }

        // Cross-reference to find if user already exists under a different ID format (like UUID)
        let dbUserId = null;
        if (ssoEmail) {
            const existingUserRes = await query('SELECT id FROM users WHERE email = $1', [ssoEmail]);
            if (existingUserRes.rows.length > 0) {
                dbUserId = existingUserRes.rows[0].id;
            }
        }
        
        // Helper function to check if string is a valid UUID
        const isUUID = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
        
        if (!dbUserId && userId) {
            let existingUserRes;
            if (isUUID(userId)) {
                // It's a valid UUID, safe to query against id column
                existingUserRes = await query('SELECT id FROM users WHERE id = $1 OR employee_id = $2', [userId, userId]);
            } else {
                // It's a string like 'apex0001_AP001', querying UUID id column will crash Postgres. Check employee_id only.
                existingUserRes = await query('SELECT id FROM users WHERE employee_id = $1', [userId]);
            }
            if (existingUserRes.rows.length > 0) {
                dbUserId = existingUserRes.rows[0].id;
            }
        }

        // Override userId if an existing database record exists (e.g. UUID id)
        if (dbUserId) {
            userId = dbUserId;
        } else if (userId && tenantId) {
            // JIT Provisioning: Insert SSO user into local DB so foreign keys (like created_by) resolve correctly
            try {
                await query(
                    `INSERT INTO users (id, email, full_name, password_hash, is_verified) 
                     VALUES ($1, $2, $3, 'sso_user', true) 
                     ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, is_deleted = false`,
                    [userId, ssoEmail || `${userId}@example.com`, ssoName || 'System User']
                );
            } catch (err) {
                console.error('[Auth Middleware] JIT provisioning failed:', err);
            }
        }
        
        // Reactivate user if they were soft-deleted (applies to both JIT updated and existing dbUserId)
        if (dbUserId) {
            try {
                await query('UPDATE users SET is_deleted = false WHERE id = $1 AND is_deleted = true', [userId]);
            } catch (err) {
                console.error('[Auth Middleware] User reactivation failed:', err);
            }
        }

        // Fetch managerId and domainId dynamically from DB
        let managerId = null;
        let domainId = null;
        let roles = [];
        let permissions = [];

        // Only query DB for extra user fields and permissions if the user actually exists
        // (dbUserId is set) OR if the provided userId is already a valid UUID (standard local login).
        if (dbUserId || isUUID(userId)) {
            const userRes = await query('SELECT manager_id, domain_id FROM users WHERE id = $1', [userId]);
            const dbUser = userRes.rows[0] || {};
            managerId = dbUser.manager_id || null;
            domainId = dbUser.domain_id || null;

            // Resolve permissions from DB (not JWT)
            const resolved = await permissionService.getUserRolesAndPermissions(userId, tenantId);
            roles = resolved.roles || [];
            permissions = resolved.permissions || [];
        }

        // Extract Scaloz role from JWT (if present) to support JIT role mapping
        let ssoRole = decoded.role;
        if (!ssoRole && decoded.roles && Array.isArray(decoded.roles)) ssoRole = decoded.roles[0];
        if (!ssoRole && decoded.realm_access && decoded.realm_access.roles) ssoRole = decoded.realm_access.roles[0];
        if (!ssoRole && decoded['cognito:groups'] && Array.isArray(decoded['cognito:groups'])) ssoRole = decoded['cognito:groups'][0];

        // JIT Role Mapping: If no roles in DB, use SSO role or default to RECRUITER
        if (roles.length === 0) {
            const normalizedRole = ssoRole ? ssoRole.toUpperCase() : 'RECRUITER';
            if (['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'RECRUITER'].includes(normalizedRole)) {
                roles.push(normalizedRole);
            } else {
                roles.push('RECRUITER');
            }
        }

        // Failsafe: Ensure system roles always have their baseline permissions, 
        // even if the test database role_permissions table is empty due to a failed migration.
        if (roles.includes('SUPER_ADMIN') && !permissions.includes('all')) {
            permissions.push('all');
        }
        if (roles.includes('ADMIN')) {
            const adminPerms = [
                'create_assessments', 'create_questions', 'delete_assessments', 'delete_questions', 
                'edit_questions', 'manage_candidates', 'view_questions', 'view_reports',
                'manage_settings', 'manage_roles', 'invite_users', 'assign_hierarchy', 'bulk_delete_assessments'
            ];
            adminPerms.forEach(p => { if (!permissions.includes(p)) permissions.push(p); });
        }
        if (roles.includes('RECRUITER') || roles.includes('MANAGER')) {
            const baselinePerms = ['create_assessments', 'create_questions', 'delete_assessments', 'delete_questions', 'edit_questions', 'manage_candidates', 'view_questions', 'view_reports'];
            baselinePerms.forEach(p => { if (!permissions.includes(p)) permissions.push(p); });
        }

        // Attach to request as req.auth (includes real SSO identity for JIT provisioning)
        req.auth = {
            userId,
            tenantId,
            tenantName,
            managerId,
            domainId,
            roles,
            permissions,
            ssoEmail,      // real email from Scaloz JWT (e.g. ankitha.s@xevyte.com)
            ssoName,       // real full name from Scaloz JWT
            ssoRole,       // Role from Scaloz JWT (e.g. "Admin", "Employee")
            firstName,
            lastName
        };

        // For backward compatibility
        req.user = {
            userId,
            tenantId
        };

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};
