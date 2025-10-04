import { AuditableEntity, UUID } from './common';

export interface Document extends AuditableEntity {
  caseId: UUID;
  documentTypeId: UUID;
  stepExecutionId?: UUID;
  status: DocumentStatus;
  content: DocumentContent;
  version: number;
  approvals: DocumentApproval[];
  attachments: Attachment[];
}

export type DocumentStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface DocumentType extends AuditableEntity {
  name: string;
  category: DocumentCategory;
  templateConfig: DocumentTemplate;
  requiredFields: string[];
  approvalWorkflowId?: UUID;
  isActive: boolean;
}

export type DocumentCategory = 
  | 'inspection_report'
  | 'repair_report'
  | 'quotation'
  | 'maintenance_report'
  | 'proposal'
  | 'receipt'
  | 'quality_report'
  | 'custom';

export interface DocumentTemplate {
  sections: string[];
  requiredFields: string[];
  optionalFields?: string[];
  validationRules?: ValidationRule[];
  layout?: TemplateLayout;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'min_length' | 'max_length' | 'pattern' | 'range';
  value: any;
  message: string;
}

export interface TemplateLayout {
  columns: number;
  sections: LayoutSection[];
}

export interface LayoutSection {
  id: string;
  title: string;
  fields: string[];
  order: number;
  collapsible?: boolean;
}

export interface DocumentContent {
  [key: string]: any;
}

export interface DocumentApproval extends AuditableEntity {
  documentId: UUID;
  approverUserId: UUID;
  approvalLevel: number;
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: Date;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Attachment extends AuditableEntity {
  documentId: UUID;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: UUID;
}

// Specific Document Types

export interface InspectionReport extends AuditableEntity {
  documentId: UUID;
  findings: InspectionFinding[];
  recommendedParts: RecommendedPart[];
  estimatedHours: number;
  severityLevel: SeverityLevel;
  images: DocumentImage[];
}

export interface InspectionFinding {
  id?: string;
  component: string;
  issue: string;
  severity: SeverityLevel;
  description: string;
  recommendation?: string;
}

export interface RecommendedPart {
  id?: string;
  partName: string;
  partNumber?: string;
  quantity: number;
  reason: string;
  estimatedCost?: number;
  urgency: PartUrgency;
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type PartUrgency = 'immediate' | 'scheduled' | 'optional';

export interface Quotation extends AuditableEntity {
  documentId: UUID;
  lineItems: QuotationLineItem[];
  totalAmount: number;
  currency: string;
  validityPeriod: number;
  termsConditions: string;
  customerApprovedAt?: Date;
  customerSignatureUrl?: string;
}

export interface QuotationLineItem {
  id: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  partId?: UUID;
  notes?: string;
}

export type LineItemType = 'part' | 'labor' | 'travel' | 'other';

export interface RepairReport extends AuditableEntity {
  documentId: UUID;
  partsReplaced: ReplacedPart[];
  proceduresPerformed: PerformedProcedure[];
  actualHours: number;
  testResults: TestResult[];
  technicianNotes: string;
  beforeImages: DocumentImage[];
  afterImages: DocumentImage[];
  customerSatisfactionRating?: number;
}

export interface ReplacedPart {
  partId: UUID;
  partName: string;
  quantity: number;
  serialNumbers: string[];
  oldPartCondition: string;
  replacementReason: string;
  warrantyMonths: number;
}

export interface PerformedProcedure {
  id: string;
  procedureType: ProcedureType;
  description: string;
  duration: number;
  result: ProcedureResult;
  notes?: string;
}

export type ProcedureType = 
  | 'calibration'
  | 'adjustment'
  | 'cleaning'
  | 'testing'
  | 'repair'
  | 'replacement';

export type ProcedureResult = 'successful' | 'partial' | 'failed';

export interface TestResult {
  testName: string;
  expectedValue: string;
  actualValue: string;
  result: 'pass' | 'fail';
  notes?: string;
}

export interface MaintenanceReport extends AuditableEntity {
  documentId: UUID;
  maintenanceType: MaintenanceType;
  checklistTemplateId: UUID;
  checklistItems: MaintenanceChecklistItem[];
  overallCondition: OverallCondition;
  recommendations: MaintenanceRecommendation[];
  nextMaintenanceDate?: Date;
  maintenanceFrequencyMonths?: number;
  actualHours: number;
  materialsUsed: MaterialUsed[];
  technicianNotes: string;
  customerFeedback?: string;
}

export type MaintenanceType = 'preventive' | 'corrective' | 'emergency';
export type OverallCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface MaintenanceChecklistItem {
  itemId: string;
  category: string;
  description: string;
  type: ChecklistItemType;
  required: boolean;
  status: ChecklistItemStatus;
  actualValue?: string;
  expectedValue?: string;
  notes?: string;
  images?: DocumentImage[];
  completedAt?: Date;
  completedBy?: UUID;
}

export type ChecklistItemType = 'visual' | 'measurement' | 'test' | 'adjustment' | 'replacement';
export type ChecklistItemStatus = 'pass' | 'fail' | 'na' | 'pending';

export interface MaintenanceChecklistTemplate extends AuditableEntity {
  name: string;
  deviceTypeId: UUID;
  maintenanceType: MaintenanceType;
  version: string;
  isActive: boolean;
  checklistItems: ChecklistTemplateItem[];
  estimatedDurationHours: number;
  requiredTools: UUID[];
  requiredParts: UUID[];
  safetyRequirements: string[];
}

export interface ChecklistTemplateItem {
  id: string;
  category: string;
  description: string;
  type: ChecklistItemType;
  required: boolean;
  order: number;
  expectedValue?: string;
  tolerance?: string;
  instructions?: string;
  safetyNotes?: string;
}

export interface MaintenanceRecommendation {
  id: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  description: string;
  estimatedCost?: number;
  estimatedHours?: number;
  dueDate?: Date;
  partIds?: UUID[];
}

export type RecommendationPriority = 'immediate' | 'high' | 'medium' | 'low';
export type RecommendationCategory = 'safety' | 'performance' | 'efficiency' | 'compliance';

export interface MaterialUsed {
  materialId: UUID;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface DocumentImage {
  id: string;
  fileName: string;
  url: string;
  caption?: string;
  timestamp: Date;
  imageType?: 'before' | 'during' | 'after';
}

// Document Creation/Update DTOs
export interface CreateDocumentRequest {
  caseId: UUID;
  documentTypeId: UUID;
  stepExecutionId?: UUID;
  content: DocumentContent;
}

export interface UpdateDocumentRequest {
  content: DocumentContent;
  version?: number;
}

export interface SubmitDocumentRequest {
  documentId: UUID;
  submittedBy: UUID;
  comments?: string;
}

export interface ApproveDocumentRequest {
  documentId: UUID;
  approverId: UUID;
  approvalLevel: number;
  comments?: string;
}

export interface RejectDocumentRequest {
  documentId: UUID;
  approverId: UUID;
  approvalLevel: number;
  reason: string;
  comments?: string;
}