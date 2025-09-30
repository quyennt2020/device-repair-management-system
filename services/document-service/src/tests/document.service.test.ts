import { DocumentService } from '../services/document.service';
import { DocumentRepository } from '../repositories/document.repository';
import { AttachmentRepository } from '../repositories/attachment.repository';
import { DocumentTypeRepository } from '../repositories/document-type.repository';
import { FileStorageService } from '../services/file-storage.service';
import { PDFGenerationService } from '../services/pdf-generation.service';
import { DocumentTemplateService } from '../services/document-template.service';
import { 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  Document, 
  DocumentType,
  DocumentStatus 
} from '../types';

// Mock all dependencies
jest.mock('../repositories/document.repository');
jest.mock('../repositories/attachment.repository');
jest.mock('../repositories/document-type.repository');
jest.mock('../services/file-storage.service');
jest.mock('../services/pdf-generation.service');
jest.mock('../services/document-template.service');

describe('DocumentService', () => {
  let documentService: DocumentService;
  let mockDocumentRepository: jest.Mocked<DocumentRepository>;
  let mockAttachmentRepository: jest.Mocked<AttachmentRepository>;
  let mockDocumentTypeRepository: jest.Mocked<DocumentTypeRepository>;
  let mockFileStorageService: jest.Mocked<FileStorageService>;
  let mockPDFGenerationService: jest.Mocked<PDFGenerationService>;
  let mockDocumentTemplateService: jest.Mocked<DocumentTemplateService>;

  const mockDocumentType: DocumentType = {
    id: 'doc-type-1',
    name: 'Inspection Report',
    category: 'inspection_report',
    templateConfig: {
      sections: ['general', 'findings'],
      requiredFields: ['deviceCondition', 'findings'],
      validationRules: []
    },
    requiredFields: ['deviceCondition', 'findings'],
    isActive: true,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockDocument: Document = {
    id: 'doc-1',
    caseId: 'case-1',
    documentTypeId: 'doc-type-1',
    status: 'draft' as DocumentStatus,
    content: {
      deviceCondition: 'Good',
      findings: ['No issues found']
    },
    version: 1,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    approvals: [],
    attachments: []
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instance
    documentService = new DocumentService();

    // Get mocked instances
    mockDocumentRepository = DocumentRepository.prototype as jest.Mocked<DocumentRepository>;
    mockAttachmentRepository = AttachmentRepository.prototype as jest.Mocked<AttachmentRepository>;
    mockDocumentTypeRepository = DocumentTypeRepository.prototype as jest.Mocked<DocumentTypeRepository>;
    mockFileStorageService = FileStorageService.prototype as jest.Mocked<FileStorageService>;
    mockPDFGenerationService = PDFGenerationService.prototype as jest.Mocked<PDFGenerationService>;
    mockDocumentTemplateService = DocumentTemplateService.prototype as jest.Mocked<DocumentTemplateService>;
  });

  describe('createDocument', () => {
    it('should create a document successfully', async () => {
      const createRequest: CreateDocumentRequest = {
        caseId: 'case-1',
        documentTypeId: 'doc-type-1',
        content: {
          deviceCondition: 'Good',
          findings: ['No issues found']
        }
      };

      mockDocumentTypeRepository.findById.mockResolvedValue(mockDocumentType);
      mockDocumentTemplateService.validateDocumentContent.mockResolvedValue({
        isValid: true,
        errors: []
      });
      mockDocumentRepository.create.mockResolvedValue(mockDocument);

      const result = await documentService.createDocument(createRequest, 'user-1');

      expect(mockDocumentTypeRepository.findById).toHaveBeenCalledWith('doc-type-1');
      expect(mockDocumentTemplateService.validateDocumentContent).toHaveBeenCalledWith(
        'doc-type-1',
        createRequest.content
      );
      expect(mockDocumentRepository.create).toHaveBeenCalledWith(createRequest, 'user-1');
      expect(result).toEqual(mockDocument);
    });

    it('should throw error if document type not found', async () => {
      const createRequest: CreateDocumentRequest = {
        caseId: 'case-1',
        documentTypeId: 'invalid-type',
        content: {}
      };

      mockDocumentTypeRepository.findById.mockResolvedValue(null);

      await expect(documentService.createDocument(createRequest, 'user-1'))
        .rejects.toThrow('Document type not found');
    });

    it('should throw error if validation fails', async () => {
      const createRequest: CreateDocumentRequest = {
        caseId: 'case-1',
        documentTypeId: 'doc-type-1',
        content: {}
      };

      mockDocumentTypeRepository.findById.mockResolvedValue(mockDocumentType);
      mockDocumentTemplateService.validateDocumentContent.mockResolvedValue({
        isValid: false,
        errors: ['Required field missing']
      });

      await expect(documentService.createDocument(createRequest, 'user-1'))
        .rejects.toThrow('Document validation failed: Required field missing');
    });
  });

  describe('updateDocument', () => {
    it('should update a document successfully', async () => {
      const updateRequest: UpdateDocumentRequest = {
        content: {
          deviceCondition: 'Fair',
          findings: ['Minor wear detected']
        }
      };

      const updatedDocument = { ...mockDocument, content: updateRequest.content };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockDocumentTemplateService.validateDocumentContent.mockResolvedValue({
        isValid: true,
        errors: []
      });
      mockDocumentRepository.update.mockResolvedValue(updatedDocument);

      const result = await documentService.updateDocument('doc-1', updateRequest, 'user-1');

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentTemplateService.validateDocumentContent).toHaveBeenCalledWith(
        'doc-type-1',
        updateRequest.content
      );
      expect(mockDocumentRepository.update).toHaveBeenCalledWith('doc-1', updateRequest, 'user-1');
      expect(result).toEqual(updatedDocument);
    });

    it('should throw error if document not found', async () => {
      const updateRequest: UpdateDocumentRequest = {
        content: {}
      };

      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(documentService.updateDocument('invalid-id', updateRequest, 'user-1'))
        .rejects.toThrow('Document not found');
    });

    it('should throw error if document is not in draft status', async () => {
      const updateRequest: UpdateDocumentRequest = {
        content: {}
      };

      const submittedDocument = { ...mockDocument, status: 'submitted' as DocumentStatus };
      mockDocumentRepository.findById.mockResolvedValue(submittedDocument);

      await expect(documentService.updateDocument('doc-1', updateRequest, 'user-1'))
        .rejects.toThrow('Can only update documents in draft status');
    });
  });

  describe('submitDocument', () => {
    it('should submit a document successfully', async () => {
      const submitRequest = {
        documentId: 'doc-1',
        submittedBy: 'user-1',
        comments: 'Ready for review'
      };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockDocumentTemplateService.validateDocumentContent.mockResolvedValue({
        isValid: true,
        errors: []
      });
      mockDocumentRepository.updateStatus.mockResolvedValue();

      await documentService.submitDocument(submitRequest);

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentTemplateService.validateDocumentContent).toHaveBeenCalledWith(
        'doc-type-1',
        mockDocument.content
      );
      expect(mockDocumentRepository.updateStatus).toHaveBeenCalledWith('doc-1', 'submitted');
    });

    it('should throw error if document is not in draft status', async () => {
      const submitRequest = {
        documentId: 'doc-1',
        submittedBy: 'user-1'
      };

      const submittedDocument = { ...mockDocument, status: 'submitted' as DocumentStatus };
      mockDocumentRepository.findById.mockResolvedValue(submittedDocument);

      await expect(documentService.submitDocument(submitRequest))
        .rejects.toThrow('Can only submit documents in draft status');
    });
  });

  describe('uploadAttachment', () => {
    it('should upload attachment successfully', async () => {
      const file = {
        buffer: Buffer.from('test file content'),
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024
      };

      const storedFile = {
        fileName: 'stored-file.pdf',
        filePath: 'documents/doc-1/stored-file.pdf',
        url: 'http://localhost:3000/uploads/documents/doc-1/stored-file.pdf'
      };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockFileStorageService.validateFileSize.mockImplementation(() => {});
      mockFileStorageService.validateFileType.mockImplementation(() => {});
      mockFileStorageService.storeFile.mockResolvedValue(storedFile);
      mockAttachmentRepository.create.mockResolvedValue({
        id: 'attachment-1',
        documentId: 'doc-1',
        fileName: storedFile.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.size,
        filePath: storedFile.filePath,
        uploadedBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await documentService.uploadAttachment('doc-1', file, 'user-1');

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockFileStorageService.validateFileSize).toHaveBeenCalledWith(1024, 10);
      expect(mockFileStorageService.validateFileType).toHaveBeenCalled();
      expect(mockFileStorageService.storeFile).toHaveBeenCalledWith(file, 'doc-1');
      expect(mockAttachmentRepository.create).toHaveBeenCalled();
    });

    it('should throw error if document not found', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024
      };

      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(documentService.uploadAttachment('invalid-id', file, 'user-1'))
        .rejects.toThrow('Document not found');
    });
  });

  describe('autoSaveDocument', () => {
    it('should auto-save document successfully', async () => {
      const content = { deviceCondition: 'Good' };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockDocumentRepository.createAutoSave.mockResolvedValue();

      await documentService.autoSaveDocument('doc-1', content, 'user-1');

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentRepository.createAutoSave).toHaveBeenCalledWith('doc-1', content, 'user-1');
    });

    it('should not auto-save if document is not in draft status', async () => {
      const content = { deviceCondition: 'Good' };
      const submittedDocument = { ...mockDocument, status: 'submitted' as DocumentStatus };

      mockDocumentRepository.findById.mockResolvedValue(submittedDocument);

      await documentService.autoSaveDocument('doc-1', content, 'user-1');

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentRepository.createAutoSave).not.toHaveBeenCalled();
    });
  });

  describe('generateDocumentPDF', () => {
    it('should generate PDF successfully', async () => {
      const pdfBuffer = Buffer.from('PDF content');

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockPDFGenerationService.generateDocumentPDF.mockResolvedValue(pdfBuffer);

      const result = await documentService.generateDocumentPDF('doc-1');

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockPDFGenerationService.generateDocumentPDF).toHaveBeenCalledWith(mockDocument, {});
      expect(result).toEqual(pdfBuffer);
    });

    it('should throw error if document not found', async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      await expect(documentService.generateDocumentPDF('invalid-id'))
        .rejects.toThrow('Document not found');
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockFileStorageService.deleteFile.mockResolvedValue();
      mockDocumentRepository.delete.mockResolvedValue();

      await documentService.deleteDocument('doc-1');

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith('doc-1');
      expect(mockDocumentRepository.delete).toHaveBeenCalledWith('doc-1');
    });

    it('should throw error if document is not in draft status', async () => {
      const submittedDocument = { ...mockDocument, status: 'submitted' as DocumentStatus };
      mockDocumentRepository.findById.mockResolvedValue(submittedDocument);

      await expect(documentService.deleteDocument('doc-1'))
        .rejects.toThrow('Can only delete documents in draft status');
    });
  });
});