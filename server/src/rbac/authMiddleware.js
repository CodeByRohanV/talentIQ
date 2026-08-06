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
        const tenantId = decoded.tenant || decoded.tenantId;
        const tenantName = decoded.tenantName || null;
        const employeeId = decoded.employeeId;
        let userId = decoded.userId;

        // Extract real identity from Scaloz JWT claims
        const ssoEmail = decoded.sub && decoded.sub.includes('@') ? decoded.sub : null;
        const firstName = decoded.firstName || null;
        const lastName = decoded.lastName || null;
        const ssoName = decoded.name ||
            (firstName && lastName ? `${firstName} ${lastName}`.trim() : null) ||
            firstName || null;

        if (!userId && tenantId && employeeId) {
            const cleanEmpId = employeeId.includes('_')
                ? employeeId.substring(employeeId.lastIndexOf('_') + 1)
                : employeeId;
            userId = `${tenantId}_${cleanEmpId}`;
        }

        if (!tenantId || !userId) {
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
        if (!dbUserId && userId) {
            const existingUserRes = await query('SELECT id FROM users WHERE id = $1 OR employee_id = $2', [userId, userId]);
            if (existingUserRes.rows.length > 0) {
                dbUserId = existingUserRes.rows[0].id;
            }
        }

        // Override userId if an existing database record exists (e.g. UUID id)
        if (dbUserId) {
            userId = dbUserId;
        }

        // Fetch managerId and domainId dynamically from DB
        const userRes = await query('SELECT manager_id, domain_id FROM users WHERE id = $1', [userId]);
        const dbUser = userRes.rows[0] || {};
        const managerId = dbUser.manager_id || null;
        const domainId = dbUser.domain_id || null;

        // Resolve permissions from DB (not JWT)
        const { roles, permissions } = await permissionService.getUserRolesAndPermissions(userId, tenantId);

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
