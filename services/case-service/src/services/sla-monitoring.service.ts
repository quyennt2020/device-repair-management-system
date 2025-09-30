import { db } from '@drms/shared-database';
import { UUID, CaseStatus, Priority, SLAStatus } from '@drms/shared-types';
import { config } from '../config';
import { WorkflowIntegrationService, CaseEscalationContext } from './workflow-integration.service';
import { NotificationService } from './notification.service';

export interface SLAConfiguration {
  id: UUID;
  name: string;
  customerTier: string;
  serviceType: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  escalationRules: SLAEscalationRule[];
  penaltyRules: SLAPenaltyRule[];
  isActive: boolean;
}

export interface SLAEscalationRule {
  level: number;
  triggerAfterHours: number;
  escalationType: 'warning' | 'critical' | 'breach';
  notifyRoles: string[];
  actions: string[];
}

export interface SLAPenaltyRule {
  breachType: 'response' | 'resolution';
  penaltyPercentage: number;
  maxPenaltyAmount?: number;
  gracePeriodHours?: number;
}

export interface SLAMonitoringResult {
  caseId: UUID;
  slaStatus: SLAStatus;
  escalationTriggered: boolean;
  escalationLevel?: number;
  nextCheckTime?: Date;
}

export class SLAMonitoringService {
  private workflowIntegration: WorkflowIntegrationService;
  private notificationService: NotificationService;

  constructor() {
    this.workflowIntegration = new WorkflowIntegrationService();
    this.notificationService = new NotificationService();
  }

  /**
   * Monitor SLA compliance for all active cases
   */
  async monitorSLACompliance(): Promise<SLAMonitoringResult[]> {
    try {
      if (!config.sla.enableSLAMonitoring) {
        return [];
      }

      const activeCases = await this.getActiveCasesForSLAMonitoring();
      const results: SLAMonitoringResult[] = [];

      for (const caseData of activeCases) {
        try {
          const result = await this.checkCaseSLACompliance(caseData);
          results.push(result);

          if (result.escalationTriggered) {
            await this.handleSLAEscalation(caseData, result);
          }
        } catch (error) {
          console.error('Error checking SLA for case:', caseData.id, error);
        }
      }

      return results;
    } catch (error) {
      console.error('SLA monitoring error:', error);
      return [];
    }
  }

  /**
   * Check SLA compliance for a specific case
   */
  async checkCaseSLACompliance(caseData: any): Promise<SLAMonitoringResult> {
    try {
      const slaConfig = await this.getSLAConfiguration(caseData);
      if (!slaConfig) {
        return {
          caseId: caseData.id,
          slaStatus: {
            caseId: caseData.id,
            slaId: null,
            responseTimeTarget: 0,
            resolutionTimeTarget: 0,
            status: 'met',
          } as SLAStatus,
          escalationTriggered: false
        };
      }

      const now = new Date();
      const createdAt = new Date(caseData.created_at);
      const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      // Check response time SLA
      const responseTimeStatus = this.checkResponseTimeSLA(caseData, slaConfig, hoursElapsed);
      
      // Check resolution time SLA
      const resolutionTimeStatus = this.checkResolutionTimeSLA(caseData, slaConfig, hoursElapsed);

      // Determine overall SLA status
      const overallStatus = this.determineOverallSLAStatus(responseTimeStatus, resolutionTimeStatus);

      // Check if escalation should be triggered
      const escalationResult = await this.checkEscalationTriggers(caseData, slaConfig, hoursElapsed);

      const slaStatus: SLAStatus = {
        caseId: caseData.id,
        slaId: slaConfig.id,
        responseTimeTarget: slaConfig.responseTimeHours,
        responseTimeActual: responseTimeStatus.actualHours,
        resolutionTimeTarget: slaConfig.resolutionTimeHours,
        resolutionTimeActual: resolutionTimeStatus.actualHours,
        status: overallStatus,
        breachReason: responseTimeStatus.breached ? 'Response time exceeded' : 
                     resolutionTimeStatus.breached ? 'Resolution time exceeded' : undefined,
        penaltyAmount: await this.calculatePenalty(caseData, slaConfig, responseTimeStatus, resolutionTimeStatus)
      };

      return {
        caseId: caseData.id,
        slaStatus,
        escalationTriggered: escalationResult.shouldEscalate,
        escalationLevel: escalationResult.level,
        nextCheckTime: escalationResult.nextCheckTime
      };

    } catch (error) {
      console.error('Check case SLA compliance error:', error);
      throw error;
    }
  }

  /**
   * Handle SLA escalation
   */
  private async handleSLAEscalation(caseData: any, monitoringResult: SLAMonitoringResult): Promise<void> {
    try {
      if (!config.sla.escalationEnabled) {
        return;
      }

      const escalationContext: CaseEscalationContext = {
        caseId: caseData.id,
        currentStatus: caseData.status,
        slaBreachType: this.determineSLABreachType(monitoringResult.slaStatus),
        hoursOverdue: this.calculateHoursOverdue(caseData, monitoringResult.slaStatus),
        assignedTechnicianId: caseData.assigned_technician_id,
        priority: caseData.priority
      };

      // Trigger workflow escalation
      await this.workflowIntegration.handleCaseEscalation(escalationContext);

      // Send escalation notifications
      await this.sendEscalationNotifications(caseData, monitoringResult);

      // Log escalation event
      await this.logSLAEscalation(caseData.id, monitoringResult);

      // Update case with escalation information
      await this.updateCaseEscalationInfo(caseData.id, monitoringResult);

    } catch (error) {
      console.error('Handle SLA escalation error:', error);
    }
  }

  /**
   * Get SLA configuration for a case
   */
  private async getSLAConfiguration(caseData: any): Promise<SLAConfiguration | null> {
    try {
      // First try to get SLA from case's workflow configuration
      if (caseData.workflow_configuration_id) {
        const result = await db.query(`
          SELECT sla.* FROM sla_configurations sla
          JOIN workflow_configurations wc ON sla.id = wc.sla_id
          WHERE wc.id = $1 AND sla.is_active = true
        `, [caseData.workflow_configuration_id]);

        if (result.rows.length > 0) {
          return this.mapSLAConfiguration(result.rows[0]);
        }
      }

      // Fallback to default SLA based on customer tier and service type
      const result = await db.query(`
        SELECT * FROM sla_configurations
        WHERE customer_tier = $1 
          AND service_type = $2 
          AND is_active = true
        ORDER BY priority DESC
        LIMIT 1
      `, [caseData.customer_tier || 'standard', caseData.service_type || 'repair']);

      if (result.rows.length > 0) {
        return this.mapSLAConfiguration(result.rows[0]);
      }

      return null;
    } catch (error) {
      console.error('Get SLA configuration error:', error);
      return null;
    }
  }

  /**
   * Get active cases that need SLA monitoring
   */
  private async getActiveCasesForSLAMonitoring(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          rc.*,
          c.tier as customer_tier,
          wc.service_type
        FROM repair_cases rc
        LEFT JOIN customers c ON rc.customer_id = c.id
        LEFT JOIN workflow_configurations wc ON rc.workflow_configuration_id = wc.id
        WHERE rc.status NOT IN ('completed', 'cancelled')
          AND rc.deleted_at IS NULL
          AND (rc.last_sla_check IS NULL OR rc.last_sla_check < NOW() - INTERVAL '${config.sla.checkIntervalMinutes} minutes')
        ORDER BY rc.priority DESC, rc.created_at ASC
      `);

      return result.rows;
    } catch (error) {
      console.error('Get active cases for SLA monitoring error:', error);
      return [];
    }
  }

  /**
   * Check response time SLA
   */
  private checkResponseTimeSLA(caseData: any, slaConfig: SLAConfiguration, hoursElapsed: number): {
    breached: boolean;
    actualHours?: number;
    targetHours: number;
  } {
    const targetHours = slaConfig.responseTimeHours;
    
    // Check if case has been responded to (assigned or in progress)
    const hasResponded = caseData.status !== 'created' && caseData.status !== 'open';
    
    if (hasResponded) {
      // Calculate actual response time
      const firstResponseTime = caseData.assigned_at || caseData.updated_at;
      const actualHours = firstResponseTime ? 
        (new Date(firstResponseTime).getTime() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60) : 
        undefined;
      
      return {
        breached: actualHours ? actualHours > targetHours : false,
        actualHours,
        targetHours
      };
    }

    // Case hasn't been responded to yet
    return {
      breached: hoursElapsed > targetHours,
      targetHours
    };
  }

  /**
   * Check resolution time SLA
   */
  private checkResolutionTimeSLA(caseData: any, slaConfig: SLAConfiguration, hoursElapsed: number): {
    breached: boolean;
    actualHours?: number;
    targetHours: number;
  } {
    const targetHours = slaConfig.resolutionTimeHours;
    
    if (caseData.status === 'completed') {
      // Case is completed, calculate actual resolution time
      const actualHours = caseData.completed_at ? 
        (new Date(caseData.completed_at).getTime() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60) : 
        hoursElapsed;
      
      return {
        breached: actualHours > targetHours,
        actualHours,
        targetHours
      };
    }

    // Case is not completed yet
    return {
      breached: hoursElapsed > targetHours,
      targetHours
    };
  }

  /**
   * Determine overall SLA status
   */
  private determineOverallSLAStatus(responseStatus: any, resolutionStatus: any): 'met' | 'at_risk' | 'breached' {
    if (responseStatus.breached || resolutionStatus.breached) {
      return 'breached';
    }

    // Check if approaching breach (80% of time elapsed)
    const responseRisk = responseStatus.actualHours ? 
      (responseStatus.actualHours / responseStatus.targetHours) > 0.8 : false;
    const resolutionRisk = resolutionStatus.actualHours ? 
      (resolutionStatus.actualHours / resolutionStatus.targetHours) > 0.8 : false;

    if (responseRisk || resolutionRisk) {
      return 'at_risk';
    }

    return 'met';
  }

  /**
   * Check escalation triggers
   */
  private async checkEscalationTriggers(caseData: any, slaConfig: SLAConfiguration, hoursElapsed: number): Promise<{
    shouldEscalate: boolean;
    level?: number;
    nextCheckTime?: Date;
  }> {
    try {
      // Get last escalation level for this case
      const lastEscalationResult = await db.query(`
        SELECT escalation_level FROM case_escalations
        WHERE case_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [caseData.id]);

      const lastEscalationLevel = lastEscalationResult.rows[0]?.escalation_level || 0;

      // Check each escalation rule
      for (const rule of slaConfig.escalationRules) {
        if (rule.level > lastEscalationLevel && hoursElapsed >= rule.triggerAfterHours) {
          return {
            shouldEscalate: true,
            level: rule.level,
            nextCheckTime: new Date(Date.now() + config.sla.checkIntervalMinutes * 60 * 1000)
          };
        }
      }

      return {
        shouldEscalate: false,
        nextCheckTime: new Date(Date.now() + config.sla.checkIntervalMinutes * 60 * 1000)
      };
    } catch (error) {
      console.error('Check escalation triggers error:', error);
      return { shouldEscalate: false };
    }
  }

  /**
   * Calculate penalty amount
   */
  private async calculatePenalty(
    caseData: any, 
    slaConfig: SLAConfiguration, 
    responseStatus: any, 
    resolutionStatus: any
  ): Promise<number> {
    try {
      if (!config.sla.penaltyCalculationEnabled) {
        return 0;
      }

      let totalPenalty = 0;

      for (const penaltyRule of slaConfig.penaltyRules) {
        let breached = false;
        let breachHours = 0;

        if (penaltyRule.breachType === 'response' && responseStatus.breached) {
          breached = true;
          breachHours = responseStatus.actualHours - responseStatus.targetHours;
        } else if (penaltyRule.breachType === 'resolution' && resolutionStatus.breached) {
          breached = true;
          breachHours = (resolutionStatus.actualHours || 0) - resolutionStatus.targetHours;
        }

        if (breached && breachHours > (penaltyRule.gracePeriodHours || 0)) {
          // Calculate penalty based on case value or fixed amount
          const caseValue = caseData.estimated_value || 1000; // Default case value
          const penalty = (caseValue * penaltyRule.penaltyPercentage) / 100;
          
          const cappedPenalty = penaltyRule.maxPenaltyAmount ? 
            Math.min(penalty, penaltyRule.maxPenaltyAmount) : penalty;
          
          totalPenalty += cappedPenalty;
        }
      }

      return totalPenalty;
    } catch (error) {
      console.error('Calculate penalty error:', error);
      return 0;
    }
  }

  /**
   * Helper methods
   */
  private determineSLABreachType(slaStatus: SLAStatus): 'warning' | 'critical' | 'breach' {
    if (slaStatus.status === 'breached') {
      return 'breach';
    } else if (slaStatus.status === 'at_risk') {
      return 'warning';
    }
    return 'warning';
  }

  private calculateHoursOverdue(caseData: any, slaStatus: SLAStatus): number {
    const now = new Date();
    const createdAt = new Date(caseData.created_at);
    const hoursElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    const targetHours = Math.min(
      slaStatus.responseTimeTarget || Infinity,
      slaStatus.resolutionTimeTarget || Infinity
    );
    
    return Math.max(0, hoursElapsed - targetHours);
  }

  private async sendEscalationNotifications(caseData: any, monitoringResult: SLAMonitoringResult): Promise<void> {
    try {
      await this.notificationService.sendSLAEscalationNotification(
        caseData.id,
        monitoringResult.escalationLevel || 1,
        monitoringResult.slaStatus
      );
    } catch (error) {
      console.error('Send escalation notifications error:', error);
    }
  }

  private async logSLAEscalation(caseId: UUID, monitoringResult: SLAMonitoringResult): Promise<void> {
    try {
      await db.query(`
        INSERT INTO case_escalations (
          case_id, escalation_level, escalation_type, sla_status, created_at
        )
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        caseId,
        monitoringResult.escalationLevel,
        this.determineSLABreachType(monitoringResult.slaStatus),
        JSON.stringify(monitoringResult.slaStatus)
      ]);
    } catch (error) {
      console.error('Log SLA escalation error:', error);
    }
  }

  private async updateCaseEscalationInfo(caseId: UUID, monitoringResult: SLAMonitoringResult): Promise<void> {
    try {
      await db.query(`
        UPDATE repair_cases 
        SET 
          last_sla_check = NOW(),
          sla_status = $1,
          escalation_level = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [
        monitoringResult.slaStatus.status,
        monitoringResult.escalationLevel,
        caseId
      ]);
    } catch (error) {
      console.error('Update case escalation info error:', error);
    }
  }

  private mapSLAConfiguration(row: any): SLAConfiguration {
    return {
      id: row.id,
      name: row.name,
      customerTier: row.customer_tier,
      serviceType: row.service_type,
      responseTimeHours: row.response_time_hours,
      resolutionTimeHours: row.resolution_time_hours,
      escalationRules: row.escalation_rules || [],
      penaltyRules: row.penalty_rules || [],
      isActive: row.is_active
    };
  }
}