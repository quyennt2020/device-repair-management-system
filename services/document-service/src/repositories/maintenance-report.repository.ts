import { Pool, PoolClient } from 'pg';
import { UUID } from '../../../../shared/types/src/common';
import {
  MaintenanceReport,
  MaintenanceChecklistItem,
  MaintenanceRecommendation,
  MaterialUsed,
  MaintenanceType,
  OverallCondition,
  ChecklistItemStatus,
  RecommendationPriority,
  RecommendationCategory
} from '../../../../shared/types/src/document';
import {
  CreateMaintenanceReportRequest,
  UpdateMaintenanceReportRequest,
  MaintenanceReportSearchCriteria,
  MaintenanceReportResponse,
  UpdateMaintenanceChecklistItemRequest,
  CreateMaintenanceRecommendationRequest,
  CreateMaterialUsedRequest
} from '../types/maintenance-report';

export class MaintenanceReportRepository {
  constructor(private pool: Pool) {}

  async create(request: CreateMaintenanceReportRequest, createdBy: UUID): Promise<MaintenanceReport> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create maintenance report
      const reportResult = await client.query(`
        INSERT INTO maintenance_reports (
          document_id, maintenance_type, checklist_template_id, 
          actual_hours, technician_notes, customer_feedback, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        request.documentId,
        request.maintenanceType,
        request.checklistTemplateId,
        request.actualHours,
        request.technicianNotes,
        request.customerFeedback,
        createdBy
      ]);

      const report = reportResult.rows[0];

      // Get checklist template items and create checklist items
      const templateItemsResult = await client.query(`
        SELECT * FROM checklist_template_items 
        WHERE template_id = $1 
        ORDER BY order_index
      `, [request.checklistTemplateId]);

      const checklistItems: MaintenanceChecklistItem[] = [];
      
      for (const templateItem of templateItemsResult.rows) {
        const itemResult = await client.query(`
          INSERT INTO maintenance_checklist_items (
            maintenance_report_id, item_id, category, description, 
            type, required, expected_value
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          report.id,
          templateItem.id,
          templateItem.category,
          templateItem.description,
          templateItem.type,
          templateItem.required,
          templateItem.expected_value
        ]);

        checklistItems.push(this.mapChecklistItemFromDb(itemResult.rows[0]));
      }

      await client.query('COMMIT');

      return {
        id: report.id,
        documentId: report.document_id,
        maintenanceType: report.maintenance_type,
        checklistTemplateId: report.checklist_template_id,
        checklistItems,
        overallCondition: report.overall_condition,
        recommendations: [],
        nextMaintenanceDate: report.next_maintenance_date,
        maintenanceFrequencyMonths: report.maintenance_frequency_months,
        actualHours: parseFloat(report.actual_hours),
        materialsUsed: [],
        technicianNotes: report.technician_notes,
        customerFeedback: report.customer_feedback,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
        createdBy: report.created_by,
        updatedBy: report.updated_by
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: UUID): Promise<MaintenanceReport | null> {
    const client = await this.pool.connect();
    
    try {
      // Get maintenance report
      const reportResult = await client.query(`
        SELECT * FROM maintenance_reports WHERE id = $1
      `, [id]);

      if (reportResult.rows.length === 0) {
        return null;
      }

      const report = reportResult.rows[0];

      // Get checklist items
      const checklistItems = await this.getChecklistItems(client, id);

      // Get recommendations
      const recommendations = await this.getRecommendations(client, id);

      // Get materials used
      const materialsUsed = await this.getMaterialsUsed(client, id);

      return {
        id: report.id,
        documentId: report.document_id,
        maintenanceType: report.maintenance_type,
        checklistTemplateId: report.checklist_template_id,
        checklistItems,
        overallCondition: report.overall_condition,
        recommendations,
        nextMaintenanceDate: report.next_maintenance_date,
        maintenanceFrequencyMonths: report.maintenance_frequency_months,
        actualHours: parseFloat(report.actual_hours),
        materialsUsed,
        technicianNotes: report.technician_notes,
        customerFeedback: report.customer_feedback,
        createdAt: report.created_at,
        updatedAt: report.updated_at,
        createdBy: report.created_by,
        updatedBy: report.updated_by
      };
    } finally {
      client.release();
    }
  }

  async findByDocumentId(documentId: UUID): Promise<MaintenanceReport | null> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id FROM maintenance_reports WHERE document_id = $1
      `, [documentId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.findById(result.rows[0].id);
    } finally {
      client.release();
    }
  }

  async update(id: UUID, request: UpdateMaintenanceReportRequest, updatedBy: UUID): Promise<MaintenanceReport> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update maintenance report
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (request.overallCondition !== undefined) {
        updateFields.push(`overall_condition = $${paramIndex++}`);
        updateValues.push(request.overallCondition);
      }

      if (request.nextMaintenanceDate !== undefined) {
        updateFields.push(`next_maintenance_date = $${paramIndex++}`);
        updateValues.push(request.nextMaintenanceDate);
      }

      if (request.maintenanceFrequencyMonths !== undefined) {
        updateFields.push(`maintenance_frequency_months = $${paramIndex++}`);
        updateValues.push(request.maintenanceFrequencyMonths);
      }

      if (request.actualHours !== undefined) {
        updateFields.push(`actual_hours = $${paramIndex++}`);
        updateValues.push(request.actualHours);
      }

      if (request.technicianNotes !== undefined) {
        updateFields.push(`technician_notes = $${paramIndex++}`);
        updateValues.push(request.technicianNotes);
      }

      if (request.customerFeedback !== undefined) {
        updateFields.push(`customer_feedback = $${paramIndex++}`);
        updateValues.push(request.customerFeedback);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateFields.push(`updated_by = $${paramIndex++}`);
        updateValues.push(updatedBy);
        updateValues.push(id);

        await client.query(`
          UPDATE maintenance_reports 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `, updateValues);
      }

      // Update checklist items if provided
      if (request.checklistItems) {
        for (const itemUpdate of request.checklistItems) {
          await this.updateChecklistItem(client, id, itemUpdate);
        }
      }

      // Update recommendations if provided
      if (request.recommendations) {
        // Delete existing recommendations
        await client.query(`
          DELETE FROM maintenance_recommendations WHERE maintenance_report_id = $1
        `, [id]);

        // Insert new recommendations
        for (const recommendation of request.recommendations) {
          await this.createRecommendation(client, id, recommendation);
        }
      }

      // Update materials used if provided
      if (request.materialsUsed) {
        // Delete existing materials
        await client.query(`
          DELETE FROM maintenance_materials_used WHERE maintenance_report_id = $1
        `, [id]);

        // Insert new materials
        for (const material of request.materialsUsed) {
          await this.createMaterialUsed(client, id, material);
        }
      }

      await client.query('COMMIT');

      return await this.findById(id) as MaintenanceReport;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(criteria: MaintenanceReportSearchCriteria): Promise<{
    reports: MaintenanceReportResponse[];
    total: number;
  }> {
    const client = await this.pool.connect();
    
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (criteria.caseId) {
        conditions.push(`d.case_id = $${paramIndex++}`);
        values.push(criteria.caseId);
      }

      if (criteria.deviceId) {
        conditions.push(`d.device_id = $${paramIndex++}`);
        values.push(criteria.deviceId);
      }

      if (criteria.technicianId) {
        conditions.push(`mr.created_by = $${paramIndex++}`);
        values.push(criteria.technicianId);
      }

      if (criteria.maintenanceType) {
        conditions.push(`mr.maintenance_type = $${paramIndex++}`);
        values.push(criteria.maintenanceType);
      }

      if (criteria.overallCondition) {
        conditions.push(`mr.overall_condition = $${paramIndex++}`);
        values.push(criteria.overallCondition);
      }

      if (criteria.dateFrom) {
        conditions.push(`mr.created_at >= $${paramIndex++}`);
        values.push(criteria.dateFrom);
      }

      if (criteria.dateTo) {
        conditions.push(`mr.created_at <= $${paramIndex++}`);
        values.push(criteria.dateTo);
      }

      if (criteria.checklistTemplateId) {
        conditions.push(`mr.checklist_template_id = $${paramIndex++}`);
        values.push(criteria.checklistTemplateId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total
        FROM maintenance_reports mr
        LEFT JOIN documents d ON mr.document_id = d.id
        ${whereClause}
      `, values);

      const total = parseInt(countResult.rows[0].total);

      // Get reports with pagination
      const limit = criteria.limit || 50;
      const offset = criteria.offset || 0;

      const reportsResult = await client.query(`
        SELECT 
          mr.*,
          COUNT(mci.id) as total_checklist_items,
          COUNT(CASE WHEN mci.status = 'pass' THEN 1 END) as completed_items,
          COUNT(CASE WHEN mci.status = 'fail' THEN 1 END) as failed_items,
          COALESCE(SUM(mmu.total_cost), 0) as total_material_cost
        FROM maintenance_reports mr
        LEFT JOIN documents d ON mr.document_id = d.id
        LEFT JOIN maintenance_checklist_items mci ON mr.id = mci.maintenance_report_id
        LEFT JOIN maintenance_materials_used mmu ON mr.id = mmu.maintenance_report_id
        ${whereClause}
        GROUP BY mr.id
        ORDER BY mr.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...values, limit, offset]);

      const reports: MaintenanceReportResponse[] = reportsResult.rows.map(row => ({
        id: row.id,
        documentId: row.document_id,
        maintenanceType: row.maintenance_type,
        checklistTemplateId: row.checklist_template_id,
        checklistItems: [], // Will be loaded separately if needed
        overallCondition: row.overall_condition,
        recommendations: [], // Will be loaded separately if needed
        nextMaintenanceDate: row.next_maintenance_date,
        maintenanceFrequencyMonths: row.maintenance_frequency_months,
        actualHours: parseFloat(row.actual_hours),
        materialsUsed: [], // Will be loaded separately if needed
        technicianNotes: row.technician_notes,
        customerFeedback: row.customer_feedback,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        totalChecklistItems: parseInt(row.total_checklist_items) || 0,
        completedItems: parseInt(row.completed_items) || 0,
        failedItems: parseInt(row.failed_items) || 0,
        completionPercentage: row.total_checklist_items > 0 
          ? Math.round((parseInt(row.completed_items) / parseInt(row.total_checklist_items)) * 100)
          : 0,
        totalMaterialCost: parseFloat(row.total_material_cost) || 0,
        overallScore: this.calculateOverallScore(
          parseInt(row.total_checklist_items) || 0,
          parseInt(row.completed_items) || 0,
          parseInt(row.failed_items) || 0
        )
      }));

      return { reports, total };
    } finally {
      client.release();
    }
  }

  async delete(id: UUID): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete related records (cascade should handle this, but being explicit)
      await client.query('DELETE FROM maintenance_materials_used WHERE maintenance_report_id = $1', [id]);
      await client.query('DELETE FROM maintenance_recommendations WHERE maintenance_report_id = $1', [id]);
      await client.query('DELETE FROM maintenance_checklist_item_images WHERE checklist_item_id IN (SELECT id FROM maintenance_checklist_items WHERE maintenance_report_id = $1)', [id]);
      await client.query('DELETE FROM maintenance_checklist_items WHERE maintenance_report_id = $1', [id]);
      await client.query('DELETE FROM maintenance_reports WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getChecklistItems(client: PoolClient, reportId: UUID): Promise<MaintenanceChecklistItem[]> {
    const result = await client.query(`
      SELECT 
        mci.*,
        COALESCE(
          json_agg(
            json_build_object(
              'fileName', mcii.file_name,
              'url', mcii.url,
              'caption', mcii.caption,
              'imageType', mcii.image_type
            )
          ) FILTER (WHERE mcii.id IS NOT NULL), 
          '[]'
        ) as images
      FROM maintenance_checklist_items mci
      LEFT JOIN maintenance_checklist_item_images mcii ON mci.id = mcii.checklist_item_id
      WHERE mci.maintenance_report_id = $1
      GROUP BY mci.id
      ORDER BY mci.created_at
    `, [reportId]);

    return result.rows.map(row => this.mapChecklistItemFromDb(row));
  }

  private async getRecommendations(client: PoolClient, reportId: UUID): Promise<MaintenanceRecommendation[]> {
    const result = await client.query(`
      SELECT * FROM maintenance_recommendations 
      WHERE maintenance_report_id = $1 
      ORDER BY priority, created_at
    `, [reportId]);

    return result.rows.map(row => ({
      id: row.id,
      priority: row.priority,
      category: row.category,
      description: row.description,
      estimatedCost: row.estimated_cost ? parseFloat(row.estimated_cost) : undefined,
      estimatedHours: row.estimated_hours ? parseFloat(row.estimated_hours) : undefined,
      dueDate: row.due_date,
      partIds: row.part_ids || []
    }));
  }

  private async getMaterialsUsed(client: PoolClient, reportId: UUID): Promise<MaterialUsed[]> {
    const result = await client.query(`
      SELECT * FROM maintenance_materials_used 
      WHERE maintenance_report_id = $1 
      ORDER BY created_at
    `, [reportId]);

    return result.rows.map(row => ({
      materialId: row.material_id,
      materialName: row.material_name,
      quantity: parseFloat(row.quantity),
      unitCost: parseFloat(row.unit_cost),
      totalCost: parseFloat(row.total_cost),
      notes: row.notes
    }));
  }

  private async updateChecklistItem(
    client: PoolClient, 
    reportId: UUID, 
    itemUpdate: UpdateMaintenanceChecklistItemRequest
  ): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (itemUpdate.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(itemUpdate.status);
    }

    if (itemUpdate.actualValue !== undefined) {
      updateFields.push(`actual_value = $${paramIndex++}`);
      updateValues.push(itemUpdate.actualValue);
    }

    if (itemUpdate.notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      updateValues.push(itemUpdate.notes);
    }

    if (itemUpdate.completedAt !== undefined) {
      updateFields.push(`completed_at = $${paramIndex++}`);
      updateValues.push(itemUpdate.completedAt);
    }

    if (itemUpdate.completedBy !== undefined) {
      updateFields.push(`completed_by = $${paramIndex++}`);
      updateValues.push(itemUpdate.completedBy);
    }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(reportId);
      updateValues.push(itemUpdate.itemId);

      await client.query(`
        UPDATE maintenance_checklist_items 
        SET ${updateFields.join(', ')}
        WHERE maintenance_report_id = $${paramIndex++} AND item_id = $${paramIndex++}
      `, updateValues);
    }

    // Handle images if provided
    if (itemUpdate.images) {
      // First, get the checklist item ID
      const itemResult = await client.query(`
        SELECT id FROM maintenance_checklist_items 
        WHERE maintenance_report_id = $1 AND item_id = $2
      `, [reportId, itemUpdate.itemId]);

      if (itemResult.rows.length > 0) {
        const checklistItemId = itemResult.rows[0].id;

        // Delete existing images
        await client.query(`
          DELETE FROM maintenance_checklist_item_images WHERE checklist_item_id = $1
        `, [checklistItemId]);

        // Insert new images
        for (const image of itemUpdate.images) {
          await client.query(`
            INSERT INTO maintenance_checklist_item_images (
              checklist_item_id, file_name, url, caption, image_type
            ) VALUES ($1, $2, $3, $4, $5)
          `, [checklistItemId, image.fileName, image.url, image.caption, image.imageType]);
        }
      }
    }
  }

  private async createRecommendation(
    client: PoolClient, 
    reportId: UUID, 
    recommendation: CreateMaintenanceRecommendationRequest
  ): Promise<void> {
    await client.query(`
      INSERT INTO maintenance_recommendations (
        maintenance_report_id, priority, category, description, 
        estimated_cost, estimated_hours, due_date, part_ids
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      reportId,
      recommendation.priority,
      recommendation.category,
      recommendation.description,
      recommendation.estimatedCost,
      recommendation.estimatedHours,
      recommendation.dueDate,
      recommendation.partIds || []
    ]);
  }

  private async createMaterialUsed(
    client: PoolClient, 
    reportId: UUID, 
    material: CreateMaterialUsedRequest
  ): Promise<void> {
    await client.query(`
      INSERT INTO maintenance_materials_used (
        maintenance_report_id, material_id, material_name, 
        quantity, unit_cost, total_cost, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      reportId,
      material.materialId,
      material.materialName,
      material.quantity,
      material.unitCost,
      material.totalCost,
      material.notes
    ]);
  }

  private mapChecklistItemFromDb(row: any): MaintenanceChecklistItem {
    return {
      itemId: row.item_id,
      category: row.category,
      description: row.description,
      type: row.type,
      required: row.required,
      status: row.status,
      actualValue: row.actual_value,
      expectedValue: row.expected_value,
      notes: row.notes,
      images: row.images || [],
      completedAt: row.completed_at,
      completedBy: row.completed_by
    };
  }

  private calculateOverallScore(totalItems: number, completedItems: number, failedItems: number): number {
    if (totalItems === 0) return 0;
    
    const passedItems = completedItems - failedItems;
    const passRate = passedItems / totalItems;
    const completionRate = completedItems / totalItems;
    
    // Weighted score: 70% pass rate, 30% completion rate
    return Math.round((passRate * 0.7 + completionRate * 0.3) * 100);
  }
}