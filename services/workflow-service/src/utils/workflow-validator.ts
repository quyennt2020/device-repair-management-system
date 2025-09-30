import { WorkflowDefinition, WorkflowStep, WorkflowCondition } from '@drms/shared-types';
import { config } from '../config';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class WorkflowValidator {
  /**
   * Validate workflow definition structure and business rules
   */
  async validateWorkflowDefinition(workflow: any): Promise<void> {
    const errors: ValidationError[] = [];

    // Basic field validation
    this.validateBasicFields(workflow, errors);
    
    // Steps validation
    this.validateSteps(workflow.steps || [], errors);
    
    // Transitions validation
    this.validateTransitions(workflow.steps || [], errors);
    
    // Business rules validation
    this.validateBusinessRules(workflow, errors);

    if (errors.length > 0) {
      throw new Error(`Workflow validation failed: ${JSON.stringify(errors)}`);
    }
  }

  /**
   * Validate workflow for activation (stricter validation)
   */
  async validateWorkflowForActivation(workflow: WorkflowDefinition): Promise<void> {
    const errors: ValidationError[] = [];

    // All basic validations
    await this.validateWorkflowDefinition(workflow);

    // Additional activation validations
    this.validateActivationRequirements(workflow, errors);

    if (errors.length > 0) {
      throw new Error(`Workflow activation validation failed: ${JSON.stringify(errors)}`);
    }
  }

  private validateBasicFields(workflow: any, errors: ValidationError[]): void {
    // Name validation
    if (!workflow.name || typeof workflow.name !== 'string') {
      errors.push({
        field: 'name',
        message: 'Workflow name is required and must be a string',
        code: 'REQUIRED_FIELD'
      });
    } else if (workflow.name.length > config.validation.maxNameLength) {
      errors.push({
        field: 'name',
        message: `Workflow name must be less than ${config.validation.maxNameLength} characters`,
        code: 'FIELD_TOO_LONG'
      });
    }

    // Description validation
    if (workflow.description && workflow.description.length > config.validation.maxDescriptionLength) {
      errors.push({
        field: 'description',
        message: `Description must be less than ${config.validation.maxDescriptionLength} characters`,
        code: 'FIELD_TOO_LONG'
      });
    }

    // Device types validation
    if (!Array.isArray(workflow.deviceTypes) || workflow.deviceTypes.length === 0) {
      errors.push({
        field: 'deviceTypes',
        message: 'At least one device type must be specified',
        code: 'REQUIRED_FIELD'
      });
    }

    // Service types validation
    if (!Array.isArray(workflow.serviceTypes) || workflow.serviceTypes.length === 0) {
      errors.push({
        field: 'serviceTypes',
        message: 'At least one service type must be specified',
        code: 'REQUIRED_FIELD'
      });
    }

    // Customer tiers validation
    if (!Array.isArray(workflow.customerTiers) || workflow.customerTiers.length === 0) {
      errors.push({
        field: 'customerTiers',
        message: 'At least one customer tier must be specified',
        code: 'REQUIRED_FIELD'
      });
    }
  }  
private validateSteps(steps: any[], errors: ValidationError[]): void {
    if (!Array.isArray(steps) || steps.length === 0) {
      errors.push({
        field: 'steps',
        message: 'Workflow must have at least one step',
        code: 'REQUIRED_FIELD'
      });
      return;
    }

    if (steps.length > config.workflow.maxStepsPerWorkflow) {
      errors.push({
        field: 'steps',
        message: `Workflow cannot have more than ${config.workflow.maxStepsPerWorkflow} steps`,
        code: 'TOO_MANY_STEPS'
      });
    }

    // Check for duplicate step names
    const stepNames = new Set<string>();
    const duplicateNames = new Set<string>();

    steps.forEach((step, index) => {
      // Step name validation
      if (!step.name || typeof step.name !== 'string') {
        errors.push({
          field: `steps[${index}].name`,
          message: 'Step name is required and must be a string',
          code: 'REQUIRED_FIELD'
        });
      } else {
        if (stepNames.has(step.name)) {
          duplicateNames.add(step.name);
        }
        stepNames.add(step.name);
      }

      // Step type validation
      const validTypes = ['manual', 'automatic', 'decision', 'parallel', 'wait'];
      if (!step.type || !validTypes.includes(step.type)) {
        errors.push({
          field: `steps[${index}].type`,
          message: `Step type must be one of: ${validTypes.join(', ')}`,
          code: 'INVALID_VALUE'
        });
      }

      // Position validation
      if (!step.position || typeof step.position.x !== 'number' || typeof step.position.y !== 'number') {
        errors.push({
          field: `steps[${index}].position`,
          message: 'Step position must have numeric x and y coordinates',
          code: 'INVALID_POSITION'
        });
      }

      // Config validation
      this.validateStepConfig(step, index, errors);
    });

    // Report duplicate names
    duplicateNames.forEach(name => {
      errors.push({
        field: 'steps',
        message: `Duplicate step name: ${name}`,
        code: 'DUPLICATE_STEP_NAME'
      });
    });
  }

  private validateStepConfig(step: any, stepIndex: number, errors: ValidationError[]): void {
    if (!step.config || typeof step.config !== 'object') {
      errors.push({
        field: `steps[${stepIndex}].config`,
        message: 'Step config is required and must be an object',
        code: 'REQUIRED_FIELD'
      });
      return;
    }

    const config = step.config;

    // Assignee validation for manual steps
    if (step.type === 'manual') {
      if (!config.assigneeType || !['role', 'user', 'auto'].includes(config.assigneeType)) {
        errors.push({
          field: `steps[${stepIndex}].config.assigneeType`,
          message: 'Manual steps must have assigneeType: role, user, or auto',
          code: 'INVALID_VALUE'
        });
      }

      if (config.assigneeType !== 'auto' && !config.assigneeValue) {
        errors.push({
          field: `steps[${stepIndex}].config.assigneeValue`,
          message: 'assigneeValue is required when assigneeType is not auto',
          code: 'REQUIRED_FIELD'
        });
      }
    }

    // Timeout validation
    if (config.timeoutMinutes !== undefined) {
      if (typeof config.timeoutMinutes !== 'number' || config.timeoutMinutes <= 0) {
        errors.push({
          field: `steps[${stepIndex}].config.timeoutMinutes`,
          message: 'timeoutMinutes must be a positive number',
          code: 'INVALID_VALUE'
        });
      }
    }

    // Required fields validation
    if (config.requiredFields && !Array.isArray(config.requiredFields)) {
      errors.push({
        field: `steps[${stepIndex}].config.requiredFields`,
        message: 'requiredFields must be an array',
        code: 'INVALID_TYPE'
      });
    }

    // Allowed actions validation
    if (config.allowedActions && !Array.isArray(config.allowedActions)) {
      errors.push({
        field: `steps[${stepIndex}].config.allowedActions`,
        message: 'allowedActions must be an array',
        code: 'INVALID_TYPE'
      });
    }

    // Auto advance conditions validation
    if (config.autoAdvanceConditions) {
      this.validateConditions(config.autoAdvanceConditions, `steps[${stepIndex}].config.autoAdvanceConditions`, errors);
    }
  }

  private validateTransitions(steps: any[], errors: ValidationError[]): void {
    const stepNames = new Set(steps.map(s => s.name));

    steps.forEach((step, stepIndex) => {
      if (!step.transitions || !Array.isArray(step.transitions)) {
        errors.push({
          field: `steps[${stepIndex}].transitions`,
          message: 'Step transitions must be an array',
          code: 'INVALID_TYPE'
        });
        return;
      }

      step.transitions.forEach((transition: any, transitionIndex: number) => {
        // Transition name validation
        if (!transition.name || typeof transition.name !== 'string') {
          errors.push({
            field: `steps[${stepIndex}].transitions[${transitionIndex}].name`,
            message: 'Transition name is required and must be a string',
            code: 'REQUIRED_FIELD'
          });
        }

        // Target step validation
        if (!transition.targetStepName || typeof transition.targetStepName !== 'string') {
          errors.push({
            field: `steps[${stepIndex}].transitions[${transitionIndex}].targetStepName`,
            message: 'Transition targetStepName is required and must be a string',
            code: 'REQUIRED_FIELD'
          });
        } else if (!stepNames.has(transition.targetStepName)) {
          errors.push({
            field: `steps[${stepIndex}].transitions[${transitionIndex}].targetStepName`,
            message: `Target step '${transition.targetStepName}' does not exist`,
            code: 'INVALID_REFERENCE'
          });
        }

        // Conditions validation
        if (transition.conditions) {
          this.validateConditions(
            transition.conditions,
            `steps[${stepIndex}].transitions[${transitionIndex}].conditions`,
            errors
          );
        }

        // Actions validation
        if (transition.actions) {
          this.validateActions(
            transition.actions,
            `steps[${stepIndex}].transitions[${transitionIndex}].actions`,
            errors
          );
        }
      });
    });
  }

  private validateConditions(conditions: any[], fieldPath: string, errors: ValidationError[]): void {
    if (!Array.isArray(conditions)) {
      errors.push({
        field: fieldPath,
        message: 'Conditions must be an array',
        code: 'INVALID_TYPE'
      });
      return;
    }

    conditions.forEach((condition, index) => {
      if (!condition.field || typeof condition.field !== 'string') {
        errors.push({
          field: `${fieldPath}[${index}].field`,
          message: 'Condition field is required and must be a string',
          code: 'REQUIRED_FIELD'
        });
      }

      const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'exists', 'in'];
      if (!condition.operator || !validOperators.includes(condition.operator)) {
        errors.push({
          field: `${fieldPath}[${index}].operator`,
          message: `Condition operator must be one of: ${validOperators.join(', ')}`,
          code: 'INVALID_VALUE'
        });
      }

      // Value is required for most operators except 'exists'
      if (condition.operator !== 'exists' && condition.value === undefined) {
        errors.push({
          field: `${fieldPath}[${index}].value`,
          message: 'Condition value is required for this operator',
          code: 'REQUIRED_FIELD'
        });
      }
    });
  }

  private validateActions(actions: any[], fieldPath: string, errors: ValidationError[]): void {
    if (!Array.isArray(actions)) {
      errors.push({
        field: fieldPath,
        message: 'Actions must be an array',
        code: 'INVALID_TYPE'
      });
      return;
    }

    actions.forEach((action, index) => {
      const validTypes = ['notification', 'assignment', 'status_update', 'field_update', 'webhook'];
      if (!action.type || !validTypes.includes(action.type)) {
        errors.push({
          field: `${fieldPath}[${index}].type`,
          message: `Action type must be one of: ${validTypes.join(', ')}`,
          code: 'INVALID_VALUE'
        });
      }

      if (!action.config || typeof action.config !== 'object') {
        errors.push({
          field: `${fieldPath}[${index}].config`,
          message: 'Action config is required and must be an object',
          code: 'REQUIRED_FIELD'
        });
      }
    });
  }

  private validateBusinessRules(workflow: any, errors: ValidationError[]): void {
    const steps = workflow.steps || [];

    // Must have at least one start step (no incoming transitions)
    const stepsWithIncoming = new Set<string>();
    steps.forEach((step: any) => {
      step.transitions?.forEach((transition: any) => {
        stepsWithIncoming.add(transition.targetStepName);
      });
    });

    const startSteps = steps.filter((step: any) => !stepsWithIncoming.has(step.name));
    if (startSteps.length === 0) {
      errors.push({
        field: 'steps',
        message: 'Workflow must have at least one start step (step with no incoming transitions)',
        code: 'NO_START_STEP'
      });
    }

    // Check for unreachable steps
    const reachableSteps = new Set<string>();
    const queue = [...startSteps.map((s: any) => s.name)];
    
    while (queue.length > 0) {
      const currentStepName = queue.shift()!;
      if (reachableSteps.has(currentStepName)) continue;
      
      reachableSteps.add(currentStepName);
      const currentStep = steps.find((s: any) => s.name === currentStepName);
      
      if (currentStep?.transitions) {
        currentStep.transitions.forEach((transition: any) => {
          if (!reachableSteps.has(transition.targetStepName)) {
            queue.push(transition.targetStepName);
          }
        });
      }
    }

    const unreachableSteps = steps.filter((step: any) => !reachableSteps.has(step.name));
    unreachableSteps.forEach((step: any) => {
      errors.push({
        field: 'steps',
        message: `Step '${step.name}' is unreachable from start steps`,
        code: 'UNREACHABLE_STEP'
      });
    });

    // Check for circular dependencies (simplified check)
    this.validateCircularDependencies(steps, errors);
  }

  private validateCircularDependencies(steps: any[], errors: ValidationError[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepName: string): boolean => {
      if (recursionStack.has(stepName)) {
        return true; // Cycle detected
      }
      if (visited.has(stepName)) {
        return false; // Already processed
      }

      visited.add(stepName);
      recursionStack.add(stepName);

      const step = steps.find(s => s.name === stepName);
      if (step?.transitions) {
        for (const transition of step.transitions) {
          if (hasCycle(transition.targetStepName)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepName);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.name) && hasCycle(step.name)) {
        errors.push({
          field: 'steps',
          message: `Circular dependency detected involving step '${step.name}'`,
          code: 'CIRCULAR_DEPENDENCY'
        });
        break; // Report only the first cycle found
      }
    }
  }

  private validateActivationRequirements(workflow: WorkflowDefinition, errors: ValidationError[]): void {
    // All steps must have at least one transition (except end steps)
    const stepsWithOutgoing = new Set<string>();
    workflow.steps.forEach(step => {
      step.transitions.forEach(transition => {
        stepsWithOutgoing.add(step.name);
      });
    });

    // Check for steps with no outgoing transitions (potential end steps)
    const endSteps = workflow.steps.filter(step => step.transitions.length === 0);
    if (endSteps.length === 0) {
      errors.push({
        field: 'steps',
        message: 'Workflow must have at least one end step (step with no outgoing transitions)',
        code: 'NO_END_STEP'
      });
    }

    // Manual steps must have proper assignee configuration
    workflow.steps.forEach(step => {
      if (step.type === 'manual') {
        if (!step.config.assigneeType || step.config.assigneeType === 'auto') {
          errors.push({
            field: 'steps',
            message: `Manual step '${step.name}' must have a specific assignee (role or user)`,
            code: 'INVALID_ASSIGNEE'
          });
        }
      }
    });

    // Decision steps must have multiple transitions
    workflow.steps.forEach(step => {
      if (step.type === 'decision' && step.transitions.length < 2) {
        errors.push({
          field: 'steps',
          message: `Decision step '${step.name}' must have at least 2 transitions`,
          code: 'INSUFFICIENT_TRANSITIONS'
        });
      }
    });
  }
}