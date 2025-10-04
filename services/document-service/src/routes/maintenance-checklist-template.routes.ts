import { Router } from 'express';
import { MaintenanceChecklistTemplateController } from '../controllers/maintenance-checklist-template.controller';
import { MaintenanceChecklistTemplateService } from '../services/maintenance-checklist-template.service';
import { MaintenanceChecklistTemplateRepository } from '../repositories/maintenance-checklist-template.repository';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { pool } from '../../../../shared/database/src/connection';

// Initialize dependencies
const templateRepository = new MaintenanceChecklistTemplateRepository(pool);
const templateService = new MaintenanceChecklistTemplateService(templateRepository);
const templateController = new MaintenanceChecklistTemplateController(templateService);

const router = Router();

// Validation schemas
const createTemplateSchema = {
  type: 'object',
  required: ['name', 'deviceTypeId', 'maintenanceType', 'checklistItems', 'estimatedDurationHours'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    deviceTypeId: { type: 'string', format: 'uuid' },
    maintenanceType: { type: 'string', enum: ['preventive', 'corrective', 'emergency'] },
    checklistItems: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['category', 'description', 'type', 'required', 'order'],
        properties: {
          category: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['visual', 'measurement', 'test', 'adjustment', 'replacement'] },
          required: { type: 'boolean' },
          order: { type: 'integer', minimum: 1 },
          expectedValue: { type: 'string', maxLength: 255 },
          tolerance: { type: 'string', maxLength: 100 },
          instructions: { type: 'string' },
          safetyNotes: { type: 'string' }
        },
        additionalProperties: false
      }
    },
    estimatedDurationHours: { type: 'number', minimum: 0.1 },
    requiredTools: { type: 'array', items: { type: 'string', format: 'uuid' } },
    requiredParts: { type: 'array', items: { type: 'string', format: 'uuid' } },
    safetyRequirements: { type: 'array', items: { type: 'string' } }
  },
  additionalProperties: false
};

const updateTemplateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    checklistItems: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['category', 'description', 'type', 'required', 'order'],
        properties: {
          category: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', minLength: 1 },
          type: { type: 'string', enum: ['visual', 'measurement', 'test', 'adjustment', 'replacement'] },
          required: { type: 'boolean' },
          order: { type: 'integer', minimum: 1 },
          expectedValue: { type: 'string', maxLength: 255 },
          tolerance: { type: 'string', maxLength: 100 },
          instructions: { type: 'string' },
          safetyNotes: { type: 'string' }
        },
        additionalProperties: false
      }
    },
    estimatedDurationHours: { type: 'number', minimum: 0.1 },
    requiredTools: { type: 'array', items: { type: 'string', format: 'uuid' } },
    requiredParts: { type: 'array', items: { type: 'string', format: 'uuid' } },
    safetyRequirements: { type: 'array', items: { type: 'string' } },
    isActive: { type: 'boolean' }
  },
  additionalProperties: false
};

const duplicateTemplateSchema = {
  type: 'object',
  required: ['newName'],
  properties: {
    newName: { type: 'string', minLength: 1, maxLength: 255 }
  },
  additionalProperties: false
};

// Routes
router.post(
  '/',
  authMiddleware,
  validationMiddleware(createTemplateSchema),
  (req, res) => templateController.createTemplate(req, res)
);

router.get(
  '/search',
  authMiddleware,
  (req, res) => templateController.searchTemplates(req, res)
);

router.get(
  '/device/:deviceTypeId/:maintenanceType/active',
  authMiddleware,
  (req, res) => templateController.getActiveTemplateForDevice(req, res)
);

router.get(
  '/device/:deviceTypeId/:maintenanceType',
  authMiddleware,
  (req, res) => templateController.getTemplatesForDevice(req, res)
);

router.get(
  '/device/:deviceTypeId/:maintenanceType/versions',
  authMiddleware,
  (req, res) => templateController.getTemplateVersions(req, res)
);

router.get(
  '/compare/:oldTemplateId/:newTemplateId',
  authMiddleware,
  (req, res) => templateController.compareTemplateVersions(req, res)
);

router.get(
  '/:id',
  authMiddleware,
  (req, res) => templateController.getTemplate(req, res)
);

router.get(
  '/:id/usage-stats',
  authMiddleware,
  (req, res) => templateController.getTemplateUsageStats(req, res)
);

router.get(
  '/:id/validate',
  authMiddleware,
  (req, res) => templateController.validateTemplate(req, res)
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateTemplateSchema),
  (req, res) => templateController.updateTemplate(req, res)
);

router.post(
  '/:id/new-version',
  authMiddleware,
  (req, res) => templateController.createNewVersion(req, res)
);

router.post(
  '/:id/duplicate',
  authMiddleware,
  validationMiddleware(duplicateTemplateSchema),
  (req, res) => templateController.duplicateTemplate(req, res)
);

router.put(
  '/:id/activate',
  authMiddleware,
  (req, res) => templateController.activateTemplate(req, res)
);

router.put(
  '/:id/deactivate',
  authMiddleware,
  (req, res) => templateController.deactivateTemplate(req, res)
);

router.delete(
  '/:id',
  authMiddleware,
  (req, res) => templateController.deleteTemplate(req, res)
);

export default router;