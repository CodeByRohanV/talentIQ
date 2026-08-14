import * as Result from '../models/Result.js';
import * as Assessment from '../models/Assessment.js';
import * as Response from '../models/Response.js';
import { query } from '../config/database.js';
import { processAllExpiredTests } from './testController.js';

export const getResults = async (req, res, next) => {
    try {
        await processAllExpiredTests();
        const { userId, tenantId, roles, managerId } = req.auth;

        // 1. Get assessments visible to this user
        const assessments = await Assessment.findAssessmentsRoleAware(userId, tenantId, roles, managerId);
        const assessmentIds = assessments.map(a => a.id);

        if (assessmentIds.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        // 2. Get results for these assessments
        const results = await Result.findResultsByAssessmentIds(assessmentIds);

        res.json({
            success: true,
            data: results.map(r => ({
                id: r.id,
                candidateId: r.candidate_id,
                candidateName: r.candidate_name,
                candidateEmail: r.candidate_email,
                assessmentTitle: r.assessment_title,
                overallScore: r.overall_score,
                domainScores: r.domain_scores,
                passed: r.passed,
                submissionMode: r.submission_mode,
                totalQuestions: r.total_questions,
                attemptedQuestions: r.attempted_questions,
                correctAnswers: r.correct_answers,
                incorrectAnswers: r.incorrect_answers,
                unansweredQuestions: r.unanswered_questions,
                tabSwitchCount: r.tab_switch_count || 0,
                startedAt: r.started_at,
                completedAt: r.completed_at,
                calculatedAt: r.calculated_at,
                photoIdUrl: r.photo_id_url,
                ipAddress: r.ip_address
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const getResultByCandidate = async (req, res, next) => {
    try {
        const { candidateId } = req.params;
        const result = await Result.findResultByCandidateId(candidateId);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Result not found'
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const getResultsByAssessment = async (req, res, next) => {
    try {
        await processAllExpiredTests();
        const { assessmentId } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        // Verify access
        const assessment = await Assessment.findAssessmentById(assessmentId, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        const results = await Result.findResultsByAssessmentIds([assessmentId]);

        res.json({
            success: true,
            data: results.map(r => ({
                id: r.id,
                candidateId: r.candidate_id,
                candidateName: r.candidate_name,
                candidateEmail: r.candidate_email,
                assessmentTitle: r.assessment_title,
                overallScore: r.overall_score,
                domainScores: r.domain_scores,
                passed: r.passed,
                submissionMode: r.submission_mode,
                totalQuestions: r.total_questions,
                attemptedQuestions: r.attempted_questions,
                correctAnswers: r.correct_answers,
                incorrectAnswers: r.incorrect_answers,
                unansweredQuestions: r.unanswered_questions,
                tabSwitchCount: r.tab_switch_count || 0,
                startedAt: r.started_at,
                completedAt: r.completed_at,
                calculatedAt: r.calculated_at,
                photoIdUrl: r.photo_id_url,
                ipAddress: r.ip_address
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const getDetailedResult = async (req, res, next) => {
    try {
        const { candidateId } = req.params;
        const responses = await Result.findDetailedResponsesByCandidateId(candidateId);
        // #region agent log
        fetch('http://127.0.0.1:7732/ingest/16e67531-3ed4-47fa-ab85-13d213e24c55',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c8d619'},body:JSON.stringify({sessionId:'c8d619',runId:'pre-fix',hypothesisId:'H5',location:'resultController.js:getDetailedResult',message:'Detailed responses fetched',data:{candidateId,totalRows:responses.length,unansweredRows:responses.filter(r=>r.selected_answer===null||r.selected_answer===undefined).length,answeredRows:responses.filter(r=>r.selected_answer!==null&&r.selected_answer!==undefined).length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        res.json({
            success: true,
            data: responses.map(r => ({
                responseId: r.response_id,
                questionType: r.question_type || 'MULTIPLE_CHOICE',
                questionText: r.question_text,
                options: r.options,
                correctAnswer: r.correct_answer,
                selectedAnswer: r.selected_answer,
                textAnswer: r.text_answer,
                manualScore: r.manual_score,
                graderFeedback: r.grader_feedback,
                domain: r.domain,
                difficulty: r.difficulty,
                answeredAt: r.answered_at,
                isAnswered: r.is_answered
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const getDetailedResultsByAssessment = async (req, res, next) => {
    try {
        const { assessmentId } = req.params;
        const responses = await Result.findAllDetailedResponsesByAssessmentId(assessmentId);

        // Group responses by candidateId
        const grouped = {};
        responses.forEach(r => {
            if (!grouped[r.candidate_id]) {
                grouped[r.candidate_id] = [];
            }
            grouped[r.candidate_id].push({
                responseId: r.response_id,
                questionType: r.question_type || 'MULTIPLE_CHOICE',
                questionText: r.question_text,
                options: r.options,
                correctAnswer: r.correct_answer,
                selectedAnswer: r.selected_answer,
                textAnswer: r.text_answer,
                manualScore: r.manual_score,
                graderFeedback: r.grader_feedback,
                domain: r.domain,
                difficulty: r.difficulty,
                answeredAt: r.answered_at,
                isAnswered: r.is_answered
            });
        });

        res.json({
            success: true,
            data: grouped
        });
    } catch (error) {
        next(error);
    }
};

export const gradeResponse = async (req, res, next) => {
    try {
        const { responseId } = req.params;
        const { manualScore, graderFeedback } = req.body;

        // Validation against max_score
        if (manualScore !== undefined) {
            const questionQuery = await query(`
                SELECT q.max_score 
                FROM responses r 
                JOIN questions q ON r.question_id = q.id 
                WHERE r.id = $1
            `, [responseId]);

            if (questionQuery.rows.length > 0) {
                const maxScore = questionQuery.rows[0].max_score || 1;
                if (manualScore < 0 || manualScore > maxScore) {
                    return res.status(400).json({ success: false, message: `Score must be between 0 and ${maxScore}` });
                }
            }
        }

        const updatedResponse = await Response.updateGrade(responseId, manualScore, graderFeedback);

        if (!updatedResponse) {
            return res.status(404).json({ success: false, message: 'Response not found' });
        }

        const candidateId = updatedResponse.candidate_id;

        // Fetch candidate result stats
        const result = await Result.findResultByCandidateId(candidateId);
        if (result) {
            const manualScoreQuery = await query(`SELECT SUM(manual_score) as sum_manual FROM responses WHERE candidate_id = $1`, [candidateId]);
            const manualScoreSum = parseFloat(manualScoreQuery.rows[0].sum_manual || 0);
            
            // Calculate total max score for the assessment dynamically
            const assessmentId = result.assessment_id;
            const maxScoreQuery = await query(`
                SELECT SUM(COALESCE(q.max_score, 1)) as total_max_score
                FROM assessment_questions aq
                JOIN questions q ON aq.question_id = q.id
                WHERE aq.assessment_id = $1
            `, [assessmentId]);
            const totalMaxScore = parseFloat(maxScoreQuery.rows[0].total_max_score || result.total_questions || 1);
            
            const correctAnswers = result.correct_answers || 0;
            const overallScore = Math.min(100, Math.round(((correctAnswers + manualScoreSum) / totalMaxScore) * 100));

            await query(`UPDATE results SET overall_score = $1 WHERE candidate_id = $2`, [overallScore, candidateId]);
        }

        res.json({ success: true, data: updatedResponse });
    } catch (error) {
        next(error);
    }
};
