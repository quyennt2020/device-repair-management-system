import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../services/auth.service';
import { AuthorizationService } from '../services/authorization.service';
import { JWTPayload, AuthorizationContext, PermissionCheck } from '@drms/shared-types';

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      authContext?: AuthorizationContext;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthenticationService;
  private authzService: AuthorizationService;

  constructor() {
    this.authService = new AuthenticationService();
    this.authzService = new AuthorizationService();
  }

  // Middleware to verify JWT token
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Authorization token is required'
          }
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      try {
        const payload = await this.authService.verifyToken(token);
        
        // Add user info to request
        req.user = payload;
        req.authContext = {
          userId: payload.sub,
          roles: payload.roles,
          permissions: payload.permissions,
          customerId: payload.customerId,
          technicianId: payload.technicianId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        };

        next();
      } catch (error: any) {
        let errorCode = 'TOKEN_INVALID';
        let message = 'Invalid token';

        if (error.code === 'TOKEN_EXPIRED') {
          errorCode = 'TOKEN_EXPIRED';
          message = 'Token has expired';
        } else if (error.code === 'SESSION_EXPIRED') {
          errorCode = 'SESSION_EXPIRED';
          message = 'Session has expired';
        }

        res.status(401).json({
          success: false,
          error: {
            code: errorCode,
            message
          }
        });
      }
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authentication failed'
        }
      });
    }
  };

  // Middleware to check specific permission
  requirePermission = (resource: string, action: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.authContext) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required'
            }
          });
          return;
        }

        const permissionCheck: PermissionCheck = {
          resource,
          action,
          resourceId: req.params.id,
          context: {
            method: req.method,
            path: req.path,
            body: req.body,
            query: req.query
          }
        };

        const result = await this.authzService.checkPermission(req.authContext, permissionCheck);

        if (!result.allowed) {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: result.reason || 'Insufficient permissions',
              details: {
                requiredPermissions: result.requiredPermissions,
                missingPermissions: result.missingPermissions
              }
            }
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Authorization middleware error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Authorization check failed'
          }
        });
      }
    };
  };

  // Middleware to check role
  requireRole = (roleName: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.authContext) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required'
            }
          });
          return;
        }

        const hasRole = this.authzService.hasRole(req.authContext, roleName);

        if (!hasRole) {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_ROLE',
              message: `Role '${roleName}' is required`,
              details: {
                requiredRole: roleName,
                userRoles: req.authContext.roles
              }
            }
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Role check middleware error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Role check failed'
          }
        });
      }
    };
  };

  // Middleware to check multiple permissions (OR logic)
  requireAnyPermission = (permissions: Array<{ resource: string; action: string }>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.authContext) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required'
            }
          });
          return;
        }

        const permissionChecks: PermissionCheck[] = permissions.map(p => ({
          resource: p.resource,
          action: p.action,
          resourceId: req.params.id
        }));

        const results = await this.authzService.checkPermissions(req.authContext, permissionChecks);
        const hasAnyPermission = results.some(result => result.allowed);

        if (!hasAnyPermission) {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'At least one of the required permissions is needed',
              details: {
                requiredPermissions: permissions.map(p => `${p.resource}:${p.action}`),
                userPermissions: req.authContext.permissions
              }
            }
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Multiple permissions check middleware error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Permission check failed'
          }
        });
      }
    };
  };

  // Optional authentication - doesn't fail if no token
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          const payload = await this.authService.verifyToken(token);
          req.user = payload;
          req.authContext = {
            userId: payload.sub,
            roles: payload.roles,
            permissions: payload.permissions,
            customerId: payload.customerId,
            technicianId: payload.technicianId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          };
        } catch (error) {
          // Ignore token errors for optional auth
          console.warn('Optional auth token verification failed:', error);
        }
      }

      next();
    } catch (error) {
      console.error('Optional auth middleware error:', error);
      next(); // Continue even if optional auth fails
    }
  };

  // Middleware to ensure user can only access their own resources
  requireOwnership = (userIdField: string = 'userId') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.authContext) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication is required'
            }
          });
          return;
        }

        const resourceUserId = req.params[userIdField] || req.body[userIdField] || req.query[userIdField];
        
        // Admin users can access any resource
        if (req.authContext.roles.includes('admin')) {
          next();
          return;
        }

        // Check if user is accessing their own resource
        if (resourceUserId !== req.authContext.userId) {
          res.status(403).json({
            success: false,
            error: {
              code: 'ACCESS_DENIED',
              message: 'You can only access your own resources'
            }
          });
          return;
        }

        next();
      } catch (error) {
        console.error('Ownership check middleware error:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Ownership check failed'
          }
        });
      }
    };
  };

  private mapRowToSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      refreshToken: row.refresh_token,
      accessTokenJti: row.access_token_jti,
      deviceInfo: typeof row.device_info === 'string' ? JSON.parse(row.device_info) : row.device_info,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }
}