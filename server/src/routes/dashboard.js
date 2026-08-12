import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { requireAuth } from '../rbac/authMiddleware.js';

const router = express.Router();

// All dashboard routes are protected
router.use(requireAuth);

router.get('/stats', dashboardController.getStats);

export default router;
