import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import crypto from 'crypto';
import { isValidEmail } from '../utils/validators.js';
import { sendCredentialsEmail } from '../utils/emailService.js';

export const createUser = async (req, res, next) => {
    try {
        const { email, fullName, roleName, tenantId, employeeId, managerId, domainId } = req.body;
        const actor = req.auth;

        // 1. Validate input
        if (!email || !fullName || !roleName || !employeeId) {
            return res.status(400).json({ success: false, message: 'Missing required fields (email, name, role, employeeId)' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        // 2. Security Rules (Part 11)
        if (roleName === 'SUPER_ADMIN' && !actor.roles.includes('SUPER_ADMIN')) {
            return res.status(403).json({ success: false, message: 'Only SUPER_ADMIN can create other SUPER_ADMINs' });
        }

        // Target tenant safety
        const targetTenantId = tenantId || actor.tenantId;

        // 3. Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1 OR employee_id = $2', [email, employeeId]);
        let userId;

        if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            // Check if user already has a role in this tenant
            const existingRole = await query('SELECT role_id FROM user_roles WHERE user_id = $1', [userId]);
            if (existingRole.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'User already has a role in this tenant' });
            }
        }

        // 4. Generate secure random password
        const temporaryPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await hashPassword(temporaryPassword);

        // 5. Create user if not exists
        if (!userId) {
            const newUserId = `${targetTenantId}_${employeeId}`;
            const newUser = await query(
                `INSERT INTO users (id, email, password_hash, full_name, must_change_password, is_verified, employee_id, manager_id, domain_id) 
                 VALUES ($1, $2, $3, $4, true, true, $5, $6, $7) 
                 RETURNING id`,
                [newUserId, email, hashedPassword, fullName, employeeId, managerId || null, domainId || null]
            );
            userId = newUser.rows[0].id;
        }

        // 6. Assign role
        const role = await query('SELECT id FROM roles WHERE name = $1 AND (tenant_id IS NULL OR tenant_id = $2)', [roleName, targetTenantId]);
        if (role.rows.length === 0) {
            return res.status(404).json({ success: false, message: `Role ${roleName} not found` });
        }

        await query(
            `INSERT INTO user_roles (user_id, role_id, assigned_by) 
             VALUES ($1, $2, $3)`,
            [userId, role.rows[0].id, actor.userId]
        );

        // 7. Log audit event
        await query(
            `INSERT INTO audit_logs (actor_id, action, target_id, metadata) 
             VALUES ($1, $2, $3, $4)`,
            [actor.userId, 'INVITE_USER', userId, JSON.stringify({ email, roleName, tenantId: targetTenantId })]
        );

        // 8. Send credentials email
        // Implement sendCredentialsEmail in emailService or mock it here
        try {
            await sendCredentialsEmail(email, temporaryPassword);
        } catch (emailError) {
            console.error('Failed to send credentials email:', emailError);
            // We still return success but ideally we should inform that email failed
        }

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                userId,
                email,
                temporaryPassword // Included for dev purposes if email fails, but should be removed in prod
            }
        });
    } catch (error) {
        next(error);
    }
};

export const listUsers = async (req, res, next) => {
    try {
        const { tenantId, roles, userId } = req.auth;
        let queryText = `
            SELECT u.id, u.email, u.full_name, u.employee_id, r.name as role_name, ur.assigned_at, u.manager_id, u.domain_id
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE u.is_deleted = false
        `;
        const params = [];

        if (!roles.includes('SUPER_ADMIN')) {
            queryText += ` AND split_part(ur.user_id::text, '_', 1) = $${params.length + 1}`;
            params.push(tenantId);
        }

        if (roles.includes('MANAGER')) {
            // Managers only see their assigned recruiters
            queryText += ` AND u.manager_id = $${params.length + 1}`;
            params.push(userId);
        } else if (roles.includes('RECRUITER')) {
            // Recruiters see only themselves
            queryText += ` AND u.id = $${params.length + 1}`;
            params.push(userId);
        }

        const result = await query(queryText, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

export const getStats = async (req, res, next) => {
    try {
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        const managersCount = await query(
            `SELECT COUNT(DISTINCT ur.user_id) 
             FROM user_roles ur 
             JOIN roles r ON ur.role_id = r.id 
             JOIN users u ON ur.user_id = u.id
             WHERE r.name = 'MANAGER' AND u.is_deleted = false ${isSuperAdmin ? '' : 'AND split_part(ur.user_id, \'_\', 1) = $1'}`,
            isSuperAdmin ? [] : [tenantId]
        );

        const recruitersCount = await query(
            `SELECT COUNT(DISTINCT ur.user_id) 
             FROM user_roles ur 
             JOIN roles r ON ur.role_id = r.id 
             JOIN users u ON ur.user_id = u.id
             WHERE r.name = 'RECRUITER' AND u.is_deleted = false ${isSuperAdmin ? '' : 'AND split_part(ur.user_id, \'_\', 1) = $1'}`,
            isSuperAdmin ? [] : [tenantId]
        );

        // Count total assessments (not recruiter-manager links)
        const assessmentsCount = await query(
            `SELECT COUNT(*) FROM assessments ${isSuperAdmin ? '' : 'WHERE split_part(created_by, \'_\', 1) = $1'}`,
            isSuperAdmin ? [] : [tenantId]
        );

        res.json({
            success: true,
            data: {
                totalManagers: parseInt(managersCount.rows[0].count),
                eligibleTeamMembers: parseInt(recruitersCount.rows[0].count),
                totalAssessments: parseInt(assessmentsCount.rows[0].count)
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getHierarchy = async (req, res, next) => {
    try {
        const { tenantId } = req.auth;

        // Get managers and their assigned recruiters
        const managersResult = await query(
            `SELECT u.id, u.full_name, u.email, u.employee_id
             FROM users u
             JOIN user_roles ur ON u.id = ur.user_id
             JOIN roles r ON ur.role_id = r.id
             WHERE r.name = 'MANAGER' AND u.is_deleted = false AND split_part(ur.user_id::text, '_', 1) = $1`,
            [tenantId]
        );

        const managers = managersResult.rows;

        // For each manager, get their assignments
        for (let manager of managers) {
            const assignmentsResult = await query(
                `SELECT u.id, u.full_name, u.email, u.employee_id
                 FROM users u
                 JOIN manager_assignments ma ON u.id = ma.recruiter_id
                 WHERE ma.manager_id = $1 AND u.is_deleted = false`,
                [manager.id]
            );
            manager.recruiters = assignmentsResult.rows;
        }

        res.json({
            success: true,
            data: managers
        });
    } catch (error) {
        next(error);
    }
};

export const assignRecruiter = async (req, res, next) => {
    try {
        const { managerId, recruiterId } = req.body;
        const { tenantId, userId: actorId } = req.auth;

        if (!managerId || !recruiterId) {
            return res.status(400).json({ success: false, message: 'Manager ID and Recruiter ID are required' });
        }

        await query(
            `INSERT INTO manager_assignments (manager_id, recruiter_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [managerId, recruiterId]
        );

        // SYNC: Update manager_id directly on the user for faster scoping
        await query(
            `UPDATE users SET manager_id = $1 WHERE id = $2`,
            [managerId, recruiterId]
        );

        await query(
            `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
             VALUES ($1, $2, $3, $4)`,
            [actorId, 'ASSIGN_RECRUITER', recruiterId, JSON.stringify({ managerId, tenantId })]
        );

        res.json({
            success: true,
            message: 'Recruiter assigned successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const unassignRecruiter = async (req, res, next) => {
    try {
        const { managerId, recruiterId } = req.body;
        const { tenantId, userId: actorId } = req.auth;

        if (!managerId || !recruiterId) {
            return res.status(400).json({ success: false, message: 'Manager ID and Recruiter ID are required' });
        }

        await query(
            `DELETE FROM manager_assignments WHERE manager_id = $1 AND recruiter_id = $2`,
            [managerId, recruiterId]
        );

        // SYNC: Clear manager_id on user
        await query(
            `UPDATE users SET manager_id = NULL WHERE id = $1 AND manager_id = $2`,
            [recruiterId, managerId]
        );

        await query(
            `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
             VALUES ($1, $2, $3, $4)`,
            [actorId, 'UNASSIGN_RECRUITER', recruiterId, JSON.stringify({ managerId, tenantId })]
        );

        res.json({
            success: true,
            message: 'Recruiter unassigned successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fullName, employeeId, managerId, domainId, roleName } = req.body;
        const actor = req.auth;
        const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

        // 1. Validate if user exists and get their tenant
        const userCheck = await query(
            `SELECT ur.role_id, r.name as role_name, split_part(ur.user_id::text, '_', 1) as tenant_id
             FROM user_roles ur 
             JOIN roles r ON ur.role_id = r.id 
             WHERE ur.user_id = $1 ${!isSuperAdmin ? 'AND split_part(ur.user_id, \'_\', 1) = $2' : ''}`,
            isSuperAdmin ? [id] : [id, actor.tenantId]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found or access denied' });
        }

        const currentUserRole = userCheck.rows[0].role_name;
        const targetTenantId = userCheck.rows[0].tenant_id;

        // 2. Security Rules for Super Admins
        if (currentUserRole === 'SUPER_ADMIN' && !actor.roles.includes('SUPER_ADMIN')) {
            return res.status(403).json({ success: false, message: 'Only a SUPER_ADMIN can modify another SUPER_ADMIN' });
        }

        // 3. Basic user updates
        const updates = [];
        const params = [];
        if (fullName) {
            updates.push(`full_name = $${params.length + 1}`);
            params.push(fullName);
        }
        if (employeeId) {
            updates.push(`employee_id = $${params.length + 1}`);
            params.push(employeeId);
        }
        if (managerId !== undefined) {
            updates.push(`manager_id = $${params.length + 1}`);
            params.push(managerId === 'none' || !managerId ? null : managerId);
        }
        if (domainId !== undefined) {
            updates.push(`domain_id = $${params.length + 1}`);
            params.push(domainId === 'none' || !domainId ? null : domainId);
        }

        if (updates.length > 0) {
            params.push(id);
            await query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`,
                params
            );
        }

        // 4. Role update if roleName is provided
        if (roleName && roleName !== currentUserRole) {
            // Check if actor tries to promote someone to Super Admin without being one
            if (roleName === 'SUPER_ADMIN' && !actor.roles.includes('SUPER_ADMIN')) {
                return res.status(403).json({ success: false, message: 'Only SUPER_ADMIN can assign SUPER_ADMIN role' });
            }

            // Find new role
            const role = await query('SELECT id FROM roles WHERE name = $1 AND (tenant_id IS NULL OR tenant_id = $2)', [roleName, targetTenantId]);
            if (role.rows.length === 0) {
                return res.status(404).json({ success: false, message: `Role ${roleName} not found` });
            }

            // Update user_roles entry
            await query(
                `UPDATE user_roles SET role_id = $1 WHERE user_id = $2`,
                [role.rows[0].id, id]
            );

            // Log role change audit
            await query(
                `INSERT INTO audit_logs (actor_id, action, target_id, metadata) 
                 VALUES ($1, $2, $3, $4)`,
                [actor.userId, 'UPDATE_USER_ROLE', id, JSON.stringify({ oldRole: currentUserRole, newRole: roleName, tenantId: targetTenantId })]
            );
        }

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.auth.userId;

        if (id === actorId) {
            return res.status(400).json({ success: false, message: 'You cannot delete yourself' });
        }

        // Check if user is a SUPER_ADMIN (optional safety)
        const checkRole = await query(
            `SELECT r.name FROM roles r 
             JOIN user_roles ur ON r.id = ur.role_id 
             WHERE ur.user_id = $1 AND r.name = 'SUPER_ADMIN'`,
            [id]
        );

        if (checkRole.rows.length > 0 && !req.auth.roles.includes('SUPER_ADMIN')) {
            return res.status(403).json({ success: false, message: 'Only a SUPER_ADMIN can delete another SUPER_ADMIN' });
        }

        await query('UPDATE users SET is_deleted = true WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Role & Permission Management
 */

export const listRoles = async (req, res, next) => {
    try {
        const { tenantId } = req.auth;

        // Use DISTINCT ON (name) to prioritize tenant-specific roles over global ones if names clash
        // We order by name, then tenant_id DESC (NULLS LAST) so that a real tenant ID comes before NULL.
        const result = await query(
            `SELECT DISTINCT ON (r.name) r.*, 
                COALESCE(ARRAY_AGG(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') as permission_codes
             FROM roles r
             LEFT JOIN role_permissions rp ON r.id = rp.role_id
             LEFT JOIN permissions p ON rp.permission_id = p.id
             WHERE r.tenant_id IS NULL OR r.tenant_id = $1
             GROUP BY r.id, r.name, r.tenant_id
             ORDER BY r.name ASC, r.tenant_id DESC NULLS LAST`,
            [tenantId]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

export const createCustomRole = async (req, res, next) => {
    try {
        const { name, description, permissionCodes } = req.body;
        const { tenantId, userId, permissions: actorPermissions } = req.auth;

        if (!name || !permissionCodes || !Array.isArray(permissionCodes)) {
            return res.status(400).json({ success: false, message: 'Name and permission codes are required' });
        }

        // Security Rule (Part 9): requestedPermissions ⊆ actorPermissions
        if (!req.auth.roles.includes('SUPER_ADMIN')) {
            const hasUnauthorized = permissionCodes.some(p => !actorPermissions.includes(p));
            if (hasUnauthorized) {
                return res.status(403).json({ success: false, message: 'You cannot assign permissions you do not possess' });
            }
        }

        // 1. Verify all permission codes exist
        const pResult = await query('SELECT id, code FROM permissions WHERE code = ANY($1)', [permissionCodes]);
        if (pResult.rows.length !== permissionCodes.length) {
            return res.status(400).json({ success: false, message: 'Invalid permission codes provided' });
        }

        // 2. Create role (is_system_role = false)
        const roleResult = await query(
            `INSERT INTO roles (name, description, tenant_id, is_system_role, created_by)
             VALUES ($1, $2, $3, false, $4)
             RETURNING id`,
            [name, description, tenantId, userId]
        );
        const roleId = roleResult.rows[0].id;

        // 3. Insert role_permissions
        for (let p of pResult.rows) {
            await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, p.id]);
        }

        // 4. Audit Log
        await query(
            `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'CREATE_CUSTOM_ROLE', roleId, JSON.stringify({ name, permissionCodes, tenantId })]
        );

        res.status(201).json({ success: true, message: 'Custom role created successfully', data: { roleId } });
    } catch (error) {
        next(error);
    }
};

export const updateCustomRole = async (req, res, next) => {
    try {
        const { roleId } = req.params;
        const { name, description, permissionCodes } = req.body;
        const { tenantId, permissions: actorPermissions } = req.auth;

        const role = await query('SELECT * FROM roles WHERE id = $1 AND tenant_id = $2', [roleId, tenantId]);
        if (role.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Custom role not found' });
        }

        if (role.rows[0].is_system_role) {
            return res.status(403).json({ success: false, message: 'System roles cannot be modified' });
        }

        if (!req.auth.roles.includes('SUPER_ADMIN') && permissionCodes) {
            const hasUnauthorized = permissionCodes.some(p => !actorPermissions.includes(p));
            if (hasUnauthorized) {
                return res.status(403).json({ success: false, message: 'You cannot assign permissions you do not possess' });
            }
        }

        await query(
            `UPDATE roles SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3`,
            [name, description, roleId]
        );

        if (permissionCodes) {
            const pResult = await query('SELECT id FROM permissions WHERE code = ANY($1)', [permissionCodes]);
            await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
            for (let p of pResult.rows) {
                await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [roleId, p.id]);
            }
        }

        res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const deleteCustomRole = async (req, res, next) => {
    try {
        const { roleId } = req.params;
        const { tenantId } = req.auth;

        const role = await query('SELECT * FROM roles WHERE id = $1 AND tenant_id = $2', [roleId, tenantId]);
        if (role.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Custom role not found' });
        }

        if (role.rows[0].is_system_role) {
            return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
        }

        await query('DELETE FROM roles WHERE id = $1', [roleId]);
        res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const listPermissions = async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM permissions ORDER BY code ASC');

        const grouped = result.rows.reduce((acc, p) => {
            let cat = 'other';
            if (p.code.includes('assessment')) cat = 'assessments';
            else if (p.code.includes('question')) cat = 'questions';
            else if (p.code.includes('candidate')) cat = 'candidates';
            else if (p.code.includes('domain')) cat = 'domains';
            else if (p.code.includes('user') || p.code.includes('role')) cat = 'users';
            else if (p.code.includes('report')) cat = 'reports';
            else if (p.code.includes('setting')) cat = 'admin';

            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});

        res.json({ success: true, data: grouped });
    } catch (error) {
        next(error);
    }
};
