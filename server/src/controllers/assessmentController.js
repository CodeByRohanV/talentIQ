import * as Assessment from '../models/Assessment.js';
import * as Question from '../models/Question.js';
import { query } from '../config/database.js';
import * as emailService from '../utils/emailService.js';

export const getAssessments = async (req, res, next) => {
    try {
        const { userId, tenantId, roles, managerId } = req.auth;

        // Implementation of specified HIERARCHY VISIBILITY LOGIC
        const assessments = await Assessment.findAssessmentsRoleAware(userId, tenantId, roles, managerId);

        res.json({
            success: true,
            data: assessments.map(a => ({
                id: a.id,
                title: a.title,
                description: a.description,
                durationMinutes: a.duration_minutes,
                questionsConfig: a.questions_config,
                thresholds: a.thresholds,
                shareToken: a.share_token,
                isActive: a.is_active,
                status: a.status,
                createdAt: a.created_at,
                updatedAt: a.updated_at,
                expiresAt: a.expires_at,
                availableFrom: a.available_from || null,
                availableUntil: a.available_until || null,
                securityConfig: a.security_config,
                instructions: a.instructions,
                videoProctoringEnabled: a.video_proctoring_enabled,
                creatorName: a.creator_name,
                creatorEmail: a.creator_email,
                creatorRole: a.created_by_role,
                candidateCount: parseInt(a.candidate_count || 0)
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const getAssessment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        const assessment = await Assessment.findAssessmentById(id, isSuperAdmin ? null : tenantId);

        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        res.json({
            success: true,
            data: {
                id: assessment.id,
                title: assessment.title,
                description: assessment.description,
                durationMinutes: assessment.duration_minutes,
                questionsConfig: assessment.questions_config,
                thresholds: assessment.thresholds,
                securityConfig: assessment.security_config,
                shareToken: assessment.share_token,
                isActive: assessment.is_active,
                status: assessment.status,
                instructions: assessment.instructions,
                videoProctoringEnabled: assessment.video_proctoring_enabled,
                createdAt: assessment.created_at,
                updatedAt: assessment.updated_at,
                availableFrom: assessment.available_from || null,
                availableUntil: assessment.available_until || null,
                creatorName: assessment.creator_name,
                candidateCount: parseInt(assessment.candidate_count || 0)
            }
        });
    } catch (error) {
        next(error);
    }
};

export const createAssessment = async (req, res, next) => {
    try {
        const { title, description, instructions, durationMinutes, questionsConfig, thresholds, securityConfig, questionIds, expiresAt, videoProctoringEnabled } = req.body;
        const { userId, tenantId, roles, managerId } = req.auth;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Use primary role for tracking
        const primaryRole = roles[0] || 'RECRUITER';

        const assessment = await Assessment.createAssessment(
            userId,
            tenantId,
            primaryRole,
            title,
            description,
            durationMinutes || 60,
            questionsConfig || {},
            thresholds || { overall: 60 },
            securityConfig,
            managerId,
            expiresAt,
            instructions,
            req.body.availableFrom || null,
            req.body.availableUntil || null,
            videoProctoringEnabled !== undefined ? videoProctoringEnabled : false,
            req.body.requiresPhotoId !== undefined ? req.body.requiresPhotoId : false
        );

        // Assign questions if provided
        if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
            await Assessment.assignQuestionsToAssessment(assessment.id, questionIds);
        }

        // REAL-TIME UPDATE (LIGHTWEIGHT): Insert into audit logs
        await query(
            `INSERT INTO audit_logs (actor_id, action, target_id, metadata)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'ASSESSMENT_CREATED', assessment.id, JSON.stringify({ title, tenantId })]
        );

        res.status(201).json({
            success: true,
            data: {
                id: assessment.id,
                title: assessment.title,
                description: assessment.description,
                durationMinutes: assessment.duration_minutes,
                questionsConfig: assessment.questions_config,
                thresholds: assessment.thresholds,
                shareToken: assessment.share_token,
                isActive: assessment.is_active,
                status: assessment.status,
                expiresAt: assessment.expires_at,
                instructions: assessment.instructions,
                availableFrom: assessment.available_from || null,
                availableUntil: assessment.available_until || null,
                videoProctoringEnabled: assessment.video_proctoring_enabled,
                createdAt: assessment.created_at,
                updatedAt: assessment.updated_at
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updateAssessment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles, permissions } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');
        const userPerms = permissions || [];
        const { 
            title, description, instructions, durationMinutes, isActive, 
            status, securityConfig, expiresAt, availableFrom, availableUntil, videoProctoringEnabled, requiresPhotoId
        } = req.body;

        // Security Enforcement: Refined Granular Checks
        // 1. Scheduling / Timer Checks
        const isTouchingScheduling = durationMinutes !== undefined || availableFrom !== undefined || availableUntil !== undefined || expiresAt !== undefined;
        if (isTouchingScheduling && !isSuperAdmin && !userPerms.includes('edit_assessment_scheduling')) {
            return res.status(403).json({ success: false, message: 'Access Denied: Missing permission to modify assessment scheduling/timer.' });
        }

        // 2. Instructions Checks
        if (instructions !== undefined && !isSuperAdmin && !userPerms.includes('edit_assessment_instructions')) {
            return res.status(403).json({ success: false, message: 'Access Denied: Missing permission to modify assessment instructions.' });
        }

        // 3. Exam Security Checks
        if (securityConfig !== undefined && !isSuperAdmin && !userPerms.includes('edit_assessment_security')) {
            return res.status(403).json({ success: false, message: 'Access Denied: Missing permission to modify exam security settings.' });
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (instructions !== undefined) updates.instructions = instructions;
        if (durationMinutes !== undefined) updates.duration_minutes = durationMinutes;
        if (isActive !== undefined) updates.is_active = isActive;
        if (status !== undefined) updates.status = status;
        if (securityConfig !== undefined) updates.security_config = securityConfig;
        if (expiresAt !== undefined) updates.expires_at = expiresAt;
        
        // Ensure empty strings are treated as null to avoid invalid timestamp errors
        if (availableFrom !== undefined) updates.available_from = (availableFrom && availableFrom.trim() !== '') ? availableFrom : null;
        if (availableUntil !== undefined) updates.available_until = (availableUntil && availableUntil.trim() !== '') ? availableUntil : null;
        if (videoProctoringEnabled !== undefined) updates.video_proctoring_enabled = videoProctoringEnabled;
        if (requiresPhotoId !== undefined) updates.requires_photo_id = requiresPhotoId;

        const assessment = await Assessment.updateAssessment(id, isSuperAdmin ? null : tenantId, updates);

        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        res.json({
            success: true,
            data: {
                id: assessment.id,
                title: assessment.title,
                description: assessment.description,
                expiresAt: assessment.expires_at,
                durationMinutes: assessment.duration_minutes,
                questionsConfig: assessment.questions_config,
                thresholds: assessment.thresholds,
                shareToken: assessment.share_token,
                isActive: assessment.is_active,
                status: assessment.status,
                instructions: assessment.instructions,
                availableFrom: assessment.available_from || null,
                availableUntil: assessment.available_until || null,
                videoProctoringEnabled: assessment.video_proctoring_enabled,
                requiresPhotoId: assessment.requires_photo_id,
                createdAt: assessment.created_at,
                updatedAt: assessment.updated_at,
                candidateCount: parseInt(assessment.candidate_count || 0)
            }
        });
    } catch (error) {
        next(error);
    }
};

export const deleteAssessment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        const deleted = await Assessment.deleteAssessment(id, isSuperAdmin ? null : tenantId);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        res.json({
            success: true,
            message: 'Assessment deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const bulkDeleteAssessments = async (req, res, next) => {
    try {
        const { ids } = req.body;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Assessment IDs array is required'
            });
        }

        const deletedCount = await Assessment.deleteAssessments(ids, isSuperAdmin ? null : tenantId);

        res.json({
            success: true,
            message: `${deletedCount} assessments deleted successfully`
        });
    } catch (error) {
        next(error);
    }
};

export const getAssessmentQuestions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        const assessment = await Assessment.findAssessmentById(id, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        const questions = await Assessment.getAssessmentQuestions(id);

        res.json({
            success: true,
            data: questions.map(q => ({
                id: q.id,
                domain: q.domain,
                questionText: q.question_text,
                options: q.options,
                correctAnswer: q.correct_answer,
                difficulty: q.difficulty,
                order: q.question_order
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const assignQuestions = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');
        const { questionIds } = req.body;

        if (!Array.isArray(questionIds)) {
            return res.status(400).json({
                success: false,
                message: 'Question IDs must be an array'
            });
        }

        const assessment = await Assessment.findAssessmentById(id, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        await Assessment.assignQuestionsToAssessment(id, questionIds);

        res.json({
            success: true,
            message: 'Questions assigned successfully'
        });
    } catch (error) {
        next(error);
    }
};

export const sendAssessmentEmails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { emails } = req.body;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Emails array is required'
            });
        }

        const assessment = await Assessment.findAssessmentById(id, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        const sendPromises = emails.map(email => 
            emailService.sendAssessmentLinkEmail(email, assessment.title, assessment.share_token)
        );

        const results = await Promise.allSettled(sendPromises);
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        if (failed === emails.length) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send all invitation emails'
            });
        }

        res.json({
            success: true,
            message: `Invitation emails: ${succeeded} sent successfully, ${failed} failed`
        });
    } catch (error) {
        next(error);
    }
};
