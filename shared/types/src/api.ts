import { UUID, PaginatedResponse, ApiResponse } from './common';

// Generic API Response Types
export interface SuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse extends ApiResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
    validationErrors?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// Authentication & Authorization
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthenticatedUser {
  id: UUID;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  customerId?: UUID;
  technicianId?: UUID;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Request/Response Headers
export interface RequestHeaders {
  'Authorization'?: string;
  'Content-Type'?: string;
  'Accept'?: string;
  'X-Request-ID'?: string;
  'X-Correlation-ID'?: string;
  'X-User-ID'?: string;
}

export interface ResponseHeaders {
  'X-Request-ID': string;
  'X-Rate-Limit-Remaining'?: string;
  'X-Rate-Limit-Reset'?: string;
}

// Pagination
export interface PaginationRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Search and Filtering
export interface SearchRequest extends PaginationRequest {
  query?: string;
  filters?: Record<string, any>;
  dateRange?: DateRangeFilter;
}

export interface DateRangeFilter {
  field: string;
  from?: Date;
  to?: Date;
}

// File Upload
export interface FileUploadRequest {
  file: File;
  fileName?: string;
  description?: string;
  tags?: string[];
}

export interface FileUploadResponse {
  fileId: UUID;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  uploadedAt: Date;
}

// Bulk Operations
export interface BulkOperationRequest<T> {
  operation: 'create' | 'update' | 'delete';
  items: T[];
  options?: BulkOperationOptions;
}

export interface BulkOperationOptions {
  continueOnError?: boolean;
  batchSize?: number;
  validateOnly?: boolean;
}

export interface BulkOperationResponse {
  totalItems: number;
  successCount: number;
  errorCount: number;
  errors: BulkOperationError[];
  results?: any[];
}

export interface BulkOperationError {
  index: number;
  item: any;
  error: string;
  code: string;
}

// Health Check
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  services: ServiceHealthStatus[];
  uptime: number;
}

export interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

// Metrics and Analytics
export interface MetricsRequest {
  metrics: string[];
  dateRange: DateRangeFilter;
  groupBy?: string;
  filters?: Record<string, any>;
}

export interface MetricsResponse {
  metrics: MetricData[];
  period: {
    from: Date;
    to: Date;
  };
  generatedAt: Date;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  previousValue?: number;
  changePercentage?: number;
  dataPoints?: DataPoint[];
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

// Notification
export interface NotificationRequest {
  recipients: NotificationRecipient[];
  subject: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  templateId?: UUID;
  templateData?: Record<string, any>;
  scheduledAt?: Date;
}

export interface NotificationRecipient {
  userId?: UUID;
  email?: string;
  phone?: string;
  role?: string;
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

// Export/Import
export interface ExportRequest {
  format: ExportFormat;
  filters?: Record<string, any>;
  fields?: string[];
  dateRange?: DateRangeFilter;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

export interface ExportResponse {
  exportId: UUID;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  recordCount?: number;
  fileSize?: number;
}

export interface ImportRequest {
  file: File;
  format: ImportFormat;
  options: ImportOptions;
}

export type ImportFormat = 'csv' | 'xlsx' | 'json';

export interface ImportOptions {
  skipHeader?: boolean;
  delimiter?: string;
  mapping?: Record<string, string>;
  validateOnly?: boolean;
  updateExisting?: boolean;
}

export interface ImportResponse {
  importId: UUID;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords?: number;
  processedRecords?: number;
  successCount?: number;
  errorCount?: number;
  errors?: ImportError[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: any;
}