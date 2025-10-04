import { DocumentTemplateService } from '../services/document-template.service';
import { DocumentTypeRepository } from '../repositories/document-type.repository';

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
    it('should generate dynamic form for inspection report', async () => {
      // Mock document type
      const mockDocumentType = {
        id: 'doc-type-001',
        name: 'Inspection Report',
        category: 'inspection_report',
        templateConfig: {
          sections: ['basic_info', 'findings'],
          requiredFields: ['device_serial_number', 'inspection_date'],
          optionalFields: ['technician_notes'],
          validationRules: [
            {
              field: 'device_serial_number',
              type: 'required',
              message: 'Device serial number is required'
            }
          ]
        },
        requiredFields: ['device_serial_number', 'inspection_date'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findByDeviceTypeAndCategory.mockResolvedValue([mockDocumentType]);

      const result = await service.generateDynamicForm(
        'device-001',
        'inspection_report'
      );

      expect(result).toBeDefined();
      expect(result.documentTypeId).toBe('doc-type-001');
      expect(result.category).toBe('inspection_report');
      expect(result.sections).toHaveLength(1); // Default section since no layout specified
      expect(result.sections[0].fields).toHaveLength(3); // 2 required + 1 optional
    });

    it('should throw error when no document type found', async () => {
      mockRepository.findByDeviceTypeAndCategory.mockResolvedValue([]);

      await expect(
        service.generateDynamicForm('device-001', 'inspection_report')
      ).rejects.toThrow('No document type found for category inspection_report');
    });
  });

  describe('validateDocumentContent', () => {
    it('should validate document content successfully', async () => {
      const mockDocumentType = {
        id: 'doc-type-001',
        name: 'Inspection Report',
        category: 'inspection_report',
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['device_serial_number'],
          optionalFields: [],
          validationRules: [
            {
              field: 'device_serial_number',
              type: 'min_length',
              value: 5,
              message: 'Serial number must be at least 5 characters'
            }
          ]
        },
        requiredFields: ['device_serial_number'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDocumentType);

      const content = {
        device_serial_number: 'ABC123456',
        inspection_date: '2024-01-15'
      };

      const result = await service.validateDocumentContent('doc-type-001', content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid content', async () => {
      const mockDocumentType = {
        id: 'doc-type-001',
        name: 'Inspection Report',
        category: 'inspection_report',
        templateConfig: {
          sections: ['basic_info'],
          requiredFields: ['device_serial_number'],
          optionalFields: [],
          validationRules: [
            {
              field: 'device_serial_number',
              type: 'min_length',
              value: 5,
              message: 'Serial number must be at least 5 characters'
            }
          ]
        },
        requiredFields: ['device_serial_number'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.findById.mockResolvedValue(mockDocumentType);

      const content = {
        device_serial_number: 'ABC' // Too short
      };

      const result = await service.validateDocumentContent('doc-type-001', content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Serial number must be at least 5 characters');
    });
  });

  describe('field type detection', () => {
    it('should detect email field type', () => {
      const service = new DocumentTemplateService();
      const field = (service as any).buildFormField(
        'customer_email',
        { requiredFields: [], optionalFields: [] },
        ['customer_email'],
        'basic_info'
      );

      expect(field.type).toBe('email');
      expect(field.label).toBe('Customer Email');
    });

    it('should detect date field type', () => {
      const service = new DocumentTemplateService();
      const field = (service as any).buildFormField(
        'inspection_date',
        { requiredFields: [], optionalFields: [] },
        ['inspection_date'],
        'basic_info'
      );

      expect(field.type).toBe('date');
      expect(field.label).toBe('Inspection Date');
    });

    it('should detect textarea field type', () => {
      const service = new DocumentTemplateService();
      const field = (service as any).buildFormField(
        'technician_notes',
        { requiredFields: [], optionalFields: [] },
        [],
        'basic_info'
      );

      expect(field.type).toBe('textarea');
      expect(field.label).toBe('Technician Notes');
    });

    it('should detect select field type with options', () => {
      const service = new DocumentTemplateService();
      const field = (service as any).buildFormField(
        'severity_level',
        { requiredFields: [], optionalFields: [] },
        ['severity_level'],
        'basic_info'
      );

      expect(field.type).toBe('select');
      expect(field.options).toBeDefined();
      expect(field.options.length).toBeGreaterThan(0);
      expect(field.options[0]).toHaveProperty('value');
      expect(field.options[0]).toHaveProperty('label');
    });
  });

  describe('template inheritance', () => {
    it('should inherit template fields correctly', () => {
      const service = new DocumentTemplateService();
      
      const parentTemplate = {
        sections: ['basic_info'],
        requiredFields: ['device_serial_number'],
        optionalFields: ['notes'],
        validationRules: [
          { field: 'device_serial_number', type: 'required', message: 'Required' }
        ]
      };

      const childTemplate = {
        sections: ['findings'],
        requiredFields: ['findings'],
        optionalFields: ['recommendations'],
        validationRules: [
          { field: 'findings', type: 'required', message: 'Required' }
        ]
      };

      const result = (service as any).inheritTemplate(parentTemplate, childTemplate);

      expect(result.sections).toEqual(['basic_info', 'findings']);
      expect(result.requiredFields).toEqual(['device_serial_number', 'findings']);
      expect(result.optionalFields).toEqual(['notes', 'recommendations']);
      expect(result.validationRules).toHaveLength(2);
    });
  });
});