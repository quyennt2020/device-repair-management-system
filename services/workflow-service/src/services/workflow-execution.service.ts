import { db } from '@drms/shared-database';
import { 
  WorkflowInstance, 
  WorkflowStepInstance, 
  WorkflowDefinition,
  WorkflowCondition,
  UUID 
} from '@drms/shared-types';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowEventService } from './workflow-event.service';
import { WorkflowConditionEvaluator } from '../utils/workflow-condition-evaluator';
import { WorkflowActionExecutor } from '../utils/workflow-action-executor';
import { config } from '../config';

export interface StartWorkflowRequest {
  workflowDefinitionId: UUID;
  caseId: UUID;
  context: any;
  startedBy: UUID;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ExecuteStepRequest {
  instanceId: UUID;
  stepInstanceId: UUID;
  action: string;
  data?: any;
  executedBy: UUID;
  comment?: string;
}

export interface WorkflowExecutionContext {
  caseId: UUID;
  customerId?: UUID;
  technicianId?: UUID;
  deviceId?: UUID;
  variables: Record<string, any>;
  metadata: any;
}

export class WorkflowExecutionService {
  private workflowDefinitionService: WorkflowDefinitionService;
  private eventService: WorkflowEventService;
  private conditionEvaluator: WorkflowConditionEvaluator;
  private actionExecutor: WorkflowActionExecutor;

  constructor() {
    this.workflowDefinitionService = new WorkflowDefinitionService();
    this.eventService = new WorkflowEventService();
    this.conditionEvaluator = new WorkflowConditionEvaluator();
    this.actionExecutor = new WorkflowActionExecutor();
  }

  /**
   * Start a new workflow instance
   */
  async startWorkflow(request: StartWorkflowRequest): Promise<WorkflowInstance> {
    try {
      // Get workflow definition
      const workflowDefinition = await this.workflowDefinitionService.getWorkflowDefinition(
        request.workflowDefinitionId
      );

      if (!workflowDefinition) {
        throw new Error('Workflow definition not found');
      }

      if (workflowDefinition.status !== 'active') {
        throw new Error('Cannot start inactive workflow');
      }

      // Create workflow instance
      const instanceResult = await db.query(`
        INSERT INTO workflow_instances (
          workflow_definition_id, case_id, status, priority, context, 
          started_by, started_at
        )
        VALUES ($1, $2, 'running', $3, $4, $5, NOW())
        RETURNING *
      `, [
        request.workflowDefinitionId,
        request.caseId,
        request.priority || 'normal',
        JSON.stringify(request.context),
        request.startedBy
      ]);

      const instance = instanceResult.rows[0];

      // Create step instances
      await this.createStepInstances(instance.id, workflowDefinition);

      // Find and activate start steps
      const startSteps = await this.findStartSteps(workflowDefinition);
      for (const startStep of startSteps) {
        await this.activateStep(instance.id, startStep.name, request.startedBy);
      }

      // Log workflow start
      await this.eventService.logWorkflowEvent(instance.id, 'workflow_started', {
        workflowDefinitionId: request.workflowDefinitionId,
        startedBy: request.startedBy,
        startSteps: startSteps.map(s => s.name)
      });

      return await this.getWorkflowInstance(instance.id) as WorkflowInstance;
    } catch (error) {
      console.error('Start workflow error:', error);
      throw error;
    }
  }

  /**
   * Execute a workflow step
   */
  async executeStep(request: ExecuteStepRequest): Promise<void> {
    try {
      const instance = await this.getWorkflowInstance(request.instanceId);
      if (!instance) {
        throw new Error('Workflow instance not found');
      }

      if (instance.status !== 'running') {
        throw new Error('Cannot execute step in non-running workflow');
      }

      const stepInstance = await this.getStepInstance(request.stepInstanceId);
      if (!stepInstance) {
        throw new Error('Step instance not found');
      }

      if (stepInstance.status !== 'active') {
        throw new Error('Cannot execute inactive step');
      }

      // Update step instance with execution data
      await db.query(`
        UPDATE workflow_step_instances 
        SET 
          status = 'completed',
          completed_at = NOW(),
          completed_by = $1,
          execution_data = $2,
          comment = $3
        WHERE id = $4
      `, [
        request.executedBy,
        JSON.stringify(request.data || {}),
        request.comment,
        request.stepInstanceId
      ]);

      // Log step execution
      await this.eventService.logStepEvent(
        request.instanceId,
        request.stepInstanceId,
        'step_completed',
        {
          action: request.action,
          executedBy: request.executedBy,
          data: request.data,
          comment: request.comment
        }
      );

      // Process transitions
      await this.processStepTransitions(
        request.instanceId,
        stepInstance.stepName,
        request.data || {},
        request.executedBy
      );

      // Check if workflow is complete
      await this.checkWorkflowCompletion(request.instanceId);

    } catch (error) {
      console.error('Execute step error:', error);
      
      // Log step execution failure
      await this.eventService.logStepEvent(
        request.instanceId,
        request.stepInstanceId,
        'step_execution_failed',
        {
          error: error.message,
          executedBy: request.executedBy
        }
      );

      throw error;
    }
  }

  /**
   * Get workflow instance with steps
   */
  async getWorkflowInstance(instanceId: UUID): Promise<WorkflowInstance | null> {
    try {
      const instanceResult = await db.query(`
        SELECT 
          wi.*,
          wd.name as workflow_name,
          wd.version as workflow_version,
          u.full_name as started_by_name
        FROM workflow_instances wi
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        LEFT JOIN users u ON wi.started_by = u.id
        WHERE wi.id = $1
      `, [instanceId]);

      if (instanceResult.rows.length === 0) {
        return null;
      }

      const instance = instanceResult.rows[0];

      // Get step instances
      const stepInstances = await this.getStepInstances(instanceId);

      return {
        id: instance.id,
        workflowDefinitionId: instance.workflow_definition_id,
        workflowName: instance.workflow_name,
        workflowVersion: instance.workflow_version,
        caseId: instance.case_id,
        status: instance.status,
        priority: instance.priority,
        context: instance.context,
        currentSteps: stepInstances.filter(s => s.status === 'active').map(s => s.stepName),
        stepInstances,
        startedBy: instance.started_by,
        startedByName: instance.started_by_name,
        startedAt: instance.started_at,
        completedAt: instance.completed_at,
        errorMessage: instance.error_message,
        createdAt: instance.created_at,
        updatedAt: instance.updated_at
      };
    } catch (error) {
      console.error('Get workflow instance error:', error);
      throw error;
    }
  }

  /**
   * Suspend workflow instance
   */
  async suspendWorkflow(instanceId: UUID, suspendedBy: UUID, reason?: string): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_instances 
        SET status = 'suspended', updated_at = NOW()
        WHERE id = $1
      `, [instanceId]);

      // Suspend all active steps
      await db.query(`
        UPDATE workflow_step_instances 
        SET status = 'suspended'
        WHERE workflow_instance_id = $1 AND status = 'active'
      `, [instanceId]);

      // Log suspension
      await this.eventService.logWorkflowEvent(instanceId, 'workflow_suspended', {
        suspendedBy,
        reason
      });
    } catch (error) {
      console.error('Suspend workflow error:', error);
      throw error;
    }
  }

  /**
   * Resume workflow instance
   */
  async resumeWorkflow(instanceId: UUID, resumedBy: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_instances 
        SET status = 'running', updated_at = NOW()
        WHERE id = $1
      `, [instanceId]);

      // Resume suspended steps
      await db.query(`
        UPDATE workflow_step_instances 
        SET status = 'active'
        WHERE workflow_instance_id = $1 AND status = 'suspended'
      `, [instanceId]);

      // Log resumption
      await this.eventService.logWorkflowEvent(instanceId, 'workflow_resumed', {
        resumedBy
      });
    } catch (error) {
      console.error('Resume workflow error:', error);
      throw error;
    }
  }

  /**
   * Cancel workflow instance
   */
  async cancelWorkflow(instanceId: UUID, cancelledBy: UUID, reason?: string): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_instances 
        SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [instanceId]);

      // Cancel all active steps
      await db.query(`
        UPDATE workflow_step_instances 
        SET status = 'cancelled'
        WHERE workflow_instance_id = $1 AND status IN ('active', 'suspended')
      `, [instanceId]);

      // Log cancellation
      await this.eventService.logWorkflowEvent(instanceId, 'workflow_cancelled', {
        cancelledBy,
        reason
      });
    } catch (error) {
      console.error('Cancel workflow error:', error);
      throw error;
    }
  }

  /**
   * Get workflow instances with filtering
   */
  async getWorkflowInstances(filters: {
    caseId?: UUID;
    workflowDefinitionId?: UUID;
    status?: string;
    priority?: string;
    startedBy?: UUID;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    instances: WorkflowInstance[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        caseId,
        workflowDefinitionId,
        status,
        priority,
        startedBy,
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (caseId) {
        conditions.push(`wi.case_id = $${paramCount++}`);
        params.push(caseId);
      }

      if (workflowDefinitionId) {
        conditions.push(`wi.workflow_definition_id = $${paramCount++}`);
        params.push(workflowDefinitionId);
      }

      if (status) {
        conditions.push(`wi.status = $${paramCount++}`);
        params.push(status);
      }

      if (priority) {
        conditions.push(`wi.priority = $${paramCount++}`);
        params.push(priority);
      }

      if (startedBy) {
        conditions.push(`wi.started_by = $${paramCount++}`);
        params.push(startedBy);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total
        FROM workflow_instances wi
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get instances
      const instancesResult = await db.query(`
        SELECT 
          wi.*,
          wd.name as workflow_name,
          wd.version as workflow_version,
          u.full_name as started_by_name
        FROM workflow_instances wi
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        LEFT JOIN users u ON wi.started_by = u.id
        ${whereClause}
        ORDER BY wi.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...params, limit, offset]);

      const instances = await Promise.all(
        instancesResult.rows.map(async (row) => {
          const stepInstances = await this.getStepInstances(row.id);
          return {
            id: row.id,
            workflowDefinitionId: row.workflow_definition_id,
            workflowName: row.workflow_name,
            workflowVersion: row.workflow_version,
            caseId: row.case_id,
            status: row.status,
            priority: row.priority,
            context: row.context,
            currentSteps: stepInstances.filter(s => s.status === 'active').map(s => s.stepName),
            stepInstances,
            startedBy: row.started_by,
            startedByName: row.started_by_name,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            errorMessage: row.error_message,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        })
      );

      return {
        instances,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get workflow instances error:', error);
      throw error;
    }
  } 
 /**
   * Private helper methods
   */
  private async createStepInstances(instanceId: UUID, workflowDefinition: WorkflowDefinition): Promise<void> {
    for (const step of workflowDefinition.steps) {
      await db.query(`
        INSERT INTO workflow_step_instances (
          workflow_instance_id, step_name, step_type, step_config, status
        )
        VALUES ($1, $2, $3, $4, 'pending')
      `, [
        instanceId,
        step.name,
        step.type,
        JSON.stringify(step.config)
      ]);
    }
  }

  private async findStartSteps(workflowDefinition: WorkflowDefinition): Promise<any[]> {
    // Find steps that have no incoming transitions
    const stepsWithIncoming = new Set<string>();
    
    workflowDefinition.steps.forEach(step => {
      step.transitions.forEach(transition => {
        stepsWithIncoming.add(transition.toStepName);
      });
    });

    return workflowDefinition.steps.filter(step => !stepsWithIncoming.has(step.name));
  }

  private async activateStep(instanceId: UUID, stepName: string, activatedBy: UUID): Promise<void> {
    await db.query(`
      UPDATE workflow_step_instances 
      SET 
        status = 'active',
        activated_at = NOW(),
        activated_by = $1
      WHERE workflow_instance_id = $2 AND step_name = $3
    `, [activatedBy, instanceId, stepName]);

    // Log step activation
    await this.eventService.logStepEvent(instanceId, null, 'step_activated', {
      stepName,
      activatedBy
    });

    // Check for automatic step execution
    await this.checkAutomaticExecution(instanceId, stepName);
  }

  private async checkAutomaticExecution(instanceId: UUID, stepName: string): Promise<void> {
    const stepInstance = await this.getStepInstanceByName(instanceId, stepName);
    if (!stepInstance) return;

    const stepConfig = stepInstance.stepConfig;

    // Handle automatic steps
    if (stepInstance.stepType === 'automatic') {
      await this.executeAutomaticStep(instanceId, stepInstance);
    }
    
    // Handle wait steps with timeout
    else if (stepInstance.stepType === 'wait' && stepConfig.timeoutMinutes) {
      await this.scheduleStepTimeout(instanceId, stepInstance.id, stepConfig.timeoutMinutes);
    }

    // Check auto-advance conditions
    if (stepConfig.autoAdvanceConditions && stepConfig.autoAdvanceConditions.length > 0) {
      const context = await this.getWorkflowContext(instanceId);
      const shouldAdvance = await this.conditionEvaluator.evaluateConditions(
        stepConfig.autoAdvanceConditions,
        context
      );

      if (shouldAdvance) {
        await this.executeStep({
          instanceId,
          stepInstanceId: stepInstance.id,
          action: 'auto_advance',
          executedBy: 'system'
        });
      }
    }
  }

  private async executeAutomaticStep(instanceId: UUID, stepInstance: any): Promise<void> {
    try {
      const context = await this.getWorkflowContext(instanceId);
      
      // Execute automatic step logic based on configuration
      const result = await this.actionExecutor.executeAutomaticStep(stepInstance, context);

      // Complete the step
      await this.executeStep({
        instanceId,
        stepInstanceId: stepInstance.id,
        action: 'automatic_execution',
        data: result,
        executedBy: 'system'
      });

    } catch (error) {
      console.error('Automatic step execution error:', error);
      
      // Mark step as failed
      await db.query(`
        UPDATE workflow_step_instances 
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [error.message, stepInstance.id]);

      // Log failure
      await this.eventService.logStepEvent(instanceId, stepInstance.id, 'step_failed', {
        error: error.message
      });
    }
  }

  private async processStepTransitions(
    instanceId: UUID,
    fromStepName: string,
    executionData: any,
    executedBy: UUID
  ): Promise<void> {
    // Get workflow definition to find transitions
    const instance = await this.getWorkflowInstance(instanceId);
    if (!instance) return;

    const workflowDefinition = await this.workflowDefinitionService.getWorkflowDefinition(
      instance.workflowDefinitionId
    );
    if (!workflowDefinition) return;

    const fromStep = workflowDefinition.steps.find(s => s.name === fromStepName);
    if (!fromStep) return;

    const context = await this.getWorkflowContext(instanceId);
    context.variables = { ...context.variables, ...executionData };

    // Process each transition
    for (const transition of fromStep.transitions) {
      let shouldTransition = true;

      // Evaluate transition conditions
      if (transition.conditions && transition.conditions.length > 0) {
        shouldTransition = await this.conditionEvaluator.evaluateConditions(
          transition.conditions,
          context
        );
      }

      if (shouldTransition) {
        // Execute transition actions
        if (transition.actions && transition.actions.length > 0) {
          await this.actionExecutor.executeActions(transition.actions, context);
        }

        // Activate target step
        await this.activateStep(instanceId, transition.toStepName, executedBy);

        // Log transition
        await this.eventService.logWorkflowEvent(instanceId, 'transition_executed', {
          fromStep: fromStepName,
          toStep: transition.toStepName,
          transitionName: transition.name,
          executedBy
        });
      }
    }
  }

  private async checkWorkflowCompletion(instanceId: UUID): Promise<void> {
    // Check if all steps are completed or if we've reached end steps
    const activeSteps = await db.query(`
      SELECT COUNT(*) as count
      FROM workflow_step_instances
      WHERE workflow_instance_id = $1 AND status = 'active'
    `, [instanceId]);

    const activeCount = parseInt(activeSteps.rows[0].count);

    if (activeCount === 0) {
      // No active steps, workflow is complete
      await db.query(`
        UPDATE workflow_instances 
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
      `, [instanceId]);

      // Log completion
      await this.eventService.logWorkflowEvent(instanceId, 'workflow_completed', {
        completedAt: new Date().toISOString()
      });
    }
  }

  private async getStepInstances(instanceId: UUID): Promise<WorkflowStepInstance[]> {
    const result = await db.query(`
      SELECT 
        wsi.*,
        u_activated.full_name as activated_by_name,
        u_completed.full_name as completed_by_name
      FROM workflow_step_instances wsi
      LEFT JOIN users u_activated ON wsi.activated_by = u_activated.id
      LEFT JOIN users u_completed ON wsi.completed_by = u_completed.id
      WHERE wsi.workflow_instance_id = $1
      ORDER BY wsi.created_at
    `, [instanceId]);

    return result.rows.map(row => ({
      id: row.id,
      workflowInstanceId: row.workflow_instance_id,
      stepName: row.step_name,
      stepType: row.step_type,
      stepConfig: row.step_config,
      status: row.status,
      activatedBy: row.activated_by,
      activatedByName: row.activated_by_name,
      activatedAt: row.activated_at,
      completedBy: row.completed_by,
      completedByName: row.completed_by_name,
      completedAt: row.completed_at,
      executionData: row.execution_data,
      comment: row.comment,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  private async getStepInstance(stepInstanceId: UUID): Promise<any> {
    const result = await db.query(`
      SELECT * FROM workflow_step_instances WHERE id = $1
    `, [stepInstanceId]);

    return result.rows[0] || null;
  }

  private async getStepInstanceByName(instanceId: UUID, stepName: string): Promise<any> {
    const result = await db.query(`
      SELECT * FROM workflow_step_instances 
      WHERE workflow_instance_id = $1 AND step_name = $2
    `, [instanceId, stepName]);

    return result.rows[0] || null;
  }

  private async getWorkflowContext(instanceId: UUID): Promise<WorkflowExecutionContext> {
    const instance = await this.getWorkflowInstance(instanceId);
    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    // Get case data for context
    const caseResult = await db.query(`
      SELECT customer_id, assigned_technician_id, device_id
      FROM repair_cases
      WHERE id = $1
    `, [instance.caseId]);

    const caseData = caseResult.rows[0] || {};

    return {
      caseId: instance.caseId,
      customerId: caseData.customer_id,
      technicianId: caseData.assigned_technician_id,
      deviceId: caseData.device_id,
      variables: instance.context?.variables || {},
      metadata: instance.context?.metadata || {}
    };
  }

  private async scheduleStepTimeout(instanceId: UUID, stepInstanceId: UUID, timeoutMinutes: number): Promise<void> {
    // This would integrate with a job scheduler (like Bull, Agenda, etc.)
    // For now, we'll just log the timeout scheduling
    await this.eventService.logStepEvent(instanceId, stepInstanceId, 'timeout_scheduled', {
      timeoutMinutes,
      timeoutAt: new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString()
    });
  }
}