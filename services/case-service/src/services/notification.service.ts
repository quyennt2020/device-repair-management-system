import { UUID, CaseStatus, CasePriority } from '@drms/shared-types';
import { config } from '../config';
import { db } from '@drms/shared-database';

export interface NotificationTemplate {
  id: string;
  subject: string;
  body: string;
  channels: ('email' | 'sms' | 'push')[];
}

export class NotificationService {
  /**
   * Send notifications when a case is created
   */
  async sendCaseCreatedNotifications(caseId: UUID): Promise<void> {
    try {
      const caseData = await this.getCaseNotificationData(caseId);
      if (!caseData) return;

      // Notify customer
      if (config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: caseData.customerEmail,
          subject: `Case Created: ${caseData.caseNumber}`,
          body: `Your repair case has been created. Case Number: ${caseData.caseNumber}. We will keep you updated on the progress.`,
          type: 'email'
        });
      }

      // Notify assigned technician if any
      if (caseData.technicianEmail && config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: caseData.technicianEmail,
          subject: `New Case Assigned: ${caseData.caseNumber}`,
          body: `A new case has been assigned to you. Case: ${caseData.title}. Priority: ${caseData.priority}`,
          type: 'email'
        });
      }

      // Log notification
      await this.logNotification(caseId, 'case_created', 'Case creation notifications sent');

    } catch (error) {
      console.error('Send case created notifications error:', error);
    }
  }

  /**
   * Send notifications when case status changes
   */
  async sendStatusChangeNotification(caseId: UUID, oldStatus: CaseStatus, newStatus: CaseStatus): Promise<void> {
    try {
      const caseData = await this.getCaseNotificationData(caseId);
      if (!caseData) return;

      const statusMessages = {
        'open': 'opened',
        'assigned': 'assigned to a technician',
        'in_progress': 'being worked on',
        'waiting_parts': 'waiting for parts',
        'waiting_customer': 'waiting for customer response',
        'completed': 'completed',
        'cancelled': 'cancelled'
      };

      const message = `Your case ${caseData.caseNumber} status has been updated to: ${statusMessages[newStatus] || newStatus}`;

      // Notify customer
      if (config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: caseData.customerEmail,
          subject: `Case Status Update: ${caseData.caseNumber}`,
          body: message,
          type: 'email'
        });
      }

      // Notify technician for certain status changes
      if (caseData.technicianEmail && ['completed', 'cancelled'].includes(newStatus)) {
        await this.sendNotification({
          to: caseData.technicianEmail,
          subject: `Case ${newStatus}: ${caseData.caseNumber}`,
          body: `Case ${caseData.caseNumber} has been ${newStatus}.`,
          type: 'email'
        });
      }

      await this.logNotification(caseId, 'status_change', `Status change notifications sent: ${oldStatus} -> ${newStatus}`);

    } catch (error) {
      console.error('Send status change notification error:', error);
    }
  }

  /**
   * Send notifications when technician is assigned
   */
  async sendTechnicianAssignmentNotification(caseId: UUID, technicianId: UUID, previousTechnicianId?: UUID): Promise<void> {
    try {
      const caseData = await this.getCaseNotificationData(caseId);
      if (!caseData) return;

      // Get technician details
      const technicianResult = await db.query(`
        SELECT u.email, u.full_name
        FROM technicians t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = $1
      `, [technicianId]);

      if (technicianResult.rows.length === 0) return;

      const technician = technicianResult.rows[0];

      // Notify new technician
      if (config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: technician.email,
          subject: `Case Assigned: ${caseData.caseNumber}`,
          body: `You have been assigned to case ${caseData.caseNumber}: ${caseData.title}. Priority: ${caseData.priority}`,
          type: 'email'
        });
      }

      // Notify customer about assignment
      if (config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: caseData.customerEmail,
          subject: `Technician Assigned: ${caseData.caseNumber}`,
          body: `${technician.full_name} has been assigned to your case ${caseData.caseNumber}.`,
          type: 'email'
        });
      }

      // Notify previous technician if reassignment
      if (previousTechnicianId) {
        const prevTechResult = await db.query(`
          SELECT u.email
          FROM technicians t
          JOIN users u ON t.user_id = u.id
          WHERE t.id = $1
        `, [previousTechnicianId]);

        if (prevTechResult.rows.length > 0 && config.notifications.enableEmailNotifications) {
          await this.sendNotification({
            to: prevTechResult.rows[0].email,
            subject: `Case Reassigned: ${caseData.caseNumber}`,
            body: `Case ${caseData.caseNumber} has been reassigned to another technician.`,
            type: 'email'
          });
        }
      }

      await this.logNotification(caseId, 'technician_assignment', 'Technician assignment notifications sent');

    } catch (error) {
      console.error('Send technician assignment notification error:', error);
    }
  }

  /**
   * Send notifications when priority changes
   */
  async sendPriorityChangeNotification(caseId: UUID, oldPriority: CasePriority, newPriority: CasePriority): Promise<void> {
    try {
      const caseData = await this.getCaseNotificationData(caseId);
      if (!caseData) return;

      // Only notify for priority increases (to urgent or high)
      if (['urgent', 'high'].includes(newPriority) && newPriority !== oldPriority) {
        // Notify technician
        if (caseData.technicianEmail && config.notifications.enableEmailNotifications) {
          await this.sendNotification({
            to: caseData.technicianEmail,
            subject: `Priority Changed: ${caseData.caseNumber}`,
            body: `Case ${caseData.caseNumber} priority has been changed from ${oldPriority} to ${newPriority}. Please review urgently.`,
            type: 'email'
          });
        }

        // Notify customer for urgent cases
        if (newPriority === 'urgent' && config.notifications.enableEmailNotifications) {
          await this.sendNotification({
            to: caseData.customerEmail,
            subject: `Urgent: ${caseData.caseNumber}`,
            body: `Your case ${caseData.caseNumber} has been marked as urgent and will be prioritized.`,
            type: 'email'
          });
        }
      }

      await this.logNotification(caseId, 'priority_change', `Priority change notifications sent: ${oldPriority} -> ${newPriority}`);

    } catch (error) {
      console.error('Send priority change notification error:', error);
    }
  }

  /**
   * Send notifications when a note is added
   */
  async sendNoteAddedNotification(caseId: UUID, noteContent: string): Promise<void> {
    try {
      const caseData = await this.getCaseNotificationData(caseId);
      if (!caseData) return;

      // Notify customer about technician notes
      if (config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: caseData.customerEmail,
          subject: `Update on Case: ${caseData.caseNumber}`,
          body: `There's an update on your case ${caseData.caseNumber}: ${noteContent.substring(0, 200)}${noteContent.length > 200 ? '...' : ''}`,
          type: 'email'
        });
      }

      await this.logNotification(caseId, 'note_added', 'Note added notification sent');

    } catch (error) {
      console.error('Send note added notification error:', error);
    }
  }

  /**
   * Send SLA breach notifications
   */
  async sendSLABreachNotification(caseId: UUID): Promise<void> {
    try {
      const caseData = await this.getCaseNotificationData(caseId);
      if (!caseData) return;

      // Notify technician
      if (caseData.technicianEmail && config.notifications.enableEmailNotifications) {
        await this.sendNotification({
          to: caseData.technicianEmail,
          subject: `SLA Breach: ${caseData.caseNumber}`,
          body: `Case ${caseData.caseNumber} has breached its SLA. Immediate attention required.`,
          type: 'email'
        });
      }

      // Notify management (this would be configured based on business rules)
      // For now, we'll log it
      console.warn(`SLA breach for case ${caseData.caseNumber}`);

      await this.logNotification(caseId, 'sla_breach', 'SLA breach notifications sent');

    } catch (error) {
      console.error('Send SLA breach notification error:', error);
    }
  }

  // Helper methods

  private async getCaseNotificationData(caseId: UUID): Promise<{
    caseNumber: string;
    title: string;
    priority: CasePriority;
    customerEmail: string;
    technicianEmail?: string;
  } | null> {
    try {
      const result = await db.query(`
        SELECT 
          rc.case_number,
          rc.title,
          rc.priority,
          c.email as customer_email,
          u.email as technician_email
        FROM repair_cases rc
        JOIN customers c ON rc.customer_id = c.id
        LEFT JOIN technicians t ON rc.assigned_technician_id = t.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE rc.id = $1
      `, [caseId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        caseNumber: row.case_number,
        title: row.title,
        priority: row.priority,
        customerEmail: row.customer_email,
        technicianEmail: row.technician_email
      };
    } catch (error) {
      console.error('Get case notification data error:', error);
      return null;
    }
  }

  private async sendNotification(notification: {
    to: string;
    subject: string;
    body: string;
    type: 'email' | 'sms' | 'push';
  }): Promise<void> {
    try {
      // In a real implementation, this would integrate with email/SMS services
      // For now, we'll just log the notification
      console.log(`Sending ${notification.type} notification:`, {
        to: notification.to,
        subject: notification.subject,
        body: notification.body
      });

      // If notification service URL is configured, send to external service
      if (config.notificationServiceUrl) {
        await fetch(`${config.notificationServiceUrl}/api/notifications/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notification)
        });
      }
    } catch (error) {
      console.error('Send notification error:', error);
    }
  }

  private async logNotification(caseId: UUID, type: string, message: string): Promise<void> {
    try {
      await db.query(`
        INSERT INTO case_timeline (case_id, event_type, description, created_by, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [caseId, 'notification', message, null, JSON.stringify({ type })]);
    } catch (error) {
      console.error('Log notification error:', error);
    }
  }
}