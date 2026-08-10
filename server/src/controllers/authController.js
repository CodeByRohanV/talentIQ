import crypto from 'crypto';
import { hashPassword, comparePassword, validatePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwtUtil.js';
import { isValidEmail } from '../utils/validators.js';
import * as User from '../models/User.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/emailService.js';
import * as permissionService from '../rbac/permissionService.js';

export const register = async (req, res, next) => {
    try {
        const { email, password, fullName, companyName } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character'
            });
        }

        // Check if user already exists
        const existingUser = await User.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Hash password and create user
        const passwordHash = await hashPassword(password);
        const user = await User.createUser(email, passwordHash, fullName, companyName, verificationToken, tokenExpiry);

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    companyName: user.company_name,
                    createdAt: user.created_at
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user by email or employee_id
        const user = await User.findUserByIdentifier(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await comparePassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if verified
        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address before logging in.',
                needsVerification: true,
                email: user.email
            });
        }

        // Get roles and tenant
        const userRoles = await User.getUserRoles(user.id);
        const roleIds = userRoles.map(r => r.role_id);
        const tenantId = user.tenant_id;

        // Resolve names and permissions for the frontend
        const { roles: roleNames, permissions } = await permissionService.getUserRolesAndPermissions(user.id, tenantId);

        console.log(`[Login] User ${user.email} logged in. Roles: ${roleNames.join(', ')}, Permissions: ${permissions.length}`);

        // Generate token
        const token = generateToken(user.id, tenantId, roleIds, user.manager_id, user.domain_id);

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    companyName: user.company_name,
                    createdAt: user.created_at,
                    tenantId: user.tenant_id || null,
                    managerId: user.manager_id,
                    domainId: user.domain_id,
                    roles: roleNames,
                    permissions: permissions,
                    mustChangePassword: user.must_change_password
                },
                token,
                forcePasswordReset: user.must_change_password
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req, res, next) => {
    try {
        let user = null;
        const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(req.auth.userId);
        if (isUUID) {
            user = await User.findUserById(req.auth.userId);
        }
        let freshRoles = req.auth.roles;
        let freshPermissions = req.auth.permissions;

        // SSO Just-in-Time Provisioning:
        // If the JWT is valid but this user has never been synced to XeSkillz DB,
        // auto-create them from the token claims so the SSO flow works seamlessly.
        if (!user) {
            const { query } = await import('../config/database.js');
            const { hashPassword } = await import('../utils/password.js');

            const userId = req.auth.userId;
            const tenantId = req.auth.tenantId;

            // Derive a safe employee_id from the userId (strip tenant prefix)
            const employeeId = userId.includes('_')
                ? userId.substring(userId.lastIndexOf('_') + 1)
                : userId;

            // Use the real name and email from the Scaloz JWT claims
            const realEmail = req.auth.ssoEmail || `${userId}@sso.local`;
            const realName = req.auth.ssoName ||
                (req.auth.firstName && req.auth.lastName
                    ? `${req.auth.firstName} ${req.auth.lastName}`.trim()
                    : req.auth.firstName) ||
                employeeId;

            // Default to SUPER_ADMIN for workspace-launched SSO users
            const roleName = 'SUPER_ADMIN';

            // JIT Provision Tenant if it doesn't exist (to satisfy fk_users_tenant constraint)
            await query(
                `INSERT INTO tenants (id, name, status) VALUES ($1, $2, 'Active') ON CONFLICT (id) DO NOTHING`,
                [tenantId, req.auth.tenantName || tenantId]
            );

            // Create the user with a random password (they will always log in via SSO)
            // Let Postgres generate the UUID for id automatically.
            const randomPassword = await hashPassword(Math.random().toString(36).slice(-12));

            const insertRes = await query(
                `INSERT INTO users (email, password_hash, full_name, employee_id, must_change_password, is_verified)
                 VALUES ($1, $2, $3, $4, false, true)
                 ON CONFLICT (employee_id) DO NOTHING
                 RETURNING id`,
                [realEmail, randomPassword, realName, userId]
            );
            
            let newUserId = userId;
            if (insertRes.rows.length > 0) {
                newUserId = insertRes.rows[0].id;
            } else {
                // If it conflicted but didn't return, fetch the existing UUID
                const existRes = await query(`SELECT id FROM users WHERE email = $1 OR employee_id = $2`, [realEmail, userId]);
                if (existRes.rows.length > 0) {
                    newUserId = existRes.rows[0].id;
                }
            }

            // Assign SUPER_ADMIN role
            const roleRes = await query(
                `SELECT id FROM roles WHERE name = $1 AND (tenant_id = $2 OR tenant_id IS NULL) ORDER BY tenant_id NULLS LAST LIMIT 1`,
                [roleName, tenantId]
            );
            if (roleRes.rows.length > 0) {
                await query(
                    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [newUserId, roleRes.rows[0].id]
                );
            }

            console.log(`[SSO] Auto-provisioned/refreshed user from JWT: ${newUserId} → ${realEmail} (${realName})`);
            user = await User.findUserById(newUserId);

            // Re-fetch fresh roles and permissions after provisioning
            const fresh = await permissionService.getUserRolesAndPermissions(newUserId, tenantId);
            freshRoles = fresh.roles;
            freshPermissions = fresh.permissions;
        } else if (user && (user.email?.endsWith('@sso.local') || !user.full_name || user.full_name === user.employee_id || (req.auth.ssoEmail && req.auth.ssoEmail !== user.email))) {
            // User already exists but has stale/fake SSO data — update on this login
            const { query } = await import('../config/database.js');
            const realEmail = req.auth.ssoEmail || user.email;
            const employeeId = req.auth.userId.includes('_')
                ? req.auth.userId.substring(req.auth.userId.lastIndexOf('_') + 1)
                : req.auth.userId;
            const realName = req.auth.ssoName ||
                (req.auth.firstName && req.auth.lastName
                    ? `${req.auth.firstName} ${req.auth.lastName}`.trim()
                    : req.auth.firstName) ||
                user.full_name;
            if (realEmail !== user.email || realName !== user.full_name) {
                await query(
                    `UPDATE users SET email = $2, full_name = $3 WHERE id = $1`,
                    [user.id, realEmail, realName]
                );
                console.log(`[SSO] Updated stale profile for ${user.id}: email=${realEmail}, name=${realName}`);
                user = await User.findUserById(user.id);
            }
        }

        if (!user) {
            return res.status(500).json({
                success: false,
                message: 'Failed to provision user'
            });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                companyName: user.company_name,
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                tenantId: user.tenant_id,
                managerId: user.manager_id,
                domainId: user.domain_id,
                roles: freshRoles,
                permissions: freshPermissions,
                mustChangePassword: user.must_change_password
            }
        });
    } catch (error) {
        next(error);
    }
};


export const updateProfile = async (req, res, next) => {
    try {
        const { fullName, companyName } = req.body;

        const updates = {};
        if (fullName !== undefined) updates.full_name = fullName;
        if (companyName !== undefined) updates.company_name = companyName;

        const user = await User.updateUser(req.user.userId, updates);

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                companyName: user.company_name,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }
        });
    } catch (error) {
        next(error);
    }
};
export const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        const user = await User.findUserByVerificationToken(token);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token. If you have already verified your email, please try logging in.'
            });
        }

        if (new Date(user.verification_token_expiry) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Verification token has expired. Please request a new one.'
            });
        }

        await User.verifyUser(user.id);

        res.json({
            success: true,
            message: 'Email verified successfully. You can now log in.'
        });
    } catch (error) {
        next(error);
    }
};

export const resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findUserByEmail(email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Account is already verified'
            });
        }

        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await User.updateVerificationToken(user.id, verificationToken, tokenExpiry);

        // Send verification email
        await sendVerificationEmail(email, verificationToken);

        res.json({
            success: true,
            message: 'Verification email has been re-sent. Please check your inbox.'
        });
    } catch (error) {
        next(error);
    }
};

export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findUserByEmail(email);

        if (!user) {
            // We return 200 even if user not found for security reasons (prevent email enumeration)
            return res.json({
                success: true,
                message: 'If an account exists with this email, a reset link has been sent.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await User.updateResetToken(user.id, resetToken, tokenExpiry);
        await sendPasswordResetEmail(email, resetToken);

        res.json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent.'
        });
    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character'
            });
        }

        const user = await User.findUserByResetToken(token);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        if (new Date(user.reset_password_expiry) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired. Please request a new one.'
            });
        }

        const passwordHash = await hashPassword(newPassword);
        await User.updatePassword(user.id, passwordHash);

        // Also verify the user since they have proven ownership of the email via reset token
        await User.verifyUser(user.id);

        res.json({
            success: true,
            message: 'Password reset successful. You can now log in with your new password.'
        });
    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.auth.userId;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character'
            });
        }

        const user = await User.findUserById(userId);

        // When forced to change password, we might not require current password if they just logged in
        // However, for standard changes, we should.
        // For first login, we'll assume they are authenticated via the temporary password.

        const passwordHash = await hashPassword(newPassword);
        await User.updatePassword(userId, passwordHash);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
    }
};
