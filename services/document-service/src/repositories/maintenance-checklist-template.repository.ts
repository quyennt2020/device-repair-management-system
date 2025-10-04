import { Pool, PoolClient } from 'pg';
import { UUID } from '../../../../shared/types/src/common';
import {
  MaintenanceChecklistTemplate,
  ChecklistTemplateItem,
  MaintenanceType
} from '../../../../shared/types/src/document';
import {
  CreateMaintenanceChecklistTemplateRequest,
  UpdateMaintenanceChecklistTemplateRequest,
  MaintenanceChecklistTemplateSearchCriteria,
  MaintenanceChecklistTemplateResponse,
  CreateChecklistTemplateItemRequest
} from '../types/maintenance-report';

export class MaintenanceChecklistTemplateRepository {
  constructor(private pool: Pool) {}

  async create(request: CreateMaintenanceChecklistTemplateRequest, createdBy: UUID): Promise<MaintenanceChecklistTemplate> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create template
      const templateResult = await client.query(`
        INSERT INTO maintenance_checklist_templates (
          name, device_type_id, maintenance_type, estimated_duration_hours,
          required_tools, required_parts, safety_requirements, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        request.name,
        request.deviceTypeId,
        request.maintenanceType,
        request.estimatedDurationHours,
        request.requiredTools,
        request.requiredParts,
        request.safetyRequirements,
        createdBy
      ]);

      const template = templateResult.rows[0];

      // Create checklist items
      const checklistItems: ChecklistTemplateItem[] = [];
      
      for (const item of request.checklistItems) {
        const itemResult = await client.query(`
          INSERT INTO checklist_template_items (
            template_id, category, description, type, required, order_index,
            expected_value, tolerance, instructions, safety_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `, [
          template.id,
          item.category,
          item.description,
          item.type,
          item.required,
          item.order,
          item.expectedValue,
          item.tolerance,
          item.instructions,
          item.safetyNotes
        ]);

        checklistItems.push(this.mapChecklistTemplateItemFromDb(itemResult.rows[0]));
      }

      await client.query('COMMIT');

      return {
        id: template.id,
        name: template.name,
        deviceTypeId: template.device_type_id,
        maintenanceType: template.maintenance_type,
        version: template.version,
        isActive: template.is_active,
        checklistItems,
        estimatedDurationHours: parseFloat(template.estimated_duration_hours),
        requiredTools: template.required_tools || [],
        requiredParts: template.required_parts || [],
        safetyRequirements: template.safety_requirements || [],
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        createdBy: template.created_by,
        updatedBy: template.updated_by
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: UUID): Promise<MaintenanceChecklistTemplate | null> {
    const client = await this.pool.connect();
    
    try {
      // Get template
      const templateResult = await client.query(`
        SELECT * FROM maintenance_checklist_templates WHERE id = $1
      `, [id]);

      if (templateResult.rows.length === 0) {
        return null;
      }

      const template = templateResult.rows[0];

      // Get checklist items
      const itemsResult = await client.query(`
        SELECT * FROM checklist_template_items 
        WHERE template_id = $1 
        ORDER BY order_index
      `, [id]);

      const checklistItems = itemsResult.rows.map(row => this.mapChecklistTemplateItemFromDb(row));

      return {
        id: template.id,
        name: template.name,
        deviceTypeId: template.device_type_id,
        maintenanceType: template.maintenance_type,
        version: template.version,
        isActive: template.is_active,
        checklistItems,
        estimatedDurationHours: parseFloat(template.estimated_duration_hours),
        requiredTools: template.required_tools || [],
        requiredParts: template.required_parts || [],
        safetyRequirements: template.safety_requirements || [],
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        createdBy: template.created_by,
        updatedBy: template.updated_by
      };
    } finally {
      client.release();
    }
  }

  async findByDeviceTypeAndMaintenanceType(
    deviceTypeId: UUID, 
    maintenanceType: MaintenanceType
  ): Promise<MaintenanceChecklistTemplate[]> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id FROM maintenance_checklist_templates 
        WHERE device_type_id = $1 AND maintenance_type = $2 AND is_active = true
        ORDER BY version DESC
      `, [deviceTypeId, maintenanceType]);

      const templates: MaintenanceChecklistTemplate[] = [];
      
      for (const row of result.rows) {
        const template = await this.findById(row.id);
        if (template) {
          templates.push(template);
        }
      }

      return templates;
    } finally {
      client.release();
    }
  }

  async findActiveByDeviceTypeAndMaintenanceType(
    deviceTypeId: UUID, 
    maintenanceType: MaintenanceType
  ): Promise<MaintenanceChecklistTemplate | null> {
    const templates = await this.findByDeviceTypeAndMaintenanceType(deviceTypeId, maintenanceType);
    return templates.length > 0 ? templates[0] : null;
  }

  async update(id: UUID, request: UpdateMaintenanceChecklistTemplateRequest, updatedBy: UUID): Promise<MaintenanceChecklistTemplate> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update template
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (request.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(request.name);
      }

      if (request.estimatedDurationHours !== undefined) {
        updateFields.push(`estimated_duration_hours = $${paramIndex++}`);
        updateValues.push(request.estimatedDurationHours);
      }

      if (request.requiredTools !== undefined) {
        updateFields.push(`required_tools = $${paramIndex++}`);
        updateValues.push(request.requiredTools);
      }

      if (request.requiredParts !== undefined) {
        updateFields.push(`required_parts = $${paramIndex++}`);
        updateValues.push(request.requiredParts);
      }

      if (request.safetyRequirements !== undefined) {
        updateFields.push(`safety_requirements = $${paramIndex++}`);
        updateValues.push(request.safetyRequirements);
      }

      if (request.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(request.isActive);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateFields.push(`updated_by = $${paramIndex++}`);
        updateValues.push(updatedBy);
        updateValues.push(id);

        await client.query(`
          UPDATE maintenance_checklist_templates 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `, updateValues);
      }

      // Update checklist items if provided
      if (request.checklistItems) {
        // Delete existing items
        await client.query(`
          DELETE FROM checklist_template_items WHERE template_id = $1
        `, [id]);

        // Insert new items
        for (const item of request.checklistItems) {
          await client.query(`
            INSERT INTO checklist_template_items (
              template_id, category, description, type, required, order_index,
              expected_value, tolerance, instructions, safety_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            id,
            item.category,
            item.description,
            item.type,
            item.required,
            item.order,
            item.expectedValue,
            item.tolerance,
            item.instructions,
            item.safetyNotes
          ]);
        }
      }

      await client.query('COMMIT');

      return await this.findById(id) as MaintenanceChecklistTemplate;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(criteria: MaintenanceChecklistTemplateSearchCriteria): Promise<{
    templates: MaintenanceChecklistTemplateResponse[];
    total: number;
  }> {
    const client = await this.pool.connect();
    
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (criteria.deviceTypeId) {
        conditions.push(`mct.device_type_id = $${paramIndex++}`);
        values.push(criteria.deviceTypeId);
      }

      if (criteria.maintenanceType) {
        conditions.push(`mct.maintenance_type = $${paramIndex++}`);
        values.push(criteria.maintenanceType);
      }

      if (criteria.isActive !== undefined) {
        conditions.push(`mct.is_active = $${paramIndex++}`);
        values.push(criteria.isActive);
      }

      if (criteria.name) {
        conditions.push(`mct.name ILIKE $${paramIndex++}`);
        values.push(`%${criteria.name}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total
        FROM maintenance_checklist_templates mct
        ${whereClause}
      `, values);

      const total = parseInt(countResult.rows[0].total);

      // Get templates with pagination
      const limit = criteria.limit || 50;
      const offset = criteria.offset || 0;

      const templatesResult = await client.query(`
        SELECT 
          mct.*,
          COUNT(cti.id) as total_items,
          COUNT(CASE WHEN cti.required = true THEN 1 END) as required_items,
          COUNT(mr.id) as usage_count,
          AVG(mr.actual_hours) as average_completion_time
        FROM maintenance_checklist_templates mct
        LEFT JOIN checklist_template_items cti ON mct.id = cti.template_id
        LEFT JOIN maintenance_reports mr ON mct.id = mr.checklist_template_id
        ${whereClause}
        GROUP BY mct.id
        ORDER BY mct.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...values, limit, offset]);

      const templates: MaintenanceChecklistTemplateResponse[] = templatesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        deviceTypeId: row.device_type_id,
        maintenanceType: row.maintenance_type,
        version: row.version,
        isActive: row.is_active,
        checklistItems: [], // Will be loaded separately if needed
        estimatedDurationHours: parseFloat(row.estimated_duration_hours),
        requiredTools: row.required_tools || [],
        requiredParts: row.required_parts || [],
        safetyRequirements: row.safety_requirements || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        totalItems: parseInt(row.total_items) || 0,
        requiredItems: parseInt(row.required_items) || 0,
        usageCount: parseInt(row.usage_count) || 0,
        averageCompletionTime: row.average_completion_time ? parseFloat(row.average_completion_time) : 0
      }));

      return { templates, total };
    } finally {
      client.release();
    }
  }

  async createNewVersion(templateId: UUID, createdBy: UUID): Promise<MaintenanceChecklistTemplate> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current template
      const currentTemplate = await this.findById(templateId);
      if (!currentTemplate) {
        throw new Error('Template not found');
      }

      // Deactivate current version
      await client.query(`
        UPDATE maintenance_checklist_templates 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP, updated_by = $1
        WHERE id = $2
      `, [createdBy, templateId]);

      // Create new version
      const versionParts = currentTemplate.version.split('.');
      const majorVersion = parseInt(versionParts[0]);
      const minorVersion = versionParts.length > 1 ? parseInt(versionParts[1]) : 0;
      const newVersion = `${majorVersion}.${minorVersion + 1}`;

      const newTemplateResult = await client.query(`
        INSERT INTO maintenance_checklist_templates (
          name, device_type_id, maintenance_type, version, estimated_duration_hours,
          required_tools, required_parts, safety_requirements, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        currentTemplate.name,
        currentTemplate.deviceTypeId,
        currentTemplate.maintenanceType,
        newVersion,
        currentTemplate.estimatedDurationHours,
        currentTemplate.requiredTools,
        currentTemplate.requiredParts,
        currentTemplate.safetyRequirements,
        createdBy
      ]);

      const newTemplate = newTemplateResult.rows[0];

      // Copy checklist items
      for (const item of currentTemplate.checklistItems) {
        await client.query(`
          INSERT INTO checklist_template_items (
            template_id, category, description, type, required, order_index,
            expected_value, tolerance, instructions, safety_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          newTemplate.id,
          item.category,
          item.description,
          item.type,
          item.required,
          item.order,
          item.expectedValue,
          item.tolerance,
          item.instructions,
          item.safetyNotes
        ]);
      }

      await client.query('COMMIT');

      return await this.findById(newTemplate.id) as MaintenanceChecklistTemplate;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async delete(id: UUID): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if template is being used
      const usageResult = await client.query(`
        SELECT COUNT(*) as count FROM maintenance_reports WHERE checklist_template_id = $1
      `, [id]);

      if (parseInt(usageResult.rows[0].count) > 0) {
        throw new Error('Cannot delete template that is being used by maintenance reports');
      }

      // Delete template items
      await client.query('DELETE FROM checklist_template_items WHERE template_id = $1', [id]);
      
      // Delete template
      await client.query('DELETE FROM maintenance_checklist_templates WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTemplateUsageStats(templateId: UUID): Promise<{
    totalUsage: number;
    averageCompletionTime: number;
    averagePassRate: number;
    commonFailurePoints: string[];
  }> {
    const client = await this.pool.connect();
    
    try {
      // Get usage statistics
      const statsResult = await client.query(`
        SELECT 
          COUNT(mr.id) as total_usage,
          AVG(mr.actual_hours) as average_completion_time,
          COUNT(mci.id) as total_items,
          COUNT(CASE WHEN mci.status = 'pass' THEN 1 END) as passed_items
        FROM maintenance_reports mr
        LEFT JOIN maintenance_checklist_items mci ON mr.id = mci.maintenance_report_id
        WHERE mr.checklist_template_id = $1
      `, [templateId]);

      const stats = statsResult.rows[0];
      const totalUsage = parseInt(stats.total_usage) || 0;
      const averageCompletionTime = stats.average_completion_time ? parseFloat(stats.average_completion_time) : 0;
      const totalItems = parseInt(stats.total_items) || 0;
      const passedItems = parseInt(stats.passed_items) || 0;
      const averagePassRate = totalItems > 0 ? (passedItems / totalItems) * 100 : 0;

      // Get common failure points
      const failurePointsResult = await client.query(`
        SELECT 
          mci.description,
          COUNT(*) as failure_count
        FROM maintenance_checklist_items mci
        JOIN maintenance_reports mr ON mci.maintenance_report_id = mr.id
        WHERE mr.checklist_template_id = $1 AND mci.status = 'fail'
        GROUP BY mci.description
        ORDER BY failure_count DESC
        LIMIT 5
      `, [templateId]);

      const commonFailurePoints = failurePointsResult.rows.map(row => row.description);

      return {
        totalUsage,
        averageCompletionTime,
        averagePassRate,
        commonFailurePoints
      };
    } finally {
      client.release();
    }
  }

  private mapChecklistTemplateItemFromDb(row: any): ChecklistTemplateItem {
    return {
      id: row.id,
      category: row.category,
      description: row.description,
      type: row.type,
      required: row.required,
      order: row.order_index,
      expectedValue: row.expected_value,
      tolerance: row.tolerance,
      instructions: row.instructions,
      safetyNotes: row.safety_notes
    };
  }
}