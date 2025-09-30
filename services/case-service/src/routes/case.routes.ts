import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { CaseController } from '../controllers/case.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { authorizationMiddleware } from '../middleware/authorization.middleware';

const router = Router();
const caseController = new CaseController();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route POST /api/cases
 * @desc Create a new repair case
 * @access Private (Customer, Staff, Admin)
 */
router.post('/',
  authorizationMiddleware(['customer', 'staff', 'admin']),
  [
    body('customerId').isUUID().withMessage('Valid customer ID is required'),
    body('deviceId').isUUID().withMessage('Valid device ID is required'),
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('description').trim().isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('category').trim().isLength({ min: 2, max: 50 }).withMessage('Category is required'),
    body('subcategory').optional().trim().isLength({ max: 50 }),
    body('reportedIssue').trim().isLength({ min: 10, max: 1000 }).withMessage('Reported issue must be 10-1000 characters'),
    body('deviceType').optional().trim().isLength({ max: 50 }),
    body('location').optional().trim().isLength({ max: 100 }),
    body('metadata').optional().isObject()
  ],
  validationMiddleware,
  caseController.createCase.bind(caseController)
);

/**
 * @route GET /api/cases
 * @desc Get cases with filtering and pagination
 * @access Private (Staff, Admin, Customer - filtered by ownership)
 */
router.get('/',
  authorizationMiddleware(['customer', 'staff', 'admin']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('status').optional().isIn(['open', 'assigned', 'in_progress', 'waiting_parts', 'waiting_customer', 'completed', 'cancelled']),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    query('category').optional().trim(),
    query('customerId').optional().isUUID(),
    query('technicianId').optional().isUUID(),
    query('deviceId').optional().isUUID(),
    query('search').optional().trim(),
    query('createdAfter').optional().isISO8601(),
    query('createdBefore').optional().isISO8601(),
    query('dueBefore').optional().isISO8601(),
    query('overdue').optional().isBoolean()
  ],
  validationMiddleware,
  caseController.getCases.bind(caseController)
);

/**
 * @route GET /api/cases/statistics
 * @desc Get case statistics
 * @access Private (Staff, Admin)
 */
router.get('/statistics',
  authorizationMiddleware(['staff', 'admin']),
  [
    query('technicianId').optional().isUUID(),
    query('customerId').optional().isUUID(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  validationMiddleware,
  caseController.getCaseStatistics.bind(caseController)
);

/**
 * @route GET /api/cases/:id
 * @desc Get case by ID
 * @access Private (Customer - own cases, Staff, Admin)
 */
router.get('/:id',
  authorizationMiddleware(['customer', 'staff', 'admin']),
  [
    param('id').isUUID().withMessage('Valid case ID is required')
  ],
  validationMiddleware,
  caseController.getCaseById.bind(caseController)
);

/**
 * @route PUT /api/cases/:id
 * @desc Update case
 * @access Private (Staff, Admin)
 */
router.put('/:id',
  authorizationMiddleware(['staff', 'admin']),
  [
    param('id').isUUID().withMessage('Valid case ID is required'),
    body('title').optional().trim().isLength({ min: 5, max: 200 }),
    body('description').optional().trim().isLength({ min: 10, max: 2000 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('category').optional().trim().isLength({ min: 2, max: 50 }),
    body('subcategory').optional().trim().isLength({ max: 50 }),
    body('reportedIssue').optional().trim().isLength({ min: 10, max: 1000 }),
    body('metadata').optional().isObject()
  ],
  validationMiddleware,
  caseController.updateCase.bind(caseController)
);

/**
 * @route PATCH /api/cases/:id/status
 * @desc Update case status
 * @access Private (Staff, Admin, Technician - assigned cases)
 */
router.patch('/:id/status',
  authorizationMiddleware(['staff', 'admin', 'technician']),
  [
    param('id').isUUID().withMessage('Valid case ID is required'),
    body('status').isIn(['open', 'assigned', 'in_progress', 'waiting_parts', 'waiting_customer', 'completed', 'cancelled']).withMessage('Invalid status'),
    body('comment').optional().trim().isLength({ max: 500 })
  ],
  validationMiddleware,
  caseController.updateCaseStatus.bind(caseController)
);

/**
 * @route PATCH /api/cases/:id/assign
 * @desc Assign technician to case
 * @access Private (Staff, Admin)
 */
router.patch('/:id/assign',
  authorizationMiddleware(['staff', 'admin']),
  [
    param('id').isUUID().withMessage('Valid case ID is required'),
    body('technicianId').isUUID().withMessage('Valid technician ID is required')
  ],
  validationMiddleware,
  caseController.assignTechnician.bind(caseController)
);

/**
 * @route POST /api/cases/:id/notes
 * @desc Add note to case
 * @access Private (Customer - own cases, Staff, Admin, Technician - assigned cases)
 */
router.post('/:id/notes',
  authorizationMiddleware(['customer', 'staff', 'admin', 'technician']),
  [
    param('id').isUUID().withMessage('Valid case ID is required'),
    body('content').trim().isLength({ min: 5, max: 2000 }).withMessage('Note content must be 5-2000 characters'),
    body('noteType').isIn(['internal', 'customer', 'technician']).withMessage('Invalid note type'),
    body('isPrivate').optional().isBoolean()
  ],
  validationMiddleware,
  caseController.addCaseNote.bind(caseController)
);

/**
 * @route GET /api/cases/:id/timeline
 * @desc Get case timeline
 * @access Private (Customer - own cases, Staff, Admin, Technician - assigned cases)
 */
router.get('/:id/timeline',
  authorizationMiddleware(['customer', 'staff', 'admin', 'technician']),
  [
    param('id').isUUID().withMessage('Valid case ID is required')
  ],
  validationMiddleware,
  caseController.getCaseTimeline.bind(caseController)
);

/**
 * @route GET /api/cases/:id/notes
 * @desc Get case notes
 * @access Private (Customer - own cases non-private, Staff, Admin, Technician - assigned cases)
 */
router.get('/:id/notes',
  authorizationMiddleware(['customer', 'staff', 'admin', 'technician']),
  [
    param('id').isUUID().withMessage('Valid case ID is required')
  ],
  validationMiddleware,
  caseController.getCaseNotes.bind(caseController)
);

/**
 * @route DELETE /api/cases/:id
 * @desc Delete case (soft delete)
 * @access Private (Admin only)
 */
router.delete('/:id',
  authorizationMiddleware(['admin']),
  [
    param('id').isUUID().withMessage('Valid case ID is required')
  ],
  validationMiddleware,
  caseController.deleteCase.bind(caseController)
);

export default router;