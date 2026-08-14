import { query } from '../config/database.js';

export const createResult = async (candidateId, overallScore, domainScores, passed, stats = {}, submissionMode = 'manual') => {
    const {
        totalQuestions = 0,
        attemptedQuestions = 0,
        correctAnswers = 0,
        incorrectAnswers = 0,
        unansweredQuestions = 0
    } = stats;

    const result = await query(
        `INSERT INTO results (
            candidate_id, overall_score, domain_scores, passed, 
            total_questions, attempted_questions, correct_answers, 
            incorrect_answers, unanswered_questions, submission_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
            candidateId,
            overallScore,
            JSON.stringify(domainScores),
            passed,
            totalQuestions,
            attemptedQuestions,
            correctAnswers,
            incorrectAnswers,
            unansweredQuestions,
            submissionMode
        ]
    );
    return result.rows[0];
};

export const findResultByCandidateId = async (candidateId) => {
    const result = await query(
        `SELECT r.*, 
         (SELECT COUNT(*)::int FROM test_violations tv WHERE tv.candidate_id = r.candidate_id AND tv.violation_type = 'tab_switch') as tab_switch_count
         FROM results r WHERE r.candidate_id = $1`,
        [candidateId]
    );
    return result.rows[0];
};

/**
 * Fetch results and check tenant access via assessment
 */
export const findResultsByAssessmentIds = async (assessmentIds) => {
    if (assessmentIds.length === 0) return [];

    const result = await query(
        `SELECT r.*, c.name as candidate_name, c.email as candidate_email, c.started_at, c.completed_at, a.title as assessment_title,
         (SELECT COUNT(*)::int FROM test_violations tv WHERE tv.candidate_id = r.candidate_id AND tv.violation_type = 'tab_switch') as tab_switch_count,
         ta.photo_id_url,
         ta.ip_address
         FROM results r
         JOIN candidates c ON r.candidate_id = c.id
         JOIN assessments a ON c.assessment_id = a.id
         LEFT JOIN test_attempts ta ON ta.candidate_id = c.id
         WHERE c.assessment_id = ANY($1)
         ORDER BY r.calculated_at DESC`,
        [assessmentIds]
    );
    return result.rows;
};

/**
 * Fetch detailed question-by-question responses for a candidate.
 *
 * Uses LEFT JOIN on questions so that soft-deleted questions still appear
 * in the report. COALESCE provides "[Deleted Question]" fallbacks for any
 * question that has been removed from the bank after the assessment ran.
 */
export const findDetailedResponsesByCandidateId = async (candidateId) => {
    const result = await query(
        `SELECT
            q.question_type,
            q.max_score,
            r.id AS response_id,
            r.text_answer,
            r.manual_score,
            r.grader_feedback,
            COALESCE(q.question_text, '[Deleted Question]') AS question_text,
            COALESCE(q.options, '[]'::jsonb)               AS options,
            q.correct_answer,
            COALESCE(d.name, q.domain::text, 'unknown')    AS domain,
            COALESCE(q.difficulty, 'unknown')              AS difficulty,
            r.selected_answer,
            r.answered_at,
            CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS is_answered
         FROM candidates c
         JOIN assessment_questions aq ON c.assessment_id = aq.assessment_id
         LEFT JOIN questions q ON aq.question_id = q.id
         LEFT JOIN domains d ON q.domain_id = d.id
         LEFT JOIN responses r ON r.question_id = aq.question_id AND r.candidate_id = c.id
         WHERE c.id = $1
         ORDER BY aq.question_order ASC NULLS LAST`,
        [candidateId]
    );
    return result.rows;
};

export const findAllDetailedResponsesByAssessmentId = async (assessmentId) => {
    const result = await query(
        `SELECT
            c.id AS candidate_id,
            q.question_type,
            q.max_score,
            r.id AS response_id,
            r.text_answer,
            r.manual_score,
            r.grader_feedback,
            COALESCE(q.question_text, '[Deleted Question]') AS question_text,
            COALESCE(q.options, '[]'::jsonb)               AS options,
            q.correct_answer,
            COALESCE(d.name, q.domain::text, 'unknown')    AS domain,
            COALESCE(q.difficulty, 'unknown')              AS difficulty,
            r.selected_answer,
            r.answered_at,
            CASE WHEN r.id IS NOT NULL THEN true ELSE false END AS is_answered
         FROM candidates c
         JOIN assessment_questions aq ON c.assessment_id = aq.assessment_id
         LEFT JOIN questions q ON aq.question_id = q.id
         LEFT JOIN domains d ON q.domain_id = d.id
         LEFT JOIN responses r ON r.question_id = aq.question_id AND r.candidate_id = c.id
         WHERE c.assessment_id = $1 AND c.status = 'completed'
         ORDER BY c.id ASC, aq.question_order ASC NULLS LAST`,
        [assessmentId]
    );
    return result.rows;
};
