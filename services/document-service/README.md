# Document Service

The Document Service provides comprehensive document type and template management for the Device Repair Management System (DRMS). It enables dynamic form generation, document validation, and template inheritance.

## Features

### 1. Document Type Management
- Create, read, update, and delete document types
- Support for multiple document categories (inspection_report, repair_report, quotation, maintenance_report, etc.)
- Document type versioning and inheritance
- Template configuration with validation rules

### 2. Dynamic Form Generation
- Generate dynamic forms based on device type and document category
- Configurable field types (text, number, email, textarea, select, checkbox, date, file, image)
- Automatic field type detection based on field names
- Section-based form layout with collapsible sections

### 3. Template System
- Configurable document templates with sections and fields
- Template inheritance from parent templates
- Field validation rules (required, min_length, max_length, pattern, range)
- Layout configuration with multi-column support

### 4. Document Content Validation
- Real-time validation against document type templates
- Business rule enforcement
- Required field validation
- Custom validation rules

## API Endpoints

### Document Types
- `POST /api/document-types` - Create a new document type
- `GET /api/document-types` - Get all document types
- `GET /api/document-types/category/:category` - Get document types by category
- `GET /api/document-types/:id` - Get a specific document type
- `PUT /api/document-types/:id` - Update a document type
- `DELETE /api/document-types/:id` - Delete a document type
- `POST /api/document-types/:id/clone` - Clone a document type
- `POST /api/document-types/validate-configuration` - Validate template configuration

### Document Templates
- `GET /api/document-templates/form/:deviceTypeId/:category` - Generate dynamic form
- `GET /api/document-templates/preview/:documentTypeId` - Get form preview
- `GET /api/document-templates/suggestions/:category` - Get field suggestions for category
- `POST /api/document-templates/validate/:documentTypeId` - Validate document content

### Documents
- `POST /api/documents/validate` - Validate document content
- `GET /api/documents/form` - Get document form

## Document Categories

The service supports the following document categories:

1. **inspection_report** - Device inspection reports with findings and recommendations
2. **repair_report** - Repair work documentation with parts and procedures
3. **quotation** - Cost estimates and pricing information
4. **maintenance_report** - Preventive and corrective maintenance records
5. **proposal** - Service proposals and recommendations
6. **receipt** - Payment and transaction records
7. **quality_report** - Quality control and inspection results
8. **custom** - Custom document types

## Template Configuration

Document templates are configured using JSON structures that define:

```json
{
  "sections": ["basic_info", "findings", "recommendations"],
  "requiredFields": ["device_serial_number", "inspection_date", "findings"],
  "optionalFields": ["technician_notes", "images"],
  "validationRules": [
    {
      "field": "device_serial_number",
      "type": "min_length",
      "value": 5,
      "message": "Serial number must be at least 5 characters"
    }
  ],
  "layout": {
    "columns": 2,
    "sections": [
      {
        "id": "basic_info",
        "title": "Basic Information",
        "fields": ["device_serial_number", "inspection_date"],
        "order": 1,
        "collapsible": false
      }
    ]
  }
}
```

## Field Types

The service automatically detects field types based on field names:

- **email** - Fields containing 'email'
- **date** - Fields containing 'date'
- **textarea** - Fields containing 'notes' or 'description'
- **number** - Fields containing 'hours' or 'rating'
- **select** - Fields containing 'severity', 'priority', or 'condition'
- **image** - Fields containing 'image' or 'photo'
- **file** - Fields containing 'file' or 'attachment'
- **text** - Default field type

## Validation Rules

Supported validation rule types:

1. **required** - Field must have a value
2. **min_length** - Minimum string length
3. **max_length** - Maximum string length
4. **pattern** - Regular expression pattern matching
5. **range** - Numeric range validation (min/max values)

## Template Inheritance

Document types can inherit from parent templates:

```javascript
const childTemplate = await documentTemplateService.createDocumentType({
  name: 'Advanced Inspection Report',
  category: 'inspection_report',
  templateConfig: {
    sections: ['advanced_findings'], // Additional sections
    requiredFields: ['advanced_analysis'], // Additional required fields
    // ... other config
  },
  requiredFields: ['advanced_analysis'],
  parentTemplateId: 'parent-template-id' // Inherit from parent
});
```

## Usage Examples

### Creating a Document Type

```javascript
const documentType = await documentTypeService.createDocumentType({
  name: 'Standard Inspection Report',
  category: 'inspection_report',
  templateConfig: {
    sections: ['basic_info', 'findings'],
    requiredFields: ['device_serial_number', 'inspection_date', 'findings'],
    optionalFields: ['technician_notes'],
    validationRules: [
      {
        field: 'device_serial_number',
        type: 'required',
        value: true,
        message: 'Device serial number is required'
      }
    ]
  },
  requiredFields: ['device_serial_number', 'inspection_date', 'findings']
});
```

### Generating a Dynamic Form

```javascript
const dynamicForm = await documentTemplateService.generateDynamicForm(
  'device-type-id',
  'inspection_report'
);

// Returns structured form with sections and fields
console.log(dynamicForm.sections);
```

### Validating Document Content

```javascript
const validation = await documentTemplateService.validateDocumentContent(
  'document-type-id',
  {
    device_serial_number: 'ABC123456',
    inspection_date: '2024-01-15',
    findings: 'Device is working properly'
  }
);

if (!validation.isValid) {
  console.log('Validation errors:', validation.errors);
}
```

## Testing

The service includes comprehensive tests covering:

- Field type detection logic
- Field label generation
- Validation rule processing
- Template inheritance
- Document content validation

Run tests with:
```bash
npx jest src/tests/simple.test.js --config jest-simple.config.js
```

## Database Schema

The service uses the following database tables:

- `document_types` - Document type definitions and templates
- `documents` - Document instances
- `document_approvals` - Document approval workflow
- `inspection_reports` - Inspection report specific data
- `quotations` - Quotation specific data
- `repair_reports` - Repair report specific data
- `maintenance_reports` - Maintenance report specific data
- `maintenance_checklist_templates` - Maintenance checklist templates

## Configuration

Environment variables:

- `PORT` - Service port (default: 3006)
- `NODE_ENV` - Environment (development/production/test)
- Database connection settings (inherited from shared configuration)

## Integration

The Document Service integrates with:

- **Case Service** - Document creation and workflow integration
- **Device Service** - Device type information for form generation
- **Workflow Service** - Document approval workflows
- **Auth Service** - User authentication and authorization

## Implementation Status

✅ **Completed Features:**
- Document type management with CRUD operations
- Dynamic form generation based on device type and category
- Template configuration with validation rules
- Document content validation
- Template inheritance system
- Field type detection and form building
- Comprehensive test coverage for core logic

🔄 **Next Steps:**
- Integration with actual database (currently using mock types)
- File upload handling for attachments
- Document approval workflow integration
- Real-time form validation on frontend
- Template versioning and migration tools