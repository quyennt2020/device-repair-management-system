import { Router } from 'express';
import { WorkflowMonitoringService } from '../services/workflow-monitoring.service';
import { authenticateToken, requirePermissions } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { query } from 'express-validator';

const router = Router();
const monitoringService = new WorkflowMonitoringService();

// All routes require authentication
router.use(authenticateToken);

// Get workflow metrics
router.get('/metrics',
  requirePermissions(['workflows.read']),
  [
    query('timeRange').optional().isIn(['day', 'week', 'month']).withMessage('Invalid time range')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
      const metrics = await monitoringService.getWorkflowMetrics(timeRange);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get step performance metrics
router.get('/step-performance',
  requirePermissions(['workflows.read']),
  [
    query('timeRange').optional().isIn(['day', 'week', 'month']).withMessage('Invalid time range')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
      const metrics = await monitoringService.getStepPerformanceMetrics(timeRange);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow trends
router.get('/trends',
  requirePermissions(['workflows.read']),
  [
    query('timeRange').optional().isIn(['day', 'week', 'month']).withMessage('Invalid time range')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
      const trends = await monitoringService.getWorkflowTrends(timeRange);

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get active workflows
router.get('/active',
  requirePermissions(['workflows.read']),
  async (req, res, next) => {
    try {
      const activeWorkflows = await monitoringService.getActiveWorkflows();

      res.json({
        success: true,
        data: activeWorkflows
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow health status
router.get('/health',
  requirePermissions(['workflows.read']),
  async (req, res, next) => {
    try {
      const health = await monitoringService.getWorkflowHealth();

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowMonitoringRoutes };