import { Pool } from 'pg';
import { Document, CreateDocumentRequest, UpdateDocumentRequest, DocumentStatus, UUID } from '../types';
import { DatabaseConnection } from '../../../../shared/database/src/connection';

export class DocumentRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance().getPool();
  }

  async create(request: CreateDocumentRequest, createdBy: UUID): Promise<Document> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create the document
      const documentResult = await client.query(`
        INSERT INTO documents (
          case_id, document_type_id, step_execution_id, content, created_by
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        request.caseId,
        request.documentTypeId,
        request.stepExecutionId,
        JSON.stringify(request.content),
        createdBy
      ]);

      const document = documentResult.rows[0];
      
      await client.query('COMMIT');
      
      return this.mapToDocument(document);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: UUID): Promise<Document | null> {
    const result = await this.db.query(`
      SELECT d.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', da.id,
                   'approverUserId', da.approver_user_id,
                   'approvalLevel', da.approval_level,
                   'status', da.status,
                   'comments', da.comments,
                   'approvedAt', da.approved_at,
                   'createdAt', da.created_at
                 )
               ) FILTER (WHERE da.id IS NOT NULL), 
               '[]'
             ) as approvals,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', a.id,
                   'fileName', a.file_name,
                   'originalName', a.original_name,
                   'mimeType', a.mime_type,
                   'fileSize', a.file_size,
                   'filePath', a.file_path,
                   'uploadedBy', a.uploaded_by,
                   'createdAt', a.created_at
                 )
               ) FILTER (WHERE a.id IS NOT NULL), 
               '[]'
             ) as attachments
      FROM documents d
      LEFT JOIN document_approvals da ON d.id = da.document_id
      LEFT JOIN attachments a ON d.id = a.document_id
      WHERE d.id = $1
      GROUP BY d.id
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToDocument(result.rows[0]);
  }

  async update(id: UUID, request: UpdateDocumentRequest, updatedBy: UUID): Promise<Document> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get current version
      const currentDoc = await client.query('SELECT version FROM documents WHERE id = $1', [id]);
      if (currentDoc.rows.length === 0) {
        throw new Error('Document not found');
      }
      
      const newVersion = request.version || (currentDoc.rows[0].version + 1);
      
      // Update the document
      const result = await client.query(`
        UPDATE documents 
        SET content = $1, version = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `, [
        JSON.stringify(request.content),
        newVersion,
        id
      ]);

      await client.query('COMMIT');
      
      return this.mapToDocument(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateStatus(id: UUID, status: DocumentStatus): Promise<void> {
    await this.db.query(`
      UPDATE documents 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [status, id]);
  }

  async findByCaseId(caseId: UUID): Promise<Document[]> {
    const result = await this.db.query(`
      SELECT d.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', da.id,
                   'approverUserId', da.approver_user_id,
                   'approvalLevel', da.approval_level,
                   'status', da.status,
                   'comments', da.comments,
                   'approvedAt', da.approved_at,
                   'createdAt', da.created_at
                 )
               ) FILTER (WHERE da.id IS NOT NULL), 
               '[]'
             ) as approvals,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', a.id,
                   'fileName', a.file_name,
                   'originalName', a.original_name,
                   'mimeType', a.mime_type,
                   'fileSize', a.file_size,
                   'filePath', a.file_path,
                   'uploadedBy', a.uploaded_by,
                   'createdAt', a.created_at
                 )
               ) FILTER (WHERE a.id IS NOT NULL), 
               '[]'
             ) as attachments
      FROM documents d
      LEFT JOIN document_approvals da ON d.id = da.document_id
      LEFT JOIN attachments a ON d.id = a.document_id
      WHERE d.case_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `, [caseId]);

    return result.rows.map(row => this.mapToDocument(row));
  }

  async findByStepExecutionId(stepExecutionId: UUID): Promise<Document[]> {
    const result = await this.db.query(`
      SELECT d.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', da.id,
                   'approverUserId', da.approver_user_id,
                   'approvalLevel', da.approval_level,
                   'status', da.status,
                   'comments', da.comments,
                   'approvedAt', da.approved_at,
                   'createdAt', da.created_at
                 )
               ) FILTER (WHERE da.id IS NOT NULL), 
               '[]'
             ) as approvals,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', a.id,
                   'fileName', a.file_name,
                   'originalName', a.original_name,
                   'mimeType', a.mime_type,
                   'fileSize', a.file_size,
                   'filePath', a.file_path,
                   'uploadedBy', a.uploaded_by,
                   'createdAt', a.created_at
                 )
               ) FILTER (WHERE a.id IS NOT NULL), 
               '[]'
             ) as attachments
      FROM documents d
      LEFT JOIN document_approvals da ON d.id = da.document_id
      LEFT JOIN attachments a ON d.id = a.document_id
      WHERE d.step_execution_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `, [stepExecutionId]);

    return result.rows.map(row => this.mapToDocument(row));
  }

  async delete(id: UUID): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete related records first
      await client.query('DELETE FROM document_approvals WHERE document_id = $1', [id]);
      await client.query('DELETE FROM attachments WHERE document_id = $1', [id]);
      
      // Delete specific document type records
      await client.query('DELETE FROM inspection_reports WHERE document_id = $1', [id]);
      await client.query('DELETE FROM quotations WHERE document_id = $1', [id]);
      await client.query('DELETE FROM repair_reports WHERE document_id = $1', [id]);
      await client.query('DELETE FROM maintenance_reports WHERE document_id = $1', [id]);
      
      // Delete the document
      await client.query('DELETE FROM documents WHERE id = $1', [id]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getDocumentVersions(id: UUID): Promise<Document[]> {
    // For now, we'll return the current document
    // In a full implementation, we'd have a document_versions table
    const document = await this.findById(id);
    return document ? [document] : [];
  }

  async createAutoSave(documentId: UUID, content: any, userId: UUID): Promise<void> {
    await this.db.query(`
      INSERT INTO document_auto_saves (document_id, content, created_by, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (document_id) 
      DO UPDATE SET content = $2, created_by = $3, created_at = NOW()
    `, [documentId, JSON.stringify(content), userId]);
  }

  async getAutoSave(documentId: UUID): Promise<any | null> {
    const result = await this.db.query(`
      SELECT content FROM document_auto_saves WHERE document_id = $1
    `, [documentId]);

    return result.rows.length > 0 ? result.rows[0].content : null;
  }

  private mapToDocument(row: any): Document {
    return {
      id: row.id,
      caseId: row.case_id,
      documentTypeId: row.document_type_id,
      stepExecutionId: row.step_execution_id,
      status: row.status,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvals: row.approvals || [],
      attachments: row.attachments || []
    };
  }
}