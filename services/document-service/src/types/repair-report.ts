import { UUID } from '../../../../shared/types/src/common';
import { 
  RepairReport, 
  ReplacedPart, 
  PerformedProcedure, 
  TestResult, 
  DocumentImage,
  ProcedureType,
  ProcedureResult
} from '../../../../shared/types/src/document';

// Request/Response DTOs for Repair Report
export interface CreateRepairReportRequest {
  documentId: UUID;
  partsReplaced: CreateReplacedPartRequest[];
  proceduresPerformed: CreatePerformedProcedureRequest[];
  actualHours: number;
  testResults: CreateTestResultRequest[];
  technicianNotes: string;
  beforeImages?: CreateDocumentImageRequest[];
  afterImages?: CreateDocumentImageRequest[];
}

export interface UpdateRepairReportRequest {
  partsReplaced?: CreateReplacedPartRequest[];
  proceduresPerformed?: CreatePerformedProcedureRequest[];
  actualHours?: number;
  testResults?: CreateTestResultRequest[];
  technicianNotes?: string;
  beforeImages?: CreateDocumentImageRequest[];
  afterImages?: CreateDocumentImageRequest[];
  customerSatisfactionRating?: number;
}

export interface CreateReplacedPartRequest {
  partId: UUID;
  partName: string;
  quantity: number;
  serialNumbers: string[];
  oldPartCondition: string;
  replacementReason: string;
  warrantyMonths: number;
}

export interface CreatePerformedProcedureRequest {
  procedureType: ProcedureType;
  description: string;
  duration: number;
  result: ProcedureResult;
  notes?: string;
}

export interface CreateTestResultRequest {
  testName: string;
  expectedValue: string;
  actualValue: string;
  result: 'pass' | 'fail';
  notes?: string;
}

export interface CreateDocumentImageRequest {
  fileName: string;
  url: string;
  caption?: string;
  imageType?: 'before' | 'during' | 'after';
}

export interface RepairReportResponse extends RepairReport {
  // Additional computed fields for response
  totalPartsReplaced: number;
  totalProcedures: number;
  overallTestResult: 'pass' | 'fail' | 'partial';
  completionPercentage: number;
}

export interface RepairReportSearchCriteria {
  caseId?: UUID;
  technicianId?: UUID;
  dateFrom?: Date;
  dateTo?: Date;
  customerSatisfactionRating?: number;
  overallTestResult?: 'pass' | 'fail' | 'partial';
  limit?: number;
  offset?: number;
}

export interface RepairReportSearchResult {
  repairReports: RepairReportResponse[];
  total: number;
  limit: number;
  offset: number;
}

// Validation interfaces
export interface RepairReportValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  checkedItems: QualityCheckItem[];
  overallNotes: string;
}

export interface QualityCheckItem {
  category: 'parts' | 'procedures' | 'testing' | 'documentation';
  description: string;
  status: 'pass' | 'fail' | 'warning';
  notes?: string;
}

// Customer satisfaction interfaces
export interface CustomerSatisfactionRequest {
  repairReportId: UUID;
  rating: number; // 1-5 scale
  comments?: string;
  wouldRecommend: boolean;
  serviceAspects: ServiceAspectRating[];
}

export interface ServiceAspectRating {
  aspect: 'timeliness' | 'quality' | 'communication' | 'professionalism' | 'value';
  rating: number; // 1-5 scale
  comments?: string;
}

export interface CustomerFeedbackSummary {
  averageRating: number;
  totalResponses: number;
  aspectRatings: {
    [key: string]: number;
  };
  recentComments: string[];
}

// Analytics interfaces
export interface RepairReportAnalytics {
  totalReports: number;
  averageRepairTime: number;
  mostCommonProcedures: ProcedureAnalytics[];
  mostReplacedParts: PartAnalytics[];
  qualityTrends: QualityTrend[];
  customerSatisfactionTrend: SatisfactionTrend[];
}

export interface ProcedureAnalytics {
  procedureType: ProcedureType;
  count: number;
  averageDuration: number;
  successRate: number;
}

export interface PartAnalytics {
  partId: UUID;
  partName: string;
  replacementCount: number;
  averageWarrantyMonths: number;
  commonReasons: string[];
}

export interface QualityTrend {
  period: string;
  averageScore: number;
  passRate: number;
  totalReports: number;
}

export interface SatisfactionTrend {
  period: string;
  averageRating: number;
  responseRate: number;
  totalReports: number;
}