import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { createError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw createError('Authorization header is required', 401);
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>
    
    if (!token) {
      throw createError('Token is required', 401);
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    (req as AuthenticatedRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authenticatedReq = req as AuthenticatedRequest;
    
    if (!authenticatedReq.user) {
      return next(createError('Authentication required', 401));
    }

    if (!authenticatedReq.user.permissions.includes(permission)) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authenticatedReq = req as AuthenticatedRequest;
    
    if (!authenticatedReq.user) {
      return next(createError('Authentication required', 401));
    }

    if (authenticatedReq.user.role !== role) {
      return next(createError('Insufficient role', 403));
    }

    next();
  };
};