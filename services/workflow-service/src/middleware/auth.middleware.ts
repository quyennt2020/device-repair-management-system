import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '@drms/shared-types';
import { config } from '../config';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authenticate token by calling auth service
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required'
        }
      });
    }

    // Call auth service to validate token
    const response = await fetch(`${config.authServiceUrl}/api/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    const authResult = await response.json();
    
    if (!authResult.success || !authResult.data.valid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }

    req.user = authResult.data.user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Require specific permissions
 */
export const requirePermissions = (permissions: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    const userPermissions = req.user.permissions || [];
    
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: {
            required: requiredPermissions,
            current: userPermissions
          }
        }
      });
    }

    next();
  };
};

/**
 * Require specific roles
 */
export const requireRoles = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const userRoles = req.user.roles || [];
    
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient role permissions',
          details: {
            required: requiredRoles,
            current: userRoles
          }
        }
      });
    }

    next();
  };
};

/**
 * Pre-built authorization middleware for common scenarios
 */
export const requireAdmin = requireRoles(['admin']);

export const requireManager = requireRoles(['admin', 'manager']);

export const requireTechnician = requireRoles(['admin', 'manager', 'technician']);

export const requireStaff = requireRoles(['admin', 'manager', 'technician', 'customer_service']);