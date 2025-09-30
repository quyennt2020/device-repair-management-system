import { Router } from 'express';
import { WorkflowVisualizationService } from '../services/workflow-visualization.service';
import { authenticateToken, requirePermissions } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { param, query } from 'express-validator';

const router = Router();
const visualizationService = new WorkflowVisualizationService();

// All routes require authentication
router.use(authenticateToken);

// Get workflow definition visualization
router.get('/definitions/:id/visualization',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const visualization = await visualizationService.generateDefinitionVisualization(id);

      res.json({
        success: true,
        data: visualization
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow instance visualization
router.get('/instances/:id/visualization',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const visualization = await visualizationService.generateInstanceVisualization(id);

      res.json({
        success: true,
        data: visualization
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get execution path visualization
router.get('/instances/:id/execution-path',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const visualization = await visualizationService.generateExecutionPathVisualization(id);

      res.json({
        success: true,
        data: visualization
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get performance heatmap
router.get('/definitions/:id/performance-heatmap',
  requirePermissions(['workflows.read']),
  [
    param('id').isUUID(),
    query('timeRange').optional().isIn(['day', 'week', 'month']).withMessage('Invalid time range')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
      
      const heatmap = await visualizationService.generatePerformanceHeatmap(id, timeRange);

      res.json({
        success: true,
        data: heatmap
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export visualization as SVG
router.get('/instances/:id/export/svg',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const visualization = await visualizationService.generateInstanceVisualization(id);
      const svg = await visualizationService.exportVisualizationAsSVG(visualization);

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="workflow-${id}.svg"`);
      res.send(svg);
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowVisualizationRoutes };