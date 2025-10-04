import { UUID } from '../../../../shared/types/src/common';
import {
  MaintenanceChecklistTemplate,
  MaintenanceType
} from '../../../../shared/types/src/document';
import {
  CreateMaintenanceChecklistTemplateRequest,
  UpdateMaintenanceChecklistTemplateRequest,
  MaintenanceChecklistTemplateSearchCriteria,
  MaintenanceChecklistTemplateSearchResult,
  MaintenanceChecklistTemplateResponse,
  TemplateVersionInfo,
  TemplateVersionComparisonResult
} from '../types/maintenance-report';
import { MaintenanceChecklistTemplateRepository } from '../repositories/maintenance-checklist-template.repository';

export class MaintenanceChecklistTemplateService {
  constructor(
    private templateRepository: MaintenanceChecklistTemplateRepository
  ) {}

  async createTemplate(
    request: CreateMaintenanceChecklistTemplateRequest, 
    createdBy: UUID
  ): Promise<MaintenanceChecklistTemplate> {
    // Validate checklist items order
    this.validateChecklistItemsOrder(request.checklistItems);

    // Check for duplicate template (same device type and maintenance type)
    const existingTemplates = await this.templateRepository.findByDeviceTypeAndMaintenanceType(
      request.deviceTypeId,
      request.maintenanceType
    );

    if (existingTemplates.length > 0) {
      // Deactivate existing templates
      for (const template of existingTemplates) {
        await this.templateRepository.update(template.id, { isActive: false }, createdBy);
      }
    }

    return await this.templateRepository.create(request, createdBy);
  }

  async getTemplate(id: UUID): Promise<MaintenanceChecklistTemplate | null> {
    return await this.templateRepository.findById(id);
  }

  async getActiveTemplateForDevice(
    deviceTypeId: UUID, 
    maintenanceType: MaintenanceType
  ): Promise<MaintenanceChecklistTemplate | null> {
    return await this.templateRepository.findActiveByDeviceTypeAndMaintenanceType(
      deviceTypeId, 
      maintenanceType
    );
  }

  async getTemplatesForDevice(
    deviceTypeId: UUID, 
    maintenanceType: MaintenanceType
  ): Promise<MaintenanceChecklistTemplate[]> {
    return await this.templateRepository.findByDeviceTypeAndMaintenanceType(
      deviceTypeId, 
      maintenanceType
    );
  }

  async updateTemplate(
    id: UUID, 
    request: UpdateMaintenanceChecklistTemplateRequest, 
    updatedBy: UUID
  ): Promise<MaintenanceChecklistTemplate> {
    const existingTemplate = await this.templateRepository.findById(id);
    if (!existingTemplate) {
      throw new Error('Maintenance checklist template not found');
    }

    // Validate checklist items order if provided
    if (request.checklistItems) {
      this.validateChecklistItemsOrder(request.checklistItems);
    }

    // If template is being used, create a new version instead of updating
    const usageStats = await this.templateRepository.getTemplateUsageStats(id);
    if (usageStats.totalUsage > 0 && (request.checklistItems || request.name)) {
      throw new Error('Cannot modify template that is in use. Create a new version instead.');
    }

    return await this.templateRepository.update(id, request, updatedBy);
  }

  async createNewVersion(templateId: UUID, createdBy: UUID): Promise<MaintenanceChecklistTemplate> {
    const existingTemplate = await this.templateRepository.findById(templateId);
    if (!existingTemplate) {
      throw new Error('Template not found');
    }

    return await this.templateRepository.createNewVersion(templateId, createdBy);
  }

  async searchTemplates(criteria: MaintenanceChecklistTemplateSearchCriteria): Promise<MaintenanceChecklistTemplateSearchResult> {
    const { templates, total } = await this.templateRepository.search(criteria);
    
    return {
      templates,
      total,
      limit: criteria.limit || 50,
      offset: criteria.offset || 0
    };
  }

  async activateTemplate(id: UUID, updatedBy: UUID): Promise<MaintenanceChecklistTemplate> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Deactivate other templates for the same device type and maintenance type
    const existingTemplates = await this.templateRepository.findByDeviceTypeAndMaintenanceType(
      template.deviceTypeId,
      template.maintenanceType
    );

    for (const existingTemplate of existingTemplates) {
      if (existingTemplate.id !== id && existingTemplate.isActive) {
        await this.templateRepository.update(existingTemplate.id, { isActive: false }, updatedBy);
      }
    }

    // Activate the target template
    return await this.templateRepository.update(id, { isActive: true }, updatedBy);
  }

  async deactivateTemplate(id: UUID, updatedBy: UUID): Promise<MaintenanceChecklistTemplate> {
    return await this.templateRepository.update(id, { isActive: false }, updatedBy);
  }

  async deleteTemplate(id: UUID): Promise<void> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new Error('Template not found');
    }

    // Check if template is being used
    const usageStats = await this.templateRepository.getTemplateUsageStats(id);
    if (usageStats.totalUsage > 0) {
      throw new Error('Cannot delete template that is being used by maintenance reports');
    }

    await this.templateRepository.delete(id);
  }

  async getTemplateUsageStats(templateId: UUID): Promise<{
    totalUsage: number;
    averageCompletionTime: number;
    averagePassRate: number;
    commonFailurePoints: string[];
  }> {
    return await this.templateRepository.getTemplateUsageStats(templateId);
  }

  async getTemplateVersions(deviceTypeId: UUID, maintenanceType: MaintenanceType): Promise<TemplateVersionInfo[]> {
    const templates = await this.templateRepository.findByDeviceTypeAndMaintenanceType(
      deviceTypeId,
      maintenanceType
    );

    return templates.map(template => ({
      templateId: template.id,
      version: template.version,
      isActive: template.isActive,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
      changeLog: `Version ${template.version}`, // Would be stored separately in a real system
      migrationRequired: false // Would be determined by comparing versions
    }));
  }

  async compareTemplateVersions(
    oldTemplateId: UUID, 
    newTemplateId: UUID
  ): Promise<TemplateVersionComparisonResult> {
    const oldTemplate = await this.templateRepository.findById(oldTemplateId);
    const newTemplate = await this.templateRepository.findById(newTemplateId);

    if (!oldTemplate || !newTemplate) {
      throw new Error('One or both templates not found');
    }

    const oldVersionInfo: TemplateVersionInfo = {
      templateId: oldTemplate.id,
      version: oldTemplate.version,
      isActive: oldTemplate.isActive,
      createdAt: oldTemplate.createdAt,
      createdBy: oldTemplate.createdBy,
      changeLog: `Version ${oldTemplate.version}`,
      migrationRequired: false
    };

    const newVersionInfo: TemplateVersionInfo = {
      templateId: newTemplate.id,
      version: newTemplate.version,
      isActive: newTemplate.isActive,
      createdAt: newTemplate.createdAt,
      createdBy: newTemplate.createdBy,
      changeLog: `Version ${newTemplate.version}`,
      migrationRequired: false
    };

    // Compare checklist items
    const oldItemIds = new Set(oldTemplate.checklistItems.map(item => item.id));
    const newItemIds = new Set(newTemplate.checklistItems.map(item => item.id));

    const addedItems = newTemplate.checklistItems.filter(item => !oldItemIds.has(item.id));
    const removedItems = oldTemplate.checklistItems.filter(item => !newItemIds.has(item.id));
    
    const modifiedItems = newTemplate.checklistItems.filter(newItem => {
      const oldItem = oldTemplate.checklistItems.find(item => item.id === newItem.id);
      if (!oldItem) return false;
      
      return JSON.stringify(oldItem) !== JSON.stringify(newItem);
    });

    // Get impact count (would query maintenance reports using this template)
    const usageStats = await this.templateRepository.getTemplateUsageStats(oldTemplateId);
    const impactedReports = usageStats.totalUsage;

    return {
      oldVersion: oldVersionInfo,
      newVersion: newVersionInfo,
      addedItems,
      removedItems,
      modifiedItems,
      impactedReports
    };
  }

  async duplicateTemplate(
    templateId: UUID, 
    newName: string, 
    createdBy: UUID
  ): Promise<MaintenanceChecklistTemplate> {
    const sourceTemplate = await this.templateRepository.findById(templateId);
    if (!sourceTemplate) {
      throw new Error('Source template not found');
    }

    const duplicateRequest: CreateMaintenanceChecklistTemplateRequest = {
      name: newName,
      deviceTypeId: sourceTemplate.deviceTypeId,
      maintenanceType: sourceTemplate.maintenanceType,
      checklistItems: sourceTemplate.checklistItems.map(item => ({
        category: item.category,
        description: item.description,
        type: item.type,
        required: item.required,
        order: item.order,
        expectedValue: item.expectedValue,
        tolerance: item.tolerance,
        instructions: item.instructions,
        safetyNotes: item.safetyNotes
      })),
      estimatedDurationHours: sourceTemplate.estimatedDurationHours,
      requiredTools: [...sourceTemplate.requiredTools],
      requiredParts: [...sourceTemplate.requiredParts],
      safetyRequirements: [...sourceTemplate.safetyRequirements]
    };

    // Don't auto-deactivate existing templates when duplicating
    return await this.templateRepository.create(duplicateRequest, createdBy);
  }

  async validateTemplate(template: MaintenanceChecklistTemplate): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic fields
    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.deviceTypeId) {
      errors.push('Device type is required');
    }

    if (!template.maintenanceType) {
      errors.push('Maintenance type is required');
    }

    if (template.estimatedDurationHours <= 0) {
      errors.push('Estimated duration must be greater than 0');
    }

    // Validate checklist items
    if (!template.checklistItems || template.checklistItems.length === 0) {
      errors.push('At least one checklist item is required');
    } else {
      // Check for duplicate orders
      const orders = template.checklistItems.map(item => item.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push('Checklist items must have unique order values');
      }

      // Check for required items
      const requiredItems = template.checklistItems.filter(item => item.required);
      if (requiredItems.length === 0) {
        warnings.push('Consider marking some checklist items as required');
      }

      // Validate individual items
      template.checklistItems.forEach((item, index) => {
        if (!item.description || item.description.trim().length === 0) {
          errors.push(`Checklist item ${index + 1}: Description is required`);
        }

        if (!item.category || item.category.trim().length === 0) {
          errors.push(`Checklist item ${index + 1}: Category is required`);
        }

        if (item.type === 'measurement' && !item.expectedValue) {
          warnings.push(`Checklist item ${index + 1}: Expected value recommended for measurement items`);
        }
      });
    }

    // Validate safety requirements
    if (template.safetyRequirements.length === 0) {
      warnings.push('Consider adding safety requirements');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateChecklistItemsOrder(items: any[]): void {
    const orders = items.map(item => item.order);
    const uniqueOrders = new Set(orders);
    
    if (orders.length !== uniqueOrders.size) {
      throw new Error('Checklist items must have unique order values');
    }

    // Check for gaps in ordering (optional, but good practice)
    const sortedOrders = orders.sort((a, b) => a - b);
    for (let i = 1; i < sortedOrders.length; i++) {
      if (sortedOrders[i] - sortedOrders[i-1] > 10) {
        // Allow gaps but warn about large gaps
        console.warn(`Large gap in checklist item ordering between ${sortedOrders[i-1]} and ${sortedOrders[i]}`);
      }
    }
  }
}