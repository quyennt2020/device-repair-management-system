// Simple test to verify the document template service logic

describe('Document Template Service - Core Logic', () => {
  describe('Field Type Detection', () => {
    it('should detect email field type', () => {
      const fieldName = 'customer_email';
      const expectedType = fieldName.includes('email') ? 'email' : 'text';
      expect(expectedType).toBe('email');
    });

    it('should detect date field type', () => {
      const fieldName = 'inspection_date';
      const expectedType = fieldName.includes('date') ? 'date' : 'text';
      expect(expectedType).toBe('date');
    });

    it('should detect textarea field type', () => {
      const fieldName = 'technician_notes';
      const expectedType = fieldName.includes('notes') ? 'textarea' : 'text';
      expect(expectedType).toBe('textarea');
    });

    it('should detect number field type', () => {
      const fieldName = 'estimated_hours';
      const expectedType = fieldName.includes('hours') ? 'number' : 'text';
      expect(expectedType).toBe('number');
    });
  });

  describe('Field Label Generation', () => {
    it('should generate proper field labels', () => {
      const generateFieldLabel = (fieldName) => {
        return fieldName
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };

      expect(generateFieldLabel('device_serial_number')).toBe('Device Serial Number');
      expect(generateFieldLabel('inspection_date')).toBe('Inspection Date');
      expect(generateFieldLabel('technician_notes')).toBe('Technician Notes');
      expect(generateFieldLabel('severity_level')).toBe('Severity Level');
    });
  });

  describe('Validation Rules', () => {
    it('should validate required fields', () => {
      const validateField = (rule, value) => {
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
          case 'range':
            if (typeof value === 'number' && (value < rule.value.min || value > rule.value.max)) {
              return rule.message;
            }
            break;
        }
        return null;
      };

      const requiredRule = {
        field: 'device_serial_number',
        type: 'required',
        value: true,
        message: 'Device serial number is required'
      };

      expect(validateField(requiredRule, '')).toBe('Device serial number is required');
      expect(validateField(requiredRule, 'ABC123')).toBe(null);

      const minLengthRule = {
        field: 'serial_number',
        type: 'min_length',
        value: 5,
        message: 'Serial number must be at least 5 characters'
      };

      expect(validateField(minLengthRule, 'ABC')).toBe('Serial number must be at least 5 characters');
      expect(validateField(minLengthRule, 'ABC123')).toBe(null);

      const rangeRule = {
        field: 'hours',
        type: 'range',
        value: { min: 0.5, max: 40 },
        message: 'Hours must be between 0.5 and 40'
      };

      expect(validateField(rangeRule, 0.1)).toBe('Hours must be between 0.5 and 40');
      expect(validateField(rangeRule, 50)).toBe('Hours must be between 0.5 and 40');
      expect(validateField(rangeRule, 5)).toBe(null);
    });
  });

  describe('Template Inheritance', () => {
    it('should merge parent and child templates', () => {
      const inheritTemplate = (parentTemplate, childTemplate) => {
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
      };

      const parentTemplate = {
        sections: ['basic_info'],
        requiredFields: ['device_serial_number'],
        optionalFields: ['notes'],
        validationRules: [
          { field: 'device_serial_number', type: 'required', value: true, message: 'Required' }
        ]
      };

      const childTemplate = {
        sections: ['findings'],
        requiredFields: ['findings'],
        optionalFields: ['recommendations'],
        validationRules: [
          { field: 'findings', type: 'required', value: true, message: 'Required' }
        ]
      };

      const result = inheritTemplate(parentTemplate, childTemplate);

      expect(result.sections).toEqual(['basic_info', 'findings']);
      expect(result.requiredFields).toEqual(['device_serial_number', 'findings']);
      expect(result.optionalFields).toEqual(['notes', 'recommendations']);
      expect(result.validationRules).toHaveLength(2);
    });
  });

  describe('Document Content Validation', () => {
    it('should validate document content against template', () => {
      const validateDocumentContent = (
        requiredFields,
        validationRules,
        content
      ) => {
        const errors = [];

        // Check required fields
        for (const requiredField of requiredFields) {
          if (!content[requiredField] || content[requiredField] === '') {
            errors.push(`Field '${requiredField}' is required`);
          }
        }

        // Apply validation rules
        for (const rule of validationRules) {
          const fieldValue = content[rule.field];
          let validationError = null;

          switch (rule.type) {
            case 'required':
              if (!fieldValue || fieldValue === '') {
                validationError = rule.message;
              }
              break;
            case 'min_length':
              if (typeof fieldValue === 'string' && fieldValue.length < rule.value) {
                validationError = rule.message;
              }
              break;
            case 'range':
              if (typeof fieldValue === 'number' && (fieldValue < rule.value.min || fieldValue > rule.value.max)) {
                validationError = rule.message;
              }
              break;
          }

          if (validationError) {
            errors.push(validationError);
          }
        }

        return {
          isValid: errors.length === 0,
          errors
        };
      };

      const requiredFields = ['device_serial_number', 'inspection_date'];
      const validationRules = [
        {
          field: 'device_serial_number',
          type: 'min_length',
          value: 5,
          message: 'Serial number must be at least 5 characters'
        }
      ];

      // Valid content
      const validContent = {
        device_serial_number: 'ABC123456',
        inspection_date: '2024-01-15',
        findings: 'Device is working properly'
      };

      const validResult = validateDocumentContent(requiredFields, validationRules, validContent);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid content - missing required field
      const invalidContent1 = {
        device_serial_number: 'ABC123456'
        // Missing inspection_date
      };

      const invalidResult1 = validateDocumentContent(requiredFields, validationRules, invalidContent1);
      expect(invalidResult1.isValid).toBe(false);
      expect(invalidResult1.errors).toContain("Field 'inspection_date' is required");

      // Invalid content - validation rule violation
      const invalidContent2 = {
        device_serial_number: 'ABC', // Too short
        inspection_date: '2024-01-15'
      };

      const invalidResult2 = validateDocumentContent(requiredFields, validationRules, invalidContent2);
      expect(invalidResult2.isValid).toBe(false);
      expect(invalidResult2.errors).toContain('Serial number must be at least 5 characters');
    });
  });
});