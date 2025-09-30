import { db } from '@drms/shared-database';
import { AuthenticatedUser, UUID } from '@drms/shared-types';

export interface AuthorizationPolicy {
  id: UUID;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyEvaluationContext {
  user: AuthenticatedUser;
  resource: string;
  action: string;
  resourceId?: string;
  metadata?: any;
}

export class AuthorizationService {
  /**
   * Check if user has permission to perform action on resource
   */
  async hasPermission(
    user: AuthenticatedUser,
    resource: string,
    action: string,
    resourceId?: string,
    context?: any
  ): Promise<boolean> {
    try {
      // Check direct permissions
      const permissionName = `${resource}.${action}`;
      if (user.permissions?.includes(permissionName)) {
        return true;
      }

      // Check role-based permissions
      if (user.roles) {
        for (const role of user.roles) {
          const hasRolePermission = await this.checkRolePermission(role, resource, action);
          if (hasRolePermission) {
            return true;
          }
        }
      }

      // Check context-specific permissions
      if (resourceId && context) {
        const hasContextPermission = await this.checkContextPermission(
          user,
          resource,
          action,
          resourceId,
          context
        );
        if (hasContextPermission) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check if role has permission for resource action
   */
  private async checkRolePermission(role: string, resource: string, action: string): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = $1 
          AND (p.name = $2 OR (p.resource = $3 AND p.action = $4))
      `, [role, `${resource}.${action}`, resource, action]);

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Role permission check error:', error);
      return false;
    }
  }

  /**
   * Check context-specific permissions (e.g., customer can only see their own cases)
   */
  private async checkContextPermission(
    user: AuthenticatedUser,
    resource: string,
    action: string,
    resourceId: string,
    context: any
  ): Promise<boolean> {
    try {
      switch (resource) {
        case 'cases':
          return await this.checkCaseAccess(user, action, resourceId);
        case 'customers':
          return await this.checkCustomerAccess(user, action, resourceId);
        case 'technicians':
          return await this.checkTechnicianAccess(user, action, resourceId);
        case 'documents':
          return await this.checkDocumentAccess(user, action, resourceId);
        default:
          return false;
      }
    } catch (error) {
      console.error('Context permission check error:', error);
      return false;
    }
  }

  /**
   * Check if user can access specific case
   */
  private async checkCaseAccess(user: AuthenticatedUser, action: string, caseId: string): Promise<boolean> {
    try {
      // Admin and managers can access all cases
      if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
        return true;
      }

      // Customer service can access all cases
      if (user.roles?.includes('customer_service')) {
        return true;
      }

      // Check if case belongs to user's customer
      if (user.customerId) {
        const result = await db.query(`
          SELECT COUNT(*) as count
          FROM repair_cases
          WHERE id = $1 AND customer_id = $2
        `, [caseId, user.customerId]);

        if (parseInt(result.rows[0].count) > 0) {
          return true;
        }
      }

      // Check if case is assigned to user as technician
      if (user.technicianId) {
        const result = await db.query(`
          SELECT COUNT(*) as count
          FROM repair_cases
          WHERE id = $1 AND assigned_technician_id = $2
        `, [caseId, user.technicianId]);

        if (parseInt(result.rows[0].count) > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Case access check error:', error);
      return false;
    }
  }

  /**
   * Check if user can access specific customer
   */
  private async checkCustomerAccess(user: AuthenticatedUser, action: string, customerId: string): Promise<boolean> {
    try {
      // Admin and managers can access all customers
      if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
        return true;
      }

      // Customer service can access all customers
      if (user.roles?.includes('customer_service')) {
        return true;
      }

      // Customers can only access their own data
      if (user.customerId === customerId) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Customer access check error:', error);
      return false;
    }
  }

  /**
   * Check if user can access specific technician
   */
  private async checkTechnicianAccess(user: AuthenticatedUser, action: string, technicianId: string): Promise<boolean> {
    try {
      // Admin and managers can access all technicians
      if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
        return true;
      }

      // Technicians can access their own data
      if (user.technicianId === technicianId) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Technician access check error:', error);
      return false;
    }
  }

  /**
   * Check if user can access specific document
   */
  private async checkDocumentAccess(user: AuthenticatedUser, action: string, documentId: string): Promise<boolean> {
    try {
      // Admin and managers can access all documents
      if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
        return true;
      }

      // Check document access through case ownership
      const result = await db.query(`
        SELECT rc.customer_id, rc.assigned_technician_id
        FROM documents d
        JOIN repair_cases rc ON d.case_id = rc.id
        WHERE d.id = $1
      `, [documentId]);

      if (result.rows.length === 0) {
        return false;
      }

      const document = result.rows[0];

      // Check if document belongs to user's customer
      if (user.customerId === document.customer_id) {
        return true;
      }

      // Check if document belongs to case assigned to user as technician
      if (user.technicianId === document.assigned_technician_id) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Document access check error:', error);
      return false;
    }
  }

  /**
   * Get user's effective permissions (including role-based permissions)
   */
  async getUserEffectivePermissions(userId: UUID): Promise<string[]> {
    try {
      const result = await db.query(`
        SELECT DISTINCT p.name
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        ORDER BY p.name
      `, [userId]);

      return result.rows.map(row => row.name);
    } catch (error) {
      console.error('Get effective permissions error:', error);
      return [];
    }
  }

  /**
   * Check if user can perform bulk operations
   */
  async canPerformBulkOperation(
    user: AuthenticatedUser,
    resource: string,
    action: string,
    resourceIds: string[]
  ): Promise<{ allowed: string[]; denied: string[] }> {
    const allowed: string[] = [];
    const denied: string[] = [];

    for (const resourceId of resourceIds) {
      const hasPermission = await this.hasPermission(user, resource, action, resourceId);
      if (hasPermission) {
        allowed.push(resourceId);
      } else {
        denied.push(resourceId);
      }
    }

    return { allowed, denied };
  }

  /**
   * Log authorization events for audit purposes
   */
  async logAuthorizationEvent(
    userId: UUID,
    resource: string,
    action: string,
    resourceId: string | null,
    allowed: boolean,
    reason?: string
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO auth_audit_log (user_id, event_type, event_data, success, error_message)
        VALUES ($1, 'authorization_check', $2, $3, $4)
      `, [
        userId,
        JSON.stringify({
          resource,
          action,
          resourceId,
          timestamp: new Date().toISOString()
        }),
        allowed,
        reason
      ]);
    } catch (error) {
      console.error('Authorization event logging error:', error);
    }
  }
}