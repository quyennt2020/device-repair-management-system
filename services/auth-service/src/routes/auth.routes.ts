import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  validateLogin,
  validateRegister,
  validateChangePassword,
  validateResetPassword,
  validateRequestPasswordReset,
  validateRefreshToken,
  handleValidationErrors
} from '../middleware/validation.middleware';
import { config } from '../config';

const router = Router();
const authService = new AuthService();
const userService = new UserService();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: config.rateLimit.loginWindowMs,
  max: config.rateLimit.maxLoginAttempts,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Login
router.post('/login', 
  authLimiter,
  validateLogin,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await authService.login(
        { email, password },
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Register
router.post('/register',
  authLimiter,
  validateRegister,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password, fullName, phone } = req.body;
      
      const result = await userService.createUser({
        email,
        password,
        fullName,
        phone
      });

      res.status(201).json({
        success: true,
        data: result,
        message: 'User registered successfully. Please check your email for verification.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
router.post('/refresh',
  validateRefreshToken,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      
      const result = await authService.refreshToken({ refreshToken });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
router.post('/logout',
  authenticateToken,
  async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        await authService.logout(token);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.post('/change-password',
  authenticateToken,
  validateChangePassword,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      await authService.changePassword(userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Request password reset
router.post('/request-password-reset',
  authLimiter,
  validateRequestPasswordReset,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      
      await authService.requestPasswordReset(email);

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reset password
router.post('/reset-password',
  authLimiter,
  validateResetPassword,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      
      await authService.resetPassword(token, newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Verify email
router.post('/verify-email',
  async (req, res, next) => {
    try {
      const { token } = req.body;
      
      await userService.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user profile
router.get('/me',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const user = await userService.getUserById(userId);

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
);

// Validate token (for other services)
router.post('/validate',
  async (req, res, next) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Token is required'
          }
        });
      }

      const user = await authService.validateToken(token);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token'
          }
        });
      }

      res.json({
        success: true,
        data: { user, valid: true }
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as authRoutes };