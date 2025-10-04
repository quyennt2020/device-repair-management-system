import { Router } from 'express';
import { RepairReportController } from '../controllers/repair-report.controller';
import { RepairReportService } from '../services/repair-report.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { Pool } from 'pg';

export function createRepairReportRoutes(db: Pool): Router {
  const router = Router();
  const repairReportService = new RepairReportService(db);
  const repairReportController = new RepairReportController(repairReportService);

  // Validation schemas for repair report operations
  const createRepairReportSchema = {
    type: 'object',
    required: ['documentId', 'actualHours', 'technicianNotes'],
    properties: {
      documentId: { type: 'string', format: 'uuid' },
      partsReplaced: {
        type: 'array',
        items: {
          type: 'object',
          required: ['partId', 'partName', 'quantity', 'replacementReason', 'warrantyMonths'],
          properties: {
            partId: { type: 'string', format: 'uuid' },
            partName: { type: 'string', minLength: 1 },
            quantity: { type: 'number', minimum: 1 },
            serialNumbers: { type: 'array', items: { type: 'string' } },
            oldPartCondition: { type: 'string' },
            replacementReason: { type: 'string', minLength: 1 },
            warrantyMonths: { type: 'number', minimum: 0 }
          }
        }
      },
      proceduresPerformed: {
        type: 'array',
        items: {
          type: 'object',
          required: ['procedureType', 'description', 'duration', 'result'],
          properties: {
            procedureType: { 
              type: 'string', 
              enum: ['calibration', 'adjustment', 'cleaning', 'testing', 'repair', 'replacement'] 
            },
            description: { type: 'string', minLength: 1 },
            duration: { type: 'number', minimum: 0 },
            result: { type: 'string', enum: ['successful', 'partial', 'failed'] },
            notes: { type: 'string' }
          }
        }
      },
      actualHours: { type: 'number', minimum: 0 },
      testResults: {
        type: 'array',
        items: {
          type: 'object',
          required: ['testName', 'expectedValue', 'actualValue', 'result'],
          properties: {
            testName: { type: 'string', minLength: 1 },
            expectedValue: { type: 'string', minLength: 1 },
            actualValue: { type: 'string', minLength: 1 },
            result: { type: 'string', enum: ['pass', 'fail'] },
            notes: { type: 'string' }
          }
        }
      },
      technicianNotes: { type: 'string', minLength: 1 },
      beforeImages: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fileName', 'url'],
          properties: {
            fileName: { type: 'string', minLength: 1 },
            url: { type: 'string', format: 'uri' },
            caption: { type: 'string' },
            imageType: { type: 'string', enum: ['before', 'during', 'after'] }
          }
        }
      },
      afterImages: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fileName', 'url'],
          properties: {
            fileName: { type: 'string', minLength: 1 },
            url: { type: 'string', format: 'uri' },
            caption: { type: 'string' },
            imageType: { type: 'string', enum: ['before', 'during', 'after'] }
          }
        }
      }
    }
  };

  const updateRepairReportSchema = {
    type: 'object',
    properties: {
      partsReplaced: {
        type: 'array',
        items: {
          type: 'object',
          required: ['partId', 'partName', 'quantity', 'replacementReason', 'warrantyMonths'],
          properties: {
            partId: { type: 'string', format: 'uuid' },
            partName: { type: 'string', minLength: 1 },
            quantity: { type: 'number', minimum: 1 },
            serialNumbers: { type: 'array', items: { type: 'string' } },
            oldPartCondition: { type: 'string' },
            replacementReason: { type: 'string', minLength: 1 },
            warrantyMonths: { type: 'number', minimum: 0 }
          }
        }
      },
      proceduresPerformed: {
        type: 'array',
        items: {
          type: 'object',
          required: ['procedureType', 'description', 'duration', 'result'],
          properties: {
            procedureType: { 
              type: 'string', 
              enum: ['calibration', 'adjustment', 'cleaning', 'testing', 'repair', 'replacement'] 
            },
            description: { type: 'string', minLength: 1 },
            duration: { type: 'number', minimum: 0 },
            result: { type: 'string', enum: ['successful', 'partial', 'failed'] },
            notes: { type: 'string' }
          }
        }
      },
      actualHours: { type: 'number', minimum: 0 },
      testResults: {
        type: 'array',
        items: {
          type: 'object',
          required: ['testName', 'expectedValue', 'actualValue', 'result'],
          properties: {
            testName: { type: 'string', minLength: 1 },
            expectedValue: { type: 'string', minLength: 1 },
            actualValue: { type: 'string', minLength: 1 },
            result: { type: 'string', enum: ['pass', 'fail'] },
            notes: { type: 'string' }
          }
        }
      },
      technicianNotes: { type: 'string', minLength: 1 },
      beforeImages: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fileName', 'url'],
          properties: {
            fileName: { type: 'string', minLength: 1 },
            url: { type: 'string', format: 'uri' },
            caption: { type: 'string' },
            imageType: { type: 'string', enum: ['before', 'during', 'after'] }
          }
        }
      },
      afterImages: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fileName', 'url'],
          properties: {
            fileName: { type: 'string', minLength: 1 },
            url: { type: 'string', format: 'uri' },
            caption: { type: 'string' },
            imageType: { type: 'string', enum: ['before', 'during', 'after'] }
          }
        }
      },
      customerSatisfactionRating: { type: 'number', minimum: 1, maximum: 5 }
    }
  };

  const customerSatisfactionSchema = {
    type: 'object',
    required: ['rating'],
    properties: {
      rating: { type: 'number', minimum: 1, maximum: 5 },
      comments: { type: 'string' },
      wouldRecommend: { type: 'boolean' },
      serviceAspects: {
        type: 'array',
        items: {
          type: 'object',
          required: ['aspect', 'rating'],
          properties: {
            aspect: { 
              type: 'string', 
              enum: ['timeliness', 'quality', 'communication', 'professionalism', 'value'] 
            },
            rating: { type: 'number', minimum: 1, maximum: 5 },
            comments: { type: 'string' }
          }
        }
      }
    }
  };

  // Apply authentication middleware to all routes
  router.use(authMiddleware);

  // Create repair report
  router.post(
    '/',
    validationMiddleware(createRepairReportSchema),
    (req, res) => repairReportController.createRepairReport(req, res)
  );

  // Get repair report by ID
  router.get(
    '/:id',
    (req, res) => repairReportController.getRepairReport(req, res)
  );

  // Get repair report by document ID
  router.get(
    '/document/:documentId',
    (req, res) => repairReportController.getRepairReportByDocumentId(req, res)
  );

  // Update repair report
  router.put(
    '/:id',
    validationMiddleware(updateRepairReportSchema),
    (req, res) => repairReportController.updateRepairReport(req, res)
  );

  // Search repair reports
  router.get(
    '/',
    (req, res) => repairReportController.searchRepairReports(req, res)
  );

  // Delete repair report
  router.delete(
    '/:id',
    (req, res) => repairReportController.deleteRepairReport(req, res)
  );

  // Perform quality check
  router.post(
    '/:id/quality-check',
    (req, res) => repairReportController.performQualityCheck(req, res)
  );

  // Record customer satisfaction
  router.post(
    '/:id/customer-satisfaction',
    validationMiddleware(customerSatisfactionSchema),
    (req, res) => repairReportController.recordCustomerSatisfaction(req, res)
  );

  // Get customer feedback summary
  router.get(
    '/analytics/customer-feedback',
    (req, res) => repairReportController.getCustomerFeedbackSummary(req, res)
  );

  // Get repair report analytics
  router.get(
    '/analytics/reports',
    (req, res) => repairReportController.getRepairReportAnalytics(req, res)
  );

  return router;
}