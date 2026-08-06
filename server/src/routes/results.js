import express from 'express';
import * as resultController from '../controllers/resultController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { requirePermission } from '../rbac/permissionMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(requireAuth);

router.get('/', requirePermission('view_reports'), resultController.getResults);
router.get('/candidate/:candidateId', requirePermission('view_reports'), resultController.getResultByCandidate);
router.get('/candidate/:candidateId/detailed', requirePermission('view_reports'), resultController.getDetailedResult);
router.get('/assessment/:assessmentId', requirePermission('view_reports'), resultController.getResultsByAssessment);

export default router;
