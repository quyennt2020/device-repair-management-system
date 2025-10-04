import { Request, Response } from 'express';
import { UUID } from '../../../../shared/types/src/common';
import { MaintenanceType } from '../../../../shared/types/src/document';
import { MaintenanceChecklistTemplateService } from '../services/maintenance-checklist-template.service';
import {
  CreateMaintenanceChecklistTemplateRequest,
  UpdateMaintenanceChecklistTemplateRequest,
  MaintenanceChecklistTemplateSearchCriteria
} from '../types/maintenance-report';

export class MaintenanceChecklistTemplateController {
  constructor(private templateService: MaintenanceChecklistTemplateService) {}

  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateMaintenanceChecklistTemplateRequest = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const template = await this.templateService.createTemplate(request, createdBy);
      
      res.status(201).json({
        success: true,
        data: template,
        message: 'Maintenance checklist template created successfully'
      });
    } catch (error) {
      console.error('Error creating maintenance checklist template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create maintenance checklist template'
      });
    }
  }

  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await this.templateService.getTemplate(id as UUID);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Maintenance checklist template not found'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error getting maintenance checklist template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get maintenance checklist template'
      });
    }
  }

  async getActiveTemplateForDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceTypeId, maintenanceType } = req.params;
      
      const template = await this.templateService.getActiveTemplateForDevice(
        deviceTypeId as UUID,
        maintenanceType as MaintenanceType
      );

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'No active maintenance checklist template found for this device type and maintenance type'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error getting active template for device:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active template for device'
      });
    }
  }

  async getTemplatesForDevice(req: Request, res: Response): Promise<void> {
    try {
      const { deviceTypeId, maintenanceType } = req.params;
      
      const templates = await this.templateService.getTemplatesForDevice(
        deviceTypeId as UUID,
        maintenanceType as MaintenanceType
      );

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error getting templates for device:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get templates for device'
      });
    }
  }

  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateMaintenanceChecklistTemplateRequest = req.body;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const template = await this.templateService.updateTemplate(
        id as UUID, 
        request, 
        updatedBy
      );

      res.json({
        success: true,
        data: template,
        message: 'Maintenance checklist template updated successfully'
      });
    } catch (error) {
      console.error('Error updating maintenance checklist template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update maintenance checklist template'
      });
    }
  }

  async createNewVersion(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const template = await this.templateService.createNewVersion(id as UUID, createdBy);

      res.status(201).json({
        success: true,
        data: template,
        message: 'New template version created successfully'
      });
    } catch (error) {
      console.error('Error creating new template version:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create new template version'
      });
    }
  }

  async searchTemplates(req: Request, res: Response): Promise<void> {
    try {
      const criteria: MaintenanceChecklistTemplateSearchCriteria = {
        deviceTypeId: req.query.deviceTypeId as UUID,
        maintenanceType: req.query.maintenanceType as MaintenanceType,
        isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
        name: req.query.name as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.templateService.searchTemplates(criteria);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error searching maintenance checklist templates:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search maintenance checklist templates'
      });
    }
  }

  async activateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const template = await this.templateService.activateTemplate(id as UUID, updatedBy);

      res.json({
        success: true,
        data: template,
        message: 'Template activated successfully'
      });
    } catch (error) {
      console.error('Error activating template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate template'
      });
    }
  }

  async deactivateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const template = await this.templateService.deactivateTemplate(id as UUID, updatedBy);

      res.json({
        success: true,
        data: template,
        message: 'Template deactivated successfully'
      });
    } catch (error) {
      console.error('Error deactivating template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate template'
      });
    }
  }

  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.templateService.deleteTemplate(id as UUID);

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template'
      });
    }
  }

  async getTemplateUsageStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const stats = await this.templateService.getTemplateUsageStats(id as UUID);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting template usage stats:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get template usage stats'
      });
    }
  }

  async getTemplateVersions(req: Request, res: Response): Promise<void> {
    try {
      const { deviceTypeId, maintenanceType } = req.params;
      
      const versions = await this.templateService.getTemplateVersions(
        deviceTypeId as UUID,
        maintenanceType as MaintenanceType
      );

      res.json({
        success: true,
        data: versions
      });
    } catch (error) {
      console.error('Error getting template versions:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get template versions'
      });
    }
  }

  async compareTemplateVersions(req: Request, res: Response): Promise<void> {
    try {
      const { oldTemplateId, newTemplateId } = req.params;
      
      const comparison = await this.templateService.compareTemplateVersions(
        oldTemplateId as UUID,
        newTemplateId as UUID
      );

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error comparing template versions:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare template versions'
      });
    }
  }

  async duplicateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newName } = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      if (!newName) {
        res.status(400).json({
          success: false,
          error: 'New template name is required'
        });
        return;
      }

      const template = await this.templateService.duplicateTemplate(
        id as UUID,
        newName,
        createdBy
      );

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template duplicated successfully'
      });
    } catch (error) {
      console.error('Error duplicating template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to duplicate template'
      });
    }
  }

  async validateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await this.templateService.getTemplate(id as UUID);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found'
        });
        return;
      }

      const validation = await this.templateService.validateTemplate(template);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('Error validating template:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate template'
      });
    }
  }
}