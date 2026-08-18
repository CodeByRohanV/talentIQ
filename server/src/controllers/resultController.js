import * as Result from '../models/Result.js';
import * as Assessment from '../models/Assessment.js';
import * as Response from '../models/Response.js';
import { query } from '../config/database.js';
import { processAllExpiredTests } from './testController.js';
import { streamZipBulkReport } from '../services/pdfService.js';

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
                candidateId: r.candidate_id,
                questionId: r.question_id,
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
                isAnswered: r.is_answered,
                max_score: r.max_score || 1
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
                candidateId: r.candidate_id,
                questionId: r.question_id,
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
                isAnswered: r.is_answered,
                max_score: r.max_score || 1
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
        const { candidateId, questionId } = req.body;
        const { responseId } = req.params; // legacy fallback
        const { manualScore, graderFeedback } = req.body;

        // Determine candidateId and questionId if they are missing but responseId is present
        let finalCandidateId = candidateId;
        let finalQuestionId = questionId;

        if (!finalCandidateId || !finalQuestionId) {
            if (!responseId || responseId === 'null' || responseId === 'undefined') {
                return res.status(400).json({ success: false, message: 'Candidate ID and Question ID are required for grading.' });
            }
            const respQuery = await query('SELECT candidate_id, question_id FROM responses WHERE id = $1', [responseId]);
            if (respQuery.rows.length === 0) return res.status(404).json({ success: false, message: 'Response not found' });
            finalCandidateId = respQuery.rows[0].candidate_id;
            finalQuestionId = respQuery.rows[0].question_id;
        }

        // Validation against max_score
        if (manualScore !== undefined) {
            const questionQuery = await query(`
                SELECT max_score 
                FROM questions 
                WHERE id = $1
            `, [finalQuestionId]);

            if (questionQuery.rows.length > 0) {
                const maxScore = questionQuery.rows[0].max_score || 1;
                if (manualScore < 0 || manualScore > maxScore) {
                    return res.status(400).json({ success: false, message: `Score must be between 0 and ${maxScore}` });
                }
            }
        }

        const updatedResponse = await Response.upsertGrade(finalCandidateId, finalQuestionId, manualScore, graderFeedback);

        // Fetch candidate result stats
        const result = await Result.findResultByCandidateId(finalCandidateId);
        if (result) {
            const pointsQuery = await query(`
                SELECT 
                    SUM(
                        CASE 
                            WHEN q.question_type = 'SUBJECTIVE' THEN COALESCE(r.manual_score, 0)
                            WHEN r.selected_answer = q.correct_answer THEN COALESCE(q.max_score, 1)
                            ELSE 0
                        END
                    ) as total_earned
                FROM responses r
                JOIN questions q ON r.question_id = q.id
                WHERE r.candidate_id = $1
            `, [finalCandidateId]);
            const totalEarned = parseFloat(pointsQuery.rows[0].total_earned || 0);

            const maxScoreQuery = await query(`
                SELECT SUM(COALESCE(q.max_score, 1)) as total_max_score
                FROM assessment_questions aq
                JOIN questions q ON aq.question_id = q.id
                WHERE aq.assessment_id = (SELECT assessment_id FROM candidates WHERE id = $1)
            `, [finalCandidateId]);
            const totalMaxScore = parseFloat(maxScoreQuery.rows[0].total_max_score || 1);
            
            const overallScore = Math.min(100, Math.round((totalMaxScore > 0 ? (totalEarned / totalMaxScore) : 0) * 100));

            // Dynamically fix the unanswered count for legacy submissions
            const unansweredQuery = await query(`
                SELECT COUNT(*) as count
                FROM assessment_questions aq
                JOIN questions q ON aq.question_id = q.id
                LEFT JOIN responses r ON aq.question_id = r.question_id AND r.candidate_id = $1
                WHERE aq.assessment_id = (SELECT assessment_id FROM candidates WHERE id = $1)
                AND (
                    r.id IS NULL 
                    OR (q.question_type = 'SUBJECTIVE' AND (r.text_answer IS NULL OR TRIM(r.text_answer) = ''))
                    OR (q.question_type != 'SUBJECTIVE' AND r.selected_answer IS NULL)
                )
            `, [finalCandidateId]);
            const unansweredQuestions = parseInt(unansweredQuery.rows[0].count || 0);

            // Dynamically calculate correct answers count (including manually graded ones > 0)
            const correctQuery = await query(`
                SELECT COUNT(*) as count
                FROM responses r
                JOIN questions q ON r.question_id = q.id
                WHERE r.candidate_id = $1 AND (
                    (q.question_type = 'SUBJECTIVE' AND r.manual_score > 0) OR
                    (q.question_type != 'SUBJECTIVE' AND r.selected_answer = q.correct_answer)
                )
            `, [finalCandidateId]);
            const correctAnswers = parseInt(correctQuery.rows[0].count || 0);

            // Check if there are any subjective questions still ungraded
            const ungradedQuery = await query(`
                SELECT COUNT(*) as count
                FROM assessment_questions aq
                JOIN questions q ON aq.question_id = q.id
                LEFT JOIN responses r ON aq.question_id = r.question_id AND r.candidate_id = $1
                WHERE aq.assessment_id = (SELECT assessment_id FROM candidates WHERE id = $1)
                AND q.question_type = 'SUBJECTIVE'
                AND (r.id IS NULL OR r.manual_score IS NULL)
            `, [finalCandidateId]);
            const ungradedCount = parseInt(ungradedQuery.rows[0].count || 0);

            // Fetch threshold to re-evaluate PASS/FAIL
            const assessmentQuery = await query(`SELECT thresholds FROM assessments WHERE id = (SELECT assessment_id FROM candidates WHERE id = $1)`, [finalCandidateId]);
            const thresholds = assessmentQuery.rows[0].thresholds || { overall: 50 };
            const passed = ungradedCount > 0 ? null : (overallScore >= (thresholds.overall || 50));

            console.log(`GRADE RESPONSE DEBUG: Candidate ${finalCandidateId}, Overall Score: ${overallScore}, Thresholds:`, thresholds, `Passed: ${passed}, Correct: ${correctAnswers}`);

            await query(`UPDATE results SET overall_score = $1, unanswered_questions = $2, passed = $3, correct_answers = $4 WHERE candidate_id = $5`, [overallScore, unansweredQuestions, passed, correctAnswers, finalCandidateId]);
            return res.json({ success: true, data: updatedResponse, overallScore, unansweredQuestions, passed, correctAnswers });
        }

        res.json({ success: true, data: updatedResponse });
    } catch (error) {
        next(error);
    }
};

export const exportBulkPDF = async (req, res, next) => {
    try {
        const { assessmentId } = req.params;
        
        // 1. Fetch assessment details
        const assessmentQuery = await query('SELECT title FROM assessments WHERE id = $1', [assessmentId]);
        if (assessmentQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Assessment not found' });
        }
        const assessmentTitle = assessmentQuery.rows[0].title;

        // 2. Fetch completed candidates
        const results = await Result.findResultsByAssessmentIds([assessmentId]);
        const completedCandidates = results.filter(r => r.status === 'completed' || r.completed_at !== null);

        if (completedCandidates.length === 0) {
            return res.status(400).json({ success: false, message: 'No completed candidates found for export' });
        }

        // 3. Fetch detailed responses
        const responses = await Result.findAllDetailedResponsesByAssessmentId(assessmentId);
        
        // Group responses
        const grouped = {};
        responses.forEach(r => {
            if (!grouped[r.candidate_id]) grouped[r.candidate_id] = [];
            grouped[r.candidate_id].push({
                candidateId: r.candidate_id,
                questionId: r.question_id,
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
                max_score: r.max_score || 1
            });
        });

        // 4. Set Headers and Stream ZIP
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${assessmentTitle.replace(/\s+/g, '_')}_All_Reports.zip"`);
        
        await streamZipBulkReport(assessmentTitle, completedCandidates, grouped, res);
        
    } catch (error) {
        console.error('PDF Generation Error:', error);
        next(error);
    }
};
