import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import { config } from '../config';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

export const validateLogin: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

export const validateRegister: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: config.password.minLength })
    .withMessage(`Password must be at least ${config.password.minLength} characters long`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('fullName')
    .isLength({ min: 2, max: 255 })
    .trim()
    .withMessage('Full name must be between 2 and 255 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required')
];

export const validateChangePassword: ValidationChain[] = [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: config.password.minLength })
    .withMessage(`New password must be at least ${config.password.minLength} characters long`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('New password must contain uppercase, lowercase, number and special character')
];

export const validateResetPassword: ValidationChain[] = [
  body('token')
    .isLength({ min: 1 })
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: config.password.minLength })
    .withMessage(`Password must be at least ${config.password.minLength} characters long`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain uppercase, lowercase, number and special character')
];

export const validateRequestPasswordReset: ValidationChain[] = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
];

export const validateRefreshToken: ValidationChain[] = [
  body('refreshToken')
    .isLength({ min: 1 })
    .withMessage('Refresh token is required')
];

export const validateUpdateProfile: ValidationChain[] = [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 255 })
    .trim()
    .withMessage('Full name must be between 2 and 255 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Valid avatar URL is required')
];

export const validateCreateRole: ValidationChain[] = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-z_]+$/)
    .withMessage('Role name must be lowercase with underscores only'),
  body('displayName')
    .isLength({ min: 2, max: 255 })
    .trim()
    .withMessage('Display name must be between 2 and 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .trim()
    .withMessage('Description must be less than 1000 characters'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
];

export const validateAssignRole: ValidationChain[] = [
  body('userId')
    .isUUID()
    .withMessage('Valid user ID is required'),
  body('roleId')
    .isUUID()
    .withMessage('Valid role ID is required'),
  body('expiresAt')
    .optional()
    .isISO8601()
    .withMessage('Valid expiration date is required')
];