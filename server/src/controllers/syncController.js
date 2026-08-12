import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import { verifyToken } from '../utils/jwtUtil.js';

/**
 * POST /api/auth/sync-user
 * Called by Scaloz Workspace when a new employee is onboarded or updated.
 * Secured by X-API-Key header.
 */
export const syncUser = async (req, res, next) => {
    try {
        // 1. Verify Auth (API Key or JWT Bearer token)
        const apiKey = req.headers['x-api-key'];
        const expectedKey = process.env.SCALOZ_API_KEY;
        const authHeader = req.headers.authorization;
        let isAuthenticated = false;

        if (expectedKey && apiKey && apiKey === expectedKey) {
            isAuthenticated = true;
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            // System sync tokens have subject "system_sync" or role "SYSTEM"
            if (decoded && (decoded.sub === 'system_sync' || decoded.role === 'SYSTEM')) {
                isAuthenticated = true;
            }
        }

        if (!isAuthenticated) {
            return res.status(403).json({ success: false, message: 'Unauthorized: Invalid API key or token' });
        }

        // 2. Parse the payload sent by Scaloz
        const {
            employeeId,   // e.g. "skills-0002_H100679" (Scaloz already prefixes it)
            firstName,
            lastName,
            email,
            role,         // e.g. "Employee", "Admin"
            tenantId,     // e.g. "skills-0002"
            tenantCode,   // same as tenantId, Scaloz sends both
            password      // raw temporary password (optional, Scaloz sends on onboard)
        } = req.body;

        // 3. Validate required fields
        if (!employeeId || !email || !tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: employeeId, email, tenantId'
            });
        }

        const resolvedTenantId = tenantCode || tenantId;
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || email;

        // Extract clean employee_id (strip prefix if Scaloz already added it)
        const cleanEmployeeId = employeeId.includes('_')
            ? employeeId.substring(employeeId.lastIndexOf('_') + 1)
            : employeeId;

        // Build the skillz user ID: {tenantCode}_{employeeId}
        const userId = `${resolvedTenantId}_${cleanEmployeeId}`;

        // 4. Check if user already exists (by id or email)
        const existingById = await query('SELECT id FROM users WHERE id = $1', [userId]);
        const existingByEmail = await query('SELECT id FROM users WHERE email = $1', [email]);

        if (existingById.rows.length > 0 || existingByEmail.rows.length > 0) {
            // User already exists — update their details
            const existingUserId = existingById.rows[0]?.id || existingByEmail.rows[0]?.id;
            await query(
                `UPDATE users SET 
                    full_name = $1,
                    employee_id = $2,
                    updated_at = now()
                 WHERE id = $3`,
                [fullName, userId, existingUserId]
            );
            console.log(`[Sync] Updated existing user: ${existingUserId}`);
            return res.json({ success: true, message: 'User updated successfully', userId: existingUserId });
        }

        // 5. Hash the temporary password
        const rawPassword = password || Math.random().toString(36).slice(-10);
        const passwordHash = await hashPassword(rawPassword);

        // 6. Insert new user into users table
        await query(
            `INSERT INTO users (id, email, password_hash, full_name, employee_id, must_change_password, is_verified)
             VALUES ($1, $2, $3, $4, $5, true, true)`,
            [userId, email, passwordHash, fullName, userId]
        );

        // 7. Assign role in user_roles table
        // Map Scaloz role names to skillz role names
        const roleMapping = {
            'Admin':       'SUPER_ADMIN',
            'Manager':     'MANAGER',
            'Recruiter':   'RECRUITER',
            'Employee':    'RECRUITER',   // Default to RECRUITER for employees
            'Collaborator': 'COLLABORATOR'
        };
        const skillzRoleName = roleMapping[role] || 'RECRUITER';

        // Find the matching role in skillz (system roles have NULL tenant_id)
        const roleResult = await query(
            `SELECT id FROM roles WHERE name = $1 AND tenant_id IS NULL LIMIT 1`,
            [skillzRoleName]
        );

        if (roleResult.rows.length > 0) {
            const roleId = roleResult.rows[0].id;
            await query(
                `INSERT INTO user_roles (user_id, role_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [userId, roleId]
            );
            console.log(`[Sync] Assigned role ${skillzRoleName} to user ${userId}`);
        } else {
            console.warn(`[Sync] Role ${skillzRoleName} not found for tenant ${resolvedTenantId}. User created without role.`);
        }

        console.log(`[Sync] Successfully created user: ${userId} (${email}) under tenant ${resolvedTenantId}`);

        return res.status(201).json({
            success: true,
            message: 'User synced and created successfully',
            userId
        });

    } catch (error) {
        console.error('[Sync] Error in syncUser:', error);
        next(error);
    }
};

/**
 * POST /api/integration/sync/tenant
 * Called by Scaloz Workspace when a new tenant is created or updated.
 * Secured by X-API-Key header.
 */
export const syncTenant = async (req, res, next) => {
    try {
        // Verify Auth (API Key or JWT Bearer token)
        const apiKey = req.headers['x-api-key'];
        const expectedKey = process.env.SCALOZ_API_KEY;
        const authHeader = req.headers.authorization;
        let isAuthenticated = false;

        if (expectedKey && apiKey && apiKey === expectedKey) {
            isAuthenticated = true;
        } else if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            // System sync tokens have subject "system_sync" or role "SYSTEM"
            if (decoded && (decoded.sub === 'system_sync' || decoded.role === 'SYSTEM')) {
                isAuthenticated = true;
            }
        }

        if (!isAuthenticated) {
            return res.status(403).json({ success: false, message: 'Unauthorized: Invalid API key or token' });
        }

        const { tenantId, tenantName } = req.body;

        if (!tenantId || !tenantName) {
            return res.status(400).json({ success: false, message: 'Missing tenantId or tenantName' });
        }

        // Upsert tenant into tenants table
        await query(
            `INSERT INTO tenants (id, name, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (id) DO UPDATE 
             SET name = EXCLUDED.name, updated_at = now()`,
            [tenantId, tenantName]
        );

        console.log(`[Sync] Synced tenant: ${tenantId} (${tenantName})`);
        return res.status(200).json({ success: true, message: 'Tenant synced successfully' });

    } catch (error) {
        console.error('[Sync] Error in syncTenant:', error);
        next(error);
    }
};
