import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';

export interface WorkflowMetrics {
  totalInstances: number;
  runningInstances: number;
  completedInstances: number;
  failedInstances: number;
  averageExecutionTime: number;
  averageStepsPerWorkflow: number;
  mostUsedWorkflows: any[];
  bottleneckSteps: any[];
  performanceByPriority: any[];
}

export interface StepPerformanceMetrics {
  stepName: string;
  totalExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  failureRate: number;
  timeoutRate: number;
  bottleneckScore: number;
}

export class WorkflowMonitoringService {
  /**
   * Get overall workflow metrics
   */
  async getWorkflowMetrics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<WorkflowMetrics> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);

      // Get basic counts
      const countsResult = await db.query(`
        SELECT 
          COUNT(*) as total_instances,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_instances,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_instances,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_instances,
          AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))) as avg_execution_time
        FROM workflow_instances
        WHERE started_at >= NOW() - INTERVAL '${timeFilter}'
      `);

      const counts = countsResult.rows[0];

      // Get average steps per workflow
      const stepsResult = await db.query(`
        SELECT AVG(step_count) as avg_steps
        FROM (
          SELECT COUNT(*) as step_count
          FROM workflow_step_instances wsi
          JOIN workflow_instances wi ON wsi.workflow_instance_id = wi.id
          WHERE wi.started_at >= NOW() - INTERVAL '${timeFilter}'
          GROUP BY wi.id
        ) as step_counts
      `);

      const avgSteps = stepsResult.rows[0]?.avg_steps || 0;

      // Get most used workflows
      const mostUsedResult = await db.query(`
        SELECT 
          wd.name,
          wd.id,
          COUNT(*) as usage_count,
          AVG(EXTRACT(EPOCH FROM (COALESCE(wi.completed_at, NOW()) - wi.started_at))) as avg_execution_time
        FROM workflow_instances wi
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        WHERE wi.started_at >= NOW() - INTERVAL '${timeFilter}'
        GROUP BY wd.id, wd.name
        ORDER BY usage_count DESC
        LIMIT 10
      `);

      // Get bottleneck steps
      const bottleneckSteps = await this.getBottleneckSteps(timeRange);

      // Get performance by priority
      const priorityResult = await db.query(`
        SELECT 
          priority,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))) as avg_execution_time,
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*) as completion_rate
        FROM workflow_instances
        WHERE started_at >= NOW() - INTERVAL '${timeFilter}'
        GROUP BY priority
        ORDER BY priority
      `);

      return {
        totalInstances: parseInt(counts.total_instances),
        runningInstances: parseInt(counts.running_instances),
        completedInstances: parseInt(counts.completed_instances),
        failedInstances: parseInt(counts.failed_instances),
        averageExecutionTime: parseFloat(counts.avg_execution_time) || 0,
        averageStepsPerWorkflow: parseFloat(avgSteps),
        mostUsedWorkflows: mostUsedResult.rows.map(row => ({
          name: row.name,
          id: row.id,
          usageCount: parseInt(row.usage_count),
          averageExecutionTime: parseFloat(row.avg_execution_time)
        })),
        bottleneckSteps,
        performanceByPriority: priorityResult.rows.map(row => ({
          priority: row.priority,
          count: parseInt(row.count),
          averageExecutionTime: parseFloat(row.avg_execution_time),
          completionRate: parseFloat(row.completion_rate)
        }))
      };
    } catch (error) {
      console.error('Get workflow metrics error:', error);
      throw error;
    }
  }

  /**
   * Get step performance metrics
   */
  async getStepPerformanceMetrics(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<StepPerformanceMetrics[]> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);

      const result = await db.query(`
        SELECT 
          wsi.step_name,
          COUNT(*) as total_executions,
          AVG(EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))) as avg_execution_time,
          COUNT(CASE WHEN wsi.status = 'completed' THEN 1 END)::float / COUNT(*) as success_rate,
          COUNT(CASE WHEN wsi.status = 'failed' THEN 1 END)::float / COUNT(*) as failure_rate,
          COUNT(CASE WHEN wsi.status = 'timeout' THEN 1 END)::float / COUNT(*) as timeout_rate
        FROM workflow_step_instances wsi
        JOIN workflow_instances wi ON wsi.workflow_instance_id = wi.id
        WHERE wi.started_at >= NOW() - INTERVAL '${timeFilter}'
          AND wsi.activated_at IS NOT NULL
        GROUP BY wsi.step_name
        HAVING COUNT(*) >= 5  -- Only include steps with sufficient data
        ORDER BY avg_execution_time DESC
      `);

      return result.rows.map(row => {
        const avgTime = parseFloat(row.avg_execution_time) || 0;
        const failureRate = parseFloat(row.failure_rate) || 0;
        const timeoutRate = parseFloat(row.timeout_rate) || 0;
        
        // Calculate bottleneck score (higher is worse)
        const bottleneckScore = (avgTime / 3600) + (failureRate * 10) + (timeoutRate * 15);

        return {
          stepName: row.step_name,
          totalExecutions: parseInt(row.total_executions),
          averageExecutionTime: avgTime,
          successRate: parseFloat(row.success_rate) || 0,
          failureRate,
          timeoutRate,
          bottleneckScore
        };
      });
    } catch (error) {
      console.error('Get step performance metrics error:', error);
      throw error;
    }
  }

  /**
   * Get workflow execution trends
   */
  async getWorkflowTrends(timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any[]> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);
      const groupBy = timeRange === 'day' ? 'hour' : timeRange === 'week' ? 'day' : 'week';

      const result = await db.query(`
        SELECT 
          DATE_TRUNC('${groupBy}', started_at) as time_period,
          COUNT(*) as total_started,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))) as avg_execution_time
        FROM workflow_instances
        WHERE started_at >= NOW() - INTERVAL '${timeFilter}'
        GROUP BY DATE_TRUNC('${groupBy}', started_at)
        ORDER BY time_period
      `);

      return result.rows.map(row => ({
        timePeriod: row.time_period,
        totalStarted: parseInt(row.total_started),
        completed: parseInt(row.completed),
        failed: parseInt(row.failed),
        averageExecutionTime: parseFloat(row.avg_execution_time) || 0
      }));
    } catch (error) {
      console.error('Get workflow trends error:', error);
      throw error;
    }
  }

  /**
   * Get active workflow instances with details
   */
  async getActiveWorkflows(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          wi.id,
          wi.case_id,
          wi.priority,
          wi.started_at,
          wd.name as workflow_name,
          wd.version as workflow_version,
          u.full_name as started_by_name,
          COUNT(wsi.id) as total_steps,
          COUNT(CASE WHEN wsi.status = 'completed' THEN 1 END) as completed_steps,
          COUNT(CASE WHEN wsi.status = 'active' THEN 1 END) as active_steps,
          array_agg(CASE WHEN wsi.status = 'active' THEN wsi.step_name END) 
            FILTER (WHERE wsi.status = 'active') as current_steps
        FROM workflow_instances wi
        JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
        LEFT JOIN users u ON wi.started_by = u.id
        LEFT JOIN workflow_step_instances wsi ON wi.id = wsi.workflow_instance_id
        WHERE wi.status = 'running'
        GROUP BY wi.id, wd.name, wd.version, u.full_name
        ORDER BY wi.started_at DESC
      `);

      return result.rows.map(row => ({
        id: row.id,
        caseId: row.case_id,
        priority: row.priority,
        startedAt: row.started_at,
        workflowName: row.workflow_name,
        workflowVersion: row.workflow_version,
        startedByName: row.started_by_name,
        totalSteps: parseInt(row.total_steps),
        completedSteps: parseInt(row.completed_steps),
        activeSteps: parseInt(row.active_steps),
        currentSteps: row.current_steps || [],
        executionTime: Date.now() - new Date(row.started_at).getTime(),
        progress: row.total_steps > 0 ? (row.completed_steps / row.total_steps) * 100 : 0
      }));
    } catch (error) {
      console.error('Get active workflows error:', error);
      throw error;
    }
  }

  /**
   * Get workflow health status
   */
  async getWorkflowHealth(): Promise<any> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(CASE WHEN status = 'running' AND started_at < NOW() - INTERVAL '24 hours' THEN 1 END) as long_running,
          COUNT(CASE WHEN status = 'failed' AND started_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_failures,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as total_running,
          AVG(CASE WHEN status = 'completed' AND completed_at >= NOW() - INTERVAL '24 hours' 
              THEN EXTRACT(EPOCH FROM (completed_at - started_at)) END) as avg_completion_time_24h
        FROM workflow_instances
      `);

      const health = result.rows[0];

      // Calculate health score (0-100, higher is better)
      const longRunningPenalty = Math.min(parseInt(health.long_running) * 10, 50);
      const recentFailuresPenalty = Math.min(parseInt(health.recent_failures) * 5, 30);
      const healthScore = Math.max(0, 100 - longRunningPenalty - recentFailuresPenalty);

      return {
        healthScore,
        longRunningWorkflows: parseInt(health.long_running),
        recentFailures: parseInt(health.recent_failures),
        totalRunning: parseInt(health.total_running),
        averageCompletionTime24h: parseFloat(health.avg_completion_time_24h) || 0,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical'
      };
    } catch (error) {
      console.error('Get workflow health error:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private getTimeFilter(timeRange: 'day' | 'week' | 'month'): string {
    switch (timeRange) {
      case 'day':
        return '1 day';
      case 'week':
        return '1 week';
      case 'month':
        return '1 month';
      default:
        return '1 week';
    }
  }

  private async getBottleneckSteps(timeRange: 'day' | 'week' | 'month'): Promise<any[]> {
    const timeFilter = this.getTimeFilter(timeRange);

    const result = await db.query(`
      SELECT 
        wsi.step_name,
        COUNT(*) as execution_count,
        AVG(EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))) as avg_execution_time,
        COUNT(CASE WHEN wsi.status = 'failed' THEN 1 END) as failure_count,
        COUNT(CASE WHEN wsi.status = 'timeout' THEN 1 END) as timeout_count
      FROM workflow_step_instances wsi
      JOIN workflow_instances wi ON wsi.workflow_instance_id = wi.id
      WHERE wi.started_at >= NOW() - INTERVAL '${timeFilter}'
        AND wsi.activated_at IS NOT NULL
        AND wsi.completed_at IS NOT NULL
      GROUP BY wsi.step_name
      HAVING COUNT(*) >= 10  -- Only include steps with sufficient data
      ORDER BY avg_execution_time DESC
      LIMIT 10
    `);

    return result.rows.map(row => ({
      stepName: row.step_name,
      executionCount: parseInt(row.execution_count),
      averageExecutionTime: parseFloat(row.avg_execution_time),
      failureCount: parseInt(row.failure_count),
      timeoutCount: parseInt(row.timeout_count),
      bottleneckScore: parseFloat(row.avg_execution_time) + 
                      (parseInt(row.failure_count) * 300) + 
                      (parseInt(row.timeout_count) * 600)
    }));
  }
}