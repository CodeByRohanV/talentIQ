import { query } from '../config/database.js';

export const saveResponse = async (candidateId, questionId, selectedAnswer, isFlagged) => {
    const result = await query(
        `INSERT INTO responses (candidate_id, question_id, selected_answer, is_flagged)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (candidate_id, question_id) 
     DO UPDATE SET selected_answer = $3, is_flagged = $4, answered_at = NOW()
     RETURNING *`,
        [candidateId, questionId, selectedAnswer, isFlagged]
    );
    return result.rows[0];
};

// Note: PostgreSQL doesn't support ON CONFLICT with composite keys by default
// We'll use a workaround with a unique constraint or handle it in the application
export const upsertResponse = async (candidateId, questionId, selectedAnswer, isFlagged) => {
    // First try to update
    const updateResult = await query(
        `UPDATE responses 
     SET selected_answer = $3, is_flagged = $4, answered_at = NOW()
     WHERE candidate_id = $1 AND question_id = $2
     RETURNING *`,
        [candidateId, questionId, selectedAnswer, isFlagged]
    );

    if (updateResult.rows.length > 0) {
        return updateResult.rows[0];
    }

    // If no rows updated, insert
    const insertResult = await query(
        `INSERT INTO responses (candidate_id, question_id, selected_answer, is_flagged)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
        [candidateId, questionId, selectedAnswer, isFlagged]
    );

    return insertResult.rows[0];
};

export const findResponsesByCandidateId = async (candidateId) => {
    const result = await query(
        'SELECT * FROM responses WHERE candidate_id = $1',
        [candidateId]
    );
    return result.rows;
};
