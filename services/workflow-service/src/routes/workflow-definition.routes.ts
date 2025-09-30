import { Router } from 'express';
import { WorkflowDefinitionService } from '../services/workflow-definition.service';
import { authenticateToken, requirePermissions, requireRoles } from '../middleware/auth.middleware';
import { validateWorkflowDefinition, handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const workflowDefinitionService = new WorkflowDefinitionService();

// All routes require authentication
router.use(authenticateToken);

// Get workflow definitions with filtering
router.get('/',
  requirePermissions(['workflows.read']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('deviceType').optional().isString(),
    query('serviceType').optional().isString(),
    query('customerTier').optional().isString(),
    query('status').optional().isIn(['draft', 'active', 'archived']),
    query('createdBy').optional().isUUID(),
    query('createdAfter').optional().isISO8601(),
    query('createdBefore').optional().isISO8601()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        search: req.query.search as string,
        deviceType: req.query.deviceType as string,
        serviceType: req.query.serviceType as string,
        customerTier: req.query.customerTier as string,
        status: req.query.status as 'draft' | 'active' | 'archived',
        createdBy: req.query.createdBy as string,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined
      };

      const result = await workflowDefinitionService.getWorkflowDefinitions(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow definition by ID
router.get('/:id',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const workflow = await workflowDefinitionService.getWorkflowDefinition(id);

      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'WORKFLOW_NOT_FOUND',
            message: 'Workflow definition not found'
          }
        });
      }

      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create workflow definition
router.post('/',
  requirePermissions(['workflows.create']),
  validateWorkflowDefinition,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const createdBy = req.user!.id;
      const workflow = await workflowDefinitionService.createWorkflowDefinition(req.body, createdBy);

      res.status(201).json({
        success: true,
        data: workflow,
        message: 'Workflow definition created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update workflow definition
router.put('/:id',
  requirePermissions(['workflows.update']),
  [param('id').isUUID()],
  validateWorkflowDefinition,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updatedBy = req.user!.id;
      
      const workflow = await workflowDefinitionService.updateWorkflowDefinition(id, req.body, updatedBy);

      res.json({
        success: true,
        data: workflow,
        message: 'Workflow definition updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete workflow definition
router.delete('/:id',
  requirePermissions(['workflows.delete']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await workflowDefinitionService.deleteWorkflowDefinition(id);

      res.json({
        success: true,
        message: 'Workflow definition deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Activate workflow definition
router.patch('/:id/activate',
  requirePermissions(['workflows.activate']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const activatedBy = req.user!.id;
      
      await workflowDefinitionService.activateWorkflowDefinition(id, activatedBy);

      res.json({
        success: true,
        message: 'Workflow definition activated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Archive workflow definition
router.patch('/:id/archive',
  requirePermissions(['workflows.archive']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const archivedBy = req.user!.id;
      
      await workflowDefinitionService.archiveWorkflowDefinition(id, archivedBy);

      res.json({
        success: true,
        message: 'Workflow definition archived successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Clone workflow definition
router.post('/:id/clone',
  requirePermissions(['workflows.create']),
  [
    param('id').isUUID(),
    body('name').isString().isLength({ min: 1, max: 255 }).trim()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const clonedBy = req.user!.id;
      
      const clonedWorkflow = await workflowDefinitionService.cloneWorkflowDefinition(id, name, clonedBy);

      res.status(201).json({
        success: true,
        data: clonedWorkflow,
        message: 'Workflow definition cloned successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get workflow versions
router.get('/:id/versions',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const versions = await workflowDefinitionService.getWorkflowVersions(id);

      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      next(error);
    }
  }
);

// Validate workflow definition
router.post('/validate',
  requirePermissions(['workflows.read']),
  validateWorkflowDefinition,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      // If validation middleware passes, the workflow is valid
      res.json({
        success: true,
        message: 'Workflow definition is valid',
        data: {
          valid: true,
          errors: []
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowDefinitionRoutes };