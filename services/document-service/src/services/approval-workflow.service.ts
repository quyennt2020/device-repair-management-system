import { 
  ApprovalWorkflow,
  ApprovalInstance,
  ApprovalRecord,
  CreateApprovalWorkflowRequest,
  UpdateApprovalWorkflowRequest,
  SubmitForApprovalRequest,
  ProcessApprovalRequest,
  DelegateApprovalRequest,
  EscalateApprovalRequest,
  ApprovalWorkflowSearchCriteria,
  ApprovalInstanceSearchCriteria,
  PendingApprovalsSearchCriteria,
  ApprovalInstanceStatus,
  ApprovalStatus,
  ApprovalAction,
  ApprovalLevel,
  EscalationType,
  UUID 
} from '../types/approval';
import { ApprovalWorkflowRepository } from '../repositories/approval-workflow.repository';
import { ApprovalInstanceRepository } from '../repositories/approval-instance.repository';
import { ApprovalNotificationRepository, CreateNotificationRequest } from '../repositories/approval-notification.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentTypeRepository } from '../repositories/document-type.repository';

export class ApprovalWorkflowService {
  private workflowRepository: ApprovalWorkflowRepository;
  private instanceRepository: ApprovalInstanceRepository;
  private notificationRepository: ApprovalNotificationRepository;
  private documentRepository: DocumentRepository;
  private documentTypeRepository: DocumentTypeRepository;

  constructor() {
    this.workflowRepository = new ApprovalWorkflowRepository();
    this.instanceRepository = new ApprovalInstanceRepository();
    this.notificationRepository = new ApprovalNotificationRepository();
    this.documentRepository = new DocumentRepository();
    this.documentTypeRepository = new DocumentTypeRepository();
  }

  // Workflow Management
  async createWorkflow(request: CreateApprovalWorkflowRequest, createdBy: UUID): Promise<ApprovalWorkflow> {
    // Validate workflow configuration
    this.validateWorkflowLevels(request.levels);
    
    return this.workflowRepository.create(request, createdBy);
  }

  async getWorkflow(id: UUID): Promise<ApprovalWorkflow | null> {
    return this.workflowRepository.findById(id);
  }

  async updateWorkflow(
    id: UUID, 
    request: UpdateApprovalWorkflowRequest, 
    updatedBy: UUID
  ): Promise<ApprovalWorkflow> {
    if (request.levels) {
      this.validateWorkflowLevels(request.levels);
    }
    
    return this.workflowRepository.update(id, request, updatedBy);
  }

  async deleteWorkflow(id: UUID): Promise<void> {
    // Check if workflow is being used by any active instances
    const activeInstances = await this.instanceRepository.searchInstances({
      workflowId: id,
      status: 'in_progress'
    });

    if (activeInstances.total > 0) {
      throw new Error('Cannot delete workflow with active approval instances');
    }

    await this.workflowRepository.delete(id);
  }

  async searchWorkflows(criteria: ApprovalWorkflowSearchCriteria): Promise<{
    workflows: ApprovalWorkflow[];
    total: number;
  }> {
    return this.workflowRepository.search(criteria);
  }

  // Document Approval Process
  async submitDocumentForApproval(request: SubmitForApprovalRequest): Promise<ApprovalInstance> {
    // Get document and validate
    const document = await this.documentRepository.findById(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'draft') {
      throw new Error('Can only submit documents in draft status');
    }

    // Find appropriate workflow
    const workflows = await this.workflowRepository.findByDocumentTypeId(document.documentTypeId);
    if (workflows.length === 0) {
      throw new Error('No approval workflow configured for this document type');
    }

    const workflow = workflows[0]; // Use the first active workflow

    // Create approval instance
    const instance = await this.instanceRepository.createInstance(
      request.documentId,
      workflow.id,
      request.submittedBy,
      request.urgency || 'normal'
    );

    // Update document status
    await this.documentRepository.updateStatus(request.documentId, 'submitted');

    // Start approval process
    await this.startApprovalProcess(instance, workflow);

    return instance;
  }

  async processApproval(request: ProcessApprovalRequest): Promise<void> {
    const instance = await this.instanceRepository.findById(request.instanceId);
    if (!instance) {
      throw new Error('Approval instance not found');
    }

    if (instance.status !== 'in_progress') {
      throw new Error('Approval instance is not in progress');
    }

    // Find the approval record for this user and level
    const approvalRecord = instance.approvals.find(
      a => a.level === request.level && 
           a.approverUserId === request.approverUserId && 
           a.status === 'pending'
    );

    if (!approvalRecord) {
      throw new Error('No pending approval found for this user at this level');
    }

    // Process the approval action
    switch (request.action) {
      case 'approve':
        await this.approveRecord(instance, approvalRecord, request.comments);
        break;
      case 'reject':
        await this.rejectRecord(instance, approvalRecord, request.comments || 'Rejected');
        break;
      case 'delegate':
        throw new Error('Use delegateApproval method for delegation');
      case 'escalate':
        throw new Error('Use escalateApproval method for escalation');
      default:
        throw new Error('Invalid approval action');
    }
  }

  async delegateApproval(request: DelegateApprovalRequest): Promise<void> {
    const instance = await this.instanceRepository.findById(request.instanceId);
    if (!instance) {
      throw new Error('Approval instance not found');
    }

    // Find the approval record
    const approvalRecord = instance.approvals.find(
      a => a.level === request.level && 
           a.approverUserId === request.fromUserId && 
           a.status === 'pending'
    );

    if (!approvalRecord) {
      throw new Error('No pending approval found for delegation');
    }

    // Create delegation record
    await this.instanceRepository.createDelegationRecord(
      request.instanceId,
      request.level,
      request.fromUserId,
      request.toUserId,
      request.reason
    );

    // Create new approval record for delegate
    await this.instanceRepository.createApprovalRecord(
      request.instanceId,
      request.level,
      request.toUserId,
      request.fromUserId // Original approver
    );

    // Update original approval record
    await this.instanceRepository.updateApprovalRecord(
      approvalRecord.id,
      'delegated',
      `Delegated to user ${request.toUserId}: ${request.reason || 'No reason provided'}`
    );

    // Send notification to delegate
    await this.sendApprovalNotification(
      request.instanceId,
      'approval_delegated',
      request.toUserId,
      {
        delegatedBy: request.fromUserId,
        reason: request.reason,
        level: request.level
      }
    );
  }

  async escalateApproval(request: EscalateApprovalRequest): Promise<void> {
    const instance = await this.instanceRepository.findById(request.instanceId);
    if (!instance) {
      throw new Error('Approval instance not found');
    }

    const workflow = await this.workflowRepository.findById(instance.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Validate escalation
    if (request.toLevel <= request.fromLevel) {
      throw new Error('Can only escalate to higher levels');
    }

    if (request.toLevel > workflow.levels.length) {
      throw new Error('Cannot escalate beyond maximum workflow level');
    }

    // Create escalation record
    await this.instanceRepository.createEscalationRecord(
      request.instanceId,
      request.fromLevel,
      request.toLevel,
      request.reason,
      'manual',
      request.escalatedBy
    );

    // Update instance to new level
    await this.instanceRepository.updateCurrentLevel(request.instanceId, request.toLevel);

    // Create approval records for new level
    const newLevel = workflow.levels.find(l => l.level === request.toLevel);
    if (newLevel) {
      await this.createApprovalRecordsForLevel(request.instanceId, newLevel);
    }

    // Send notifications
    await this.sendEscalationNotifications(request.instanceId, request.fromLevel, request.toLevel);
  }

  // Query Methods
  async searchApprovalInstances(criteria: ApprovalInstanceSearchCriteria): Promise<{
    instances: ApprovalInstance[];
    total: number;
  }> {
    return this.instanceRepository.searchInstances(criteria);
  }

  async getPendingApprovals(criteria: PendingApprovalsSearchCriteria): Promise<{
    approvals: ApprovalRecord[];
    total: number;
  }> {
    return this.instanceRepository.getPendingApprovals(criteria);
  }

  async getApprovalHistory(documentId: UUID): Promise<ApprovalInstance[]> {
    const instances = await this.instanceRepository.searchInstances({
      documentId,
      limit: 100
    });
    return instances.instances;
  }

  // Private Helper Methods
  private async startApprovalProcess(instance: ApprovalInstance, workflow: ApprovalWorkflow): Promise<void> {
    // Update instance status
    await this.instanceRepository.updateStatus(instance.id, 'in_progress');

    // Start with first level
    const firstLevel = workflow.levels.find(l => l.level === 1);
    if (!firstLevel) {
      throw new Error('Workflow must have at least one level');
    }

    // Check skip conditions
    if (await this.shouldSkipLevel(instance.documentId, firstLevel)) {
      await this.moveToNextLevel(instance, workflow, 1);
      return;
    }

    // Create approval records for first level
    await this.createApprovalRecordsForLevel(instance.id, firstLevel);

    // Send notifications
    await this.sendLevelNotifications(instance.id, firstLevel);
  }

  private async approveRecord(
    instance: ApprovalInstance, 
    approvalRecord: ApprovalRecord, 
    comments?: string
  ): Promise<void> {
    // Update approval record
    await this.instanceRepository.updateApprovalRecord(
      approvalRecord.id,
      'approved',
      comments
    );

    // Check if level is complete
    const workflow = await this.workflowRepository.findById(instance.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const currentLevel = workflow.levels.find(l => l.level === instance.currentLevel);
    if (!currentLevel) {
      throw new Error('Current level not found in workflow');
    }

    const levelApprovals = instance.approvals.filter(a => a.level === instance.currentLevel);
    const approvedCount = levelApprovals.filter(a => a.status === 'approved').length + 1; // +1 for current approval

    if (approvedCount >= currentLevel.requiredApprovals) {
      // Level is complete, move to next level or complete workflow
      await this.moveToNextLevel(instance, workflow, instance.currentLevel);
    }

    // Send approval notification
    await this.sendApprovalNotification(
      instance.id,
      'approval_approved',
      approvalRecord.approverUserId,
      { comments, level: instance.currentLevel }
    );
  }

  private async rejectRecord(
    instance: ApprovalInstance, 
    approvalRecord: ApprovalRecord, 
    reason: string
  ): Promise<void> {
    // Update approval record
    await this.instanceRepository.updateApprovalRecord(
      approvalRecord.id,
      'rejected',
      reason
    );

    // Update instance and document status
    await this.instanceRepository.updateStatus(instance.id, 'rejected', new Date());
    await this.documentRepository.updateStatus(instance.documentId, 'rejected');

    // Send rejection notifications
    await this.sendApprovalNotification(
      instance.id,
      'approval_rejected',
      approvalRecord.approverUserId,
      { reason, level: instance.currentLevel }
    );

    // Notify submitter
    await this.sendApprovalNotification(
      instance.id,
      'approval_rejected',
      instance.createdBy,
      { reason, level: instance.currentLevel, rejectedBy: approvalRecord.approverUserId }
    );
  }

  private async moveToNextLevel(
    instance: ApprovalInstance, 
    workflow: ApprovalWorkflow, 
    currentLevel: number
  ): Promise<void> {
    const nextLevel = workflow.levels.find(l => l.level === currentLevel + 1);
    
    if (!nextLevel) {
      // Workflow complete
      await this.completeApprovalWorkflow(instance);
      return;
    }

    // Check skip conditions for next level
    if (await this.shouldSkipLevel(instance.documentId, nextLevel)) {
      await this.moveToNextLevel(instance, workflow, nextLevel.level);
      return;
    }

    // Move to next level
    await this.instanceRepository.updateCurrentLevel(instance.id, nextLevel.level);

    // Create approval records for next level
    await this.createApprovalRecordsForLevel(instance.id, nextLevel);

    // Send notifications
    await this.sendLevelNotifications(instance.id, nextLevel);
  }

  private async completeApprovalWorkflow(instance: ApprovalInstance): Promise<void> {
    // Update instance status
    await this.instanceRepository.updateStatus(instance.id, 'approved', new Date());

    // Update document status
    await this.documentRepository.updateStatus(instance.documentId, 'approved');

    // Send completion notifications
    await this.sendApprovalNotification(
      instance.id,
      'approval_completed',
      instance.createdBy,
      { completedAt: new Date() }
    );
  }

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

  private async shouldSkipLevel(documentId: UUID, level: ApprovalLevel): Promise<boolean> {
    if (!level.skipConditions || level.skipConditions.length === 0) {
      return false;
    }

    const document = await this.documentRepository.findById(documentId);
    if (!document) {
      return false;
    }

    // Evaluate skip conditions
    for (const condition of level.skipConditions) {
      const fieldValue = this.getFieldValue(document.content, condition.field);
      
      if (!this.evaluateCondition(fieldValue, condition.operator, condition.value)) {
        return false;
      }
    }

    return true;
  }

  private getFieldValue(content: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = content;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < expectedValue;
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > expectedValue;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(expectedValue);
      default:
        return false;
    }
  }

  private async sendLevelNotifications(instanceId: UUID, level: ApprovalLevel): Promise<void> {
    const approvers = await this.getApproversForLevel(level);
    
    for (const approverId of approvers) {
      await this.sendApprovalNotification(
        instanceId,
        'approval_request',
        approverId,
        { level: level.level, levelName: level.name }
      );
    }
  }

  private async sendEscalationNotifications(
    instanceId: UUID, 
    fromLevel: number, 
    toLevel: number
  ): Promise<void> {
    // This would integrate with notification service
    // For now, just create notification records
    await this.sendApprovalNotification(
      instanceId,
      'approval_escalated',
      'system', // Would be replaced with actual recipients
      { fromLevel, toLevel }
    );
  }

  private async sendApprovalNotification(
    instanceId: UUID,
    type: string,
    recipientUserId: UUID,
    data: any
  ): Promise<void> {
    const notificationRequest: CreateNotificationRequest = {
      instanceId,
      notificationType: type,
      recipientUserId,
      channel: 'in_app', // Default channel
      template: `approval_${type}`,
      data
    };

    await this.notificationRepository.createNotification(notificationRequest);
  }

  private validateWorkflowLevels(levels: ApprovalLevel[]): void {
    if (levels.length === 0) {
      throw new Error('Workflow must have at least one level');
    }

    // Check level numbering
    const levelNumbers = levels.map(l => l.level).sort((a, b) => a - b);
    for (let i = 0; i < levelNumbers.length; i++) {
      if (levelNumbers[i] !== i + 1) {
        throw new Error('Workflow levels must be numbered consecutively starting from 1');
      }
    }

    // Validate each level
    for (const level of levels) {
      if (level.requiredApprovals < 1) {
        throw new Error('Each level must require at least 1 approval');
      }

      if (!level.approverIds?.length && !level.approverRoles?.length) {
        throw new Error('Each level must have at least one approver or role specified');
      }
    }
  }
}