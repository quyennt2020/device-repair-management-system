import { AuditableEntity, UUID } from './common';

export type { UUID } from './common';

export interface SparePart extends AuditableEntity {
  partNumber: string;
  partName: string;
  category: string;
  manufacturer: string;
  specifications: PartSpecifications;
  compatibleDevices: UUID[];
  pricingInfo: PartPricingInfo;
  inventorySettings: PartInventorySettings;
  status: PartStatus;
  imageUrl?: string;
  datasheetUrl?: string;
}

export interface PartSpecifications {
  [key: string]: any;
}

export interface PartPricingInfo {
  unitCost: number;
  sellingPrice: number;
  currency: string;
  supplierInfo?: SupplierInfo;
}

export interface SupplierInfo {
  supplierId: UUID;
  supplierName: string;
  supplierPartNumber?: string;
  leadTimeDays: number;
  minimumOrderQuantity: number;
}

export interface PartInventorySettings {
  reorderLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  maxStockLevel: number;
  substituteParts?: UUID[];
}

export type PartStatus = 'active' | 'discontinued' | 'obsolete' | 'pending_approval';

export interface Warehouse extends AuditableEntity {
  warehouseName: string;
  warehouseCode: string;
  location: string;
  managerId?: UUID;
  status: WarehouseStatus;
}

export type WarehouseStatus = 'active' | 'closed' | 'maintenance';

export interface PartInventory extends AuditableEntity {
  sparePartId: UUID;
  warehouseId: UUID;
  quantityAvailable: number;
  quantityReserved: number;
  quantityOnOrder: number;
  minimumStock: number;
  maximumStock: number;
  lastStocktakeDate?: Date;
  locationBin?: string;
}

export interface InventoryTransaction extends AuditableEntity {
  sparePartId: UUID;
  warehouseId: UUID;
  transactionType: TransactionType;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: UUID;
  performedBy: UUID;
  transactionDate: Date;
  notes?: string;
}

export type TransactionType = 'in' | 'out' | 'transfer' | 'adjustment' | 'return';

export interface CasePartUsage extends AuditableEntity {
  repairCaseId: UUID;
  sparePartId: UUID;
  quantityUsed: number;
  unitCost: number;
  totalCost: number;
  warrantyMonths: number;
  installationDate?: Date;
  technicianId: UUID;
  oldPartSerial?: string;
  newPartSerial?: string;
  returnOldPart: boolean;
}

export interface InventoryAlert extends AuditableEntity {
  sparePartId: UUID;
  warehouseId: UUID;
  alertType: InventoryAlertType;
  severity: AlertSeverity;
  message: string;
  threshold: number;
  currentValue: number;
  isActive: boolean;
  acknowledgedBy?: UUID;
  acknowledgedAt?: Date;
}

export type InventoryAlertType = 'low_stock' | 'out_of_stock' | 'overstock' | 'expired' | 'slow_moving';
export type AlertSeverity = 'info' | 'warning' | 'critical';

// DTOs
export interface CreateSparePartRequest {
  partNumber: string;
  partName: string;
  category: string;
  manufacturer: string;
  specifications: PartSpecifications;
  compatibleDevices: UUID[];
  pricingInfo: PartPricingInfo;
  inventorySettings: PartInventorySettings;
}

export interface InventoryTransactionRequest {
  sparePartId: UUID;
  warehouseId: UUID;
  transactionType: TransactionType;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: UUID;
  notes?: string;
}

export interface PartReservationRequest {
  sparePartId: UUID;
  warehouseId: UUID;
  quantity: number;
  reservedFor: UUID; // case ID
  reservedBy: UUID;
  expiryDate?: Date;
}

export interface InventorySearchCriteria {
  query?: string;
  category?: string;
  manufacturer?: string;
  warehouseId?: UUID;
  status?: PartStatus;
  lowStock?: boolean;
  compatibleDeviceId?: UUID;
}

// Enhanced transaction management types
export interface PartReservation extends AuditableEntity {
  sparePartId: UUID;
  warehouseId: UUID;
  quantity: number;
  reservedFor: UUID; // case ID or quotation ID
  reservationType: ReservationType;
  reservedBy: UUID;
  expiryDate?: Date;
  status: ReservationStatus;
  consumedQuantity: number;
  releasedQuantity: number;
}

export type ReservationType = 'quotation' | 'case' | 'maintenance' | 'emergency';
export type ReservationStatus = 'active' | 'consumed' | 'released' | 'expired';

export interface InventoryReconciliation extends AuditableEntity {
  reconciliationId: string;
  warehouseId: UUID;
  performedBy: UUID;
  reconciliationType: ReconciliationType;
  status: ReconciliationStatus;
  startDate: Date;
  completedDate?: Date;
  totalItemsChecked: number;
  discrepanciesFound: number;
  totalAdjustmentValue: number;
  notes?: string;
}

export type ReconciliationType = 'full_stocktake' | 'cycle_count' | 'spot_check' | 'variance_investigation';
export type ReconciliationStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface ReconciliationItem extends AuditableEntity {
  reconciliationId: UUID;
  sparePartId: UUID;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  varianceValue: number;
  countedBy: UUID;
  countedAt: Date;
  notes?: string;
  images?: string[];
}

export interface ConsumptionTracking extends AuditableEntity {
  repairCaseId: UUID;
  sparePartId: UUID;
  warehouseId: UUID;
  reservationId?: UUID;
  quantityConsumed: number;
  unitCost: number;
  totalCost: number;
  consumedBy: UUID;
  consumedAt: Date;
  workflowStepId?: string;
  installationNotes?: string;
  warrantyMonths: number;
  serialNumbers?: string[];
}

export interface TransactionAuditLog extends AuditableEntity {
  transactionId: UUID;
  auditAction: AuditAction;
  performedBy: UUID;
  performedAt: Date;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'cancel';

// Enhanced request types
export interface CreateReservationRequest {
  sparePartId: UUID;
  warehouseId: UUID;
  quantity: number;
  reservedFor: UUID;
  reservationType: ReservationType;
  expiryDate?: Date;
  notes?: string;
}

export interface ConsumeReservationRequest {
  reservationId: UUID;
  quantityToConsume: number;
  repairCaseId: UUID;
  workflowStepId?: string;
  installationNotes?: string;
  serialNumbers?: string[];
}

export interface ReconciliationRequest {
  warehouseId: UUID;
  reconciliationType: ReconciliationType;
  itemsToCheck?: Array<{
    sparePartId: UUID;
    expectedQuantity?: number;
  }>;
  notes?: string;
}

export interface ReconciliationItemUpdate {
  reconciliationId: UUID;
  sparePartId: UUID;
  countedQuantity: number;
  notes?: string;
  images?: string[];
}