import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';

export const createCandidate = async (assessmentId, name, email) => {
    // Generate a secure random token for the candidate
    const accessToken = crypto.randomBytes(32).toString('hex');
    const saltRounds = 10;
    const accessTokenHash = await bcrypt.hash(accessToken, saltRounds);

    const result = await query(
        `INSERT INTO candidates (assessment_id, name, email, share_token, access_token_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [assessmentId, name, email, accessToken, accessTokenHash]
    );

    // We return the original token once so it can be sent to the candidate
    // But we only store the hash for future validation if needed
    return result.rows[0];
};

export const findCandidatesByAssessmentIds = async (assessmentIds) => {
    const result = await query(
        `SELECT c.*, a.title as assessment_title
     FROM candidates c
     JOIN assessments a ON c.assessment_id = a.id
     WHERE c.assessment_id = ANY($1)
     ORDER BY c.created_at DESC`,
        [assessmentIds]
    );
    return result.rows;
};

export const findCandidateById = async (id) => {
    const result = await query(
        'SELECT * FROM candidates WHERE id = $1',
        [id]
    );
    return result.rows[0];
};

export const findCandidateByShareToken = async (shareToken) => {
    const result = await query(
        'SELECT * FROM candidates WHERE share_token = $1',
        [shareToken]
    );
    return result.rows[0];
};

export const findCandidateByAssessmentAndEmail = async (assessmentId, email) => {
    const result = await query(
        'SELECT * FROM candidates WHERE assessment_id = $1 AND LOWER(email) = LOWER($2)',
        [assessmentId, email]
    );
    return result.rows[0];
};

export const updateCandidateStatus = async (id, status, startedAt = null, completedAt = null) => {
    const fields = ['status = $2'];
    const values = [id, status];
    let paramCount = 3;

    if (startedAt) {
        fields.push(`started_at = $${paramCount++}`);
        values.push(startedAt);
    }

    if (completedAt) {
        fields.push(`completed_at = $${paramCount++}`);
        values.push(completedAt);
    }

    const result = await query(
        `UPDATE candidates SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        values
    );

    return result.rows[0];
};
export const deleteCandidate = async (id) => {
    const result = await query(
        'DELETE FROM candidates WHERE id = $1 RETURNING *',
        [id]
    );
    return result.rows[0];
};
