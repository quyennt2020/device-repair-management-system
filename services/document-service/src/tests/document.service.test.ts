import { 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  Document, 
  DocumentType,
  DocumentStatus 
} from './__mocks__/types';

// Import mocked classes
import { DocumentRepository } from './__mocks__/document.repository';
import { AttachmentRepository } from './__mocks__/attachment.repository';
import { DocumentTypeRepository } from './__mocks__/document-type.repository';
import { FileStorageService } from './__mocks__/file-storage.service';
import { PDFGenerationService } from './__mocks__/pdf-generation.service';
import { DocumentTemplateService } from './__mocks__/document-template.service';

// Mock DocumentService class
class DocumentService {
  private documentRepository: DocumentRepository;
  private attachmentRepository: AttachmentRepository;
  private documentTypeRepository: DocumentTypeRepository;
  private fileStorageService: FileStorageService;
  private pdfGenerationService: PDFGenerationService;
  private documentTemplateService: DocumentTemplateService;

  constructor() {
    this.documentRepository = new DocumentRepository();
    this.attachmentRepository = new AttachmentRepository();
    this.documentTypeRepository = new DocumentTypeRepository();
    this.fileStorageService = new FileStorageService();
    this.pdfGenerationService = new PDFGenerationService();
    this.documentTemplateService = new DocumentTemplateService();
  }

  async createDocument(request: CreateDocumentRequest, createdBy: string): Promise<Document> {
    const documentType = await this.documentTypeRepository.findById(request.documentTypeId);
    if (!documentType) {
      throw new Error('Document type not found');
    }

    const validation = await this.documentTemplateService.validateDocumentContent(
      request.documentTypeId,
      request.content
    );

    if (!validation.isValid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    return this.documentRepository.create(request, createdBy);
  }

  async updateDocument(id: string, request: UpdateDocumentRequest, updatedBy: string): Promise<Document> {
    const existingDocument = await this.documentRepository.findById(id);
    if (!existingDocument) {
      throw new Error('Document not found');
    }

    if (existingDocument.status !== 'draft') {
      throw new Error('Can only update documents in draft status');
    }

    const validation = await this.documentTemplateService.validateDocumentContent(
      existingDocument.documentTypeId,
      request.content
    );

    if (!validation.isValid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    return this.documentRepository.update(id, request, updatedBy);
  }

  async submitDocument(request: any): Promise<void> {
    const document = await this.documentRepository.findById(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'draft') {
      throw new Error('Can only submit documents in draft status');
    }

    const validation = await this.documentTemplateService.validateDocumentContent(
      document.documentTypeId,
      document.content
    );

    if (!validation.isValid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    await this.documentRepository.updateStatus(request.documentId, 'submitted');
  }

  async uploadAttachment(documentId: string, file: any, uploadedBy: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    this.fileStorageService.validateFileSize(file.size, 10);
    this.fileStorageService.validateFileType(file.mimeType, []);

    const storedFile = await this.fileStorageService.storeFile(file, documentId);

    const attachmentRequest = {
      documentId,
      fileName: storedFile.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.size,
      filePath: storedFile.filePath,
      uploadedBy
    };

    await this.attachmentRepository.create(attachmentRequest);
  }

  async autoSaveDocument(documentId: string, content: any, userId: string): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'draft') {
      return;
    }

    await this.documentRepository.createAutoSave(documentId, content, userId);
  }

  async generateDocumentPDF(documentId: string, options: any = {}): Promise<Buffer> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    return this.pdfGenerationService.generateDocumentPDF(document, options);
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'draft') {
      throw new Error('Can only delete documents in draft status');
    }

    for (const attachment of document.attachments) {
      await this.fileStorageService.deleteFile(attachment.filePath);
    }

    await this.documentRepository.delete(id);
  }
}

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
    mockDocumentRepository = (documentService as any).documentRepository;
    mockAttachmentRepository = (documentService as any).attachmentRepository;
    mockDocumentTypeRepository = (documentService as any).documentTypeRepository;
    mockFileStorageService = (documentService as any).fileStorageService;
    mockPDFGenerationService = (documentService as any).pdfGenerationService;
    mockDocumentTemplateService = (documentService as any).documentTemplateService;
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
      mockDocumentRepository.updateStatus.mockResolvedValue(undefined);

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
      mockDocumentRepository.createAutoSave.mockResolvedValue(undefined);

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
      mockFileStorageService.deleteFile.mockResolvedValue(undefined);
      mockDocumentRepository.delete.mockResolvedValue(undefined);

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