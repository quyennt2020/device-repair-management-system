import { UUID } from './common';

// Base Event Interface
export interface DomainEvent {
  id: UUID;
  aggregateId: UUID;
  aggregateType: string;
  eventType: string;
  eventData: any;
  version: number;
  occurredAt: Date;
  causedBy: UUID;
  correlationId?: UUID;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  source: string;
  traceId?: string;
  userId?: UUID;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Case Events
export interface CaseCreatedEvent extends DomainEvent {
  eventType: 'CaseCreated';
  eventData: {
    caseId: UUID;
    caseNumber: string;
    customerId: UUID;
    deviceId: UUID;
    serviceType: string;
    priority: string;
    workflowDefinitionId: UUID;
  };
}

export interface CaseAssignedEvent extends DomainEvent {
  eventType: 'CaseAssigned';
  eventData: {
    caseId: UUID;
    technicianId: UUID;
    assignedBy: UUID;
    estimatedStartDate?: Date;
    estimatedEndDate?: Date;
  };
}

export interface CaseStatusChangedEvent extends DomainEvent {
  eventType: 'CaseStatusChanged';
  eventData: {
    caseId: UUID;
    previousStatus: string;
    newStatus: string;
    reason?: string;
    changedBy: UUID;
  };
}

export interface CaseCompletedEvent extends DomainEvent {
  eventType: 'CaseCompleted';
  eventData: {
    caseId: UUID;
    completedBy: UUID;
    actualCompletionDate: Date;
    customerSatisfactionRating?: number;
    totalCost?: number;
  };
}

// Document Events
export interface DocumentCreatedEvent extends DomainEvent {
  eventType: 'DocumentCreated';
  eventData: {
    documentId: UUID;
    caseId: UUID;
    documentType: string;
    createdBy: UUID;
  };
}

export interface DocumentSubmittedEvent extends DomainEvent {
  eventType: 'DocumentSubmitted';
  eventData: {
    documentId: UUID;
    caseId: UUID;
    documentType: string;
    submittedBy: UUID;
    approvalRequired: boolean;
  };
}

export interface DocumentApprovedEvent extends DomainEvent {
  eventType: 'DocumentApproved';
  eventData: {
    documentId: UUID;
    caseId: UUID;
    documentType: string;
    approverId: UUID;
    approvalLevel: number;
    comments?: string;
  };
}

export interface DocumentRejectedEvent extends DomainEvent {
  eventType: 'DocumentRejected';
  eventData: {
    documentId: UUID;
    caseId: UUID;
    documentType: string;
    approverId: UUID;
    approvalLevel: number;
    reason: string;
    comments?: string;
  };
}

// Workflow Events
export interface WorkflowStartedEvent extends DomainEvent {
  eventType: 'WorkflowStarted';
  eventData: {
    workflowInstanceId: UUID;
    workflowDefinitionId: UUID;
    caseId: UUID;
    startedBy: UUID;
  };
}

export interface WorkflowStepCompletedEvent extends DomainEvent {
  eventType: 'WorkflowStepCompleted';
  eventData: {
    workflowInstanceId: UUID;
    stepId: string;
    completedBy: UUID;
    nextStepId?: string;
    output?: any;
  };
}

export interface WorkflowCompletedEvent extends DomainEvent {
  eventType: 'WorkflowCompleted';
  eventData: {
    workflowInstanceId: UUID;
    caseId: UUID;
    finalStatus: string;
    completedAt: Date;
  };
}

// SLA Events
export interface SLABreachedEvent extends DomainEvent {
  eventType: 'SLABreached';
  eventData: {
    caseId: UUID;
    slaId: UUID;
    breachType: 'response' | 'resolution';
    targetTime: number;
    actualTime: number;
    penaltyAmount?: number;
  };
}

export interface SLAWarningEvent extends DomainEvent {
  eventType: 'SLAWarning';
  eventData: {
    caseId: UUID;
    slaId: UUID;
    warningType: 'response' | 'resolution';
    timeRemaining: number;
    percentageUsed: number;
  };
}

// Tool Events
export interface ToolCheckedOutEvent extends DomainEvent {
  eventType: 'ToolCheckedOut';
  eventData: {
    toolId: UUID;
    technicianId: UUID;
    caseId?: UUID;
    checkoutDate: Date;
    expectedReturnDate: Date;
    condition: string;
  };
}

export interface ToolCheckedInEvent extends DomainEvent {
  eventType: 'ToolCheckedIn';
  eventData: {
    toolId: UUID;
    technicianId: UUID;
    assignmentId: UUID;
    returnDate: Date;
    condition: string;
    maintenanceRequired: boolean;
  };
}

export interface ToolCalibrationDueEvent extends DomainEvent {
  eventType: 'ToolCalibrationDue';
  eventData: {
    toolId: UUID;
    toolName: string;
    dueDate: Date;
    daysOverdue: number;
  };
}

// Inventory Events
export interface InventoryLowStockEvent extends DomainEvent {
  eventType: 'InventoryLowStock';
  eventData: {
    sparePartId: UUID;
    warehouseId: UUID;
    partName: string;
    currentStock: number;
    reorderLevel: number;
    suggestedOrderQuantity: number;
  };
}

export interface InventoryOutOfStockEvent extends DomainEvent {
  eventType: 'InventoryOutOfStock';
  eventData: {
    sparePartId: UUID;
    warehouseId: UUID;
    partName: string;
    lastStockDate: Date;
    affectedCases: UUID[];
  };
}

// Customer Events
export interface CustomerTierChangedEvent extends DomainEvent {
  eventType: 'CustomerTierChanged';
  eventData: {
    customerId: UUID;
    previousTier: string;
    newTier: string;
    reason: string;
    changedBy: UUID;
  };
}

// Technician Events
export interface TechnicianCertificationExpiringEvent extends DomainEvent {
  eventType: 'TechnicianCertificationExpiring';
  eventData: {
    technicianId: UUID;
    certificationId: UUID;
    certificationName: string;
    expiryDate: Date;
    daysUntilExpiry: number;
  };
}

// Event Bus Interface
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

// Event Store Interface
export interface EventStore {
  saveEvent(event: DomainEvent): Promise<void>;
  saveEvents(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: UUID, fromVersion?: number): Promise<DomainEvent[]>;
  getEventsByType(eventType: string, fromDate?: Date, toDate?: Date): Promise<DomainEvent[]>;
}