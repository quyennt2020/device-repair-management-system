import { AuditableEntity, UUID, Location } from './common';

export interface Device extends AuditableEntity {
  deviceCode: string;
  customerId: UUID;
  deviceTypeId: UUID;
  manufacturer: string;
  model: string;
  serialNumber: string;
  specifications: DeviceSpecifications;
  locationInfo: Location;
  status: DeviceStatus;
  warrantyInfo: WarrantyInfo;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  qrCode?: string;
}

export type DeviceStatus = 
  | 'active'
  | 'repair'
  | 'maintenance'
  | 'retired'
  | 'scrapped'
  | 'lost'
  | 'stolen';

export interface DeviceType extends AuditableEntity {
  name: string;
  category: string;
  manufacturer: string;
  modelSeries: string;
  specifications: DeviceTypeSpecifications;
  standardServiceHours: number;
  requiredCertifications: string[];
  maintenanceChecklist: MaintenanceChecklistItem[];
}

export interface DeviceSpecifications {
  [key: string]: any;
}

export interface DeviceTypeSpecifications {
  [key: string]: any;
}

export interface WarrantyInfo {
  hasWarranty: boolean;
  warrantyType?: WarrantyType;
  startDate?: Date;
  endDate?: Date;
  provider?: string;
  coverageTerms?: string[];
  claimProcedure?: string;
}

export type WarrantyType = 'manufacturer' | 'extended' | 'service_contract';

export interface DeviceHistory extends AuditableEntity {
  deviceId: UUID;
  repairCaseId?: UUID;
  eventType: DeviceEventType;
  eventDate: Date;
  description: string;
  performedBy?: UUID;
  nextActionDate?: Date;
  cost?: number;
  partsUsed?: DevicePartUsage[];
}

export type DeviceEventType = 
  | 'service'
  | 'repair'
  | 'calibration'
  | 'inspection'
  | 'maintenance'
  | 'installation'
  | 'relocation'
  | 'retirement';

export interface DevicePartUsage {
  partId: UUID;
  partName: string;
  quantity: number;
  serialNumbers?: string[];
}

export interface DeviceMetrics {
  deviceId: UUID;
  totalServiceCases: number;
  totalRepairCases: number;
  totalMaintenanceCases: number;
  averageRepairTime: number;
  totalDowntime: number;
  totalServiceCost: number;
  lastFailureDate?: Date;
  mtbf?: number; // Mean Time Between Failures
  mttr?: number; // Mean Time To Repair
  availabilityPercentage: number;
}

export interface DeviceCertificate extends AuditableEntity {
  deviceId: UUID;
  certificateType: CertificateType;
  certificateNumber: string;
  issueDate: Date;
  expiryDate: Date;
  issuedBy: string;
  nextDueDate?: Date;
  status: CertificateStatus;
  attachmentUrl?: string;
  reminderDaysBefore: number[];
}

export type CertificateType = 'calibration' | 'safety' | 'quality' | 'compliance';
export type CertificateStatus = 'valid' | 'expiring_soon' | 'expired' | 'suspended';

export interface MaintenanceChecklistItem {
  id: string;
  description: string;
  category: string;
  frequency: MaintenanceFrequency;
  estimatedDuration: number;
  requiredTools?: string[];
  safetyNotes?: string;
}

export type MaintenanceFrequency = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annually'
  | 'annually'
  | 'as_needed';

export interface DeviceAlert extends AuditableEntity {
  deviceId: UUID;
  alertType: DeviceAlertType;
  severity: AlertSeverity;
  message: string;
  isActive: boolean;
  acknowledgedBy?: UUID;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export type DeviceAlertType = 
  | 'maintenance_due'
  | 'calibration_due'
  | 'certificate_expiring'
  | 'warranty_expiring'
  | 'performance_degradation'
  | 'failure_predicted';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// DTOs
export interface CreateDeviceRequest {
  deviceCode: string;
  customerId: UUID;
  deviceTypeId: UUID;
  manufacturer: string;
  model: string;
  serialNumber: string;
  specifications: DeviceSpecifications;
  locationInfo: Location;
  warrantyInfo?: WarrantyInfo;
}

export interface UpdateDeviceRequest {
  manufacturer?: string;
  model?: string;
  specifications?: DeviceSpecifications;
  locationInfo?: Location;
  status?: DeviceStatus;
  warrantyInfo?: WarrantyInfo;
  nextServiceDate?: Date;
}

export interface DeviceSearchCriteria {
  query?: string;
  customerId?: UUID;
  deviceTypeId?: UUID;
  manufacturer?: string;
  status?: DeviceStatus;
  warrantyStatus?: 'active' | 'expired' | 'expiring_soon';
  lastServiceDateFrom?: Date;
  lastServiceDateTo?: Date;
  nextServiceDateFrom?: Date;
  nextServiceDateTo?: Date;
}

export interface DeviceSearchResult {
  devices: Device[];
  total: number;
  page: number;
  limit: number;
}

export interface DeviceQRCodeData {
  deviceId: UUID;
  deviceCode: string;
  serialNumber: string;
  customerId: UUID;
  quickActions: string[];
}