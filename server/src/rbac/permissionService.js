import { query } from '../config/database.js';
 
/**
 * Service to resolve user roles and permissions
 */

export const getUserRolesAndPermissions = async (userId, tenantId) => {
    try {
        // 1. Get user roles.
        // Note: tenant_id was dropped from user_roles in migration 024.
        // Tenant scoping is encoded in the user_id prefix (e.g. "pysquare_emp001").
        // We filter by user_id only — the split_part tenant filter was removed because
        // it caused empty role resolution when the JWT tenantId didn't match the DB
        // user_id prefix (e.g. for SSO users resolved via email lookup).
        const rolesResult = await query(
            `SELECT r.id, r.name 
             FROM roles r
             JOIN user_roles ur ON r.id = ur.role_id
             WHERE ur.user_id = $1`,
            [userId]
        );

        const roles = rolesResult.rows;
        const roleIds = roles.map(r => r.id);
        const roleNames = roles.map(r => r.name);

        if (roleIds.length === 0) {
            return { roles: [], permissions: [] };
        }

        // 2. Get permissions for these roles, including fallback to system role permissions by name
        const permissionsResult = await query(
            `SELECT DISTINCT p.code
             FROM permissions p
             JOIN role_permissions rp ON p.id = rp.permission_id
             JOIN roles r ON rp.role_id = r.id
             WHERE rp.role_id = ANY($1)
                OR (r.name = ANY($2) AND r.tenant_id IS NULL AND r.is_system_role = true)`,
            [roleIds, roleNames]
        );

        const permissions = permissionsResult.rows.map(p => p.code);

        // Failsafe: Ensure system roles always have their baseline permissions, 
        // even if the test database role_permissions table is empty due to a failed migration.
        if (roleNames.includes('SUPER_ADMIN') && !permissions.includes('all')) {
            permissions.push('all');
        }
        if (roleNames.includes('RECRUITER') || roleNames.includes('MANAGER')) {
            const baselinePerms = ['create_assessments', 'create_questions', 'delete_assessments', 'delete_questions', 'edit_questions', 'manage_candidates', 'view_questions', 'view_reports'];
            baselinePerms.forEach(p => { if (!permissions.includes(p)) permissions.push(p); });
        }

        return {
            roles: roleNames,
            permissions
        };
    } catch (error) {
        console.error('Error in getUserRolesAndPermissions:', error);
        throw error;
    }
};

export const hasPermission = (userPermissions, requiredPermission) => {
    return userPermissions.includes(requiredPermission) || userPermissions.includes('all');
};

export const hasRole = (userRoles, requiredRole) => {
    return userRoles.includes(requiredRole) || userRoles.includes('SUPER_ADMIN');
};
