import express from 'express';
import { syncUser, syncTenant } from '../controllers/syncController.js';

const router = express.Router();

// Integration endpoints called by Scaloz Workspace
router.post('/sync/tenant', syncTenant);
router.post('/sync/user', syncUser);

export default router;
