import { AuditableEntity, UUID } from './common';

export interface ServiceContract extends AuditableEntity {
  contractNumber: string;
  customerId: UUID;
  contractType: ContractType;
  startDate: Date;
  endDate: Date;
  value: number;
  currency: string;
  paymentSchedule: PaymentSchedule;
  status: ContractStatus;
  coveredDevices: UUID[];
  responseTimeHours: number;
  resolutionTimeHours: number;
  includedServices: string[];
  excludedServices: string[];
  annualVisitQuota: number;
  visitsUsed: number;
  contractManagerId?: UUID;
  renewalDate?: Date;
  autoRenew: boolean;
}

export type ContractType = 'maintenance' | 'support' | 'full_service' | 'warranty_extension';
export type PaymentSchedule = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'one_time';
export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'suspended';

export interface SLADefinition extends AuditableEntity {
  name: string;
  contractId?: UUID;
  priority: SLAPriority;
  responseTimeMinutes: number;
  resolutionTimeHours: number;
  availabilityPercentage: number;
  penalties: SLAPenalties;
  escalationRules: SLAEscalationRule[];
  serviceHours: ServiceHours;
  appliesTo: SLAApplicability;
  isActive: boolean;
}

export type SLAPriority = 'critical' | 'high' | 'medium' | 'low';

export interface SLAPenalties {
  lateResponse?: number; // percentage
  lateResolution?: number; // percentage
  availabilityBreach?: number; // percentage
}

export interface SLAEscalationRule {
  level: number;
  triggerAfterMinutes: number;
  escalateTo: string[];
  actions: string[];
}

export type ServiceHours = '24x7' | 'business_hours' | 'extended_hours' | 'custom';

export interface SLAApplicability {
  deviceTypes?: UUID[];
  customers?: UUID[];
  contractTypes?: ContractType[];
  serviceTypes?: string[];
}

export interface Warranty extends AuditableEntity {
  deviceId: UUID;
  warrantyType: WarrantyType;
  provider: string;
  startDate: Date;
  endDate: Date;
  coverageTerms: WarrantyCoverage;
  coveredParts: string[];
  coveredServices: string[];
  claimProcedure?: string;
  warrantyDocumentUrl?: string;
  status: WarrantyStatus;
}

export type WarrantyType = 'manufacturer' | 'extended' | 'service_contract';
export type WarrantyStatus = 'active' | 'expired' | 'claimed' | 'voided';export 
interface WarrantyCoverage {
  partsIncluded: boolean;
  laborIncluded: boolean;
  onsiteServiceIncluded: boolean;
  calibrationIncluded: boolean;
  exclusions: string[];
  limitations: string[];
}

export interface OnsiteService extends AuditableEntity {
  repairCaseId: UUID;
  serviceType: OnsiteServiceType;
  customerAddressId?: UUID;
  scheduledDate: Date;
  scheduledTimeSlot: string;
  estimatedDuration: number;
  assignedTechnicians: OnsiteTechnicianAssignment[];
  requiredTools: UUID[];
  requiredParts: UUID[];
  travelDistanceKm?: number;
  travelTimeMinutes?: number;
  status: OnsiteServiceStatus;
  actualStartTime?: Date;
  actualEndTime?: Date;
  customerSignature?: string;
  satisfactionRating?: number;
  notes?: string;
}

export type OnsiteServiceType = 'installation' | 'maintenance' | 'repair' | 'inspection' | 'training';

export interface OnsiteTechnicianAssignment {
  technicianId: UUID;
  role: TechnicianRole;
  estimatedHours: number;
}

export type TechnicianRole = 'lead' | 'assistant' | 'specialist' | 'trainee';

export type OnsiteServiceStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export interface OnsiteCheckpoint extends AuditableEntity {
  onsiteServiceId: UUID;
  checkpointType: CheckpointType;
  timestamp: Date;
  locationLat?: number;
  locationLong?: number;
  photoUrl?: string;
  notes?: string;
}

export type CheckpointType = 'departure' | 'arrival' | 'start_work' | 'break' | 'completion' | 'departure_site';

export interface SLACompliance extends AuditableEntity {
  repairCaseId: UUID;
  slaId: UUID;
  targetResponseTime: number;
  actualResponseTime?: number;
  targetResolutionTime: number;
  actualResolutionTime?: number;
  status: ComplianceStatus;
  breachReason?: string;
  penaltyAmount?: number;
}

export type ComplianceStatus = 'met' | 'at_risk' | 'breached';

// DTOs
export interface CreateServiceContractRequest {
  contractNumber: string;
  customerId: UUID;
  contractType: ContractType;
  startDate: Date;
  endDate: Date;
  value: number;
  currency: string;
  paymentSchedule: PaymentSchedule;
  coveredDevices: UUID[];
  responseTimeHours: number;
  resolutionTimeHours: number;
  includedServices: string[];
  excludedServices: string[];
  annualVisitQuota: number;
  contractManagerId?: UUID;
  autoRenew?: boolean;
}

export interface ScheduleOnsiteServiceRequest {
  repairCaseId: UUID;
  serviceType: OnsiteServiceType;
  customerAddressId?: UUID;
  preferredDate: Date;
  preferredTimeSlot: string;
  estimatedDuration: number;
  requiredTechnicians: OnsiteTechnicianAssignment[];
  requiredTools: UUID[];
  requiredParts: UUID[];
  specialInstructions?: string;
}

export interface ContractSearchCriteria {
  query?: string;
  customerId?: UUID;
  contractType?: ContractType;
  status?: ContractStatus;
  expiringWithinDays?: number;
  contractManagerId?: UUID;
}