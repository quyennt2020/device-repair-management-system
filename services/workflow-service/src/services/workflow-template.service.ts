import { db } from '@drms/shared-database';
import { UUID } from '@drms/shared-types';
import { WorkflowDefinitionService, CreateWorkflowDefinitionRequest } from './workflow-definition.service';

export interface WorkflowTemplate {
  id: UUID;
  name: string;
  description: string;
  category: string;
  deviceTypes: string[];
  serviceTypes: string[];
  customerTiers: string[];
  templateData: any;
  isPublic: boolean;
  createdBy: UUID;
  createdByName?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  category: string;
  deviceTypes: string[];
  serviceTypes: string[];
  customerTiers: string[];
  templateData: any;
  isPublic?: boolean;
}

export interface TemplateFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  deviceType?: string;
  serviceType?: string;
  customerTier?: string;
  isPublic?: boolean;
  createdBy?: UUID;
}

export class WorkflowTemplateService {
  private workflowDefinitionService: WorkflowDefinitionService;

  constructor() {
    this.workflowDefinitionService = new WorkflowDefinitionService();
  }

  /**
   * Create a new workflow template
   */
  async createTemplate(request: CreateTemplateRequest, createdBy: UUID): Promise<WorkflowTemplate> {
    try {
      // Validate template data
      await this.validateTemplateData(request.templateData);

      // Check for name conflicts
      const existingTemplate = await this.findTemplateByName(request.name);
      if (existingTemplate) {
        throw new Error(`Template with name '${request.name}' already exists`);
      }

      const result = await db.query(`
        INSERT INTO workflow_templates (
          name, description, category, device_types, service_types, 
          customer_tiers, template_data, is_public, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        request.name,
        request.description,
        request.category,
        JSON.stringify(request.deviceTypes),
        JSON.stringify(request.serviceTypes),
        JSON.stringify(request.customerTiers),
        JSON.stringify(request.templateData),
        request.isPublic || false,
        createdBy
      ]);

      const template = result.rows[0];

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        deviceTypes: template.device_types,
        serviceTypes: template.service_types,
        customerTiers: template.customer_tiers,
        templateData: template.template_data,
        isPublic: template.is_public,
        createdBy: template.created_by,
        usageCount: 0,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      };
    } catch (error) {
      console.error('Create template error:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: UUID): Promise<WorkflowTemplate | null> {
    try {
      const result = await db.query(`
        SELECT 
          wt.*,
          u.full_name as created_by_name,
          (SELECT COUNT(*) FROM workflow_definitions wd WHERE wd.metadata->>'templateId' = wt.id::text) as usage_count
        FROM workflow_templates wt
        LEFT JOIN users u ON wt.created_by = u.id
        WHERE wt.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const template = result.rows[0];

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        deviceTypes: template.device_types,
        serviceTypes: template.service_types,
        customerTiers: template.customer_tiers,
        templateData: template.template_data,
        isPublic: template.is_public,
        createdBy: template.created_by,
        createdByName: template.created_by_name,
        usageCount: parseInt(template.usage_count),
        createdAt: template.created_at,
        updatedAt: template.updated_at
      };
    } catch (error) {
      console.error('Get template error:', error);
      throw error;
    }
  }

  /**
   * Get templates with filtering
   */
  async getTemplates(filters: TemplateFilters = {}): Promise<{
    templates: WorkflowTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        deviceType,
        serviceType,
        customerTier,
        isPublic,
        createdBy
      } = filters;

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      // Build WHERE conditions
      if (search) {
        conditions.push(`(wt.name ILIKE $${paramCount} OR wt.description ILIKE $${paramCount})`);
        params.push(`%${search}%`);
        paramCount++;
      }

      if (category) {
        conditions.push(`wt.category = $${paramCount}`);
        params.push(category);
        paramCount++;
      }

      if (deviceType) {
        conditions.push(`wt.device_types::jsonb ? $${paramCount}`);
        params.push(deviceType);
        paramCount++;
      }

      if (serviceType) {
        conditions.push(`wt.service_types::jsonb ? $${paramCount}`);
        params.push(serviceType);
        paramCount++;
      }

      if (customerTier) {
        conditions.push(`wt.customer_tiers::jsonb ? $${paramCount}`);
        params.push(customerTier);
        paramCount++;
      }

      if (isPublic !== undefined) {
        conditions.push(`wt.is_public = $${paramCount}`);
        params.push(isPublic);
        paramCount++;
      }

      if (createdBy) {
        conditions.push(`wt.created_by = $${paramCount}`);
        params.push(createdBy);
        paramCount++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM workflow_templates wt
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get templates
      const templatesQuery = `
        SELECT 
          wt.*,
          u.full_name as created_by_name,
          (SELECT COUNT(*) FROM workflow_definitions wd WHERE wd.metadata->>'templateId' = wt.id::text) as usage_count
        FROM workflow_templates wt
        LEFT JOIN users u ON wt.created_by = u.id
        ${whereClause}
        ORDER BY wt.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      params.push(limit, offset);
      const templatesResult = await db.query(templatesQuery, params);

      const templates = templatesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        deviceTypes: row.device_types,
        serviceTypes: row.service_types,
        customerTiers: row.customer_tiers,
        templateData: row.template_data,
        isPublic: row.is_public,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        usageCount: parseInt(row.usage_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        templates,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get templates error:', error);
      throw error;
    }
  }

  /**
   * Create workflow from template
   */
  async createWorkflowFromTemplate(
    templateId: UUID,
    workflowName: string,
    customizations: any = {},
    createdBy: UUID
  ): Promise<any> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Merge template data with customizations
      const workflowData = this.mergeTemplateWithCustomizations(template.templateData, customizations);

      // Create workflow request
      const createRequest: CreateWorkflowDefinitionRequest = {
        name: workflowName,
        description: workflowData.description || `Workflow created from template: ${template.name}`,
        deviceTypes: customizations.deviceTypes || template.deviceTypes,
        serviceTypes: customizations.serviceTypes || template.serviceTypes,
        customerTiers: customizations.customerTiers || template.customerTiers,
        steps: workflowData.steps,
        metadata: {
          templateId: templateId,
          templateName: template.name,
          createdFromTemplate: true,
          customizations
        }
      };

      // Create the workflow
      const workflow = await this.workflowDefinitionService.createWorkflowDefinition(createRequest, createdBy);

      // Update template usage count
      await this.incrementTemplateUsage(templateId);

      return workflow;
    } catch (error) {
      console.error('Create workflow from template error:', error);
      throw error;
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    id: UUID,
    updates: Partial<CreateTemplateRequest>,
    updatedBy: UUID
  ): Promise<WorkflowTemplate> {
    try {
      const existingTemplate = await this.getTemplate(id);
      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      // Check permissions (only creator or admin can update)
      if (existingTemplate.createdBy !== updatedBy) {
        // TODO: Check if user is admin
        throw new Error('Insufficient permissions to update template');
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }

      if (updates.category !== undefined) {
        updateFields.push(`category = $${paramCount++}`);
        values.push(updates.category);
      }

      if (updates.deviceTypes !== undefined) {
        updateFields.push(`device_types = $${paramCount++}`);
        values.push(JSON.stringify(updates.deviceTypes));
      }

      if (updates.serviceTypes !== undefined) {
        updateFields.push(`service_types = $${paramCount++}`);
        values.push(JSON.stringify(updates.serviceTypes));
      }

      if (updates.customerTiers !== undefined) {
        updateFields.push(`customer_tiers = $${paramCount++}`);
        values.push(JSON.stringify(updates.customerTiers));
      }

      if (updates.templateData !== undefined) {
        await this.validateTemplateData(updates.templateData);
        updateFields.push(`template_data = $${paramCount++}`);
        values.push(JSON.stringify(updates.templateData));
      }

      if (updates.isPublic !== undefined) {
        updateFields.push(`is_public = $${paramCount++}`);
        values.push(updates.isPublic);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id);

      await db.query(`
        UPDATE workflow_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `, values);

      return await this.getTemplate(id) as WorkflowTemplate;
    } catch (error) {
      console.error('Update template error:', error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: UUID, deletedBy: UUID): Promise<void> {
    try {
      const template = await this.getTemplate(id);
      if (!template) {
        throw new Error('Template not found');
      }

      // Check permissions
      if (template.createdBy !== deletedBy) {
        // TODO: Check if user is admin
        throw new Error('Insufficient permissions to delete template');
      }

      // Check if template is being used
      if (template.usageCount > 0) {
        throw new Error('Cannot delete template that is being used by workflows');
      }

      await db.query('DELETE FROM workflow_templates WHERE id = $1', [id]);
    } catch (error) {
      console.error('Delete template error:', error);
      throw error;
    }
  }

  /**
   * Get template categories
   */
  async getTemplateCategories(): Promise<string[]> {
    try {
      const result = await db.query(`
        SELECT DISTINCT category 
        FROM workflow_templates 
        WHERE category IS NOT NULL 
        ORDER BY category
      `);

      return result.rows.map(row => row.category);
    } catch (error) {
      console.error('Get template categories error:', error);
      throw error;
    }
  }

  /**
   * Get recommended templates for device type
   */
  async getRecommendedTemplates(
    deviceType: string,
    serviceType?: string,
    customerTier?: string,
    limit: number = 5
  ): Promise<WorkflowTemplate[]> {
    try {
      const conditions = ['wt.device_types::jsonb ? $1', 'wt.is_public = true'];
      const params = [deviceType];
      let paramCount = 2;

      if (serviceType) {
        conditions.push(`wt.service_types::jsonb ? $${paramCount++}`);
        params.push(serviceType);
      }

      if (customerTier) {
        conditions.push(`wt.customer_tiers::jsonb ? $${paramCount++}`);
        params.push(customerTier);
      }

      const result = await db.query(`
        SELECT 
          wt.*,
          u.full_name as created_by_name,
          (SELECT COUNT(*) FROM workflow_definitions wd WHERE wd.metadata->>'templateId' = wt.id::text) as usage_count
        FROM workflow_templates wt
        LEFT JOIN users u ON wt.created_by = u.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY usage_count DESC, wt.created_at DESC
        LIMIT $${paramCount}
      `, [...params, limit]);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        deviceTypes: row.device_types,
        serviceTypes: row.service_types,
        customerTiers: row.customer_tiers,
        templateData: row.template_data,
        isPublic: row.is_public,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        usageCount: parseInt(row.usage_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Get recommended templates error:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async validateTemplateData(templateData: any): Promise<void> {
    if (!templateData || typeof templateData !== 'object') {
      throw new Error('Template data must be an object');
    }

    if (!templateData.steps || !Array.isArray(templateData.steps)) {
      throw new Error('Template data must include steps array');
    }

    if (templateData.steps.length === 0) {
      throw new Error('Template must have at least one step');
    }

    // Basic step validation
    for (const step of templateData.steps) {
      if (!step.name || !step.type) {
        throw new Error('Each step must have a name and type');
      }
    }
  }

  private async findTemplateByName(name: string): Promise<any> {
    const result = await db.query('SELECT * FROM workflow_templates WHERE name = $1', [name]);
    return result.rows[0] || null;
  }

  private mergeTemplateWithCustomizations(templateData: any, customizations: any): any {
    // Deep merge template data with customizations
    const merged = JSON.parse(JSON.stringify(templateData));

    if (customizations.description) {
      merged.description = customizations.description;
    }

    if (customizations.steps) {
      // Merge step customizations
      customizations.steps.forEach((customStep: any) => {
        const templateStep = merged.steps.find((s: any) => s.name === customStep.name);
        if (templateStep) {
          Object.assign(templateStep, customStep);
        }
      });
    }

    return merged;
  }

  private async incrementTemplateUsage(templateId: UUID): Promise<void> {
    try {
      // This is tracked via metadata in workflow_definitions, so no direct increment needed
      // The usage count is calculated dynamically in queries
    } catch (error) {
      console.error('Increment template usage error:', error);
    }
  }
}