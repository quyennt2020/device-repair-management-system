import { AuditableEntity, UUID } from './common';

export interface ServiceTool extends AuditableEntity {
  toolCode: string;
  toolName: string;
  category: ToolCategory;
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseInfo: ToolPurchaseInfo;
  status: ToolStatus;
  location: string;
  calibrationRequired: boolean;
  lastCalibrationDate?: Date;
  nextCalibrationDate?: Date;
  requiredForDeviceTypes: UUID[];
  specifications: ToolSpecifications;
  maintenanceHistory: ToolMaintenance[];
}

export type ToolCategory = 'measurement' | 'calibration' | 'diagnostic' | 'repair' | 'safety';

export interface ToolPurchaseInfo {
  purchaseDate: Date;
  purchaseCost: number;
  supplier: string;
  warrantyEndDate?: Date;
}

export interface ToolSpecifications {
  [key: string]: any;
}

export type ToolStatus = 
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'calibration'
  | 'retired'
  | 'lost'
  | 'damaged';

export interface ToolAssignment extends AuditableEntity {
  toolId: UUID;
  assignedToTechnicianId: UUID;
  assignedToCaseId?: UUID;
  checkoutDate: Date;
  expectedReturnDate: Date;
  actualReturnDate?: Date;
  conditionCheckout: ToolCondition;
  conditionReturn?: ToolCondition;
  notes?: string;
  status: AssignmentStatus;
}

export type ToolCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
export type AssignmentStatus = 'active' | 'returned' | 'overdue' | 'lost';

export interface ToolMaintenance extends AuditableEntity {
  toolId: UUID;
  maintenanceType: ToolMaintenanceType;
  scheduledDate: Date;
  completedDate?: Date;
  performedBy?: UUID;
  cost?: number;
  nextMaintenanceDate?: Date;
  status: MaintenanceStatus;
  notes?: string;
  attachments: string[];
}

export type ToolMaintenanceType = 'calibration' | 'repair' | 'inspection' | 'cleaning';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';ex
port interface ToolAvailability {
  toolId: UUID;
  available: boolean;
  availableFrom?: Date;
  currentAssignment?: ToolAssignment;
  nextMaintenance?: Date;
  alternativeTools?: UUID[];
}

export interface ToolRequirement {
  deviceTypeId: UUID;
  serviceType: string;
  requiredTools: ToolRequirementItem[];
  optionalTools: ToolRequirementItem[];
}

export interface ToolRequirementItem {
  toolCategory: ToolCategory;
  specificToolIds?: UUID[];
  quantity: number;
  duration: number; // hours
  priority: RequirementPriority;
}

export type RequirementPriority = 'required' | 'preferred' | 'optional';

export interface ToolCalibrationSchedule {
  toolId: UUID;
  calibrationFrequency: CalibrationFrequency;
  lastCalibrationDate?: Date;
  nextCalibrationDate: Date;
  calibrationProvider: string;
  estimatedCost: number;
  reminderDays: number[];
}

export type CalibrationFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'biennial';

export interface ToolAlert extends AuditableEntity {
  toolId: UUID;
  alertType: ToolAlertType;
  severity: AlertSeverity;
  message: string;
  dueDate?: Date;
  isActive: boolean;
  acknowledgedBy?: UUID;
  acknowledgedAt?: Date;
}

export type ToolAlertType = 
  | 'calibration_due'
  | 'maintenance_due'
  | 'overdue_return'
  | 'damaged'
  | 'lost'
  | 'warranty_expiring';

export type AlertSeverity = 'info' | 'warning' | 'critical';

// DTOs
export interface CreateServiceToolRequest {
  toolCode: string;
  toolName: string;
  category: ToolCategory;
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseInfo: ToolPurchaseInfo;
  location: string;
  calibrationRequired: boolean;
  requiredForDeviceTypes: UUID[];
  specifications: ToolSpecifications;
}

export interface ToolCheckoutRequest {
  toolId: UUID;
  technicianId: UUID;
  caseId?: UUID;
  expectedReturnDate: Date;
  conditionCheckout: ToolCondition;
  notes?: string;
}

export interface ToolCheckinRequest {
  assignmentId: UUID;
  conditionReturn: ToolCondition;
  notes?: string;
  maintenanceRequired?: boolean;
}

export interface ToolSearchCriteria {
  query?: string;
  category?: ToolCategory;
  status?: ToolStatus;
  location?: string;
  availableOnly?: boolean;
  calibrationDue?: boolean;
  requiredForDeviceType?: UUID;
}

export interface ToolSearchResult {
  tools: ServiceTool[];
  total: number;
  page: number;
  limit: number;
}