import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '@drms/shared-database';
import { config } from '../config';
import { EmailService } from './email.service';
import { AuditService } from './audit.service';
import { UUID } from '@drms/shared-types';

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
}

export class UserService {
  private emailService: EmailService;
  private auditService: AuditService;

  constructor() {
    this.emailService = new EmailService();
    this.auditService = new AuditService();
  }

  async createUser(request: CreateUserRequest): Promise<any> {
    try {
      // Check if user already exists
      const existingUser = await this.findUserByEmail(request.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(request.password, config.password.saltRounds);

      // Create user
      const result = await db.query(`
        INSERT INTO users (email, password_hash, full_name, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, full_name, phone, created_at
      `, [request.email, passwordHash, request.fullName, request.phone]);

      const user = result.rows[0];

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + config.tokens.emailVerification);

      await db.query(`
        INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [user.id, verificationToken, request.email, expiresAt]);

      // Send verification email
      await this.emailService.sendEmailVerification(
        request.email,
        request.fullName,
        verificationToken
      );

      // Log user creation
      await this.auditService.logAuthEvent(user.id, 'user_created', {
        email: request.email
      }, null, null, true);

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        createdAt: user.created_at
      };
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  async getUserById(userId: UUID): Promise<any> {
    try {
      const result = await db.query(`
        SELECT 
          u.id,
          u.email,
          u.full_name,
          u.phone,
          u.avatar_url,
          u.email_verified,
          u.phone_verified,
          u.last_login_at,
          u.login_count,
          u.status,
          u.created_at,
          u.updated_at,
          COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') as roles,
          COALESCE(array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = $1
        GROUP BY u.id
      `, [userId]);

      const user = result.rows[0];
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        emailVerified: user.email_verified,
        phoneVerified: user.phone_verified,
        lastLoginAt: user.last_login_at,
        loginCount: user.login_count,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  async updateUser(userId: UUID, request: UpdateUserRequest): Promise<any> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (request.fullName !== undefined) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(request.fullName);
      }

      if (request.phone !== undefined) {
        updates.push(`phone = $${paramCount++}`);
        values.push(request.phone);
      }

      if (request.avatarUrl !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`);
        values.push(request.avatarUrl);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(userId);

      const result = await db.query(`
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, full_name, phone, avatar_url, updated_at
      `, values);

      const user = result.rows[0];
      if (!user) {
        throw new Error('User not found');
      }

      // Log profile update
      await this.auditService.logAuthEvent(userId, 'profile_updated', {
        updatedFields: Object.keys(request)
      }, null, null, true);

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        updatedAt: user.updated_at
      };
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      // Find verification token
      const tokenResult = await db.query(`
        SELECT user_id, email, expires_at, verified_at
        FROM email_verification_tokens
        WHERE token = $1
      `, [token]);

      const tokenData = tokenResult.rows[0];
      if (!tokenData) {
        throw new Error('Invalid verification token');
      }

      if (tokenData.verified_at) {
        throw new Error('Email already verified');
      }

      if (tokenData.expires_at < new Date()) {
        throw new Error('Verification token expired');
      }

      // Update user email verification status
      await db.query(`
        UPDATE users 
        SET email_verified = true, email_verified_at = NOW()
        WHERE id = $1
      `, [tokenData.user_id]);

      // Mark token as used
      await db.query(`
        UPDATE email_verification_tokens 
        SET verified_at = NOW()
        WHERE token = $1
      `, [token]);

      // Get user details for welcome email
      const user = await this.getUserById(tokenData.user_id);
      
      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.fullName);

      // Log email verification
      await this.auditService.logAuthEvent(tokenData.user_id, 'email_verified', {
        email: tokenData.email
      }, null, null, true);
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  async resendEmailVerification(email: string): Promise<void> {
    try {
      const user = await this.findUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return;
      }

      if (user.email_verified) {
        throw new Error('Email already verified');
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + config.tokens.emailVerification);

      // Invalidate old tokens
      await db.query(`
        DELETE FROM email_verification_tokens 
        WHERE user_id = $1 AND verified_at IS NULL
      `, [user.id]);

      // Create new token
      await db.query(`
        INSERT INTO email_verification_tokens (user_id, token, email, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [user.id, verificationToken, email, expiresAt]);

      // Send verification email
      await this.emailService.sendEmailVerification(
        email,
        user.full_name,
        verificationToken
      );

      // Log resend verification
      await this.auditService.logAuthEvent(user.id, 'email_verification_resent', {
        email
      }, null, null, true);
    } catch (error) {
      console.error('Resend email verification error:', error);
      throw error;
    }
  }

  async deactivateUser(userId: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE users 
        SET status = 'inactive', updated_at = NOW()
        WHERE id = $1
      `, [userId]);

      // Invalidate all user sessions
      await db.query(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE user_id = $1
      `, [userId]);

      // Log user deactivation
      await this.auditService.logAuthEvent(userId, 'user_deactivated', {}, null, null, true);
    } catch (error) {
      console.error('Deactivate user error:', error);
      throw error;
    }
  }

  async reactivateUser(userId: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE users 
        SET status = 'active', updated_at = NOW()
        WHERE id = $1
      `, [userId]);

      // Log user reactivation
      await this.auditService.logAuthEvent(userId, 'user_reactivated', {}, null, null, true);
    } catch (error) {
      console.error('Reactivate user error:', error);
      throw error;
    }
  }

  async getUserSessions(userId: UUID): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          id,
          device_info,
          ip_address,
          user_agent,
          expires_at,
          last_activity_at,
          is_active,
          created_at
        FROM user_sessions
        WHERE user_id = $1
        ORDER BY last_activity_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      console.error('Get user sessions error:', error);
      throw error;
    }
  }

  async revokeSession(userId: UUID, sessionId: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE id = $1 AND user_id = $2
      `, [sessionId, userId]);

      // Log session revocation
      await this.auditService.logAuthEvent(userId, 'session_revoked', {
        sessionId
      }, null, null, true);
    } catch (error) {
      console.error('Revoke session error:', error);
      throw error;
    }
  }

  private async findUserByEmail(email: string): Promise<any> {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  }
}