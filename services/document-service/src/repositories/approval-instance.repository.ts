import { Pool } from 'pg';
import { getDbConnection } from '../../../../shared/database/src/connection';
import { 
  ApprovalInstance,
  ApprovalRecord,
  EscalationRecord,
  DelegationRecord,
  ApprovalInstanceStatus,
  ApprovalStatus,
  ApprovalInstanceSearchCriteria,
  PendingApprovalsSearchCriteria,
  UUID 
} from '../types/approval';

export class ApprovalInstanceRepository {
  private db: Pool;

  constructor() {
    this.db = getDbConnection();
  }

  async createInstance(
    documentId: UUID,
    workflowId: UUID,
    submittedBy: UUID,
    urgency: string = 'normal'
  ): Promise<ApprovalInstance> {
    const query = `
      INSERT INTO approval_instances (
        document_id, workflow_id, submitted_by, urgency
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await this.db.query(query, [documentId, workflowId, submittedBy, urgency]);
    const instance = this.mapRowToInstance(result.rows[0]);
    
    // Load related data
    instance.approvals = await this.getApprovalRecords(instance.id);
    instance.escalations = await this.getEscalationRecords(instance.id);
    instance.delegations = await this.getDelegationRecords(instance.id);
    
    return instance;
  }

  async findById(id: UUID): Promise<ApprovalInstance | null> {
    const query = 'SELECT * FROM approval_instances WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const instance = this.mapRowToInstance(result.rows[0]);
    
    // Load related data
    instance.approvals = await this.getApprovalRecords(instance.id);
    instance.escalations = await this.getEscalationRecords(instance.id);
    instance.delegations = await this.getDelegationRecords(instance.id);
    
    return instance;
  }

  async findByDocumentId(documentId: UUID): Promise<ApprovalInstance | null> {
    const query = 'SELECT * FROM approval_instances WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1';
    const result = await this.db.query(query, [documentId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const instance = this.mapRowToInstance(result.rows[0]);
    
    // Load related data
    instance.approvals = await this.getApprovalRecords(instance.id);
    instance.escalations = await this.getEscalationRecords(instance.id);
    instance.delegations = await this.getDelegationRecords(instance.id);
    
    return instance;
  }

  async updateStatus(id: UUID, status: ApprovalInstanceStatus, completedAt?: Date): Promise<void> {
    const query = `
      UPDATE approval_instances 
      SET status = $1, completed_at = $2, updated_at = NOW()
      WHERE id = $3
    `;
    
    await this.db.query(query, [status, completedAt || null, id]);
  }

  async updateCurrentLevel(id: UUID, level: number): Promise<void> {
    const query = `
      UPDATE approval_instances 
      SET current_level = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await this.db.query(query, [level, id]);
  }

  // Approval Records
  async createApprovalRecord(
    instanceId: UUID,
    level: number,
    approverUserId: UUID,
    originalApproverUserId?: UUID
  ): Promise<ApprovalRecord> {
    const query = `
      INSERT INTO approval_records (
        instance_id, level, approver_user_id, original_approver_user_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      instanceId, 
      level, 
      approverUserId, 
      originalApproverUserId || null
    ]);
    
    return this.mapRowToApprovalRecord(result.rows[0]);
  }

  async updateApprovalRecord(
    id: UUID,
    status: ApprovalStatus,
    comments?: string,
    timeSpentMinutes?: number
  ): Promise<void> {
    const setClause: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [id, status];
    let paramIndex = 3;

    if (comments !== undefined) {
      setClause.push(`comments = $${paramIndex++}`);
      values.push(comments);
    }

    if (timeSpentMinutes !== undefined) {
      setClause.push(`time_spent_minutes = $${paramIndex++}`);
      values.push(timeSpentMinutes);
    }

    if (status === 'approved') {
      setClause.push(`approved_at = NOW()`);
    } else if (status === 'rejected') {
      setClause.push(`rejected_at = NOW()`);
    }

    const query = `
      UPDATE approval_records 
      SET ${setClause.join(', ')}
      WHERE id = $1
    `;

    await this.db.query(query, values);
  }

  async getApprovalRecords(instanceId: UUID): Promise<ApprovalRecord[]> {
    const query = `
      SELECT * FROM approval_records 
      WHERE instance_id = $1 
      ORDER BY level, created_at
    `;
    
    const result = await this.db.query(query, [instanceId]);
    return result.rows.map(row => this.mapRowToApprovalRecord(row));
  }

  async getPendingApprovalRecords(instanceId: UUID, level: number): Promise<ApprovalRecord[]> {
    const query = `
      SELECT * FROM approval_records 
      WHERE instance_id = $1 AND level = $2 AND status = 'pending'
      ORDER BY created_at
    `;
    
    const result = await this.db.query(query, [instanceId, level]);
    return result.rows.map(row => this.mapRowToApprovalRecord(row));
  }

  // Escalation Records
  async createEscalationRecord(
    instanceId: UUID,
    fromLevel: number,
    toLevel: number,
    reason: string,
    escalationType: string,
    escalatedBy?: UUID
  ): Promise<EscalationRecord> {
    const query = `
      INSERT INTO escalation_records (
        instance_id, from_level, to_level, reason, escalation_type, escalated_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      instanceId, fromLevel, toLevel, reason, escalationType, escalatedBy || null
    ]);
    
    return this.mapRowToEscalationRecord(result.rows[0]);
  }

  async getEscalationRecords(instanceId: UUID): Promise<EscalationRecord[]> {
    const query = `
      SELECT * FROM escalation_records 
      WHERE instance_id = $1 
      ORDER BY escalated_at
    `;
    
    const result = await this.db.query(query, [instanceId]);
    return result.rows.map(row => this.mapRowToEscalationRecord(row));
  }

  // Delegation Records
  async createDelegationRecord(
    instanceId: UUID,
    level: number,
    fromUserId: UUID,
    toUserId: UUID,
    reason?: string
  ): Promise<DelegationRecord> {
    const query = `
      INSERT INTO delegation_records (
        instance_id, level, from_user_id, to_user_id, reason
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      instanceId, level, fromUserId, toUserId, reason || null
    ]);
    
    return this.mapRowToDelegationRecord(result.rows[0]);
  }

  async getDelegationRecords(instanceId: UUID): Promise<DelegationRecord[]> {
    const query = `
      SELECT * FROM delegation_records 
      WHERE instance_id = $1 
      ORDER BY delegated_at
    `;
    
    const result = await this.db.query(query, [instanceId]);
    return result.rows.map(row => this.mapRowToDelegationRecord(row));
  }

  // Search and Query Methods
  async searchInstances(criteria: ApprovalInstanceSearchCriteria): Promise<{
    instances: ApprovalInstance[];
    total: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.documentId) {
      conditions.push(`document_id = $${paramIndex++}`);
      values.push(criteria.documentId);
    }

    if (criteria.workflowId) {
      conditions.push(`workflow_id = $${paramIndex++}`);
      values.push(criteria.workflowId);
    }

    if (criteria.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(criteria.status);
    }

    if (criteria.currentLevel) {
      conditions.push(`current_level = $${paramIndex++}`);
      values.push(criteria.currentLevel);
    }

    if (criteria.submittedBy) {
      conditions.push(`submitted_by = $${paramIndex++}`);
      values.push(criteria.submittedBy);
    }

    if (criteria.startedAfter) {
      conditions.push(`started_at >= $${paramIndex++}`);
      values.push(criteria.startedAfter);
    }

    if (criteria.startedBefore) {
      conditions.push(`started_at <= $${paramIndex++}`);
      values.push(criteria.startedBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) FROM approval_instances ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    const dataQuery = `
      SELECT * FROM approval_instances 
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const dataResult = await this.db.query(dataQuery, values);

    const instances = await Promise.all(
      dataResult.rows.map(async row => {
        const instance = this.mapRowToInstance(row);
        instance.approvals = await this.getApprovalRecords(instance.id);
        instance.escalations = await this.getEscalationRecords(instance.id);
        instance.delegations = await this.getDelegationRecords(instance.id);
        return instance;
      })
    );

    return { instances, total };
  }

  async getPendingApprovals(criteria: PendingApprovalsSearchCriteria): Promise<{
    approvals: ApprovalRecord[];
    total: number;
  }> {
    const conditions: string[] = ['ar.status = \'pending\'', 'ar.approver_user_id = $1'];
    const values: any[] = [criteria.approverUserId];
    let paramIndex = 2;

    if (criteria.workflowId) {
      conditions.push(`ai.workflow_id = $${paramIndex++}`);
      values.push(criteria.workflowId);
    }

    if (criteria.level) {
      conditions.push(`ar.level = $${paramIndex++}`);
      values.push(criteria.level);
    }

    if (criteria.submittedAfter) {
      conditions.push(`ai.started_at >= $${paramIndex++}`);
      values.push(criteria.submittedAfter);
    }

    if (criteria.submittedBefore) {
      conditions.push(`ai.started_at <= $${paramIndex++}`);
      values.push(criteria.submittedBefore);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM approval_records ar
      JOIN approval_instances ai ON ar.instance_id = ai.id
      ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    const dataQuery = `
      SELECT ar.*, ai.urgency, ai.started_at as instance_started_at
      FROM approval_records ar
      JOIN approval_instances ai ON ar.instance_id = ai.id
      ${whereClause}
      ORDER BY 
        CASE ai.urgency 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
        END,
        ai.started_at ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const dataResult = await this.db.query(dataQuery, values);

    return {
      approvals: dataResult.rows.map(row => this.mapRowToApprovalRecord(row)),
      total
    };
  }

  // Mapping methods
  private mapRowToInstance(row: any): ApprovalInstance {
    return {
      id: row.id,
      documentId: row.document_id,
      workflowId: row.workflow_id,
      currentLevel: row.current_level,
      status: row.status as ApprovalInstanceStatus,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      approvals: [], // Will be loaded separately
      escalations: [], // Will be loaded separately
      delegations: [], // Will be loaded separately
      createdBy: row.submitted_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToApprovalRecord(row: any): ApprovalRecord {
    return {
      id: row.id,
      instanceId: row.instance_id,
      level: row.level,
      approverUserId: row.approver_user_id,
      originalApproverUserId: row.original_approver_user_id,
      status: row.status as ApprovalStatus,
      comments: row.comments,
      approvedAt: row.approved_at,
      rejectedAt: row.rejected_at,
      timeSpentMinutes: row.time_spent_minutes,
      createdBy: row.approver_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapRowToEscalationRecord(row: any): EscalationRecord {
    return {
      id: row.id,
      instanceId: row.instance_id,
      fromLevel: row.from_level,
      toLevel: row.to_level,
      reason: row.reason,
      escalationType: row.escalation_type,
      escalatedBy: row.escalated_by,
      escalatedAt: row.escalated_at,
      createdBy: row.escalated_by || 'system',
      createdAt: row.created_at,
      updatedAt: row.created_at
    };
  }

  private mapRowToDelegationRecord(row: any): DelegationRecord {
    return {
      id: row.id,
      instanceId: row.instance_id,
      level: row.level,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      delegatedAt: row.delegated_at,
      reason: row.reason,
      createdBy: row.from_user_id,
      createdAt: row.created_at,
      updatedAt: row.created_at
    };
  }
}