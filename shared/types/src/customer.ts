import { AuditableEntity, UUID, ContactInfo, Location } from './common';

export interface Customer extends AuditableEntity {
  customerCode: string;
  customerType: CustomerType;
  companyName?: string;
  taxCode?: string;
  industry?: string;
  contactInfo: ContactInfo;
  addressInfo: CustomerAddress[];
  creditLimit?: number;
  paymentTerms?: number;
  customerTier: CustomerTier;
  status: CustomerStatus;
  accountManagerId?: UUID;
}

export type CustomerType = 'individual' | 'company';
export type CustomerTier = 'platinum' | 'gold' | 'silver' | 'bronze';
export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'suspended';

export interface CustomerAddress extends Location {
  id: UUID;
  customerId: UUID;
  addressType: AddressType;
  addressName: string;
  contactPerson?: string;
  phone?: string;
  isDefault: boolean;
}

export type AddressType = 'billing' | 'shipping' | 'service' | 'headquarters';

export interface CustomerContact extends AuditableEntity {
  customerId: UUID;
  name: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary: boolean;
  role: ContactRole;
}

export type ContactRole = 'technical' | 'purchasing' | 'management' | 'finance' | 'operations';

export interface CustomerHistory extends AuditableEntity {
  customerId: UUID;
  eventType: CustomerEventType;
  description: string;
  relatedEntityId?: UUID;
  relatedEntityType?: string;
  performedBy: UUID;
}

export type CustomerEventType = 
  | 'created'
  | 'updated'
  | 'tier_changed'
  | 'contract_signed'
  | 'contract_renewed'
  | 'service_request'
  | 'payment_received'
  | 'credit_limit_changed'
  | 'status_changed';

export interface CustomerMetrics {
  customerId: UUID;
  totalCases: number;
  completedCases: number;
  averageResolutionTime: number;
  totalRevenue: number;
  averageSatisfactionRating: number;
  lastServiceDate?: Date;
  contractsCount: number;
  activeContractsCount: number;
}

export interface CustomerPreferences {
  customerId: UUID;
  preferredTechnicians: UUID[];
  preferredServiceTimes: ServiceTimePreference[];
  communicationPreferences: CommunicationPreference;
  specialInstructions?: string;
}

export interface ServiceTimePreference {
  dayOfWeek: number; // 0-6, 0 = Sunday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
}

export interface CommunicationPreference {
  email: boolean;
  sms: boolean;
  phone: boolean;
  preferredLanguage: string;
  notificationTypes: NotificationType[];
}

export type NotificationType = 
  | 'case_created'
  | 'case_assigned'
  | 'case_completed'
  | 'quotation_ready'
  | 'approval_required'
  | 'service_reminder'
  | 'contract_expiry';

// DTOs
export interface CreateCustomerRequest {
  customerCode: string;
  customerType: CustomerType;
  companyName?: string;
  taxCode?: string;
  industry?: string;
  contactInfo: ContactInfo;
  addressInfo: Omit<CustomerAddress, 'id' | 'customerId'>[];
  creditLimit?: number;
  paymentTerms?: number;
  customerTier?: CustomerTier;
  accountManagerId?: UUID;
}

export interface UpdateCustomerRequest {
  companyName?: string;
  taxCode?: string;
  industry?: string;
  contactInfo?: Partial<ContactInfo>;
  creditLimit?: number;
  paymentTerms?: number;
  customerTier?: CustomerTier;
  status?: CustomerStatus;
  accountManagerId?: UUID;
}

export interface CustomerSearchCriteria {
  query?: string;
  customerType?: CustomerType;
  customerTier?: CustomerTier;
  status?: CustomerStatus;
  industry?: string;
  accountManagerId?: UUID;
  createdDateFrom?: Date;
  createdDateTo?: Date;
}

export interface CustomerSearchResult {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
}