import { Router } from 'express';
import { UserService } from '../services/user.service';
import { authenticateToken, requireRole, requireOwnershipOrRole } from '../middleware/auth.middleware';
import {
  validateUpdateProfile,
  handleValidationErrors
} from '../middleware/validation.middleware';

const router = Router();
const userService = new UserService();

// Get user profile
router.get('/profile',
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

// Update user profile
router.put('/profile',
  authenticateToken,
  validateUpdateProfile,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { fullName, phone, avatarUrl } = req.body;

      const updatedUser = await userService.updateUser(userId, {
        fullName,
        phone,
        avatarUrl
      });

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user sessions
router.get('/sessions',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const sessions = await userService.getUserSessions(userId);

      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      next(error);
    }
  }
);

// Revoke user session
router.delete('/sessions/:sessionId',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = req.params;

      await userService.revokeSession(userId, sessionId);

      res.json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Resend email verification
router.post('/resend-verification',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userEmail = req.user!.email;
      await userService.resendEmailVerification(userEmail);

      res.json({
        success: true,
        message: 'Verification email sent'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Admin routes - manage other users
router.get('/',
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, search, status, role } = req.query;
      
      // This would be implemented in UserService
      const users = await userService.getUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        status: status as string,
        role: role as string
      });

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get specific user (admin only)
router.get('/:userId',
  authenticateToken,
  requireOwnershipOrRole('userId', ['admin', 'manager']),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
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

// Deactivate user (admin only)
router.patch('/:userId/deactivate',
  authenticateToken,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      await userService.deactivateUser(userId);

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reactivate user (admin only)
router.patch('/:userId/reactivate',
  authenticateToken,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      await userService.reactivateUser(userId);

      res.json({
        success: true,
        message: 'User reactivated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as userRoutes };