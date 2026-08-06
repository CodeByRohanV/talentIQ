import express from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { syncUser } from '../controllers/syncController.js';

const router = express.Router();

// Public routes
router.post('/register', (req, res) => res.status(403).json({ success: false, message: 'Public registration is disabled' }));
router.post('/login', authController.login);

// Scaloz Workspace sync endpoint (secured by X-API-Key, not JWT)
router.post('/sync-user', syncUser);
router.get('/verify', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);
router.post('/change-password', requireAuth, authController.changePassword);

export default router;
