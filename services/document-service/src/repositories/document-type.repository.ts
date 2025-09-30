import { Pool } from 'pg';
import { DocumentType, DocumentCategory, DocumentTemplate, UUID, getDbConnection } from '../types';

export class DocumentTypeRepository {
  private db: Pool;

  constructor() {
    this.db = getDbConnection();
  }

  async create(documentType: Omit<DocumentType, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentType> {
    const query = `
      INSERT INTO document_types (
        name, category, template_config, required_fields, 
        approval_workflow_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      documentType.name,
      documentType.category,
      JSON.stringify(documentType.templateConfig),
      JSON.stringify(documentType.requiredFields),
      documentType.approvalWorkflowId,
      documentType.isActive
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToDocumentType(result.rows[0]);
  }

  async findById(id: UUID): Promise<DocumentType | null> {
    const query = 'SELECT * FROM document_types WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows.length > 0 ? this.mapRowToDocumentType(result.rows[0]) : null;
  }

  async findByCategory(category: DocumentCategory): Promise<DocumentType[]> {
    const query = 'SELECT * FROM document_types WHERE category = $1 AND is_active = true ORDER BY name';
    const result = await this.db.query(query, [category]);
    
    return result.rows.map(row => this.mapRowToDocumentType(row));
  }

  async findAll(includeInactive: boolean = false): Promise<DocumentType[]> {
    const query = includeInactive 
      ? 'SELECT * FROM document_types ORDER BY name'
      : 'SELECT * FROM document_types WHERE is_active = true ORDER BY name';
    
    const result = await this.db.query(query);
    return result.rows.map(row => this.mapRowToDocumentType(row));
  }

  async update(id: UUID, updates: Partial<DocumentType>): Promise<DocumentType> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClause.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.category !== undefined) {
      setClause.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.templateConfig !== undefined) {
      setClause.push(`template_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.templateConfig));
    }
    if (updates.requiredFields !== undefined) {
      setClause.push(`required_fields = $${paramIndex++}`);
      values.push(JSON.stringify(updates.requiredFields));
    }
    if (updates.approvalWorkflowId !== undefined) {
      setClause.push(`approval_workflow_id = $${paramIndex++}`);
      values.push(updates.approvalWorkflowId);
    }
    if (updates.isActive !== undefined) {
      setClause.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE document_types 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    if (result.rows.length === 0) {
      throw new Error(`Document type with id ${id} not found`);
    }

    return this.mapRowToDocumentType(result.rows[0]);
  }

  async delete(id: UUID): Promise<void> {
    const query = 'DELETE FROM document_types WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error(`Document type with id ${id} not found`);
    }
  }

  async findByDeviceTypeAndCategory(deviceTypeId: UUID, category: DocumentCategory): Promise<DocumentType[]> {
    // This query would need to be enhanced based on how device types relate to document types
    // For now, return all document types of the given category
    return this.findByCategory(category);
  }

  private mapRowToDocumentType(row: any): DocumentType {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      templateConfig: typeof row.template_config === 'string' 
        ? JSON.parse(row.template_config) 
        : row.template_config,
      requiredFields: typeof row.required_fields === 'string'
        ? JSON.parse(row.required_fields)
        : row.required_fields,
      approvalWorkflowId: row.approval_workflow_id,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}