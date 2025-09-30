import { Router } from 'express';
import { WorkflowDebuggingService } from '../services/workflow-debugging.service';
import { WorkflowAlertingService } from '../services/workflow-alerting.service';
import { authenticateToken, requirePermissions } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const debuggingService = new WorkflowDebuggingService();
const alertingService = new WorkflowAlertingService();

// All routes require authentication
router.use(authenticateToken);

// Get workflow diagnostics
router.get('/instances/:id/diagnostics',
  requirePermissions(['workflows.debug']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const diagnostics = await debuggingService.getWorkflowDiagnostics(id);

      res.json({
        success: true,
        data: diagnostics
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get execution timeline
router.get('/instances/:id/timeline',
  requirePermissions(['workflows.debug']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const timeline = await debuggingService.getExecutionTimeline(id);

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      next(error);
    }
  }
);

// Force complete a step
router.post('/instances/:instanceId/steps/:stepId/force-complete',
  requirePermissions(['workflows.manage']),
  [
    param('instanceId').isUUID(),
    param('stepId').isUUID(),
    body('reason').isString().isLength({ min: 1 }).withMessage('Reason is required')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { instanceId, stepId } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;

      await debuggingService.forceCompleteStep(instanceId, stepId, reason, userId);

      res.json({
        success: true,
        message: 'Step force completed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Skip a step
router.post('/instances/:instanceId/steps/:stepId/skip',
  requirePermissions(['workflows.manage']),
  [
    param('instanceId').isUUID(),
    param('stepId').isUUID(),
    body('reason').isString().isLength({ min: 1 }).withMessage('Reason is required')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { instanceId, stepId } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;

      await debuggingService.skipStep(instanceId, stepId, reason, userId);

      res.json({
        success: true,
        message: 'Step skipped successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Retry a failed step
router.post('/instances/:instanceId/steps/:stepId/retry',
  requirePermissions(['workflows.manage']),
  [
    param('instanceId').isUUID(),
    param('stepId').isUUID()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { instanceId, stepId } = req.params;
      const userId = req.user!.id;

      await debuggingService.retryStep(instanceId, stepId, userId);

      res.json({
        success: true,
        message: 'Step retry initiated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Alert Rules Management

// Get alert rules
router.get('/alert-rules',
  requirePermissions(['workflows.manage']),
  async (req, res, next) => {
    try {
      const rules = await alertingService.getAlertRules();

      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create alert rule
router.post('/alert-rules',
  requirePermissions(['workflows.manage']),
  [
    body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required'),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('type').isIn(['timeout', 'error', 'performance', 'stuck', 'custom']).withMessage('Invalid alert type'),
    body('conditions').isArray().withMessage('Conditions must be an array'),
    body('actions').isArray().withMessage('Actions must be an array'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    body('cooldownMinutes').isInt({ min: 1 }).withMessage('Cooldown must be a positive integer'),
    body('isActive').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const createdBy = req.user!.id;
      const rule = await alertingService.createAlertRule({
        ...req.body,
        createdBy
      });

      res.status(201).json({
        success: true,
        data: rule,
        message: 'Alert rule created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update alert rule
router.put('/alert-rules/:id',
  requirePermissions(['workflows.manage']),
  [
    param('id').isUUID(),
    body('name').optional().isString().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('conditions').optional().isArray(),
    body('actions').optional().isArray(),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('cooldownMinutes').optional().isInt({ min: 1 }),
    body('isActive').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const rule = await alertingService.updateAlertRule(id, req.body);

      res.json({
        success: true,
        data: rule,
        message: 'Alert rule updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete alert rule
router.delete('/alert-rules/:id',
  requirePermissions(['workflows.manage']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await alertingService.deleteAlertRule(id);

      res.json({
        success: true,
        message: 'Alert rule deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get alerts
router.get('/alerts',
  requirePermissions(['workflows.read']),
  [
    query('workflowInstanceId').optional().isUUID(),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('status').optional().isIn(['active', 'acknowledged', 'resolved']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const filters = {
        workflowInstanceId: req.query.workflowInstanceId as string,
        severity: req.query.severity as string,
        status: req.query.status as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const result = await alertingService.getAlerts(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Acknowledge alert
router.patch('/alerts/:id/acknowledge',
  requirePermissions(['workflows.manage']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await alertingService.acknowledgeAlert(id, userId);

      res.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Resolve alert
router.patch('/alerts/:id/resolve',
  requirePermissions(['workflows.manage']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await alertingService.resolveAlert(id);

      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create default alert rules
router.post('/alert-rules/defaults',
  requirePermissions(['workflows.manage']),
  async (req, res, next) => {
    try {
      const createdBy = req.user!.id;
      await alertingService.createDefaultAlertRules(createdBy);

      res.json({
        success: true,
        message: 'Default alert rules created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowDebuggingRoutes };