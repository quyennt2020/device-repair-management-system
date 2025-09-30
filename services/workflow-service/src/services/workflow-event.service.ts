import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';

export interface WorkflowEvent {
  id: UUID;
  workflowInstanceId: UUID;
  stepInstanceId?: UUID;
  eventType: string;
  eventData: any;
  userId?: UUID;
  userName?: string;
  createdAt: Date;
}

export interface EventFilters {
  workflowInstanceId?: UUID;
  stepInstanceId?: UUID;
  eventType?: string;
  userId?: UUID;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class WorkflowEventService {
  /**
   * Log a workflow-level event
   */
  async logWorkflowEvent(
    workflowInstanceId: UUID,
    eventType: string,
    eventData: any,
    userId?: UUID
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO workflow_events (
          workflow_instance_id, event_type, event_data, user_id
        )
        VALUES ($1, $2, $3, $4)
      `, [
        workflowInstanceId,
        eventType,
        JSON.stringify(eventData),
        userId
      ]);
    } catch (error) {
      console.error('Log workflow event error:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Log a step-level event
   */
  async logStepEvent(
    workflowInstanceId: UUID,
    stepInstanceId: UUID | null,
    eventType: string,
    eventData: any,
    userId?: UUID
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO workflow_events (
          workflow_instance_id, step_instance_id, event_type, event_data, user_id
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [
        workflowInstanceId,
        stepInstanceId,
        eventType,
        JSON.stringify(eventData),
        userId
      ]);
    } catch (error) {
      console.error('Log step event error:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get workflow events with filtering
   */
  async getWorkflowEvents(filters: EventFilters = {}): Promise<{
    events: WorkflowEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        workflowInstanceId,
        stepInstanceId,
        eventType,
        userId,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = filters;

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (workflowInstanceId) {
        conditions.push(`we.workflow_instance_id = $${paramCount++}`);
        params.push(workflowInstanceId);
      }

      if (stepInstanceId) {
        conditions.push(`we.step_instance_id = $${paramCount++}`);
        params.push(stepInstanceId);
      }

      if (eventType) {
        conditions.push(`we.event_type = $${paramCount++}`);
        params.push(eventType);
      }

      if (userId) {
        conditions.push(`we.user_id = $${paramCount++}`);
        params.push(userId);
      }

      if (startDate) {
        conditions.push(`we.created_at >= $${paramCount++}`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`we.created_at <= $${paramCount++}`);
        params.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await db.query(`
        SELECT COUNT(*) as total
        FROM workflow_events we
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);

      // Get events
      const eventsResult = await db.query(`
        SELECT 
          we.*,
          u.full_name as user_name
        FROM workflow_events we
        LEFT JOIN users u ON we.user_id = u.id
        ${whereClause}
        ORDER BY we.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...params, limit, offset]);

      const events = eventsResult.rows.map(row => ({
        id: row.id,
        workflowInstanceId: row.workflow_instance_id,
        stepInstanceId: row.step_instance_id,
        eventType: row.event_type,
        eventData: row.event_data,
        userId: row.user_id,
        userName: row.user_name,
        createdAt: row.created_at
      }));

      return {
        events,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get workflow events error:', error);
      throw error;
    }
  }

  /**
   * Get workflow timeline (events grouped by date)
   */
  async getWorkflowTimeline(workflowInstanceId: UUID): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          DATE(we.created_at) as event_date,
          COUNT(*) as event_count,
          array_agg(
            json_build_object(
              'id', we.id,
              'eventType', we.event_type,
              'eventData', we.event_data,
              'userId', we.user_id,
              'userName', u.full_name,
              'createdAt', we.created_at
            ) ORDER BY we.created_at
          ) as events
        FROM workflow_events we
        LEFT JOIN users u ON we.user_id = u.id
        WHERE we.workflow_instance_id = $1
        GROUP BY DATE(we.created_at)
        ORDER BY event_date DESC
      `, [workflowInstanceId]);

      return result.rows.map(row => ({
        date: row.event_date,
        eventCount: parseInt(row.event_count),
        events: row.events
      }));
    } catch (error) {
      console.error('Get workflow timeline error:', error);
      throw error;
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(workflowInstanceId: UUID): Promise<any> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT we.event_type) as unique_event_types,
          COUNT(DISTINCT we.user_id) as unique_users,
          MIN(we.created_at) as first_event,
          MAX(we.created_at) as last_event,
          COUNT(CASE WHEN we.event_type LIKE '%_failed' THEN 1 END) as error_events,
          COUNT(CASE WHEN we.event_type LIKE '%_completed' THEN 1 END) as completion_events
        FROM workflow_events we
        WHERE we.workflow_instance_id = $1
      `, [workflowInstanceId]);

      const stats = result.rows[0];

      // Get event type breakdown
      const eventTypesResult = await db.query(`
        SELECT 
          event_type,
          COUNT(*) as count
        FROM workflow_events
        WHERE workflow_instance_id = $1
        GROUP BY event_type
        ORDER BY count DESC
      `, [workflowInstanceId]);

      return {
        totalEvents: parseInt(stats.total_events),
        uniqueEventTypes: parseInt(stats.unique_event_types),
        uniqueUsers: parseInt(stats.unique_users),
        firstEvent: stats.first_event,
        lastEvent: stats.last_event,
        errorEvents: parseInt(stats.error_events),
        completionEvents: parseInt(stats.completion_events),
        eventTypeBreakdown: eventTypesResult.rows.map(row => ({
          eventType: row.event_type,
          count: parseInt(row.count)
        }))
      };
    } catch (error) {
      console.error('Get workflow statistics error:', error);
      throw error;
    }
  }

  /**
   * Clean up old events
   */
  async cleanupOldEvents(daysToKeep: number = 90): Promise<number> {
    try {
      const result = await db.query(`
        DELETE FROM workflow_events 
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      `);

      const deletedCount = result.rowCount || 0;
      console.log(`Cleaned up ${deletedCount} old workflow events`);
      return deletedCount;
    } catch (error) {
      console.error('Cleanup old events error:', error);
      return 0;
    }
  }

  /**
   * Export workflow events to JSON
   */
  async exportWorkflowEvents(workflowInstanceId: UUID): Promise<any> {
    try {
      const events = await this.getWorkflowEvents({ 
        workflowInstanceId, 
        limit: 10000 // Large limit for export
      });

      const timeline = await this.getWorkflowTimeline(workflowInstanceId);
      const statistics = await this.getWorkflowStatistics(workflowInstanceId);

      return {
        workflowInstanceId,
        exportedAt: new Date().toISOString(),
        statistics,
        timeline,
        events: events.events
      };
    } catch (error) {
      console.error('Export workflow events error:', error);
      throw error;
    }
  }
}