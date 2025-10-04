import { Pool } from 'pg';
import { UUID } from '../../../../shared/types/src/common';
import { 
  RepairReport, 
  ReplacedPart, 
  PerformedProcedure, 
  TestResult, 
  DocumentImage 
} from '../../../../shared/types/src/document';
import {
  CreateRepairReportRequest,
  UpdateRepairReportRequest,
  RepairReportSearchCriteria,
  RepairReportResponse,
  CustomerSatisfactionRequest,
  CustomerFeedbackSummary,
  RepairReportAnalytics
} from '../types/repair-report';

export class RepairReportRepository {
  constructor(private db: Pool) {}

  async create(request: CreateRepairReportRequest): Promise<RepairReport> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert repair report
      const repairReportQuery = `
        INSERT INTO repair_reports (
          id, document_id, actual_hours, technician_notes, 
          customer_satisfaction_rating, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *
      `;
      
      const repairReportId = crypto.randomUUID();
      const repairReportResult = await client.query(repairReportQuery, [
        repairReportId,
        request.documentId,
        request.actualHours,
        request.technicianNotes,
        null // customer satisfaction rating will be set later
      ]);

      const repairReport = repairReportResult.rows[0];

      // Insert replaced parts
      if (request.partsReplaced && request.partsReplaced.length > 0) {
        const partsQuery = `
          INSERT INTO repair_report_parts (
            id, repair_report_id, part_id, part_name, quantity, 
            serial_numbers, old_part_condition, replacement_reason, warranty_months
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        for (const part of request.partsReplaced) {
          await client.query(partsQuery, [
            crypto.randomUUID(),
            repairReportId,
            part.partId,
            part.partName,
            part.quantity,
            JSON.stringify(part.serialNumbers),
            part.oldPartCondition,
            part.replacementReason,
            part.warrantyMonths
          ]);
        }
      }

      // Insert performed procedures
      if (request.proceduresPerformed && request.proceduresPerformed.length > 0) {
        const proceduresQuery = `
          INSERT INTO repair_report_procedures (
            id, repair_report_id, procedure_type, description, 
            duration, result, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        for (const procedure of request.proceduresPerformed) {
          await client.query(proceduresQuery, [
            crypto.randomUUID(),
            repairReportId,
            procedure.procedureType,
            procedure.description,
            procedure.duration,
            procedure.result,
            procedure.notes
          ]);
        }
      }

      // Insert test results
      if (request.testResults && request.testResults.length > 0) {
        const testsQuery = `
          INSERT INTO repair_report_tests (
            id, repair_report_id, test_name, expected_value, 
            actual_value, result, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        for (const test of request.testResults) {
          await client.query(testsQuery, [
            crypto.randomUUID(),
            repairReportId,
            test.testName,
            test.expectedValue,
            test.actualValue,
            test.result,
            test.notes
          ]);
        }
      }

      // Insert before images
      if (request.beforeImages && request.beforeImages.length > 0) {
        await this.insertImages(client, repairReportId, request.beforeImages, 'before');
      }

      // Insert after images
      if (request.afterImages && request.afterImages.length > 0) {
        await this.insertImages(client, repairReportId, request.afterImages, 'after');
      }

      await client.query('COMMIT');

      return await this.findById(repairReportId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: UUID): Promise<RepairReport | null> {
    const query = `
      SELECT rr.*, 
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'partId', rrp.part_id,
                   'partName', rrp.part_name,
                   'quantity', rrp.quantity,
                   'serialNumbers', rrp.serial_numbers::jsonb,
                   'oldPartCondition', rrp.old_part_condition,
                   'replacementReason', rrp.replacement_reason,
                   'warrantyMonths', rrp.warranty_months
                 )
               ) FILTER (WHERE rrp.id IS NOT NULL), '[]'
             ) as parts_replaced,
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'id', rrpr.id,
                   'procedureType', rrpr.procedure_type,
                   'description', rrpr.description,
                   'duration', rrpr.duration,
                   'result', rrpr.result,
                   'notes', rrpr.notes
                 )
               ) FILTER (WHERE rrpr.id IS NOT NULL), '[]'
             ) as procedures_performed,
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'testName', rrt.test_name,
                   'expectedValue', rrt.expected_value,
                   'actualValue', rrt.actual_value,
                   'result', rrt.result,
                   'notes', rrt.notes
                 )
               ) FILTER (WHERE rrt.id IS NOT NULL), '[]'
             ) as test_results,
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'id', rri_before.id,
                   'fileName', rri_before.file_name,
                   'url', rri_before.url,
                   'caption', rri_before.caption,
                   'timestamp', rri_before.timestamp,
                   'imageType', rri_before.image_type
                 )
               ) FILTER (WHERE rri_before.id IS NOT NULL AND rri_before.image_type = 'before'), '[]'
             ) as before_images,
             COALESCE(
               json_agg(
                 DISTINCT jsonb_build_object(
                   'id', rri_after.id,
                   'fileName', rri_after.file_name,
                   'url', rri_after.url,
                   'caption', rri_after.caption,
                   'timestamp', rri_after.timestamp,
                   'imageType', rri_after.image_type
                 )
               ) FILTER (WHERE rri_after.id IS NOT NULL AND rri_after.image_type = 'after'), '[]'
             ) as after_images
      FROM repair_reports rr
      LEFT JOIN repair_report_parts rrp ON rr.id = rrp.repair_report_id
      LEFT JOIN repair_report_procedures rrpr ON rr.id = rrpr.repair_report_id
      LEFT JOIN repair_report_tests rrt ON rr.id = rrt.repair_report_id
      LEFT JOIN repair_report_images rri_before ON rr.id = rri_before.repair_report_id AND rri_before.image_type = 'before'
      LEFT JOIN repair_report_images rri_after ON rr.id = rri_after.repair_report_id AND rri_after.image_type = 'after'
      WHERE rr.id = $1
      GROUP BY rr.id
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToRepairReport(result.rows[0]);
  }

  async findByDocumentId(documentId: UUID): Promise<RepairReport | null> {
    const query = `
      SELECT id FROM repair_reports WHERE document_id = $1
    `;
    
    const result = await this.db.query(query, [documentId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return await this.findById(result.rows[0].id);
  }

  async update(id: UUID, request: UpdateRepairReportRequest): Promise<RepairReport> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update repair report basic info
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (request.actualHours !== undefined) {
        updateFields.push(`actual_hours = $${paramIndex++}`);
        updateValues.push(request.actualHours);
      }

      if (request.technicianNotes !== undefined) {
        updateFields.push(`technician_notes = $${paramIndex++}`);
        updateValues.push(request.technicianNotes);
      }

      if (request.customerSatisfactionRating !== undefined) {
        updateFields.push(`customer_satisfaction_rating = $${paramIndex++}`);
        updateValues.push(request.customerSatisfactionRating);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(id);

        const updateQuery = `
          UPDATE repair_reports 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `;

        await client.query(updateQuery, updateValues);
      }

      // Update parts if provided
      if (request.partsReplaced) {
        await client.query('DELETE FROM repair_report_parts WHERE repair_report_id = $1', [id]);
        
        if (request.partsReplaced.length > 0) {
          const partsQuery = `
            INSERT INTO repair_report_parts (
              id, repair_report_id, part_id, part_name, quantity, 
              serial_numbers, old_part_condition, replacement_reason, warranty_months
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `;

          for (const part of request.partsReplaced) {
            await client.query(partsQuery, [
              crypto.randomUUID(),
              id,
              part.partId,
              part.partName,
              part.quantity,
              JSON.stringify(part.serialNumbers),
              part.oldPartCondition,
              part.replacementReason,
              part.warrantyMonths
            ]);
          }
        }
      }

      // Update procedures if provided
      if (request.proceduresPerformed) {
        await client.query('DELETE FROM repair_report_procedures WHERE repair_report_id = $1', [id]);
        
        if (request.proceduresPerformed.length > 0) {
          const proceduresQuery = `
            INSERT INTO repair_report_procedures (
              id, repair_report_id, procedure_type, description, 
              duration, result, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;

          for (const procedure of request.proceduresPerformed) {
            await client.query(proceduresQuery, [
              crypto.randomUUID(),
              id,
              procedure.procedureType,
              procedure.description,
              procedure.duration,
              procedure.result,
              procedure.notes
            ]);
          }
        }
      }

      // Update test results if provided
      if (request.testResults) {
        await client.query('DELETE FROM repair_report_tests WHERE repair_report_id = $1', [id]);
        
        if (request.testResults.length > 0) {
          const testsQuery = `
            INSERT INTO repair_report_tests (
              id, repair_report_id, test_name, expected_value, 
              actual_value, result, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `;

          for (const test of request.testResults) {
            await client.query(testsQuery, [
              crypto.randomUUID(),
              id,
              test.testName,
              test.expectedValue,
              test.actualValue,
              test.result,
              test.notes
            ]);
          }
        }
      }

      // Update images if provided
      if (request.beforeImages) {
        await client.query('DELETE FROM repair_report_images WHERE repair_report_id = $1 AND image_type = $2', [id, 'before']);
        if (request.beforeImages.length > 0) {
          await this.insertImages(client, id, request.beforeImages, 'before');
        }
      }

      if (request.afterImages) {
        await client.query('DELETE FROM repair_report_images WHERE repair_report_id = $1 AND image_type = $2', [id, 'after']);
        if (request.afterImages.length > 0) {
          await this.insertImages(client, id, request.afterImages, 'after');
        }
      }

      await client.query('COMMIT');

      return await this.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(criteria: RepairReportSearchCriteria): Promise<{ repairReports: RepairReportResponse[], total: number }> {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (criteria.caseId) {
      conditions.push(`d.case_id = $${paramIndex++}`);
      values.push(criteria.caseId);
    }

    if (criteria.technicianId) {
      conditions.push(`d.created_by = $${paramIndex++}`);
      values.push(criteria.technicianId);
    }

    if (criteria.dateFrom) {
      conditions.push(`rr.created_at >= $${paramIndex++}`);
      values.push(criteria.dateFrom);
    }

    if (criteria.dateTo) {
      conditions.push(`rr.created_at <= $${paramIndex++}`);
      values.push(criteria.dateTo);
    }

    if (criteria.customerSatisfactionRating) {
      conditions.push(`rr.customer_satisfaction_rating >= $${paramIndex++}`);
      values.push(criteria.customerSatisfactionRating);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT rr.id) as total
      FROM repair_reports rr
      JOIN documents d ON rr.document_id = d.id
      ${whereClause}
    `;

    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total);

    // Main query
    const query = `
      SELECT rr.id
      FROM repair_reports rr
      JOIN documents d ON rr.document_id = d.id
      ${whereClause}
      ORDER BY rr.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.db.query(query, values);

    const repairReports = await Promise.all(
      result.rows.map(row => this.findById(row.id))
    );

    const repairReportResponses = repairReports
      .filter(report => report !== null)
      .map(report => this.mapToResponse(report!));

    return {
      repairReports: repairReportResponses,
      total
    };
  }

  async recordCustomerSatisfaction(request: CustomerSatisfactionRequest): Promise<void> {
    const query = `
      UPDATE repair_reports 
      SET customer_satisfaction_rating = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await this.db.query(query, [request.rating, request.repairReportId]);

    // Store detailed feedback if provided
    if (request.comments || request.serviceAspects.length > 0) {
      const feedbackQuery = `
        INSERT INTO repair_report_feedback (
          id, repair_report_id, rating, comments, would_recommend, 
          service_aspects, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `;

      await this.db.query(feedbackQuery, [
        crypto.randomUUID(),
        request.repairReportId,
        request.rating,
        request.comments,
        request.wouldRecommend,
        JSON.stringify(request.serviceAspects)
      ]);
    }
  }

  async getCustomerFeedbackSummary(dateFrom?: Date, dateTo?: Date): Promise<CustomerFeedbackSummary> {
    const conditions = ['rr.customer_satisfaction_rating IS NOT NULL'];
    const values = [];
    let paramIndex = 1;

    if (dateFrom) {
      conditions.push(`rr.created_at >= $${paramIndex++}`);
      values.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`rr.created_at <= $${paramIndex++}`);
      values.push(dateTo);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT 
        AVG(rr.customer_satisfaction_rating) as average_rating,
        COUNT(*) as total_responses,
        COALESCE(
          json_agg(
            DISTINCT rrf.comments
          ) FILTER (WHERE rrf.comments IS NOT NULL), '[]'
        ) as recent_comments
      FROM repair_reports rr
      LEFT JOIN repair_report_feedback rrf ON rr.id = rrf.repair_report_id
      ${whereClause}
    `;

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return {
      averageRating: parseFloat(row.average_rating) || 0,
      totalResponses: parseInt(row.total_responses) || 0,
      aspectRatings: {}, // TODO: Implement aspect ratings aggregation
      recentComments: row.recent_comments || []
    };
  }

  async delete(id: UUID): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Delete related records
      await client.query('DELETE FROM repair_report_feedback WHERE repair_report_id = $1', [id]);
      await client.query('DELETE FROM repair_report_images WHERE repair_report_id = $1', [id]);
      await client.query('DELETE FROM repair_report_tests WHERE repair_report_id = $1', [id]);
      await client.query('DELETE FROM repair_report_procedures WHERE repair_report_id = $1', [id]);
      await client.query('DELETE FROM repair_report_parts WHERE repair_report_id = $1', [id]);
      
      // Delete repair report
      await client.query('DELETE FROM repair_reports WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertImages(client: any, repairReportId: UUID, images: any[], imageType: string): Promise<void> {
    const imagesQuery = `
      INSERT INTO repair_report_images (
        id, repair_report_id, file_name, url, caption, 
        timestamp, image_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    for (const image of images) {
      await client.query(imagesQuery, [
        crypto.randomUUID(),
        repairReportId,
        image.fileName,
        image.url,
        image.caption,
        new Date(),
        imageType
      ]);
    }
  }

  private mapRowToRepairReport(row: any): RepairReport {
    return {
      id: row.id,
      documentId: row.document_id,
      partsReplaced: row.parts_replaced || [],
      proceduresPerformed: row.procedures_performed || [],
      actualHours: row.actual_hours,
      testResults: row.test_results || [],
      technicianNotes: row.technician_notes,
      beforeImages: row.before_images || [],
      afterImages: row.after_images || [],
      customerSatisfactionRating: row.customer_satisfaction_rating,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }

  private mapToResponse(repairReport: RepairReport): RepairReportResponse {
    const totalPartsReplaced = repairReport.partsReplaced.reduce((sum, part) => sum + part.quantity, 0);
    const totalProcedures = repairReport.proceduresPerformed.length;
    
    // Calculate overall test result
    const testResults = repairReport.testResults;
    let overallTestResult: 'pass' | 'fail' | 'partial' = 'pass';
    
    if (testResults.length > 0) {
      const passCount = testResults.filter(test => test.result === 'pass').length;
      const failCount = testResults.filter(test => test.result === 'fail').length;
      
      if (failCount === 0) {
        overallTestResult = 'pass';
      } else if (passCount === 0) {
        overallTestResult = 'fail';
      } else {
        overallTestResult = 'partial';
      }
    }

    // Calculate completion percentage based on required fields
    let completedFields = 0;
    const totalFields = 6; // parts, procedures, hours, tests, notes, images

    if (repairReport.partsReplaced.length > 0) completedFields++;
    if (repairReport.proceduresPerformed.length > 0) completedFields++;
    if (repairReport.actualHours > 0) completedFields++;
    if (repairReport.testResults.length > 0) completedFields++;
    if (repairReport.technicianNotes) completedFields++;
    if (repairReport.beforeImages.length > 0 || repairReport.afterImages.length > 0) completedFields++;

    const completionPercentage = Math.round((completedFields / totalFields) * 100);

    return {
      ...repairReport,
      totalPartsReplaced,
      totalProcedures,
      overallTestResult,
      completionPercentage
    };
  }
}