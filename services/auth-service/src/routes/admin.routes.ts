import { Router } from 'express';
import { AdminService } from '../services/admin.service';
import { authenticateToken, requireAdmin, requireManager } from '../middleware/auth.middleware';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { body, query, param } from 'express-validator';

const router = Router();
const adminService = new AdminService();

// All admin routes require authentication
router.use(authenticateToken);

// Get system statistics (admin dashboard)
router.get('/stats',
  requireAdmin,
  async (req, res, next) => {
    try {
      const stats = await adminService.getSystemStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get users with filtering and pagination
router.get('/users',
  requireManager,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['active', 'inactive', 'suspended']),
    query('role').optional().isString(),
    query('emailVerified').optional().isBoolean(),
    query('lastLoginBefore').optional().isISO8601(),
    query('lastLoginAfter').optional().isISO8601(),
    query('createdBefore').optional().isISO8601(),
    query('createdAfter').optional().isISO8601()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        search: req.query.search as string,
        status: req.query.status as 'active' | 'inactive' | 'suspended',
        role: req.query.role as string,
        emailVerified: req.query.emailVerified ? req.query.emailVerified === 'true' : undefined,
        lastLoginBefore: req.query.lastLoginBefore ? new Date(req.query.lastLoginBefore as string) : undefined,
        lastLoginAfter: req.query.lastLoginAfter ? new Date(req.query.lastLoginAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined
      };

      const result = await adminService.getUsers(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Suspend user
router.patch('/users/:userId/suspend',
  requireAdmin,
  [
    param('userId').isUUID(),
    body('reason').optional().isString().trim()
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.id;

      await adminService.suspendUser(userId, adminId, reason);

      res.json({
        success: true,
        message: 'User suspended successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Unsuspend user
router.patch('/users/:userId/unsuspend',
  requireAdmin,
  [param('userId').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!.id;

      await adminService.unsuspendUser(userId, adminId);

      res.json({
        success: true,
        message: 'User unsuspended successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Unlock user account
router.patch('/users/:userId/unlock',
  requireManager,
  [param('userId').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!.id;

      await adminService.unlockUser(userId, adminId);

      res.json({
        success: true,
        message: 'User unlocked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Force password reset
router.patch('/users/:userId/force-password-reset',
  requireManager,
  [param('userId').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const adminId = req.user!.id;

      await adminService.forcePasswordReset(userId, adminId);

      res.json({
        success: true,
        message: 'Password reset forced successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user activity
router.get('/users/:userId/activity',
  requireManager,
  [
    param('userId').isUUID(),
    query('days').optional().isInt({ min: 1, max: 365 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      const activity = await adminService.getUserActivity(userId, days);

      res.json({
        success: true,
        data: activity
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get security alerts
router.get('/security/alerts',
  requireAdmin,
  [query('limit').optional().isInt({ min: 1, max: 200 })],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const alerts = await adminService.getSecurityAlerts(limit);

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      next(error);
    }
  }
);

// Bulk user operations
router.patch('/users/bulk',
  requireAdmin,
  [
    body('userIds').isArray().custom((value) => {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error('userIds must be a non-empty array');
      }
      for (const id of value) {
        if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error('All userIds must be valid UUIDs');
        }
      }
      return true;
    }),
    body('operation').isIn(['activate', 'deactivate', 'suspend', 'unlock'])
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userIds, operation } = req.body;
      const adminId = req.user!.id;

      const result = await adminService.bulkUpdateUsers(userIds, operation, adminId);

      res.json({
        success: true,
        data: result,
        message: `Bulk ${operation} operation completed`
      });
    } catch (error) {
      next(error);
    }
  }
);

// Export user data (for compliance/backup)
router.get('/users/:userId/export',
  requireAdmin,
  [param('userId').isUUID()],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      // This would export all user data for compliance purposes
      // Implementation would depend on specific requirements
      
      res.json({
        success: true,
        message: 'User data export functionality not yet implemented'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete user (GDPR compliance)
router.delete('/users/:userId',
  requireAdmin,
  [
    param('userId').isUUID(),
    body('confirmation').equals('DELETE_USER_DATA'),
    body('reason').isString().isLength({ min: 10 })
  ],
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.id;

      // This would implement user data deletion for GDPR compliance
      // Implementation would need to handle cascading deletes carefully
      
      res.json({
        success: true,
        message: 'User deletion functionality not yet implemented'
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as adminRoutes };