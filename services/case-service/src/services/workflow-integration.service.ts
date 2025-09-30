import { UUID, CaseStatus, Priority, WorkflowConfiguration, WorkflowInstance, StepResult } from '@drms/shared-types';
import { db } from '@drms/shared-database';
import { config } from '../config';

export interface WorkflowStartRequest {
  deviceType: string;
  serviceType: string;
  customerTier: string;
  priority: Priority;
  customerId: UUID;
  deviceId: UUID;
}

export interface WorkflowConfigurationCriteria {
  deviceTypeId: string;
  serviceType: string;
  customerTier: string;
  priority: Priority;
  additionalContext?: Record<string, any>;
}

export interface WorkflowStepCompletionRequest {
  caseId: UUID;
  stepId: string;
  result: StepResult;
  completedBy: UUID;
}

export interface CaseEscalationContext {
  caseId: UUID;
  currentStatus: CaseStatus;
  slaBreachType: 'warning' | 'critical' | 'breach';
  hoursOverdue: number;
  assignedTechnicianId?: UUID;
  priority: Priority;
}

export class WorkflowIntegrationService {
  /**
   * Determine and select the best workflow configuration for a case
   */
  async selectWorkflowConfiguration(criteria: WorkflowConfigurationCriteria): Promise<WorkflowConfiguration | null> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return null;
      }

      const response = await this.makeWorkflowServiceRequest('/api/workflow-configuration/select', {
        method: 'POST',
        body: JSON.stringify({
          deviceType: criteria.deviceTypeId,
          serviceType: criteria.serviceType,
          customerTier: criteria.customerTier,
          additionalContext: {
            priority: criteria.priority,
            ...criteria.additionalContext
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to select workflow configuration:', response.statusText);
        return null;
      }

      const result = await response.json();
      return result.configuration || null;
    } catch (error) {
      console.error('Workflow configuration selection error:', error);
      return null;
    }
  }

  /**
   * Start workflow for a new case with configuration selection
   */
  async startWorkflowForCase(caseId: UUID, request: WorkflowStartRequest): Promise<WorkflowInstance | null> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return null;
      }

      // First, select the appropriate workflow configuration
      const workflowConfig = await this.selectWorkflowConfiguration({
        deviceTypeId: request.deviceType,
        serviceType: request.serviceType,
        customerTier: request.customerTier,
        priority: request.priority,
        additionalContext: {
          customerId: request.customerId,
          deviceId: request.deviceId
        }
      });

      if (!workflowConfig) {
        console.warn('No workflow configuration found for case:', caseId);
        return null;
      }

      // Start the workflow instance
      const response = await this.makeWorkflowServiceRequest('/api/workflow/start', {
        method: 'POST',
        body: JSON.stringify({
          workflowDefinitionId: workflowConfig.workflowDefinitionId,
          caseId,
          context: {
            deviceType: request.deviceType,
            serviceType: request.serviceType,
            customerTier: request.customerTier,
            priority: request.priority,
            customerId: request.customerId,
            deviceId: request.deviceId,
            configurationId: workflowConfig.id,
            variables: {},
            metadata: {
              startedBy: 'case-service',
              startedAt: new Date().toISOString(),
              configurationUsed: workflowConfig.name
            }
          },
          startedBy: 'system'
        })
      });

      if (!response.ok) {
        console.error('Failed to start workflow for case:', caseId, response.statusText);
        return null;
      }

      const workflowInstance = await response.json();

      // Store workflow configuration reference in case
      await this.updateCaseWorkflowInfo(caseId, workflowConfig.id, workflowInstance.id);

      return workflowInstance;
    } catch (error) {
      console.error('Workflow start error:', error);
      return null;
    }
  }

  /**
   * Handle case status changes and notify workflow
   */
  async handleCaseStatusChange(caseId: UUID, newStatus: CaseStatus, updatedBy: UUID): Promise<void> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return;
      }

      const workflowInstance = await this.getWorkflowInstanceForCase(caseId);
      if (!workflowInstance) {
        return;
      }

      const response = await this.makeWorkflowServiceRequest('/api/workflow/case-event', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: workflowInstance.id,
          eventType: 'case_status_changed',
          eventData: {
            caseId,
            oldStatus: workflowInstance.context?.caseStatus,
            newStatus,
            updatedBy,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to notify workflow of status change:', caseId, response.statusText);
      }
    } catch (error) {
      console.error('Workflow status change notification error:', error);
    }
  }

  /**
   * Handle workflow step completion from case service
   */
  async completeWorkflowStep(request: WorkflowStepCompletionRequest): Promise<void> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return;
      }

      const workflowInstance = await this.getWorkflowInstanceForCase(request.caseId);
      if (!workflowInstance) {
        console.warn('No active workflow found for case:', request.caseId);
        return;
      }

      const response = await this.makeWorkflowServiceRequest('/api/workflow/step/complete', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: workflowInstance.id,
          stepId: request.stepId,
          result: request.result,
          completedBy: request.completedBy
        })
      });

      if (!response.ok) {
        console.error('Failed to complete workflow step:', request.stepId, response.statusText);
        throw new Error(`Workflow step completion failed: ${response.statusText}`);
      }

      // Log step completion in case timeline
      await this.logCaseWorkflowEvent(request.caseId, 'workflow_step_completed', {
        stepId: request.stepId,
        result: request.result,
        completedBy: request.completedBy
      });

    } catch (error) {
      console.error('Complete workflow step error:', error);
      throw error;
    }
  }

  /**
   * Handle workflow step ready event (workflow notifies case service)
   */
  async handleWorkflowStepReady(instanceId: UUID, stepId: string, stepConfig: any): Promise<void> {
    try {
      const caseId = await this.getCaseIdFromWorkflowInstance(instanceId);
      if (!caseId) {
        console.error('Cannot find case for workflow instance:', instanceId);
        return;
      }

      // Update case status based on step type
      await this.updateCaseStatusFromWorkflowStep(caseId, stepId, stepConfig);

      // Handle step-specific business logic
      await this.executeStepBusinessLogic(caseId, stepId, stepConfig);

      // Log workflow step activation
      await this.logCaseWorkflowEvent(caseId, 'workflow_step_ready', {
        stepId,
        stepConfig,
        instanceId
      });

    } catch (error) {
      console.error('Handle workflow step ready error:', error);
    }
  }

  /**
   * Handle case escalation with workflow integration
   */
  async handleCaseEscalation(context: CaseEscalationContext): Promise<void> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return;
      }

      const workflowInstance = await this.getWorkflowInstanceForCase(context.caseId);
      if (!workflowInstance) {
        // Create escalation workflow if no workflow exists
        await this.startEscalationWorkflow(context);
        return;
      }

      // Trigger escalation event in existing workflow
      const response = await this.makeWorkflowServiceRequest('/api/workflow/escalation', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: workflowInstance.id,
          escalationType: context.slaBreachType,
          escalationData: {
            caseId: context.caseId,
            currentStatus: context.currentStatus,
            hoursOverdue: context.hoursOverdue,
            assignedTechnicianId: context.assignedTechnicianId,
            priority: context.priority,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to trigger workflow escalation:', context.caseId, response.statusText);
      }

      // Log escalation event
      await this.logCaseWorkflowEvent(context.caseId, 'case_escalated', {
        escalationType: context.slaBreachType,
        hoursOverdue: context.hoursOverdue,
        workflowInstanceId: workflowInstance.id
      });

    } catch (error) {
      console.error('Handle case escalation error:', error);
    }
  }

  /**
   * Handle case completion and workflow closure
   */
  async handleCaseCompletion(caseId: UUID, completionData: any, completedBy: UUID): Promise<void> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return;
      }

      const workflowInstance = await this.getWorkflowInstanceForCase(caseId);
      if (!workflowInstance) {
        return;
      }

      // Validate case completion requirements
      const validationResult = await this.validateCaseCompletion(caseId, completionData);
      if (!validationResult.isValid) {
        throw new Error(`Case completion validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Complete the workflow
      const response = await this.makeWorkflowServiceRequest('/api/workflow/complete', {
        method: 'POST',
        body: JSON.stringify({
          instanceId: workflowInstance.id,
          completionData: {
            caseId,
            completedBy,
            completionTimestamp: new Date().toISOString(),
            ...completionData
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to complete workflow:', caseId, response.statusText);
        throw new Error(`Workflow completion failed: ${response.statusText}`);
      }

      // Perform cleanup tasks
      await this.performCaseCompletionCleanup(caseId, workflowInstance.id);

      // Log completion
      await this.logCaseWorkflowEvent(caseId, 'workflow_completed', {
        workflowInstanceId: workflowInstance.id,
        completedBy,
        completionData
      });

    } catch (error) {
      console.error('Handle case completion error:', error);
      throw error;
    }
  }

  /**
   * Get workflow status for a case
   */
  async getWorkflowStatus(caseId: UUID): Promise<{ status: string; currentStep?: string; instance?: WorkflowInstance } | null> {
    try {
      if (!config.integrations.enableWorkflowIntegration) {
        return null;
      }

      const workflowInstance = await this.getWorkflowInstanceForCase(caseId);
      if (!workflowInstance) {
        return null;
      }

      return {
        status: workflowInstance.status,
        currentStep: workflowInstance.currentSteps?.[0],
        instance: workflowInstance
      };
    } catch (error) {
      console.error('Get workflow status error:', error);
      return null;
    }
  }

  /**
   * Get workflow instance for a case
   */
  async getWorkflowInstanceForCase(caseId: UUID): Promise<WorkflowInstance | null> {
    try {
      const result = await db.query(`
        SELECT workflow_instance_id, workflow_configuration_id
        FROM repair_cases
        WHERE id = $1 AND workflow_instance_id IS NOT NULL
      `, [caseId]);

      if (result.rows.length === 0) {
        return null;
      }

      const instanceId = result.rows[0].workflow_instance_id;
      
      const response = await this.makeWorkflowServiceRequest(`/api/workflow/instance/${instanceId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Get workflow instance error:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async makeWorkflowServiceRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${config.integrations.workflowServiceUrl}${endpoint}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: config.integrations.workflowTimeout
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= config.integrations.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        return response;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Workflow service request attempt ${attempt} failed:`, error);
        
        if (attempt < config.integrations.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, config.integrations.retryDelay * attempt));
        }
      }
    }

    throw lastError || new Error('Workflow service request failed');
  }

  private async updateCaseWorkflowInfo(caseId: UUID, configurationId: UUID, instanceId: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE repair_cases 
        SET workflow_configuration_id = $1, workflow_instance_id = $2, updated_at = NOW()
        WHERE id = $3
      `, [configurationId, instanceId, caseId]);
    } catch (error) {
      console.error('Update case workflow info error:', error);
    }
  }

  private async getCaseIdFromWorkflowInstance(instanceId: UUID): Promise<UUID | null> {
    try {
      const result = await db.query(`
        SELECT id FROM repair_cases WHERE workflow_instance_id = $1
      `, [instanceId]);

      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      console.error('Get case ID from workflow instance error:', error);
      return null;
    }
  }

  private async updateCaseStatusFromWorkflowStep(caseId: UUID, stepId: string, stepConfig: any): Promise<void> {
    try {
      // Map workflow steps to case statuses
      const statusMapping: Record<string, CaseStatus> = {
        'registration': 'created',
        'device_inspection': 'in_progress',
        'quotation_approval': 'waiting_approval',
        'repair_execution': 'in_progress',
        'quality_check': 'in_progress',
        'delivery': 'in_progress',
        'completed': 'completed'
      };

      const newStatus = statusMapping[stepId];
      if (newStatus) {
        await db.query(`
          UPDATE repair_cases 
          SET status = $1, current_step_id = $2, updated_at = NOW()
          WHERE id = $3
        `, [newStatus, stepId, caseId]);
      }
    } catch (error) {
      console.error('Update case status from workflow step error:', error);
    }
  }

  private async executeStepBusinessLogic(caseId: UUID, stepId: string, stepConfig: any): Promise<void> {
    try {
      switch (stepId) {
        case 'device_inspection':
          await this.handleDeviceInspectionStep(caseId, stepConfig);
          break;
        case 'quotation_approval':
          await this.handleQuotationApprovalStep(caseId, stepConfig);
          break;
        case 'repair_execution':
          await this.handleRepairExecutionStep(caseId, stepConfig);
          break;
        case 'quality_check':
          await this.handleQualityCheckStep(caseId, stepConfig);
          break;
        case 'delivery':
          await this.handleDeliveryStep(caseId, stepConfig);
          break;
        default:
          // No specific business logic for this step
          break;
      }
    } catch (error) {
      console.error('Execute step business logic error:', error);
    }
  }

  private async handleDeviceInspectionStep(caseId: UUID, stepConfig: any): Promise<void> {
    // Auto-assign technician if required
    if (stepConfig.assignmentRules?.role === 'technician') {
      // This would integrate with technician assignment service
      console.log('Auto-assigning technician for device inspection:', caseId);
    }
  }

  private async handleQuotationApprovalStep(caseId: UUID, stepConfig: any): Promise<void> {
    // Send notification to customer for quotation approval
    console.log('Sending quotation approval notification:', caseId);
  }

  private async handleRepairExecutionStep(caseId: UUID, stepConfig: any): Promise<void> {
    // Reserve required parts and tools
    console.log('Reserving parts and tools for repair:', caseId);
  }

  private async handleQualityCheckStep(caseId: UUID, stepConfig: any): Promise<void> {
    // Assign quality inspector
    console.log('Assigning quality inspector:', caseId);
  }

  private async handleDeliveryStep(caseId: UUID, stepConfig: any): Promise<void> {
    // Schedule delivery
    console.log('Scheduling delivery:', caseId);
  }

  private async startEscalationWorkflow(context: CaseEscalationContext): Promise<void> {
    try {
      // Start a special escalation workflow
      const escalationWorkflowConfig = await this.selectWorkflowConfiguration({
        deviceTypeId: 'escalation',
        serviceType: 'escalation',
        customerTier: 'any',
        priority: context.priority,
        additionalContext: {
          escalationType: context.slaBreachType,
          originalCaseId: context.caseId
        }
      });

      if (escalationWorkflowConfig) {
        await this.startWorkflowForCase(context.caseId, {
          deviceType: 'escalation',
          serviceType: 'escalation',
          customerTier: 'any',
          priority: context.priority,
          customerId: 'system',
          deviceId: 'system'
        });
      }
    } catch (error) {
      console.error('Start escalation workflow error:', error);
    }
  }

  private async validateCaseCompletion(caseId: UUID, completionData: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if all required documents are completed
      const documentsResult = await db.query(`
        SELECT COUNT(*) as pending_count
        FROM case_documents cd
        WHERE cd.case_id = $1 AND cd.status IN ('draft', 'pending_approval')
      `, [caseId]);

      if (parseInt(documentsResult.rows[0].pending_count) > 0) {
        errors.push('Case has pending documents that need to be completed');
      }

      // Check if case has resolution
      const caseResult = await db.query(`
        SELECT resolution FROM repair_cases WHERE id = $1
      `, [caseId]);

      if (!caseResult.rows[0]?.resolution) {
        errors.push('Case must have a resolution before completion');
      }

      // Additional validation rules can be added here

    } catch (error) {
      console.error('Case completion validation error:', error);
      errors.push('Error validating case completion requirements');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async performCaseCompletionCleanup(caseId: UUID, workflowInstanceId: UUID): Promise<void> {
    try {
      // Release reserved resources
      await db.query(`
        UPDATE inventory_reservations 
        SET status = 'released', released_at = NOW()
        WHERE case_id = $1 AND status = 'reserved'
      `, [caseId]);

      // Update technician availability
      await db.query(`
        UPDATE technician_assignments 
        SET status = 'completed', completed_at = NOW()
        WHERE case_id = $1 AND status = 'active'
      `, [caseId]);

      // Archive workflow data if needed
      console.log('Performing cleanup for completed case:', caseId, 'workflow:', workflowInstanceId);

    } catch (error) {
      console.error('Case completion cleanup error:', error);
    }
  }

  private async logCaseWorkflowEvent(caseId: UUID, eventType: string, eventData: any): Promise<void> {
    try {
      await db.query(`
        INSERT INTO case_timeline (case_id, event_type, description, metadata, created_by)
        VALUES ($1, $2, $3, $4, 'system')
      `, [
        caseId,
        eventType,
        `Workflow event: ${eventType}`,
        JSON.stringify(eventData)
      ]);
    } catch (error) {
      console.error('Log case workflow event error:', error);
    }
  }
}