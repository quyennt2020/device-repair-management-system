import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';
import { AuditService } from './audit.service';

export interface CreateRoleRequest {
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
}

export interface UpdateRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: string[];
}

export interface AssignRoleRequest {
  userId: UUID;
  roleId: UUID;
  assignedBy: UUID;
  expiresAt?: Date;
}

export class RoleService {
  private auditService: AuditService;

  constructor() {
    this.auditService = new AuditService();
  }

  async getAllRoles(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          r.id,
          r.name,
          r.display_name,
          r.description,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        GROUP BY r.id
        ORDER BY r.name
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        isSystemRole: row.is_system_role,
        permissions: row.permissions,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Get all roles error:', error);
      throw error;
    }
  }

  async getRoleById(roleId: UUID): Promise<any> {
    try {
      const result = await db.query(`
        SELECT 
          r.id,
          r.name,
          r.display_name,
          r.description,
          r.is_system_role,
          r.created_at,
          r.updated_at,
          COALESCE(array_agg(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE r.id = $1
        GROUP BY r.id
      `, [roleId]);

      const role = result.rows[0];
      if (!role) {
        throw new Error('Role not found');
      }

      return {
        id: role.id,
        name: role.name,
        displayName: role.display_name,
        description: role.description,
        isSystemRole: role.is_system_role,
        permissions: role.permissions,
        createdAt: role.created_at,
        updatedAt: role.updated_at
      };
    } catch (error) {
      console.error('Get role by ID error:', error);
      throw error;
    }
  }

  async createRole(request: CreateRoleRequest): Promise<any> {
    try {
      // Check if role name already exists
      const existingRole = await this.findRoleByName(request.name);
      if (existingRole) {
        throw new Error('Role with this name already exists');
      }

      // Create role
      const roleResult = await db.query(`
        INSERT INTO roles (name, display_name, description)
        VALUES ($1, $2, $3)
        RETURNING id, name, display_name, description, created_at
      `, [request.name, request.displayName, request.description]);

      const role = roleResult.rows[0];

      // Assign permissions if provided
      if (request.permissions && request.permissions.length > 0) {
        await this.assignPermissionsToRole(role.id, request.permissions);
      }

      // Log role creation
      await this.auditService.logAuthEvent(null, 'role_created', {
        roleId: role.id,
        roleName: role.name
      }, null, null, true);

      return {
        id: role.id,
        name: role.name,
        displayName: role.display_name,
        description: role.description,
        permissions: request.permissions || [],
        createdAt: role.created_at
      };
    } catch (error) {
      console.error('Create role error:', error);
      throw error;
    }
  }

  async updateRole(roleId: UUID, request: UpdateRoleRequest): Promise<any> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (request.displayName !== undefined) {
        updates.push(`display_name = $${paramCount++}`);
        values.push(request.displayName);
      }

      if (request.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(request.description);
      }

      if (updates.length === 0 && !request.permissions) {
        throw new Error('No fields to update');
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(roleId);

        await db.query(`
          UPDATE roles 
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
        `, values);
      }

      // Update permissions if provided
      if (request.permissions) {
        await this.updateRolePermissions(roleId, request.permissions);
      }

      // Get updated role
      const updatedRole = await this.getRoleById(roleId);

      // Log role update
      await this.auditService.logAuthEvent(null, 'role_updated', {
        roleId,
        updatedFields: Object.keys(request)
      }, null, null, true);

      return updatedRole;
    } catch (error) {
      console.error('Update role error:', error);
      throw error;
    }
  }

  async deleteRole(roleId: UUID): Promise<void> {
    try {
      // Check if role is system role
      const role = await this.getRoleById(roleId);
      if (role.isSystemRole) {
        throw new Error('Cannot delete system role');
      }

      // Check if role is assigned to any users
      const userCount = await db.query(`
        SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1
      `, [roleId]);

      if (parseInt(userCount.rows[0].count) > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      // Delete role (cascade will handle permissions)
      await db.query('DELETE FROM roles WHERE id = $1', [roleId]);

      // Log role deletion
      await this.auditService.logAuthEvent(null, 'role_deleted', {
        roleId,
        roleName: role.name
      }, null, null, true);
    } catch (error) {
      console.error('Delete role error:', error);
      throw error;
    }
  }

  async assignRoleToUser(request: AssignRoleRequest): Promise<void> {
    try {
      // Check if assignment already exists
      const existingAssignment = await db.query(`
        SELECT id FROM user_roles 
        WHERE user_id = $1 AND role_id = $2
      `, [request.userId, request.roleId]);

      if (existingAssignment.rows.length > 0) {
        throw new Error('Role already assigned to user');
      }

      // Create assignment
      await db.query(`
        INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [request.userId, request.roleId, request.assignedBy, request.expiresAt]);

      // Log role assignment
      await this.auditService.logAuthEvent(request.assignedBy, 'role_assigned', {
        userId: request.userId,
        roleId: request.roleId,
        expiresAt: request.expiresAt
      }, null, null, true);
    } catch (error) {
      console.error('Assign role error:', error);
      throw error;
    }
  }

  async revokeRoleFromUser(userId: UUID, roleId: UUID): Promise<void> {
    try {
      const result = await db.query(`
        DELETE FROM user_roles 
        WHERE user_id = $1 AND role_id = $2
      `, [userId, roleId]);

      if (result.rowCount === 0) {
        throw new Error('Role assignment not found');
      }

      // Log role revocation
      await this.auditService.logAuthEvent(null, 'role_revoked', {
        userId,
        roleId
      }, null, null, true);
    } catch (error) {
      console.error('Revoke role error:', error);
      throw error;
    }
  }

  async getUserRoles(userId: UUID): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          r.id,
          r.name,
          r.display_name,
          ur.assigned_at,
          ur.expires_at,
          u_assigned.full_name as assigned_by_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        LEFT JOIN users u_assigned ON ur.assigned_by = u_assigned.id
        WHERE ur.user_id = $1
        ORDER BY ur.assigned_at DESC
      `, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        assignedAt: row.assigned_at,
        expiresAt: row.expires_at,
        assignedByName: row.assigned_by_name
      }));
    } catch (error) {
      console.error('Get user roles error:', error);
      throw error;
    }
  }

  async getAllPermissions(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          id,
          name,
          display_name,
          description,
          resource,
          action,
          is_system_permission
        FROM permissions
        ORDER BY resource, action
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        description: row.description,
        resource: row.resource,
        action: row.action,
        isSystemPermission: row.is_system_permission
      }));
    } catch (error) {
      console.error('Get all permissions error:', error);
      throw error;
    }
  }

  private async findRoleByName(name: string): Promise<any> {
    const result = await db.query('SELECT * FROM roles WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  private async assignPermissionsToRole(roleId: UUID, permissionNames: string[]): Promise<void> {
    for (const permissionName of permissionNames) {
      // Find permission by name
      const permissionResult = await db.query(`
        SELECT id FROM permissions WHERE name = $1
      `, [permissionName]);

      if (permissionResult.rows.length > 0) {
        const permissionId = permissionResult.rows[0].id;
        
        // Assign permission to role
        await db.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `, [roleId, permissionId]);
      }
    }
  }

  private async updateRolePermissions(roleId: UUID, permissionNames: string[]): Promise<void> {
    // Remove all existing permissions
    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    
    // Add new permissions
    if (permissionNames.length > 0) {
      await this.assignPermissionsToRole(roleId, permissionNames);
    }
  }
}