import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';
import { WorkflowExecutionService } from './workflow-execution.service';
import { WorkflowEventService } from './workflow-event.service';

export interface WorkflowDiagnostics {
  instanceId: UUID;
  workflowName: string;
  status: string;
  issues: WorkflowIssue[];
  recommendations: string[];
  executionPath: ExecutionPathNode[];
  performanceMetrics: PerformanceMetrics;
  resourceUsage: ResourceUsage;
}

export interface WorkflowIssue {
  type: 'error' | 'warning' | 'info';
  category: 'performance' | 'logic' | 'data' | 'timeout' | 'resource';
  message: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedActions: string[];
}

export interface ExecutionPathNode {
  stepName: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  children: ExecutionPathNode[];
  issues: WorkflowIssue[];
}

export interface PerformanceMetrics {
  totalExecutionTime: number;
  averageStepTime: number;
  slowestSteps: { stepName: string; duration: number }[];
  bottlenecks: string[];
  throughput: number;
}

export interface ResourceUsage {
  memoryUsage: number;
  cpuUsage: number;
  databaseConnections: number;
  activeThreads: number;
}

export class WorkflowDebuggingService {
  private executionService: WorkflowExecutionService;
  private eventService: WorkflowEventService;

  constructor() {
    this.executionService = new WorkflowExecutionService();
    this.eventService = new WorkflowEventService();
  }

  /**
   * Get comprehensive diagnostics for a workflow instance
   */
  async getWorkflowDiagnostics(instanceId: UUID): Promise<WorkflowDiagnostics> {
    try {
      const instance = await this.executionService.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error('Workflow instance not found');
      }

      const [issues, executionPath, performanceMetrics, resourceUsage] = await Promise.all([
        this.analyzeWorkflowIssues(instanceId),
        this.buildExecutionPath(instanceId),
        this.calculatePerformanceMetrics(instanceId),
        this.getResourceUsage(instanceId)
      ]);

      const recommendations = this.generateRecommendations(issues, performanceMetrics);

      return {
        instanceId,
        workflowName: instance.workflowName,
        status: instance.status,
        issues,
        recommendations,
        executionPath,
        performanceMetrics,
        resourceUsage
      };
    } catch (error) {
      console.error('Get workflow diagnostics error:', error);
      throw error;
    }
  }

  /**
   * Analyze workflow for potential issues
   */
  async analyzeWorkflowIssues(instanceId: UUID): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    // Check for stuck workflows
    const stuckIssues = await this.checkForStuckWorkflow(instanceId);
    issues.push(...stuckIssues);

    // Check for performance issues
    const performanceIssues = await this.checkPerformanceIssues(instanceId);
    issues.push(...performanceIssues);

    // Check for data issues
    const dataIssues = await this.checkDataIssues(instanceId);
    issues.push(...dataIssues);

    // Check for timeout issues
    const timeoutIssues = await this.checkTimeoutIssues(instanceId);
    issues.push(...timeoutIssues);

    // Check for resource issues
    const resourceIssues = await this.checkResourceIssues(instanceId);
    issues.push(...resourceIssues);

    return issues.sort((a, b) => this.getSeverityScore(b.severity) - this.getSeverityScore(a.severity));
  }

  /**
   * Build execution path visualization
   */
  async buildExecutionPath(instanceId: UUID): Promise<ExecutionPathNode[]> {
    try {
      const stepInstances = await db.query(`
        SELECT 
          wsi.*,
          EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at)) as duration_seconds
        FROM workflow_step_instances wsi
        WHERE wsi.workflow_instance_id = $1
        ORDER BY wsi.activated_at NULLS LAST, wsi.created_at
      `, [instanceId]);

      const nodes: ExecutionPathNode[] = [];

      for (const step of stepInstances.rows) {
        const stepIssues = await this.analyzeStepIssues(step);
        
        const node: ExecutionPathNode = {
          stepName: step.step_name,
          status: step.status,
          startTime: step.activated_at,
          endTime: step.completed_at,
          duration: step.duration_seconds ? parseFloat(step.duration_seconds) : undefined,
          children: [], // For parallel/nested steps
          issues: stepIssues
        };

        nodes.push(node);
      }

      return nodes;
    } catch (error) {
      console.error('Build execution path error:', error);
      return [];
    }
  }

  /**
   * Calculate performance metrics
   */
  async calculatePerformanceMetrics(instanceId: UUID): Promise<PerformanceMetrics> {
    try {
      const metricsResult = await db.query(`
        SELECT 
          EXTRACT(EPOCH FROM (COALESCE(wi.completed_at, NOW()) - wi.started_at)) as total_execution_time,
          COUNT(wsi.id) as total_steps,
          AVG(EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))) as avg_step_time,
          array_agg(
            json_build_object(
              'stepName', wsi.step_name,
              'duration', EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))
            ) ORDER BY EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at)) DESC
          ) FILTER (WHERE wsi.completed_at IS NOT NULL) as step_durations
        FROM workflow_instances wi
        LEFT JOIN workflow_step_instances wsi ON wi.id = wsi.workflow_instance_id
        WHERE wi.id = $1
        GROUP BY wi.id, wi.started_at, wi.completed_at
      `, [instanceId]);

      const metrics = metricsResult.rows[0];
      const stepDurations = metrics.step_durations || [];

      // Identify bottlenecks (steps taking longer than 2x average)
      const avgTime = parseFloat(metrics.avg_step_time) || 0;
      const bottlenecks = stepDurations
        .filter((step: any) => step.duration > avgTime * 2)
        .map((step: any) => step.stepName);

      return {
        totalExecutionTime: parseFloat(metrics.total_execution_time) || 0,
        averageStepTime: avgTime,
        slowestSteps: stepDurations.slice(0, 5), // Top 5 slowest steps
        bottlenecks,
        throughput: metrics.total_steps > 0 ? metrics.total_steps / (parseFloat(metrics.total_execution_time) || 1) : 0
      };
    } catch (error) {
      console.error('Calculate performance metrics error:', error);
      return {
        totalExecutionTime: 0,
        averageStepTime: 0,
        slowestSteps: [],
        bottlenecks: [],
        throughput: 0
      };
    }
  }

  /**
   * Get resource usage information
   */
  async getResourceUsage(instanceId: UUID): Promise<ResourceUsage> {
    // This would integrate with system monitoring tools
    // For now, return mock data
    return {
      memoryUsage: Math.random() * 100,
      cpuUsage: Math.random() * 100,
      databaseConnections: Math.floor(Math.random() * 10) + 1,
      activeThreads: Math.floor(Math.random() * 5) + 1
    };
  }

  /**
   * Force complete a stuck step
   */
  async forceCompleteStep(
    instanceId: UUID,
    stepInstanceId: UUID,
    reason: string,
    userId: UUID
  ): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_step_instances 
        SET 
          status = 'completed',
          completed_at = NOW(),
          completed_by = $1,
          comment = $2,
          execution_data = jsonb_build_object('forcedCompletion', true, 'reason', $2)
        WHERE id = $3 AND workflow_instance_id = $4
      `, [userId, reason, stepInstanceId, instanceId]);

      // Log the forced completion
      await this.eventService.logStepEvent(
        instanceId,
        stepInstanceId,
        'step_force_completed',
        { reason, userId }
      );

      // Continue workflow execution
      await this.executionService.executeStep({
        instanceId,
        stepInstanceId,
        action: 'force_complete',
        data: { forcedCompletion: true, reason },
        executedBy: userId,
        comment: `Forced completion: ${reason}`
      });
    } catch (error) {
      console.error('Force complete step error:', error);
      throw error;
    }
  }

  /**
   * Skip a problematic step
   */
  async skipStep(
    instanceId: UUID,
    stepInstanceId: UUID,
    reason: string,
    userId: UUID
  ): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_step_instances 
        SET 
          status = 'skipped',
          completed_at = NOW(),
          completed_by = $1,
          comment = $2,
          execution_data = jsonb_build_object('skipped', true, 'reason', $2)
        WHERE id = $3 AND workflow_instance_id = $4
      `, [userId, reason, stepInstanceId, instanceId]);

      // Log the skip
      await this.eventService.logStepEvent(
        instanceId,
        stepInstanceId,
        'step_skipped',
        { reason, userId }
      );
    } catch (error) {
      console.error('Skip step error:', error);
      throw error;
    }
  }

  /**
   * Retry a failed step
   */
  async retryStep(
    instanceId: UUID,
    stepInstanceId: UUID,
    userId: UUID
  ): Promise<void> {
    try {
      await db.query(`
        UPDATE workflow_step_instances 
        SET 
          status = 'active',
          activated_at = NOW(),
          activated_by = $1,
          completed_at = NULL,
          completed_by = NULL,
          error_message = NULL,
          execution_data = jsonb_build_object('retried', true, 'retriedAt', NOW())
        WHERE id = $2 AND workflow_instance_id = $3
      `, [userId, stepInstanceId, instanceId]);

      // Log the retry
      await this.eventService.logStepEvent(
        instanceId,
        stepInstanceId,
        'step_retried',
        { userId }
      );
    } catch (error) {
      console.error('Retry step error:', error);
      throw error;
    }
  }

  /**
   * Get workflow execution timeline
   */
  async getExecutionTimeline(instanceId: UUID): Promise<any[]> {
    try {
      const events = await this.eventService.getWorkflowEvents({
        workflowInstanceId: instanceId,
        limit: 1000
      });

      return events.events.map(event => ({
        timestamp: event.createdAt,
        type: event.eventType,
        data: event.eventData,
        user: event.userName,
        stepInstance: event.stepInstanceId
      }));
    } catch (error) {
      console.error('Get execution timeline error:', error);
      return [];
    }
  }  /**
   *
 Private helper methods for issue analysis
   */
  private async checkForStuckWorkflow(instanceId: UUID): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    try {
      const result = await db.query(`
        SELECT 
          wi.started_at,
          wi.status,
          COUNT(CASE WHEN wsi.status = 'active' THEN 1 END) as active_steps,
          MAX(wsi.activated_at) as last_activity
        FROM workflow_instances wi
        LEFT JOIN workflow_step_instances wsi ON wi.id = wsi.workflow_instance_id
        WHERE wi.id = $1
        GROUP BY wi.id, wi.started_at, wi.status
      `, [instanceId]);

      const data = result.rows[0];
      if (!data) return issues;

      const now = new Date();
      const startTime = new Date(data.started_at);
      const lastActivity = data.last_activity ? new Date(data.last_activity) : startTime;
      const timeSinceStart = now.getTime() - startTime.getTime();
      const timeSinceActivity = now.getTime() - lastActivity.getTime();

      // Check for long-running workflow
      if (timeSinceStart > 24 * 60 * 60 * 1000) { // 24 hours
        issues.push({
          type: 'warning',
          category: 'performance',
          message: 'Workflow has been running for more than 24 hours',
          details: { 
            startTime: data.started_at,
            duration: timeSinceStart 
          },
          severity: 'medium',
          suggestedActions: [
            'Review workflow definition for infinite loops',
            'Check for stuck manual steps',
            'Consider workflow timeout configuration'
          ]
        });
      }

      // Check for inactive workflow
      if (data.status === 'running' && timeSinceActivity > 2 * 60 * 60 * 1000) { // 2 hours
        issues.push({
          type: 'error',
          category: 'logic',
          message: 'Workflow appears to be stuck with no recent activity',
          details: { 
            lastActivity: data.last_activity,
            activeSteps: parseInt(data.active_steps)
          },
          severity: 'high',
          suggestedActions: [
            'Check active steps for blocking conditions',
            'Review step assignments and availability',
            'Consider manual intervention or step completion'
          ]
        });
      }

      // Check for workflows with no active steps
      if (data.status === 'running' && parseInt(data.active_steps) === 0) {
        issues.push({
          type: 'error',
          category: 'logic',
          message: 'Running workflow has no active steps',
          details: { status: data.status },
          severity: 'critical',
          suggestedActions: [
            'Check workflow definition for missing transitions',
            'Verify step completion logic',
            'Manual workflow completion may be required'
          ]
        });
      }
    } catch (error) {
      console.error('Check stuck workflow error:', error);
    }

    return issues;
  }

  private async checkPerformanceIssues(instanceId: UUID): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    try {
      const result = await db.query(`
        SELECT 
          wsi.step_name,
          wsi.status,
          EXTRACT(EPOCH FROM (COALESCE(wsi.completed_at, NOW()) - wsi.activated_at)) as duration,
          wsi.step_config
        FROM workflow_step_instances wsi
        WHERE wsi.workflow_instance_id = $1
          AND wsi.activated_at IS NOT NULL
        ORDER BY duration DESC NULLS LAST
      `, [instanceId]);

      const steps = result.rows;
      if (steps.length === 0) return issues;

      const durations = steps
        .filter(s => s.duration !== null)
        .map(s => parseFloat(s.duration));
      
      if (durations.length === 0) return issues;

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      // Check for extremely slow steps
      const slowSteps = steps.filter(s => 
        s.duration && parseFloat(s.duration) > avgDuration * 3
      );

      if (slowSteps.length > 0) {
        issues.push({
          type: 'warning',
          category: 'performance',
          message: `${slowSteps.length} step(s) are significantly slower than average`,
          details: {
            slowSteps: slowSteps.map(s => ({
              stepName: s.step_name,
              duration: parseFloat(s.duration),
              status: s.status
            })),
            averageDuration: avgDuration
          },
          severity: 'medium',
          suggestedActions: [
            'Review step implementation for optimization opportunities',
            'Check for resource contention or external dependencies',
            'Consider parallel execution where possible'
          ]
        });
      }

      // Check for timeout-prone steps
      const timeoutSteps = steps.filter(s => {
        const config = s.step_config;
        const timeout = config?.timeoutMinutes;
        return timeout && s.duration && parseFloat(s.duration) > (timeout * 60 * 0.8);
      });

      if (timeoutSteps.length > 0) {
        issues.push({
          type: 'warning',
          category: 'timeout',
          message: `${timeoutSteps.length} step(s) are approaching timeout limits`,
          details: { timeoutSteps: timeoutSteps.map(s => s.step_name) },
          severity: 'medium',
          suggestedActions: [
            'Increase timeout values for affected steps',
            'Optimize step execution time',
            'Consider breaking down complex steps'
          ]
        });
      }
    } catch (error) {
      console.error('Check performance issues error:', error);
    }

    return issues;
  }

  private async checkDataIssues(instanceId: UUID): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    try {
      // Check for missing required data
      const instance = await this.executionService.getWorkflowInstance(instanceId);
      if (!instance) return issues;

      const context = instance.context;
      if (!context || Object.keys(context).length === 0) {
        issues.push({
          type: 'warning',
          category: 'data',
          message: 'Workflow context is empty or missing',
          details: { context },
          severity: 'medium',
          suggestedActions: [
            'Verify workflow initialization data',
            'Check case data availability',
            'Review context requirements'
          ]
        });
      }

      // Check for failed steps with data issues
      const failedSteps = await db.query(`
        SELECT step_name, error_message, execution_data
        FROM workflow_step_instances
        WHERE workflow_instance_id = $1 
          AND status = 'failed'
          AND error_message ILIKE '%data%'
      `, [instanceId]);

      if (failedSteps.rows.length > 0) {
        issues.push({
          type: 'error',
          category: 'data',
          message: `${failedSteps.rows.length} step(s) failed due to data issues`,
          details: { 
            failedSteps: failedSteps.rows.map(s => ({
              stepName: s.step_name,
              error: s.error_message
            }))
          },
          severity: 'high',
          suggestedActions: [
            'Review data validation rules',
            'Check data source availability',
            'Verify data format and structure'
          ]
        });
      }
    } catch (error) {
      console.error('Check data issues error:', error);
    }

    return issues;
  }

  private async checkTimeoutIssues(instanceId: UUID): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    try {
      const timeoutSteps = await db.query(`
        SELECT step_name, step_config, activated_at
        FROM workflow_step_instances
        WHERE workflow_instance_id = $1 
          AND status = 'active'
          AND step_config->>'timeoutMinutes' IS NOT NULL
          AND activated_at < NOW() - (step_config->>'timeoutMinutes')::integer * INTERVAL '1 minute'
      `, [instanceId]);

      if (timeoutSteps.rows.length > 0) {
        issues.push({
          type: 'error',
          category: 'timeout',
          message: `${timeoutSteps.rows.length} step(s) have exceeded their timeout`,
          details: { 
            timeoutSteps: timeoutSteps.rows.map(s => s.step_name)
          },
          severity: 'high',
          suggestedActions: [
            'Complete or skip timed-out steps',
            'Review timeout configuration',
            'Check step assignee availability'
          ]
        });
      }
    } catch (error) {
      console.error('Check timeout issues error:', error);
    }

    return issues;
  }

  private async checkResourceIssues(instanceId: UUID): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    // This would check for resource-related issues
    // For now, return empty array
    return issues;
  }

  private async analyzeStepIssues(step: any): Promise<WorkflowIssue[]> {
    const issues: WorkflowIssue[] = [];

    // Check for long-running step
    if (step.duration_seconds && parseFloat(step.duration_seconds) > 3600) { // 1 hour
      issues.push({
        type: 'warning',
        category: 'performance',
        message: 'Step took longer than 1 hour to complete',
        details: { duration: parseFloat(step.duration_seconds) },
        severity: 'medium',
        suggestedActions: ['Review step complexity', 'Check for blocking dependencies']
      });
    }

    // Check for failed step
    if (step.status === 'failed') {
      issues.push({
        type: 'error',
        category: 'logic',
        message: 'Step execution failed',
        details: { error: step.error_message },
        severity: 'high',
        suggestedActions: ['Review error message', 'Check step configuration', 'Retry step if appropriate']
      });
    }

    return issues;
  }

  private generateRecommendations(issues: WorkflowIssue[], metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (metrics.averageStepTime > 300) { // 5 minutes
      recommendations.push('Consider optimizing step execution time - average step time is high');
    }

    if (metrics.bottlenecks.length > 0) {
      recommendations.push(`Address bottleneck steps: ${metrics.bottlenecks.join(', ')}`);
    }

    // Issue-based recommendations
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical issues immediately to prevent workflow failure');
    }

    const timeoutIssues = issues.filter(i => i.category === 'timeout');
    if (timeoutIssues.length > 0) {
      recommendations.push('Review and adjust timeout configurations for affected steps');
    }

    const performanceIssues = issues.filter(i => i.category === 'performance');
    if (performanceIssues.length > 2) {
      recommendations.push('Multiple performance issues detected - consider workflow optimization');
    }

    if (recommendations.length === 0) {
      recommendations.push('Workflow appears to be running normally');
    }

    return recommendations;
  }

  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }
}