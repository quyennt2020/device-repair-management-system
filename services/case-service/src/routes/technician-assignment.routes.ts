import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { TechnicianAssignmentController } from '../controllers/technician-assignment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { authorizationMiddleware } from '../middleware/authorization.middleware';

const router = Router();
const assignmentController = new TechnicianAssignmentController();

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * @route GET /api/technician-assignment/available
 * @desc Get available technicians for assignment
 * @access Private (Staff, Admin)
 */
router.get('/available',
  authorizationMiddleware(['staff', 'admin']),
  [
    query('deviceType').optional().trim(),
    query('category').optional().trim(),
    query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    query('location').optional().trim()
  ],
  validationMiddleware,
  assignmentController.getAvailableTechnicians.bind(assignmentController)
);

/**
 * @route POST /api/technician-assignment/auto-assign
 * @desc Auto-assign technician to case
 * @access Private (Staff, Admin)
 */
router.post('/auto-assign',
  authorizationMiddleware(['staff', 'admin']),
  [
    body('caseId').isUUID().withMessage('Valid case ID is required'),
    body('deviceType').trim().isLength({ min: 1 }).withMessage('Device type is required'),
    body('category').trim().isLength({ min: 1 }).withMessage('Category is required'),
    body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Valid priority is required'),
    body('location').optional().trim()
  ],
  validationMiddleware,
  assignmentController.autoAssignTechnician.bind(assignmentController)
);

/**
 * @route GET /api/technician-assignment/workload/:technicianId
 * @desc Get technician workload
 * @access Private (Staff, Admin, Technician - own workload)
 */
router.get('/workload/:technicianId',
  authorizationMiddleware(['staff', 'admin', 'technician']),
  [
    param('technicianId').isUUID().withMessage('Valid technician ID is required')
  ],
  validationMiddleware,
  assignmentController.getTechnicianWorkload.bind(assignmentController)
);

/**
 * @route GET /api/technician-assignment/performance/:technicianId
 * @desc Get technician performance metrics
 * @access Private (Staff, Admin, Technician - own performance)
 */
router.get('/performance/:technicianId',
  authorizationMiddleware(['staff', 'admin', 'technician']),
  [
    param('technicianId').isUUID().withMessage('Valid technician ID is required'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be 1-365')
  ],
  validationMiddleware,
  assignmentController.getTechnicianPerformance.bind(assignmentController)
);

/**
 * @route GET /api/technician-assignment/suggestions
 * @desc Get reassignment suggestions
 * @access Private (Staff, Admin)
 */
router.get('/suggestions',
  authorizationMiddleware(['staff', 'admin']),
  assignmentController.getReassignmentSuggestions.bind(assignmentController)
);

/**
 * @route POST /api/technician-assignment/validate
 * @desc Validate if technician can be assigned more cases
 * @access Private (Staff, Admin)
 */
router.post('/validate',
  authorizationMiddleware(['staff', 'admin']),
  [
    body('technicianId').isUUID().withMessage('Valid technician ID is required')
  ],
  validationMiddleware,
  assignmentController.validateAssignment.bind(assignmentController)
);

export default router;