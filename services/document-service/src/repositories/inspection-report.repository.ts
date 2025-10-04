import { Pool } from 'pg';
import { InspectionReport, InspectionFinding, RecommendedPart, DocumentImage, UUID } from '../types';
import { DatabaseConnection } from '../../../../shared/database/src/connection';

export interface CreateInspectionReportRequest {
  documentId: UUID;
  findings: InspectionFinding[];
  recommendedParts: RecommendedPart[];
  estimatedHours: number;
  severityLevel: string;
  images: DocumentImage[];
}

export interface UpdateInspectionReportRequest {
  findings?: InspectionFinding[];
  recommendedParts?: RecommendedPart[];
  estimatedHours?: number;
  severityLevel?: string;
  images?: DocumentImage[];
}

export class InspectionReportRepository {
  private db: Pool;

  constructor() {
    this.db = DatabaseConnection.getInstance().getPool();
  }

  async create(request: CreateInspectionReportRequest): Promise<InspectionReport> {
    const query = `
      INSERT INTO inspection_reports (
        document_id, findings, recommended_parts, estimated_hours, severity_level, images
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      request.documentId,
      JSON.stringify(request.findings),
      JSON.stringify(request.recommendedParts),
      request.estimatedHours,
      request.severityLevel,
      JSON.stringify(request.images)
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToInspectionReport(result.rows[0]);
  }

  async findById(id: UUID): Promise<InspectionReport | null> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      WHERE ir.id = $1
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInspectionReport(result.rows[0]);
  }

  async findByDocumentId(documentId: UUID): Promise<InspectionReport | null> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      WHERE ir.document_id = $1
    `;

    const result = await this.db.query(query, [documentId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToInspectionReport(result.rows[0]);
  }

  async findByCaseId(caseId: UUID): Promise<InspectionReport[]> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      WHERE d.case_id = $1
      ORDER BY ir.created_at DESC
    `;

    const result = await this.db.query(query, [caseId]);
    return result.rows.map(row => this.mapRowToInspectionReport(row));
  }

  async update(id: UUID, request: UpdateInspectionReportRequest): Promise<InspectionReport> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.findings !== undefined) {
      updateFields.push(`findings = $${paramIndex++}`);
      values.push(JSON.stringify(request.findings));
    }

    if (request.recommendedParts !== undefined) {
      updateFields.push(`recommended_parts = $${paramIndex++}`);
      values.push(JSON.stringify(request.recommendedParts));
    }

    if (request.estimatedHours !== undefined) {
      updateFields.push(`estimated_hours = $${paramIndex++}`);
      values.push(request.estimatedHours);
    }

    if (request.severityLevel !== undefined) {
      updateFields.push(`severity_level = $${paramIndex++}`);
      values.push(request.severityLevel);
    }

    if (request.images !== undefined) {
      updateFields.push(`images = $${paramIndex++}`);
      values.push(JSON.stringify(request.images));
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const query = `
      UPDATE inspection_reports 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Inspection report not found');
    }

    return this.mapRowToInspectionReport(result.rows[0]);
  }

  async delete(id: UUID): Promise<void> {
    const query = 'DELETE FROM inspection_reports WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('Inspection report not found');
    }
  }

  // Search and filtering methods
  async findBySeverityLevel(severityLevel: string): Promise<InspectionReport[]> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      WHERE ir.severity_level = $1
      ORDER BY ir.created_at DESC
    `;

    const result = await this.db.query(query, [severityLevel]);
    return result.rows.map(row => this.mapRowToInspectionReport(row));
  }

  async findByEstimatedHoursRange(minHours: number, maxHours: number): Promise<InspectionReport[]> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      WHERE ir.estimated_hours BETWEEN $1 AND $2
      ORDER BY ir.estimated_hours DESC
    `;

    const result = await this.db.query(query, [minHours, maxHours]);
    return result.rows.map(row => this.mapRowToInspectionReport(row));
  }

  async findByComponent(component: string): Promise<InspectionReport[]> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      WHERE ir.findings::text ILIKE $1
      ORDER BY ir.created_at DESC
    `;

    const result = await this.db.query(query, [`%${component}%`]);
    return result.rows.map(row => this.mapRowToInspectionReport(row));
  }

  async findRecentReports(limit: number = 10): Promise<InspectionReport[]> {
    const query = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      ORDER BY ir.created_at DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => this.mapRowToInspectionReport(row));
  }

  // Analytics methods
  async getSeverityDistribution(): Promise<Record<string, number>> {
    const query = `
      SELECT severity_level, COUNT(*) as count
      FROM inspection_reports
      GROUP BY severity_level
    `;

    const result = await this.db.query(query);
    const distribution: Record<string, number> = {};
    
    result.rows.forEach(row => {
      distribution[row.severity_level] = parseInt(row.count);
    });

    return distribution;
  }

  async getAverageEstimatedHours(): Promise<number> {
    const query = `
      SELECT AVG(estimated_hours) as avg_hours
      FROM inspection_reports
      WHERE estimated_hours IS NOT NULL
    `;

    const result = await this.db.query(query);
    return parseFloat(result.rows[0]?.avg_hours || '0');
  }

  async getMostCommonFindings(limit: number = 10): Promise<Array<{component: string, issue: string, count: number}>> {
    const query = `
      SELECT 
        finding->>'component' as component,
        finding->>'issue' as issue,
        COUNT(*) as count
      FROM inspection_reports ir,
           jsonb_array_elements(ir.findings) as finding
      GROUP BY finding->>'component', finding->>'issue'
      ORDER BY count DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      component: row.component,
      issue: row.issue,
      count: parseInt(row.count)
    }));
  }

  async getMostRecommendedParts(limit: number = 10): Promise<Array<{partName: string, partNumber: string, count: number}>> {
    const query = `
      SELECT 
        part->>'partName' as part_name,
        part->>'partNumber' as part_number,
        COUNT(*) as count
      FROM inspection_reports ir,
           jsonb_array_elements(ir.recommended_parts) as part
      GROUP BY part->>'partName', part->>'partNumber'
      ORDER BY count DESC
      LIMIT $1
    `;

    const result = await this.db.query(query, [limit]);
    return result.rows.map(row => ({
      partName: row.part_name,
      partNumber: row.part_number || '',
      count: parseInt(row.count)
    }));
  }

  // Helper method to map database row to InspectionReport object
  private mapRowToInspectionReport(row: any): InspectionReport {
    return {
      id: row.id,
      documentId: row.document_id,
      findings: Array.isArray(row.findings) ? row.findings : JSON.parse(row.findings || '[]'),
      recommendedParts: Array.isArray(row.recommended_parts) ? row.recommended_parts : JSON.parse(row.recommended_parts || '[]'),
      estimatedHours: parseFloat(row.estimated_hours || '0'),
      severityLevel: row.severity_level,
      images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }

  // Batch operations
  async createMultiple(requests: CreateInspectionReportRequest[]): Promise<InspectionReport[]> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: InspectionReport[] = [];
      
      for (const request of requests) {
        const query = `
          INSERT INTO inspection_reports (
            document_id, findings, recommended_parts, estimated_hours, severity_level, images
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;

        const values = [
          request.documentId,
          JSON.stringify(request.findings),
          JSON.stringify(request.recommendedParts),
          request.estimatedHours,
          request.severityLevel,
          JSON.stringify(request.images)
        ];

        const result = await client.query(query, values);
        results.push(this.mapRowToInspectionReport(result.rows[0]));
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateMultiple(updates: Array<{id: UUID, request: UpdateInspectionReportRequest}>): Promise<InspectionReport[]> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: InspectionReport[] = [];
      
      for (const update of updates) {
        const result = await this.update(update.id, update.request);
        results.push(result);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Search with pagination
  async searchWithPagination(
    criteria: {
      caseId?: UUID;
      severityLevel?: string;
      component?: string;
      minHours?: number;
      maxHours?: number;
      dateFrom?: Date;
      dateTo?: Date;
    },
    pagination: {
      limit: number;
      offset: number;
    }
  ): Promise<{reports: InspectionReport[], total: number}> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.caseId) {
      conditions.push(`d.case_id = $${paramIndex++}`);
      values.push(criteria.caseId);
    }

    if (criteria.severityLevel) {
      conditions.push(`ir.severity_level = $${paramIndex++}`);
      values.push(criteria.severityLevel);
    }

    if (criteria.component) {
      conditions.push(`ir.findings::text ILIKE $${paramIndex++}`);
      values.push(`%${criteria.component}%`);
    }

    if (criteria.minHours !== undefined) {
      conditions.push(`ir.estimated_hours >= $${paramIndex++}`);
      values.push(criteria.minHours);
    }

    if (criteria.maxHours !== undefined) {
      conditions.push(`ir.estimated_hours <= $${paramIndex++}`);
      values.push(criteria.maxHours);
    }

    if (criteria.dateFrom) {
      conditions.push(`ir.created_at >= $${paramIndex++}`);
      values.push(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      conditions.push(`ir.created_at <= $${paramIndex++}`);
      values.push(criteria.dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      ${whereClause}
    `;

    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Data query
    const dataQuery = `
      SELECT ir.*, d.case_id, d.document_type_id, d.status as document_status,
             d.created_by, d.created_at, d.updated_at
      FROM inspection_reports ir
      JOIN documents d ON ir.document_id = d.id
      ${whereClause}
      ORDER BY ir.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(pagination.limit, pagination.offset);

    const dataResult = await this.db.query(dataQuery, values);
    const reports = dataResult.rows.map(row => this.mapRowToInspectionReport(row));

    return { reports, total };
  }
}