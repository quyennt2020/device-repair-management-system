import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';
import { WorkflowEventService } from './workflow-event.service';
import { config } from '../config';

export interface AlertRule {
  id: UUID;
  name: string;
  description: string;
  type: 'timeout' | 'error' | 'performance' | 'stuck' | 'custom';
  conditions: AlertCondition[];
  actions: AlertAction[];
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  createdBy: UUID;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertCondition {
  field: string;
  operator: string;
  value: any;
  timeWindow?: number; // minutes
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'notification' | 'auto_action';
  config: any;
}

export interface Alert {
  id: UUID;
  ruleId: UUID;
  ruleName: string;
  workflowInstanceId: UUID;
  stepInstanceId?: UUID;
  severity: string;
  message: string;
  details: any;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: UUID;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export class WorkflowAlertingService {
  private eventService: WorkflowEventService;

  constructor() {
    this.eventService = new WorkflowEventService();
  }

  /**
   * Create a new alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    try {
      const result = await db.query(`
        INSERT INTO workflow_alert_rules (
          name, description, type, conditions, actions, is_active, 
          severity, cooldown_minutes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        rule.name,
        rule.description,
        rule.type,
        JSON.stringify(rule.conditions),
        JSON.stringify(rule.actions),
        rule.isActive,
        rule.severity,
        rule.cooldownMinutes,
        rule.createdBy
      ]);

      return this.mapAlertRule(result.rows[0]);
    } catch (error) {
      console.error('Create alert rule error:', error);
      throw error;
    }
  }

  /**
   * Get all alert rules
   */
  async getAlertRules(): Promise<AlertRule[]> {
    try {
      const result = await db.query(`
        SELECT * FROM workflow_alert_rules 
        ORDER BY created_at DESC
      `);

      return result.rows.map(row => this.mapAlertRule(row));
    } catch (error) {
      console.error('Get alert rules error:', error);
      throw error;
    }
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(id: UUID, updates: Partial<AlertRule>): Promise<AlertRule> {
    try {
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

      if (updates.conditions !== undefined) {
        setClause.push(`conditions = $${paramCount++}`);
        values.push(JSON.stringify(updates.conditions));
      }

      if (updates.actions !== undefined) {
        setClause.push(`actions = $${paramCount++}`);
        values.push(JSON.stringify(updates.actions));
      }

      if (updates.isActive !== undefined) {
        setClause.push(`is_active = $${paramCount++}`);
        values.push(updates.isActive);
      }

      if (updates.severity !== undefined) {
        setClause.push(`severity = $${paramCount++}`);
        values.push(updates.severity);
      }

      if (updates.cooldownMinutes !== undefined) {
        setClause.push(`cooldown_minutes = $${paramCount++}`);
        values.push(updates.cooldownMinutes);
      }

      setClause.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(`
        UPDATE workflow_alert_rules 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Alert rule not found');
      }

      return this.mapAlertRule(result.rows[0]);
    } catch (error) {
      console.error('Update alert rule error:', error);
      throw error;
    }
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(id: UUID): Promise<void> {
    try {
      const result = await db.query(`
        DELETE FROM workflow_alert_rules WHERE id = $1
      `, [id]);

      if (result.rowCount === 0) {
        throw new Error('Alert rule not found');
      }
    } catch (error) {
      console.error('Delete alert rule error:', error);
      throw error;
    }
  }

  /**
   * Check all active alert rules and trigger alerts
   */
  async checkAlertRules(): Promise<void> {
    try {
      const activeRules = await db.query(`
        SELECT * FROM workflow_alert_rules 
        WHERE is_active = true
      `);

      for (const ruleRow of activeRules.rows) {
        const rule = this.mapAlertRule(ruleRow);
        await this.evaluateAlertRule(rule);
      }
    } catch (error) {
      console.error('Check alert rules error:', error);
    }
  }

  /**
   * Evaluate a specific alert rule
   */
  async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      const matches = await this.findRuleMatches(rule);

      for (const match of matches) {
        // Check if alert already exists and is within cooldown period
        const existingAlert = await this.findExistingAlert(rule.id, match.workflowInstanceId, match.stepInstanceId);
        
        if (existingAlert && this.isInCooldown(existingAlert, rule.cooldownMinutes)) {
          continue;
        }

        // Create new alert
        await this.createAlert({
          ruleId: rule.id,
          ruleName: rule.name,
          workflowInstanceId: match.workflowInstanceId,
          stepInstanceId: match.stepInstanceId,
          severity: rule.severity,
          message: match.message,
          details: match.details
        });

        // Execute alert actions
        await this.executeAlertActions(rule.actions, match);
      }
    } catch (error) {
      console.error('Evaluate alert rule error:', error);
    }
  }

  /**
   * Create a new alert
   */
  async createAlert(alert: Omit<Alert, 'id' | 'status' | 'createdAt'>): Promise<Alert> {
    try {
      const result = await db.query(`
        INSERT INTO workflow_alerts (
          rule_id, rule_name, workflow_instance_id, step_instance_id,
          severity, message, details, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING *
      `, [
        alert.ruleId,
        alert.ruleName,
        alert.workflowInstanceId,
        alert.stepInstanceId,
        alert.severity,
        alert.message,
        JSON.stringify(alert.details)
      ]);

      return this.mapAlert(result.rows[0]);
    } catch (error) {
      console.error('Create alert error:', error);
      throw error;
    }
  }

  /**
   * Get alerts with filtering
   */
  async getAlerts(filters: {
    workflowInstanceId?: UUID;
    severity?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    alerts: Alert[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        workflowInstanceId,
        severity,
        status,
        page = 1,
        limit = 50
      } = filters;

      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];
      let paramCount = 1;

      if (workflowInstanceId) {
        conditions.push(`workflow_instance_id = $${paramCount++}`);
        params.push(workflowInstanceId);
      }

      if (severity) {
        conditions.push(`severity = $${paramCount++}`);
        params.push(severity);
      }

      if (status) {
        conditions.push(`status = $${paramCount++}`);
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total FROM workflow_alerts ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get alerts
      const alertsResult = await db.query(`
        SELECT 
          wa.*,
          u_ack.full_name as acknowledged_by_name
        FROM workflow_alerts wa
        LEFT JOIN users u_ack ON wa.acknowledged_by = u_ack.id
        ${whereClause}
        ORDER BY wa.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...params, limit, offset]);

      const alerts = alertsResult.rows.map(row => ({
        ...this.mapAlert(row),
        acknowledgedByName: row.acknowledged_by_name
      }));

      return {
        alerts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get alerts error:', error);
      throw error;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: UUID, userId: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_alerts 
        SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW()
        WHERE id = $2
      `, [userId, alertId]);
    } catch (error) {
      console.error('Acknowledge alert error:', error);
      throw error;
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: UUID): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_alerts 
        SET status = 'resolved', resolved_at = NOW()
        WHERE id = $1
      `, [alertId]);
    } catch (error) {
      console.error('Resolve alert error:', error);
      throw error;
    }
  }  /
**
   * Private helper methods
   */
  private async findRuleMatches(rule: AlertRule): Promise<any[]> {
    const matches = [];

    try {
      switch (rule.type) {
        case 'timeout':
          const timeoutMatches = await this.findTimeoutMatches(rule);
          matches.push(...timeoutMatches);
          break;

        case 'error':
          const errorMatches = await this.findErrorMatches(rule);
          matches.push(...errorMatches);
          break;

        case 'performance':
          const performanceMatches = await this.findPerformanceMatches(rule);
          matches.push(...performanceMatches);
          break;

        case 'stuck':
          const stuckMatches = await this.findStuckMatches(rule);
          matches.push(...stuckMatches);
          break;

        case 'custom':
          const customMatches = await this.findCustomMatches(rule);
          matches.push(...customMatches);
          break;
      }
    } catch (error) {
      console.error(`Find matches for rule ${rule.name} error:`, error);
    }

    return matches;
  }

  private async findTimeoutMatches(rule: AlertRule): Promise<any[]> {
    const matches = [];

    try {
      const result = await db.query(`
        SELECT 
          wi.id as workflow_instance_id,
          wsi.id as step_instance_id,
          wsi.step_name,
          wsi.activated_at,
          wsi.step_config,
          wd.name as workflow_name
        FROM workflow_step_instances wsi
        JOIN workflow_instances wi ON wsi.workflow_instance_id = wi.id
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        WHERE wsi.status = 'active'
          AND wsi.step_config->>'timeoutMinutes' IS NOT NULL
          AND wsi.activated_at < NOW() - (wsi.step_config->>'timeoutMinutes')::integer * INTERVAL '1 minute'
      `);

      for (const row of result.rows) {
        matches.push({
          workflowInstanceId: row.workflow_instance_id,
          stepInstanceId: row.step_instance_id,
          message: `Step '${row.step_name}' in workflow '${row.workflow_name}' has timed out`,
          details: {
            stepName: row.step_name,
            workflowName: row.workflow_name,
            activatedAt: row.activated_at,
            timeoutMinutes: row.step_config.timeoutMinutes
          }
        });
      }
    } catch (error) {
      console.error('Find timeout matches error:', error);
    }

    return matches;
  }

  private async findErrorMatches(rule: AlertRule): Promise<any[]> {
    const matches = [];

    try {
      const timeWindow = rule.conditions.find(c => c.field === 'timeWindow')?.value || 60; // minutes

      const result = await db.query(`
        SELECT 
          wi.id as workflow_instance_id,
          wsi.id as step_instance_id,
          wsi.step_name,
          wsi.error_message,
          wd.name as workflow_name
        FROM workflow_step_instances wsi
        JOIN workflow_instances wi ON wsi.workflow_instance_id = wi.id
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        WHERE wsi.status = 'failed'
          AND wsi.updated_at >= NOW() - INTERVAL '${timeWindow} minutes'
      `);

      for (const row of result.rows) {
        matches.push({
          workflowInstanceId: row.workflow_instance_id,
          stepInstanceId: row.step_instance_id,
          message: `Step '${row.step_name}' in workflow '${row.workflow_name}' has failed`,
          details: {
            stepName: row.step_name,
            workflowName: row.workflow_name,
            errorMessage: row.error_message
          }
        });
      }
    } catch (error) {
      console.error('Find error matches error:', error);
    }

    return matches;
  }

  private async findPerformanceMatches(rule: AlertRule): Promise<any[]> {
    const matches = [];

    try {
      const thresholdMinutes = rule.conditions.find(c => c.field === 'executionTime')?.value || 60;

      const result = await db.query(`
        SELECT 
          wi.id as workflow_instance_id,
          wi.started_at,
          wd.name as workflow_name,
          EXTRACT(EPOCH FROM (NOW() - wi.started_at))/60 as execution_minutes
        FROM workflow_instances wi
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        WHERE wi.status = 'running'
          AND wi.started_at < NOW() - INTERVAL '${thresholdMinutes} minutes'
      `);

      for (const row of result.rows) {
        matches.push({
          workflowInstanceId: row.workflow_instance_id,
          stepInstanceId: null,
          message: `Workflow '${row.workflow_name}' has been running for ${Math.round(row.execution_minutes)} minutes`,
          details: {
            workflowName: row.workflow_name,
            startedAt: row.started_at,
            executionMinutes: Math.round(row.execution_minutes),
            threshold: thresholdMinutes
          }
        });
      }
    } catch (error) {
      console.error('Find performance matches error:', error);
    }

    return matches;
  }

  private async findStuckMatches(rule: AlertRule): Promise<any[]> {
    const matches = [];

    try {
      const inactivityMinutes = rule.conditions.find(c => c.field === 'inactivityTime')?.value || 120;

      const result = await db.query(`
        SELECT 
          wi.id as workflow_instance_id,
          wd.name as workflow_name,
          COUNT(wsi.id) as active_steps,
          MAX(wsi.activated_at) as last_activity
        FROM workflow_instances wi
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        LEFT JOIN workflow_step_instances wsi ON wi.id = wsi.workflow_instance_id AND wsi.status = 'active'
        WHERE wi.status = 'running'
        GROUP BY wi.id, wd.name
        HAVING MAX(wsi.activated_at) < NOW() - INTERVAL '${inactivityMinutes} minutes'
           OR COUNT(wsi.id) = 0
      `);

      for (const row of result.rows) {
        matches.push({
          workflowInstanceId: row.workflow_instance_id,
          stepInstanceId: null,
          message: `Workflow '${row.workflow_name}' appears to be stuck with no recent activity`,
          details: {
            workflowName: row.workflow_name,
            activeSteps: parseInt(row.active_steps),
            lastActivity: row.last_activity,
            inactivityMinutes
          }
        });
      }
    } catch (error) {
      console.error('Find stuck matches error:', error);
    }

    return matches;
  }

  private async findCustomMatches(rule: AlertRule): Promise<any[]> {
    // Custom rule evaluation would be implemented here
    // For now, return empty array
    return [];
  }

  private async findExistingAlert(ruleId: UUID, workflowInstanceId: UUID, stepInstanceId?: UUID): Promise<Alert | null> {
    try {
      const result = await db.query(`
        SELECT * FROM workflow_alerts 
        WHERE rule_id = $1 
          AND workflow_instance_id = $2 
          AND ($3::uuid IS NULL OR step_instance_id = $3)
          AND status IN ('active', 'acknowledged')
        ORDER BY created_at DESC
        LIMIT 1
      `, [ruleId, workflowInstanceId, stepInstanceId]);

      return result.rows.length > 0 ? this.mapAlert(result.rows[0]) : null;
    } catch (error) {
      console.error('Find existing alert error:', error);
      return null;
    }
  }

  private isInCooldown(alert: Alert, cooldownMinutes: number): boolean {
    const now = new Date();
    const alertTime = new Date(alert.createdAt);
    const timeDiff = now.getTime() - alertTime.getTime();
    const cooldownMs = cooldownMinutes * 60 * 1000;
    
    return timeDiff < cooldownMs;
  }

  private async executeAlertActions(actions: AlertAction[], match: any): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAlertAction(action, match);
      } catch (error) {
        console.error('Execute alert action error:', error);
      }
    }
  }

  private async executeAlertAction(action: AlertAction, match: any): Promise<void> {
    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(action.config, match);
        break;
      
      case 'webhook':
        await this.sendWebhookAlert(action.config, match);
        break;
      
      case 'notification':
        await this.sendNotificationAlert(action.config, match);
        break;
      
      case 'auto_action':
        await this.executeAutoAction(action.config, match);
        break;
    }
  }

  private async sendEmailAlert(config: any, match: any): Promise<void> {
    // This would integrate with email service
    console.log('Sending email alert:', {
      to: config.recipients,
      subject: config.subject || 'Workflow Alert',
      message: match.message,
      details: match.details
    });
  }

  private async sendWebhookAlert(config: any, match: any): Promise<void> {
    try {
      await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify({
          message: match.message,
          details: match.details,
          workflowInstanceId: match.workflowInstanceId,
          stepInstanceId: match.stepInstanceId
        })
      });
    } catch (error) {
      console.error('Send webhook alert error:', error);
    }
  }

  private async sendNotificationAlert(config: any, match: any): Promise<void> {
    // This would integrate with notification service
    console.log('Sending notification alert:', {
      users: config.users,
      message: match.message,
      details: match.details
    });
  }

  private async executeAutoAction(config: any, match: any): Promise<void> {
    // This would execute automatic remediation actions
    console.log('Executing auto action:', {
      action: config.action,
      workflowInstanceId: match.workflowInstanceId,
      stepInstanceId: match.stepInstanceId
    });
  }

  private mapAlertRule(row: any): AlertRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      conditions: row.conditions,
      actions: row.actions,
      isActive: row.is_active,
      severity: row.severity,
      cooldownMinutes: row.cooldown_minutes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapAlert(row: any): Alert {
    return {
      id: row.id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      workflowInstanceId: row.workflow_instance_id,
      stepInstanceId: row.step_instance_id,
      severity: row.severity,
      message: row.message,
      details: row.details,
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };
  }

  /**
   * Create default alert rules
   */
  async createDefaultAlertRules(createdBy: UUID): Promise<void> {
    const defaultRules = [
      {
        name: 'Step Timeout Alert',
        description: 'Alert when a step exceeds its timeout',
        type: 'timeout' as const,
        conditions: [],
        actions: [
          {
            type: 'notification' as const,
            config: { users: ['admin'], message: 'Step timeout detected' }
          }
        ],
        isActive: true,
        severity: 'high' as const,
        cooldownMinutes: 30,
        createdBy
      },
      {
        name: 'Step Failure Alert',
        description: 'Alert when a step fails',
        type: 'error' as const,
        conditions: [
          { field: 'timeWindow', operator: 'equals', value: 60 }
        ],
        actions: [
          {
            type: 'notification' as const,
            config: { users: ['admin'], message: 'Step failure detected' }
          }
        ],
        isActive: true,
        severity: 'high' as const,
        cooldownMinutes: 15,
        createdBy
      },
      {
        name: 'Long Running Workflow Alert',
        description: 'Alert when a workflow runs longer than expected',
        type: 'performance' as const,
        conditions: [
          { field: 'executionTime', operator: 'greater_than', value: 240 } // 4 hours
        ],
        actions: [
          {
            type: 'notification' as const,
            config: { users: ['admin'], message: 'Long running workflow detected' }
          }
        ],
        isActive: true,
        severity: 'medium' as const,
        cooldownMinutes: 60,
        createdBy
      },
      {
        name: 'Stuck Workflow Alert',
        description: 'Alert when a workflow appears to be stuck',
        type: 'stuck' as const,
        conditions: [
          { field: 'inactivityTime', operator: 'greater_than', value: 120 } // 2 hours
        ],
        actions: [
          {
            type: 'notification' as const,
            config: { users: ['admin'], message: 'Stuck workflow detected' }
          }
        ],
        isActive: true,
        severity: 'high' as const,
        cooldownMinutes: 60,
        createdBy
      }
    ];

    for (const rule of defaultRules) {
      try {
        await this.createAlertRule(rule);
      } catch (error) {
        console.error('Create default alert rule error:', error);
      }
    }
  }
}