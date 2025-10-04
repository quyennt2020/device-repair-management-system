// Test setup file

// Mock database connection and other dependencies
export const mockDb = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

// Mock shared types
export const mockDocumentType = {
  id: 'test-doc-type-id',
  name: 'Test Document Type',
  category: 'inspection_report',
  templateConfig: {
    sections: ['basic_info', 'findings'],
    requiredFields: ['device_serial_number', 'inspection_date'],
    optionalFields: ['technician_notes'],
    validationRules: []
  },
  requiredFields: ['device_serial_number', 'inspection_date'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockDocument = {
  id: 'test-document-id',
  caseId: 'test-case-id',
  documentTypeId: 'test-doc-type-id',
  stepExecutionId: null,
  content: {
    device_serial_number: 'ABC123456',
    inspection_date: '2024-01-15',
    findings: 'Device is working properly'
  },
  status: 'draft',
  version: 1,
  attachments: [],
  createdBy: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock shared database connection
jest.mock('../../../../shared/database/src/connection', () => ({
  getDbConnection: jest.fn(() => mockDb)
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3006';