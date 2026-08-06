import * as Candidate from '../models/Candidate.js';
import * as Assessment from '../models/Assessment.js';
import { isValidEmail } from '../utils/validators.js';
import { query } from '../config/database.js';
import { processAllExpiredTests } from './testController.js';

export const getCandidates = async (req, res, next) => {
    try {
        await processAllExpiredTests();
        const { userId, tenantId, roles, managerId } = req.auth;

        // 1. Get assessments visible to this user
        const visibleAssessments = await Assessment.findAssessmentsRoleAware(userId, tenantId, roles, managerId);
        const assessmentIds = visibleAssessments.map(a => a.id);

        if (assessmentIds.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        // 2. Get candidates for these assessments
        const candidates = await Candidate.findCandidatesByAssessmentIds(assessmentIds);

        res.json({
            success: true,
            data: candidates.map(c => ({
                id: c.id,
                assessmentId: c.assessment_id,
                assessmentTitle: c.assessment_title,
                name: c.name,
                email: c.email,
                shareToken: c.share_token,
                status: c.status,
                startedAt: c.started_at,
                completedAt: c.completed_at,
                createdAt: c.created_at
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const createCandidate = async (req, res, next) => {
    try {
        const { assessmentId, name, email } = req.body;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        if (!assessmentId || !name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Assessment ID, name, and email are required'
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Verify assessment ownership and tenant
        const assessment = await Assessment.findAssessmentById(assessmentId, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found'
            });
        }

        const candidate = await Candidate.createCandidate(assessmentId, name, email);

        res.status(201).json({
            success: true,
            data: {
                id: candidate.id,
                assessmentId: candidate.assessment_id,
                name: candidate.name,
                email: candidate.email,
                shareToken: candidate.share_token,
                status: candidate.status,
                createdAt: candidate.created_at
            }
        });
    } catch (error) {
        next(error);
    }
};

export const registerCandidate = async (req, res, next) => {
    try {
        const { assessmentId, name, email } = req.body;

        // Validate required fields
        if (!assessmentId || !name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Assessment ID, name, and email are required'
            });
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Public registration doesn't need tenant scope (assessmentId is enough)
        // But we should ensure the assessment exists
        const result = await query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
        const assessment = result.rows[0];

        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found'
            });
        }

        if (!assessment.is_active) {
            return res.status(400).json({
                success: false,
                message: 'This assessment is no longer active'
            });
        }

        const now = new Date();
        if (assessment.available_from && new Date(assessment.available_from) > now) {
            return res.status(403).json({
                success: false,
                message: 'Registration for this assessment has not started yet.'
            });
        }

        const deadline = assessment.available_until || assessment.expires_at;
        if (deadline && new Date(deadline) < now) {
            return res.status(410).json({
                success: false,
                message: 'Registration for this assessment has closed.'
            });
        }

        // Check for existing candidate with same email for this assessment
        const existingCandidate = await Candidate.findCandidateByAssessmentAndEmail(assessmentId, email);

        if (existingCandidate) {
            return res.json({
                success: true,
                message: 'You have already registered for this assessment',
                data: {
                    id: existingCandidate.id,
                    assessmentId: existingCandidate.assessment_id,
                    name: existingCandidate.name,
                    email: existingCandidate.email,
                    shareToken: existingCandidate.share_token,
                    status: existingCandidate.status,
                    createdAt: existingCandidate.created_at
                }
            });
        }

        // Create new candidate
        const candidate = await Candidate.createCandidate(assessmentId, name, email);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                id: candidate.id,
                assessmentId: candidate.assessment_id,
                name: candidate.name,
                email: candidate.email,
                shareToken: candidate.share_token,
                status: candidate.status,
                createdAt: candidate.created_at
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getCandidatesByAssessment = async (req, res, next) => {
    try {
        await processAllExpiredTests();
        const { assessmentId } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');

        // Verify access via tenant
        const assessment = await Assessment.findAssessmentById(assessmentId, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(404).json({
                success: false,
                message: 'Assessment not found or access denied'
            });
        }

        const candidates = await Candidate.findCandidatesByAssessmentIds([assessmentId]);

        res.json({
            success: true,
            data: candidates.map(c => ({
                id: c.id,
                assessmentId: c.assessment_id,
                name: c.name,
                email: c.email,
                shareToken: c.share_token,
                status: c.status,
                startedAt: c.started_at,
                completedAt: c.completed_at,
                createdAt: c.created_at
            }))
        });
    } catch (error) {
        next(error);
    }
};

export const getCandidateByToken = async (req, res, next) => {
    try {
        const { token } = req.params;
        const candidate = await Candidate.findCandidateByShareToken(token);

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        res.json({
            success: true,
            data: candidate
        });
    } catch (error) {
        next(error);
    }
};
export const deleteCandidate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { tenantId, roles } = req.auth;
        const isSuperAdmin = roles.includes('SUPER_ADMIN');
        const isAdmin = roles.includes('ADMIN');

        // Check if user has sufficient role for deletion
        if (!isSuperAdmin && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: Only Administrators can delete candidates'
            });
        }

        // 1. Find the candidate
        const candidate = await Candidate.findCandidateById(id);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }

        // 2. Verify assessment ownership via tenant
        const assessment = await Assessment.findAssessmentById(candidate.assessment_id, isSuperAdmin ? null : tenantId);
        if (!assessment) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: You do not have permission to delete this candidate'
            });
        }

        // 3. Delete the candidate
        await Candidate.deleteCandidate(id);

        res.json({
            success: true,
            message: 'Candidate deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
