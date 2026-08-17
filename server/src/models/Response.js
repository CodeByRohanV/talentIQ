import { query } from '../config/database.js';

export const saveResponse = async (candidateId, questionId, selectedAnswer, isFlagged, textAnswer = null) => {
    const result = await query(
        `INSERT INTO responses (candidate_id, question_id, selected_answer, is_flagged, text_answer)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (candidate_id, question_id) 
     DO UPDATE SET selected_answer = $3, is_flagged = $4, text_answer = $5, answered_at = NOW()
     RETURNING *`,
        [candidateId, questionId, selectedAnswer, isFlagged, textAnswer]
    );
    return result.rows[0];
};

// Note: PostgreSQL doesn't support ON CONFLICT with composite keys by default
// We'll use a workaround with a unique constraint or handle it in the application
export const upsertResponse = async (candidateId, questionId, selectedAnswer, isFlagged, textAnswer = null) => {
    // First try to update
    const updateResult = await query(
        `UPDATE responses 
     SET selected_answer = $3, is_flagged = $4, text_answer = $5, answered_at = NOW()
     WHERE candidate_id = $1 AND question_id = $2
     RETURNING *`,
        [candidateId, questionId, selectedAnswer, isFlagged, textAnswer]
    );

    if (updateResult.rows.length > 0) {
        return updateResult.rows[0];
    }

    // If no rows updated, insert
    const insertResult = await query(
        `INSERT INTO responses (candidate_id, question_id, selected_answer, is_flagged, text_answer)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [candidateId, questionId, selectedAnswer, isFlagged, textAnswer]
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

export const updateGrade = async (responseId, manualScore, graderFeedback) => {
    const result = await query(
        `UPDATE responses 
         SET manual_score = $2, grader_feedback = $3 
         WHERE id = $1 
         RETURNING *`,
        [responseId, manualScore, graderFeedback]
    );
    return result.rows[0];
};

export const upsertGrade = async (candidateId, questionId, manualScore, graderFeedback) => {
    // Try to find the existing response
    const existing = await query(
        'SELECT id FROM responses WHERE candidate_id = $1 AND question_id = $2',
        [candidateId, questionId]
    );

    if (existing.rows.length > 0) {
        return await updateGrade(existing.rows[0].id, manualScore, graderFeedback);
    } else {
        // Insert new row for unanswered question being graded
        const result = await query(
            `INSERT INTO responses (candidate_id, question_id, manual_score, grader_feedback, text_answer)
             VALUES ($1, $2, $3, $4, '')
             RETURNING *`,
            [candidateId, questionId, manualScore, graderFeedback]
        );
        return result.rows[0];
    }
};
