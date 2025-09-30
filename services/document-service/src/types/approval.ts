import { UUID, AuditableEntity } from '../../../../shared/types/src/common';

// Approval Workflow Configuration
export interface ApprovalWorkflow extends AuditableEntity {
  name: string;
  description?: string;
  documentTypeIds: UUID[];
  levels: ApprovalLevel[];
  isActive: boolean;
  escalationRules: EscalationRule[];
  delegationRules: DelegationRule[];
}

export interface ApprovalLevel {
  level: number;
  name: string;
  approverType: ApproverType;
  approverIds?: UUID[]; // Specific users
  approverRoles?: string[]; // Roles that can approve
  requiredApprovals: number; // How many approvals needed at this level
  isParallel: boolean; // Can approvers work in parallel or sequential
  timeoutHours?: number; // Auto-escalate after this time
  skipConditions?: SkipCondition[]; // Conditions to skip this level
}

export type ApproverType = 'user' | 'role' | 'manager' | 'department_head' | 'custom';

export interface SkipCondition {
  field: string;
  operator: 'equals' | 'less_than' | 'greater_than' | 'contains';
  value: any;
}

export interface EscalationRule {
  fromLevel: number;
  toLevel: number;
  triggerAfterHours: number;
  escalationType: EscalationType;
  notifyUsers: UUID[];
  autoApprove?: boolean;
}

export type EscalationType = 'timeout' | 'rejection' | 'manual';

export interface DelegationRule {
  fromUserId: UUID;
  toUserId: UUID;
  startDate: Date;
  endDate: Date;
  levels?: number[]; // Which levels this delegation applies to
  isActive: boolean;
}

// Approval Instance (per document)
export interface ApprovalInstance extends AuditableEntity {
  documentId: UUID;
  workflowId: UUID;
  currentLevel: number;
  status: ApprovalInstanceStatus;
  startedAt: Date;
  completedAt?: Date;
  approvals: ApprovalRecord[];
  escalations: EscalationRecord[];
  delegations: DelegationRecord[];
}

export type ApprovalInstanceStatus = 
  | 'pending'
  | 'in_progress' 
  | 'approved' 
  | 'rejected' 
  | 'escalated'
  | 'cancelled';

export interface ApprovalRecord extends AuditableEntity {
  instanceId: UUID;
  level: number;
  approverUserId: UUID;
  originalApproverUserId?: UUID; // If delegated
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  timeSpentMinutes?: number;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated' | 'escalated';

export interface EscalationRecord extends AuditableEntity {
  instanceId: UUID;
  fromLevel: number;
  toLevel: number;
  reason: string;
  escalationType: EscalationType;
  escalatedBy?: UUID;
  escalatedAt: Date;
}

export interface DelegationRecord extends AuditableEntity {
  instanceId: UUID;
  level: number;
  fromUserId: UUID;
  toUserId: UUID;
  delegatedAt: Date;
  reason?: string;
}

// Notification Configuration
export interface ApprovalNotification {
  type: NotificationType;
  recipientType: RecipientType;
  recipientIds?: UUID[];
  recipientRoles?: string[];
  template: string;
  channels: NotificationChannel[];
  triggerEvents: NotificationTrigger[];
  delayMinutes?: number;
}

export type NotificationType = 
  | 'approval_request'
  | 'approval_reminder'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_escalated'
  | 'approval_delegated'
  | 'approval_completed';

export type RecipientType = 'approver' | 'submitter' | 'manager' | 'custom';

export type NotificationChannel = 'email' | 'in_app' | 'sms' | 'webhook';

export type NotificationTrigger = 
  | 'on_submit'
  | 'on_approve'
  | 'on_reject'
  | 'on_escalate'
  | 'on_delegate'
  | 'on_timeout'
  | 'on_complete';

// Request/Response DTOs
export interface CreateApprovalWorkflowRequest {
  name: string;
  description?: string;
  documentTypeIds: UUID[];
  levels: ApprovalLevel[];
  escalationRules?: EscalationRule[];
  delegationRules?: DelegationRule[];
  notifications?: ApprovalNotification[];
}

export interface UpdateApprovalWorkflowRequest {
  name?: string;
  description?: string;
  documentTypeIds?: UUID[];
  levels?: ApprovalLevel[];
  escalationRules?: EscalationRule[];
  delegationRules?: DelegationRule[];
  notifications?: ApprovalNotification[];
  isActive?: boolean;
}

export interface SubmitForApprovalRequest {
  documentId: UUID;
  submittedBy: UUID;
  comments?: string;
  urgency?: ApprovalUrgency;
}

export type ApprovalUrgency = 'low' | 'normal' | 'high' | 'urgent';

export interface ProcessApprovalRequest {
  instanceId: UUID;
  level: number;
  approverUserId: UUID;
  action: ApprovalAction;
  comments?: string;
}

export type ApprovalAction = 'approve' | 'reject' | 'delegate' | 'escalate';

export interface DelegateApprovalRequest {
  instanceId: UUID;
  level: number;
  fromUserId: UUID;
  toUserId: UUID;
  reason?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface EscalateApprovalRequest {
  instanceId: UUID;
  fromLevel: number;
  toLevel: number;
  reason: string;
  escalatedBy: UUID;
}

// Query DTOs
export interface ApprovalWorkflowSearchCriteria {
  name?: string;
  documentTypeId?: UUID;
  isActive?: boolean;
  createdBy?: UUID;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ApprovalInstanceSearchCriteria {
  documentId?: UUID;
  workflowId?: UUID;
  status?: ApprovalInstanceStatus;
  currentLevel?: number;
  submittedBy?: UUID;
  approverUserId?: UUID;
  startedAfter?: Date;
  startedBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface PendingApprovalsSearchCriteria {
  approverUserId: UUID;
  workflowId?: UUID;
  urgency?: ApprovalUrgency;
  level?: number;
  submittedAfter?: Date;
  submittedBefore?: Date;
  limit?: number;
  offset?: number;
}

// Analytics and Reporting
export interface ApprovalMetrics {
  totalApprovals: number;
  averageApprovalTime: number;
  approvalsByStatus: Record<ApprovalInstanceStatus, number>;
  approvalsByLevel: Record<number, number>;
  escalationRate: number;
  rejectionRate: number;
  timeoutRate: number;
}

export interface ApprovalPerformance {
  approverUserId: UUID;
  totalAssigned: number;
  totalCompleted: number;
  averageResponseTime: number;
  approvalRate: number;
  rejectionRate: number;
  timeoutCount: number;
}

export interface ApprovalHistory {
  instanceId: UUID;
  documentId: UUID;
  workflowName: string;
  submittedBy: UUID;
  submittedAt: Date;
  completedAt?: Date;
  finalStatus: ApprovalInstanceStatus;
  approvals: ApprovalRecord[];
  escalations: EscalationRecord[];
  delegations: DelegationRecord[];
  totalTimeHours: number;
}