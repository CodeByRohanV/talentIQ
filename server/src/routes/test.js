import express from 'express';
import * as testController from '../controllers/testController.js';

const router = express.Router();

// All routes are public (accessed via candidate share token)
router.get('/:token', testController.getTestByToken);
router.post('/:token/start', testController.startTest);
router.post('/:token/response', testController.saveResponse);
router.post('/:token/submit', testController.submitTest);
router.post('/:token/violation', testController.logViolation); // For backward compatibility
router.post('/violation', testController.logViolation); // New requested format

export default router;
