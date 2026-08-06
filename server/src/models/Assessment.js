import crypto from 'crypto';
import { query, getClient } from '../config/database.js';
import { DEFAULT_SECURITY_CONFIG } from '../config/security.js';

export const createAssessment = async (userId, tenantId, role, title, description, durationMinutes, questionsConfig, thresholds, securityConfig, managerId = null, expiresAt = null, instructions = null, availableFrom = null, availableUntil = null) => {
    const shareToken = crypto.randomBytes(16).toString('hex');
    const result = await query(
        `INSERT INTO assessments (created_by, created_by_role, title, description, duration_minutes, questions_config, thresholds, security_config, created_by_manager_id, expires_at, instructions, available_from, available_until, share_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
            userId,
            role,
            title,
            description,
            durationMinutes,
            JSON.stringify(questionsConfig),
            JSON.stringify(thresholds),
            JSON.stringify(securityConfig || DEFAULT_SECURITY_CONFIG),
            managerId || userId,
            expiresAt,
            instructions,
            availableFrom,
            availableUntil,
            shareToken
        ]
    );
    return result.rows[0];
};

/**
 * Role-aware retrieval of assessments based on hierarchy and tenant
 */
export const findAssessmentsRoleAware = async (userId, tenantId, roles, managerId = null) => {
    // Auto-complete expired assessments before fetching
    await query(
        `UPDATE assessments 
         SET status = 'completed', is_active = false 
         WHERE status = 'active' 
         AND (
             (expires_at IS NOT NULL AND expires_at < NOW()) OR
             (available_until IS NOT NULL AND available_until < NOW())
         )`,
        []
    );

    let queryText;
    let params;

    // Base query that includes candidate count
    const baseQuery = `
        SELECT a.*, u.full_name AS creator_name, u.email AS creator_email,
               (SELECT COUNT(*) FROM candidates c WHERE c.assessment_id = a.id) as candidate_count
        FROM assessments a
        LEFT JOIN users u ON u.id = a.created_by
    `;

    if (roles.includes('SUPER_ADMIN')) {
        queryText = `${baseQuery} ORDER BY a.created_at DESC`;
        params = [];
    } else if (roles.includes('ADMIN')) {
        queryText = `${baseQuery} WHERE split_part(a.created_by, '_', 1) = $1 ORDER BY a.created_at DESC`;
        params = [tenantId];
    } else if (roles.includes('MANAGER')) {
        queryText = `${baseQuery} WHERE split_part(a.created_by, '_', 1) = $1 AND a.created_by_manager_id = $2 ORDER BY a.created_at DESC`;
        params = [tenantId, managerId || userId];
    } else if (roles.includes('RECRUITER')) {
        queryText = `${baseQuery} WHERE split_part(a.created_by, '_', 1) = $1 AND a.created_by_manager_id = $2 ORDER BY a.created_at DESC`;
        params = [tenantId, managerId];
    } else {
        queryText = `${baseQuery} WHERE split_part(a.created_by, '_', 1) = $1 AND a.created_by = $2 ORDER BY a.created_at DESC`;
        params = [tenantId, userId];
    }

    const result = await query(queryText, params);
    return result.rows;
};

export const findAssessmentById = async (id, tenantId = null) => {
    let queryText = `
        SELECT a.*, u.full_name as creator_name, u.email as creator_email,
               (SELECT COUNT(*) FROM candidates c WHERE c.assessment_id = a.id) as candidate_count
        FROM assessments a 
        LEFT JOIN users u ON a.created_by = u.id 
        WHERE a.id = $1`;
    const params = [id];

    if (tenantId) {
        queryText += " AND split_part(a.created_by, '_', 1) = $2";
        params.push(tenantId);
    }

    const result = await query(queryText, params);
    return result.rows[0];
};

export const findAssessmentByShareToken = async (shareToken) => {
    const result = await query(
        `SELECT * FROM assessments 
         WHERE share_token = $1 
         AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (available_until IS NULL OR available_until > NOW())`,
        [shareToken]
    );
    return result.rows[0];
};

export const updateAssessment = async (id, tenantId, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
        fields.push(`title = $${paramCount++}`);
        values.push(updates.title);
    }

    if (updates.description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(updates.description);
    }

    if (updates.instructions !== undefined) {
        fields.push(`instructions = $${paramCount++}`);
        values.push(updates.instructions);
    }

    if (updates.duration_minutes !== undefined) {
        fields.push(`duration_minutes = $${paramCount++}`);
        values.push(updates.duration_minutes);
    }

    if (updates.security_config !== undefined) {
        fields.push(`security_config = $${paramCount++}`);
        values.push(JSON.stringify(updates.security_config));
    }

    if (updates.is_active !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(updates.is_active);
    }

    if (updates.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(updates.status);
    }

    if (updates.expires_at !== undefined) {
        fields.push(`expires_at = $${paramCount++}`);
        values.push(updates.expires_at);
    }

    if (updates.available_from !== undefined) {
        fields.push(`available_from = $${paramCount++}`);
        values.push(updates.available_from);
    }

    if (updates.available_until !== undefined) {
        fields.push(`available_until = $${paramCount++}`);
        values.push(updates.available_until);
    }

    if (fields.length === 0) {
        return findAssessmentById(id, tenantId);
    }

    let queryText = `UPDATE assessments SET ${fields.join(', ')} WHERE id = $${paramCount}`;
    values.push(id);

    if (tenantId) {
        queryText += ` AND split_part(created_by, '_', 1) = $${paramCount + 1}`;
        values.push(tenantId);
    }

    const result = await query(
        `${queryText} RETURNING *`,
        values
    );

    // Refresh data to include calculated counts
    return findAssessmentById(id, tenantId);
};

export const deleteAssessment = async (id, tenantId = null) => {
    let queryText = 'DELETE FROM assessments WHERE id = $1';
    const params = [id];

    if (tenantId) {
        queryText += " AND split_part(created_by, '_', 1) = $2";
        params.push(tenantId);
    }

    const result = await query(
        `${queryText} RETURNING id`,
        params
    );
    return result.rows[0];
};

export const deleteAssessments = async (ids, tenantId = null) => {
    if (!ids || ids.length === 0) return 0;
    
    let queryText = 'DELETE FROM assessments WHERE id = ANY($1)';
    const params = [ids];

    if (tenantId) {
        queryText += " AND split_part(created_by, '_', 1) = $2";
        params.push(tenantId);
    }

    const result = await query(
        `${queryText} RETURNING id`,
        params
    );
    return result.rowCount;
};

export const assignQuestionsToAssessment = async (assessmentId, questionIds) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Delete existing questions
        await client.query(
            'DELETE FROM assessment_questions WHERE assessment_id = $1',
            [assessmentId]
        );

        // Insert new questions
        if (questionIds.length > 0) {
            const values = [];
            const placeholders = [];

            questionIds.forEach((questionId, index) => {
                const offset = index * 3;
                placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
                values.push(assessmentId, questionId, index);
            });

            await client.query(
                `INSERT INTO assessment_questions (assessment_id, question_id, question_order)
         VALUES ${placeholders.join(', ')}`,
                values
            );
        }

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const getAssessmentQuestions = async (assessmentId) => {
    const result = await query(
        `SELECT q.*, aq.question_order, d.name as domain_name
         FROM questions q
         LEFT JOIN domains d ON q.domain_id = d.id
         JOIN assessment_questions aq ON q.id = aq.question_id
         WHERE aq.assessment_id = $1
         ORDER BY aq.question_order`,
        [assessmentId]
    );
    return result.rows;
};
