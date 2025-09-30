import { Request, Response, NextFunction } from 'express';
import { createError } from './error.middleware';

export class ValidationMiddleware {
  validateCreateDocument = (req: Request, res: Response, next: NextFunction) => {
    const { caseId, documentTypeId, content } = req.body;

    if (!caseId) {
      return next(createError('Case ID is required', 400));
    }

    if (!documentTypeId) {
      return next(createError('Document type ID is required', 400));
    }

    if (!content || typeof content !== 'object') {
      return next(createError('Content is required and must be an object', 400));
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(caseId)) {
      return next(createError('Invalid case ID format', 400));
    }

    if (!uuidRegex.test(documentTypeId)) {
      return next(createError('Invalid document type ID format', 400));
    }

    next();
  };

  validateUpdateDocument = (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body;

    if (!content || typeof content !== 'object') {
      return next(createError('Content is required and must be an object', 400));
    }

    next();
  };

  validateApproveDocument = (req: Request, res: Response, next: NextFunction) => {
    const { approvalLevel } = req.body;

    if (approvalLevel !== undefined) {
      if (!Number.isInteger(approvalLevel) || approvalLevel < 1) {
        return next(createError('Approval level must be a positive integer', 400));
      }
    }

    next();
  };

  validateRejectDocument = (req: Request, res: Response, next: NextFunction) => {
    const { reason, approvalLevel } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return next(createError('Rejection reason is required', 400));
    }

    if (approvalLevel !== undefined) {
      if (!Number.isInteger(approvalLevel) || approvalLevel < 1) {
        return next(createError('Approval level must be a positive integer', 400));
      }
    }

    next();
  };

  validatePreviewPDF = (req: Request, res: Response, next: NextFunction) => {
    const { documentTypeId, content } = req.body;

    if (!documentTypeId) {
      return next(createError('Document type ID is required', 400));
    }

    if (!content || typeof content !== 'object') {
      return next(createError('Content is required and must be an object', 400));
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(documentTypeId)) {
      return next(createError('Invalid document type ID format', 400));
    }

    next();
  };

  validateCreateVersion = (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body;

    if (!content || typeof content !== 'object') {
      return next(createError('Content is required and must be an object', 400));
    }

    next();
  };

  validateUUID = (paramName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const value = req.params[paramName];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(value)) {
        return next(createError(`Invalid ${paramName} format`, 400));
      }

      next();
    };
  };

  validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(createError('No file uploaded', 400));
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return next(createError('File size exceeds 10MB limit', 400));
    }

    next();
  };

  validateImageUpload = (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(createError('No image uploaded', 400));
    }

    // Validate file size (5MB limit for images)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return next(createError('Image size exceeds 5MB limit', 400));
    }

    // Validate image type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return next(createError('Invalid image type. Allowed types: JPEG, PNG, GIF, WebP', 400));
    }

    next();
  };

  validateAutoSave = (req: Request, res: Response, next: NextFunction) => {
    const { content } = req.body;

    if (!content || typeof content !== 'object') {
      return next(createError('Content is required and must be an object', 400));
    }

    next();
  };

  validatePDFOptions = (req: Request, res: Response, next: NextFunction) => {
    const { options } = req.body;

    if (options) {
      if (typeof options !== 'object') {
        return next(createError('Options must be an object', 400));
      }

      // Validate format
      if (options.format && !['A4', 'Letter'].includes(options.format)) {
        return next(createError('Invalid format. Allowed values: A4, Letter', 400));
      }

      // Validate orientation
      if (options.orientation && !['portrait', 'landscape'].includes(options.orientation)) {
        return next(createError('Invalid orientation. Allowed values: portrait, landscape', 400));
      }

      // Validate margin
      if (options.margin && typeof options.margin !== 'object') {
        return next(createError('Margin must be an object', 400));
      }
    }

    next();
  };
}

export const validationMiddleware = new ValidationMiddleware();