import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '@drms/shared-types';

/**
 * Role-based rate limiting configuration
 */
const RATE_LIMITS = {
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // High limit for admins
    message: 'Too many requests from admin account'
  },
  manager: {
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Too many requests from manager account'
  },
  technician: {
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Too many requests from technician account'
  },
  customer_service: {
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Too many requests from customer service account'
  },
  customer: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from customer account'
  },
  viewer: {
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: 'Too many requests from viewer account'
  },
  anonymous: {
    windowMs: 15 * 60 * 1000,
    max: 20, // Very low limit for unauthenticated users
    message: 'Too many requests from this IP'
  }
};

/**
 * Get rate limit configuration based on user role
 */
function getRateLimitConfig(user?: AuthenticatedUser) {
  if (!user || !user.roles || user.roles.length === 0) {
    return RATE_LIMITS.anonymous;
  }

  // Use the highest privilege role for rate limiting
  const roleHierarchy = ['admin', 'manager', 'technician', 'customer_service', 'customer', 'viewer'];
  
  for (const role of roleHierarchy) {
    if (user.roles.includes(role)) {
      return RATE_LIMITS[role as keyof typeof RATE_LIMITS];
    }
  }

  return RATE_LIMITS.anonymous;
}

/**
 * Create role-based rate limiter
 */
export const createRoleBasedRateLimit = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // Default window
    max: (req: Request) => {
      const config = getRateLimitConfig(req.user);
      return config.max;
    },
    message: (req: Request) => {
      const config = getRateLimitConfig(req.user);
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message
        }
      };
    },
    keyGenerator: (req: Request) => {
      // Use user ID for authenticated users, IP for anonymous
      if (req.user) {
        return `user:${req.user.id}`;
      }
      return `ip:${req.ip}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const config = getRateLimitConfig(req.user);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: config.message,
          retryAfter: Math.ceil(config.windowMs / 1000)
        }
      });
    }
  });
};

/**
 * Strict rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Very strict limit for auth endpoints
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  keyGenerator: (req: Request) => {
    // Use IP + email for login attempts
    const email = req.body?.email;
    return email ? `auth:${req.ip}:${email}` : `auth:${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for password reset attempts
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again later'
    }
  },
  keyGenerator: (req: Request) => {
    const email = req.body?.email;
    return email ? `reset:${email}` : `reset:${req.ip}`;
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for registration attempts
 */
export const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registration attempts per hour per IP
  message: {
    success: false,
    error: {
      code: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts, please try again later'
    }
  },
  keyGenerator: (req: Request) => `register:${req.ip}`,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiting for API endpoints based on operation type
 */
export const createOperationRateLimit = (operation: 'read' | 'write' | 'delete') => {
  const limits = {
    read: { windowMs: 15 * 60 * 1000, max: 1000 },
    write: { windowMs: 15 * 60 * 1000, max: 100 },
    delete: { windowMs: 15 * 60 * 1000, max: 20 }
  };

  const config = limits[operation];

  return rateLimit({
    windowMs: config.windowMs,
    max: (req: Request) => {
      const userConfig = getRateLimitConfig(req.user);
      // Scale the operation limit based on user role
      const scaleFactor = userConfig.max / RATE_LIMITS.anonymous.max;
      return Math.ceil(config.max * scaleFactor);
    },
    message: {
      success: false,
      error: {
        code: 'OPERATION_RATE_LIMIT_EXCEEDED',
        message: `Too many ${operation} operations, please try again later`
      }
    },
    keyGenerator: (req: Request) => {
      if (req.user) {
        return `${operation}:user:${req.user.id}`;
      }
      return `${operation}:ip:${req.ip}`;
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};