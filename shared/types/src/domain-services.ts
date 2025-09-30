import { UUID } from './common';
import { RepairCase } from './case';
import { Technician } from './technician';
import { ServiceTool } from './tools';
import { SparePart } from './inventory';
import { DomainEvent } from './events';

// Domain Service Interfaces
export interface AssignmentService {
  findBestTechnician(request: TechnicianAssignmentRequest): Promise<TechnicianAssignmentResult>;
  calculateAssignmentScore(technician: Technician, case: RepairCase): Promise<number>;
  validateAssignment(technicianId: UUID, caseId: UUID): Promise<AssignmentValidationResult>;
  optimizeSchedule(assignments: Assignment[]): Promise<OptimizedSchedule>;
}

export interface TechnicianAssignmentRequest {
  caseId: UUID;
  deviceTypeId: UUID;
  serviceType: string;
  priority: string;
  requiredSkills: string[];
  requiredCertifications: string[];
  requiredTools: UUID[];
  preferredStartDate?: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  customerPreferences?: {
    preferredTechnicians: UUID[];
    excludedTechnicians: UUID[];
  };
}

export interface TechnicianAssignmentResult {
  technician: Technician;
  score: number;
  confidence: number;
  alternatives: AlternativeTechnician[];
  requiredTools: ServiceTool[];
  estimatedStartDate: Date;
  estimatedEndDate: Date;
  warnings: string[];
}

export interface AlternativeTechnician {
  technician: Technician;
  score: number;
  reason: string;
  availableFrom?: Date;
}

export interface AssignmentValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Assignment {
  id: UUID;
  technicianId: UUID;
  caseId: UUID;
  estimatedStartDate: Date;
  estimatedEndDate: Date;
  priority: string;
  requiredTools: UUID[];
}

export interface OptimizedSchedule {
  assignments: OptimizedAssignment[];
  metrics: ScheduleMetrics;
  conflicts: ScheduleConflict[];
}

export interface OptimizedAssignment extends Assignment {
  optimizedStartDate: Date;
  optimizedEndDate: Date;
  travelTime?: number;
  efficiency: number;
}

export interface ScheduleMetrics {
  totalTravelTime: number;
  averageUtilization: number;
  conflictCount: number;
  optimizationScore: number;
}

export interface ScheduleConflict {
  type: 'time_overlap' | 'tool_conflict' | 'skill_mismatch';
  affectedAssignments: UUID[];
  severity: 'low' | 'medium' | 'high';
  suggestedResolution: string;
}

// SLA Service
export interface SLAService {
  calculateSLAStatus(caseId: UUID): Promise<SLAStatus>;
  checkSLACompliance(caseId: UUID): Promise<SLAComplianceResult>;
  predictSLABreach(caseId: UUID): Promise<SLABreachPrediction>;
  escalateCase(caseId: UUID, reason: string): Promise<void>;
}

export interface SLAStatus {
  caseId: UUID;
  slaId: UUID;
  responseTimeStatus: TimeStatus;
  resolutionTimeStatus: TimeStatus;
  overallStatus: 'on_track' | 'at_risk' | 'breached';
  nextEscalationDate?: Date;
}

export interface TimeStatus {
  target: number;
  elapsed: number;
  remaining: number;
  percentageUsed: number;
  status: 'on_track' | 'at_risk' | 'breached';
}

export interface SLAComplianceResult {
  isCompliant: boolean;
  breaches: SLABreach[];
  penalties: SLAPenalty[];
  recommendations: string[];
}

export interface SLABreach {
  type: 'response' | 'resolution';
  targetTime: number;
  actualTime: number;
  breachAmount: number;
  penaltyPercentage: number;
}

export interface SLAPenalty {
  type: string;
  amount: number;
  currency: string;
  reason: string;
}

export interface SLABreachPrediction {
  probabilityOfBreach: number;
  estimatedBreachTime?: Date;
  riskFactors: RiskFactor[];
  mitigationActions: MitigationAction[];
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface MitigationAction {
  action: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: string;
  requiredResources: string[];
}

// Inventory Service
export interface InventoryService {
  checkPartAvailability(partId: UUID, quantity: number, warehouseId?: UUID): Promise<PartAvailabilityResult>;
  reserveParts(request: PartReservationRequest): Promise<PartReservationResult>;
  consumeParts(request: PartConsumptionRequest): Promise<PartConsumptionResult>;
  suggestAlternativeParts(partId: UUID): Promise<AlternativePartSuggestion[]>;
  calculateReorderRequirements(): Promise<ReorderRequirement[]>;
}

export interface PartAvailabilityResult {
  partId: UUID;
  available: boolean;
  availableQuantity: number;
  reservedQuantity: number;
  warehouses: WarehouseAvailability[];
  alternativeParts: UUID[];
  estimatedRestockDate?: Date;
}

export interface WarehouseAvailability {
  warehouseId: UUID;
  warehouseName: string;
  availableQuantity: number;
  location: string;
  estimatedDeliveryTime: number; // hours
}

export interface PartReservationRequest {
  partId: UUID;
  quantity: number;
  warehouseId?: UUID;
  reservedFor: UUID; // case ID
  reservedBy: UUID;
  expiryDate?: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface PartReservationResult {
  reservationId: UUID;
  partId: UUID;
  quantityReserved: number;
  warehouseId: UUID;
  expiryDate: Date;
  success: boolean;
  warnings: string[];
}

export interface PartConsumptionRequest {
  caseId: UUID;
  parts: PartConsumptionItem[];
  consumedBy: UUID;
}

export interface PartConsumptionItem {
  partId: UUID;
  quantity: number;
  warehouseId: UUID;
  unitCost: number;
  serialNumbers?: string[];
}

export interface PartConsumptionResult {
  success: boolean;
  consumedParts: ConsumedPart[];
  totalCost: number;
  errors: string[];
}

export interface ConsumedPart {
  partId: UUID;
  quantityConsumed: number;
  unitCost: number;
  totalCost: number;
  warehouseId: UUID;
  transactionId: UUID;
}

export interface AlternativePartSuggestion {
  partId: UUID;
  partName: string;
  compatibility: number; // 0-100%
  availableQuantity: number;
  priceDifference: number;
  reason: string;
}

export interface ReorderRequirement {
  partId: UUID;
  partName: string;
  warehouseId: UUID;
  currentStock: number;
  reorderLevel: number;
  suggestedOrderQuantity: number;
  estimatedCost: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  supplier: string;
  leadTimeDays: number;
}

// Notification Service
export interface NotificationService {
  sendNotification(request: NotificationRequest): Promise<NotificationResult>;
  sendBulkNotifications(requests: NotificationRequest[]): Promise<BulkNotificationResult>;
  createNotificationTemplate(template: NotificationTemplate): Promise<UUID>;
  scheduleNotification(request: ScheduledNotificationRequest): Promise<UUID>;
}

export interface NotificationRequest {
  recipients: NotificationRecipient[];
  subject: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  templateId?: UUID;
  templateData?: Record<string, any>;
  attachments?: NotificationAttachment[];
}

export interface NotificationRecipient {
  userId?: UUID;
  email?: string;
  phone?: string;
  role?: string;
  preferences?: NotificationPreferences;
}

export interface NotificationPreferences {
  enabledChannels: string[];
  quietHours?: {
    start: string;
    end: string;
  };
  language: string;
}

export interface NotificationAttachment {
  fileName: string;
  content: Buffer;
  mimeType: string;
}

export interface NotificationResult {
  notificationId: UUID;
  success: boolean;
  deliveryResults: DeliveryResult[];
  errors: string[];
}

export interface DeliveryResult {
  channel: string;
  recipient: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  deliveredAt?: Date;
  error?: string;
}

export interface BulkNotificationResult {
  totalNotifications: number;
  successCount: number;
  failureCount: number;
  results: NotificationResult[];
}

export interface NotificationTemplate {
  name: string;
  subject: string;
  bodyTemplate: string;
  type: string;
  variables: TemplateVariable[];
  channels: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface ScheduledNotificationRequest extends NotificationRequest {
  scheduledAt: Date;
  timezone?: string;
  recurring?: RecurringSchedule;
}

export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  maxOccurrences?: number;
}

// Event Service
export interface EventService {
  publishEvent(event: DomainEvent): Promise<void>;
  publishEvents(events: DomainEvent[]): Promise<void>;
  subscribeToEvent(eventType: string, handler: EventHandler): void;
  getEventHistory(aggregateId: UUID, fromDate?: Date, toDate?: Date): Promise<DomainEvent[]>;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

// Audit Service
export interface AuditService {
  logAction(action: AuditAction): Promise<void>;
  getAuditTrail(entityId: UUID, entityType: string): Promise<AuditEntry[]>;
  searchAuditLogs(criteria: AuditSearchCriteria): Promise<AuditSearchResult>;
}

export interface AuditAction {
  entityId: UUID;
  entityType: string;
  action: string;
  performedBy: UUID;
  timestamp: Date;
  changes?: FieldChange[];
  metadata?: Record<string, any>;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface AuditEntry {
  id: UUID;
  entityId: UUID;
  entityType: string;
  action: string;
  performedBy: UUID;
  timestamp: Date;
  changes: FieldChange[];
  metadata: Record<string, any>;
}

export interface AuditSearchCriteria {
  entityId?: UUID;
  entityType?: string;
  performedBy?: UUID;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface AuditSearchResult {
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
}