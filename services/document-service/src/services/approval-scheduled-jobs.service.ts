import { ApprovalInstanceRepository } from '../repositories/approval-instance.repository';
import { ApprovalWorkflowRepository } from '../repositories/approval-workflow.repository';
import { ApprovalNotificationRepository, CreateNotificationRequest } from '../repositories/approval-notification.repository';
import { ApprovalNotificationService } from './approval-notification.service';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { 
  ApprovalInstance, 
  ApprovalWorkflow, 
  ApprovalLevel,
  EscalationType,
  UUID 
} from '../types/approval';

export class ApprovalScheduledJobsService {
  private instanceRepository: ApprovalInstanceRepository;
  private workflowRepository: ApprovalWorkflowRepository;
  private notificationRepository: ApprovalNotificationRepository;
  private notificationService: ApprovalNotificationService;
  private workflowService: ApprovalWorkflowService;

  constructor() {
    this.instanceRepository = new ApprovalInstanceRepository();
    this.workflowRepository = new ApprovalWorkflowRepository();
    this.notificationRepository = new ApprovalNotificationRepository();
    this.notificationService = new ApprovalNotificationService();
    this.workflowService = new ApprovalWorkflowService();
  }

  // Main job runner - should be called by a scheduler (cron job, etc.)
  async runScheduledJobs(): Promise<void> {
    console.log('Running approval scheduled jobs...');

    try {
      // Process pending notifications
      await this.notificationService.processPendingNotifications();

      // Check for approval timeouts
      await this.checkApprovalTimeouts();

      // Send reminder notifications
      await this.sendReminderNotifications();

      // Retry failed notifications
      await this.notificationService.retryFailedNotifications();

      // Clean up old notifications
      await this.cleanupOldNotifications();

      console.log('Approval scheduled jobs completed successfully');
    } catch (error) {
      console.error('Error running approval scheduled jobs:', error);
    }
  }

  // Check for approval timeouts and escalate if needed
  private async checkApprovalTimeouts(): Promise<void> {
    console.log('Checking for approval timeouts...');

    // Get all in-progress approval instances
    const inProgressInstances = await this.instanceRepository.searchInstances({
      status: 'in_progress',
      limit: 1000
    });

    for (const instance of inProgressInstances.instances) {
      try {
        await this.checkInstanceTimeout(instance);
      } catch (error) {
        console.error(`Error checking timeout for instance ${instance.id}:`, error);
      }
    }
  }

  private async checkInstanceTimeout(instance: ApprovalInstance): Promise<void> {
    const workflow = await this.workflowRepository.findById(instance.workflowId);
    if (!workflow) {
      return;
    }

    const currentLevel = workflow.levels.find(l => l.level === instance.currentLevel);
    if (!currentLevel || !currentLevel.timeoutHours) {
      return;
    }

    // Check if current level has timed out
    const timeoutDate = new Date(instance.startedAt.getTime() + currentLevel.timeoutHours * 60 * 60 * 1000);
    const now = new Date();

    if (now > timeoutDate) {
      await this.handleLevelTimeout(instance, workflow, currentLevel);
    }
  }

  private async handleLevelTimeout(
    instance: ApprovalInstance, 
    workflow: ApprovalWorkflow, 
    level: ApprovalLevel
  ): Promise<void> {
    console.log(`Handling timeout for instance ${instance.id}, level ${level.level}`);

    // Find escalation rule for this level
    const escalationRule = workflow.escalationRules.find(
      rule => rule.fromLevel === level.level && rule.triggerAfterHours <= (level.timeoutHours || 0)
    );

    if (escalationRule) {
      // Create escalation record
      await this.instanceRepository.createEscalationRecord(
        instance.id,
        escalationRule.fromLevel,
        escalationRule.toLevel,
        `Automatic escalation due to timeout after ${level.timeoutHours} hours`,
        'timeout'
      );

      // Update instance level
      await this.instanceRepository.updateCurrentLevel(instance.id, escalationRule.toLevel);

      // Create approval records for new level
      const newLevel = workflow.levels.find(l => l.level === escalationRule.toLevel);
      if (newLevel) {
        await this.createApprovalRecordsForLevel(instance.id, newLevel);
      }

      // Send escalation notifications
      for (const userId of escalationRule.notifyUsers) {
        await this.notificationRepository.createNotification({
          instanceId: instance.id,
          notificationType: 'approval_escalated',
          recipientUserId: userId,
          channel: 'email',
          template: 'approval_approval_escalated',
          data: {
            fromLevel: escalationRule.fromLevel,
            toLevel: escalationRule.toLevel,
            reason: 'Timeout escalation'
          }
        });
      }

      // Auto-approve if configured
      if (escalationRule.autoApprove) {
        await this.autoApproveInstance(instance);
      }
    }
  }

  private async autoApproveInstance(instance: ApprovalInstance): Promise<void> {
    // Update instance status to approved
    await this.instanceRepository.updateStatus(instance.id, 'approved', new Date());

    // Send completion notification
    await this.notificationRepository.createNotification({
      instanceId: instance.id,
      notificationType: 'approval_completed',
      recipientUserId: instance.createdBy,
      channel: 'in_app',
      template: 'approval_approval_completed',
      data: {
        completedAt: new Date(),
        reason: 'Auto-approved due to escalation rule'
      }
    });
  }

  // Send reminder notifications for pending approvals
  private async sendReminderNotifications(): Promise<void> {
    console.log('Sending reminder notifications...');

    // Get all in-progress instances that need reminders
    const inProgressInstances = await this.instanceRepository.searchInstances({
      status: 'in_progress',
      limit: 1000
    });

    for (const instance of inProgressInstances.instances) {
      try {
        await this.checkReminderNeeded(instance);
      } catch (error) {
        console.error(`Error checking reminders for instance ${instance.id}:`, error);
      }
    }
  }

  private async checkReminderNeeded(instance: ApprovalInstance): Promise<void> {
    const workflow = await this.workflowRepository.findById(instance.workflowId);
    if (!workflow) {
      return;
    }

    // Check if we should send reminders (e.g., after 24 hours, then every 24 hours)
    const hoursSinceStart = (Date.now() - instance.startedAt.getTime()) / (1000 * 60 * 60);
    
    // Send first reminder after 24 hours, then every 24 hours
    if (hoursSinceStart >= 24 && Math.floor(hoursSinceStart) % 24 === 0) {
      await this.sendLevelReminders(instance, workflow);
    }
  }

  private async sendLevelReminders(instance: ApprovalInstance, workflow: ApprovalWorkflow): Promise<void> {
    const currentLevel = workflow.levels.find(l => l.level === instance.currentLevel);
    if (!currentLevel) {
      return;
    }

    // Get pending approvals for current level
    const pendingApprovals = await this.instanceRepository.getPendingApprovalRecords(
      instance.id, 
      instance.currentLevel
    );

    // Send reminder to each pending approver
    for (const approval of pendingApprovals) {
      await this.notificationRepository.createNotification({
        instanceId: instance.id,
        notificationType: 'approval_reminder',
        recipientUserId: approval.approverUserId,
        channel: 'email',
        template: 'approval_approval_reminder',
        data: {
          level: instance.currentLevel,
          levelName: currentLevel.name,
          daysPending: Math.floor((Date.now() - instance.startedAt.getTime()) / (1000 * 60 * 60 * 24))
        }
      });
    }
  }

  // Clean up old notifications
  private async cleanupOldNotifications(): Promise<void> {
    console.log('Cleaning up old notifications...');

    try {
      const deletedCount = await this.notificationRepository.deleteOldNotifications(90); // 90 days
      console.log(`Deleted ${deletedCount} old notifications`);
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
    }
  }

  // Helper method to create approval records for a level
  private async createApprovalRecordsForLevel(instanceId: UUID, level: ApprovalLevel): Promise<void> {
    // Get approvers for this level
    const approvers = await this.getApproversForLevel(level);

    // Create approval records
    for (const approverId of approvers) {
      await this.instanceRepository.createApprovalRecord(instanceId, level.level, approverId);
    }
  }

  private async getApproversForLevel(level: ApprovalLevel): Promise<UUID[]> {
    const approvers: UUID[] = [];

    // Add specific users
    if (level.approverIds) {
      approvers.push(...level.approverIds);
    }

    // Add users by role (would need integration with auth service)
    if (level.approverRoles) {
      // TODO: Integrate with auth service to get users by role
      // const roleUsers = await this.authService.getUsersByRoles(level.approverRoles);
      // approvers.push(...roleUsers);
    }

    return approvers;
  }

  // Method to start the scheduled job runner
  startScheduledJobs(intervalMinutes: number = 15): void {
    console.log(`Starting approval scheduled jobs with ${intervalMinutes} minute interval`);

    // Run immediately
    this.runScheduledJobs();

    // Then run at intervals
    setInterval(() => {
      this.runScheduledJobs();
    }, intervalMinutes * 60 * 1000);
  }
}