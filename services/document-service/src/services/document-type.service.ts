import { DocumentTypeRepository } from '../repositories/document-type.repository';
import { DocumentTemplateService } from './document-template.service';
import { 
  DocumentType, 
  DocumentCategory, 
  DocumentTemplate, 
  UUID 
} from '../types';
import { createError } from '../middleware/error.middleware';

export interface CreateDocumentTypeRequest {
  name: string;
  category: DocumentCategory;
  templateConfig: DocumentTemplate;
  requiredFields: string[];
  approvalWorkflowId?: UUID;
  parentTemplateId?: UUID;
}

export interface UpdateDocumentTypeRequest {
  name?: string;
  category?: DocumentCategory;
  templateConfig?: DocumentTemplate;
  requiredFields?: string[];
  approvalWorkflowId?: UUID;
  isActive?: boolean;
}

export class DocumentTypeService {
  private documentTypeRepository: DocumentTypeRepository;
  private documentTemplateService: DocumentTemplateService;

  constructor() {
    this.documentTypeRepository = new DocumentTypeRepository();
    this.documentTemplateService = new DocumentTemplateService();
  }

  async createDocumentType(request: CreateDocumentTypeRequest): Promise<DocumentType> {
    // Validate that the name is unique within the category
    const existingTypes = await this.documentTypeRepository.findByCategory(request.category);
    const nameExists = existingTypes.some(type => 
      type.name.toLowerCase() === request.name.toLowerCase()
    );

    if (nameExists) {
      throw createError(`Document type with name '${request.name}' already exists in category '${request.category}'`, 409);
    }

    return await this.documentTemplateService.createDocumentType(request);
  }

  async getDocumentType(id: UUID): Promise<DocumentType> {
    const documentType = await this.documentTypeRepository.findById(id);
    if (!documentType) {
      throw createError('Document type not found', 404);
    }
    return documentType;
  }

  async getAllDocumentTypes(includeInactive: boolean = false): Promise<DocumentType[]> {
    return await this.documentTypeRepository.findAll(includeInactive);
  }

  async getDocumentTypesByCategory(category: DocumentCategory): Promise<DocumentType[]> {
    return await this.documentTypeRepository.findByCategory(category);
  }

  async updateDocumentType(
    id: UUID, 
    request: UpdateDocumentTypeRequest,
    createNewVersion: boolean = false
  ): Promise<DocumentType> {
    const existingType = await this.documentTypeRepository.findById(id);
    if (!existingType) {
      throw createError('Document type not found', 404);
    }

    // If updating name, check for uniqueness within category
    if (request.name && request.name !== existingType.name) {
      const category = request.category || existingType.category;
      const existingTypes = await this.documentTypeRepository.findByCategory(category);
      const nameExists = existingTypes.some(type => 
        type.id !== id && type.name.toLowerCase() === request.name.toLowerCase()
      );

      if (nameExists) {
        throw createError(`Document type with name '${request.name}' already exists in category '${category}'`, 409);
      }
    }

    return await this.documentTemplateService.updateDocumentType(id, request, createNewVersion);
  }

  async deactivateDocumentType(id: UUID): Promise<void> {
    const existingType = await this.documentTypeRepository.findById(id);
    if (!existingType) {
      throw createError('Document type not found', 404);
    }

    await this.documentTypeRepository.update(id, { isActive: false });
  }

  async deleteDocumentType(id: UUID): Promise<void> {
    // Check if document type is being used by any documents
    // This would require checking the documents table
    // For now, we'll just delete it
    await this.documentTypeRepository.delete(id);
  }

  async cloneDocumentType(
    sourceId: UUID, 
    newName: string, 
    modifications?: Partial<DocumentTemplate>
  ): Promise<DocumentType> {
    const sourceType = await this.documentTypeRepository.findById(sourceId);
    if (!sourceType) {
      throw createError('Source document type not found', 404);
    }

    let templateConfig = { ...sourceType.templateConfig };
    
    // Apply modifications if provided
    if (modifications) {
      templateConfig = {
        ...templateConfig,
        ...modifications,
        sections: modifications.sections || templateConfig.sections,
        requiredFields: modifications.requiredFields || templateConfig.requiredFields,
        optionalFields: modifications.optionalFields || templateConfig.optionalFields,
        validationRules: modifications.validationRules || templateConfig.validationRules
      };
    }

    return await this.createDocumentType({
      name: newName,
      category: sourceType.category,
      templateConfig,
      requiredFields: sourceType.requiredFields,
      approvalWorkflowId: sourceType.approvalWorkflowId
    });
  }

  async getDocumentTypeForDevice(
    deviceTypeId: UUID, 
    category: DocumentCategory
  ): Promise<DocumentType[]> {
    return await this.documentTypeRepository.findByDeviceTypeAndCategory(deviceTypeId, category);
  }

  async validateDocumentTypeConfiguration(templateConfig: DocumentTemplate): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate sections
    if (!templateConfig.sections || templateConfig.sections.length === 0) {
      errors.push('Template must have at least one section');
    }

    // Validate required fields
    if (!templateConfig.requiredFields || templateConfig.requiredFields.length === 0) {
      errors.push('Template must have at least one required field');
    }

    // Validate validation rules
    if (templateConfig.validationRules) {
      for (const rule of templateConfig.validationRules) {
        if (!rule.field || !rule.type || !rule.message) {
          errors.push(`Invalid validation rule: field '${rule.field}' is missing required properties`);
        }

        // Check if the field exists in required or optional fields
        const allFields = [
          ...templateConfig.requiredFields,
          ...(templateConfig.optionalFields || [])
        ];
        
        if (!allFields.includes(rule.field)) {
          warnings.push(`Validation rule for field '${rule.field}' but field is not defined in template`);
        }
      }
    }

    // Validate layout if provided
    if (templateConfig.layout) {
      const layoutFields = templateConfig.layout.sections.flatMap(section => section.fields);
      const templateFields = [
        ...templateConfig.requiredFields,
        ...(templateConfig.optionalFields || [])
      ];

      // Check for fields in layout that aren't in template
      for (const layoutField of layoutFields) {
        if (!templateFields.includes(layoutField)) {
          warnings.push(`Layout references field '${layoutField}' that is not defined in template`);
        }
      }

      // Check for template fields not in layout
      for (const templateField of templateFields) {
        if (!layoutFields.includes(templateField)) {
          warnings.push(`Template field '${templateField}' is not included in layout`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async getDocumentTypeUsageStats(id: UUID): Promise<{
    totalDocuments: number;
    documentsByStatus: Record<string, number>;
    averageCompletionTime: number;
    lastUsed: Date | null;
  }> {
    // This would query the documents table to get usage statistics
    // For now, return mock data
    return {
      totalDocuments: 0,
      documentsByStatus: {},
      averageCompletionTime: 0,
      lastUsed: null
    };
  }
}