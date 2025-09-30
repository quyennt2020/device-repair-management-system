import { db } from '@drms/shared-database';
import { User, Role, Permission, CreateUserRequest, UpdateUserRequest, UserSearchCriteria } from '@drms/shared-types';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    try {
      const result = await db.query(`
        SELECT u.*, 
               COALESCE(
                 json_agg(
                   DISTINCT jsonb_build_object(
                     'id', r.id,
                     'name', r.name,
                     'displayName', r.display_name,
                     'description', r.description
                   )
                 ) FILTER (WHERE r.id IS NOT NULL), 
                 '[]'
               ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToUser(row);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await db.query(`
        SELECT u.*, 
               COALESCE(
                 json_agg(
                   DISTINCT jsonb_build_object(
                     'id', r.id,
                     'name', r.name,
                     'displayName', r.display_name,
                     'description', r.description
                   )
                 ) FILTER (WHERE r.id IS NOT NULL), 
                 '[]'
               ) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.email = $1
        GROUP BY u.id
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return this.mapRowToUser(row);
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  async create(userData: CreateUserRequest): Promise<User> {
    try {
      const result = await db.query(`
        INSERT INTO users (email, password_hash, full_name, status, email_verified)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        userData.email.toLowerCase(),
        userData.password || '', // Will be set separately if provided
        userData.fullName,
        'active',
        false
      ]);

      const user = this.mapRowToUser(result.rows[0]);

      // Assign roles if provided
      if (userData.roles && userData.roles.length > 0) {
        await this.assignRoles(user.id, userData.roles);
      }

      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async update(id: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (userData.fullName !== undefined) {
        updateFields.push(`full_name = $${paramIndex++}`);
        values.push(userData.fullName);
      }

      if (userData.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(userData.status);
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Update roles if provided
      if (userData.roles !== undefined) {
        await this.updateUserRoles(id, userData.roles);
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    try {
      const result = await db.query(`
        SELECT r.*
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        isSystemRole: row.is_system_role,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        permissions: [] // Will be loaded separately if needed
      }));
    } catch (error) {
      console.error('Error getting user roles:', error);
      throw error;
    }
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const result = await db.query(`
        SELECT DISTINCT p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1 
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        resource: row.resource,
        action: row.action,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by
      }));
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }

  async incrementFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1,
            updated_at = NOW()
        WHERE id = $1
      `, [userId]);
    } catch (error) {
      console.error('Error incrementing failed login attempts:', error);
      throw error;
    }
  }

  async resetFailedLoginAttempts(userId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE users 
        SET failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = $1
      `, [userId]);
    } catch (error) {
      console.error('Error resetting failed login attempts:', error);
      throw error;
    }
  }

  async lockUser(userId: string, lockUntil: Date): Promise<void> {
    try {
      await db.query(`
        UPDATE users 
        SET locked_until = $2,
            updated_at = NOW()
        WHERE id = $1
      `, [userId, lockUntil]);
    } catch (error) {
      console.error('Error locking user:', error);
      throw error;
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      await db.query(`
        UPDATE users 
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [userId]);
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  private async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    try {
      for (const roleId of roleIds) {
        await db.query(`
          INSERT INTO user_roles (user_id, role_id, assigned_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (user_id, role_id) DO NOTHING
        `, [userId, roleId]);
      }
    } catch (error) {
      console.error('Error assigning roles:', error);
      throw error;
    }
  }

  private async updateUserRoles(userId: string, roleIds: string[]): Promise<void> {
    try {
      // Remove existing roles
      await db.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      
      // Add new roles
      if (roleIds.length > 0) {
        await this.assignRoles(userId, roleIds);
      }
    } catch (error) {
      console.error('Error updating user roles:', error);
      throw error;
    }
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      status: row.status,
      emailVerified: row.email_verified,
      emailVerifiedAt: row.email_verified_at,
      lastLoginAt: row.last_login_at,
      failedLoginAttempts: row.failed_login_attempts,
      lockedUntil: row.locked_until,
      passwordChangedAt: row.password_changed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      roles: row.roles || [],
      permissions: [] // Will be loaded separately if needed
    };
  }
}