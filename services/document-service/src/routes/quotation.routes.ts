import { Router } from 'express';
import { QuotationController } from '../controllers/quotation.controller';
import { QuotationService } from '../services/quotation.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { Pool } from 'pg';

export function createQuotationRoutes(db: Pool): Router {
  const router = Router();
  const quotationService = new QuotationService(db);
  const quotationController = new QuotationController(quotationService);

  // Validation schemas
  const createQuotationSchema = {
    type: 'object',
    required: ['caseId', 'documentId', 'lineItems'],
    properties: {
      caseId: { type: 'string', format: 'uuid' },
      documentId: { type: 'string', format: 'uuid' },
      lineItems: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'type', 'description', 'quantity', 'unitPrice', 'totalPrice'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['part', 'labor', 'travel', 'other', 'discount', 'tax'] },
            description: { type: 'string', minLength: 1 },
            quantity: { type: 'number', minimum: 0.01 },
            unitPrice: { type: 'number', minimum: 0 },
            totalPrice: { type: 'number', minimum: 0 },
            partId: { type: 'string', format: 'uuid' },
            laborCategory: { type: 'string' },
            markupPercentage: { type: 'number', minimum: 0, maximum: 1000 },
            discountPercentage: { type: 'number', minimum: 0, maximum: 100 },
            taxRate: { type: 'number', minimum: 0, maximum: 100 },
            warrantyMonths: { type: 'integer', minimum: 0 },
            notes: { type: 'string' }
          }
        }
      },
      currency: { type: 'string', minLength: 3, maxLength: 3 },
      validityPeriod: { type: 'integer', minimum: 1, maximum: 365 },
      termsConditions: { type: 'string' },
      notes: { type: 'string' }
    }
  };

  const updateQuotationSchema = {
    type: 'object',
    properties: {
      lineItems: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'type', 'description', 'quantity', 'unitPrice', 'totalPrice'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['part', 'labor', 'travel', 'other', 'discount', 'tax'] },
            description: { type: 'string', minLength: 1 },
            quantity: { type: 'number', minimum: 0.01 },
            unitPrice: { type: 'number', minimum: 0 },
            totalPrice: { type: 'number', minimum: 0 },
            partId: { type: 'string', format: 'uuid' },
            laborCategory: { type: 'string' },
            markupPercentage: { type: 'number', minimum: 0, maximum: 1000 },
            discountPercentage: { type: 'number', minimum: 0, maximum: 100 },
            taxRate: { type: 'number', minimum: 0, maximum: 100 },
            warrantyMonths: { type: 'integer', minimum: 0 },
            notes: { type: 'string' }
          }
        }
      },
      discountAmount: { type: 'number', minimum: 0 },
      taxAmount: { type: 'number', minimum: 0 },
      validityPeriod: { type: 'integer', minimum: 1, maximum: 365 },
      termsConditions: { type: 'string' },
      notes: { type: 'string' }
    }
  };

  const createRevisionSchema = {
    type: 'object',
    required: ['quotationId', 'lineItems', 'revisionReason'],
    properties: {
      quotationId: { type: 'string', format: 'uuid' },
      lineItems: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'type', 'description', 'quantity', 'unitPrice', 'totalPrice'],
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['part', 'labor', 'travel', 'other', 'discount', 'tax'] },
            description: { type: 'string', minLength: 1 },
            quantity: { type: 'number', minimum: 0.01 },
            unitPrice: { type: 'number', minimum: 0 },
            totalPrice: { type: 'number', minimum: 0 },
            partId: { type: 'string', format: 'uuid' },
            laborCategory: { type: 'string' },
            markupPercentage: { type: 'number', minimum: 0, maximum: 1000 },
            discountPercentage: { type: 'number', minimum: 0, maximum: 100 },
            taxRate: { type: 'number', minimum: 0, maximum: 100 },
            warrantyMonths: { type: 'integer', minimum: 0 },
            notes: { type: 'string' }
          }
        }
      },
      revisionReason: { type: 'string', minLength: 1 },
      validityPeriod: { type: 'integer', minimum: 1, maximum: 365 },
      termsConditions: { type: 'string' }
    }
  };

  const createComparisonSchema = {
    type: 'object',
    required: ['caseId', 'name', 'quotationIds', 'comparisonCriteria'],
    properties: {
      caseId: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      quotationIds: {
        type: 'array',
        minItems: 2,
        items: { type: 'string', format: 'uuid' }
      },
      comparisonCriteria: {
        type: 'object',
        required: ['compareBy'],
        properties: {
          compareBy: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['total_cost', 'labor_cost', 'parts_cost', 'delivery_time', 'warranty_period', 'supplier_rating']
            }
          },
          weightings: { type: 'object' },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'operator', 'value'],
              properties: {
                field: { type: 'string' },
                operator: { type: 'string', enum: ['eq', 'gt', 'lt', 'gte', 'lte', 'in'] },
                value: {}
              }
            }
          }
        }
      }
    }
  };

  const submitApprovalSchema = {
    type: 'object',
    required: ['quotationId', 'approvalLevel', 'status'],
    properties: {
      quotationId: { type: 'string', format: 'uuid' },
      approvalLevel: { type: 'integer', minimum: 1 },
      status: { type: 'string', enum: ['approved', 'rejected', 'requires_revision'] },
      comments: { type: 'string' }
    }
  };

  const submitCustomerResponseSchema = {
    type: 'object',
    required: ['quotationId', 'responseType'],
    properties: {
      quotationId: { type: 'string', format: 'uuid' },
      responseType: { type: 'string', enum: ['approved', 'rejected', 'requested_changes', 'needs_clarification'] },
      customerComments: { type: 'string' },
      requestedChanges: {
        type: 'array',
        items: {
          type: 'object',
          required: ['lineItemId', 'changeType', 'reason'],
          properties: {
            lineItemId: { type: 'string' },
            changeType: { type: 'string', enum: ['quantity', 'price', 'description', 'remove', 'add'] },
            currentValue: {},
            requestedValue: {},
            reason: { type: 'string', minLength: 1 }
          }
        }
      },
      customerSignatureUrl: { type: 'string', format: 'uri' }
    }
  };

  const extendValiditySchema = {
    type: 'object',
    required: ['quotationId', 'newExpiryDate', 'extensionReason'],
    properties: {
      quotationId: { type: 'string', format: 'uuid' },
      newExpiryDate: { type: 'string', format: 'date' },
      extensionReason: { type: 'string', minLength: 1 }
    }
  };

  // Routes
  
  // Create quotation
  router.post('/', 
    authMiddleware,
    validationMiddleware(createQuotationSchema),
    quotationController.createQuotation.bind(quotationController)
  );

  // Update quotation
  router.put('/:id',
    authMiddleware,
    validationMiddleware(updateQuotationSchema),
    quotationController.updateQuotation.bind(quotationController)
  );

  // Get quotation by ID
  router.get('/:id',
    authMiddleware,
    quotationController.getQuotationById.bind(quotationController)
  );

  // Get quotation by number
  router.get('/number/:quotationNumber',
    authMiddleware,
    quotationController.getQuotationByNumber.bind(quotationController)
  );

  // Search quotations
  router.get('/',
    authMiddleware,
    quotationController.searchQuotations.bind(quotationController)
  );

  // Create revision
  router.post('/revisions',
    authMiddleware,
    validationMiddleware(createRevisionSchema),
    quotationController.createRevision.bind(quotationController)
  );

  // Get quotation revisions
  router.get('/:quotationId/revisions',
    authMiddleware,
    quotationController.getQuotationRevisions.bind(quotationController)
  );

  // Create comparison
  router.post('/comparisons',
    authMiddleware,
    validationMiddleware(createComparisonSchema),
    quotationController.createComparison.bind(quotationController)
  );

  // Get comparison by ID
  router.get('/comparisons/:id',
    authMiddleware,
    quotationController.getComparison.bind(quotationController)
  );

  // Get comparisons by case
  router.get('/cases/:caseId/comparisons',
    authMiddleware,
    quotationController.getComparisonsByCase.bind(quotationController)
  );

  // Submit approval
  router.post('/approvals',
    authMiddleware,
    validationMiddleware(submitApprovalSchema),
    quotationController.submitApproval.bind(quotationController)
  );

  // Submit customer response
  router.post('/customer-responses',
    authMiddleware,
    validationMiddleware(submitCustomerResponseSchema),
    quotationController.submitCustomerResponse.bind(quotationController)
  );

  // Extend validity
  router.post('/extend-validity',
    authMiddleware,
    validationMiddleware(extendValiditySchema),
    quotationController.extendValidity.bind(quotationController)
  );

  // Get expiring quotations
  router.get('/admin/expiring',
    authMiddleware,
    quotationController.getExpiringQuotations.bind(quotationController)
  );

  // Get quotation analytics
  router.get('/admin/analytics',
    authMiddleware,
    quotationController.getQuotationAnalytics.bind(quotationController)
  );

  // Process expiring quotations (admin/cron job)
  router.post('/admin/process-expiring',
    authMiddleware,
    quotationController.processExpiringQuotations.bind(quotationController)
  );

  return router;
}