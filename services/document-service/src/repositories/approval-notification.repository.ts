import { Pool } from 'pg';
import { getDbConnection } from '../../../../shared/database/src/connection';
import { UUID } from '../types/approval';

export interface ApprovalNotificationRecord {
  id: UUID;
  instanceId: UUID;
  notificationType: string;
  recipientUserId: UUID;
  channel: string;
  template: string;
  data: any;
  status: 'pending' | 'sent' | 'failed';
  scheduledAt: Date;
  sentAt?: Date;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

export interface CreateNotificationRequest {
  instanceId: UUID;
  notificationType: string;
  recipientUserId: UUID;
  channel: string;
  template: string;
  data: any;
  scheduledAt?: Date;
}

export class ApprovalNotificationRepository {
  private db: Pool;

  constructor() {
    this.db = getDbConnection();
  }

  async createNotification(request: CreateNotificationRequest): Promise<ApprovalNotificationRecord> {
    const query = `
      INSERT INTO approval_notifications (
        instance_id, notification_type, recipient_user_id, 
        channel, template, data, scheduled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      request.instanceId,
      request.notificationType,
      request.recipientUserId,
      request.channel,
      request.template,
      JSON.stringify(request.data),
      request.scheduledAt || new Date()
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToNotification(result.rows[0]);
  }

  async getPendingNotifications(limit: number = 100): Promise<ApprovalNotificationRecord[]> {
    const query = `
      SELECT * FROM approval_notifications 
      WHERE status = 'pending' 
        AND scheduled_at <= NOW()
        AND retry_count < 3
      ORDER BY scheduled_at ASC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => this.mapRowToNotification(row));
  }

  async markNotificationSent(id: UUID): Promise<void> {
    const query = `
      UPDATE approval_notifications 
      SET status = 'sent', sent_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [id]);
  }

  async markNotificationFailed(id: UUID, errorMessage: string): Promise<void> {
    const query = `
      UPDATE approval_notifications 
      SET status = 'failed', error_message = $2, retry_count = retry_count + 1
      WHERE id = $1
    `;

    await this.db.query(query, [id, errorMessage]);
  }

  async retryFailedNotification(id: UUID, newScheduledAt: Date): Promise<void> {
    const query = `
      UPDATE approval_notifications 
      SET status = 'pending', scheduled_at = $2, error_message = NULL
      WHERE id = $1 AND retry_count < 3
    `;

    await this.db.query(query, [id, newScheduledAt]);
  }

  async getNotificationsByInstance(instanceId: UUID): Promise<ApprovalNotificationRecord[]> {
    const query = `
      SELECT * FROM approval_notifications 
      WHERE instance_id = $1 
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [instanceId]);
    return result.rows.map(row => this.mapRowToNotification(row));
  }

  async getNotificationsByRecipient(
    recipientUserId: UUID, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<{
    notifications: ApprovalNotificationRecord[];
    total: number;
  }> {
    // Count query
    const countQuery = `
      SELECT COUNT(*) FROM approval_notifications 
      WHERE recipient_user_id = $1
    `;
    const countResult = await this.db.query(countQuery, [recipientUserId]);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const dataQuery = `
      SELECT * FROM approval_notifications 
      WHERE recipient_user_id = $1 
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const dataResult = await this.db.query(dataQuery, [recipientUserId, limit, offset]);

    return {
      notifications: dataResult.rows.map(row => this.mapRowToNotification(row)),
      total
    };
  }

  async deleteOldNotifications(olderThanDays: number = 90): Promise<number> {
    const query = `
      DELETE FROM approval_notifications 
      WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  private mapRowToNotification(row: any): ApprovalNotificationRecord {
    return {
      id: row.id,
      instanceId: row.instance_id,
      notificationType: row.notification_type,
      recipientUserId: row.recipient_user_id,
      channel: row.channel,
      template: row.template,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      status: row.status,
      scheduledAt: row.scheduled_at,
      sentAt: row.sent_at,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      createdAt: row.created_at
    };
  }
}