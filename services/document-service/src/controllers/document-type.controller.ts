import { Request, Response, NextFunction } from 'express';
import { DocumentTypeService, CreateDocumentTypeRequest, UpdateDocumentTypeRequest } from '../services/document-type.service';
import { DocumentCategory, UUID } from '../types';
import { createError } from '../middleware/error.middleware';

export class DocumentTypeController {
  private documentTypeService: DocumentTypeService;

  constructor() {
    this.documentTypeService = new DocumentTypeService();
  }

  createDocumentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request: CreateDocumentTypeRequest = req.body;
      
      // Basic validation
      if (!request.name || !request.category || !request.templateConfig) {
        throw createError('Name, category, and templateConfig are required', 400);
      }

      const documentType = await this.documentTypeService.createDocumentType(request);
      
      res.status(201).json({
        success: true,
        data: documentType
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw createError('Document type ID is required', 400);
      }

      const documentType = await this.documentTypeService.getDocumentType(id as UUID);
      
      res.json({
        success: true,
        data: documentType
      });
    } catch (error) {
      next(error);
    }
  };

  getAllDocumentTypes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const documentTypes = await this.documentTypeService.getAllDocumentTypes(includeInactive);
      
      res.json({
        success: true,
        data: documentTypes
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentTypesByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.params;
      
      if (!category) {
        throw createError('Category is required', 400);
      }

      const documentTypes = await this.documentTypeService.getDocumentTypesByCategory(category as DocumentCategory);
      
      res.json({
        success: true,
        data: documentTypes
      });
    } catch (error) {
      next(error);
    }
  };

  updateDocumentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const request: UpdateDocumentTypeRequest = req.body;
      const createNewVersion = req.query.newVersion === 'true';
      
      if (!id) {
        throw createError('Document type ID is required', 400);
      }

      const documentType = await this.documentTypeService.updateDocumentType(
        id as UUID, 
        request, 
        createNewVersion
      );
      
      res.json({
        success: true,
        data: documentType
      });
    } catch (error) {
      next(error);
    }
  };

  deactivateDocumentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw createError('Document type ID is required', 400);
      }

      await this.documentTypeService.deactivateDocumentType(id as UUID);
      
      res.json({
        success: true,
        message: 'Document type deactivated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  deleteDocumentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw createError('Document type ID is required', 400);
      }

      await this.documentTypeService.deleteDocumentType(id as UUID);
      
      res.json({
        success: true,
        message: 'Document type deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  cloneDocumentType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { newName, modifications } = req.body;
      
      if (!id || !newName) {
        throw createError('Document type ID and new name are required', 400);
      }

      const documentType = await this.documentTypeService.cloneDocumentType(
        id as UUID, 
        newName, 
        modifications
      );
      
      res.status(201).json({
        success: true,
        data: documentType
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentTypeForDevice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceTypeId, category } = req.params;
      
      if (!deviceTypeId || !category) {
        throw createError('Device type ID and category are required', 400);
      }

      const documentTypes = await this.documentTypeService.getDocumentTypeForDevice(
        deviceTypeId as UUID, 
        category as DocumentCategory
      );
      
      res.json({
        success: true,
        data: documentTypes
      });
    } catch (error) {
      next(error);
    }
  };

  validateDocumentTypeConfiguration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateConfig } = req.body;
      
      if (!templateConfig) {
        throw createError('Template configuration is required', 400);
      }

      const validation = await this.documentTypeService.validateDocumentTypeConfiguration(templateConfig);
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  };

  getDocumentTypeUsageStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw createError('Document type ID is required', 400);
      }

      const stats = await this.documentTypeService.getDocumentTypeUsageStats(id as UUID);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };
}