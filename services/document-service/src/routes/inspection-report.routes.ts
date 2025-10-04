import { Router } from 'express';
import multer from 'multer';
import { InspectionReportController } from '../controllers/inspection-report.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';

const router = Router();
const inspectionReportController = new InspectionReportController();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  }
});

// Validation schemas
const createInspectionReportSchema = {
  documentId: {
    in: ['body'],
    isUUID: {
      errorMessage: 'Document ID must be a valid UUID'
    }
  },
  findings: {
    in: ['body'],
    isArray: {
      errorMessage: 'Findings must be an array'
    }
  },
  'findings.*.component': {
    in: ['body'],
    isString: {
      errorMessage: 'Finding component must be a string'
    },
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Finding component must be between 1 and 255 characters'
    }
  },
  'findings.*.issue': {
    in: ['body'],
    isString: {
      errorMessage: 'Finding issue must be a string'
    },
    isLength: {
      options: { min: 1, max: 500 },
      errorMessage: 'Finding issue must be between 1 and 500 characters'
    }
  },
  'findings.*.severity': {
    in: ['body'],
    isIn: {
      options: [['low', 'medium', 'high', 'critical']],
      errorMessage: 'Finding severity must be one of: low, medium, high, critical'
    }
  },
  estimatedHours: {
    in: ['body'],
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Estimated hours must be a positive number'
    }
  },
  severityLevel: {
    in: ['body'],
    isIn: {
      options: [['low', 'medium', 'high', 'critical']],
      errorMessage: 'Severity level must be one of: low, medium, high, critical'
    }
  }
};

const updateInspectionReportSchema = {
  'findings.*.component': {
    in: ['body'],
    optional: true,
    isString: {
      errorMessage: 'Finding component must be a string'
    },
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Finding component must be between 1 and 255 characters'
    }
  },
  'findings.*.issue': {
    in: ['body'],
    optional: true,
    isString: {
      errorMessage: 'Finding issue must be a string'
    },
    isLength: {
      options: { min: 1, max: 500 },
      errorMessage: 'Finding issue must be between 1 and 500 characters'
    }
  },
  'findings.*.severity': {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['low', 'medium', 'high', 'critical']],
      errorMessage: 'Finding severity must be one of: low, medium, high, critical'
    }
  },
  estimatedHours: {
    in: ['body'],
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Estimated hours must be a positive number'
    }
  },
  severityLevel: {
    in: ['body'],
    optional: true,
    isIn: {
      options: [['low', 'medium', 'high', 'critical']],
      errorMessage: 'Severity level must be one of: low, medium, high, critical'
    }
  }
};

const addFindingSchema = {
  component: {
    in: ['body'],
    isString: {
      errorMessage: 'Component must be a string'
    },
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Component must be between 1 and 255 characters'
    }
  },
  issue: {
    in: ['body'],
    isString: {
      errorMessage: 'Issue must be a string'
    },
    isLength: {
      options: { min: 1, max: 500 },
      errorMessage: 'Issue must be between 1 and 500 characters'
    }
  },
  severity: {
    in: ['body'],
    isIn: {
      options: [['low', 'medium', 'high', 'critical']],
      errorMessage: 'Severity must be one of: low, medium, high, critical'
    }
  },
  description: {
    in: ['body'],
    isString: {
      errorMessage: 'Description must be a string'
    },
    isLength: {
      options: { min: 1, max: 1000 },
      errorMessage: 'Description must be between 1 and 1000 characters'
    }
  }
};

const addRecommendedPartSchema = {
  partName: {
    in: ['body'],
    isString: {
      errorMessage: 'Part name must be a string'
    },
    isLength: {
      options: { min: 1, max: 255 },
      errorMessage: 'Part name must be between 1 and 255 characters'
    }
  },
  quantity: {
    in: ['body'],
    isInt: {
      options: { min: 1 },
      errorMessage: 'Quantity must be a positive integer'
    }
  },
  reason: {
    in: ['body'],
    isString: {
      errorMessage: 'Reason must be a string'
    },
    isLength: {
      options: { min: 1, max: 500 },
      errorMessage: 'Reason must be between 1 and 500 characters'
    }
  },
  urgency: {
    in: ['body'],
    isIn: {
      options: [['immediate', 'scheduled', 'optional']],
      errorMessage: 'Urgency must be one of: immediate, scheduled, optional'
    }
  },
  estimatedCost: {
    in: ['body'],
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: 'Estimated cost must be a positive number'
    }
  }
};

// Core CRUD Operations
router.post(
  '/',
  authMiddleware,
  validationMiddleware(createInspectionReportSchema),
  inspectionReportController.createInspectionReport
);

router.get(
  '/:id',
  authMiddleware,
  inspectionReportController.getInspectionReport
);

router.get(
  '/document/:documentId',
  authMiddleware,
  inspectionReportController.getInspectionReportByDocument
);

router.put(
  '/:id',
  authMiddleware,
  validationMiddleware(updateInspectionReportSchema),
  inspectionReportController.updateInspectionReport
);

router.delete(
  '/:id',
  authMiddleware,
  inspectionReportController.deleteInspectionReport
);

// Findings Management
router.post(
  '/:reportId/findings',
  authMiddleware,
  validationMiddleware(addFindingSchema),
  inspectionReportController.addFinding
);

router.put(
  '/:reportId/findings/:findingId',
  authMiddleware,
  inspectionReportController.updateFinding
);

router.delete(
  '/:reportId/findings/:findingId',
  authMiddleware,
  inspectionReportController.removeFinding
);

// Parts Recommendation System
router.post(
  '/parts/recommendations',
  authMiddleware,
  inspectionReportController.generatePartsRecommendations
);

router.post(
  '/:reportId/parts',
  authMiddleware,
  validationMiddleware(addRecommendedPartSchema),
  inspectionReportController.addRecommendedPart
);

router.put(
  '/:reportId/parts/:partId',
  authMiddleware,
  inspectionReportController.updateRecommendedPart
);

router.delete(
  '/:reportId/parts/:partId',
  authMiddleware,
  inspectionReportController.removeRecommendedPart
);

// Cost Estimation
router.post(
  '/cost/calculate',
  authMiddleware,
  inspectionReportController.calculateEstimatedCost
);

router.put(
  '/:reportId/parts/costs',
  authMiddleware,
  inspectionReportController.updatePartCosts
);

// Severity Assessment
router.post(
  '/severity/assess',
  authMiddleware,
  inspectionReportController.assessSeverity
);

// Image Management
router.post(
  '/:reportId/images',
  authMiddleware,
  upload.single('image'),
  inspectionReportController.uploadInspectionImage
);

router.delete(
  '/:reportId/images/:imageId',
  authMiddleware,
  inspectionReportController.removeInspectionImage
);

router.put(
  '/:reportId/images/:imageId/caption',
  authMiddleware,
  inspectionReportController.updateImageCaption
);

// Comparison and Analysis
router.get(
  '/:reportId1/compare/:reportId2',
  authMiddleware,
  inspectionReportController.compareInspectionReports
);

// Search and Analytics
router.get(
  '/',
  authMiddleware,
  inspectionReportController.searchInspectionReports
);

router.get(
  '/analytics/overview',
  authMiddleware,
  inspectionReportController.getInspectionAnalytics
);

// Parameter validation middleware for UUID parameters
router.param('id', (req, res, next, id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid ID format. Must be a valid UUID.',
        statusCode: 400
      }
    });
  }
  next();
});

router.param('reportId', (req, res, next, reportId) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(reportId)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid report ID format. Must be a valid UUID.',
        statusCode: 400
      }
    });
  }
  next();
});

router.param('documentId', (req, res, next, documentId) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(documentId)) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid document ID format. Must be a valid UUID.',
        statusCode: 400
      }
    });
  }
  next();
});

// Error handling middleware for multer
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'File too large. Maximum size is 5MB.',
          statusCode: 400
        }
      });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      error: {
        message: error.message,
        statusCode: 400
      }
    });
  }
  
  next(error);
});

export default router;