import { Router } from 'express';
import { WorkflowTemplateService } from '../services/workflow-template.service';
import { authenticateToken, requirePermissions } from '../middleware/auth.middleware';
import { validateWorkflowTemplate, handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const workflowTemplateService = new WorkflowTemplateService();

// All routes require authentication
router.use(authenticateToken);

// Get workflow templates with filtering
router.get('/',
  requirePermissions(['workflows.read']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('category').optional().isString(),
    query('deviceType').optional().isString(),
    query('serviceType').optional().isString(),
    query('customerTier').optional().isString(),
    query('isPublic').optional().isBoolean(),
    query('createdBy').optional().isUUID()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        search: req.query.search as string,
        category: req.query.category as string,
        deviceType: req.query.deviceType as string,
        serviceType: req.query.serviceType as string,
        customerTier: req.query.customerTier as string,
        isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
        createdBy: req.query.createdBy as string
      };

      const result = await workflowTemplateService.getTemplates(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get template by ID
router.get('/:id',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const template = await workflowTemplateService.getTemplate(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Workflow template not found'
          }
        });
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create workflow template
router.post('/',
  requirePermissions(['workflows.create']),
  validateWorkflowTemplate,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const createdBy = req.user!.id;
      const template = await workflowTemplateService.createTemplate(req.body, createdBy);

      res.status(201).json({
        success: true,
        data: template,
        message: 'Workflow template created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update workflow template
router.put('/:id',
  requirePermissions(['workflows.update']),
  [param('id').isUUID()],
  validateWorkflowTemplate,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updatedBy = req.user!.id;
      
      const template = await workflowTemplateService.updateTemplate(id, req.body, updatedBy);

      res.json({
        success: true,
        data: template,
        message: 'Workflow template updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete workflow template
router.delete('/:id',
  requirePermissions(['workflows.delete']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const deletedBy = req.user!.id;
      
      await workflowTemplateService.deleteTemplate(id, deletedBy);

      res.json({
        success: true,
        message: 'Workflow template deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create workflow from template
router.post('/:id/create-workflow',
  requirePermissions(['workflows.create']),
  [
    param('id').isUUID(),
    body('workflowName').isString().isLength({ min: 1, max: 255 }).trim(),
    body('customizations').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { workflowName, customizations = {} } = req.body;
      const createdBy = req.user!.id;
      
      const workflow = await workflowTemplateService.createWorkflowFromTemplate(
        id,
        workflowName,
        customizations,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: workflow,
        message: 'Workflow created from template successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get template categories
router.get('/meta/categories',
  requirePermissions(['workflows.read']),
  async (req, res, next) => {
    try {
      const categories = await workflowTemplateService.getTemplateCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get recommended templates
router.get('/recommendations/:deviceType',
  requirePermissions(['workflows.read']),
  [
    param('deviceType').isString(),
    query('serviceType').optional().isString(),
    query('customerTier').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 20 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { deviceType } = req.params;
      const serviceType = req.query.serviceType as string;
      const customerTier = req.query.customerTier as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      const recommendations = await workflowTemplateService.getRecommendedTemplates(
        deviceType,
        serviceType,
        customerTier,
        limit
      );

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowTemplateRoutes };