import { Router } from 'express';
import { WorkflowExecutionService } from '../services/workflow-execution.service';
import { WorkflowEventService } from '../services/workflow-event.service';
import { authenticateToken, requirePermissions } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const workflowExecutionService = new WorkflowExecutionService();
const workflowEventService = new WorkflowEventService();

// All routes require authentication
router.use(authenticateToken);

// Start a new workflow instance
router.post('/start',
  requirePermissions(['workflows.execute']),
  [
    body('workflowDefinitionId').isUUID().withMessage('Valid workflow definition ID is required'),
    body('caseId').isUUID().withMessage('Valid case ID is required'),
    body('context').isObject().withMessage('Context must be an object'),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { workflowDefinitionId, caseId, context, priority } = req.body;
      const startedBy = req.user!.id;

      const instance = await workflowExecutionService.startWorkflow({
        workflowDefinitionId,
        caseId,
        context,
        startedBy,
        priority
      });

      res.status(201).json({
        success: true,
        data: instance,
        message: 'Workflow started successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow instances with filtering
router.get('/instances',
  requirePermissions(['workflows.read']),
  [
    query('caseId').optional().isUUID(),
    query('workflowDefinitionId').optional().isUUID(),
    query('status').optional().isString(),
    query('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    query('startedBy').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const filters = {
        caseId: req.query.caseId as string,
        workflowDefinitionId: req.query.workflowDefinitionId as string,
        status: req.query.status as string,
        priority: req.query.priority as string,
        startedBy: req.query.startedBy as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const result = await workflowExecutionService.getWorkflowInstances(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow instance by ID
router.get('/instances/:id',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const instance = await workflowExecutionService.getWorkflowInstance(id);

      if (!instance) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'WORKFLOW_INSTANCE_NOT_FOUND',
            message: 'Workflow instance not found'
          }
        });
      }

      res.json({
        success: true,
        data: instance
      });
    } catch (error) {
      next(error);
    }
  }
);

// Execute a workflow step
router.post('/instances/:instanceId/steps/:stepInstanceId/execute',
  requirePermissions(['workflows.execute']),
  [
    param('instanceId').isUUID(),
    param('stepInstanceId').isUUID(),
    body('action').isString().withMessage('Action is required'),
    body('data').optional().isObject(),
    body('comment').optional().isString()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { instanceId, stepInstanceId } = req.params;
      const { action, data, comment } = req.body;
      const executedBy = req.user!.id;

      await workflowExecutionService.executeStep({
        instanceId,
        stepInstanceId,
        action,
        data,
        executedBy,
        comment
      });

      res.json({
        success: true,
        message: 'Step executed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Suspend workflow instance
router.patch('/instances/:id/suspend',
  requirePermissions(['workflows.manage']),
  [
    param('id').isUUID(),
    body('reason').optional().isString()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const suspendedBy = req.user!.id;

      await workflowExecutionService.suspendWorkflow(id, suspendedBy, reason);

      res.json({
        success: true,
        message: 'Workflow suspended successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Resume workflow instance
router.patch('/instances/:id/resume',
  requirePermissions(['workflows.manage']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const resumedBy = req.user!.id;

      await workflowExecutionService.resumeWorkflow(id, resumedBy);

      res.json({
        success: true,
        message: 'Workflow resumed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Cancel workflow instance
router.patch('/instances/:id/cancel',
  requirePermissions(['workflows.manage']),
  [
    param('id').isUUID(),
    body('reason').optional().isString()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const cancelledBy = req.user!.id;

      await workflowExecutionService.cancelWorkflow(id, cancelledBy, reason);

      res.json({
        success: true,
        message: 'Workflow cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow events
router.get('/instances/:id/events',
  requirePermissions(['workflows.read']),
  [
    param('id').isUUID(),
    query('eventType').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const filters = {
        workflowInstanceId: id,
        eventType: req.query.eventType as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const result = await workflowEventService.getWorkflowEvents(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow timeline
router.get('/instances/:id/timeline',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const timeline = await workflowEventService.getWorkflowTimeline(id);

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow statistics
router.get('/instances/:id/statistics',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const statistics = await workflowEventService.getWorkflowStatistics(id);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export workflow events
router.get('/instances/:id/export',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const exportData = await workflowEventService.exportWorkflowEvents(id);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="workflow-${id}-events.json"`);
      
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowExecutionRoutes };