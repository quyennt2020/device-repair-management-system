import { 
  Document, 
  CreateDocumentRequest, 
  UpdateDocumentRequest, 
  SubmitDocumentRequest,
  ApproveDocumentRequest,
  RejectDocumentRequest,
  DocumentStatus,
  UUID 
} from '../types';
import { DocumentRepository } from '../repositories/document.repository';
import { AttachmentRepository, CreateAttachmentRequest } from '../repositories/attachment.repository';
import { DocumentTypeRepository } from '../repositories/document-type.repository';
import { FileStorageService, FileUpload } from './file-storage.service';
import { PDFGenerationService, PDFGenerationOptions } from './pdf-generation.service';
import { DocumentTemplateService } from './document-template.service';

export class DocumentService {
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

  // Document CRUD Operations
  async createDocument(request: CreateDocumentRequest, createdBy: UUID): Promise<Document> {
    // Validate document type exists
    const documentType = await this.documentTypeRepository.findById(request.documentTypeId);
    if (!documentType) {
      throw new Error('Document type not found');
    }

    // Validate content against template
    const validation = await this.documentTemplateService.validateDocumentContent(
      request.documentTypeId,
      request.content
    );

    if (!validation.isValid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    return this.documentRepository.create(request, createdBy);
  }

  async getDocument(id: UUID): Promise<Document | null> {
    return this.documentRepository.findById(id);
  }

  async updateDocument(id: UUID, request: UpdateDocumentRequest, updatedBy: UUID): Promise<Document> {
    const existingDocument = await this.documentRepository.findById(id);
    if (!existingDocument) {
      throw new Error('Document not found');
    }

    // Only allow updates if document is in draft status
    if (existingDocument.status !== 'draft') {
      throw new Error('Can only update documents in draft status');
    }

    // Validate content against template
    const validation = await this.documentTemplateService.validateDocumentContent(
      existingDocument.documentTypeId,
      request.content
    );

    if (!validation.isValid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    return this.documentRepository.update(id, request, updatedBy);
  }

  async deleteDocument(id: UUID): Promise<void> {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new Error('Document not found');
    }

    // Only allow deletion if document is in draft status
    if (document.status !== 'draft') {
      throw new Error('Can only delete documents in draft status');
    }

    // Delete associated files
    for (const attachment of document.attachments) {
      await this.fileStorageService.deleteFile(attachment.filePath);
    }

    await this.documentRepository.delete(id);
  }

  async getDocumentsByCase(caseId: UUID): Promise<Document[]> {
    return this.documentRepository.findByCaseId(caseId);
  }

  async getDocumentsByStepExecution(stepExecutionId: UUID): Promise<Document[]> {
    return this.documentRepository.findByStepExecutionId(stepExecutionId);
  }

  // Document Status Management
  async submitDocument(request: SubmitDocumentRequest): Promise<void> {
    const document = await this.documentRepository.findById(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'draft') {
      throw new Error('Can only submit documents in draft status');
    }

    // Final validation before submission
    const validation = await this.documentTemplateService.validateDocumentContent(
      document.documentTypeId,
      document.content
    );

    if (!validation.isValid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if document type has approval workflow configured
    const documentType = await this.documentTypeRepository.findById(document.documentTypeId);
    if (documentType?.approvalWorkflowId) {
      // Document has approval workflow - will be handled by approval workflow service
      // Status will be updated by the approval workflow service
      return;
    }

    // No approval workflow - directly approve
    await this.documentRepository.updateStatus(request.documentId, 'approved');
  }

  async approveDocument(request: ApproveDocumentRequest): Promise<void> {
    const document = await this.documentRepository.findById(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!['submitted', 'under_review'].includes(document.status)) {
      throw new Error('Can only approve documents that are submitted or under review');
    }

    // TODO: Create approval record
    // TODO: Check if all required approvals are complete
    // For now, just update status to approved
    await this.documentRepository.updateStatus(request.documentId, 'approved');
  }

  async rejectDocument(request: RejectDocumentRequest): Promise<void> {
    const document = await this.documentRepository.findById(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (!['submitted', 'under_review'].includes(document.status)) {
      throw new Error('Can only reject documents that are submitted or under review');
    }

    // TODO: Create rejection record with reason
    await this.documentRepository.updateStatus(request.documentId, 'rejected');
  }

  // File Upload and Attachment Management
  async uploadAttachment(documentId: UUID, file: FileUpload, uploadedBy: UUID): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Validate file
    this.fileStorageService.validateFileSize(file.size, 10); // 10MB limit
    this.fileStorageService.validateFileType(file.mimeType, [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]);

    // Store file
    const storedFile = await this.fileStorageService.storeFile(file, documentId);

    // Create attachment record
    const attachmentRequest: CreateAttachmentRequest = {
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

  async uploadImage(documentId: UUID, file: FileUpload, uploadedBy: UUID): Promise<string> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Validate image
    this.fileStorageService.validateFileSize(file.size, 5); // 5MB limit for images
    this.fileStorageService.validateFileType(file.mimeType, [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]);

    // Store image
    const storedFile = await this.fileStorageService.storeImage(file, documentId);

    // Create attachment record
    const attachmentRequest: CreateAttachmentRequest = {
      documentId,
      fileName: storedFile.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileSize: file.size,
      filePath: storedFile.filePath,
      uploadedBy
    };

    await this.attachmentRepository.create(attachmentRequest);

    return storedFile.url;
  }

  async deleteAttachment(attachmentId: UUID): Promise<void> {
    const attachment = await this.attachmentRepository.findById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Delete file from storage
    await this.fileStorageService.deleteFile(attachment.filePath);

    // Delete attachment record
    await this.attachmentRepository.delete(attachmentId);
  }

  // Auto-save functionality
  async autoSaveDocument(documentId: UUID, content: any, userId: UUID): Promise<void> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Only auto-save for draft documents
    if (document.status !== 'draft') {
      return;
    }

    await this.documentRepository.createAutoSave(documentId, content, userId);
  }

  async getAutoSave(documentId: UUID): Promise<any | null> {
    return this.documentRepository.getAutoSave(documentId);
  }

  async restoreFromAutoSave(documentId: UUID, userId: UUID): Promise<Document> {
    const autoSaveContent = await this.documentRepository.getAutoSave(documentId);
    if (!autoSaveContent) {
      throw new Error('No auto-save data found');
    }

    const updateRequest: UpdateDocumentRequest = {
      content: autoSaveContent
    };

    return this.updateDocument(documentId, updateRequest, userId);
  }

  // PDF Generation and Preview
  async generateDocumentPDF(documentId: UUID, options: PDFGenerationOptions = {}): Promise<Buffer> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    return this.pdfGenerationService.generateDocumentPDF(document, options);
  }

  async generatePreviewPDF(documentTypeId: UUID, content: any, options: PDFGenerationOptions = {}): Promise<Buffer> {
    return this.pdfGenerationService.generatePreviewPDF(documentTypeId, content, options);
  }

  // Document Versioning
  async getDocumentVersions(documentId: UUID): Promise<Document[]> {
    return this.documentRepository.getDocumentVersions(documentId);
  }

  async createDocumentVersion(documentId: UUID, content: any, userId: UUID): Promise<Document> {
    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    const updateRequest: UpdateDocumentRequest = {
      content,
      version: document.version + 1
    };

    return this.updateDocument(documentId, updateRequest, userId);
  }

  // Rich Text Content Processing
  async processRichTextContent(content: string, documentId: UUID): Promise<string> {
    // Process embedded images and convert to proper URLs
    // This would handle base64 images from rich text editors
    let processedContent = content;

    // Find base64 images in the content
    const base64ImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"/g;
    let match;

    while ((match = base64ImageRegex.exec(content)) !== null) {
      const [fullMatch, imageType, base64Data] = match;
      
      try {
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Create file upload object
        const file: FileUpload = {
          buffer,
          originalName: `embedded-image.${imageType}`,
          mimeType: `image/${imageType}`,
          size: buffer.length
        };

        // Store the image
        const imageUrl = await this.uploadImage(documentId, file, 'system');
        
        // Replace base64 with URL
        processedContent = processedContent.replace(fullMatch, `<img src="${imageUrl}"`);
      } catch (error) {
        console.error('Failed to process embedded image:', error);
      }
    }

    return processedContent;
  }
}