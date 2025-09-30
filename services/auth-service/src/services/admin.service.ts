import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';
import { AuditService } from './audit.service';

export interface UserManagementFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'suspended';
  role?: string;
  emailVerified?: boolean;
  lastLoginBefore?: Date;
  lastLoginAfter?: Date;
  createdBefore?: Date;
  createdAfter?: Date;
}

export interface UserManagementResult {
  users: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  unverifiedUsers: number;
  totalRoles: number;
  totalPermissions: number;
  recentLogins: number;
  failedLoginAttempts: number;
  lockedAccounts: number;
}

export class AdminService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Get paginated list of users with filters
   */
  async getUsers(filters: UserManagementFilters = {}): Promise<UserManagementResult> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status,
        role,
        emailVerified,
        lastLoginBefore,
        lastLoginAfter,
        createdBefore,
        createdAfter
      } = filters;

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      // Build WHERE conditions
      if (search) {
        conditions.push(`(u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);\n        params.push(`%${search}%`);\n        paramCount++;\n      }\n\n      if (status) {\n        conditions.push(`u.status = $${paramCount}`);\n        params.push(status);\n        paramCount++;\n      }\n\n      if (emailVerified !== undefined) {\n        conditions.push(`u.email_verified = $${paramCount}`);\n        params.push(emailVerified);\n        paramCount++;\n      }\n\n      if (lastLoginBefore) {\n        conditions.push(`u.last_login_at < $${paramCount}`);\n        params.push(lastLoginBefore);\n        paramCount++;\n      }\n\n      if (lastLoginAfter) {\n        conditions.push(`u.last_login_at > $${paramCount}`);\n        params.push(lastLoginAfter);\n        paramCount++;\n      }\n\n      if (createdBefore) {\n        conditions.push(`u.created_at < $${paramCount}`);\n        params.push(createdBefore);\n        paramCount++;\n      }\n\n      if (createdAfter) {\n        conditions.push(`u.created_at > $${paramCount}`);\n        params.push(createdAfter);\n        paramCount++;\n      }\n\n      if (role) {\n        conditions.push(`EXISTS (\n          SELECT 1 FROM user_roles ur \n          JOIN roles r ON ur.role_id = r.id \n          WHERE ur.user_id = u.id AND r.name = $${paramCount}\n        )`);\n        params.push(role);\n        paramCount++;\n      }\n\n      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';\n\n      // Get total count\n      const countQuery = `\n        SELECT COUNT(DISTINCT u.id) as total\n        FROM users u\n        ${whereClause}\n      `;\n      const countResult = await db.query(countQuery, params);\n      const total = parseInt(countResult.rows[0].total);\n\n      // Get users with roles\n      const usersQuery = `\n        SELECT \n          u.id,\n          u.email,\n          u.full_name,\n          u.phone,\n          u.avatar_url,\n          u.email_verified,\n          u.phone_verified,\n          u.last_login_at,\n          u.login_count,\n          u.failed_login_attempts,\n          u.locked_until,\n          u.status,\n          u.created_at,\n          u.updated_at,\n          COALESCE(array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL), '{}') as roles,\n          COALESCE(array_agg(DISTINCT r.display_name) FILTER (WHERE r.display_name IS NOT NULL), '{}') as role_names\n        FROM users u\n        LEFT JOIN user_roles ur ON u.id = ur.user_id\n        LEFT JOIN roles r ON ur.role_id = r.id\n        ${whereClause}\n        GROUP BY u.id\n        ORDER BY u.created_at DESC\n        LIMIT $${paramCount} OFFSET $${paramCount + 1}\n      `;\n      \n      params.push(limit, offset);\n      const usersResult = await db.query(usersQuery, params);\n\n      const users = usersResult.rows.map(row => ({\n        id: row.id,\n        email: row.email,\n        fullName: row.full_name,\n        phone: row.phone,\n        avatarUrl: row.avatar_url,\n        emailVerified: row.email_verified,\n        phoneVerified: row.phone_verified,\n        lastLoginAt: row.last_login_at,\n        loginCount: row.login_count,\n        failedLoginAttempts: row.failed_login_attempts,\n        lockedUntil: row.locked_until,\n        status: row.status,\n        roles: row.roles,\n        roleNames: row.role_names,\n        createdAt: row.created_at,\n        updatedAt: row.updated_at\n      }));\n\n      return {\n        users,\n        total,\n        page,\n        limit,\n        totalPages: Math.ceil(total / limit)\n      };\n    } catch (error) {\n      console.error('Get users error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Get system statistics for admin dashboard\n   */\n  async getSystemStats(): Promise<SystemStats> {\n    try {\n      const stats = await Promise.all([\n        // Total users\n        db.query('SELECT COUNT(*) as count FROM users'),\n        // Active users\n        db.query(\"SELECT COUNT(*) as count FROM users WHERE status = 'active'\"),\n        // Inactive users\n        db.query(\"SELECT COUNT(*) as count FROM users WHERE status = 'inactive'\"),\n        // Suspended users\n        db.query(\"SELECT COUNT(*) as count FROM users WHERE status = 'suspended'\"),\n        // Unverified users\n        db.query('SELECT COUNT(*) as count FROM users WHERE email_verified = false'),\n        // Total roles\n        db.query('SELECT COUNT(*) as count FROM roles'),\n        // Total permissions\n        db.query('SELECT COUNT(*) as count FROM permissions'),\n        // Recent logins (last 24 hours)\n        db.query('SELECT COUNT(*) as count FROM users WHERE last_login_at > NOW() - INTERVAL \\'24 hours\\''),\n        // Failed login attempts (last 24 hours)\n        db.query('SELECT COUNT(*) as count FROM auth_audit_log WHERE event_type = \\'login_failed\\' AND created_at > NOW() - INTERVAL \\'24 hours\\''),\n        // Currently locked accounts\n        db.query('SELECT COUNT(*) as count FROM users WHERE locked_until > NOW()')\n      ]);\n\n      return {\n        totalUsers: parseInt(stats[0].rows[0].count),\n        activeUsers: parseInt(stats[1].rows[0].count),\n        inactiveUsers: parseInt(stats[2].rows[0].count),\n        suspendedUsers: parseInt(stats[3].rows[0].count),\n        unverifiedUsers: parseInt(stats[4].rows[0].count),\n        totalRoles: parseInt(stats[5].rows[0].count),\n        totalPermissions: parseInt(stats[6].rows[0].count),\n        recentLogins: parseInt(stats[7].rows[0].count),\n        failedLoginAttempts: parseInt(stats[8].rows[0].count),\n        lockedAccounts: parseInt(stats[9].rows[0].count)\n      };\n    } catch (error) {\n      console.error('Get system stats error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Suspend user account\n   */\n  async suspendUser(userId: UUID, adminId: UUID, reason?: string): Promise<void> {\n    try {\n      await db.query(`\n        UPDATE users \n        SET status = 'suspended', updated_at = NOW()\n        WHERE id = $1\n      `, [userId]);\n\n      // Invalidate all user sessions\n      await db.query(`\n        UPDATE user_sessions \n        SET is_active = false \n        WHERE user_id = $1\n      `, [userId]);\n\n      // Log suspension\n      await this.auditService.logAuthEvent(adminId, 'user_suspended', {\n        suspendedUserId: userId,\n        reason\n      }, null, null, true);\n    } catch (error) {\n      console.error('Suspend user error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Unsuspend user account\n   */\n  async unsuspendUser(userId: UUID, adminId: UUID): Promise<void> {\n    try {\n      await db.query(`\n        UPDATE users \n        SET status = 'active', updated_at = NOW()\n        WHERE id = $1\n      `, [userId]);\n\n      // Log unsuspension\n      await this.auditService.logAuthEvent(adminId, 'user_unsuspended', {\n        unsuspendedUserId: userId\n      }, null, null, true);\n    } catch (error) {\n      console.error('Unsuspend user error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Force unlock user account\n   */\n  async unlockUser(userId: UUID, adminId: UUID): Promise<void> {\n    try {\n      await db.query(`\n        UPDATE users \n        SET locked_until = NULL, failed_login_attempts = 0, updated_at = NOW()\n        WHERE id = $1\n      `, [userId]);\n\n      // Log unlock\n      await this.auditService.logAuthEvent(adminId, 'user_unlocked', {\n        unlockedUserId: userId\n      }, null, null, true);\n    } catch (error) {\n      console.error('Unlock user error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Force password reset for user\n   */\n  async forcePasswordReset(userId: UUID, adminId: UUID): Promise<void> {\n    try {\n      await db.query(`\n        UPDATE users \n        SET must_change_password = true, updated_at = NOW()\n        WHERE id = $1\n      `, [userId]);\n\n      // Invalidate all user sessions\n      await db.query(`\n        UPDATE user_sessions \n        SET is_active = false \n        WHERE user_id = $1\n      `, [userId]);\n\n      // Log forced password reset\n      await this.auditService.logAuthEvent(adminId, 'password_reset_forced', {\n        targetUserId: userId\n      }, null, null, true);\n    } catch (error) {\n      console.error('Force password reset error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Get user activity summary\n   */\n  async getUserActivity(userId: UUID, days: number = 30): Promise<any> {\n    try {\n      const result = await db.query(`\n        SELECT \n          event_type,\n          COUNT(*) as count,\n          MAX(created_at) as last_occurrence\n        FROM auth_audit_log \n        WHERE user_id = $1 \n          AND created_at > NOW() - INTERVAL '${days} days'\n        GROUP BY event_type\n        ORDER BY count DESC\n      `, [userId]);\n\n      return result.rows;\n    } catch (error) {\n      console.error('Get user activity error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Get security alerts\n   */\n  async getSecurityAlerts(limit: number = 50): Promise<any[]> {\n    try {\n      const result = await db.query(`\n        SELECT \n          aal.*,\n          u.email,\n          u.full_name\n        FROM auth_audit_log aal\n        LEFT JOIN users u ON aal.user_id = u.id\n        WHERE aal.success = false \n          OR aal.event_type IN ('user_suspended', 'user_locked', 'multiple_failed_logins')\n        ORDER BY aal.created_at DESC\n        LIMIT $1\n      `, [limit]);\n\n      return result.rows.map(row => ({\n        id: row.id,\n        userId: row.user_id,\n        userEmail: row.email,\n        userFullName: row.full_name,\n        eventType: row.event_type,\n        eventData: row.event_data,\n        ipAddress: row.ip_address,\n        userAgent: row.user_agent,\n        success: row.success,\n        errorMessage: row.error_message,\n        createdAt: row.created_at\n      }));\n    } catch (error) {\n      console.error('Get security alerts error:', error);\n      throw error;\n    }\n  }\n\n  /**\n   * Bulk user operations\n   */\n  async bulkUpdateUsers(userIds: UUID[], operation: 'activate' | 'deactivate' | 'suspend' | 'unlock', adminId: UUID): Promise<{ success: UUID[]; failed: UUID[] }> {\n    const success: UUID[] = [];\n    const failed: UUID[] = [];\n\n    for (const userId of userIds) {\n      try {\n        switch (operation) {\n          case 'activate':\n            await db.query('UPDATE users SET status = \\'active\\' WHERE id = $1', [userId]);\n            break;\n          case 'deactivate':\n            await db.query('UPDATE users SET status = \\'inactive\\' WHERE id = $1', [userId]);\n            break;\n          case 'suspend':\n            await this.suspendUser(userId, adminId);\n            break;\n          case 'unlock':\n            await this.unlockUser(userId, adminId);\n            break;\n        }\n        success.push(userId);\n      } catch (error) {\n        console.error(`Bulk operation ${operation} failed for user ${userId}:`, error);\n        failed.push(userId);\n      }\n    }\n\n    // Log bulk operation\n    await this.auditService.logAuthEvent(adminId, 'bulk_user_operation', {\n      operation,\n      totalUsers: userIds.length,\n      successCount: success.length,\n      failedCount: failed.length\n    }, null, null, true);\n\n    return { success, failed };\n  }\n}"