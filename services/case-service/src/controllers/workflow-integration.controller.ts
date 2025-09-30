import { Request, Response } from 'express';
import { WorkflowIntegrationService } from '../services/workflow-integration.service';
import { WorkflowEventHandlerService } from '../services/workflow-event-handler.service';
import { SLAMonitoringService } from '../services/sla-monitoring.service';
import { UUID, WorkflowEvent, StepResult } from '@drms/shared-types';

export class WorkflowIntegrationController {
  private workflowIntegration: WorkflowIntegrationService;
  private eventHandler: WorkflowEventHandlerService;
  private slaMonitoring: SLAMonitoringService;

  constructor() {
    this.workflowIntegration = new WorkflowIntegrationService();
    this.eventHandler = new WorkflowEventHandlerService();
    this.slaMonitoring = new SLAMonitoringService();
  }

  /**
   * Handle workflow events from workflow service
   */
  handleWorkflowEvent = async (req: Request, res: Response): Promise<void> => {
    try {
      const event: WorkflowEvent = req.body;

      if (!event.type || !event.payload) {
        res.status(400).json({
          success: false,
          error: 'Invalid workflow event format'
        });
        return;
      }

      await this.eventHandler.handleWorkflowEvent(event);

      res.json({
        success: true,
        message: 'Workflow event processed successfully'
      });
    } catch (error) {
      console.error('Handle workflow event error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process workflow event'
      });
    }
  };

  /**
   * Complete a workflow step
   */
  completeWorkflowStep = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;
      const { stepId, result, completedBy } = req.body;

      if (!stepId || !result) {
        res.status(400).json({
          success: false,
          error: 'stepId and result are required'
        });
        return;
      }

      const stepResult: StepResult = {
        stepId,
        status: result.status || 'completed',
        output: result.output,
        notes: result.notes,
        completedBy: completedBy || req.user?.id,
        completedAt: new Date()
      };

      await this.workflowIntegration.completeWorkflowStep({
        caseId: caseId as UUID,
        stepId,
        result: stepResult,
        completedBy: completedBy || req.user?.id
      });

      res.json({
        success: true,
        message: 'Workflow step completed successfully'
      });
    } catch (error) {
      console.error('Complete workflow step error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete workflow step'
      });
    }
  };

  /**
   * Get workflow status for a case
   */
  getWorkflowStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;

      const workflowStatus = await this.workflowIntegration.getWorkflowStatus(caseId as UUID);

      if (!workflowStatus) {
        res.status(404).json({
          success: false,
          error: 'No workflow found for this case'
        });
        return;
      }

      res.json({
        success: true,
        data: workflowStatus
      });
    } catch (error) {
      console.error('Get workflow status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow status'
      });
    }
  };

  /**
   * Get workflow instance details for a case
   */
  getWorkflowInstance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;

      const workflowInstance = await this.workflowIntegration.getWorkflowInstanceForCase(caseId as UUID);

      if (!workflowInstance) {
        res.status(404).json({
          success: false,
          error: 'No workflow instance found for this case'
        });
        return;
      }

      res.json({
        success: true,
        data: workflowInstance
      });
    } catch (error) {
      console.error('Get workflow instance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow instance'
      });
    }
  };

  /**
   * Trigger case escalation
   */
  triggerEscalation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;
      const { escalationType, reason } = req.body;

      // Get case data for escalation context
      const caseData = await this.getCaseData(caseId as UUID);
      if (!caseData) {
        res.status(404).json({
          success: false,
          error: 'Case not found'
        });
        return;
      }

      const escalationContext = {
        caseId: caseId as UUID,
        currentStatus: caseData.status,
        slaBreachType: escalationType || 'warning',
        hoursOverdue: this.calculateHoursOverdue(caseData),
        assignedTechnicianId: caseData.assigned_technician_id,
        priority: caseData.priority
      };

      await this.workflowIntegration.handleCaseEscalation(escalationContext);

      res.json({
        success: true,
        message: 'Case escalation triggered successfully'
      });
    } catch (error) {
      console.error('Trigger escalation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger escalation'
      });
    }
  };

  /**
   * Complete case with workflow closure
   */
  completeCase = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;
      const { completionData } = req.body;
      const completedBy = req.user?.id || 'system';

      await this.workflowIntegration.handleCaseCompletion(
        caseId as UUID,
        completionData || {},
        completedBy
      );

      res.json({
        success: true,
        message: 'Case completed successfully'
      });
    } catch (error) {
      console.error('Complete case error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to complete case'
      });
    }
  };

  /**
   * Check SLA compliance for a case
   */
  checkSLACompliance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;

      const caseData = await this.getCaseData(caseId as UUID);
      if (!caseData) {
        res.status(404).json({
          success: false,
          error: 'Case not found'
        });
        return;
      }

      const slaResult = await this.slaMonitoring.checkCaseSLACompliance(caseData);

      res.json({
        success: true,
        data: slaResult
      });
    } catch (error) {
      console.error('Check SLA compliance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check SLA compliance'
      });
    }
  };

  /**
   * Monitor SLA compliance for all active cases
   */
  monitorSLACompliance = async (req: Request, res: Response): Promise<void> => {
    try {
      const results = await this.slaMonitoring.monitorSLACompliance();

      res.json({
        success: true,
        data: {
          totalCasesChecked: results.length,
          escalationsTriggered: results.filter(r => r.escalationTriggered).length,
          results
        }
      });
    } catch (error) {
      console.error('Monitor SLA compliance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to monitor SLA compliance'
      });
    }
  };

  /**
   * Get workflow configuration for case criteria
   */
  getWorkflowConfiguration = async (req: Request, res: Response): Promise<void> => {
    try {
      const { deviceType, serviceType, customerTier, priority } = req.query;

      if (!deviceType || !serviceType || !customerTier) {
        res.status(400).json({
          success: false,
          error: 'deviceType, serviceType, and customerTier are required'
        });
        return;
      }

      const configuration = await this.workflowIntegration.selectWorkflowConfiguration({
        deviceTypeId: deviceType as string,
        serviceType: serviceType as string,
        customerTier: customerTier as string,
        priority: (priority as any) || 'medium'
      });

      if (!configuration) {
        res.status(404).json({
          success: false,
          error: 'No workflow configuration found for the given criteria'
        });
        return;
      }

      res.json({
        success: true,
        data: configuration
      });
    } catch (error) {
      console.error('Get workflow configuration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow configuration'
      });
    }
  };

  /**
   * Start workflow for existing case
   */
  startWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;
      const { deviceType, serviceType, customerTier, priority, customerId, deviceId } = req.body;

      if (!deviceType || !serviceType || !customerTier) {
        res.status(400).json({
          success: false,
          error: 'deviceType, serviceType, and customerTier are required'
        });
        return;
      }

      const workflowInstance = await this.workflowIntegration.startWorkflowForCase(caseId as UUID, {
        deviceType,
        serviceType,
        customerTier,
        priority: priority || 'medium',
        customerId: customerId || 'unknown',
        deviceId: deviceId || 'unknown'
      });

      if (!workflowInstance) {
        res.status(400).json({
          success: false,
          error: 'Failed to start workflow - no suitable configuration found'
        });
        return;
      }

      res.json({
        success: true,
        data: workflowInstance,
        message: 'Workflow started successfully'
      });
    } catch (error) {
      console.error('Start workflow error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start workflow'
      });
    }
  };

  /**
   * Handle workflow step ready notification from workflow service
   */
  handleStepReady = async (req: Request, res: Response): Promise<void> => {
    try {
      const { instanceId, stepId, stepConfig } = req.body;

      if (!instanceId || !stepId) {
        res.status(400).json({
          success: false,
          error: 'instanceId and stepId are required'
        });
        return;
      }

      await this.workflowIntegration.handleWorkflowStepReady(
        instanceId as UUID,
        stepId,
        stepConfig || {}
      );

      res.json({
        success: true,
        message: 'Workflow step ready handled successfully'
      });
    } catch (error) {
      console.error('Handle step ready error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to handle workflow step ready'
      });
    }
  };

  /**
   * Helper methods
   */
  private async getCaseData(caseId: UUID): Promise<any> {
    try {
      const { db } = await import('@drms/shared-database');
      const result = await db.query(`
        SELECT 
          rc.*,
          c.tier as customer_tier
        FROM repair_cases rc
        LEFT JOIN customers c ON rc.customer_id = c.id
        WHERE rc.id = $1
      `, [caseId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Get case data error:', error);
      return null;
    }
  }

  private calculateHoursOverdue(caseData: any): number {
    const now = new Date();
    const slaDueDate = new Date(caseData.sla_due_date);
    
    if (now <= slaDueDate) {
      return 0;
    }

    return (now.getTime() - slaDueDate.getTime()) / (1000 * 60 * 60);
  }
}