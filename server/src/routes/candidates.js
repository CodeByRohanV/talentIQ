import express from 'express';
import * as candidateController from '../controllers/candidateController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { requirePermission } from '../rbac/permissionMiddleware.js';

const router = express.Router();

// Public route for self-registration
router.post('/register', candidateController.registerCandidate);
router.post('/verify-otp', candidateController.verifyOtpAndRegister);

// Protected routes (require authentication)
router.get('/', requireAuth, requirePermission('manage_candidates'), candidateController.getCandidates);
router.get('/assessment/:assessmentId', requireAuth, requirePermission('manage_candidates'), candidateController.getCandidatesByAssessment);
router.post('/', requireAuth, requirePermission('manage_candidates'), candidateController.createCandidate);

// Public route (accessed via share token)
router.get('/token/:token', candidateController.getCandidateByToken);

router.delete('/:id', requireAuth, requirePermission('manage_candidates'), candidateController.deleteCandidate);

export default router;

