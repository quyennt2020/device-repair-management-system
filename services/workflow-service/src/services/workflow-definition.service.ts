import { db } from '@drms/shared-database';
import { 
  WorkflowDefinition, 
  WorkflowStep, 
  WorkflowTransition,
  WorkflowCondition,
  UUID 
} from '@drms/shared-types';
import { config } from '../config';
import { WorkflowValidator } from '../utils/workflow-validator';
import { WorkflowVersionManager } from '../utils/workflow-version-manager';

export interface CreateWorkflowDefinitionRequest {
  name: string;
  description?: string;
  deviceTypes: string[];
  serviceTypes: string[];
  customerTiers: string[];
  steps: WorkflowStepDefinition[];
  metadata?: any;
}

export interface UpdateWorkflowDefinitionRequest {
  name?: string;
  description?: string;
  deviceTypes?: string[];
  serviceTypes?: string[];
  customerTiers?: string[];
  steps?: WorkflowStepDefinition[];
  metadata?: any;
}

export interface WorkflowStepDefinition {
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'decision' | 'parallel' | 'wait';
  position: { x: number; y: number };
  config: {
    assigneeType?: 'role' | 'user' | 'auto';
    assigneeValue?: string;
    timeoutMinutes?: number;
    requiredFields?: string[];
    allowedActions?: string[];
    autoAdvanceConditions?: WorkflowCondition[];
  };
  transitions: WorkflowTransitionDefinition[];
}

export interface WorkflowTransitionDefinition {
  name: string;
  targetStepName: string;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
}

export interface WorkflowAction {
  type: 'notification' | 'assignment' | 'status_update' | 'field_update' | 'webhook';
  config: any;
}

export interface WorkflowDefinitionFilters {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  serviceType?: string;
  customerTier?: string;
  status?: 'draft' | 'active' | 'archived';
  createdBy?: UUID;
  createdAfter?: Date;
  createdBefore?: Date;
}

export class WorkflowDefinitionService {
  private validator: WorkflowValidator;
  private versionManager: WorkflowVersionManager;

  constructor() {
    this.validator = new WorkflowValidator();
    this.versionManager = new WorkflowVersionManager();
  }

  /**
   * Create a new workflow definition
   */
  async createWorkflowDefinition(
    request: CreateWorkflowDefinitionRequest,
    createdBy: UUID
  ): Promise<WorkflowDefinition> {
    try {
      // Validate the workflow definition
      await this.validator.validateWorkflowDefinition(request);

      // Check for name conflicts
      const existingWorkflow = await this.findWorkflowByName(request.name);
      if (existingWorkflow) {
        throw new Error(`Workflow with name '${request.name}' already exists`);
      }

      // Create the workflow definition
      const workflowResult = await db.query(`
        INSERT INTO workflow_definitions (
          name, description, device_types, service_types, customer_tiers, 
          status, version, created_by, metadata
        )
        VALUES ($1, $2, $3, $4, $5, 'draft', 1, $6, $7)
        RETURNING *
      `, [
        request.name,
        request.description,
        JSON.stringify(request.deviceTypes),
        JSON.stringify(request.serviceTypes),
        JSON.stringify(request.customerTiers),
        createdBy,
        JSON.stringify(request.metadata || {})
      ]);

      const workflow = workflowResult.rows[0];

      // Create workflow steps
      const steps = await this.createWorkflowSteps(workflow.id, request.steps);

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        deviceTypes: workflow.device_types,
        serviceTypes: workflow.service_types,
        customerTiers: workflow.customer_tiers,
        status: workflow.status,
        version: workflow.version,
        steps,
        metadata: workflow.metadata,
        createdBy: workflow.created_by,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at
      };
    } catch (error) {
      console.error('Create workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Get workflow definition by ID
   */
  async getWorkflowDefinition(id: UUID): Promise<WorkflowDefinition | null> {
    try {
      const workflowResult = await db.query(`
        SELECT wd.*, u.full_name as created_by_name
        FROM workflow_definitions wd
        LEFT JOIN users u ON wd.created_by = u.id
        WHERE wd.id = $1
      `, [id]);

      if (workflowResult.rows.length === 0) {
        return null;
      }

      const workflow = workflowResult.rows[0];

      // Get workflow steps with transitions
      const steps = await this.getWorkflowSteps(id);

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        deviceTypes: workflow.device_types,
        serviceTypes: workflow.service_types,
        customerTiers: workflow.customer_tiers,
        status: workflow.status,
        version: workflow.version,
        steps,
        metadata: workflow.metadata,
        createdBy: workflow.created_by,
        createdByName: workflow.created_by_name,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at
      };
    } catch (error) {
      console.error('Get workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Update workflow definition
   */
  async updateWorkflowDefinition(
    id: UUID,
    request: UpdateWorkflowDefinitionRequest,
    updatedBy: UUID
  ): Promise<WorkflowDefinition> {
    try {
      const existingWorkflow = await this.getWorkflowDefinition(id);
      if (!existingWorkflow) {
        throw new Error('Workflow definition not found');
      }

      // Check if workflow is active and create new version if needed
      if (existingWorkflow.status === 'active') {
        return await this.createNewVersion(id, request, updatedBy);
      }

      // Validate the updated workflow
      const updatedWorkflow = { ...existingWorkflow, ...request };
      await this.validator.validateWorkflowDefinition(updatedWorkflow);

      // Update workflow definition
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (request.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(request.name);
      }

      if (request.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(request.description);
      }

      if (request.deviceTypes !== undefined) {
        updates.push(`device_types = $${paramCount++}`);
        values.push(JSON.stringify(request.deviceTypes));
      }

      if (request.serviceTypes !== undefined) {
        updates.push(`service_types = $${paramCount++}`);
        values.push(JSON.stringify(request.serviceTypes));
      }

      if (request.customerTiers !== undefined) {
        updates.push(`customer_tiers = $${paramCount++}`);
        values.push(JSON.stringify(request.customerTiers));
      }

      if (request.metadata !== undefined) {
        updates.push(`metadata = $${paramCount++}`);
        values.push(JSON.stringify(request.metadata));
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      await db.query(`
        UPDATE workflow_definitions 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
      `, values);

      // Update steps if provided
      if (request.steps) {
        await this.updateWorkflowSteps(id, request.steps);
      }

      return await this.getWorkflowDefinition(id) as WorkflowDefinition;
    } catch (error) {
      console.error('Update workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Delete workflow definition
   */
  async deleteWorkflowDefinition(id: UUID): Promise<void> {
    try {
      const workflow = await this.getWorkflowDefinition(id);
      if (!workflow) {
        throw new Error('Workflow definition not found');
      }

      // Check if workflow is being used
      const usageCount = await this.checkWorkflowUsage(id);
      if (usageCount > 0) {
        throw new Error('Cannot delete workflow definition that is in use');
      }

      // Delete workflow (cascade will handle steps and transitions)
      await db.query('DELETE FROM workflow_definitions WHERE id = $1', [id]);
    } catch (error) {
      console.error('Delete workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Get workflow definitions with filtering
   */
  async getWorkflowDefinitions(filters: WorkflowDefinitionFilters = {}): Promise<{
    workflows: WorkflowDefinition[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        deviceType,
        serviceType,
        customerTier,
        status,
        createdBy,
        createdAfter,
        createdBefore
      } = filters;

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      // Build WHERE conditions
      if (search) {
        conditions.push(`(wd.name ILIKE $${paramCount} OR wd.description ILIKE $${paramCount})`);
        params.push(`%${search}%`);
        paramCount++;
      }

      if (deviceType) {
        conditions.push(`wd.device_types::jsonb ? $${paramCount}`);
        params.push(deviceType);
        paramCount++;
      }

      if (serviceType) {
        conditions.push(`wd.service_types::jsonb ? $${paramCount}`);
        params.push(serviceType);
        paramCount++;
      }

      if (customerTier) {
        conditions.push(`wd.customer_tiers::jsonb ? $${paramCount}`);
        params.push(customerTier);
        paramCount++;
      }

      if (status) {
        conditions.push(`wd.status = $${paramCount}`);
        params.push(status);
        paramCount++;
      }

      if (createdBy) {
        conditions.push(`wd.created_by = $${paramCount}`);
        params.push(createdBy);
        paramCount++;
      }

      if (createdAfter) {
        conditions.push(`wd.created_at > $${paramCount}`);
        params.push(createdAfter);
        paramCount++;
      }

      if (createdBefore) {
        conditions.push(`wd.created_at < $${paramCount}`);
        params.push(createdBefore);
        paramCount++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM workflow_definitions wd
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get workflows
      const workflowsQuery = `
        SELECT 
          wd.*,
          u.full_name as created_by_name,
          (SELECT COUNT(*) FROM workflow_instances wi WHERE wi.workflow_definition_id = wd.id) as usage_count
        FROM workflow_definitions wd
        LEFT JOIN users u ON wd.created_by = u.id
        ${whereClause}
        ORDER BY wd.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      params.push(limit, offset);
      const workflowsResult = await db.query(workflowsQuery, params);

      const workflows = await Promise.all(
        workflowsResult.rows.map(async (row) => {
          const steps = await this.getWorkflowSteps(row.id);
          return {
            id: row.id,
            name: row.name,
            description: row.description,
            deviceTypes: row.device_types,
            serviceTypes: row.service_types,
            customerTiers: row.customer_tiers,
            status: row.status,
            version: row.version,
            steps,
            metadata: row.metadata,
            createdBy: row.created_by,
            createdByName: row.created_by_name,
            usageCount: parseInt(row.usage_count),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        })
      );

      return {
        workflows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get workflow definitions error:', error);
      throw error;
    }
  }

  /**
   * Activate workflow definition
   */
  async activateWorkflowDefinition(id: UUID, activatedBy: UUID): Promise<void> {
    try {
      const workflow = await this.getWorkflowDefinition(id);
      if (!workflow) {
        throw new Error('Workflow definition not found');
      }

      if (workflow.status === 'active') {
        throw new Error('Workflow is already active');
      }

      // Validate workflow before activation
      await this.validator.validateWorkflowForActivation(workflow);

      // Activate workflow
      await db.query(`
        UPDATE workflow_definitions 
        SET status = 'active', updated_at = NOW()
        WHERE id = $1
      `, [id]);

      // Log activation
      await this.logWorkflowEvent(id, 'activated', { activatedBy });
    } catch (error) {
      console.error('Activate workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Archive workflow definition
   */
  async archiveWorkflowDefinition(id: UUID, archivedBy: UUID): Promise<void> {
    try {
      const workflow = await this.getWorkflowDefinition(id);
      if (!workflow) {
        throw new Error('Workflow definition not found');
      }

      // Check for active instances
      const activeInstancesCount = await this.getActiveInstancesCount(id);
      if (activeInstancesCount > 0) {
        throw new Error('Cannot archive workflow with active instances');
      }

      // Archive workflow
      await db.query(`
        UPDATE workflow_definitions 
        SET status = 'archived', updated_at = NOW()
        WHERE id = $1
      `, [id]);

      // Log archival
      await this.logWorkflowEvent(id, 'archived', { archivedBy });
    } catch (error) {
      console.error('Archive workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Clone workflow definition
   */
  async cloneWorkflowDefinition(
    id: UUID,
    newName: string,
    clonedBy: UUID
  ): Promise<WorkflowDefinition> {
    try {
      const originalWorkflow = await this.getWorkflowDefinition(id);
      if (!originalWorkflow) {
        throw new Error('Workflow definition not found');
      }

      // Create clone request
      const cloneRequest: CreateWorkflowDefinitionRequest = {
        name: newName,
        description: `Clone of ${originalWorkflow.name}`,
        deviceTypes: originalWorkflow.deviceTypes,
        serviceTypes: originalWorkflow.serviceTypes,
        customerTiers: originalWorkflow.customerTiers,
        steps: originalWorkflow.steps.map(step => ({
          name: step.name,
          description: step.description,
          type: step.type,
          position: step.position,
          config: step.config,
          transitions: step.transitions.map(transition => ({
            name: transition.name,
            targetStepName: transition.targetStepName,
            conditions: transition.conditions,
            actions: transition.actions
          }))
        })),
        metadata: { ...originalWorkflow.metadata, clonedFrom: id }
      };

      return await this.createWorkflowDefinition(cloneRequest, clonedBy);
    } catch (error) {
      console.error('Clone workflow definition error:', error);
      throw error;
    }
  }

  /**
   * Get workflow versions
   */
  async getWorkflowVersions(workflowId: UUID): Promise<WorkflowDefinition[]> {
    try {
      return await this.versionManager.getWorkflowVersions(workflowId);
    } catch (error) {
      console.error('Get workflow versions error:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async createWorkflowSteps(
    workflowId: UUID,
    stepDefinitions: WorkflowStepDefinition[]
  ): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = [];

    for (const stepDef of stepDefinitions) {
      // Create step
      const stepResult = await db.query(`
        INSERT INTO workflow_steps (
          workflow_definition_id, name, description, type, position, config
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        workflowId,
        stepDef.name,
        stepDef.description,
        stepDef.type,
        JSON.stringify(stepDef.position),
        JSON.stringify(stepDef.config)
      ]);

      const step = stepResult.rows[0];

      // Create transitions
      const transitions = await this.createWorkflowTransitions(step.id, stepDefinitions, stepDef.transitions);

      steps.push({
        id: step.id,
        workflowDefinitionId: step.workflow_definition_id,
        name: step.name,
        description: step.description,
        type: step.type,
        position: step.position,
        config: step.config,
        transitions,
        createdAt: step.created_at,
        updatedAt: step.updated_at
      });
    }

    return steps;
  }

  private async createWorkflowTransitions(
    stepId: UUID,
    allSteps: WorkflowStepDefinition[],
    transitionDefinitions: WorkflowTransitionDefinition[]
  ): Promise<WorkflowTransition[]> {
    const transitions: WorkflowTransition[] = [];

    for (const transitionDef of transitionDefinitions) {
      // Find target step
      const targetStep = allSteps.find(s => s.name === transitionDef.targetStepName);
      if (!targetStep) {
        throw new Error(`Target step '${transitionDef.targetStepName}' not found`);
      }

      const transitionResult = await db.query(`
        INSERT INTO workflow_transitions (
          from_step_id, to_step_name, name, conditions, actions
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        stepId,
        transitionDef.targetStepName,
        transitionDef.name,
        JSON.stringify(transitionDef.conditions || []),
        JSON.stringify(transitionDef.actions || [])
      ]);

      const transition = transitionResult.rows[0];

      transitions.push({
        id: transition.id,
        fromStepId: transition.from_step_id,
        toStepName: transition.to_step_name,
        name: transition.name,
        conditions: transition.conditions,
        actions: transition.actions,
        createdAt: transition.created_at,
        updatedAt: transition.updated_at
      });
    }

    return transitions;
  }

  private async getWorkflowSteps(workflowId: UUID): Promise<WorkflowStep[]> {
    const stepsResult = await db.query(`
      SELECT * FROM workflow_steps 
      WHERE workflow_definition_id = $1 
      ORDER BY created_at
    `, [workflowId]);

    const steps: WorkflowStep[] = [];

    for (const stepRow of stepsResult.rows) {
      const transitionsResult = await db.query(`
        SELECT * FROM workflow_transitions 
        WHERE from_step_id = $1 
        ORDER BY created_at
      `, [stepRow.id]);

      const transitions = transitionsResult.rows.map(t => ({
        id: t.id,
        fromStepId: t.from_step_id,
        toStepName: t.to_step_name,
        name: t.name,
        conditions: t.conditions,
        actions: t.actions,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      steps.push({
        id: stepRow.id,
        workflowDefinitionId: stepRow.workflow_definition_id,
        name: stepRow.name,
        description: stepRow.description,
        type: stepRow.type,
        position: stepRow.position,
        config: stepRow.config,
        transitions,
        createdAt: stepRow.created_at,
        updatedAt: stepRow.updated_at
      });
    }

    return steps;
  }

  private async updateWorkflowSteps(
    workflowId: UUID,
    stepDefinitions: WorkflowStepDefinition[]
  ): Promise<void> {
    // Delete existing steps (cascade will handle transitions)
    await db.query('DELETE FROM workflow_steps WHERE workflow_definition_id = $1', [workflowId]);
    
    // Create new steps
    await this.createWorkflowSteps(workflowId, stepDefinitions);
  }

  private async findWorkflowByName(name: string): Promise<any> {
    const result = await db.query('SELECT * FROM workflow_definitions WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  private async checkWorkflowUsage(workflowId: UUID): Promise<number> {
    const result = await db.query(`
      SELECT COUNT(*) as count 
      FROM workflow_instances 
      WHERE workflow_definition_id = $1
    `, [workflowId]);
    return parseInt(result.rows[0].count);
  }

  private async getActiveInstancesCount(workflowId: UUID): Promise<number> {
    const result = await db.query(`
      SELECT COUNT(*) as count 
      FROM workflow_instances 
      WHERE workflow_definition_id = $1 AND status IN ('running', 'waiting', 'suspended')
    `, [workflowId]);
    return parseInt(result.rows[0].count);
  }

  private async createNewVersion(
    originalId: UUID,
    request: UpdateWorkflowDefinitionRequest,
    updatedBy: UUID
  ): Promise<WorkflowDefinition> {
    return await this.versionManager.createNewVersion(originalId, request, updatedBy);
  }

  private async logWorkflowEvent(workflowId: UUID, eventType: string, data: any): Promise<void> {
    try {
      await db.query(`
        INSERT INTO workflow_events (workflow_definition_id, event_type, event_data)
        VALUES ($1, $2, $3)
      `, [workflowId, eventType, JSON.stringify(data)]);
    } catch (error) {
      console.error('Log workflow event error:', error);
    }
  }
}