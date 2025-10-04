import { Request, Response } from 'express';
import { UUID } from '../../../../shared/types/src/common';
import { MaintenanceReportService } from '../services/maintenance-report.service';
import {
  CreateMaintenanceReportRequest,
  UpdateMaintenanceReportRequest,
  MaintenanceReportSearchCriteria,
  UpdateMaintenanceChecklistItemRequest,
  BulkChecklistUpdateRequest,
  MaintenanceScheduleRequest
} from '../types/maintenance-report';

export class MaintenanceReportController {
  constructor(private maintenanceReportService: MaintenanceReportService) {}

  async createMaintenanceReport(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateMaintenanceReportRequest = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const report = await this.maintenanceReportService.createMaintenanceReport(request, createdBy);
      
      res.status(201).json({
        success: true,
        data: report,
        message: 'Maintenance report created successfully'
      });
    } catch (error) {
      console.error('Error creating maintenance report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create maintenance report'
      });
    }
  }

  async getMaintenanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await this.maintenanceReportService.getMaintenanceReport(id as UUID);

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Maintenance report not found'
        });
        return;
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error getting maintenance report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get maintenance report'
      });
    }
  }

  async getMaintenanceReportByDocumentId(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      const report = await this.maintenanceReportService.getMaintenanceReportByDocumentId(documentId as UUID);

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Maintenance report not found for this document'
        });
        return;
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Error getting maintenance report by document ID:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get maintenance report'
      });
    }
  }

  async updateMaintenanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateMaintenanceReportRequest = req.body;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const report = await this.maintenanceReportService.updateMaintenanceReport(
        id as UUID, 
        request, 
        updatedBy
      );

      res.json({
        success: true,
        data: report,
        message: 'Maintenance report updated successfully'
      });
    } catch (error) {
      console.error('Error updating maintenance report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update maintenance report'
      });
    }
  }

  async updateChecklistItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateMaintenanceChecklistItemRequest = req.body;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const report = await this.maintenanceReportService.updateChecklistItem(
        id as UUID,
        request,
        updatedBy
      );

      res.json({
        success: true,
        data: report,
        message: 'Checklist item updated successfully'
      });
    } catch (error) {
      console.error('Error updating checklist item:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update checklist item'
      });
    }
  }

  async bulkUpdateChecklistItems(req: Request, res: Response): Promise<void> {
    try {
      const request: BulkChecklistUpdateRequest = req.body;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await this.maintenanceReportService.bulkUpdateChecklistItems(request, updatedBy);

      res.json({
        success: true,
        data: result,
        message: `Bulk update completed: ${result.successCount} successful, ${result.failureCount} failed`
      });
    } catch (error) {
      console.error('Error bulk updating checklist items:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk update checklist items'
      });
    }
  }

  async searchMaintenanceReports(req: Request, res: Response): Promise<void> {
    try {
      const criteria: MaintenanceReportSearchCriteria = {
        caseId: req.query.caseId as UUID,
        deviceId: req.query.deviceId as UUID,
        technicianId: req.query.technicianId as UUID,
        maintenanceType: req.query.maintenanceType as any,
        overallCondition: req.query.overallCondition as any,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        checklistTemplateId: req.query.checklistTemplateId as UUID,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.maintenanceReportService.searchMaintenanceReports(criteria);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error searching maintenance reports:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search maintenance reports'
      });
    }
  }

  async validateMaintenanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validation = await this.maintenanceReportService.validateMaintenanceReport(id as UUID);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      console.error('Error validating maintenance report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate maintenance report'
      });
    }
  }

  async calculateNextMaintenanceDate(req: Request, res: Response): Promise<void> {
    try {
      const request: MaintenanceScheduleRequest = req.body;
      const schedule = await this.maintenanceReportService.calculateNextMaintenanceDate(request);

      res.json({
        success: true,
        data: schedule,
        message: 'Next maintenance date calculated successfully'
      });
    } catch (error) {
      console.error('Error calculating next maintenance date:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate next maintenance date'
      });
    }
  }

  async getMaintenanceAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const analytics = await this.maintenanceReportService.getMaintenanceAnalytics(dateFrom, dateTo);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting maintenance analytics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get maintenance analytics'
      });
    }
  }

  async deleteMaintenanceReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.maintenanceReportService.deleteMaintenanceReport(id as UUID);

      res.json({
        success: true,
        message: 'Maintenance report deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting maintenance report:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete maintenance report'
      });
    }
  }
}