import { query } from '../config/database.js';
import { hashPassword } from '../utils/password.js';
import crypto from 'crypto';

const PERMISSIONS = [
    { code: 'invite_users', description: 'Can invite new users to the platform' },
    { code: 'manage_roles', description: 'Can create and assign roles' },
    { code: 'create_questions', description: 'Can create new questions' },
    { code: 'edit_questions', description: 'Can edit existing questions' },
    { code: 'delete_questions', description: 'Can delete questions' },
    { code: 'create_assessments', description: 'Can create new assessments' },
    { code: 'delete_assessments', description: 'Can delete assessments' },
    { code: 'view_questions', description: 'Can view question bank' },
    { code: 'view_reports', description: 'Can view assessment reports' },
    { code: 'manage_candidates', description: 'Can manage candidates and invites' },
    { code: 'assign_hierarchy', description: 'Can assign recruiters to managers' },
    { code: 'assign_roles', description: 'Can assign roles to users' },
    { code: 'publish_assessment', description: 'Can publish/activate assessments' },
    { code: 'edit_assessment_security', description: 'Can configure anti-cheating, dev-mode detection, and browser lockdown' },
    { code: 'edit_assessment_scheduling', description: 'Can modify assessment timers, activation windows, and expiration dates' },
    { code: 'edit_assessment_instructions', description: 'Can update custom instructions shown to candidates' },
    { code: 'bulk_delete_assessments', description: 'Can perform mass-deletion of assessment records' }
];

const ROLE_MAPPINGS = {
    'SUPER_ADMIN': [
        'invite_users', 'manage_roles', 'create_questions', 'edit_questions', 'delete_questions',
        'create_assessments', 'delete_assessments', 'view_questions', 'view_reports',
        'manage_candidates', 'assign_hierarchy', 'assign_roles', 'publish_assessment',
        'edit_assessment_security', 'edit_assessment_scheduling', 'edit_assessment_instructions',
        'bulk_delete_assessments'
    ],
    'ADMIN': [
        'manage_roles', 'create_questions', 'edit_questions', 'delete_questions',
        'create_assessments', 'delete_assessments', 'view_reports', 'manage_candidates',
        'assign_hierarchy', 'invite_users', 'view_questions', 'assign_roles',
        'publish_assessment', 'bulk_delete_assessments'
    ],
    'RECRUITER': [
        'create_questions', 'edit_questions', 'delete_questions',
        'create_assessments', 'delete_assessments',
        'manage_candidates', 'view_reports', 'view_questions'
    ],
    'COLLABORATOR': [
        'create_assessments', 'view_questions', 'view_reports'
    ],
    'MANAGER': [
        'view_reports', 'manage_candidates', 'view_questions',
        'create_assessments', 'assign_hierarchy'
    ]
};

const ROLE_DESCRIPTIONS = {
    'SUPER_ADMIN': 'Global system administrator with full access to all data, settings, and multi-tenant management.',
    'ADMIN': 'Organization administrator with full control over users, roles, and all assessment data within the tenant.',
    'RECRUITER': 'Standard member focused on question management and creating/sending assessments.',
    'MANAGER': 'High-level member with access to reports, hierarchy management, and assessment creation.',
    'COLLABORATOR': 'Restricted access member with view-only permissions for reports and basic assessment tools.'
};

async function seedRBAC() {
    try {
        console.log('🌱 Seeding RBAC permissions and roles...');

        // 1. Seed Permissions
        for (const perm of PERMISSIONS) {
            await query(
                `INSERT INTO permissions (code, description) 
                 VALUES ($1, $2) 
                 ON CONFLICT (code) DO UPDATE SET description = $2`,
                [perm.code, perm.description]
            );
        }
        console.log('✅ Permissions seeded.');

        // 2. Seed System Roles
        for (const roleName of Object.keys(ROLE_MAPPINGS)) {
            const description = ROLE_DESCRIPTIONS[roleName] || '';

            // Check if system role exists (NULL tenant_id)
            const existingRoleResult = await query(
                'SELECT id FROM roles WHERE name = $1 AND tenant_id IS NULL AND is_system_role = true',
                [roleName]
            );

            let roleId;
            if (existingRoleResult.rows.length === 0) {
                // Create new
                const roleResult = await query(
                    `INSERT INTO roles (name, description, is_system_role, tenant_id) 
                     VALUES ($1, $2, true, NULL) 
                     RETURNING id`,
                    [roleName, description]
                );
                roleId = roleResult.rows[0].id;
                console.log(`+ Created system role: ${roleName}`);
            } else {
                // Update existing
                roleId = existingRoleResult.rows[0].id;
                await query('UPDATE roles SET description = $1 WHERE id = $2', [description, roleId]);
                console.log(`~ Updated system role: ${roleName}`);
            }

            // 3. Map Permissions to Role
            // Clear existing for a clean state if it's a system role
            await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

            const permissionCodes = ROLE_MAPPINGS[roleName];
            for (const code of permissionCodes) {
                const permResult = await query('SELECT id FROM permissions WHERE code = $1', [code]);
                if (permResult.rows.length > 0) {
                    await query(
                        'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [roleId, permResult.rows[0].id]
                    );
                }
            }
        }
        console.log('✅ Roles and mappings seeded.');

        // 4. Bootstrap SUPER_ADMIN (Part 12)
        const superAdminEmail = 'madhu@xevyte.com';
        const existingSuperAdmin = await query(
            `SELECT u.id FROM users u 
             JOIN user_roles ur ON u.id = ur.user_id 
             JOIN roles r ON ur.role_id = r.id 
             WHERE r.name = 'SUPER_ADMIN'`,
            []
        );

        if (existingSuperAdmin.rows.length === 0) {
            console.warn('⚠️ No SUPER_ADMIN found. Bootstrapping default admin...');

            // Check if user exists but lacks role
            let user = await query('SELECT id, tenant_id FROM users WHERE email = $1', [superAdminEmail]);
            let userId;
            let tenantId;

            if (user.rows.length === 0) {
                const hashedPassword = await hashPassword('Admin@123');
                tenantId = crypto.randomUUID();
                const newUser = await query(
                    `INSERT INTO users (email, password_hash, full_name, company_name, must_change_password, is_verified, tenant_id) 
                     VALUES ($1, $2, $3, $4, true, true, $5) 
                     RETURNING id, tenant_id`,
                    [superAdminEmail, hashedPassword, 'SuperAdmin', 'skillz', tenantId]
                );
                userId = newUser.rows[0].id;
                tenantId = newUser.rows[0].tenant_id;
            } else {
                userId = user.rows[0].id;
                tenantId = user.rows[0].tenant_id;
                await query('UPDATE users SET must_change_password = true WHERE id = $1', [userId]);
            }

            const superAdminRole = await query("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'", []);
            if (superAdminRole.rows.length > 0) {
                await query(
                    `INSERT INTO user_roles (user_id, role_id, tenant_id) 
                     VALUES ($1, $2, $3) 
                     ON CONFLICT DO NOTHING`,
                    [userId, superAdminRole.rows[0].id, tenantId]
                );
                console.log(`✅ Bootstrap admin created: ${superAdminEmail} / Admin@123`);
            }
        }

        console.log('🚀 RBAC Seeding Complete!');
    } catch (error) {
        console.error('❌ RBAC Seeding failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedRBAC().then(() => process.exit(0));
}

export { seedRBAC };
