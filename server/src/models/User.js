import { query } from '../config/database.js';

export const createUser = async (email, passwordHash, fullName, companyName, verificationToken, tokenExpiry) => {
    const result = await query(
        `INSERT INTO users (email, password_hash, full_name, company_name, verification_token, verification_token_expiry)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, full_name, company_name, created_at`,
        [email, passwordHash, fullName, companyName, verificationToken, tokenExpiry]
    );
    return result.rows[0];
};

export const findUserByEmail = async (email) => {
    const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );
    return result.rows[0];
};

export const findUserByIdentifier = async (identifier) => {
    const result = await query(
        `SELECT *, split_part(id::text, '_', 1) as tenant_id FROM users WHERE email = $1 OR employee_id = $1`,
        [identifier]
    );
    return result.rows[0];
};

export const findUserById = async (id) => {
    const result = await query(
        'SELECT id, email, full_name, company_name, manager_id, domain_id, split_part(id::text, \'_\', 1) as tenant_id, created_at, updated_at, must_change_password FROM users WHERE id = $1',
        [id]
    );
    return result.rows[0];
};

export const updateUser = async (id, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.full_name !== undefined) {
        fields.push(`full_name = $${paramCount++}`);
        values.push(updates.full_name);
    }

    if (updates.company_name !== undefined) {
        fields.push(`company_name = $${paramCount++}`);
        values.push(updates.company_name);
    }

    if (fields.length === 0) {
        return findUserById(id);
    }

    values.push(id);

    const result = await query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
     RETURNING id, email, full_name, company_name, created_at, updated_at`,
        values
    );

    return result.rows[0];
};
export const findUserByVerificationToken = async (token) => {
    const result = await query(
        'SELECT * FROM users WHERE verification_token = $1',
        [token]
    );
    return result.rows[0];
};

export const verifyUser = async (id) => {
    const result = await query(
        'UPDATE users SET is_verified = true, verification_token = NULL, verification_token_expiry = NULL WHERE id = $1 RETURNING *',
        [id]
    );
    return result.rows[0];
};

export const updateVerificationToken = async (id, token, expiry) => {
    const result = await query(
        'UPDATE users SET verification_token = $1, verification_token_expiry = $2 WHERE id = $3 RETURNING *',
        [token, expiry, id]
    );
    return result.rows[0];
};

export const updateResetToken = async (id, token, expiry) => {
    const result = await query(
        'UPDATE users SET reset_password_token = $1, reset_password_expiry = $2 WHERE id = $3 RETURNING *',
        [token, expiry, id]
    );
    return result.rows[0];
};

export const findUserByResetToken = async (token) => {
    const result = await query(
        'SELECT * FROM users WHERE reset_password_token = $1',
        [token]
    );
    return result.rows[0];
};

export const updatePassword = async (id, passwordHash) => {
    const result = await query(
        'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expiry = NULL, must_change_password = false WHERE id = $2 RETURNING *',
        [passwordHash, id]
    );
    return result.rows[0];
};

export const getUserRoles = async (userId) => {
    const result = await query(
        `SELECT ur.role_id, split_part(ur.user_id::text, '_', 1) as tenant_id, r.name as role_name 
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1`,
        [userId]
    );
    return result.rows;
};

