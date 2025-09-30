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

export const validateWorkflowDefinition: ValidationChain[] = [
  body('name')
    .isString()
    .isLength({ min: 1, max: config.validation.maxNameLength })
    .trim()
    .withMessage(`Name is required and must be between 1 and ${config.validation.maxNameLength} characters`),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: config.validation.maxDescriptionLength })
    .trim()
    .withMessage(`Description must be less than ${config.validation.maxDescriptionLength} characters`),
  
  body('deviceTypes')
    .isArray({ min: 1 })
    .withMessage('At least one device type must be specified')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error('Device types must be an array of strings');
      }
      return true;
    }),
  
  body('serviceTypes')
    .isArray({ min: 1 })
    .withMessage('At least one service type must be specified')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error('Service types must be an array of strings');
      }
      return true;
    }),
  
  body('customerTiers')
    .isArray({ min: 1 })
    .withMessage('At least one customer tier must be specified')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error('Customer tiers must be an array of strings');
      }
      return true;
    }),
  
  body('steps')
    .isArray({ min: 1 })
    .withMessage('At least one step must be defined')
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('Steps must be an array');
      }
      
      if (value.length > config.workflow.maxStepsPerWorkflow) {
        throw new Error(`Cannot have more than ${config.workflow.maxStepsPerWorkflow} steps`);
      }
      
      // Validate each step
      const stepNames = new Set();
      for (let i = 0; i < value.length; i++) {
        const step = value[i];
        
        // Check required fields
        if (!step.name || typeof step.name !== 'string') {
          throw new Error(`Step ${i + 1}: name is required and must be a string`);
        }
        
        // Check for duplicate names
        if (stepNames.has(step.name)) {
          throw new Error(`Duplicate step name: ${step.name}`);
        }
        stepNames.add(step.name);
        
        // Check step type
        const validTypes = ['manual', 'automatic', 'decision', 'parallel', 'wait'];
        if (!step.type || !validTypes.includes(step.type)) {
          throw new Error(`Step ${i + 1}: type must be one of: ${validTypes.join(', ')}`);
        }
        
        // Check position
        if (!step.position || typeof step.position.x !== 'number' || typeof step.position.y !== 'number') {
          throw new Error(`Step ${i + 1}: position must have numeric x and y coordinates`);
        }
        
        // Check config
        if (!step.config || typeof step.config !== 'object') {
          throw new Error(`Step ${i + 1}: config is required and must be an object`);
        }
        
        // Check transitions
        if (!step.transitions || !Array.isArray(step.transitions)) {
          throw new Error(`Step ${i + 1}: transitions must be an array`);
        }
        
        // Validate transitions
        for (let j = 0; j < step.transitions.length; j++) {
          const transition = step.transitions[j];
          
          if (!transition.name || typeof transition.name !== 'string') {
            throw new Error(`Step ${i + 1}, Transition ${j + 1}: name is required and must be a string`);
          }
          
          if (!transition.targetStepName || typeof transition.targetStepName !== 'string') {
            throw new Error(`Step ${i + 1}, Transition ${j + 1}: targetStepName is required and must be a string`);
          }
        }
      }
      
      // Validate that all transition targets exist
      const allStepNames = value.map((s: any) => s.name);
      for (const step of value) {
        for (const transition of step.transitions) {
          if (!allStepNames.includes(transition.targetStepName)) {
            throw new Error(`Step '${step.name}': target step '${transition.targetStepName}' does not exist`);
          }
        }
      }
      
      return true;
    }),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

export const validateWorkflowTemplate: ValidationChain[] = [
  body('name')
    .isString()
    .isLength({ min: 1, max: config.validation.maxNameLength })
    .trim()
    .withMessage(`Name is required and must be between 1 and ${config.validation.maxNameLength} characters`),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: config.validation.maxDescriptionLength })
    .trim()
    .withMessage(`Description must be less than ${config.validation.maxDescriptionLength} characters`),
  
  body('category')
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Category is required and must be between 1 and 100 characters'),
  
  body('deviceTypes')
    .isArray({ min: 1 })
    .withMessage('At least one device type must be specified')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error('Device types must be an array of strings');
      }
      return true;
    }),
  
  body('serviceTypes')
    .isArray({ min: 1 })
    .withMessage('At least one service type must be specified')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error('Service types must be an array of strings');
      }
      return true;
    }),
  
  body('customerTiers')
    .isArray({ min: 1 })
    .withMessage('At least one customer tier must be specified')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
        throw new Error('Customer tiers must be an array of strings');
      }
      return true;
    }),
  
  body('templateData')
    .isObject()
    .withMessage('Template data is required and must be an object')
    .custom((value) => {
      if (!value.steps || !Array.isArray(value.steps)) {
        throw new Error('Template data must include steps array');
      }
      
      if (value.steps.length === 0) {
        throw new Error('Template must have at least one step');
      }
      
      // Basic step validation
      for (const step of value.steps) {
        if (!step.name || !step.type) {
          throw new Error('Each step must have a name and type');
        }
      }
      
      return true;
    }),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

export const validateWorkflowStep: ValidationChain[] = [
  body('name')
    .isString()
    .isLength({ min: 1, max: 255 })
    .trim()
    .withMessage('Step name is required and must be between 1 and 255 characters'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .trim()
    .withMessage('Description must be less than 1000 characters'),
  
  body('type')
    .isIn(['manual', 'automatic', 'decision', 'parallel', 'wait'])
    .withMessage('Step type must be one of: manual, automatic, decision, parallel, wait'),
  
  body('position')
    .isObject()
    .withMessage('Position is required and must be an object')
    .custom((value) => {
      if (typeof value.x !== 'number' || typeof value.y !== 'number') {
        throw new Error('Position must have numeric x and y coordinates');
      }
      return true;
    }),
  
  body('config')
    .isObject()
    .withMessage('Config is required and must be an object')
    .custom((value, { req }) => {
      const stepType = req.body.type;
      
      // Manual step validation
      if (stepType === 'manual') {
        if (!value.assigneeType || !['role', 'user', 'auto'].includes(value.assigneeType)) {
          throw new Error('Manual steps must have assigneeType: role, user, or auto');
        }
        
        if (value.assigneeType !== 'auto' && !value.assigneeValue) {
          throw new Error('assigneeValue is required when assigneeType is not auto');
        }
      }
      
      // Timeout validation
      if (value.timeoutMinutes !== undefined) {
        if (typeof value.timeoutMinutes !== 'number' || value.timeoutMinutes <= 0) {
          throw new Error('timeoutMinutes must be a positive number');
        }
      }
      
      // Required fields validation
      if (value.requiredFields && !Array.isArray(value.requiredFields)) {
        throw new Error('requiredFields must be an array');
      }
      
      // Allowed actions validation
      if (value.allowedActions && !Array.isArray(value.allowedActions)) {
        throw new Error('allowedActions must be an array');
      }
      
      return true;
    }),
  
  body('transitions')
    .isArray()
    .withMessage('Transitions must be an array')
    .custom((value) => {
      for (let i = 0; i < value.length; i++) {
        const transition = value[i];
        
        if (!transition.name || typeof transition.name !== 'string') {
          throw new Error(`Transition ${i + 1}: name is required and must be a string`);
        }
        
        if (!transition.targetStepName || typeof transition.targetStepName !== 'string') {
          throw new Error(`Transition ${i + 1}: targetStepName is required and must be a string`);
        }
        
        // Validate conditions if present
        if (transition.conditions) {
          if (!Array.isArray(transition.conditions)) {
            throw new Error(`Transition ${i + 1}: conditions must be an array`);
          }
          
          for (let j = 0; j < transition.conditions.length; j++) {
            const condition = transition.conditions[j];
            
            if (!condition.field || typeof condition.field !== 'string') {
              throw new Error(`Transition ${i + 1}, Condition ${j + 1}: field is required and must be a string`);
            }
            
            const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'exists', 'in'];
            if (!condition.operator || !validOperators.includes(condition.operator)) {
              throw new Error(`Transition ${i + 1}, Condition ${j + 1}: operator must be one of: ${validOperators.join(', ')}`);
            }
            
            if (condition.operator !== 'exists' && condition.value === undefined) {
              throw new Error(`Transition ${i + 1}, Condition ${j + 1}: value is required for this operator`);
            }
          }
        }
        
        // Validate actions if present
        if (transition.actions) {
          if (!Array.isArray(transition.actions)) {
            throw new Error(`Transition ${i + 1}: actions must be an array`);
          }
          
          for (let j = 0; j < transition.actions.length; j++) {
            const action = transition.actions[j];
            
            const validTypes = ['notification', 'assignment', 'status_update', 'field_update', 'webhook'];
            if (!action.type || !validTypes.includes(action.type)) {
              throw new Error(`Transition ${i + 1}, Action ${j + 1}: type must be one of: ${validTypes.join(', ')}`);
            }
            
            if (!action.config || typeof action.config !== 'object') {
              throw new Error(`Transition ${i + 1}, Action ${j + 1}: config is required and must be an object`);
            }
          }
        }
      }
      
      return true;
    })
];