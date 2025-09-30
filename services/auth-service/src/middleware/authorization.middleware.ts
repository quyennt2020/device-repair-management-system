import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '@drms/shared-types';

// Extend Express Request to include user and context
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      context?: {
        customerId?: string;
        technicianId?: string;
        caseId?: string;
        organizationId?: string;
      };
    }
  }
}

export interface AuthorizationOptions {
  permissions?: string | string[];
  roles?: string | string[];
  requireAll?: boolean; // If true, user must have ALL permissions/roles, not just one
  contextCheck?: (req: Request, user: AuthenticatedUser) => Promise<boolean> | boolean;
  allowSelf?: boolean; // Allow access to own resources
  selfIdParam?: string; // Parameter name for self ID check (default: 'userId')
}

/**
 * Main authorization middleware factory
 */
export const authorize = (options: AuthorizationOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const user = req.user;
      const {
        permissions = [],
        roles = [],
        requireAll = false,
        contextCheck,
        allowSelf = false,
        selfIdParam = 'userId'
      } = options;

      // Check if user has required roles
      if (roles.length > 0) {
        const requiredRoles = Array.isArray(roles) ? roles : [roles];
        const userRoles = user.roles || [];
        
        const hasRole = requireAll 
          ? requiredRoles.every(role => userRoles.includes(role))
          : requiredRoles.some(role => userRoles.includes(role));
        
        if (!hasRole) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_ROLE',
              message: 'Insufficient role permissions',
              details: {
                required: requiredRoles,
                current: userRoles,
                requireAll
              }
            }
          });
        }
      }

      // Check if user has required permissions
      if (permissions.length > 0) {
        const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
        const userPermissions = user.permissions || [];
        
        const hasPermission = requireAll
          ? requiredPermissions.every(permission => userPermissions.includes(permission))
          : requiredPermissions.some(permission => userPermissions.includes(permission));
        
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'Insufficient permissions',
              details: {
                required: requiredPermissions,
                current: userPermissions,
                requireAll
              }
            }
          });
        }
      }

      // Check self-access (user accessing their own resources)
      if (allowSelf) {
        const resourceUserId = req.params[selfIdParam] || req.body[selfIdParam];
        if (resourceUserId && resourceUserId === user.id) {
          return next(); // Allow self-access
        }
      }

      // Custom context check
      if (contextCheck) {
        const hasContextAccess = await contextCheck(req, user);
        if (!hasContextAccess) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'CONTEXT_ACCESS_DENIED',
              message: 'Access denied for this context'
            }
          });
        }
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Authorization check failed'
        }
      });
    }
  };
};
/**
 *
 Context-aware authorization helpers
 */
export class AuthorizationContext {
  /**
   * Check if user can access customer resources
   */
  static async canAccessCustomer(req: Request, user: AuthenticatedUser): Promise<boolean> {
    const customerId = req.params.customerId || req.body.customerId || req.query.customerId;
    
    // Admin and managers can access all customers
    if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
      return true;
    }
    
    // Customer service can access all customers
    if (user.roles?.includes('customer_service')) {
      return true;
    }
    
    // Customers can only access their own data
    if (user.roles?.includes('customer') && user.customerId === customerId) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if user can access technician resources
   */
  static async canAccessTechnician(req: Request, user: AuthenticatedUser): Promise<boolean> {
    const technicianId = req.params.technicianId || req.body.technicianId || req.query.technicianId;
    
    // Admin and managers can access all technicians
    if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
      return true;
    }
    
    // Technicians can access their own data
    if (user.roles?.includes('technician') && user.technicianId === technicianId) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if user can access case resources
   */
  static async canAccessCase(req: Request, user: AuthenticatedUser): Promise<boolean> {
    const caseId = req.params.caseId || req.body.caseId || req.query.caseId;
    
    if (!caseId) return true; // No specific case to check
    
    // Admin and managers can access all cases
    if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
      return true;
    }
    
    // Customer service can access all cases
    if (user.roles?.includes('customer_service')) {
      return true;
    }
    
    // For customers and technicians, we need to check case ownership
    // This would require a database query to check case assignment
    // For now, we'll implement a basic check
    
    return true; // TODO: Implement actual case ownership check
  }

  /**
   * Check if user can access inventory resources
   */
  static async canAccessInventory(req: Request, user: AuthenticatedUser): Promise<boolean> {
    // Admin, managers, and technicians can access inventory
    if (user.roles?.some(role => ['admin', 'manager', 'technician'].includes(role))) {
      return true;
    }
    
    // Customer service can view inventory for quotations
    if (user.roles?.includes('customer_service')) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if user can access document resources
   */
  static async canAccessDocument(req: Request, user: AuthenticatedUser): Promise<boolean> {
    const documentId = req.params.documentId || req.body.documentId || req.query.documentId;
    
    // Admin and managers can access all documents
    if (user.roles?.some(role => ['admin', 'manager'].includes(role))) {
      return true;
    }
    
    // For other roles, document access depends on the associated case/customer
    // This would require checking document ownership through case relationships
    
    return true; // TODO: Implement actual document ownership check
  }
}

/**
 * Pre-built authorization middleware for common scenarios
 */
export const requireAdmin = authorize({
  roles: ['admin']
});

export const requireManager = authorize({
  roles: ['admin', 'manager']
});

export const requireTechnician = authorize({
  roles: ['admin', 'manager', 'technician']
});

export const requireCustomerService = authorize({
  roles: ['admin', 'manager', 'customer_service']
});

export const requireStaff = authorize({
  roles: ['admin', 'manager', 'technician', 'customer_service']
});

/**
 * Resource-specific authorization middleware
 */
export const authorizeCustomerAccess = authorize({
  contextCheck: AuthorizationContext.canAccessCustomer
});

export const authorizeTechnicianAccess = authorize({
  contextCheck: AuthorizationContext.canAccessTechnician
});

export const authorizeCaseAccess = authorize({
  contextCheck: AuthorizationContext.canAccessCase
});

export const authorizeInventoryAccess = authorize({
  contextCheck: AuthorizationContext.canAccessInventory
});

export const authorizeDocumentAccess = authorize({
  contextCheck: AuthorizationContext.canAccessDocument
});

/**
 * Permission-based authorization middleware
 */
export const requirePermissions = (permissions: string | string[], requireAll = false) => {
  return authorize({ permissions, requireAll });
};

export const requireRoles = (roles: string | string[], requireAll = false) => {
  return authorize({ roles, requireAll });
};

/**
 * Self-access authorization (users can access their own resources)
 */
export const allowSelfAccess = (idParam = 'userId') => {
  return authorize({ allowSelf: true, selfIdParam: idParam });
};

/**
 * Combined authorization for self-access or admin
 */
export const requireSelfOrAdmin = (idParam = 'userId') => {
  return authorize({
    roles: ['admin'],
    allowSelf: true,
    selfIdParam: idParam
  });
};

export const requireSelfOrManager = (idParam = 'userId') => {
  return authorize({
    roles: ['admin', 'manager'],
    allowSelf: true,
    selfIdParam: idParam
  });
};