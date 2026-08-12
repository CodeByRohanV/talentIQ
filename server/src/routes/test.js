import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as testController from '../controllers/testController.js';

// Setup multer for local storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-id-' + uniqueSuffix + path.extname(file.originalname));
    }
});
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
