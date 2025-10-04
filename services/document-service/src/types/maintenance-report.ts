import { UUID } from '../../../../shared/types/src/common';
import { 
  MaintenanceReport, 
  MaintenanceChecklistItem, 
  MaintenanceChecklistTemplate,
  ChecklistTemplateItem,
  MaintenanceRecommendation,
  MaterialUsed,
  DocumentImage,
  MaintenanceType,
  OverallCondition,
  ChecklistItemType,
  ChecklistItemStatus,
  RecommendationPriority,
  RecommendationCategory
} from '../../../../shared/types/src/document';

// Request/Response DTOs for Maintenance Report
export interface CreateMaintenanceReportRequest {
  documentId: UUID;
  maintenanceType: MaintenanceType;
  checklistTemplateId: UUID;
  actualHours: number;
  technicianNotes: string;
  customerFeedback?: string;
}

export interface UpdateMaintenanceReportRequest {
  checklistItems?: UpdateMaintenanceChecklistItemRequest[];
  overallCondition?: OverallCondition;
  recommendations?: CreateMaintenanceRecommendationRequest[];
  nextMaintenanceDate?: Date;
  maintenanceFrequencyMonths?: number;
  actualHours?: number;
  materialsUsed?: CreateMaterialUsedRequest[];
  technicianNotes?: string;
  customerFeedback?: string;
}

export interface UpdateMaintenanceChecklistItemRequest {
  itemId: string;
  status: ChecklistItemStatus;
  actualValue?: string;
  notes?: string;
  images?: CreateDocumentImageRequest[];
  completedAt?: Date;
  completedBy?: UUID;
}

export interface CreateMaintenanceRecommendationRequest {
  priority: RecommendationPriority;
  category: RecommendationCategory;
  description: string;
  estimatedCost?: number;
  estimatedHours?: number;
  dueDate?: Date;
  partIds?: UUID[];
}

export interface CreateMaterialUsedRequest {
  materialId: UUID;
  materialName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes?: string;
}

export interface CreateDocumentImageRequest {
  fileName: string;
  url: string;
  caption?: string;
  imageType?: 'before' | 'during' | 'after';
}

// Maintenance Checklist Template DTOs
export interface CreateMaintenanceChecklistTemplateRequest {
  name: string;
  deviceTypeId: UUID;
  maintenanceType: MaintenanceType;
  checklistItems: CreateChecklistTemplateItemRequest[];
  estimatedDurationHours: number;
  requiredTools: UUID[];
  requiredParts: UUID[];
  safetyRequirements: string[];
}

export interface UpdateMaintenanceChecklistTemplateRequest {
  name?: string;
  checklistItems?: CreateChecklistTemplateItemRequest[];
  estimatedDurationHours?: number;
  requiredTools?: UUID[];
  requiredParts?: UUID[];
  safetyRequirements?: string[];
  isActive?: boolean;
}

export interface CreateChecklistTemplateItemRequest {
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

// Response DTOs
export interface MaintenanceReportResponse extends MaintenanceReport {
  // Additional computed fields for response
  totalChecklistItems: number;
  completedItems: number;
  failedItems: number;
  completionPercentage: number;
  totalMaterialCost: number;
  overallScore: number;
}

export interface MaintenanceChecklistTemplateResponse extends MaintenanceChecklistTemplate {
  // Additional computed fields
  totalItems: number;
  requiredItems: number;
  usageCount: number;
  averageCompletionTime: number;
}

// Search and filtering
export interface MaintenanceReportSearchCriteria {
  caseId?: UUID;
  deviceId?: UUID;
  technicianId?: UUID;
  maintenanceType?: MaintenanceType;
  overallCondition?: OverallCondition;
  dateFrom?: Date;
  dateTo?: Date;
  checklistTemplateId?: UUID;
  limit?: number;
  offset?: number;
}

export interface MaintenanceReportSearchResult {
  maintenanceReports: MaintenanceReportResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface MaintenanceChecklistTemplateSearchCriteria {
  deviceTypeId?: UUID;
  maintenanceType?: MaintenanceType;
  isActive?: boolean;
  name?: string;
  limit?: number;
  offset?: number;
}

export interface MaintenanceChecklistTemplateSearchResult {
  templates: MaintenanceChecklistTemplateResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Validation and business logic
export interface MaintenanceReportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completionStatus: 'incomplete' | 'complete' | 'requires_attention';
}

export interface ChecklistExecutionResult {
  totalItems: number;
  completedItems: number;
  passedItems: number;
  failedItems: number;
  pendingItems: number;
  criticalFailures: MaintenanceChecklistItem[];
  recommendations: MaintenanceRecommendation[];
}

// Scheduling and frequency management
export interface MaintenanceScheduleRequest {
  deviceId: UUID;
  maintenanceType: MaintenanceType;
  baseDate?: Date;
  frequencyMonths?: number;
  condition?: OverallCondition;
}

export interface MaintenanceScheduleResponse {
  deviceId: UUID;
  nextMaintenanceDate: Date;
  maintenanceType: MaintenanceType;
  frequencyMonths: number;
  priority: RecommendationPriority;
  estimatedHours: number;
  requiredTools: UUID[];
  requiredParts: UUID[];
}

// Analytics and reporting
export interface MaintenanceAnalytics {
  totalReports: number;
  averageCompletionTime: number;
  conditionDistribution: {
    [key in OverallCondition]: number;
  };
  mostCommonRecommendations: RecommendationAnalytics[];
  materialUsageTrends: MaterialUsageAnalytics[];
  checklistPerformance: ChecklistPerformanceAnalytics[];
}

export interface RecommendationAnalytics {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  count: number;
  averageCost: number;
  averageHours: number;
  completionRate: number;
}

export interface MaterialUsageAnalytics {
  materialId: UUID;
  materialName: string;
  totalQuantity: number;
  totalCost: number;
  usageFrequency: number;
  averageUnitCost: number;
}

export interface ChecklistPerformanceAnalytics {
  templateId: UUID;
  templateName: string;
  usageCount: number;
  averageCompletionTime: number;
  averagePassRate: number;
  commonFailurePoints: string[];
}

// Bulk operations
export interface BulkChecklistUpdateRequest {
  reportId: UUID;
  updates: UpdateMaintenanceChecklistItemRequest[];
}

export interface BulkChecklistUpdateResult {
  successCount: number;
  failureCount: number;
  errors: string[];
  updatedItems: MaintenanceChecklistItem[];
}

// Template versioning
export interface TemplateVersionInfo {
  templateId: UUID;
  version: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: UUID;
  changeLog: string;
  migrationRequired: boolean;
}

export interface TemplateVersionComparisonResult {
  oldVersion: TemplateVersionInfo;
  newVersion: TemplateVersionInfo;
  addedItems: ChecklistTemplateItem[];
  removedItems: ChecklistTemplateItem[];
  modifiedItems: ChecklistTemplateItem[];
  impactedReports: number;
}