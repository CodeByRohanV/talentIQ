import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as proctoringController from '../controllers/proctoringController.js';
import { authenticate } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Public routes (candidate-facing, no JWT required — validated by attemptId)
router.post('/start', proctoringController.startSession);
router.post('/log', proctoringController.logEvent);
router.post('/end', proctoringController.endSession);

// Admin route (requires JWT for recruiter/admin to view reports)
router.get('/report/:candidateId', authenticate, proctoringController.getReport);

export default router;
