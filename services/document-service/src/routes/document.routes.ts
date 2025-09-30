import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';

const router = Router();
const documentController = new DocumentController();

// Document CRUD Operations
router.post('/', 
  authMiddleware, 
  validationMiddleware.validateCreateDocument,
  documentController.createDocument
);

router.get('/:id', 
  authMiddleware,
  documentController.getDocument
);

router.put('/:id', 
  authMiddleware,
  validationMiddleware.validateUpdateDocument,
  documentController.updateDocument
);

router.delete('/:id', 
  authMiddleware,
  documentController.deleteDocument
);

router.get('/case/:caseId', 
  authMiddleware,
  documentController.getDocumentsByCase
);

router.get('/step-execution/:stepExecutionId', 
  authMiddleware,
  documentController.getDocumentsByStepExecution
);

// Document Status Management
router.post('/:id/submit', 
  authMiddleware,
  documentController.submitDocument
);

router.post('/:id/approve', 
  authMiddleware,
  validationMiddleware.validateApproveDocument,
  documentController.approveDocument
);

router.post('/:id/reject', 
  authMiddleware,
  validationMiddleware.validateRejectDocument,
  documentController.rejectDocument
);

// File Upload and Attachment Management
router.post('/:id/attachments', 
  authMiddleware,
  documentController.uploadAttachment
);

router.post('/:id/images', 
  authMiddleware,
  documentController.uploadImage
);

router.delete('/attachments/:attachmentId', 
  authMiddleware,
  documentController.deleteAttachment
);

// Auto-save functionality
router.post('/:id/auto-save', 
  authMiddleware,
  documentController.autoSaveDocument
);

router.get('/:id/auto-save', 
  authMiddleware,
  documentController.getAutoSave
);

router.post('/:id/restore-auto-save', 
  authMiddleware,
  documentController.restoreFromAutoSave
);

// PDF Generation and Preview
router.post('/:id/pdf', 
  authMiddleware,
  documentController.generateDocumentPDF
);

router.post('/preview/pdf', 
  authMiddleware,
  validationMiddleware.validatePreviewPDF,
  documentController.generatePreviewPDF
);

// Document Versioning
router.get('/:id/versions', 
  authMiddleware,
  documentController.getDocumentVersions
);

router.post('/:id/versions', 
  authMiddleware,
  validationMiddleware.validateCreateVersion,
  documentController.createDocumentVersion
);

// Legacy endpoints for backward compatibility
router.post('/validate', 
  authMiddleware,
  documentController.validateDocument
);

router.get('/form', 
  authMiddleware,
  documentController.getDocumentForm
);

export { router as documentRoutes };