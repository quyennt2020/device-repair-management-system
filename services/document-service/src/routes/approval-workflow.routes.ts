import { Router } from 'express';
import { ApprovalWorkflowController } from '../controllers/approval-workflow.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const approvalWorkflowController = new ApprovalWorkflowController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Workflow Management Routes
router.post(
  '/workflows',
  [
    body('name').notEmpty().withMessage('Workflow name is required'),
    body('documentTypeIds').isArray().withMessage('Document type IDs must be an array'),
    body('levels').isArray().withMessage('Levels must be an array'),
    body('levels.*.level').isInt({ min: 1 }).withMessage('Level number must be a positive integer'),
    body('levels.*.name').notEmpty().withMessage('Level name is required'),
    body('levels.*.approverType').isIn(['user', 'role', 'manager', 'department_head', 'custom']).withMessage('Invalid approver type'),
    body('levels.*.requiredApprovals').isInt({ min: 1 }).withMessage('Required approvals must be at least 1'),
    body('levels.*.isParallel').isBoolean().withMessage('isParallel must be a boolean'),
    validationMiddleware
  ],
  approvalWorkflowController.createWorkflow
);

router.get(
  '/workflows/:id',
  [
    param('id').isUUID().withMessage('Invalid workflow ID'),
    validationMiddleware
  ],
  approvalWorkflowController.getWorkflow
);

router.put(
  '/workflows/:id',
  [
    param('id').isUUID().withMessage('Invalid workflow ID'),
    body('name').optional().notEmpty().withMessage('Workflow name cannot be empty'),
    body('documentTypeIds').optional().isArray().withMessage('Document type IDs must be an array'),
    body('levels').optional().isArray().withMessage('Levels must be an array'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    validationMiddleware
  ],
  approvalWorkflowController.updateWorkflow
);

router.delete(
  '/workflows/:id',
  [
    param('id').isUUID().withMessage('Invalid workflow ID'),
    validationMiddleware
  ],
  approvalWorkflowController.deleteWorkflow
);

router.get(
  '/workflows',
  [
    query('name').optional().isString().withMessage('Name must be a string'),
    query('documentTypeId').optional().isUUID().withMessage('Invalid document type ID'),
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validationMiddleware
  ],
  approvalWorkflowController.searchWorkflows
);

// Document Approval Process Routes
router.post(
  '/documents/:documentId/submit-for-approval',
  [
    param('documentId').isUUID().withMessage('Invalid document ID'),
    body('comments').optional().isString().withMessage('Comments must be a string'),
    body('urgency').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid urgency level'),
    validationMiddleware
  ],
  approvalWorkflowController.submitForApproval
);

router.post(
  '/instances/:instanceId/process',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('level').isInt({ min: 1 }).withMessage('Level must be a positive integer'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('comments').optional().isString().withMessage('Comments must be a string'),
    validationMiddleware
  ],
  approvalWorkflowController.processApproval
);

router.post(
  '/instances/:instanceId/delegate',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('level').isInt({ min: 1 }).withMessage('Level must be a positive integer'),
    body('toUserId').isUUID().withMessage('Invalid user ID for delegation'),
    body('reason').optional().isString().withMessage('Reason must be a string'),
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
    validationMiddleware
  ],
  approvalWorkflowController.delegateApproval
);

router.post(
  '/instances/:instanceId/escalate',
  [
    param('instanceId').isUUID().withMessage('Invalid instance ID'),
    body('fromLevel').isInt({ min: 1 }).withMessage('From level must be a positive integer'),
    body('toLevel').isInt({ min: 1 }).withMessage('To level must be a positive integer'),
    body('reason').notEmpty().withMessage('Escalation reason is required'),
    validationMiddleware
  ],
  approvalWorkflowController.escalateApproval
);

// Query Routes
router.get(
  '/instances',
  [
    query('documentId').optional().isUUID().withMessage('Invalid document ID'),
    query('workflowId').optional().isUUID().withMessage('Invalid workflow ID'),
    query('status').optional().isIn(['pending', 'in_progress', 'approved', 'rejected', 'escalated', 'cancelled']).withMessage('Invalid status'),
    query('currentLevel').optional().isInt({ min: 1 }).withMessage('Current level must be a positive integer'),
    query('submittedBy').optional().isUUID().withMessage('Invalid submitter ID'),
    query('approverUserId').optional().isUUID().withMessage('Invalid approver ID'),
    query('startedAfter').optional().isISO8601().withMessage('Invalid start date'),
    query('startedBefore').optional().isISO8601().withMessage('Invalid end date'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validationMiddleware
  ],
  approvalWorkflowController.searchApprovalInstances
);

router.get(
  '/pending-approvals',
  [
    query('workflowId').optional().isUUID().withMessage('Invalid workflow ID'),
    query('urgency').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid urgency level'),
    query('level').optional().isInt({ min: 1 }).withMessage('Level must be a positive integer'),
    query('submittedAfter').optional().isISO8601().withMessage('Invalid start date'),
    query('submittedBefore').optional().isISO8601().withMessage('Invalid end date'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    validationMiddleware
  ],
  approvalWorkflowController.getPendingApprovals
);

router.get(
  '/documents/:documentId/approval-history',
  [
    param('documentId').isUUID().withMessage('Invalid document ID'),
    validationMiddleware
  ],
  approvalWorkflowController.getApprovalHistory
);

export default router;