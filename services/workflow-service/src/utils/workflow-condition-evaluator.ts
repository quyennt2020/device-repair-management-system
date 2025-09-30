import { WorkflowCondition } from '@drms/shared-types';
import { WorkflowExecutionContext } from '../services/workflow-execution.service';

export class WorkflowConditionEvaluator {
  /**
   * Evaluate a list of conditions with AND logic
   */
  async evaluateConditions(
    conditions: WorkflowCondition[],
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    if (!conditions || conditions.length === 0) {
      return true; // No conditions means always true
    }

    // All conditions must be true (AND logic)
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (!result) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(
    condition: WorkflowCondition,
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    try {
      const fieldValue = this.getFieldValue(condition.field, context);
      const expectedValue = condition.value;

      switch (condition.operator) {
        case 'equals':
          return this.compareValues(fieldValue, expectedValue, '===');
        
        case 'not_equals':
          return this.compareValues(fieldValue, expectedValue, '!==');
        
        case 'greater_than':
          return this.compareValues(fieldValue, expectedValue, '>');
        
        case 'less_than':
          return this.compareValues(fieldValue, expectedValue, '<');
        
        case 'greater_than_or_equal':
          return this.compareValues(fieldValue, expectedValue, '>=');
        
        case 'less_than_or_equal':
          return this.compareValues(fieldValue, expectedValue, '<=');
        
        case 'contains':
          return this.evaluateContains(fieldValue, expectedValue);
        
        case 'not_contains':
          return !this.evaluateContains(fieldValue, expectedValue);
        
        case 'starts_with':
          return this.evaluateStartsWith(fieldValue, expectedValue);
        
        case 'ends_with':
          return this.evaluateEndsWith(fieldValue, expectedValue);
        
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null;
        
        case 'not_exists':
          return fieldValue === undefined || fieldValue === null;
        
        case 'in':
          return this.evaluateIn(fieldValue, expectedValue);
        
        case 'not_in':
          return !this.evaluateIn(fieldValue, expectedValue);
        
        case 'regex':
          return this.evaluateRegex(fieldValue, expectedValue);
        
        case 'is_empty':
          return this.evaluateIsEmpty(fieldValue);
        
        case 'is_not_empty':
          return !this.evaluateIsEmpty(fieldValue);

        default:
          console.warn(`Unknown condition operator: ${condition.operator}`);
          return false;
      }
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(fieldPath: string, context: WorkflowExecutionContext): any {
    const parts = fieldPath.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Compare two values using the specified operator
   */
  private compareValues(value1: any, value2: any, operator: string): boolean {
    // Handle null/undefined cases
    if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) {
      switch (operator) {
        case '===':
          return value1 === value2;
        case '!==':
          return value1 !== value2;
        default:
          return false;
      }
    }

    // Try to convert to numbers for numeric comparisons
    if (operator !== '===' && operator !== '!==') {
      const num1 = this.tryParseNumber(value1);
      const num2 = this.tryParseNumber(value2);
      
      if (num1 !== null && num2 !== null) {
        value1 = num1;
        value2 = num2;
      }
    }

    switch (operator) {
      case '===':
        return value1 === value2;
      case '!==':
        return value1 !== value2;
      case '>':
        return value1 > value2;
      case '<':
        return value1 < value2;
      case '>=':
        return value1 >= value2;
      case '<=':
        return value1 <= value2;
      default:
        return false;
    }
  }

  /**
   * Evaluate contains condition
   */
  private evaluateContains(value: any, searchValue: any): boolean {
    if (typeof value === 'string' && typeof searchValue === 'string') {
      return value.toLowerCase().includes(searchValue.toLowerCase());
    }
    
    if (Array.isArray(value)) {
      return value.includes(searchValue);
    }
    
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).includes(searchValue);
    }
    
    return false;
  }

  /**
   * Evaluate starts_with condition
   */
  private evaluateStartsWith(value: any, prefix: any): boolean {
    if (typeof value === 'string' && typeof prefix === 'string') {
      return value.toLowerCase().startsWith(prefix.toLowerCase());
    }
    return false;
  }

  /**
   * Evaluate ends_with condition
   */
  private evaluateEndsWith(value: any, suffix: any): boolean {
    if (typeof value === 'string' && typeof suffix === 'string') {
      return value.toLowerCase().endsWith(suffix.toLowerCase());
    }
    return false;
  }

  /**
   * Evaluate in condition
   */
  private evaluateIn(value: any, array: any): boolean {
    if (!Array.isArray(array)) {
      return false;
    }
    return array.includes(value);
  }

  /**
   * Evaluate regex condition
   */
  private evaluateRegex(value: any, pattern: any): boolean {
    if (typeof value !== 'string' || typeof pattern !== 'string') {
      return false;
    }
    
    try {
      const regex = new RegExp(pattern, 'i'); // Case insensitive
      return regex.test(value);
    } catch (error) {
      console.error('Invalid regex pattern:', pattern);
      return false;
    }
  }

  /**
   * Evaluate is_empty condition
   */
  private evaluateIsEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (typeof value === 'string') {
      return value.trim() === '';
    }
    
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    
    return false;
  }

  /**
   * Try to parse a value as a number
   */
  private tryParseNumber(value: any): number | null {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Evaluate complex conditions with OR logic
   */
  async evaluateConditionsWithOr(
    conditionGroups: WorkflowCondition[][],
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    if (!conditionGroups || conditionGroups.length === 0) {
      return true;
    }

    // At least one group must be true (OR logic between groups)
    for (const group of conditionGroups) {
      const result = await this.evaluateConditions(group, context);
      if (result) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate conditions with custom logic
   */
  async evaluateCustomCondition(
    conditionExpression: string,
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    try {
      // This would implement a safe expression evaluator
      // For security reasons, we'd use a sandboxed environment
      // For now, we'll just return false for custom expressions
      console.warn('Custom condition expressions not yet implemented:', conditionExpression);
      return false;
    } catch (error) {
      console.error('Custom condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Get available fields for condition building
   */
  getAvailableFields(): string[] {
    return [
      'caseId',
      'customerId',
      'technicianId',
      'deviceId',
      'variables.status',
      'variables.priority',
      'variables.category',
      'variables.estimatedCost',
      'variables.actualCost',
      'variables.completionPercentage',
      'metadata.createdAt',
      'metadata.updatedAt',
      'metadata.tags',
      'metadata.notes'
    ];
  }

  /**
   * Validate condition syntax
   */
  validateCondition(condition: WorkflowCondition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!condition.field) {
      errors.push('Field is required');
    }

    if (!condition.operator) {
      errors.push('Operator is required');
    }

    const validOperators = [
      'equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal',
      'less_than_or_equal', 'contains', 'not_contains', 'starts_with', 'ends_with',
      'exists', 'not_exists', 'in', 'not_in', 'regex', 'is_empty', 'is_not_empty'
    ];

    if (condition.operator && !validOperators.includes(condition.operator)) {
      errors.push(`Invalid operator: ${condition.operator}`);
    }

    // Value is required for most operators except exists/not_exists/is_empty/is_not_empty
    const operatorsWithoutValue = ['exists', 'not_exists', 'is_empty', 'is_not_empty'];
    if (condition.operator && !operatorsWithoutValue.includes(condition.operator) && condition.value === undefined) {
      errors.push('Value is required for this operator');
    }

    // Array value required for in/not_in operators
    if ((condition.operator === 'in' || condition.operator === 'not_in') && !Array.isArray(condition.value)) {
      errors.push('Value must be an array for in/not_in operators');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}