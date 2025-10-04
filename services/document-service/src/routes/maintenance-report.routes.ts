import { Router } from 'express';
import { MaintenanceReportController } from '../controllers/maintenance-report.controller';
import { MaintenanceReportService } from '../services/maintenance-report.service';
import { MaintenanceReportRepository } from '../repositories/maintenance-report.repository';
import { MaintenanceChecklistTemplateRepository } from '../repositories/maintenance-checklist-template.repository';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { pool } from '../../../../shared/database/src/connection';

// Initialize dependencies
const maintenanceReportRepository = new MaintenanceReportRepository(pool);
const templateRepository = new MaintenanceChecklistTemplateRepository(pool);
const maintenanceReportService = new MaintenanceReportService(
  maintenanceReportRepository,
  templateRepository
);
const maintenanceReportController = new MaintenanceReportController(maintenanceReportService);

const router = Router();

// Validation schemas
const createMaintenanceReportSchema = {
  type: 'object',
  required: ['documentId', 'maintenanceType', 'checklistTemplateId', 'actualHours', 'technicianNotes'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    maintenanceType: { type: 'string', enum: ['preventive', 'corrective', 'emergency'] },
    checklistTemplateId: { type: 'string', format: 'uuid' },
    actualHours: { type: 'number', minimum: 0 },
    technicianNotes: { type: 'string', minLength: 1 },
    customerFeedback: { type: 'string' }
  },
  additionalProperties: false
};

const updateMaintenanceReportSchema = {
  type: 'object',
  properties: {
    checklistItems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['itemId'],
        properties: {
          itemId: { type: 'string' },
          status: { type: 'string', enum: ['pass', 'fail', 'na', 'pending'] },
          actualValue: { type: 'string' },
          notes: { type: 'string' },
          images: {
            type: 'array',
            items: {
              type: 'object',
              required: ['fileName', 'url'],
              properties: {
                fileName: { type: 'string' },
                url: { type: 'string' },
                caption: { type: 'string' },
                imageType: { type: 'string', enum: ['before', 'during', 'after'] }
              }
            }
          },
          completedAt: { type: 'string', format: 'date-time' },
          completedBy: { type: 'string', format: 'uuid' }
        }
      }
    },
    overallCondition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'critical'] },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['priority', 'category', 'description'],
        properties: {
          priority: { type: 'string', enum: ['immediate', 'high', 'medium', 'low'] },
          category: { type: 'string', enum: ['safety', 'performance', 'efficiency', 'compliance'] },
          description: { type: 'string', minLength: 1 },
          estimatedCost: { type: 'number', minimum: 0 },
          estimatedHours: { type: 'number', minimum: 0 },
          dueDate: { type: 'string', format: 'date' },
          partIds: { type: 'array', items: { type: 'string', format: 'uuid' } }
        }
      }
    },
    nextMaintenanceDate: { type: 'string', format: 'date' },
    maintenanceFrequencyMonths: { type: 'integer', minimum: 1 },
    actualHours: { type: 'number', minimum: 0 },
    materialsUsed: {
      type: 'array',
      items: {
        type: 'object',
        required: ['materialId', 'materialName', 'quantity', 'unitCost', 'totalCost'],
        properties: {
          materialId: { type: 'string', format: 'uuid' },
          materialName: { type: 'string', minLength: 1 },
          quantity: { type: 'number', minimum: 0 },
          unitCost: { type: 'number', minimum: 0 },
          totalCost: { type: 'number', minimum: 0 },
          notes: { type: 'string' }
        }
      }
    },
    technicianNotes: { type: 'string' },
    customerFeedback: { type: 'string' }
  },
  additionalProperties: false
};

const updateChecklistItemSchema = {
  type: 'object',
  required: ['itemId'],
  properties: {
    itemId: { type: 'string' },
    status: { type: 'string', enum: ['pass', 'fail', 'na', 'pending'] },
    actualValue: { type: 'string' },
    notes: { type: 'string' },
    images: {
      type: 'array',
      items: {
        type: 'object',
        required: ['fileName', 'url'],
        properties: {
          fileName: { type: 'string' },
          url: { type: 'string' },
          caption: { type: 'string' },
          imageType: { type: 'string', enum: ['before', 'during', 'after'] }
        }
      }
    },
    completedAt: { type: 'string', format: 'date-time' },
    completedBy: { type: 'string', format: 'uuid' }
  },
  additionalProperties: false
};

const bulkUpdateChecklistItemsSchema = {
  type: 'object',
  required: ['reportId', 'updates'],
  properties: {
    reportId: { type: 'string', format: 'uuid' },
    updates: {
      type: 'array',
      items: updateChecklistItemSchema
    }
  },
  additionalProperties: false
};

const maintenanceScheduleSchema = {
  type: 'object',
  required: ['deviceId', 'maintenanceType'],
  properties: {
    deviceId: { type: 'string', format: 'uuid' },
    maintenanceType: { type: 'string', enum: ['preventive', 'corrective', 'emergency'] },
    baseDate: { type: 'string', format: 'date' },
    frequencyMonths: { type: 'integer', minimum: 1 },
    condition: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'critical'] }
  },
  additionalProperties: false
};

// Routes
router.post(
  '/',
  authMiddleware,
  validationMiddleware(createMaintenanceReportSchema),
  (req, res) => maintenanceReportController.createMaintenanceReport(req, res)
);

router.get(
  '/search',
  authMiddleware,
  (req, res) => maintenanceReportController.searchMaintenanceReports(req, res)
);

router.get(
  '/analytics',
  authMiddleware,
  (req, res) => maintenanceReportController.getMaintenanceAnalytics(req, res)
);

router.get(
  '/:id',
  authMiddleware,
  (req, res) => maintenanceReportController.getMaintenanceReport(req, res)
);

router.get(
  '/document/:documentId',
  authMiddleware,
  (req, res) => maintenanceReportController.getMaintenanceReportByDocumentId(req, res)
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateMaintenanceReportSchema),
  (req, res) => maintenanceReportController.updateMaintenanceReport(req, res)
);

router.put(
  '/:id/checklist-item',
  authMiddleware,
  validationMiddleware(updateChecklistItemSchema),
  (req, res) => maintenanceReportController.updateChecklistItem(req, res)
);

router.put(
  '/checklist-items/bulk-update',
  authMiddleware,
  validationMiddleware(bulkUpdateChecklistItemsSchema),
  (req, res) => maintenanceReportController.bulkUpdateChecklistItems(req, res)
);

router.get(
  '/:id/validate',
  authMiddleware,
  (req, res) => maintenanceReportController.validateMaintenanceReport(req, res)
);

router.post(
  '/calculate-next-maintenance',
  authMiddleware,
  validationMiddleware(maintenanceScheduleSchema),
  (req, res) => maintenanceReportController.calculateNextMaintenanceDate(req, res)
);

router.delete(
  '/:id',
  authMiddleware,
  (req, res) => maintenanceReportController.deleteMaintenanceReport(req, res)
);

export default router;