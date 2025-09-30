import { Pool } from 'pg';
import { Attachment, UUID } from '../types';
import { DatabaseConnection } from '../../../../shared/database/src/connection';

export interface CreateAttachmentRequest {
  documentId: UUID;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  uploadedBy: UUID;
}

export class AttachmentRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance().getPool();
  }

  async create(request: CreateAttachmentRequest): Promise<Attachment> {
    const result = await this.db.query(`
      INSERT INTO attachments (
        document_id, file_name, original_name, mime_type, 
        file_size, file_path, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      request.documentId,
      request.fileName,
      request.originalName,
      request.mimeType,
      request.fileSize,
      request.filePath,
      request.uploadedBy
    ]);

    return this.mapToAttachment(result.rows[0]);
  }

  async findById(id: UUID): Promise<Attachment | null> {
    const result = await this.db.query(`
      SELECT * FROM attachments WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToAttachment(result.rows[0]);
  }

  async findByDocumentId(documentId: UUID): Promise<Attachment[]> {
    const result = await this.db.query(`
      SELECT * FROM attachments 
      WHERE document_id = $1 
      ORDER BY created_at DESC
    `, [documentId]);

    return result.rows.map(row => this.mapToAttachment(row));
  }

  async delete(id: UUID): Promise<void> {
    await this.db.query(`
      DELETE FROM attachments WHERE id = $1
    `, [id]);
  }

  async deleteByDocumentId(documentId: UUID): Promise<void> {
    await this.db.query(`
      DELETE FROM attachments WHERE document_id = $1
    `, [documentId]);
  }

  private mapToAttachment(row: any): Attachment {
    return {
      id: row.id,
      documentId: row.document_id,
      fileName: row.file_name,
      originalName: row.original_name,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      filePath: row.file_path,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}