import express from 'express';
import * as questionController from '../controllers/questionController.js';
import { requireAuth } from '../rbac/authMiddleware.js';
import { requirePermission } from '../rbac/permissionMiddleware.js';

const router = express.Router();

// All routes are protected
router.use(requireAuth);

router.get('/', questionController.getQuestions);                                          // any authenticated user
router.get('/my-domain', questionController.getQuestions);                                  // Manager scoped
router.get('/assigned', questionController.getQuestions);                                   // Recruiter scoped
router.get('/usage', questionController.checkUsage);                                       // any authenticated user
router.post('/', requirePermission('create_questions'), questionController.createQuestion);
router.post('/bulk', requirePermission('create_questions'), questionController.bulkCreateQuestions);
router.delete('/bulk', requirePermission('delete_questions'), questionController.bulkDeleteQuestions);
router.put('/:id', requirePermission('create_questions'), questionController.updateQuestion);
router.delete('/:id', requirePermission('delete_questions'), questionController.deleteQuestion);

export default router;
