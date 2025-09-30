// Re-export types from shared types
export * from '../../../../shared/types/src/document';
export * from '../../../../shared/types/src/common';

// Additional types specific to document service
export interface DocumentSearchCriteria {
  caseId?: string;
  documentTypeId?: string;
  status?: string;
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface DocumentSearchResult {
  documents: Document[];
  total: number;
  limit: number;
  offset: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface DynamicForm {
  sections: FormSection[];
  validationRules: ValidationRule[];
  metadata: FormMetadata;
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
  order: number;
  collapsible?: boolean;
  columns?: number;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FormFieldOption[];
  validation?: FieldValidation;
  defaultValue?: any;
  order: number;
}

export type FormFieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'image'
  | 'rich_text';

export interface FormFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customMessage?: string;
}

export interface FormMetadata {
  documentTypeId: string;
  deviceTypeId?: string;
  category: string;
  estimatedTime?: number;
  requiredCertifications?: string[];
  requiredTools?: string[];
}

export interface AutoSaveData {
  documentId: string;
  content: any;
  timestamp: Date;
  userId: string;
}

export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  url?: string;
  error?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
}

// Document-specific content interfaces
export interface InspectionReportContent {
  deviceCondition: string;
  visualInspection: string;
  functionalTests: any[];
  findings: InspectionFinding[];
  recommendedParts: RecommendedPart[];
  estimatedHours: number;
  severityLevel: string;
  technicianNotes: string;
  images: string[];
}

export interface QuotationContent {
  lineItems: QuotationLineItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  currency: string;
  validityPeriod: number;
  termsConditions: string;
  notes: string;
}

export interface RepairReportContent {
  workPerformed: string;
  partsReplaced: ReplacedPart[];
  proceduresPerformed: PerformedProcedure[];
  actualHours: number;
  testResults: TestResult[];
  technicianNotes: string;
  beforeImages: string[];
  afterImages: string[];
  customerSatisfactionRating?: number;
  customerComments?: string;
}

export interface MaintenanceReportContent {
  maintenanceType: string;
  checklistItems: MaintenanceChecklistItem[];
  overallCondition: string;
  recommendations: MaintenanceRecommendation[];
  nextMaintenanceDate?: string;
  maintenanceFrequencyMonths?: number;
  actualHours: number;
  materialsUsed: MaterialUsed[];
  technicianNotes: string;
  customerFeedback?: string;
}

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    statusCode: number;
    stack?: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Event interfaces for integration
export interface DocumentEvent {
  type: DocumentEventType;
  documentId: string;
  caseId: string;
  userId: string;
  timestamp: Date;
  data?: any;
}

export type DocumentEventType =
  | 'document_created'
  | 'document_updated'
  | 'document_submitted'
  | 'document_approved'
  | 'document_rejected'
  | 'document_deleted'
  | 'attachment_uploaded'
  | 'attachment_deleted';

// Configuration interfaces
export interface DocumentServiceConfig {
  uploadDir: string;
  maxFileSize: number;
  maxImageSize: number;
  allowedFileTypes: string[];
  allowedImageTypes: string[];
  autoSaveInterval: number;
  pdfOptions: {
    format: string;
    orientation: string;
    margin: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
  };
}

// Import the Document interface to avoid conflicts
import { Document as SharedDocument } from '../../../../shared/types/src/document';
export { SharedDocument as Document };