import * as Question from '../models/Question.js';
import * as Domain from '../models/Domain.js';
import * as User from '../models/User.js';
import { query } from '../config/database.js';

export const getQuestions = async (req, res, next) => {
    try {
        const { domain, domainId, difficulty, search, page = 1, limit = 10, questionType } = req.query;
        const { userId, tenantId, roles, managerId, domainId: userDomainId } = req.auth;

        // Always resolve fresh managerId from DB for Recruiters/Managers to prevent visibility issues
        let currentManagerId = managerId;
        if (roles.includes('RECRUITER') || roles.includes('MANAGER')) {
            const freshUser = await User.findUserById(userId);
            currentManagerId = freshUser?.manager_id || userId;
        }

        const filters = {
            search,
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            managerId: currentManagerId, 
            userDomainId,
            role: roles.includes('ADMIN') || roles.includes('SUPER_ADMIN') ? 'ADMIN' : (roles.includes('MANAGER') ? 'MANAGER' : 'RECRUITER')
        };

        if (domain) filters.domain = domain;
        if (domainId) filters.domainId = domainId;
        if (difficulty) filters.difficulty = difficulty;
        if (questionType) filters.questionType = questionType;

        let questions;
        let total;

        if (roles.includes('SUPER_ADMIN')) {
            questions = await Question.findAllQuestions(filters);
            total = await Question.countQuestions(null, filters);
        } else {
            questions = await Question.findQuestionsByTenantId(tenantId, filters);
            total = await Question.countQuestions(tenantId, filters);
        }

        res.json({
            success: true,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            data: questions.map(q => ({
                id: q.id,
                domain: q.domain,
                domainId: q.domain_id,
                domainName: q.domain_name,
                questionText: q.question_text,
                options: q.options,
                correctAnswer: q.correct_answer,
                difficulty: q.difficulty,
                questionType: q.question_type,
                createdAt: q.created_at
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const createQuestion = async (req, res, next) => {
    try {
        const { domain, domainId, questionText, options, correctAnswer, difficulty, question_type, max_score } = req.body;
        const { userId, tenantId, roles } = req.auth;

        // Resolve fresh managerId
        let currentManagerId = null;
        if (roles.includes('RECRUITER') || roles.includes('MANAGER')) {
            const freshUser = await User.findUserById(userId);
            currentManagerId = freshUser?.manager_id || userId;
        }

        // Validate input
        if ((!domain && !domainId) || !questionText) {
            return res.status(400).json({
                success: false,
                message: 'Domain (or domainId) and question text are required'
            });
        }
        
        if (question_type !== 'SUBJECTIVE' && (!options || correctAnswer === undefined)) {
            return res.status(400).json({
                success: false,
                message: 'Options and correct answer are required for multiple choice questions'
            });
        }

        const question = await Question.createQuestion(
            userId,
            tenantId,
            domain || null,
            questionText,
            options || [],
            correctAnswer !== undefined ? correctAnswer : null,
            difficulty,
            domainId || null,
            currentManagerId,
            question_type || 'MULTIPLE_CHOICE',
            max_score || 1
        );

        res.status(201).json({
            success: true,
            data: question
        });
    } catch (error) {
        next(error);
    }
};

export const bulkCreateQuestions = async (req, res, next) => {
    try {
        const { questions } = req.body;
        const { userId, tenantId, roles, managerId } = req.auth;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Questions array is required'
            });
        }

        // Domain Cache to avoid duplicate queries/creates
        const domainCache = new Map();
        
        // Resolve fresh managerId
        let scopedManagerId = null;
        if (roles.includes('RECRUITER') || roles.includes('MANAGER')) {
            const freshUser = await User.findUserById(userId);
            scopedManagerId = freshUser?.manager_id || userId;
        }

        const questionsToCreate = [];
        for (const q of questions) {
            let domainId = q.domain_id || q.domainId;
            let domainSlug = q.domain;

            // If no domain ID is provided, try to find or create by name/slug
            if (!domainId && q.domainName) {
                if (domainCache.has(q.domainName)) {
                    const cached = domainCache.get(q.domainName);
                    domainId = cached.id;
                    domainSlug = cached.slug;
                } else {
                    const slug = q.domainName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                    const domain = await Domain.findOrCreateDomain(q.domainName, slug, userId, tenantId, scopedManagerId);
                    domainCache.set(q.domainName, domain);
                    domainId = domain.id;
                    domainSlug = domain.slug;
                }
            }

            questionsToCreate.push({
                userId,
                domain: domainSlug || null,
                domain_id: domainId || null,
                question_text: q.questionText || q.question_text,
                options: q.options || [],
                correct_answer: q.correctAnswer !== undefined ? q.correctAnswer : (q.correct_answer !== undefined ? q.correct_answer : null),
                difficulty: q.difficulty || 'medium',
                question_type: q.questionType || q.question_type || 'MULTIPLE_CHOICE',
                max_score: q.maxScore !== undefined ? q.maxScore : (q.max_score !== undefined ? q.max_score : 1)
            });
        }

        // Chunking to avoid parameter limits (PG limit is 65535)
        const batchSize = 1000;
        const createdQuestions = [];

        for (let i = 0; i < questionsToCreate.length; i += batchSize) {
            const batch = questionsToCreate.slice(i, i + batchSize);
            const result = await Question.bulkCreateQuestions(batch, tenantId, scopedManagerId);
            createdQuestions.push(...result);
        }

        res.status(201).json({
            success: true,
            data: createdQuestions,
            count: createdQuestions.length
        });
    } catch (error) {
        next(error);
    }
};

export const deleteQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        const deleted = await Question.deleteQuestion(id, isSuperAdmin ? null : tenantId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Question not found or access denied'
            });
        }

        res.json({
            success: true,
            message: 'Question deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const updateQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { domain, domainId, questionText, options, correctAnswer, difficulty, question_type, max_score } = req.body;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');
        // #region agent log
        fetch('http://127.0.0.1:7732/ingest/16e67531-3ed4-47fa-ab85-13d213e24c55',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c8d619'},body:JSON.stringify({sessionId:'c8d619',runId:'pre-fix',hypothesisId:'H1',location:'questionController.js:updateQuestion:entry',message:'Question update payload received',data:{id,tenantId,isSuperAdmin,hasDomainId:domainId!==undefined,hasQuestionText:questionText!==undefined,optionsCount:Array.isArray(options)?options.length:null,correctAnswer,difficulty},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        const updates = {
            domain,
            domain_id: domainId || undefined, // Treat empty string as undefined to skip update or set to null if needed
            question_text: questionText,
            options,
            correct_answer: correctAnswer,
            difficulty,
            question_type,
            max_score
        };

        // Sync domain slug if only id is provided
        if (domainId && !domain) {
            const domainObj = await Domain.findDomainById(domainId);
            if (domainObj) {
                updates.domain = domainObj.slug;
            }
        }

        // Remove undefined fields
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        const question = await Question.updateQuestion(id, isSuperAdmin ? null : tenantId, updates);
        // #region agent log
        fetch('http://127.0.0.1:7732/ingest/16e67531-3ed4-47fa-ab85-13d213e24c55',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c8d619'},body:JSON.stringify({sessionId:'c8d619',runId:'pre-fix',hypothesisId:'H1',location:'questionController.js:updateQuestion:result',message:'Question update result',data:{id,updated:!!question,returnedQuestionId:question?.id||null,returnedDomainId:question?.domain_id||null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found or access denied'
            });
        }

        res.json({
            success: true,
            data: question
        });
    } catch (error) {
        next(error);
    }
};

export const bulkDeleteQuestions = async (req, res, next) => {
    try {
        const { ids, domainId, search } = req.body;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        let deleted;
        if (ids === 'all') {
            deleted = await Question.deleteQuestionsByFilter(tenantId, { domainId, search }, isSuperAdmin);
        } else {
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs array is required'
                });
            }
            deleted = await Question.deleteQuestions(ids, tenantId);
        }

        res.json({
            success: true,
            message: `${deleted.length} questions deleted successfully`,
            count: deleted.length
        });
    } catch (error) {
        next(error);
    }
};

export const checkUsage = async (req, res, next) => {
    try {
        const { ids, domainId, search } = req.query;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        let usedQuestionIds;
        if (ids === 'all') {
            const usedQuestions = await Question.checkQuestionsInAssessmentsByFilter(tenantId, { domainId, search }, isSuperAdmin);
            usedQuestionIds = usedQuestions.map(q => q.question_id);
        } else {
            if (!ids) {
                return res.status(400).json({
                    success: false,
                    message: 'IDs parameter is required'
                });
            }
            const questionIds = ids.split(',');
            const usedQuestions = await Question.checkQuestionsInAssessments(questionIds);
            usedQuestionIds = usedQuestions.map(q => q.question_id);
        }

        res.json({
            success: true,
            data: {
                usedCount: usedQuestionIds.length,
                usedQuestionIds
            }
        });
    } catch (error) {
        next(error);
    }
};
