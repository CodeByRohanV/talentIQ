import express from 'express';
import { getDomains, createDomain, deleteDomain } from '../controllers/domainController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { requirePermission } from '../rbac/permissionMiddleware.js';

const router = express.Router();

// All domain routes require authentication
router.use(requireAuth);

router.get('/', getDomains);                                             // any authenticated user
router.post('/', requirePermission('create_questions'), createDomain);
router.delete('/:id', requirePermission('edit_questions'), deleteDomain);

export default router;
