import { AuditableEntity, UUID } from './common';

// User Management
export interface User extends AuditableEntity {
  email: string;
  passwordHash: string;
  fullName: string;
  status: UserStatus;
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  passwordChangedAt: Date;
  roles: Role[];
  permissions: Permission[];
}

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'locked';

export interface Role extends AuditableEntity {
  name: string;
  displayName: string;
  description?: string;
  isSystemRole: boolean;
  permissions: Permission[];
}

export interface Permission extends AuditableEntity {
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
}

export interface UserRole extends AuditableEntity {
  userId: UUID;
  roleId: UUID;
  assignedBy?: UUID;
  assignedAt: Date;
  expiresAt?: Date;
}

export interface RolePermission extends AuditableEntity {
  roleId: UUID;
  permissionId: UUID;
}

// Authentication
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: DeviceInfo;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthenticatedUser {
  id: UUID;
  email: string;
  fullName: string;
  status: UserStatus;
  roles: string[];
  permissions: string[];
  customerId?: UUID;
  technicianId?: UUID;
  lastLoginAt?: Date;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LogoutRequest {
  refreshToken?: string;
  allDevices?: boolean;
}

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  browser?: string;
  version?: string;
}

// User Session Management
export interface UserSession extends AuditableEntity {
  userId: UUID;
  refreshToken: string;
  accessTokenJti: string;
  deviceInfo: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  lastUsedAt: Date;
}

// JWT Token Structure
export interface JWTPayload {
  sub: UUID; // user ID
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  customerId?: UUID;
  technicianId?: UUID;
  iat: number;
  exp: number;
  jti: string;
  sessionId: UUID;
}

// Password Management
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordResetToken extends AuditableEntity {
  userId: UUID;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
}

// Email Verification
export interface EmailVerificationToken extends AuditableEntity {
  userId: UUID;
  token: string;
  expiresAt: Date;
  verifiedAt?: Date;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

// User Registration
export interface RegisterUserRequest {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  acceptTerms: boolean;
  invitationToken?: string;
}

export interface RegisterUserResponse {
  user: {
    id: UUID;
    email: string;
    fullName: string;
    status: UserStatus;
  };
  emailVerificationRequired: boolean;
  message: string;
}

// User Management (Admin)
export interface CreateUserRequest {
  email: string;
  fullName: string;
  password?: string;
  roles: UUID[];
  sendInvitation?: boolean;
  customerId?: UUID;
  technicianId?: UUID;
}

export interface UpdateUserRequest {
  fullName?: string;
  status?: UserStatus;
  roles?: UUID[];
  customerId?: UUID;
  technicianId?: UUID;
}

export interface UserSearchCriteria {
  query?: string;
  status?: UserStatus;
  role?: string;
  customerId?: UUID;
  technicianId?: UUID;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface UserSearchResult {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

// Role Management
export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  permissions: UUID[];
}

export interface UpdateRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: UUID[];
}

export interface AssignRoleRequest {
  userId: UUID;
  roleId: UUID;
  expiresAt?: Date;
}

// Permission Management
export interface CreatePermissionRequest {
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
}

// Authorization
export interface AuthorizationContext {
  userId: UUID;
  roles: string[];
  permissions: string[];
  customerId?: UUID;
  technicianId?: UUID;
  ipAddress?: string;
  userAgent?: string;
}

export interface PermissionCheck {
  resource: string;
  action: string;
  resourceId?: UUID;
  context?: Record<string, any>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  missingPermissions?: string[];
}

// Audit Logging
export interface AuditLog extends AuditableEntity {
  userId?: UUID;
  action: string;
  resource: string;
  resourceId?: UUID;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogRequest {
  action: string;
  resource: string;
  resourceId?: UUID;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export interface AuditSearchCriteria {
  userId?: UUID;
  action?: string;
  resource?: string;
  resourceId?: UUID;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
}

// Security Settings
export interface SecuritySettings {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  passwordExpiryDays: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  refreshTokenExpiryDays: number;
  requireEmailVerification: boolean;
  allowMultipleSessions: boolean;
  twoFactorAuthRequired: boolean;
}

// Two-Factor Authentication
export interface TwoFactorSetupRequest {
  method: TwoFactorMethod;
  phoneNumber?: string;
}

export interface TwoFactorSetupResponse {
  method: TwoFactorMethod;
  qrCode?: string;
  backupCodes: string[];
  secret?: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
  method: TwoFactorMethod;
}

export interface TwoFactorChallenge {
  challengeId: UUID;
  method: TwoFactorMethod;
  expiresAt: Date;
}

export type TwoFactorMethod = 'totp' | 'sms' | 'email' | 'backup_code';

// API Key Management
export interface ApiKey extends AuditableEntity {
  userId: UUID;
  name: string;
  keyHash: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  isActive: boolean;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface CreateApiKeyResponse {
  apiKey: {
    id: UUID;
    name: string;
    permissions: string[];
    expiresAt?: Date;
  };
  key: string; // Only returned once
}

// Error Types
export interface AuthenticationError extends Error {
  code: AuthErrorCode;
  details?: Record<string, any>;
}

export type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'USER_LOCKED'
  | 'EMAIL_NOT_VERIFIED'
  | 'PASSWORD_EXPIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'TWO_FACTOR_REQUIRED'
  | 'TWO_FACTOR_INVALID'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED';

// Service Interfaces
export interface AuthenticationService {
  login(request: LoginRequest): Promise<LoginResponse>;
  logout(userId: UUID, sessionId?: UUID): Promise<void>;
  refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse>;
  verifyToken(token: string): Promise<JWTPayload>;
  changePassword(userId: UUID, request: ChangePasswordRequest): Promise<void>;
  resetPassword(request: ResetPasswordRequest): Promise<void>;
  confirmResetPassword(request: ResetPasswordConfirmRequest): Promise<void>;
  verifyEmail(request: VerifyEmailRequest): Promise<void>;
  resendVerification(request: ResendVerificationRequest): Promise<void>;
}

export interface AuthorizationService {
  checkPermission(context: AuthorizationContext, check: PermissionCheck): Promise<AuthorizationResult>;
  checkPermissions(context: AuthorizationContext, checks: PermissionCheck[]): Promise<AuthorizationResult[]>;
  hasRole(context: AuthorizationContext, role: string): boolean;
  hasPermission(context: AuthorizationContext, permission: string): boolean;
  getUserPermissions(userId: UUID): Promise<string[]>;
  getUserRoles(userId: UUID): Promise<string[]>;
}

export interface UserManagementService {
  createUser(request: CreateUserRequest): Promise<User>;
  updateUser(userId: UUID, request: UpdateUserRequest): Promise<User>;
  deleteUser(userId: UUID): Promise<void>;
  getUser(userId: UUID): Promise<User>;
  searchUsers(criteria: UserSearchCriteria): Promise<UserSearchResult>;
  assignRole(request: AssignRoleRequest): Promise<void>;
  removeRole(userId: UUID, roleId: UUID): Promise<void>;
  lockUser(userId: UUID, reason: string): Promise<void>;
  unlockUser(userId: UUID): Promise<void>;
}