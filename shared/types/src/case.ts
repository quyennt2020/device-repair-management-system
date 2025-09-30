import { AuditableEntity, UUID, Priority, Status } from './common';

export interface RepairCase extends AuditableEntity {
  caseNumber: string;
  customerId: UUID;
  deviceId: UUID;
  serviceType: string;
  workflowConfigurationId?: UUID;
  workflowInstanceId?: UUID;
  currentStepId?: string;
  status: CaseStatus;
  priority: Priority;
  assignedTechnicianId?: UUID;
  slaId?: UUID;
  description: string;
  requestedBy: UUID;
  scheduledDate?: Date;
  onsite: boolean;
  urgency: 'normal' | 'urgent' | 'emergency';
  estimatedCompletionDate?: Date;
  actualCompletionDate?: Date;
  title?: string;
  category?: string;
  subcategory?: string;
  reportedIssue?: string;
  resolution?: string;
  slaDueDate?: Date;
  completedAt?: Date;
  assignedAt?: Date;
  workflowStartedAt?: Date;
  workflowCompletedAt?: Date;
  lastSlaCheck?: Date;
  slaStatus?: 'met' | 'at_risk' | 'breached';
  escalationLevel?: number;
  escalatedAt?: Date;
  metadata?: Record<string, any>;
}

export type CaseStatus = 
  | 'created'
  | 'assigned'
  | 'in_progress'
  | 'waiting_approval'
  | 'waiting_customer'
  | 'waiting_parts'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export interface CaseHistoryEntry extends AuditableEntity {
  caseId: UUID;
  action: string;
  description: string;
  previousValue?: any;
  newValue?: any;
  performedBy: UUID;
}

export interface CreateCaseRequest {
  customerId: UUID;
  deviceId: UUID;
  serviceType: string;
  priority?: Priority;
  description: string;
  requestedBy: UUID;
  scheduledDate?: Date;
  onsite?: boolean;
  urgency?: 'normal' | 'urgent' | 'emergency';
  deviceType?: string;
  category?: string;
  subcategory?: string;
  reportedIssue?: string;
  customerTier?: string;
  title?: string;
  location?: string;
  metadata?: Record<string, any>;
}

export interface CaseUpdates {
  status?: CaseStatus;
  priority?: Priority;
  assignedTechnicianId?: UUID;
  description?: string;
  scheduledDate?: Date;
  estimatedCompletionDate?: Date;
}

export interface CaseSearchResult {
  cases: RepairCase[];
  total: number;
  page: number;
  limit: number;
}

export interface SLAStatus {
  caseId: UUID;
  slaId: UUID | null;
  responseTimeTarget: number;
  responseTimeActual?: number;
  resolutionTimeTarget: number;
  resolutionTimeActual?: number;
  status: 'met' | 'at_risk' | 'breached';
  breachReason?: string;
  penaltyAmount?: number;
}

export interface CaseFilters {
  page?: number;
  limit?: number;
  status?: CaseStatus;
  priority?: Priority;
  category?: string;
  customerId?: UUID;
  technicianId?: UUID;
  deviceId?: UUID;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  dueBefore?: Date;
  overdue?: boolean;
}