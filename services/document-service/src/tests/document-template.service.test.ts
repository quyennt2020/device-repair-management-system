import { DocumentTemplateService } from '../services/document-template.service';
import { DocumentTypeRepository } from '../repositories/document-type.repository';
import { DocumentCategory, DocumentTemplate } from '../types';

// Mock the repository
jest.mock('../repositories/document-type.repository');

describe('DocumentTemplateService', () => {
  let service: DocumentTemplateService;
  let mockRepository: jest.Mocked<DocumentTypeRepository>;

  beforeEach(() => {
    service = new DocumentTemplateService();
    mockRepository = new DocumentTypeRepository() as jest.Mocked<DocumentTypeRepository>;
    (service as any).documentTypeRepository = mockRepository;
  });

  describe('generateDynamicForm', () => {
    it('should generate a dynamic form for inspection report', async () => {
      const mockDocumentType = {
        id: 'doc-type-1',
        name: 'Standard Inspection Report',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info', 'findings'],
          requiredFields: ['device_serial_number', 'inspection_date', 'findings'],
          optionalFields: ['technician_notes'],
          validationRules: [
            {
              field: 'device_serial_number',
              type: 'required' as const,
              value: true,
              message: 'Device serial number is required'
            }
          ],
          layout: {
            columns: 2,
            sections: [
              {
                id: 'basic_info',
                title: 'Basic Information',
                fields: ['device_serial_number', 'inspection_date'],
                order: 1,
                collapsible: false
              },
              {
                id: 'findings',
                title: 'Findings',
                fields: ['findings', 'technician_notes'],
                order: 2,
                collapsible: false
              }
            ]
          }
        } as DocumentTemplate,
        requiredFields: ['device_serial_number', 'inspection_date', 'findings'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findByDeviceTypeAndCategory.mockResolvedValue([mockDocumentType]);

      const result = await service.generateDynamicForm(
        'device-type-1',
        'inspection_report'
      );

      expect(result).toBeDefined();
      expect(result.documentTypeId).toBe('doc-type-1');
      expect(result.category).toBe('inspection_report');
      expect(result.sections).toHaveLength(2);
      
      const basicInfoSection = result.sections.find(s => s.id === 'basic_info');
      expect(basicInfoSection).toBeDefined();
      expect(basicInfoSection?.fields).toHaveLength(2);
      
      const deviceSerialField = basicInfoSection?.fields.find(f => f.name === 'device_serial_number');
      expect(deviceSerialField).toBeDefined();
      expect(deviceSerialField?.required).toBe(true);
      expect(deviceSerialField?.type).toBe('text');
    });

    it('should throw error when no document type found', async () => {
      mockRepository.findByDeviceTypeAndCategory.mockResolvedValue([]);

      await expect(
        service.generateDynamicForm('device-type-1', 'inspection_report')
      ).rejects.toThrow('No document type found for category inspection_report');
    });
  });

  describe('validateDocumentContent', () => {
    it('should validate document content successfully', async () => {
      const mockDocumentType = {
        id: 'doc-type-1',
        name: 'Test Document Type',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['device_serial_number', 'inspection_date'],
          validationRules: [
            {
              field: 'device_serial_number',
              type: 'min_length' as const,
              value: 5,
              message: 'Serial number must be at least 5 characters'
            }
          ]
        } as DocumentTemplate,
        requiredFields: ['device_serial_number', 'inspection_date'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDocumentType);

      const content = {
        device_serial_number: 'ABC123456',
        inspection_date: '2024-01-15',
        findings: 'Device is working properly'
      };

      const result = await service.validateDocumentContent('doc-type-1', content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for missing required fields', async () => {
      const mockDocumentType = {
        id: 'doc-type-1',
        name: 'Test Document Type',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['device_serial_number', 'inspection_date']
        } as DocumentTemplate,
        requiredFields: ['device_serial_number', 'inspection_date'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDocumentType);

      const content = {
        device_serial_number: 'ABC123456'
        // Missing inspection_date
      };

      const result = await service.validateDocumentContent('doc-type-1', content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Field 'inspection_date' is required");
    });

    it('should return validation errors for validation rule violations', async () => {
      const mockDocumentType = {
        id: 'doc-type-1',
        name: 'Test Document Type',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['device_serial_number'],
          validationRules: [
            {
              field: 'device_serial_number',
              type: 'min_length' as const,
              value: 10,
              message: 'Serial number must be at least 10 characters'
            }
          ]
        } as DocumentTemplate,
        requiredFields: ['device_serial_number'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDocumentType);

      const content = {
        device_serial_number: 'ABC123' // Too short
      };

      const result = await service.validateDocumentContent('doc-type-1', content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Serial number must be at least 10 characters');
    });
  });

  describe('createDocumentType', () => {
    it('should create a document type successfully', async () => {
      const mockCreatedType = {
        id: 'doc-type-1',
        name: 'New Document Type',
        category: 'custom' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['title']
        } as DocumentTemplate,
        requiredFields: ['title'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.create.mockResolvedValue(mockCreatedType);

      const request = {
        name: 'New Document Type',
        category: 'custom' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['title']
        } as DocumentTemplate,
        requiredFields: ['title']
      };

      const result = await service.createDocumentType(request);

      expect(result).toEqual(mockCreatedType);
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: 'New Document Type',
        category: 'custom',
        templateConfig: request.templateConfig,
        requiredFields: ['title'],
        approvalWorkflowId: undefined,
        isActive: true
      });
    });

    it('should handle template inheritance', async () => {
      const parentTemplate = {
        id: 'parent-type-1',
        name: 'Parent Template',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['device_serial_number'],
          optionalFields: ['notes']
        } as DocumentTemplate,
        requiredFields: ['device_serial_number'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCreatedType = {
        id: 'doc-type-1',
        name: 'Child Document Type',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['basic_info', 'findings'],
          requiredFields: ['device_serial_number', 'findings'],
          optionalFields: ['notes', 'recommendations']
        } as DocumentTemplate,
        requiredFields: ['device_serial_number', 'findings'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(parentTemplate);
      mockRepository.create.mockResolvedValue(mockCreatedType);

      const request = {
        name: 'Child Document Type',
        category: 'inspection_report' as DocumentCategory,
        templateConfig: {
          sections: ['findings'],
          requiredFields: ['findings'],
          optionalFields: ['recommendations']
        } as DocumentTemplate,
        requiredFields: ['findings'],
        parentTemplateId: 'parent-type-1'
      };

      const result = await service.createDocumentType(request);

      expect(result).toEqual(mockCreatedType);
      expect(mockRepository.findById).toHaveBeenCalledWith('parent-type-1');
    });
  });
});