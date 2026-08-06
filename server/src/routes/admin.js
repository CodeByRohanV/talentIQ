import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { requirePermission } from '../rbac/permissionMiddleware.js';

const router = express.Router();

// All admin routes require authentication
router.use(requireAuth);

// User management
router.post('/users', requirePermission('invite_users'), adminController.createUser);
router.get('/users', requirePermission('invite_users'), adminController.listUsers);
router.patch('/users/:id', requirePermission('invite_users'), adminController.updateUser);
router.delete('/users/:id', requirePermission('invite_users'), adminController.deleteUser);
router.get('/stats', adminController.getStats);

// Role & Permission Management
router.get('/roles', adminController.listRoles);
router.post('/roles', requirePermission('manage_roles'), adminController.createCustomRole);
router.patch('/roles/:roleId', requirePermission('manage_roles'), adminController.updateCustomRole);
router.delete('/roles/:roleId', requirePermission('manage_roles'), adminController.deleteCustomRole);
router.get('/permissions', requirePermission('manage_roles'), adminController.listPermissions);

// Hierarchy Management
router.get('/hierarchy', adminController.getHierarchy);
router.post('/hierarchy/assign', requirePermission('assign_hierarchy'), adminController.assignRecruiter);
router.post('/hierarchy/unassign', requirePermission('assign_hierarchy'), adminController.unassignRecruiter);

export default router;
