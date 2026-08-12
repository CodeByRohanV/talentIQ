import * as Result from '../models/Result.js';
import * as Assessment from '../models/Assessment.js';
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
                questionText: r.question_text,
                options: r.options,
                correctAnswer: r.correct_answer,
                selectedAnswer: r.selected_answer,
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
                questionText: r.question_text,
                options: r.options,
                correctAnswer: r.correct_answer,
                selectedAnswer: r.selected_answer,
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
