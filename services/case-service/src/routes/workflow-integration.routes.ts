import { Router } from 'express';
import { WorkflowIntegrationController } from '../controllers/workflow-integration.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const controller = new WorkflowIntegrationController();

// Validation schemas
const workflowEventValidation = [
  body('type').notEmpty().withMessage('Event type is required'),
  body('payload').isObject().withMessage('Event payload must be an object'),
  body('timestamp').optional().isISO8601().withMessage('Invalid timestamp format')
];

const completeStepValidation = [
  param('caseId').isUUID().withMessage('Invalid case ID'),
  body('stepId').notEmpty().withMessage('Step ID is required'),
  body('result').isObject().withMessage('Result must be an object'),
  body('result.status').isIn(['completed', 'failed', 'skipped']).withMessage('Invalid result status'),
  body('completedBy').optional().isUUID().withMessage('Invalid completedBy ID')
];

const escalationValidation = [
  param('caseId').isUUID().withMessage('Invalid case ID'),
  body('escalationType').optional().isIn(['warning', 'critical', 'breach']).withMessage('Invalid escalation type'),
  body('reason').optional().isString().withMessage('Reason must be a string')
];

const completeCaseValidation = [
  param('caseId').isUUID().withMessage('Invalid case ID'),
  body('completionData').optional().isObject().withMessage('Completion data must be an object')
];

const configurationQueryValidation = [
  query('deviceType').notEmpty().withMessage('Device type is required'),
  query('serviceType').notEmpty().withMessage('Service type is required'),
  query('customerTier').notEmpty().withMessage('Customer tier is required'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
];

const startWorkflowValidation = [
  param('caseId').isUUID().withMessage('Invalid case ID'),
  body('deviceType').notEmpty().withMessage('Device type is required'),
  body('serviceType').notEmpty().withMessage('Service type is required'),
  body('customerTier').notEmpty().withMessage('Customer tier is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('customerId').optional().isUUID().withMessage('Invalid customer ID'),
  body('deviceId').optional().isUUID().withMessage('Invalid device ID')
];

const stepReadyValidation = [
  body('instanceId').isUUID().withMessage('Invalid instance ID'),
  body('stepId').notEmpty().withMessage('Step ID is required'),
  body('stepConfig').optional().isObject().withMessage('Step config must be an object')
];

// Routes

/**
 * @route POST /api/workflow/events
 * @desc Handle workflow events from workflow service
 * @access System (no auth required for service-to-service communication)
 */
router.post('/events', workflowEventValidation, validateRequest, controller.handleWorkflowEvent);

/**
 * @route POST /api/workflow/step-ready
 * @desc Handle workflow step ready notification from workflow service
 * @access System (no auth required for service-to-service communication)
 */
router.post('/step-ready', stepReadyValidation, validateRequest, controller.handleStepReady);

/**
 * @route POST /api/cases/:caseId/workflow/step/complete
 * @desc Complete a workflow step
 * @access Private
 */
router.post(
  '/cases/:caseId/workflow/step/complete',
  authMiddleware,
  completeStepValidation,
  validateRequest,
  controller.completeWorkflowStep
);

/**
 * @route GET /api/cases/:caseId/workflow/status
 * @desc Get workflow status for a case
 * @access Private
 */
router.get(
  '/cases/:caseId/workflow/status',
  authMiddleware,
  [param('caseId').isUUID().withMessage('Invalid case ID')],
  validateRequest,
  controller.getWorkflowStatus
);

/**
 * @route GET /api/cases/:caseId/workflow/instance
 * @desc Get workflow instance details for a case
 * @access Private
 */
router.get(
  '/cases/:caseId/workflow/instance',
  authMiddleware,
  [param('caseId').isUUID().withMessage('Invalid case ID')],
  validateRequest,
  controller.getWorkflowInstance
);

/**
 * @route POST /api/cases/:caseId/workflow/escalate
 * @desc Trigger case escalation
 * @access Private
 */
router.post(
  '/cases/:caseId/workflow/escalate',
  authMiddleware,
  escalationValidation,
  validateRequest,
  controller.triggerEscalation
);

/**
 * @route POST /api/cases/:caseId/workflow/complete
 * @desc Complete case with workflow closure
 * @access Private
 */
router.post(
  '/cases/:caseId/workflow/complete',
  authMiddleware,
  completeCaseValidation,
  validateRequest,
  controller.completeCase
);

/**
 * @route GET /api/cases/:caseId/sla/status
 * @desc Check SLA compliance for a case
 * @access Private
 */
router.get(
  '/cases/:caseId/sla/status',
  authMiddleware,
  [param('caseId').isUUID().withMessage('Invalid case ID')],
  validateRequest,
  controller.checkSLACompliance
);

/**
 * @route POST /api/sla/monitor
 * @desc Monitor SLA compliance for all active cases
 * @access Private (Admin only)
 */
router.post('/sla/monitor', authMiddleware, controller.monitorSLACompliance);

/**
 * @route GET /api/workflow/configuration
 * @desc Get workflow configuration for case criteria
 * @access Private
 */
router.get(
  '/workflow/configuration',
  authMiddleware,
  configurationQueryValidation,
  validateRequest,
  controller.getWorkflowConfiguration
);

/**
 * @route POST /api/cases/:caseId/workflow/start
 * @desc Start workflow for existing case
 * @access Private
 */
router.post(
  '/cases/:caseId/workflow/start',
  authMiddleware,
  startWorkflowValidation,
  validateRequest,
  controller.startWorkflow
);

export default router;