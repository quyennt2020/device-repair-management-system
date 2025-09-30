import { Router } from 'express';
import { WorkflowConfigurationService } from '../services/workflow-configuration.service';
import { authenticateToken, requirePermissions } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const configurationService = new WorkflowConfigurationService();

// All routes require authentication
router.use(authenticateToken);

// Get configurations with filtering
router.get('/',
  requirePermissions(['workflows.read']),
  [
    query('deviceType').optional().isString(),
    query('serviceType').optional().isString(),
    query('customerTier').optional().isString(),
    query('workflowDefinitionId').optional().isUUID(),
    query('isActive').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const filters = {
        deviceType: req.query.deviceType as string,
        serviceType: req.query.serviceType as string,
        customerTier: req.query.customerTier as string,
        workflowDefinitionId: req.query.workflowDefinitionId as string,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };

      const result = await configurationService.getConfigurations(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get configuration by ID
router.get('/:id',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const configuration = await configurationService.getConfigurationById(id);

      if (!configuration) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONFIGURATION_NOT_FOUND',
            message: 'Workflow configuration not found'
          }
        });
      }

      res.json({
        success: true,
        data: configuration
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create configuration
router.post('/',
  requirePermissions(['workflows.create']),
  [
    body('name').isString().isLength({ min: 1, max: 255 }).withMessage('Name is required'),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('deviceTypes').isArray({ min: 1 }).withMessage('At least one device type is required'),
    body('serviceTypes').isArray({ min: 1 }).withMessage('At least one service type is required'),
    body('customerTiers').isArray({ min: 1 }).withMessage('At least one customer tier is required'),
    body('workflowDefinitionId').isUUID().withMessage('Valid workflow definition ID is required'),
    body('priority').optional().isInt({ min: 0 }),
    body('conditions').optional().isArray(),
    body('metadata').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const createdBy = req.user!.id;
      const configuration = await configurationService.createConfiguration(req.body, createdBy);

      res.status(201).json({
        success: true,
        data: configuration,
        message: 'Workflow configuration created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update configuration
router.put('/:id',
  requirePermissions(['workflows.update']),
  [
    param('id').isUUID(),
    body('name').optional().isString().isLength({ min: 1, max: 255 }),
    body('description').optional().isString().isLength({ max: 1000 }),
    body('deviceTypes').optional().isArray({ min: 1 }),
    body('serviceTypes').optional().isArray({ min: 1 }),
    body('customerTiers').optional().isArray({ min: 1 }),
    body('workflowDefinitionId').optional().isUUID(),
    body('priority').optional().isInt({ min: 0 }),
    body('conditions').optional().isArray(),
    body('metadata').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const configuration = await configurationService.updateConfiguration(id, req.body);

      res.json({
        success: true,
        data: configuration,
        message: 'Workflow configuration updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete configuration
router.delete('/:id',
  requirePermissions(['workflows.delete']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await configurationService.deleteConfiguration(id);

      res.json({
        success: true,
        message: 'Workflow configuration deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Toggle configuration active status
router.patch('/:id/toggle',
  requirePermissions(['workflows.update']),
  [
    param('id').isUUID(),
    body('isActive').isBoolean().withMessage('isActive must be a boolean')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      await configurationService.toggleConfiguration(id, isActive);

      res.json({
        success: true,
        message: `Configuration ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      next(error);
    }
  }
);

// Select workflow configuration based on criteria
router.post('/select',
  requirePermissions(['workflows.read']),
  [
    body('deviceType').isString().withMessage('Device type is required'),
    body('serviceType').isString().withMessage('Service type is required'),
    body('customerTier').isString().withMessage('Customer tier is required'),
    body('additionalContext').optional().isObject()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const criteria = {
        deviceType: req.body.deviceType,
        serviceType: req.body.serviceType,
        customerTier: req.body.customerTier,
        additionalContext: req.body.additionalContext
      };

      const match = await configurationService.selectWorkflowConfiguration(criteria);

      if (!match) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NO_CONFIGURATION_MATCH',
            message: 'No workflow configuration matches the provided criteria'
          }
        });
      }

      res.json({
        success: true,
        data: match
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get configuration usage statistics
router.get('/:id/usage-stats',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const stats = await configurationService.getConfigurationUsageStats(id);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
);

// Validate configuration compatibility
router.get('/:id/validate',
  requirePermissions(['workflows.read']),
  [param('id').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const validation = await configurationService.validateConfigurationCompatibility(id);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  }
);

// Migrate configurations
router.post('/migrate',
  requirePermissions(['workflows.manage']),
  [
    body('fromWorkflowId').isUUID().withMessage('From workflow ID is required'),
    body('toWorkflowId').isUUID().withMessage('To workflow ID is required'),
    body('strategy').isIn(['replace', 'duplicate', 'update']).withMessage('Invalid migration strategy')
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { fromWorkflowId, toWorkflowId, strategy } = req.body;

      await configurationService.migrateConfigurations(fromWorkflowId, toWorkflowId, strategy);

      res.json({
        success: true,
        message: 'Configuration migration completed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as workflowConfigurationRoutes };