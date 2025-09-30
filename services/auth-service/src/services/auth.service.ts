import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '@drms/shared-database';
import { 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest, 
  RefreshTokenResponse,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
  JWTPayload,
  AuthenticatedUser,
  UserSession,
  AuthenticationError,
  AuthErrorCode
} from '@drms/shared-types';
import { config } from '../config';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';

export class AuthenticationService {
  private userRepository: UserRepository;
  private sessionRepository: SessionRepository;
  private auditService: AuditService;
  private emailService: EmailService;

  constructor() {
    this.userRepository = new UserRepository();
    this.sessionRepository = new SessionRepository();
    this.auditService = new AuditService();
    this.emailService = new EmailService();
  }

  async login(request: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(request.email);
      if (!user) {
        await this.auditService.logAction({
          action: 'LOGIN_FAILED',
          resource: 'User',
          resourceId: null,
          metadata: { email: request.email, reason: 'USER_NOT_FOUND', ipAddress, userAgent }
        });
        throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Check if user is active
      if (user.status !== 'active') {
        await this.auditService.logAction({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'User',
          resourceId: user.id,
          metadata: { reason: 'USER_INACTIVE', ipAddress, userAgent }
        });
        throw new AuthenticationError('User account is inactive', 'USER_INACTIVE');
      }

      // Check if user is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await this.auditService.logAction({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'User',
          resourceId: user.id,
          metadata: { reason: 'USER_LOCKED', ipAddress, userAgent }
        });
        throw new AuthenticationError('User account is locked', 'USER_LOCKED');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(request.password, user.passwordHash);
      if (!isPasswordValid) {
        // Increment failed login attempts
        await this.userRepository.incrementFailedLoginAttempts(user.id);
        
        // Lock user if max attempts reached
        if (user.failedLoginAttempts + 1 >= config.maxFailedLoginAttempts) {
          const lockUntil = new Date(Date.now() + config.lockoutDurationMinutes * 60 * 1000);
          await this.userRepository.lockUser(user.id, lockUntil);
        }

        await this.auditService.logAction({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'User',
          resourceId: user.id,
          metadata: { reason: 'INVALID_PASSWORD', ipAddress, userAgent }
        });
        throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
      }

      // Check email verification if required
      if (config.requireEmailVerification && !user.emailVerified) {
        await this.auditService.logAction({
          userId: user.id,
          action: 'LOGIN_FAILED',
          resource: 'User',
          resourceId: user.id,
          metadata: { reason: 'EMAIL_NOT_VERIFIED', ipAddress, userAgent }
        });
        throw new AuthenticationError('Email not verified', 'EMAIL_NOT_VERIFIED');
      }

      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0) {
        await this.userRepository.resetFailedLoginAttempts(user.id);
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Get user roles and permissions
      const roles = await this.userRepository.getUserRoles(user.id);
      const permissions = await this.userRepository.getUserPermissions(user.id);

      // Create session
      const sessionData = {
        userId: user.id,
        deviceInfo: request.deviceInfo || {},
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + (config.sessionTimeoutMinutes * 60 * 1000))
      };

      const session = await this.sessionRepository.createSession(sessionData);

      // Generate tokens
      const accessToken = this.generateAccessToken(user, roles, permissions, session.id);
      const refreshToken = session.refreshToken;

      // Log successful login
      await this.auditService.logAction({
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        resource: 'User',
        resourceId: user.id,
        metadata: { ipAddress, userAgent, sessionId: session.id }
      });

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        roles: roles.map(r => r.name),
        permissions: permissions.map(p => p.name),
        customerId: await this.getCustomerId(user.id),
        technicianId: await this.getTechnicianId(user.id),
        lastLoginAt: new Date()
      };

      return {
        user: authenticatedUser,
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
        tokenType: 'Bearer'
      };

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Login error:', error);
      throw new AuthenticationError('Authentication failed', 'INVALID_CREDENTIALS');
    }
  }

  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      // Find session by refresh token
      const session = await this.sessionRepository.findByRefreshToken(request.refreshToken);
      if (!session) {
        throw new AuthenticationError('Invalid refresh token', 'TOKEN_INVALID');
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await this.sessionRepository.deleteSession(session.id);
        throw new AuthenticationError('Session expired', 'SESSION_EXPIRED');
      }

      // Get user
      const user = await this.userRepository.findById(session.userId);
      if (!user || user.status !== 'active') {
        await this.sessionRepository.deleteSession(session.id);
        throw new AuthenticationError('User not found or inactive', 'USER_INACTIVE');
      }

      // Get user roles and permissions
      const roles = await this.userRepository.getUserRoles(user.id);
      const permissions = await this.userRepository.getUserPermissions(user.id);

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user, roles, permissions, session.id);
      const newRefreshToken = crypto.randomBytes(64).toString('hex');

      // Update session
      await this.sessionRepository.updateSession(session.id, {
        refreshToken: newRefreshToken,
        lastUsedAt: new Date()
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Refresh token error:', error);
      throw new AuthenticationError('Token refresh failed', 'TOKEN_INVALID');
    }
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        // Logout specific session
        await this.sessionRepository.deleteSession(sessionId);
      } else {
        // Logout all sessions for user
        await this.sessionRepository.deleteUserSessions(userId);
      }

      await this.auditService.logAction({
        userId,
        action: 'LOGOUT',
        resource: 'User',
        resourceId: userId,
        metadata: { sessionId }
      });

    } catch (error) {
      console.error('Logout error:', error);
      throw new AuthenticationError('Logout failed', 'TOKEN_INVALID');
    }
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as JWTPayload;
      
      // Check if session still exists
      const session = await this.sessionRepository.findById(payload.sessionId);
      if (!session || session.expiresAt < new Date()) {
        throw new AuthenticationError('Session expired', 'SESSION_EXPIRED');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token', 'TOKEN_INVALID');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired', 'TOKEN_EXPIRED');
      }
      throw error;
    }
  }

  private generateAccessToken(user: any, roles: any[], permissions: any[], sessionId: string): string {
    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: roles.map(r => r.name),
      permissions: permissions.map(p => p.name),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      jti: crypto.randomUUID(),
      sessionId
    };

    return jwt.sign(payload, config.jwtSecret);
  }

  private async getCustomerId(userId: string): Promise<string | undefined> {
    try {
      const result = await db.query(
        'SELECT customer_id FROM customers WHERE created_by = $1 OR id IN (SELECT customer_id FROM customer_contacts WHERE user_id = $1)',
        [userId]
      );
      return result.rows[0]?.customer_id;
    } catch (error) {
      return undefined;
    }
  }

  private async getTechnicianId(userId: string): Promise<string | undefined> {
    try {
      const result = await db.query('SELECT id FROM technicians WHERE user_id = $1', [userId]);
      return result.rows[0]?.id;
    } catch (error) {
      return undefined;
    }
  }

  // Additional methods for password management, email verification, etc.
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    // Implementation for password change
    // This would include current password verification, new password validation, etc.
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    // Implementation for password reset request
    // This would generate a reset token and send email
  }

  async confirmResetPassword(request: ResetPasswordConfirmRequest): Promise<void> {
    // Implementation for password reset confirmation
    // This would verify token and update password
  }

  async verifyEmail(request: VerifyEmailRequest): Promise<void> {
    // Implementation for email verification
  }

  async resendVerification(request: ResendVerificationRequest): Promise<void> {
    // Implementation for resending verification email
  }
}

class AuthenticationError extends Error {
  public code: AuthErrorCode;
  public details?: Record<string, any>;

  constructor(message: string, code: AuthErrorCode, details?: Record<string, any>) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.details = details;
  }
}