import { AuditableEntity, UUID } from './common';

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

export type WarehouseStatus = 'active' | 'closed' | 'maintenance';expor
t interface PartInventory extends AuditableEntity {
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