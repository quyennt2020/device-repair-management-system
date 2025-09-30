import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';

export interface WorkflowConfiguration {
  id: UUID;
  name: string;
  description: string;
  deviceTypes: string[];
  serviceTypes: string[];
  customerTiers: string[];
  workflowDefinitionId: UUID;
  workflowDefinitionName: string;
  priority: number;
  isActive: boolean;
  conditions: ConfigurationCondition[];
  metadata: any;
  version: number;
  createdBy: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigurationCondition {
  field: string;
  operator: string;
  value: any;
  weight: number;
}

export interface CreateConfigurationRequest {
  name: string;
  description?: string;
  deviceTypes: string[];
  serviceTypes: string[];
  customerTiers: string[];
  workflowDefinitionId: UUID;
  priority?: number;
  conditions?: ConfigurationCondition[];
  metadata?: any;
}

export interface ConfigurationSelectionCriteria {
  deviceType: string;
  serviceType: string;
  customerTier: string;
  additionalContext?: any;
}

export interface ConfigurationMatch {
  configuration: WorkflowConfiguration;
  score: number;
  matchedCriteria: string[];
  reasons: string[];
}

export class WorkflowConfigurationService {
  /**
   * Create a new workflow configuration
   */
  async createConfiguration(
    request: CreateConfigurationRequest,
    createdBy: UUID
  ): Promise<WorkflowConfiguration> {
    try {
      // Validate workflow definition exists
      const workflowExists = await this.validateWorkflowDefinition(request.workflowDefinitionId);
      if (!workflowExists) {
        throw new Error('Workflow definition not found or inactive');
      }

      // Check for conflicts
      await this.validateConfigurationConflicts(request);

      const result = await db.query(`
        INSERT INTO workflow_configurations (
          name, description, device_types, service_types, customer_tiers,
          workflow_definition_id, priority, conditions, metadata, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        request.name,
        request.description,
        JSON.stringify(request.deviceTypes),
        JSON.stringify(request.serviceTypes),
        JSON.stringify(request.customerTiers),
        request.workflowDefinitionId,
        request.priority || 0,
        JSON.stringify(request.conditions || []),
        JSON.stringify(request.metadata || {}),
        createdBy
      ]);

      const config = result.rows[0];
      return await this.getConfigurationById(config.id) as WorkflowConfiguration;
    } catch (error) {
      console.error('Create configuration error:', error);
      throw error;
    }
  }

  /**
   * Get configuration by ID
   */
  async getConfigurationById(id: UUID): Promise<WorkflowConfiguration | null> {
    try {
      const result = await db.query(`
        SELECT 
          wc.*,
          wd.name as workflow_definition_name,
          u.full_name as created_by_name
        FROM workflow_configurations wc
        JOIN workflow_definitions wd ON wc.workflow_definition_id = wd.id
        LEFT JOIN users u ON wc.created_by = u.id
        WHERE wc.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapConfiguration(result.rows[0]);
    } catch (error) {
      console.error('Get configuration error:', error);
      throw error;
    }
  }

  /**
   * Get all configurations with filtering
   */
  async getConfigurations(filters: {
    deviceType?: string;
    serviceType?: string;
    customerTier?: string;
    workflowDefinitionId?: UUID;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    configurations: WorkflowConfiguration[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        deviceType,
        serviceType,
        customerTier,
        workflowDefinitionId,
        isActive,
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];
      let paramCount = 1;

      if (deviceType) {
        conditions.push(`wc.device_types::jsonb ? $${paramCount++}`);
        params.push(deviceType);
      }

      if (serviceType) {
        conditions.push(`wc.service_types::jsonb ? $${paramCount++}`);
        params.push(serviceType);
      }

      if (customerTier) {
        conditions.push(`wc.customer_tiers::jsonb ? $${paramCount++}`);
        params.push(customerTier);
      }

      if (workflowDefinitionId) {
        conditions.push(`wc.workflow_definition_id = $${paramCount++}`);
        params.push(workflowDefinitionId);
      }

      if (isActive !== undefined) {
        conditions.push(`wc.is_active = $${paramCount++}`);
        params.push(isActive);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total
        FROM workflow_configurations wc
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get configurations
      const configsResult = await db.query(`
        SELECT 
          wc.*,
          wd.name as workflow_definition_name,
          u.full_name as created_by_name
        FROM workflow_configurations wc
        JOIN workflow_definitions wd ON wc.workflow_definition_id = wd.id
        LEFT JOIN users u ON wc.created_by = u.id
        ${whereClause}
        ORDER BY wc.priority DESC, wc.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...params, limit, offset]);

      const configurations = configsResult.rows.map(row => this.mapConfiguration(row));

      return {
        configurations,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get configurations error:', error);
      throw error;
    }
  }

  /**
   * Select best workflow configuration based on criteria
   */
  async selectWorkflowConfiguration(
    criteria: ConfigurationSelectionCriteria
  ): Promise<ConfigurationMatch | null> {
    try {
      const candidates = await this.findCandidateConfigurations(criteria);
      
      if (candidates.length === 0) {
        return null;
      }

      // Score and rank candidates
      const matches = await Promise.all(
        candidates.map(config => this.scoreConfiguration(config, criteria))
      );

      // Sort by score (highest first)
      matches.sort((a, b) => b.score - a.score);

      return matches[0];
    } catch (error) {
      console.error('Select workflow configuration error:', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  async updateConfiguration(
    id: UUID,
    updates: Partial<CreateConfigurationRequest>
  ): Promise<WorkflowConfiguration> {
    try {
      const existing = await this.getConfigurationById(id);
      if (!existing) {
        throw new Error('Configuration not found');
      }

      // Validate workflow definition if changed
      if (updates.workflowDefinitionId) {
        const workflowExists = await this.validateWorkflowDefinition(updates.workflowDefinitionId);
        if (!workflowExists) {
          throw new Error('Workflow definition not found or inactive');
        }
      }

      const setClause = [];
      const values = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        setClause.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClause.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }

      if (updates.deviceTypes !== undefined) {
        setClause.push(`device_types = $${paramCount++}`);
        values.push(JSON.stringify(updates.deviceTypes));
      }

      if (updates.serviceTypes !== undefined) {
        setClause.push(`service_types = $${paramCount++}`);
        values.push(JSON.stringify(updates.serviceTypes));
      }

      if (updates.customerTiers !== undefined) {
        setClause.push(`customer_tiers = $${paramCount++}`);
        values.push(JSON.stringify(updates.customerTiers));
      }

      if (updates.workflowDefinitionId !== undefined) {
        setClause.push(`workflow_definition_id = $${paramCount++}`);
        values.push(updates.workflowDefinitionId);
      }

      if (updates.priority !== undefined) {
        setClause.push(`priority = $${paramCount++}`);
        values.push(updates.priority);
      }

      if (updates.conditions !== undefined) {
        setClause.push(`conditions = $${paramCount++}`);
        values.push(JSON.stringify(updates.conditions));
      }

      if (updates.metadata !== undefined) {
        setClause.push(`metadata = $${paramCount++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (setClause.length === 0) {
        throw new Error('No fields to update');
      }

      setClause.push(`updated_at = NOW()`, `version = version + 1`);
      values.push(id);

      await db.query(`
        UPDATE workflow_configurations 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
      `, values);

      return await this.getConfigurationById(id) as WorkflowConfiguration;
    } catch (error) {
      console.error('Update configuration error:', error);
      throw error;
    }
  }

  /**
   * Delete configuration
   */
  async deleteConfiguration(id: UUID): Promise<void> {
    try {
      const result = await db.query(`
        DELETE FROM workflow_configurations WHERE id = $1
      `, [id]);

      if (result.rowCount === 0) {
        throw new Error('Configuration not found');
      }
    } catch (error) {
      console.error('Delete configuration error:', error);
      throw error;
    }
  }

  /**
   * Activate/deactivate configuration
   */
  async toggleConfiguration(id: UUID, isActive: boolean): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_configurations 
        SET is_active = $1, updated_at = NOW()
        WHERE id = $2
      `, [isActive, id]);
    } catch (error) {
      console.error('Toggle configuration error:', error);
      throw error;
    }
  }  /**

   * Private helper methods
   */
  private async validateWorkflowDefinition(workflowDefinitionId: UUID): Promise<boolean> {
    try {
      const result = await db.query(`
        SELECT id FROM workflow_definitions 
        WHERE id = $1 AND status = 'active'
      `, [workflowDefinitionId]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Validate workflow definition error:', error);
      return false;
    }
  }

  private async validateConfigurationConflicts(request: CreateConfigurationRequest): Promise<void> {
    // Check for exact matches that could cause conflicts
    const result = await db.query(`
      SELECT id, name FROM workflow_configurations
      WHERE device_types::jsonb = $1::jsonb
        AND service_types::jsonb = $2::jsonb
        AND customer_tiers::jsonb = $3::jsonb
        AND is_active = true
    `, [
      JSON.stringify(request.deviceTypes),
      JSON.stringify(request.serviceTypes),
      JSON.stringify(request.customerTiers)
    ]);

    if (result.rows.length > 0) {
      throw new Error(`Configuration conflict detected with existing configuration: ${result.rows[0].name}`);
    }
  }

  private async findCandidateConfigurations(
    criteria: ConfigurationSelectionCriteria
  ): Promise<WorkflowConfiguration[]> {
    try {
      const result = await db.query(`
        SELECT 
          wc.*,
          wd.name as workflow_definition_name
        FROM workflow_configurations wc
        JOIN workflow_definitions wd ON wc.workflow_definition_id = wd.id
        WHERE wc.is_active = true
          AND wd.status = 'active'
          AND (
            wc.device_types::jsonb ? $1
            OR wc.service_types::jsonb ? $2
            OR wc.customer_tiers::jsonb ? $3
          )
        ORDER BY wc.priority DESC
      `, [criteria.deviceType, criteria.serviceType, criteria.customerTier]);

      return result.rows.map(row => this.mapConfiguration(row));
    } catch (error) {
      console.error('Find candidate configurations error:', error);
      return [];
    }
  }

  private async scoreConfiguration(
    config: WorkflowConfiguration,
    criteria: ConfigurationSelectionCriteria
  ): Promise<ConfigurationMatch> {
    let score = 0;
    const matchedCriteria: string[] = [];
    const reasons: string[] = [];

    // Base priority score
    score += config.priority * 10;

    // Exact matches get higher scores
    if (config.deviceTypes.includes(criteria.deviceType)) {
      score += 100;
      matchedCriteria.push('deviceType');
      reasons.push(`Matches device type: ${criteria.deviceType}`);
    }

    if (config.serviceTypes.includes(criteria.serviceType)) {
      score += 80;
      matchedCriteria.push('serviceType');
      reasons.push(`Matches service type: ${criteria.serviceType}`);
    }

    if (config.customerTiers.includes(criteria.customerTier)) {
      score += 60;
      matchedCriteria.push('customerTier');
      reasons.push(`Matches customer tier: ${criteria.customerTier}`);
    }

    // Evaluate custom conditions
    if (config.conditions && config.conditions.length > 0) {
      const conditionScore = await this.evaluateConditions(config.conditions, criteria);
      score += conditionScore;
      if (conditionScore > 0) {
        reasons.push(`Custom conditions matched (score: ${conditionScore})`);
      }
    }

    // Penalty for overly broad configurations
    const totalCriteria = config.deviceTypes.length + config.serviceTypes.length + config.customerTiers.length;
    if (totalCriteria > 10) {
      score -= 20;
      reasons.push('Penalty for overly broad configuration');
    }

    return {
      configuration: config,
      score,
      matchedCriteria,
      reasons
    };
  }

  private async evaluateConditions(
    conditions: ConfigurationCondition[],
    criteria: ConfigurationSelectionCriteria
  ): Promise<number> {
    let totalScore = 0;

    for (const condition of conditions) {
      const conditionMet = this.evaluateCondition(condition, criteria);
      if (conditionMet) {
        totalScore += condition.weight || 10;
      }
    }

    return totalScore;
  }

  private evaluateCondition(
    condition: ConfigurationCondition,
    criteria: ConfigurationSelectionCriteria
  ): boolean {
    const contextValue = this.getContextValue(condition.field, criteria);
    
    switch (condition.operator) {
      case 'equals':
        return contextValue === condition.value;
      case 'not_equals':
        return contextValue !== condition.value;
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(contextValue);
      case 'greater_than':
        return Number(contextValue) > Number(condition.value);
      case 'less_than':
        return Number(contextValue) < Number(condition.value);
      case 'exists':
        return contextValue !== undefined && contextValue !== null;
      default:
        return false;
    }
  }

  private getContextValue(field: string, criteria: ConfigurationSelectionCriteria): any {
    const context = {
      deviceType: criteria.deviceType,
      serviceType: criteria.serviceType,
      customerTier: criteria.customerTier,
      ...criteria.additionalContext
    };

    // Support dot notation for nested fields
    const parts = field.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as any)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private mapConfiguration(row: any): WorkflowConfiguration {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      deviceTypes: row.device_types,
      serviceTypes: row.service_types,
      customerTiers: row.customer_tiers,
      workflowDefinitionId: row.workflow_definition_id,
      workflowDefinitionName: row.workflow_definition_name,
      priority: row.priority,
      isActive: row.is_active,
      conditions: row.conditions || [],
      metadata: row.metadata || {},
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Migration and versioning methods
   */
  async migrateConfigurations(
    fromWorkflowId: UUID,
    toWorkflowId: UUID,
    migrationStrategy: 'replace' | 'duplicate' | 'update'
  ): Promise<void> {
    try {
      const configurations = await this.getConfigurations({
        workflowDefinitionId: fromWorkflowId
      });

      for (const config of configurations.configurations) {
        switch (migrationStrategy) {
          case 'replace':
            await this.updateConfiguration(config.id, {
              workflowDefinitionId: toWorkflowId
            });
            break;

          case 'duplicate':
            await this.createConfiguration({
              name: `${config.name} (Migrated)`,
              description: config.description,
              deviceTypes: config.deviceTypes,
              serviceTypes: config.serviceTypes,
              customerTiers: config.customerTiers,
              workflowDefinitionId: toWorkflowId,
              priority: config.priority,
              conditions: config.conditions,
              metadata: {
                ...config.metadata,
                migratedFrom: fromWorkflowId,
                originalConfigId: config.id
              }
            }, config.createdBy);
            break;

          case 'update':
            // Create new version with updated workflow
            await this.createConfiguration({
              name: config.name,
              description: config.description,
              deviceTypes: config.deviceTypes,
              serviceTypes: config.serviceTypes,
              customerTiers: config.customerTiers,
              workflowDefinitionId: toWorkflowId,
              priority: config.priority,
              conditions: config.conditions,
              metadata: config.metadata
            }, config.createdBy);

            // Deactivate old configuration
            await this.toggleConfiguration(config.id, false);
            break;
        }
      }
    } catch (error) {
      console.error('Migrate configurations error:', error);
      throw error;
    }
  }

  /**
   * Get configuration usage statistics
   */
  async getConfigurationUsageStats(configId: UUID): Promise<any> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_usage,
          COUNT(CASE WHEN wi.status = 'completed' THEN 1 END) as completed_workflows,
          COUNT(CASE WHEN wi.status = 'failed' THEN 1 END) as failed_workflows,
          AVG(EXTRACT(EPOCH FROM (wi.completed_at - wi.started_at))) as avg_execution_time,
          MIN(wi.started_at) as first_used,
          MAX(wi.started_at) as last_used
        FROM workflow_instances wi
        WHERE wi.metadata->>'configurationId' = $1
      `, [configId]);

      const stats = result.rows[0];

      return {
        totalUsage: parseInt(stats.total_usage),
        completedWorkflows: parseInt(stats.completed_workflows),
        failedWorkflows: parseInt(stats.failed_workflows),
        averageExecutionTime: parseFloat(stats.avg_execution_time) || 0,
        firstUsed: stats.first_used,
        lastUsed: stats.last_used,
        successRate: stats.total_usage > 0 ? 
          parseInt(stats.completed_workflows) / parseInt(stats.total_usage) : 0
      };
    } catch (error) {
      console.error('Get configuration usage stats error:', error);
      return {
        totalUsage: 0,
        completedWorkflows: 0,
        failedWorkflows: 0,
        averageExecutionTime: 0,
        firstUsed: null,
        lastUsed: null,
        successRate: 0
      };
    }
  }

  /**
   * Validate configuration compatibility
   */
  async validateConfigurationCompatibility(configId: UUID): Promise<{
    isValid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    try {
      const config = await this.getConfigurationById(configId);
      if (!config) {
        return {
          isValid: false,
          issues: ['Configuration not found'],
          warnings: []
        };
      }

      const issues: string[] = [];
      const warnings: string[] = [];

      // Check if workflow definition is still active
      const workflowValid = await this.validateWorkflowDefinition(config.workflowDefinitionId);
      if (!workflowValid) {
        issues.push('Associated workflow definition is inactive or not found');
      }

      // Check for empty criteria
      if (config.deviceTypes.length === 0 && config.serviceTypes.length === 0 && config.customerTiers.length === 0) {
        warnings.push('Configuration has no specific criteria - will match all requests');
      }

      // Check for overly broad configurations
      const totalCriteria = config.deviceTypes.length + config.serviceTypes.length + config.customerTiers.length;
      if (totalCriteria > 20) {
        warnings.push('Configuration is very broad and may cause performance issues');
      }

      // Check for conflicting configurations
      const conflicts = await db.query(`
        SELECT id, name FROM workflow_configurations
        WHERE id != $1
          AND is_active = true
          AND priority = $2
          AND (
            device_types::jsonb && $3::jsonb
            OR service_types::jsonb && $4::jsonb
            OR customer_tiers::jsonb && $5::jsonb
          )
      `, [
        config.id,
        config.priority,
        JSON.stringify(config.deviceTypes),
        JSON.stringify(config.serviceTypes),
        JSON.stringify(config.customerTiers)
      ]);

      if (conflicts.rows.length > 0) {
        warnings.push(`Potential conflicts with configurations: ${conflicts.rows.map(r => r.name).join(', ')}`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        warnings
      };
    } catch (error) {
      console.error('Validate configuration compatibility error:', error);
      return {
        isValid: false,
        issues: ['Error validating configuration'],
        warnings: []
      };
    }
  }
}