import { Request, Response, NextFunction } from 'express';
import * as multer from 'multer';
import { DocumentService } from '../services/document.service';
import { DocumentTemplateService } from '../services/document-template.service';
import { 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  SubmitDocumentRequest,
  ApproveDocumentRequest,
  RejectDocumentRequest,
  UUID 
} from '../types';
import { createError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export class DocumentController {
  private documentService: DocumentService;
  private documentTemplateService: DocumentTemplateService;

  constructor() {
    this.documentService = new DocumentService();
    this.documentTemplateService = new DocumentTemplateService();
  }

  // Document CRUD Operations
  createDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const request: CreateDocumentRequest = req.body;
      
      if (!request.caseId || !request.documentTypeId || !request.content) {
        throw createError('Case ID, document type ID, and content are required', 400);
      }

      const document = await this.documentService.createDocument(request, req.user.id);
      
      res.status(201).json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  };

  getDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const document = await this.documentService.getDocument(id as UUID);
      
      if (!document) {
        throw createError('Document not found', 404);
      }
      
      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  };

  updateDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const request: UpdateDocumentRequest = req.body;
      
      if (!request.content) {
        throw createError('Content is required', 400);
      }

      const document = await this.documentService.updateDocument(id as UUID, request, req.user.id);
      
      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  };

  deleteDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      await this.documentService.deleteDocument(id as UUID);
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentsByCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      
      const documents = await this.documentService.getDocumentsByCase(caseId as UUID);
      
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentsByStepExecution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stepExecutionId } = req.params;
      
      const documents = await this.documentService.getDocumentsByStepExecution(stepExecutionId as UUID);
      
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  };

  // Document Status Management
  submitDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      
      const request: SubmitDocumentRequest = {
        documentId: id as UUID,
        submittedBy: req.user.id,
        comments
      };

      await this.documentService.submitDocument(request);
      
      res.json({
        success: true,
        message: 'Document submitted for approval'
      });
    } catch (error) {
      next(error);
    }
  };

  approveDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approvalLevel, comments } = req.body;
      
      const request: ApproveDocumentRequest = {
        documentId: id as UUID,
        approverId: req.user.id,
        approvalLevel: approvalLevel || 1,
        comments
      };

      await this.documentService.approveDocument(request);
      
      res.json({
        success: true,
        message: 'Document approved'
      });
    } catch (error) {
      next(error);
    }
  };

  rejectDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason, comments, approvalLevel } = req.body;
      
      if (!reason) {
        throw createError('Rejection reason is required', 400);
      }
      
      const request: RejectDocumentRequest = {
        documentId: id as UUID,
        approverId: req.user.id,
        approvalLevel: approvalLevel || 1,
        reason,
        comments
      };

      await this.documentService.rejectDocument(request);
      
      res.json({
        success: true,
        message: 'Document rejected'
      });
    } catch (error) {
      next(error);
    }
  };

  // File Upload and Attachment Management
  uploadAttachment = [
    upload.single('file'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        
        if (!req.file) {
          throw createError('No file uploaded', 400);
        }

        const file = {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size
        };

        await this.documentService.uploadAttachment(id as UUID, file, req.user.id);
        
        res.json({
          success: true,
          message: 'File uploaded successfully'
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  uploadImage = [
    upload.single('image'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        
        if (!req.file) {
          throw createError('No image uploaded', 400);
        }

        const file = {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size
        };

        const imageUrl = await this.documentService.uploadImage(id as UUID, file, req.user.id);
        
        res.json({
          success: true,
          data: { imageUrl }
        });
      } catch (error) {
        next(error);
      }
    }
  ];

  deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attachmentId } = req.params;
      
      await this.documentService.deleteAttachment(attachmentId as UUID);
      
      res.json({
        success: true,
        message: 'Attachment deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  // Auto-save functionality
  autoSaveDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content) {
        throw createError('Content is required', 400);
      }

      await this.documentService.autoSaveDocument(id as UUID, content, req.user.id);
      
      res.json({
        success: true,
        message: 'Document auto-saved'
      });
    } catch (error) {
      next(error);
    }
  };

  getAutoSave = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const autoSaveContent = await this.documentService.getAutoSave(id as UUID);
      
      res.json({
        success: true,
        data: autoSaveContent
      });
    } catch (error) {
      next(error);
    }
  };

  restoreFromAutoSave = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const document = await this.documentService.restoreFromAutoSave(id as UUID, req.user.id);
      
      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  };

  // PDF Generation and Preview
  generateDocumentPDF = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const options = req.body;
      
      const pdfBuffer = await this.documentService.generateDocumentPDF(id as UUID, options);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  generatePreviewPDF = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentTypeId, content, options } = req.body;
      
      if (!documentTypeId || !content) {
        throw createError('Document type ID and content are required', 400);
      }
      
      const pdfBuffer = await this.documentService.generatePreviewPDF(
        documentTypeId as UUID, 
        content, 
        options
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  // Document Versioning
  getDocumentVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const versions = await this.documentService.getDocumentVersions(id as UUID);
      
      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      next(error);
    }
  };

  createDocumentVersion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content) {
        throw createError('Content is required', 400);
      }

      const document = await this.documentService.createDocumentVersion(id as UUID, content, req.user.id);
      
      res.json({
        success: true,
        data: document
      });
    } catch (error) {
      next(error);
    }
  };

  // Legacy methods for backward compatibility
  validateDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { documentTypeId, content } = req.body;
      
      if (!documentTypeId || !content) {
        throw createError('Document type ID and content are required', 400);
      }

      const validation = await this.documentTemplateService.validateDocumentContent(
        documentTypeId as UUID,
        content
      );
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceTypeId, category, documentTypeId } = req.query;
      
      if (!deviceTypeId || !category) {
        throw createError('Device type ID and category are required', 400);
      }

      const dynamicForm = await this.documentTemplateService.generateDynamicForm(
        deviceTypeId as UUID,
        category as any,
        documentTypeId as UUID | undefined
      );
      
      res.json({
        success: true,
        data: dynamicForm
      });
    } catch (error) {
      next(error);
    }
  };
}