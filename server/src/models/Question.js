import { query } from '../config/database.js';

/**
 * Shared query function for all tenant questions.
 * Only returns questions that have NOT been soft-deleted.
 */
export const findQuestionsByTenantId = async (tenantId, filters = {}) => {
    let queryText = `
        SELECT q.*, COALESCE(d.name, INITCAP(REPLACE(q.domain::TEXT, '_', ' '))) as domain_name 
        FROM questions q
        LEFT JOIN domains d ON q.domain_id = d.id
        WHERE (split_part(q.created_by, '_', 1) = $1 OR q.created_by IS NULL)
        AND q.is_deleted = false
    `;
    const params = [tenantId];

    // Scoping for Manager/Recruiter
    if (filters.managerId && filters.role) {
        if (filters.role === 'MANAGER' || filters.role === 'RECRUITER') {
            let scopingQuery = `(q.created_by_manager_id = $${params.length + 1}`;
            params.push(filters.managerId);

            if (filters.userDomainId) {
                scopingQuery += ` OR q.domain_id = $${params.length + 1}`;
                params.push(filters.userDomainId);
            }

            scopingQuery += ` OR q.created_by IS NULL)`;
            queryText += ` AND ${scopingQuery}`;
        }
    }

    let paramCount = params.length + 1;

    if (filters.domain) {
        queryText += ` AND (q.domain::text = $${paramCount} OR q.domain_id IN (SELECT id FROM domains WHERE slug = $${paramCount}))`;
        params.push(filters.domain);
        paramCount++;
    }

    if (filters.domainId) {
        queryText += ` AND (q.domain_id = $${paramCount} OR (q.domain_id IS NULL AND q.domain::text = (SELECT slug FROM domains WHERE id = $${paramCount} LIMIT 1)))`;
        params.push(filters.domainId);
        paramCount++;
    }

    if (filters.difficulty) {
        queryText += ` AND LOWER(TRIM(q.difficulty)) = LOWER(TRIM($${paramCount}))`;
        params.push(filters.difficulty);
        paramCount++;
    }

    if (filters.search) {
        queryText += ` AND q.question_text ILIKE $${paramCount}`;
        params.push(`%${filters.search}%`);
        paramCount++;
    }

    queryText += ' ORDER BY q.created_at DESC';

    if (filters.limit) {
        queryText += ` LIMIT $${paramCount++}`;
        params.push(filters.limit);
    }
    if (filters.offset) {
        queryText += ` OFFSET $${paramCount++}`;
        params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
};

export const createQuestion = async (userId, tenantId, domain, questionText, options, correctAnswer, difficulty = 'medium', domainId = null, managerId = null) => {
    const result = await query(
        `INSERT INTO questions (created_by, domain, question_text, options, correct_answer, difficulty, domain_id, created_by_manager_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, domain, questionText, JSON.stringify(options), correctAnswer, difficulty, domainId, managerId || userId]
    );
    return result.rows[0];
};

/**
 * Backward compatible search for specific recruiters if needed.
 * Only returns non-deleted questions.
 */
export const findQuestionsByRecruiterId = async (recruiterId, filters = {}) => {
    let queryText = `
        SELECT q.*, COALESCE(d.name, INITCAP(REPLACE(q.domain::TEXT, '_', ' '))) as domain_name 
        FROM questions q
        LEFT JOIN domains d ON q.domain_id = d.id
        WHERE q.created_by = $1
        AND q.is_deleted = false
    `;
    const params = [recruiterId];
    let paramCount = 2;

    if (filters.domain) {
        queryText += ` AND (q.domain = $${paramCount} OR q.domain_id IN (SELECT id FROM domains WHERE slug = $${paramCount}))`;
        params.push(filters.domain);
        paramCount++;
    }

    if (filters.difficulty) {
        queryText += ` AND q.difficulty = $${paramCount}`;
        params.push(filters.difficulty);
        paramCount++;
    }

    if (filters.search) {
        queryText += ` AND q.question_text ILIKE $${paramCount}`;
        params.push(`%${filters.search}%`);
        paramCount++;
    }

    queryText += ' ORDER BY q.created_at DESC';

    if (filters.limit) {
        queryText += ` LIMIT $${paramCount++}`;
        params.push(filters.limit);
    }
    if (filters.offset) {
        queryText += ` OFFSET $${paramCount++}`;
        params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
};

export const findAllQuestions = async (filters = {}) => {
    let queryText = `
        SELECT q.*, COALESCE(d.name, INITCAP(REPLACE(q.domain::TEXT, '_', ' '))) as domain_name 
        FROM questions q
        LEFT JOIN domains d ON q.domain_id = d.id
        WHERE q.is_deleted = false
    `;
    const params = [];
    let paramCount = 1;

    if (filters.domain) {
        queryText += ` AND (q.domain::text = $${paramCount} OR q.domain_id IN (SELECT id FROM domains WHERE slug = $${paramCount}))`;
        params.push(filters.domain);
        paramCount++;
    }

    if (filters.domainId) {
        queryText += ` AND (q.domain_id = $${paramCount} OR (q.domain_id IS NULL AND q.domain::text = (SELECT slug FROM domains WHERE id = $${paramCount} LIMIT 1)))`;
        params.push(filters.domainId);
        paramCount++;
    }

    if (filters.difficulty) {
        queryText += ` AND LOWER(TRIM(q.difficulty)) = LOWER(TRIM($${paramCount}))`;
        params.push(filters.difficulty);
        paramCount++;
    }

    if (filters.search) {
        queryText += ` AND q.question_text ILIKE $${paramCount}`;
        params.push(`%${filters.search}%`);
        paramCount++;
    }

    queryText += ' ORDER BY q.created_at DESC';

    if (filters.limit) {
        queryText += ` LIMIT $${paramCount++}`;
        params.push(filters.limit);
    }
    if (filters.offset) {
        queryText += ` OFFSET $${paramCount++}`;
        params.push(filters.offset);
    }

    const result = await query(queryText, params);
    return result.rows;
};

export const countQuestions = async (tenantId = null, filters = {}) => {
    let queryText = 'SELECT COUNT(*) FROM questions q WHERE q.is_deleted = false';
    const params = [];
    let paramCount = 1;

    if (filters.managerId && filters.role) {
        if (filters.role === 'MANAGER' || filters.role === 'RECRUITER') {
            let scopingQuery = `(q.created_by_manager_id = $${paramCount++}`;
            params.push(filters.managerId);

            if (filters.userDomainId) {
                scopingQuery += ` OR q.domain_id = $${paramCount++}`;
                params.push(filters.userDomainId);
            }

            scopingQuery += ` OR q.created_by IS NULL)`;
            queryText += ` AND ${scopingQuery}`;
        }
    }

    if (tenantId) {
        queryText += ` AND (split_part(q.created_by, '_', 1) = $${paramCount++} OR q.created_by IS NULL)`;
        params.push(tenantId);
    }

    if (filters.domain) {
        queryText += ` AND (q.domain::text = $${paramCount} OR q.domain_id IN (SELECT id FROM domains WHERE slug = $${paramCount}))`;
        params.push(filters.domain);
        paramCount++;
    }

    if (filters.domainId) {
        queryText += ` AND (q.domain_id = $${paramCount} OR (q.domain_id IS NULL AND q.domain::text = (SELECT slug FROM domains WHERE id = $${paramCount} LIMIT 1)))`;
        params.push(filters.domainId);
        paramCount++;
    }

    if (filters.difficulty) {
        queryText += ` AND LOWER(TRIM(q.difficulty)) = LOWER(TRIM($${paramCount}))`;
        params.push(filters.difficulty);
        paramCount++;
    }

    if (filters.search) {
        queryText += ` AND q.question_text ILIKE $${paramCount++}`;
        params.push(`%${filters.search}%`);
    }

    const result = await query(queryText, params);
    return parseInt(result.rows[0].count);
};

export const findQuestionById = async (id, tenantId = null) => {
    // NOTE: findQuestionById intentionally does NOT filter by is_deleted.
    // This allows the assessment engine and result calculator to still access
    // the full question data (text, options, correct_answer) for scoring
    // even after the question has been soft-deleted from the question bank.
    let queryText = `SELECT q.*, d.name as domain_name 
         FROM questions q
         LEFT JOIN domains d ON q.domain_id = d.id
         WHERE q.id = $1`;
    const params = [id];

    if (tenantId) {
        queryText += " AND split_part(q.created_by, '_', 1) = $2";
        params.push(tenantId);
    }

    const result = await query(queryText, params);
    return result.rows[0];
};

export const updateQuestion = async (id, tenantId, updates) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.domain_id !== undefined) {
        fields.push(`domain_id = $${paramCount++}`);
        values.push(updates.domain_id);
    }
    if (updates.domain !== undefined) {
        fields.push(`domain = $${paramCount++}`);
        values.push(updates.domain);
    }
    if (updates.question_text !== undefined) {
        fields.push(`question_text = $${paramCount++}`);
        values.push(updates.question_text);
    }
    if (updates.options !== undefined) {
        fields.push(`options = $${paramCount++}`);
        values.push(JSON.stringify(updates.options));
    }
    if (updates.correct_answer !== undefined) {
        fields.push(`correct_answer = $${paramCount++}`);
        values.push(updates.correct_answer);
    }
    if (updates.difficulty !== undefined) {
        fields.push(`difficulty = $${paramCount++}`);
        values.push(updates.difficulty);
    }

    if (fields.length === 0) return null;

    // Fix: Allow update IF tenant_id matches OR if it's a shared question (NULL)
    // Only allow updating non-deleted questions.
    let queryText = `UPDATE questions SET ${fields.join(', ')} WHERE id = $${paramCount++} AND is_deleted = false`;
    values.push(id);

    if (tenantId) {
        queryText += ` AND (split_part(created_by, '_', 1) = $${paramCount} OR created_by IS NULL)`;
        values.push(tenantId);
    }

    const result = await query(
        `${queryText} RETURNING *`,
        values
    );

    return result.rows[0];
};

/**
 * Soft-deletes a single question by setting is_deleted = true.
 * The question row is preserved in the DB so historical assessment reports
 * (responses, scores, question text) remain intact.
 */
export const deleteQuestion = async (id, tenantId = null) => {
    let queryText = `UPDATE questions SET is_deleted = true, deleted_at = NOW() WHERE id = $1 AND is_deleted = false`;
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

/**
 * Soft-deletes multiple questions by ID.
 */
export const deleteQuestions = async (ids, tenantId = null) => {
    let queryText = `UPDATE questions SET is_deleted = true, deleted_at = NOW() WHERE id = ANY($1) AND is_deleted = false`;
    const params = [ids];

    if (tenantId) {
        queryText += " AND split_part(created_by, '_', 1) = $2";
        params.push(tenantId);
    }

    const result = await query(
        `${queryText} RETURNING id`,
        params
    );
    return result.rows;
};

/**
 * Soft-deletes questions matching the given filter criteria.
 */
export const deleteQuestionsByFilter = async (tenantId, filters = {}, isSuperAdmin = false) => {
    let queryText = 'UPDATE questions SET is_deleted = true, deleted_at = NOW() WHERE is_deleted = false';
    const params = [];
    let paramCount = 1;

    if (!isSuperAdmin) {
        queryText += ` AND (split_part(created_by, '_', 1) = $${paramCount} OR created_by IS NULL)`;
        params.push(tenantId);
        paramCount++;
    }

    if (filters.domainId) {
        queryText += ` AND (domain_id = $${paramCount} OR (domain_id IS NULL AND domain::text = (SELECT slug FROM domains WHERE id = $${paramCount} LIMIT 1)))`;
        params.push(filters.domainId);
        paramCount++;
    }

    if (filters.search) {
        queryText += ` AND question_text ILIKE $${paramCount}`;
        params.push(`%${filters.search}%`);
        paramCount++;
    }

    queryText += ' RETURNING id';
    const result = await query(queryText, params);
    return result.rows;
};

export const checkQuestionsInAssessmentsByFilter = async (tenantId, filters = {}, isSuperAdmin = false) => {
    let queryText = `
        SELECT DISTINCT aq.question_id 
        FROM assessment_questions aq
        JOIN questions q ON aq.question_id = q.id
        WHERE q.is_deleted = false
    `;
    const params = [];
    let paramCount = 1;

    if (!isSuperAdmin) {
        queryText += ` AND (split_part(q.created_by, '_', 1) = $${paramCount} OR q.created_by IS NULL)`;
        params.push(tenantId);
        paramCount++;
    }

    if (filters.domainId) {
        queryText += ` AND (q.domain_id = $${paramCount} OR (q.domain_id IS NULL AND q.domain::text = (SELECT slug FROM domains WHERE id = $${paramCount} LIMIT 1)))`;
        params.push(filters.domainId);
        paramCount++;
    }

    if (filters.search) {
        queryText += ` AND q.question_text ILIKE $${paramCount}`;
        params.push(`%${filters.search}%`);
        paramCount++;
    }

    const result = await query(queryText, params);
    return result.rows;
};

export const bulkCreateQuestions = async (questions, tenantId, managerId = null) => {
    const values = [];
    const placeholders = [];

    questions.forEach((q, index) => {
        const offset = index * 8;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
        values.push(
            q.userId,
            q.domain,
            q.question_text,
            JSON.stringify(q.options),
            q.correct_answer,
            q.difficulty || 'medium',
            q.domain_id || null,
            managerId || q.userId
        );
    });

    const result = await query(
        `INSERT INTO questions (created_by, domain, question_text, options, correct_answer, difficulty, domain_id, created_by_manager_id)
         VALUES ${placeholders.join(', ')}
         RETURNING *`,
        values
    );

    return result.rows;
};

export const checkQuestionsInAssessments = async (questionIds) => {
    // Only check non-deleted questions (deleted questions are hidden from the bank
    // and the user can't see them to check usage).
    const result = await query(
        'SELECT DISTINCT question_id FROM assessment_questions WHERE question_id = ANY($1)',
        [questionIds]
    );
    return result.rows;
};
