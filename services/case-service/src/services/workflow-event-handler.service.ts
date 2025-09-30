import { UUID, WorkflowEvent, CaseStatus } from '@drms/shared-types';
import { db } from '@drms/shared-database';
import { WorkflowIntegrationService } from './workflow-integration.service';
import { NotificationService } from './notification.service';
import { TechnicianAssignmentService } from './technician-assignment.service';

export interface WorkflowEventHandlerContext {
  caseId: UUID;
  workflowInstanceId: UUID;
  stepId?: string;
  eventData: any;
  timestamp: Date;
}

export class WorkflowEventHandlerService {
  private workflowIntegration: WorkflowIntegrationService;
  private notificationService: NotificationService;
  private technicianAssignment: TechnicianAssignmentService;

  constructor() {
    this.workflowIntegration = new WorkflowIntegrationService();
    this.notificationService = new NotificationService();
    this.technicianAssignment = new TechnicianAssignmentService();
  }

  /**
   * Handle workflow events from workflow service
   */
  async handleWorkflowEvent(event: WorkflowEvent): Promise<void> {
    try {
      const context = await this.buildEventContext(event);
      if (!context) {
        console.warn('Cannot build context for workflow event:', event.type);
        return;
      }

      switch (event.type) {
        case 'workflow_started':
          await this.handleWorkflowStarted(context);
          break;
        case 'step_activated':
          await this.handleStepActivated(context);
          break;
        case 'step_completed':
          await this.handleStepCompleted(context);
          break;
        case 'step_failed':
          await this.handleStepFailed(context);
          break;
        case 'workflow_completed':
          await this.handleWorkflowCompleted(context);
          break;
        case 'workflow_failed':
          await this.handleWorkflowFailed(context);
          break;
        case 'workflow_escalated':
          await this.handleWorkflowEscalated(context);
          break;
        case 'step_timeout':
          await this.handleStepTimeout(context);
          break;
        case 'assignment_required':
          await this.handleAssignmentRequired(context);
          break;
        case 'approval_required':
          await this.handleApprovalRequired(context);
          break;
        default:
          console.log('Unhandled workflow event type:', event.type);
          break;
      }

      // Log the event handling
      await this.logEventHandling(context, event.type, 'success');

    } catch (error) {
      console.error('Handle workflow event error:', error);
      await this.logEventHandling(
        await this.buildEventContext(event), 
        event.type, 
        'error', 
        error.message
      );
    }
  }

  /**
   * Handle workflow started event
   */
  private async handleWorkflowStarted(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      // Update case status to indicate workflow has started
      await db.query(`
        UPDATE repair_cases 
        SET 
          status = 'assigned',
          workflow_started_at = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [context.timestamp, context.caseId]);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_started',
        'Workflow process has been initiated',
        'system',
        { workflowInstanceId: context.workflowInstanceId }
      );

      // Send notification to assigned technician if any
      const caseData = await this.getCaseData(context.caseId);
      if (caseData.assigned_technician_id) {
        await this.notificationService.sendWorkflowStartedNotification(
          context.caseId,
          caseData.assigned_technician_id
        );
      }

    } catch (error) {
      console.error('Handle workflow started error:', error);
    }
  }

  /**
   * Handle step activated event
   */
  private async handleStepActivated(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const stepConfig = context.eventData.stepConfig || {};
      
      // Update case current step
      await db.query(`
        UPDATE repair_cases 
        SET 
          current_step_id = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [context.stepId, context.caseId]);

      // Handle step-specific activation logic
      await this.executeStepActivationLogic(context, stepConfig);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_step_activated',
        `Workflow step activated: ${context.stepId}`,
        'system',
        { stepId: context.stepId, stepConfig }
      );

      // Send notifications if required
      await this.sendStepActivationNotifications(context, stepConfig);

    } catch (error) {
      console.error('Handle step activated error:', error);
    }
  }

  /**
   * Handle step completed event
   */
  private async handleStepCompleted(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const completionData = context.eventData.completionData || {};
      
      // Update case status based on completed step
      const newStatus = this.mapStepToStatus(context.stepId, 'completed');
      if (newStatus) {
        await db.query(`
          UPDATE repair_cases 
          SET 
            status = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [newStatus, context.caseId]);
      }

      // Handle step-specific completion logic
      await this.executeStepCompletionLogic(context, completionData);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_step_completed',
        `Workflow step completed: ${context.stepId}`,
        completionData.completedBy || 'system',
        { stepId: context.stepId, completionData }
      );

      // Send completion notifications
      await this.sendStepCompletionNotifications(context, completionData);

    } catch (error) {
      console.error('Handle step completed error:', error);
    }
  }

  /**
   * Handle step failed event
   */
  private async handleStepFailed(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const failureData = context.eventData.failureData || {};
      
      // Update case status to indicate failure
      await db.query(`
        UPDATE repair_cases 
        SET 
          status = 'on_hold',
          updated_at = NOW()
        WHERE id = $1
      `, [context.caseId]);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_step_failed',
        `Workflow step failed: ${context.stepId} - ${failureData.reason || 'Unknown error'}`,
        'system',
        { stepId: context.stepId, failureData }
      );

      // Send failure notifications
      await this.sendStepFailureNotifications(context, failureData);

      // Trigger escalation if needed
      await this.triggerFailureEscalation(context, failureData);

    } catch (error) {
      console.error('Handle step failed error:', error);
    }
  }

  /**
   * Handle workflow completed event
   */
  private async handleWorkflowCompleted(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const completionData = context.eventData.completionData || {};
      
      // Update case to completed status
      await db.query(`
        UPDATE repair_cases 
        SET 
          status = 'completed',
          completed_at = $1,
          workflow_completed_at = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [context.timestamp, context.caseId]);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_completed',
        'Workflow process completed successfully',
        completionData.completedBy || 'system',
        { workflowInstanceId: context.workflowInstanceId, completionData }
      );

      // Perform completion tasks
      await this.performCaseCompletionTasks(context, completionData);

      // Send completion notifications
      await this.sendWorkflowCompletionNotifications(context, completionData);

    } catch (error) {
      console.error('Handle workflow completed error:', error);
    }
  }

  /**
   * Handle workflow failed event
   */
  private async handleWorkflowFailed(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const failureData = context.eventData.failureData || {};
      
      // Update case status
      await db.query(`
        UPDATE repair_cases 
        SET 
          status = 'on_hold',
          updated_at = NOW()
        WHERE id = $1
      `, [context.caseId]);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_failed',
        `Workflow process failed: ${failureData.reason || 'Unknown error'}`,
        'system',
        { workflowInstanceId: context.workflowInstanceId, failureData }
      );

      // Send failure notifications
      await this.sendWorkflowFailureNotifications(context, failureData);

      // Trigger escalation
      await this.triggerWorkflowFailureEscalation(context, failureData);

    } catch (error) {
      console.error('Handle workflow failed error:', error);
    }
  }

  /**
   * Handle workflow escalated event
   */
  private async handleWorkflowEscalated(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const escalationData = context.eventData.escalationData || {};
      
      // Update case escalation info
      await db.query(`
        UPDATE repair_cases 
        SET 
          escalation_level = $1,
          escalated_at = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [escalationData.level || 1, context.timestamp, context.caseId]);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_escalated',
        `Case escalated to level ${escalationData.level || 1}: ${escalationData.reason || 'SLA breach'}`,
        'system',
        { escalationData }
      );

      // Send escalation notifications
      await this.sendEscalationNotifications(context, escalationData);

    } catch (error) {
      console.error('Handle workflow escalated error:', error);
    }
  }

  /**
   * Handle step timeout event
   */
  private async handleStepTimeout(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const timeoutData = context.eventData.timeoutData || {};
      
      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'workflow_step_timeout',
        `Workflow step timed out: ${context.stepId}`,
        'system',
        { stepId: context.stepId, timeoutData }
      );

      // Send timeout notifications
      await this.sendStepTimeoutNotifications(context, timeoutData);

      // Trigger escalation for timeout
      await this.triggerTimeoutEscalation(context, timeoutData);

    } catch (error) {
      console.error('Handle step timeout error:', error);
    }
  }

  /**
   * Handle assignment required event
   */
  private async handleAssignmentRequired(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const assignmentData = context.eventData.assignmentData || {};
      
      // Auto-assign technician based on requirements
      const assignedTechnician = await this.technicianAssignment.autoAssignTechnician(
        context.caseId,
        {
          deviceType: assignmentData.deviceType,
          category: assignmentData.category,
          priority: assignmentData.priority,
          requiredSkills: assignmentData.requiredSkills,
          requiredCertifications: assignmentData.requiredCertifications,
          location: assignmentData.location
        }
      );

      if (assignedTechnician) {
        await db.query(`
          UPDATE repair_cases 
          SET 
            assigned_technician_id = $1,
            assigned_at = NOW(),
            updated_at = NOW()
          WHERE id = $2
        `, [assignedTechnician.id, context.caseId]);

        // Notify workflow of assignment
        await this.workflowIntegration.completeWorkflowStep({
          caseId: context.caseId,
          stepId: context.stepId || 'assignment',
          result: {
            stepId: context.stepId || 'assignment',
            status: 'completed',
            output: {
              assignedTechnicianId: assignedTechnician.id,
              assignedTechnicianName: assignedTechnician.name
            },
            completedBy: 'system',
            completedAt: new Date()
          },
          completedBy: 'system'
        });

        // Add timeline entry
        await this.addCaseTimelineEntry(
          context.caseId,
          'technician_auto_assigned',
          `Technician auto-assigned: ${assignedTechnician.name}`,
          'system',
          { technicianId: assignedTechnician.id, assignmentData }
        );
      } else {
        // No technician available, escalate
        await this.triggerAssignmentEscalation(context, assignmentData);
      }

    } catch (error) {
      console.error('Handle assignment required error:', error);
    }
  }

  /**
   * Handle approval required event
   */
  private async handleApprovalRequired(context: WorkflowEventHandlerContext): Promise<void> {
    try {
      const approvalData = context.eventData.approvalData || {};
      
      // Send approval notifications
      await this.sendApprovalRequiredNotifications(context, approvalData);

      // Add timeline entry
      await this.addCaseTimelineEntry(
        context.caseId,
        'approval_required',
        `Approval required for step: ${context.stepId}`,
        'system',
        { stepId: context.stepId, approvalData }
      );

    } catch (error) {
      console.error('Handle approval required error:', error);
    }
  }

  /**
   * Helper methods
   */
  private async buildEventContext(event: WorkflowEvent): Promise<WorkflowEventHandlerContext | null> {
    try {
      const workflowInstanceId = event.payload.instanceId || event.payload.workflowInstanceId;
      if (!workflowInstanceId) {
        return null;
      }

      // Get case ID from workflow instance
      const result = await db.query(`
        SELECT id FROM repair_cases WHERE workflow_instance_id = $1
      `, [workflowInstanceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        caseId: result.rows[0].id,
        workflowInstanceId,
        stepId: event.payload.stepId,
        eventData: event.payload,
        timestamp: event.timestamp
      };
    } catch (error) {
      console.error('Build event context error:', error);
      return null;
    }
  }

  private async getCaseData(caseId: UUID): Promise<any> {
    try {
      const result = await db.query(`
        SELECT * FROM repair_cases WHERE id = $1
      `, [caseId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Get case data error:', error);
      return null;
    }
  }

  private mapStepToStatus(stepId: string | undefined, action: string): CaseStatus | null {
    if (!stepId) return null;

    const statusMapping: Record<string, CaseStatus> = {
      'registration': 'created',
      'device_inspection': 'in_progress',
      'quotation_approval': 'waiting_approval',
      'repair_execution': 'in_progress',
      'quality_check': 'in_progress',
      'delivery': 'in_progress',
      'completed': 'completed'
    };

    return statusMapping[stepId] || null;
  }

  private async executeStepActivationLogic(context: WorkflowEventHandlerContext, stepConfig: any): Promise<void> {
    // Implement step-specific activation logic
    switch (context.stepId) {
      case 'device_inspection':
        await this.handleDeviceInspectionActivation(context, stepConfig);
        break;
      case 'quotation_approval':
        await this.handleQuotationApprovalActivation(context, stepConfig);
        break;
      // Add more step handlers as needed
    }
  }

  private async executeStepCompletionLogic(context: WorkflowEventHandlerContext, completionData: any): Promise<void> {
    // Implement step-specific completion logic
    switch (context.stepId) {
      case 'device_inspection':
        await this.handleDeviceInspectionCompletion(context, completionData);
        break;
      case 'repair_execution':
        await this.handleRepairExecutionCompletion(context, completionData);
        break;
      // Add more step handlers as needed
    }
  }

  private async handleDeviceInspectionActivation(context: WorkflowEventHandlerContext, stepConfig: any): Promise<void> {
    // Create inspection document template
    console.log('Creating inspection document for case:', context.caseId);
  }

  private async handleQuotationApprovalActivation(context: WorkflowEventHandlerContext, stepConfig: any): Promise<void> {
    // Send quotation to customer
    console.log('Sending quotation for approval:', context.caseId);
  }

  private async handleDeviceInspectionCompletion(context: WorkflowEventHandlerContext, completionData: any): Promise<void> {
    // Process inspection results
    console.log('Processing inspection results for case:', context.caseId);
  }

  private async handleRepairExecutionCompletion(context: WorkflowEventHandlerContext, completionData: any): Promise<void> {
    // Update inventory, record parts used
    console.log('Processing repair completion for case:', context.caseId);
  }

  private async performCaseCompletionTasks(context: WorkflowEventHandlerContext, completionData: any): Promise<void> {
    // Release resources, update metrics, etc.
    console.log('Performing completion tasks for case:', context.caseId);
  }

  private async sendStepActivationNotifications(context: WorkflowEventHandlerContext, stepConfig: any): Promise<void> {
    // Send notifications based on step requirements
  }

  private async sendStepCompletionNotifications(context: WorkflowEventHandlerContext, completionData: any): Promise<void> {
    // Send completion notifications
  }

  private async sendStepFailureNotifications(context: WorkflowEventHandlerContext, failureData: any): Promise<void> {
    // Send failure notifications
  }

  private async sendWorkflowCompletionNotifications(context: WorkflowEventHandlerContext, completionData: any): Promise<void> {
    // Send workflow completion notifications
  }

  private async sendWorkflowFailureNotifications(context: WorkflowEventHandlerContext, failureData: any): Promise<void> {
    // Send workflow failure notifications
  }

  private async sendEscalationNotifications(context: WorkflowEventHandlerContext, escalationData: any): Promise<void> {
    // Send escalation notifications
  }

  private async sendStepTimeoutNotifications(context: WorkflowEventHandlerContext, timeoutData: any): Promise<void> {
    // Send timeout notifications
  }

  private async sendApprovalRequiredNotifications(context: WorkflowEventHandlerContext, approvalData: any): Promise<void> {
    // Send approval required notifications
  }

  private async triggerFailureEscalation(context: WorkflowEventHandlerContext, failureData: any): Promise<void> {
    // Trigger escalation for step failure
  }

  private async triggerWorkflowFailureEscalation(context: WorkflowEventHandlerContext, failureData: any): Promise<void> {
    // Trigger escalation for workflow failure
  }

  private async triggerTimeoutEscalation(context: WorkflowEventHandlerContext, timeoutData: any): Promise<void> {
    // Trigger escalation for timeout
  }

  private async triggerAssignmentEscalation(context: WorkflowEventHandlerContext, assignmentData: any): Promise<void> {
    // Trigger escalation when no technician can be assigned
  }

  private async addCaseTimelineEntry(
    caseId: UUID,
    eventType: string,
    description: string,
    createdBy: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO case_timeline (case_id, event_type, description, created_by, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [caseId, eventType, description, createdBy, JSON.stringify(metadata || {})]);
    } catch (error) {
      console.error('Add case timeline entry error:', error);
    }
  }

  private async logEventHandling(
    context: WorkflowEventHandlerContext | null,
    eventType: string,
    status: 'success' | 'error',
    errorMessage?: string
  ): Promise<void> {
    try {
      if (!context) return;

      await db.query(`
        INSERT INTO workflow_event_handling_log (
          case_id, workflow_instance_id, event_type, status, error_message, handled_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        context.caseId,
        context.workflowInstanceId,
        eventType,
        status,
        errorMessage
      ]);
    } catch (error) {
      console.error('Log event handling error:', error);
    }
  }
}