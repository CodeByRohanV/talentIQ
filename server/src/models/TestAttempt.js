/**
 * TestAttempt.js
 * --------------
 * Data access layer for the test_attempts table.
 *
 * KEY DESIGN DECISIONS:
 *   1. findOrCreateAttempt uses a DB-level advisory lock + INSERT ... ON CONFLICT
 *      to guarantee idempotency under concurrent requests (e.g. candidate
 *      double-clicks "Start Test" or two tabs open simultaneously).
 *   2. Randomized orders are written ONCE and never updated — they are
 *      immutable after creation.
 *   3. The model never exposes correct_answer data — that stays in the
 *      questions table and is only fetched server-side during evaluation.
 */

import { query, getClient } from '../config/database.js';

/**
 * Find an existing attempt for a candidate+assessment pair.
 *
 * @param {string} candidateId
 * @param {string} assessmentId
 * @returns {Object|null}
 */
export const findAttemptByCandidateAndAssessment = async (candidateId, assessmentId) => {
    const result = await query(
        `SELECT * FROM test_attempts
         WHERE candidate_id = $1 AND assessment_id = $2
         LIMIT 1`,
        [candidateId, assessmentId]
    );
    return result.rows[0] || null;
};

/**
 * Find an attempt by its primary key.
 *
 * @param {string} attemptId
 * @returns {Object|null}
 */
export const findAttemptById = async (attemptId) => {
    const result = await query(
        `SELECT * FROM test_attempts WHERE id = $1`,
        [attemptId]
    );
    return result.rows[0] || null;
};

/**
 * Create a new attempt with pre-computed randomized orders.
 * Uses INSERT ... ON CONFLICT DO NOTHING to handle race conditions.
 * If a concurrent request already inserted the row, we fetch and return it.
 *
 * This is the ONLY place where randomized_question_order and
 * randomized_option_order are written. They are never mutated after this.
 *
 * @param {string} candidateId
 * @param {string} assessmentId
 * @param {string[]} questionOrder - Shuffled array of question UUIDs.
 * @param {Object} optionOrderMap - Map of questionId -> shuffled option indices.
 * @param {number} durationMinutes - Assessment duration for computing expires_at.
 * @param {string} ipAddress - IP address of the candidate.
 * @returns {Object} The created or existing attempt row.
 */
export const createAttempt = async (candidateId, assessmentId, questionOrder, optionOrderMap, durationMinutes, ipAddress = null) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Advisory lock: prevents two concurrent transactions from both
        // deciding "no attempt exists" and both trying to insert.
        // hashtext() maps the composite key to a 32-bit integer for the lock.
        await client.query(
            `SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`,
            [candidateId, assessmentId]
        );

        // Check again inside the lock (double-checked locking pattern)
        const existing = await client.query(
            `SELECT * FROM test_attempts WHERE candidate_id = $1 AND assessment_id = $2`,
            [candidateId, assessmentId]
        );

        if (existing.rows.length > 0) {
            await client.query('COMMIT');
            return existing.rows[0];
        }

        // Compute expiry: started_at + duration. We set started_at on the
        // /start endpoint, so expires_at is set there too. Here we just create
        // the record in 'pending' state.
        const result = await client.query(
            `INSERT INTO test_attempts
                (candidate_id, assessment_id, randomized_question_order, randomized_option_order, attempt_status, ip_address)
             VALUES ($1, $2, $3, $4, 'pending', $5)
             RETURNING *`,
            [
                candidateId,
                assessmentId,
                JSON.stringify(questionOrder),
                JSON.stringify(optionOrderMap),
                ipAddress
            ]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Transition attempt to 'in_progress' and set timing fields.
 * Idempotent: if already in_progress, returns the existing row unchanged.
 *
 * @param {string} attemptId
 * @param {number} durationMinutes
 * @returns {Object} Updated attempt row.
 */
export const startAttempt = async (attemptId, durationMinutes, availableUntil = null) => {
    const result = await query(
        `UPDATE test_attempts
         SET attempt_status = 'in_progress',
             started_at     = COALESCE(started_at, NOW()),
             expires_at     = COALESCE(expires_at, LEAST(
                 NOW() + ($2 || ' minutes')::INTERVAL,
                 $3::TIMESTAMP WITH TIME ZONE
             )),
             updated_at     = NOW()
         WHERE id = $1
           AND attempt_status IN ('pending', 'in_progress')
         RETURNING *`,
        [attemptId, durationMinutes, availableUntil || 'infinity']
    );
    return result.rows[0] || null;
};

/**
 * Save the photo ID URL for an attempt.
 *
 * @param {string} attemptId
 * @param {string} photoIdUrl
 * @returns {Object} Updated attempt row.
 */
export const setPhotoId = async (attemptId, photoIdUrl) => {
    const result = await query(
        `UPDATE test_attempts
         SET photo_id_url = $2,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [attemptId, photoIdUrl]
    );
    return result.rows[0] || null;
};

/**
 * Mark an attempt as completed.
 * Only transitions from 'in_progress' to prevent double-submission.
 *
 * @param {string} attemptId
 * @returns {Object|null}
 */
export const completeAttempt = async (attemptId) => {
    const result = await query(
        `UPDATE test_attempts
         SET attempt_status = 'completed',
             completed_at   = NOW(),
             updated_at     = NOW()
         WHERE id = $1
           AND attempt_status = 'in_progress'
         RETURNING *`,
        [attemptId]
    );
    return result.rows[0] || null;
};

/**
 * Check if an attempt has expired based on expires_at.
 * If expired, atomically update status and return the updated row.
 *
 * @param {string} attemptId
 * @returns {boolean} True if the attempt is (or just became) expired.
 */
export const checkAndExpireAttempt = async (attemptId) => {
    const result = await query(
        `UPDATE test_attempts
         SET attempt_status = 'expired', updated_at = NOW()
         WHERE id = $1
           AND attempt_status = 'in_progress'
           AND expires_at IS NOT NULL
           AND expires_at < NOW()
         RETURNING id`,
        [attemptId]
    );
    return result.rows.length > 0;
};

/**
 * Delete an attempt by ID.
 * Used to clear stale attempts when the question set changes.
 *
 * @param {string} attemptId
 * @returns {boolean} True if a row was deleted.
 */
export const deleteAttempt = async (attemptId) => {
    const result = await query(
        `DELETE FROM test_attempts WHERE id = $1 RETURNING id`,
        [attemptId]
    );
    return result.rows.length > 0;
};

/**
 * Find all attempts that are in_progress but past their expiry time.
 *
 * @returns {Array} List of expired attempts.
 */
export const findExpiredAttempts = async () => {
    const result = await query(
        `SELECT * FROM test_attempts
         WHERE attempt_status = 'in_progress'
           AND expires_at IS NOT NULL
           AND expires_at < NOW()`
    );
    return result.rows;
};

/**
 * Atomically mark attempt as completed, regardless of current status
 * (as long as it wasn't already completed). This is used for auto-submission.
 *
 * @param {string} attemptId
 * @param {string} submissionMode - 'manual' or 'auto'
 * @returns {Object|null}
 */
export const forceCompleteAttempt = async (attemptId, submissionMode = 'manual') => {
    const result = await query(
        `UPDATE test_attempts
         SET attempt_status = 'completed',
             submission_mode = $2,
             completed_at   = COALESCE(completed_at, NOW()),
             updated_at     = NOW()
         WHERE id = $1
           AND attempt_status != 'completed'
         RETURNING *`,
        [attemptId, submissionMode]
    );
    return result.rows[0] || null;
};
