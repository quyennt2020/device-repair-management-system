import { UUID } from '../../../../shared/types/src/common';

// Enhanced Quotation interfaces
export interface EnhancedQuotation {
  id: UUID;
  documentId: UUID;
  quotationNumber: string;
  revisionNumber: number;
  parentQuotationId?: UUID;
  status: QuotationStatus;
  lineItems: QuotationLineItem[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  currency: string;
  validityPeriod: number;
  expiryDate: Date;
  termsConditions: string;
  approvalStatus: ApprovalStatus;
  customerResponseStatus: CustomerResponseStatus;
  customerApprovedAt?: Date;
  customerSignatureUrl?: string;
  notes?: string;
  createdBy: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export type QuotationStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled'
  | 'superseded';

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'requires_revision';

export type CustomerResponseStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'requested_changes'
  | 'expired';

export interface QuotationLineItem {
  id: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  partId?: UUID;
  laborCategory?: string;
  markupPercentage?: number;
  discountPercentage?: number;
  taxRate?: number;
  warrantyMonths?: number;
  notes?: string;
}

export type LineItemType = 'part' | 'labor' | 'travel' | 'other' | 'discount' | 'tax';

export interface QuotationRevision {
  id: UUID;
  quotationId: UUID;
  revisionNumber: number;
  lineItems: QuotationLineItem[];
  totalAmount: number;
  currency: string;
  validityPeriod: number;
  termsConditions: string;
  revisionReason: string;
  createdBy: UUID;
  createdAt: Date;
}

export interface QuotationComparison {
  id: UUID;
  caseId: UUID;
  name: string;
  description?: string;
  quotationIds: UUID[];
  comparisonCriteria: ComparisonCriteria;
  comparisonResult: ComparisonResult;
  createdBy: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComparisonCriteria {
  compareBy: ComparisonType[];
  weightings?: Record<string, number>;
  filters?: ComparisonFilter[];
}

export type ComparisonType = 
  | 'total_cost'
  | 'labor_cost'
  | 'parts_cost'
  | 'delivery_time'
  | 'warranty_period'
  | 'supplier_rating';

export interface ComparisonFilter {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: any;
}

export interface ComparisonResult {
  summary: ComparisonSummary;
  details: QuotationComparisonDetail[];
  recommendations: ComparisonRecommendation[];
}

export interface ComparisonSummary {
  totalQuotations: number;
  lowestCost: number;
  highestCost: number;
  averageCost: number;
  recommendedQuotationId?: UUID;
  costSavings?: number;
}

export interface QuotationComparisonDetail {
  quotationId: UUID;
  quotationNumber: string;
  totalAmount: number;
  lineItemCount: number;
  deliveryTime?: number;
  warrantyPeriod?: number;
  score?: number;
  pros: string[];
  cons: string[];
}

export interface ComparisonRecommendation {
  type: 'cost_saving' | 'quality' | 'delivery' | 'warranty';
  message: string;
  quotationId?: UUID;
  potentialSavings?: number;
}

export interface QuotationApproval {
  id: UUID;
  quotationId: UUID;
  approvalLevel: number;
  approverRole: string;
  approverUserId?: UUID;
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: Date;
  createdAt: Date;
}

export interface QuotationCustomerResponse {
  id: UUID;
  quotationId: UUID;
  responseType: CustomerResponseType;
  customerComments?: string;
  requestedChanges?: RequestedChange[];
  responseDate: Date;
  customerSignatureUrl?: string;
  createdBy: UUID;
  createdAt: Date;
}

export type CustomerResponseType = 
  | 'approved'
  | 'rejected'
  | 'requested_changes'
  | 'needs_clarification';

export interface RequestedChange {
  lineItemId: string;
  changeType: 'quantity' | 'price' | 'description' | 'remove' | 'add';
  currentValue?: any;
  requestedValue?: any;
  reason: string;
}

export interface QuotationValidityTracking {
  id: UUID;
  quotationId: UUID;
  originalExpiryDate: Date;
  extendedExpiryDate?: Date;
  extensionReason?: string;
  extensionApprovedBy?: UUID;
  notificationSentDates: Date[];
  status: ValidityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ValidityStatus = 
  | 'active'
  | 'expired'
  | 'extended'
  | 'cancelled';

export interface QuotationLineItemDetail {
  id: UUID;
  quotationId: UUID;
  lineItemId: string;
  partId?: UUID;
  laborCategory?: string;
  markupPercentage: number;
  discountPercentage: number;
  taxRate: number;
  warrantyMonths: number;
  supplierQuoteReference?: string;
  costBreakdown: CostBreakdown;
  createdAt: Date;
}

export interface CostBreakdown {
  baseCost: number;
  markup: number;
  discount: number;
  tax: number;
  shipping?: number;
  handling?: number;
  other?: Record<string, number>;
}

// Request/Response DTOs
export interface CreateQuotationRequest {
  caseId: UUID;
  documentId: UUID;
  lineItems: CreateQuotationLineItemRequest[];
  currency?: string;
  validityPeriod?: number;
  termsConditions?: string;
  notes?: string;
}

export interface CreateQuotationLineItemRequest {
  type: LineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  partId?: UUID;
  laborCategory?: string;
  markupPercentage?: number;
  discountPercentage?: number;
  taxRate?: number;
  warrantyMonths?: number;
  notes?: string;
}

export interface UpdateQuotationRequest {
  lineItems?: QuotationLineItem[];
  discountAmount?: number;
  taxAmount?: number;
  validityPeriod?: number;
  termsConditions?: string;
  notes?: string;
}

export interface CreateQuotationRevisionRequest {
  quotationId: UUID;
  lineItems: QuotationLineItem[];
  revisionReason: string;
  validityPeriod?: number;
  termsConditions?: string;
}

export interface CreateQuotationComparisonRequest {
  caseId: UUID;
  name: string;
  description?: string;
  quotationIds: UUID[];
  comparisonCriteria: ComparisonCriteria;
}

export interface SubmitQuotationApprovalRequest {
  quotationId: UUID;
  approvalLevel: number;
  status: ApprovalStatus;
  comments?: string;
}

export interface SubmitCustomerResponseRequest {
  quotationId: UUID;
  responseType: CustomerResponseType;
  customerComments?: string;
  requestedChanges?: RequestedChange[];
  customerSignatureUrl?: string;
}

export interface ExtendQuotationValidityRequest {
  quotationId: UUID;
  newExpiryDate: Date;
  extensionReason: string;
}

// Search and filter interfaces
export interface QuotationSearchCriteria {
  caseId?: UUID;
  quotationNumber?: string;
  status?: QuotationStatus;
  approvalStatus?: ApprovalStatus;
  customerResponseStatus?: CustomerResponseStatus;
  createdBy?: UUID;
  createdAfter?: Date;
  createdBefore?: Date;
  expiryAfter?: Date;
  expiryBefore?: Date;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

export interface QuotationSearchResult {
  quotations: EnhancedQuotation[];
  total: number;
  limit: number;
  offset: number;
}

// Analytics interfaces
export interface QuotationAnalytics {
  totalQuotations: number;
  approvedQuotations: number;
  rejectedQuotations: number;
  expiredQuotations: number;
  averageAmount: number;
  totalValue: number;
  approvalRate: number;
  averageApprovalTime: number;
  topLineItems: TopLineItem[];
  monthlyTrends: MonthlyTrend[];
}

export interface TopLineItem {
  description: string;
  frequency: number;
  totalValue: number;
  averagePrice: number;
}

export interface MonthlyTrend {
  month: string;
  quotationCount: number;
  totalValue: number;
  approvalRate: number;
}