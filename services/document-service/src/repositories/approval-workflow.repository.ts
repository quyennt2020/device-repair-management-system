import { Pool } from 'pg';
import { getDbConnection } from '../../../../shared/database/src/connection';
import { 
  ApprovalWorkflow,
  CreateApprovalWorkflowRequest,
  UpdateApprovalWorkflowRequest,
  ApprovalWorkflowSearchCriteria,
  UUID 
} from '../types/approval';

export class ApprovalWorkflowRepository {
  private db: Pool;

  constructor() {
    this.db = getDbConnection();
  }

  async create(request: CreateApprovalWorkflowRequest, createdBy: UUID): Promise<ApprovalWorkflow> {
    const query = `
      INSERT INTO approval_workflows (
        name, description, document_type_ids, levels, 
        escalation_rules, delegation_rules, notifications, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      request.name,
      request.description || null,
      JSON.stringify(request.documentTypeIds),
      JSON.stringify(request.levels),
      JSON.stringify(request.escalationRules || []),
      JSON.stringify(request.delegationRules || []),
      JSON.stringify(request.notifications || []),
      createdBy
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToWorkflow(result.rows[0]);
  }

  async findById(id: UUID): Promise<ApprovalWorkflow | null> {
    const query = 'SELECT * FROM approval_workflows WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorkflow(result.rows[0]);
  }

  async findByDocumentTypeId(documentTypeId: UUID): Promise<ApprovalWorkflow[]> {
    const query = `
      SELECT * FROM approval_workflows 
      WHERE document_type_ids @> $1 AND is_active = true
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [JSON.stringify([documentTypeId])]);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  async update(id: UUID, request: UpdateApprovalWorkflowRequest, updatedBy: UUID): Promise<ApprovalWorkflow> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      setClause.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }

    if (request.description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(request.description);
    }

    if (request.documentTypeIds !== undefined) {
      setClause.push(`document_type_ids = $${paramIndex++}`);
      values.push(JSON.stringify(request.documentTypeIds));
    }

    if (request.levels !== undefined) {
      setClause.push(`levels = $${paramIndex++}`);
      values.push(JSON.stringify(request.levels));
    }

    if (request.escalationRules !== undefined) {
      setClause.push(`escalation_rules = $${paramIndex++}`);
      values.push(JSON.stringify(request.escalationRules));
    }

    if (request.delegationRules !== undefined) {
      setClause.push(`delegation_rules = $${paramIndex++}`);
      values.push(JSON.stringify(request.delegationRules));
    }

    if (request.notifications !== undefined) {
      setClause.push(`notifications = $${paramIndex++}`);
      values.push(JSON.stringify(request.notifications));
    }

    if (request.isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      values.push(request.isActive);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE approval_workflows 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Approval workflow not found');
    }

    return this.mapRowToWorkflow(result.rows[0]);
  }

  async delete(id: UUID): Promise<void> {
    const query = 'DELETE FROM approval_workflows WHERE id = $1';
    await this.db.query(query, [id]);
  }

  async search(criteria: ApprovalWorkflowSearchCriteria): Promise<{
    workflows: ApprovalWorkflow[];
    total: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.name) {
      conditions.push(`name ILIKE $${paramIndex++}`);
      values.push(`%${criteria.name}%`);
    }

    if (criteria.documentTypeId) {
      conditions.push(`document_type_ids @> $${paramIndex++}`);
      values.push(JSON.stringify([criteria.documentTypeId]));
    }

    if (criteria.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(criteria.isActive);
    }

    if (criteria.createdBy) {
      conditions.push(`created_by = $${paramIndex++}`);
      values.push(criteria.createdBy);
    }

    if (criteria.createdAfter) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(criteria.createdAfter);
    }

    if (criteria.createdBefore) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(criteria.createdBefore);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) FROM approval_workflows ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    const dataQuery = `
      SELECT * FROM approval_workflows 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const dataResult = await this.db.query(dataQuery, values);

    return {
      workflows: dataResult.rows.map(row => this.mapRowToWorkflow(row)),
      total
    };
  }

  async findActiveWorkflows(): Promise<ApprovalWorkflow[]> {
    const query = `
      SELECT * FROM approval_workflows 
      WHERE is_active = true
      ORDER BY name
    `;
    
    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRowToWorkflow(row));
  }

  private mapRowToWorkflow(row: any): ApprovalWorkflow {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      documentTypeIds: Array.isArray(row.document_type_ids) 
        ? row.document_type_ids 
        : JSON.parse(row.document_type_ids || '[]'),
      levels: Array.isArray(row.levels) 
        ? row.levels 
        : JSON.parse(row.levels || '[]'),
      escalationRules: Array.isArray(row.escalation_rules) 
        ? row.escalation_rules 
        : JSON.parse(row.escalation_rules || '[]'),
      delegationRules: Array.isArray(row.delegation_rules) 
        ? row.delegation_rules 
        : JSON.parse(row.delegation_rules || '[]'),
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}