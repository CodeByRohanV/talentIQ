import express from 'express';
import * as assessmentController from '../controllers/assessmentController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { requirePermission } from '../rbac/permissionMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(requireAuth);

router.get('/', assessmentController.getAssessments);
router.post('/', requirePermission('create_assessments'), assessmentController.createAssessment);
router.get('/:id', assessmentController.getAssessment);
router.put('/:id', requirePermission('create_assessments'), assessmentController.updateAssessment);
router.delete('/:id', requirePermission('delete_assessments'), assessmentController.deleteAssessment);
router.post('/bulk-delete', requirePermission('delete_assessments'), assessmentController.bulkDeleteAssessments);
router.get('/:id/questions', requirePermission('view_questions'), assessmentController.getAssessmentQuestions);
router.post('/:id/questions', requirePermission('create_assessments'), assessmentController.assignQuestions);

// Email Invitation Endpoints (Fallback for legacy path)
router.post('/:id/send-link', requirePermission('create_assessments'), assessmentController.sendAssessmentEmails);
router.post('/:id/send-emails', requirePermission('create_assessments'), assessmentController.sendAssessmentEmails);

export default router;
