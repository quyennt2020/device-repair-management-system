import { Router } from 'express';
import { RoleService } from '../services/role.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import {
  validateCreateRole,
  validateAssignRole,
  handleValidationErrors
} from '../middleware/validation.middleware';

const router = Router();
const roleService = new RoleService();

// Get all roles
router.get('/',
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res, next) => {
    try {
      const roles = await roleService.getAllRoles();

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get role by ID
router.get('/:roleId',
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res, next) => {
    try {
      const { roleId } = req.params;
      const role = await roleService.getRoleById(roleId);

      res.json({
        success: true,
        data: role
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create new role (admin only)
router.post('/',
  authenticateToken,
  requireRole(['admin']),
  validateCreateRole,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { name, displayName, description, permissions } = req.body;
      
      const role = await roleService.createRole({
        name,
        displayName,
        description,
        permissions
      });

      res.status(201).json({
        success: true,
        data: role,
        message: 'Role created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update role (admin only)
router.put('/:roleId',
  authenticateToken,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const { roleId } = req.params;
      const { displayName, description, permissions } = req.body;
      
      const role = await roleService.updateRole(roleId, {
        displayName,
        description,
        permissions
      });

      res.json({
        success: true,
        data: role,
        message: 'Role updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete role (admin only)
router.delete('/:roleId',
  authenticateToken,
  requireRole(['admin']),
  async (req, res, next) => {
    try {
      const { roleId } = req.params;
      await roleService.deleteRole(roleId);

      res.json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Assign role to user
router.post('/assign',
  authenticateToken,
  requireRole(['admin', 'manager']),
  validateAssignRole,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { userId, roleId, expiresAt } = req.body;
      const assignedBy = req.user!.id;
      
      await roleService.assignRoleToUser({
        userId,
        roleId,
        assignedBy,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      });

      res.json({
        success: true,
        message: 'Role assigned successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove role from user
router.post('/revoke',
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res, next) => {
    try {
      const { userId, roleId } = req.body;
      
      await roleService.revokeRoleFromUser(userId, roleId);

      res.json({
        success: true,
        message: 'Role revoked successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user roles
router.get('/user/:userId',
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const roles = await roleService.getUserRoles(userId);

      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all permissions
router.get('/permissions/all',
  authenticateToken,
  requireRole(['admin', 'manager']),
  async (req, res, next) => {
    try {
      const permissions = await roleService.getAllPermissions();

      res.json({
        success: true,
        data: permissions
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as roleRoutes };