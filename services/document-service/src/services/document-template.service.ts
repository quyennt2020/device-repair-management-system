import { DocumentTypeRepository } from '../repositories/document-type.repository';
import { 
  DocumentType, 
  DocumentTemplate, 
  DocumentCategory, 
  ValidationRule, 
  UUID,
  TemplateLayout,
  LayoutSection
} from '../types';
import { createError } from '../middleware/error.middleware';

export interface DynamicFormField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'image';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: ValidationRule[];
  section: string;
  order: number;
  defaultValue?: any;
  helpText?: string;
  dependsOn?: string; // Field dependency
  showWhen?: any; // Conditional display
}

export interface DynamicForm {
  documentTypeId: UUID;
  documentTypeName: string;
  category: DocumentCategory;
  sections: FormSection[];
  validationRules: ValidationRule[];
  version: string;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: DynamicFormField[];
  order: number;
  collapsible: boolean;
}

export interface TemplateInheritance {
  parentTemplateId?: UUID;
  inheritedFields: string[];
  overriddenFields: string[];
  addedFields: string[];
}

export class DocumentTemplateService {
  private documentTypeRepository: DocumentTypeRepository;

  constructor() {
    this.documentTypeRepository = new DocumentTypeRepository();
  }

  async createDocumentType(data: {
    name: string;
    category: DocumentCategory;
    templateConfig: DocumentTemplate;
    requiredFields: string[];
    approvalWorkflowId?: UUID;
    parentTemplateId?: UUID;
  }): Promise<DocumentType> {
    // Handle template inheritance if parent is specified
    let finalTemplateConfig = data.templateConfig;
    
    if (data.parentTemplateId) {
      const parentTemplate = await this.documentTypeRepository.findById(data.parentTemplateId);
      if (!parentTemplate) {
        throw createError('Parent template not found', 404);
      }
      
      finalTemplateConfig = this.inheritTemplate(parentTemplate.templateConfig, data.templateConfig);
    }

    // Validate template configuration
    this.validateTemplateConfig(finalTemplateConfig);

    return await this.documentTypeRepository.create({
      name: data.name,
      category: data.category,
      templateConfig: finalTemplateConfig,
      requiredFields: data.requiredFields,
      approvalWorkflowId: data.approvalWorkflowId,
      isActive: true
    });
  }

  async generateDynamicForm(
    deviceTypeId: UUID, 
    documentCategory: DocumentCategory,
    documentTypeId?: UUID
  ): Promise<DynamicForm> {
    let documentType: DocumentType | null;

    if (documentTypeId) {
      documentType = await this.documentTypeRepository.findById(documentTypeId);
    } else {
      // Find the most appropriate document type for this device type and category
      const documentTypes = await this.documentTypeRepository.findByDeviceTypeAndCategory(
        deviceTypeId, 
        documentCategory
      );
      documentType = documentTypes[0] || null;
    }

    if (!documentType) {
      throw createError(`No document type found for category ${documentCategory}`, 404);
    }

    return this.buildDynamicForm(documentType, deviceTypeId);
  }

  async updateDocumentType(
    id: UUID, 
    updates: Partial<DocumentType>,
    createNewVersion: boolean = false
  ): Promise<DocumentType> {
    const existingType = await this.documentTypeRepository.findById(id);
    if (!existingType) {
      throw createError('Document type not found', 404);
    }

    if (createNewVersion) {
      // Create a new version instead of updating existing
      const newVersion = await this.createNewVersion(existingType, updates);
      return newVersion;
    }

    if (updates.templateConfig) {
      this.validateTemplateConfig(updates.templateConfig);
    }

    return await this.documentTypeRepository.update(id, updates);
  }

  async getDocumentTypesByCategory(category: DocumentCategory): Promise<DocumentType[]> {
    return await this.documentTypeRepository.findByCategory(category);
  }

  async validateDocumentContent(
    documentTypeId: UUID, 
    content: Record<string, any>
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const documentType = await this.documentTypeRepository.findById(documentTypeId);
    if (!documentType) {
      throw createError('Document type not found', 404);
    }

    const errors: string[] = [];

    // Check required fields
    for (const requiredField of documentType.requiredFields) {
      if (!content[requiredField] || content[requiredField] === '') {
        errors.push(`Field '${requiredField}' is required`);
      }
    }

    // Apply validation rules
    if (documentType.templateConfig.validationRules) {
      for (const rule of documentType.templateConfig.validationRules) {
        const fieldValue = content[rule.field];
        const validationError = this.validateField(rule, fieldValue);
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private buildDynamicForm(documentType: DocumentType, deviceTypeId: UUID): DynamicForm {
    const template = documentType.templateConfig;
    const sections: FormSection[] = [];

    // Build sections from template layout
    if (template.layout?.sections) {
      for (const layoutSection of template.layout.sections) {
        const formSection: FormSection = {
          id: layoutSection.id,
          title: layoutSection.title,
          fields: [],
          order: layoutSection.order,
          collapsible: layoutSection.collapsible || false
        };

        // Build fields for this section
        for (const fieldName of layoutSection.fields) {
          const field = this.buildFormField(
            fieldName, 
            template, 
            documentType.requiredFields,
            layoutSection.id
          );
          if (field) {
            formSection.fields.push(field);
          }
        }

        // Sort fields by order
        formSection.fields.sort((a, b) => a.order - b.order);
        sections.push(formSection);
      }
    } else {
      // Create default section if no layout is specified
      const defaultSection: FormSection = {
        id: 'default',
        title: 'Document Information',
        fields: [],
        order: 1,
        collapsible: false
      };

      // Add all fields to default section
      const allFields = [...template.requiredFields, ...(template.optionalFields || [])];
      allFields.forEach((fieldName, index) => {
        const field = this.buildFormField(
          fieldName, 
          template, 
          documentType.requiredFields,
          'default'
        );
        if (field) {
          field.order = index + 1;
          defaultSection.fields.push(field);
        }
      });

      sections.push(defaultSection);
    }

    return {
      documentTypeId: documentType.id,
      documentTypeName: documentType.name,
      category: documentType.category,
      sections: sections.sort((a, b) => a.order - b.order),
      validationRules: template.validationRules || [],
      version: '1.0' // TODO: Implement proper versioning
    };
  }

  private buildFormField(
    fieldName: string,
    template: DocumentTemplate,
    requiredFields: string[],
    sectionId: string
  ): DynamicFormField | null {
    // This would be enhanced with field metadata from configuration
    const isRequired = requiredFields.includes(fieldName);
    const validationRules = template.validationRules?.filter(rule => rule.field === fieldName) || [];

    // Determine field type based on field name patterns
    let fieldType: DynamicFormField['type'] = 'text';
    let options: { value: string; label: string }[] | undefined;

    if (fieldName.includes('email')) {
      fieldType = 'email';
    } else if (fieldName.includes('date')) {
      fieldType = 'date';
    } else if (fieldName.includes('notes') || fieldName.includes('description')) {
      fieldType = 'textarea';
    } else if (fieldName.includes('rating') || fieldName.includes('hours')) {
      fieldType = 'number';
    } else if (fieldName.includes('severity') || fieldName.includes('priority')) {
      fieldType = 'select';
      options = this.getOptionsForField(fieldName);
    } else if (fieldName.includes('image') || fieldName.includes('photo')) {
      fieldType = 'image';
    } else if (fieldName.includes('file') || fieldName.includes('attachment')) {
      fieldType = 'file';
    }

    return {
      id: fieldName,
      name: fieldName,
      label: this.generateFieldLabel(fieldName),
      type: fieldType,
      required: isRequired,
      placeholder: this.generatePlaceholder(fieldName, fieldType),
      options,
      validation: validationRules,
      section: sectionId,
      order: 1, // Will be set by caller
      helpText: this.generateHelpText(fieldName)
    };
  }

  private getOptionsForField(fieldName: string): { value: string; label: string }[] {
    const optionsMap: Record<string, { value: string; label: string }[]> = {
      severity: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' }
      ],
      priority: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'immediate', label: 'Immediate' }
      ],
      condition: [
        { value: 'excellent', label: 'Excellent' },
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
        { value: 'poor', label: 'Poor' },
        { value: 'critical', label: 'Critical' }
      ]
    };

    for (const [key, options] of Object.entries(optionsMap)) {
      if (fieldName.toLowerCase().includes(key)) {
        return options;
      }
    }

    return [];
  }

  private generateFieldLabel(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generatePlaceholder(fieldName: string, fieldType: string): string {
    if (fieldType === 'email') return 'Enter email address';
    if (fieldType === 'date') return 'Select date';
    if (fieldType === 'number') return 'Enter number';
    if (fieldType === 'textarea') return `Enter ${this.generateFieldLabel(fieldName).toLowerCase()}`;
    
    return `Enter ${this.generateFieldLabel(fieldName).toLowerCase()}`;
  }

  private generateHelpText(fieldName: string): string | undefined {
    const helpTextMap: Record<string, string> = {
      severity_level: 'Select the severity level based on the impact of the issue',
      estimated_hours: 'Estimated time required to complete the repair',
      customer_satisfaction_rating: 'Rate from 1-5 based on customer feedback'
    };

    return helpTextMap[fieldName];
  }

  private inheritTemplate(parentTemplate: DocumentTemplate, childTemplate: DocumentTemplate): DocumentTemplate {
    return {
      sections: [...parentTemplate.sections, ...childTemplate.sections],
      requiredFields: [...parentTemplate.requiredFields, ...childTemplate.requiredFields],
      optionalFields: [
        ...(parentTemplate.optionalFields || []),
        ...(childTemplate.optionalFields || [])
      ],
      validationRules: [
        ...(parentTemplate.validationRules || []),
        ...(childTemplate.validationRules || [])
      ],
      layout: childTemplate.layout || parentTemplate.layout
    };
  }

  private validateTemplateConfig(template: DocumentTemplate): void {
    if (!template.sections || template.sections.length === 0) {
      throw createError('Template must have at least one section', 400);
    }

    if (!template.requiredFields || template.requiredFields.length === 0) {
      throw createError('Template must have at least one required field', 400);
    }

    // Validate validation rules
    if (template.validationRules) {
      for (const rule of template.validationRules) {
        if (!rule.field || !rule.type || !rule.message) {
          throw createError('Invalid validation rule: field, type, and message are required', 400);
        }
      }
    }
  }

  private validateField(rule: ValidationRule, value: any): string | null {
    switch (rule.type) {
      case 'required':
        if (!value || value === '') {
          return rule.message;
        }
        break;
      
      case 'min_length':
        if (typeof value === 'string' && value.length < rule.value) {
          return rule.message;
        }
        break;
      
      case 'max_length':
        if (typeof value === 'string' && value.length > rule.value) {
          return rule.message;
        }
        break;
      
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          return rule.message;
        }
        break;
      
      case 'range':
        if (typeof value === 'number' && (value < rule.value.min || value > rule.value.max)) {
          return rule.message;
        }
        break;
    }

    return null;
  }

  private async createNewVersion(
    existingType: DocumentType, 
    updates: Partial<DocumentType>
  ): Promise<DocumentType> {
    // Deactivate the old version
    await this.documentTypeRepository.update(existingType.id, { isActive: false });

    // Create new version with incremented version number
    const newVersionName = `${existingType.name} v2.0`; // Simple versioning
    
    return await this.documentTypeRepository.create({
      name: updates.name || newVersionName,
      category: updates.category || existingType.category,
      templateConfig: updates.templateConfig || existingType.templateConfig,
      requiredFields: updates.requiredFields || existingType.requiredFields,
      approvalWorkflowId: updates.approvalWorkflowId || existingType.approvalWorkflowId,
      isActive: true
    });
  }
}