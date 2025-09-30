import { ApprovalNotificationRepository, ApprovalNotificationRecord } from '../repositories/approval-notification.repository';
import { ApprovalInstanceRepository } from '../repositories/approval-instance.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { UUID } from '../types/approval';

export interface NotificationTemplate {
  subject: string;
  body: string;
  variables: string[];
}

export interface NotificationChannel {
  type: 'email' | 'in_app' | 'sms' | 'webhook';
  config: any;
}

export interface EmailNotificationData {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface InAppNotificationData {
  userId: UUID;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  actionUrl?: string;
}

export interface SMSNotificationData {
  to: string;
  message: string;
}

export interface WebhookNotificationData {
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  payload: any;
}

export class ApprovalNotificationService {
  private notificationRepository: ApprovalNotificationRepository;
  private instanceRepository: ApprovalInstanceRepository;
  private documentRepository: DocumentRepository;
  private templates: Map<string, NotificationTemplate>;

  constructor() {
    this.notificationRepository = new ApprovalNotificationRepository();
    this.instanceRepository = new ApprovalInstanceRepository();
    this.documentRepository = new DocumentRepository();
    this.templates = new Map();
    this.initializeTemplates();
  }

  // Process pending notifications
  async processPendingNotifications(): Promise<void> {
    const pendingNotifications = await this.notificationRepository.getPendingNotifications(100);

    for (const notification of pendingNotifications) {
      try {
        await this.sendNotification(notification);
        await this.notificationRepository.markNotificationSent(notification.id);
      } catch (error) {
        console.error(`Failed to send notification ${notification.id}:`, error);
        await this.notificationRepository.markNotificationFailed(
          notification.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  // Send individual notification
  private async sendNotification(notification: ApprovalNotificationRecord): Promise<void> {
    const template = this.templates.get(notification.template);
    if (!template) {
      throw new Error(`Template not found: ${notification.template}`);
    }

    // Get additional context data
    const context = await this.getNotificationContext(notification);
    
    // Render template with data
    const renderedContent = this.renderTemplate(template, { ...notification.data, ...context });

    // Send based on channel
    switch (notification.channel) {
      case 'email':
        await this.sendEmailNotification(notification, renderedContent);
        break;
      case 'in_app':
        await this.sendInAppNotification(notification, renderedContent);
        break;
      case 'sms':
        await this.sendSMSNotification(notification, renderedContent);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification, renderedContent);
        break;
      default:
        throw new Error(`Unsupported notification channel: ${notification.channel}`);
    }
  }

  // Channel-specific sending methods
  private async sendEmailNotification(
    notification: ApprovalNotificationRecord,
    content: { subject: string; body: string }
  ): Promise<void> {
    // This would integrate with an email service (SendGrid, AWS SES, etc.)
    const emailData: EmailNotificationData = {
      to: await this.getUserEmail(notification.recipientUserId),
      subject: content.subject,
      body: content.body,
      html: this.convertToHTML(content.body)
    };

    // TODO: Integrate with actual email service
    console.log('Sending email notification:', emailData);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendInAppNotification(
    notification: ApprovalNotificationRecord,
    content: { subject: string; body: string }
  ): Promise<void> {
    const inAppData: InAppNotificationData = {
      userId: notification.recipientUserId,
      title: content.subject,
      message: content.body,
      type: this.getNotificationTypeFromTemplate(notification.template),
      actionUrl: this.getActionUrl(notification)
    };

    // TODO: Integrate with in-app notification system (WebSocket, etc.)
    console.log('Sending in-app notification:', inAppData);
    
    // This would typically publish to a message queue or WebSocket
    await this.publishInAppNotification(inAppData);
  }

  private async sendSMSNotification(
    notification: ApprovalNotificationRecord,
    content: { subject: string; body: string }
  ): Promise<void> {
    const smsData: SMSNotificationData = {
      to: await this.getUserPhoneNumber(notification.recipientUserId),
      message: `${content.subject}: ${content.body}`
    };

    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log('Sending SMS notification:', smsData);
    
    // Simulate SMS sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendWebhookNotification(
    notification: ApprovalNotificationRecord,
    content: { subject: string; body: string }
  ): Promise<void> {
    const webhookData: WebhookNotificationData = {
      url: notification.data.webhookUrl || process.env.DEFAULT_WEBHOOK_URL || '',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Notification-Type': notification.notificationType
      },
      payload: {
        notificationId: notification.id,
        instanceId: notification.instanceId,
        type: notification.notificationType,
        recipient: notification.recipientUserId,
        subject: content.subject,
        body: content.body,
        data: notification.data,
        timestamp: new Date().toISOString()
      }
    };

    // TODO: Make actual HTTP request
    console.log('Sending webhook notification:', webhookData);
    
    // Simulate webhook call
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Helper methods
  private async getNotificationContext(notification: ApprovalNotificationRecord): Promise<any> {
    const instance = await this.instanceRepository.findById(notification.instanceId);
    if (!instance) {
      return {};
    }

    const document = await this.documentRepository.findById(instance.documentId);
    if (!document) {
      return {};
    }

    return {
      instanceId: instance.id,
      documentId: document.id,
      caseId: document.caseId,
      currentLevel: instance.currentLevel,
      status: instance.status,
      submittedAt: instance.startedAt,
      documentType: document.documentTypeId
    };
  }

  private renderTemplate(template: NotificationTemplate, data: any): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    // Simple template variable replacement
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return { subject, body };
  }

  private getNotificationTypeFromTemplate(template: string): 'info' | 'warning' | 'success' | 'error' {
    if (template.includes('rejected') || template.includes('failed')) {
      return 'error';
    }
    if (template.includes('approved') || template.includes('completed')) {
      return 'success';
    }
    if (template.includes('escalated') || template.includes('timeout')) {
      return 'warning';
    }
    return 'info';
  }

  private getActionUrl(notification: ApprovalNotificationRecord): string {
    const baseUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
    
    switch (notification.notificationType) {
      case 'approval_request':
        return `${baseUrl}/approvals/${notification.instanceId}`;
      case 'approval_delegated':
        return `${baseUrl}/approvals/${notification.instanceId}`;
      default:
        return `${baseUrl}/documents/${notification.data.documentId}`;
    }
  }

  private convertToHTML(text: string): string {
    // Simple text to HTML conversion
    return text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  private async getUserEmail(userId: UUID): Promise<string> {
    // TODO: Integrate with user service to get email
    return `user-${userId}@example.com`;
  }

  private async getUserPhoneNumber(userId: UUID): Promise<string> {
    // TODO: Integrate with user service to get phone number
    return `+1234567890`;
  }

  private async publishInAppNotification(data: InAppNotificationData): Promise<void> {
    // TODO: Integrate with WebSocket service or message queue
    // This would typically publish to Redis, RabbitMQ, or similar
    console.log('Publishing in-app notification:', data);
  }

  // Retry failed notifications
  async retryFailedNotifications(): Promise<void> {
    // This would be called by a scheduled job
    const failedNotifications = await this.notificationRepository.getPendingNotifications(50);
    
    for (const notification of failedNotifications) {
      if (notification.retryCount < 3) {
        // Exponential backoff: 5 minutes, 15 minutes, 45 minutes
        const delayMinutes = Math.pow(3, notification.retryCount) * 5;
        const newScheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        
        await this.notificationRepository.retryFailedNotification(notification.id, newScheduledAt);
      }
    }
  }

  // Initialize notification templates
  private initializeTemplates(): void {
    this.templates.set('approval_approval_request', {
      subject: 'Approval Required: {{documentType}} for Case {{caseId}}',
      body: `You have a new document approval request.

Document: {{documentType}}
Case: {{caseId}}
Level: {{level}} - {{levelName}}
Submitted: {{submittedAt}}

Please review and approve or reject this document.

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'level', 'levelName', 'submittedAt', 'actionUrl']
    });

    this.templates.set('approval_approval_reminder', {
      subject: 'Reminder: Approval Required for Case {{caseId}}',
      body: `This is a reminder that you have a pending approval request.

Document: {{documentType}}
Case: {{caseId}}
Level: {{level}} - {{levelName}}
Submitted: {{submittedAt}}

Please review and approve or reject this document.

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'level', 'levelName', 'submittedAt', 'actionUrl']
    });

    this.templates.set('approval_approval_approved', {
      subject: 'Document Approved: {{documentType}} for Case {{caseId}}',
      body: `A document has been approved.

Document: {{documentType}}
Case: {{caseId}}
Level: {{level}}
Approved by: {{approvedBy}}
Comments: {{comments}}

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'level', 'approvedBy', 'comments', 'actionUrl']
    });

    this.templates.set('approval_approval_rejected', {
      subject: 'Document Rejected: {{documentType}} for Case {{caseId}}',
      body: `A document has been rejected.

Document: {{documentType}}
Case: {{caseId}}
Level: {{level}}
Rejected by: {{rejectedBy}}
Reason: {{reason}}

Please review the feedback and resubmit if necessary.

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'level', 'rejectedBy', 'reason', 'actionUrl']
    });

    this.templates.set('approval_approval_escalated', {
      subject: 'Approval Escalated: {{documentType}} for Case {{caseId}}',
      body: `An approval has been escalated.

Document: {{documentType}}
Case: {{caseId}}
From Level: {{fromLevel}}
To Level: {{toLevel}}
Reason: {{reason}}

Please review this escalated approval request.

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'fromLevel', 'toLevel', 'reason', 'actionUrl']
    });

    this.templates.set('approval_approval_delegated', {
      subject: 'Approval Delegated: {{documentType}} for Case {{caseId}}',
      body: `An approval has been delegated to you.

Document: {{documentType}}
Case: {{caseId}}
Level: {{level}}
Delegated by: {{delegatedBy}}
Reason: {{reason}}

Please review and approve or reject this document.

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'level', 'delegatedBy', 'reason', 'actionUrl']
    });

    this.templates.set('approval_approval_completed', {
      subject: 'Approval Completed: {{documentType}} for Case {{caseId}}',
      body: `The approval workflow has been completed.

Document: {{documentType}}
Case: {{caseId}}
Completed: {{completedAt}}

The document is now approved and ready for the next step.

View Document: {{actionUrl}}`,
      variables: ['documentType', 'caseId', 'completedAt', 'actionUrl']
    });
  }
}