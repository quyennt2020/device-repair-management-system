// Common types used across the system

export type UUID = string;

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type Status = 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled';

export interface BaseEntity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: UUID;
  updatedBy?: UUID;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchCriteria {
  query?: string;
  filters?: Record<string, any>;
  pagination?: PaginationParams;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export interface Location {
  address: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  mobile?: string;
}