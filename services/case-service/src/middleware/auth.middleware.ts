import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7);
    
    try {
      // In a real implementation, we would verify with the auth service
      // For now, we'll decode the JWT directly
      const decoded = jwt.decode(token) as any;
      
      if (!decoded || !decoded.sub || !decoded.email || !decoded.role) {
        res.status(401).json({ error: 'Invalid token format' });
        return;
      }

      // Verify token with auth service
      const response = await fetch(`${config.authServiceUrl}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        }
      });

      if (!response.ok) {
        res.status(401).json({ error: 'Token verification failed' });
        return;
      }

      const userData = await response.json();
      
      req.user = {
        id: userData.user.id,
        email: userData.user.email,
        role: userData.user.role,
        permissions: userData.user.permissions || []
      };

      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
};