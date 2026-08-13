import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as testController from '../controllers/testController.js';

// Setup multer for memory storage (for S3 streaming)
const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

// All routes are public (accessed via candidate share token)
router.get('/:token', testController.getTestByToken);
router.post('/:token/start', testController.startTest);
router.post('/:token/response', testController.saveResponse);
router.post('/:token/photo-id', upload.single('photo'), testController.uploadPhotoId);
router.post('/:token/submit', testController.submitTest);
router.post('/:token/violation', testController.logViolation); // For backward compatibility
router.post('/violation', testController.logViolation); // New requested format

export default router;
