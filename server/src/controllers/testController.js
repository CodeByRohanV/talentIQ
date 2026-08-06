/**
 * testController.js
 * -----------------
 * Handles the candidate-facing test lifecycle with enterprise-grade
 * per-attempt randomization.
 *
 * DATA FLOW:
 *   1. GET /:token          → identify candidate, create/fetch attempt, return shuffled questions
 *   2. POST /:token/start   → transition attempt to 'in_progress', set timer
 *   3. POST /:token/response → save answer (translated from display index → original index)
 *   4. POST /:token/submit  → evaluate using original indices, save result
 *
 * SECURITY INVARIANTS:
 *   - correct_answer is NEVER sent to the frontend.
 *   - Randomization happens ONLY on the backend.
 *   - Attempt order is fetched from DB on every request (no frontend state trust).
 *   - Answer translation (display → original) happens server-side before storage.
 */

import * as Candidate from '../models/Candidate.js';
import * as Assessment from '../models/Assessment.js';
import * as Response from '../models/Response.js';
import * as Result from '../models/Result.js';
import * as TestAttempt from '../models/TestAttempt.js';
import {
    buildRandomizedQuestionOrder,
    buildRandomizedOptionOrder,
    applyRandomization,
    resolveOriginalAnswerIndex
} from '../utils/shuffleUtils.js';
import { DEFAULT_SECURITY_CONFIG } from '../config/security.js';
import { query } from '../config/database.js';

/**
 * Shared evaluation logic for both explicit submission and auto-submission.
 * Calculates total, attempted, correct, incorrect, and unanswered questions.
 * Transitioning status is handled atomically to prevent double counting.
 */
async function evaluateAndSaveResult(candidateId, assessmentId, attemptId, submissionMode = 'manual') {
    // 1. Atomically mark attempt as completed to lock it from other processes
    if (attemptId) {
        const finalAttempt = await TestAttempt.forceCompleteAttempt(attemptId, submissionMode);
        if (!finalAttempt) {
            // If already processed, return the existing result record
            return await Result.findResultByCandidateId(candidateId);
        }
    } else {
        const existingResult = await Result.findResultByCandidateId(candidateId);
        if (existingResult) return existingResult;
    }

    // 2. Fetch all data needed for evaluation
    const [responses, questions] = await Promise.all([
        Response.findResponsesByCandidateId(candidateId),
        Assessment.getAssessmentQuestions(assessmentId)
    ]);

    const stats = {
        totalQuestions: questions.length,
        attemptedQuestions: responses.length,
        correctAnswers: 0,
        incorrectAnswers: 0,
        unansweredQuestions: 0
    };

    const questionMap = new Map(questions.map(q => [q.id, q]));
    const responseMap = new Map(responses.map(r => [r.question_id, r]));

    const domainScores = {};
    questions.forEach(q => {
        const dKey = q.domain_id || q.domain;
        if (!domainScores[dKey]) domainScores[dKey] = { correct: 0, total: 0 };
        domainScores[dKey].total++;

        const response = responseMap.get(q.id);
        if (response && response.selected_answer !== null && response.selected_answer !== undefined) {
            if (response.selected_answer === q.correct_answer) {
                stats.correctAnswers++;
                domainScores[dKey].correct++;
            } else {
                stats.incorrectAnswers++;
            }
        } else {
            stats.unansweredQuestions++;
        }
    });

    const overallScore = stats.totalQuestions > 0
        ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
        : 0;

    const domainDetails = {};
    Object.entries(domainScores).forEach(([domain, { correct, total }]) => {
        domainDetails[domain] = {
            correct,
            total,
            percentage: total > 0 ? Math.round((correct / total) * 100) : 0
        };
    });

    const assessment = await Assessment.findAssessmentById(assessmentId);
    const thresholds = assessment?.thresholds || { overall: 60 };
    const passed = overallScore >= (thresholds.overall || 60);

    // 3. Persist result (includes granular stats) and update candidate
    const [result] = await Promise.all([
        Result.createResult(candidateId, overallScore, domainDetails, passed, stats, submissionMode),
        Candidate.updateCandidateStatus(candidateId, 'completed', null, new Date().toISOString())
    ]);

    return result;
}

// ---------------------------------------------------------------------------
// GET /:token — Load test (creates attempt + shuffle on first visit)
// ---------------------------------------------------------------------------
export const getTestByToken = async (req, res, next) => {
    try {
        const { token } = req.params;

        // ── Step 1: Resolve token type ──────────────────────────────────────
        // Token can be an assessment share_token (→ registration required)
        // or a candidate share_token (→ load test directly).
        const assessment = await Assessment.findAssessmentByShareToken(token);

        if (assessment) {
            const now = new Date();
            if (assessment.available_from && new Date(assessment.available_from) > now) {
                return res.status(403).json({
                    success: false,
                    message: 'Test not started yet',
                    notStarted: true,
                    availableFrom: assessment.available_from,
                    data: {
                        assessment: {
                            id: assessment.id,
                            title: assessment.title,
                            description: assessment.description,
                            durationMinutes: assessment.duration_minutes,
                            instructions: assessment.instructions,
                            availableFrom: assessment.available_from
                        }
                    }
                });
            }

            const deadline = assessment.available_until || assessment.expires_at;
            if (deadline && new Date(deadline) < now) {
                return res.status(410).json({
                    success: false,
                    message: 'This assessment has already expired.',
                    expired: true,
                    data: {
                        assessment: {
                            id: assessment.id,
                            title: assessment.title,
                            availableUntil: deadline
                        }
                    }
                });
            }

            return res.json({
                success: true,
                requiresRegistration: true,
                data: {
                    assessment: {
                        id: assessment.id,
                        title: assessment.title,
                        description: assessment.description,
                        durationMinutes: assessment.duration_minutes,
                        instructions: assessment.instructions,
                        availableFrom: assessment.available_from,
                        availableUntil: assessment.available_until
                    }
                }
            });
        }

        // ── Step 2: Resolve candidate ───────────────────────────────────────
        const candidate = await Candidate.findCandidateByShareToken(token);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Invalid test link' });
        }

        if (candidate.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Test already completed',
                completed: true
            });
        }

        // ── Step 3: Resolve assessment ──────────────────────────────────────
        const candidateAssessment = await Assessment.findAssessmentById(candidate.assessment_id);
        if (!candidateAssessment || !candidateAssessment.is_active) {
            return res.status(404).json({ success: false, message: 'Assessment not found or inactive' });
        }

        // ── Availability Check ──────────────────────────────────────────────
        const now = new Date();
        if (candidateAssessment.available_from && new Date(candidateAssessment.available_from) > now) {
            return res.status(403).json({
                success: false,
                message: 'Test not started yet',
                notStarted: true,
                availableFrom: candidateAssessment.available_from
            });
        }
        
        // available_until takes precedence over legacy expires_at if set
        const deadline = candidateAssessment.available_until || candidateAssessment.expires_at;
        if (deadline && new Date(deadline) < now) {
            return res.status(410).json({
                success: false,
                message: 'Test expired',
                expired: true,
                availableUntil: deadline
            });
        }

        // ── Step 4: Fetch raw questions (with correct_answer — server only) ─
        const rawQuestions = await Assessment.getAssessmentQuestions(candidateAssessment.id);
        if (rawQuestions.length === 0) {
            return res.status(404).json({ success: false, message: 'No questions found for this assessment' });
        }

        // ── Step 5: Get or create attempt (idempotent) ──────────────────────
        // On first visit: generates and persists the shuffle.
        // On subsequent visits (refresh/reconnect): returns the stored shuffle.
        // If the question set changed (questions added/removed), regenerate.
        let attempt = await TestAttempt.findAttemptByCandidateAndAssessment(
            candidate.id,
            candidateAssessment.id
        );

        // Detect stale attempt: stored question IDs don't match current question set
        if (attempt && attempt.attempt_status !== 'completed') {
            const storedOrder = Array.isArray(attempt.randomized_question_order)
                ? attempt.randomized_question_order
                : JSON.parse(attempt.randomized_question_order || '[]');

            const currentIds = new Set(rawQuestions.map(q => q.id));
            const storedIds = new Set(storedOrder);
            const isStale = storedOrder.length !== rawQuestions.length ||
                [...currentIds].some(id => !storedIds.has(id));

            if (isStale) {
                // Question set changed — delete stale attempt and regenerate
                await TestAttempt.deleteAttempt(attempt.id);
                attempt = null;
            }
        }

        if (!attempt) {
            // First time this candidate loads the test (or stale attempt cleared) — generate shuffle
            const questionOrder = buildRandomizedQuestionOrder(rawQuestions);
            const optionOrderMap = buildRandomizedOptionOrder(rawQuestions);

            attempt = await TestAttempt.createAttempt(
                candidate.id,
                candidateAssessment.id,
                questionOrder,
                optionOrderMap,
                candidateAssessment.duration_minutes
            );
        }

        // ── Step 6: Check for expiry ────────────────────────────────────────
        if (attempt.attempt_status === 'in_progress') {
            const justExpired = await TestAttempt.checkAndExpireAttempt(attempt.id);
            if (justExpired) {
                // Time just ran out — auto-submit before letting them know
                await evaluateAndSaveResult(candidate.id, candidateAssessment.id, attempt.id, 'auto');
                return res.status(410).json({
                    success: false,
                    message: 'Test time has expired',
                    expired: true
                });
            }
        }

        // Re-fetch attempt after potential expiry update
        attempt = await TestAttempt.findAttemptById(attempt.id);
        if (attempt.attempt_status === 'expired') {
            // Already expired. Check if result exists (might have been processed by sweeper)
            const existingResult = await Result.findResultByCandidateId(candidate.id);
            if (!existingResult) {
                await evaluateAndSaveResult(candidate.id, candidateAssessment.id, attempt.id, 'auto');
            }
            return res.status(410).json({
                success: false,
                message: 'Test time has expired',
                expired: true
            });
        }

        // ── Step 7: Apply randomization for display ─────────────────────────
        // Parse JSONB fields (pg driver may return them as objects already)
        const questionOrder = Array.isArray(attempt.randomized_question_order)
            ? attempt.randomized_question_order
            : JSON.parse(attempt.randomized_question_order);

        const optionOrderMap = typeof attempt.randomized_option_order === 'object'
            ? attempt.randomized_option_order
            : JSON.parse(attempt.randomized_option_order);

        // applyRandomization strips correct_answer — safe to send to frontend
        const displayQuestions = applyRandomization(rawQuestions, questionOrder, optionOrderMap);

        // ── Step 8: Fetch existing responses ───────────────────────────────
        const responses = await Response.findResponsesByCandidateId(candidate.id);

        // ── Step 9: Compute time remaining ─────────────────────────────────
        let timeRemaining = candidateAssessment.duration_minutes * 60;
        if (attempt.started_at) {
            // Use the stored expires_at which is already capped by available_until
            const endTime = new Date(attempt.expires_at);
            timeRemaining = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
        } else {
            // Not started yet: if they only have (e.g.) 5 mins left in the overall window, 
            // even if duration is 60, they should see 5 mins.
            if (candidateAssessment.available_until) {
                const windowRemaining = Math.max(0, Math.floor((new Date(candidateAssessment.available_until).getTime() - Date.now()) / 1000));
                timeRemaining = Math.min(timeRemaining, windowRemaining);
            }
        }
        // #region agent log
        fetch('http://127.0.0.1:7732/ingest/16e67531-3ed4-47fa-ab85-13d213e24c55',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c8d619'},body:JSON.stringify({sessionId:'c8d619',runId:'pre-fix',hypothesisId:'H3',location:'testController.js:getTestByToken:timer',message:'Timer calculation snapshot',data:{tokenType:'candidate',attemptStatus:attempt.attempt_status,startedAt:attempt.started_at,attemptExpiresAt:attempt.expires_at,availableUntil:candidateAssessment.available_until,durationMinutes:candidateAssessment.duration_minutes,timeRemaining},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        // ── Step 10: Fetch violation count ──────────────────────────────────
        const violationResult = await query(
            `SELECT COUNT(*) as count FROM test_violations 
             WHERE candidate_id = $1 AND assessment_id = $2 
             AND violation_type IN ('tab_switch', 'fullscreen_exit', 'resize', 'devtools', 'printscreen', 'page_reload')`,
            [candidate.id, candidateAssessment.id]
        );
        const violationCount = parseInt(violationResult.rows[0].count, 10);

        // ── Step 11: Build response ─────────────────────────────────────────
        const securityConfig = {
            ...DEFAULT_SECURITY_CONFIG,
            ...(typeof candidateAssessment.security_config === 'string'
                ? JSON.parse(candidateAssessment.security_config)
                : (candidateAssessment.security_config || {}))
        };

        return res.json({
            success: true,
            requiresRegistration: false,
            data: {
                attemptId: attempt.id,
                candidate: {
                    id: candidate.id,
                    name: candidate.name,
                    status: candidate.status,
                    startedAt: attempt.started_at
                },
                assessment: {
                    id: candidateAssessment.id,
                    title: candidateAssessment.title,
                    description: candidateAssessment.description,
                    durationMinutes: candidateAssessment.duration_minutes,
                    instructions: candidateAssessment.instructions
                },
                securityConfig,
                violationCount,
                questions: displayQuestions,
                responses: responses.map(r => ({
                    questionId: r.question_id,
                    // Return the display-position answer (what the candidate sees)
                    // We stored the original index; reverse-map it for the UI.
                    selectedAnswer: r.selected_answer !== null
                        ? reverseMapAnswer(r.selected_answer, r.question_id, optionOrderMap)
                        : null,
                    isFlagged: r.is_flagged
                })),
                timeRemaining
            }
        });
    } catch (error) {
        next(error);
    }
};

// ---------------------------------------------------------------------------
// POST /:token/start — Begin the test, start the timer
// ---------------------------------------------------------------------------
export const startTest = async (req, res, next) => {
    try {
        const { token } = req.params;

        const candidate = await Candidate.findCandidateByShareToken(token);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (candidate.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Test already completed' });
        }

        const assessment = await Assessment.findAssessmentById(candidate.assessment_id);
        if (!assessment) {
            return res.status(404).json({ success: false, message: 'Assessment not found' });
        }

        // Fetch attempt — must exist (created on GET /:token)
        let attempt = await TestAttempt.findAttemptByCandidateAndAssessment(
            candidate.id,
            assessment.id
        );

        if (!attempt) {
            return res.status(400).json({
                success: false,
                message: 'Test session not initialized. Please reload the test page.'
            });
        }

        // Transition to in_progress (idempotent — safe to call multiple times)
        const updatedAttempt = await TestAttempt.startAttempt(attempt.id, assessment.duration_minutes, assessment.available_until);
        // #region agent log
        fetch('http://127.0.0.1:7732/ingest/16e67531-3ed4-47fa-ab85-13d213e24c55',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c8d619'},body:JSON.stringify({sessionId:'c8d619',runId:'pre-fix',hypothesisId:'H3',location:'testController.js:startTest:attempt',message:'Attempt start timing persisted',data:{attemptId:attempt.id,durationMinutes:assessment.duration_minutes,availableUntil:assessment.available_until,startedAt:updatedAttempt?.started_at||null,expiresAt:updatedAttempt?.expires_at||null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        // Also update candidate status for backward compatibility
        if (candidate.status === 'pending') {
            await Candidate.updateCandidateStatus(
                candidate.id,
                'in_progress',
                updatedAttempt?.started_at || new Date().toISOString()
            );
        }

        return res.json({
            success: true,
            message: 'Test started',
            data: {
                attemptId: attempt.id,
                startedAt: updatedAttempt?.started_at,
                expiresAt: updatedAttempt?.expires_at
            }
        });
    } catch (error) {
        next(error);
    }
};

// ---------------------------------------------------------------------------
// POST /:token/response — Save a candidate's answer
// ---------------------------------------------------------------------------
export const saveResponse = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { questionId, selectedAnswer, isFlagged } = req.body;

        if (!questionId) {
            return res.status(400).json({ success: false, message: 'questionId is required' });
        }

        const candidate = await Candidate.findCandidateByShareToken(token);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (candidate.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Test already completed' });
        }

        // Fetch the attempt to get the option order map
        const attempt = await TestAttempt.findAttemptByCandidateAndAssessment(
            candidate.id,
            candidate.assessment_id
        );

        if (!attempt) {
            return res.status(400).json({
                success: false,
                message: 'No active test attempt found'
            });
        }

        // Check expiry
        const justExpired = await TestAttempt.checkAndExpireAttempt(attempt.id);
        if (justExpired || attempt.attempt_status === 'expired') {
            await evaluateAndSaveResult(candidate.id, candidate.assessment_id, attempt.id, 'auto');
            return res.status(410).json({
                success: false,
                message: 'Test time has expired',
                expired: true
            });
        }

        // ── Translate display answer → original answer ──────────────────────
        // The frontend sends the display-position index (0-based position in
        // the shuffled option list). We must store the ORIGINAL option index
        // so that evaluation can compare against correct_answer in the DB.
        let originalAnswerIndex = selectedAnswer;
        if (selectedAnswer !== null && selectedAnswer !== undefined) {
            const optionOrderMap = typeof attempt.randomized_option_order === 'object'
                ? attempt.randomized_option_order
                : JSON.parse(attempt.randomized_option_order);

            const questionOptionOrder = optionOrderMap[questionId];
            originalAnswerIndex = resolveOriginalAnswerIndex(selectedAnswer, questionOptionOrder);
        }

        const response = await Response.upsertResponse(
            candidate.id,
            questionId,
            originalAnswerIndex,
            isFlagged || false
        );

        return res.json({
            success: true,
            data: {
                questionId: response.question_id,
                // Echo back the display-position answer for UI consistency
                selectedAnswer,
                isFlagged: response.is_flagged
            }
        });
    } catch (error) {
        next(error);
    }
};

// ---------------------------------------------------------------------------
// POST /:token/submit — Submit the test and calculate results
// ---------------------------------------------------------------------------
export const submitTest = async (req, res, next) => {
    try {
        const { token } = req.params;

        const candidate = await Candidate.findCandidateByShareToken(token);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        if (candidate.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Test already completed' });
        }

        const assessment = await Assessment.findAssessmentById(candidate.assessment_id);
        if (!assessment) {
            return res.status(404).json({ success: false, message: 'Assessment not found' });
        }

        const attempt = await TestAttempt.findAttemptByCandidateAndAssessment(
            candidate.id,
            assessment.id
        );

        if (!attempt) {
            return res.status(400).json({ success: false, message: 'No active test attempt found' });
        }

        // evaluateAndSaveResult handles atomic completion and result persistence.
        // This prevents race conditions if the timer expires at the exact same
        // moment the candidate clicks submit.
        const { submissionMode = 'manual' } = req.body;
        const result = await evaluateAndSaveResult(candidate.id, assessment.id, attempt.id, submissionMode);

        if (!result) {
            return res.status(400).json({ success: false, message: 'Could not process submission.' });
        }

        return res.json({
            success: true,
            data: {
                overallScore: result.overall_score,
                domainScores: result.domain_scores,
                passed: result.passed,
                stats: {
                    totalQuestions: result.total_questions,
                    attemptedQuestions: result.attempted_questions,
                    correctAnswers: result.correct_answers,
                    incorrectAnswers: result.incorrect_answers,
                    unansweredQuestions: result.unanswered_questions,
                    submissionMode: result.submission_mode
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// ---------------------------------------------------------------------------
// POST /:token/violation — Log a security violation
// ---------------------------------------------------------------------------
export const logViolation = async (req, res, next) => {
    try {
        const { candidateToken, violationType, metadata } = req.body;
        const token = req.params.token || candidateToken;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Candidate token is required' });
        }

        const candidate = await Candidate.findCandidateByShareToken(token);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        await query(
            `INSERT INTO test_violations(candidate_id, assessment_id, violation_type, metadata)
             VALUES($1, $2, $3, $4)`,
            [candidate.id, candidate.assessment_id, violationType, JSON.stringify(metadata || {})]
        );

        return res.json({ success: true, message: 'Violation logged' });
    } catch (error) {
        next(error);
    }
};

// ---------------------------------------------------------------------------
// Internal helper: reverse-map stored original index → display position
// ---------------------------------------------------------------------------
// When returning existing responses to the frontend, we need to convert
// the stored original index back to the display position the candidate saw.
function reverseMapAnswer(originalIndex, questionId, optionOrderMap) {
    const optionOrder = optionOrderMap[questionId];
    if (!Array.isArray(optionOrder)) return originalIndex;
    // optionOrder[displayPos] = originalIndex
    // We want: displayPos where optionOrder[displayPos] === originalIndex
    const displayPos = optionOrder.indexOf(originalIndex);
    return displayPos >= 0 ? displayPos : originalIndex;
}

/**
 * Cron/Background Worker helper to find and process all expired tests.
 * This handles candidates who close their browser/tab and never return.
 */
export const processAllExpiredTests = async (req, res, next) => {
    try {
        const expiredQuery = await query(`
            SELECT c.id as candidate_id, c.assessment_id, ta.id as attempt_id
            FROM candidates c
            JOIN assessments a ON c.assessment_id = a.id
            LEFT JOIN test_attempts ta ON ta.candidate_id = c.id AND ta.assessment_id = c.assessment_id
            WHERE c.status IN ('pending', 'in_progress')
              AND (
                  (ta.id IS NOT NULL AND ta.attempt_status IN ('in_progress', 'pending') AND ta.expires_at IS NOT NULL AND ta.expires_at < NOW())
                  OR (c.status = 'in_progress' AND c.started_at IS NOT NULL AND NOW() > (c.started_at + (a.duration_minutes || ' minutes')::INTERVAL))
                  OR (a.expires_at IS NOT NULL AND a.expires_at < NOW())
                  OR (a.available_until IS NOT NULL AND a.available_until < NOW())
              )
        `);

        const expiredCandidates = expiredQuery.rows;
        const results = [];

        for (const row of expiredCandidates) {
            const result = await evaluateAndSaveResult(
                row.candidate_id,
                row.assessment_id,
                row.attempt_id,
                'auto'
            );
            if (result) results.push(result);
        }

        if (res) {
            return res.json({
                success: true,
                processedCount: results.length,
                message: `Successfully auto-submitted ${results.length} expired tests.`
            });
        }
        return results.length;
    } catch (error) {
        if (next && typeof next === 'function') next(error);
        else console.error('Auto-submit process error:', error);
    }
};

