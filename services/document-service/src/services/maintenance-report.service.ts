import { UUID } from '../../../../shared/types/src/common';
import {
  MaintenanceReport,
  MaintenanceChecklistTemplate,
  MaintenanceType,
  OverallCondition,
  ChecklistItemStatus,
  RecommendationPriority
} from '../../../../shared/types/src/document';
import {
  CreateMaintenanceReportRequest,
  UpdateMaintenanceReportRequest,
  MaintenanceReportSearchCriteria,
  MaintenanceReportResponse,
  MaintenanceReportSearchResult,
  MaintenanceReportValidationResult,
  ChecklistExecutionResult,
  MaintenanceScheduleRequest,
  MaintenanceScheduleResponse,
  UpdateMaintenanceChecklistItemRequest,
  BulkChecklistUpdateRequest,
  BulkChecklistUpdateResult,
  MaintenanceAnalytics
} from '../types/maintenance-report';
import { MaintenanceReportRepository } from '../repositories/maintenance-report.repository';
import { MaintenanceChecklistTemplateRepository } from '../repositories/maintenance-checklist-template.repository';

export class MaintenanceReportService {
  constructor(
    private maintenanceReportRepository: MaintenanceReportRepository,
    private templateRepository: MaintenanceChecklistTemplateRepository
  ) {}

  async createMaintenanceReport(
    request: CreateMaintenanceReportRequest, 
    createdBy: UUID
  ): Promise<MaintenanceReport> {
    // Validate template exists and is active
    const template = await this.templateRepository.findById(request.checklistTemplateId);
    if (!template) {
      throw new Error('Maintenance checklist template not found');
    }

    if (!template.isActive) {
      throw new Error('Cannot use inactive maintenance checklist template');
    }

    // Create the maintenance report
    const report = await this.maintenanceReportRepository.create(request, createdBy);

    return report;
  }

  async getMaintenanceReport(id: UUID): Promise<MaintenanceReport | null> {
    return await this.maintenanceReportRepository.findById(id);
  }

  async getMaintenanceReportByDocumentId(documentId: UUID): Promise<MaintenanceReport | null> {
    return await this.maintenanceReportRepository.findByDocumentId(documentId);
  }

  async updateMaintenanceReport(
    id: UUID, 
    request: UpdateMaintenanceReportRequest, 
    updatedBy: UUID
  ): Promise<MaintenanceReport> {
    const existingReport = await this.maintenanceReportRepository.findById(id);
    if (!existingReport) {
      throw new Error('Maintenance report not found');
    }

    // Auto-calculate overall condition if checklist items are updated
    if (request.checklistItems && !request.overallCondition) {
      const executionResult = await this.calculateChecklistExecutionResult(id, request.checklistItems);
      request.overallCondition = this.determineOverallCondition(executionResult);
    }

    // Auto-calculate next maintenance date if not provided
    if (!request.nextMaintenanceDate && request.overallCondition) {
      const scheduleRequest: MaintenanceScheduleRequest = {
        deviceId: existingReport.documentId, // Assuming document is linked to device
        maintenanceType: existingReport.maintenanceType,
        condition: request.overallCondition,
        frequencyMonths: request.maintenanceFrequencyMonths
      };
      
      const schedule = await this.calculateNextMaintenanceDate(scheduleRequest);
      request.nextMaintenanceDate = schedule.nextMaintenanceDate;
      request.maintenanceFrequencyMonths = schedule.frequencyMonths;
    }

    return await this.maintenanceReportRepository.update(id, request, updatedBy);
  }

  async updateChecklistItem(
    reportId: UUID,
    itemUpdate: UpdateMaintenanceChecklistItemRequest,
    updatedBy: UUID
  ): Promise<MaintenanceReport> {
    // Set completion timestamp if status is being set to pass or fail
    if (itemUpdate.status && ['pass', 'fail'].includes(itemUpdate.status) && !itemUpdate.completedAt) {
      itemUpdate.completedAt = new Date();
      itemUpdate.completedBy = updatedBy;
    }

    const updateRequest: UpdateMaintenanceReportRequest = {
      checklistItems: [itemUpdate]
    };

    return await this.updateMaintenanceReport(reportId, updateRequest, updatedBy);
  }

  async bulkUpdateChecklistItems(
    request: BulkChecklistUpdateRequest,
    updatedBy: UUID
  ): Promise<BulkChecklistUpdateResult> {
    const errors: string[] = [];
    const updatedItems: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const itemUpdate of request.updates) {
      try {
        await this.updateChecklistItem(request.reportId, itemUpdate, updatedBy);
        updatedItems.push(itemUpdate);
        successCount++;
      } catch (error) {
        errors.push(`Failed to update item ${itemUpdate.itemId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      errors,
      updatedItems
    };
  }

  async searchMaintenanceReports(criteria: MaintenanceReportSearchCriteria): Promise<MaintenanceReportSearchResult> {
    const { reports, total } = await this.maintenanceReportRepository.search(criteria);
    
    return {
      maintenanceReports: reports,
      total,
      limit: criteria.limit || 50,
      offset: criteria.offset || 0
    };
  }

  async validateMaintenanceReport(id: UUID): Promise<MaintenanceReportValidationResult> {
    const report = await this.maintenanceReportRepository.findById(id);
    if (!report) {
      return {
        isValid: false,
        errors: ['Maintenance report not found'],
        warnings: [],
        completionStatus: 'incomplete'
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!report.overallCondition) {
      errors.push('Overall condition is required');
    }

    if (!report.technicianNotes || report.technicianNotes.trim().length === 0) {
      warnings.push('Technician notes are recommended');
    }

    // Check checklist completion
    const totalItems = report.checklistItems.length;
    const completedItems = report.checklistItems.filter(item => 
      item.status === 'pass' || item.status === 'fail'
    ).length;
    const requiredItems = report.checklistItems.filter(item => item.required).length;
    const completedRequiredItems = report.checklistItems.filter(item => 
      item.required && (item.status === 'pass' || item.status === 'fail')
    ).length;

    if (completedRequiredItems < requiredItems) {
      errors.push(`${requiredItems - completedRequiredItems} required checklist items are not completed`);
    }

    if (completedItems < totalItems) {
      warnings.push(`${totalItems - completedItems} checklist items are still pending`);
    }

    // Check for critical failures
    const criticalFailures = report.checklistItems.filter(item => 
      item.status === 'fail' && item.required
    );

    if (criticalFailures.length > 0) {
      errors.push(`${criticalFailures.length} critical checklist items have failed`);
    }

    // Check recommendations for critical issues
    const immediateRecommendations = report.recommendations.filter(rec => 
      rec.priority === 'immediate'
    );

    if (immediateRecommendations.length > 0 && !report.nextMaintenanceDate) {
      warnings.push('Immediate recommendations exist but no follow-up maintenance is scheduled');
    }

    // Determine completion status
    let completionStatus: 'incomplete' | 'complete' | 'requires_attention';
    
    if (errors.length > 0) {
      completionStatus = 'incomplete';
    } else if (criticalFailures.length > 0 || immediateRecommendations.length > 0) {
      completionStatus = 'requires_attention';
    } else {
      completionStatus = 'complete';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionStatus
    };
  }

  async calculateNextMaintenanceDate(request: MaintenanceScheduleRequest): Promise<MaintenanceScheduleResponse> {
    const baseDate = request.baseDate || new Date();
    let frequencyMonths = request.frequencyMonths;
    let priority: RecommendationPriority = 'medium';

    // Adjust frequency based on maintenance type
    if (!frequencyMonths) {
      switch (request.maintenanceType) {
        case 'preventive':
          frequencyMonths = 6; // Default 6 months for preventive
          break;
        case 'corrective':
          frequencyMonths = 3; // More frequent for corrective
          break;
        case 'emergency':
          frequencyMonths = 1; // Very frequent for emergency follow-up
          break;
      }
    }

    // Adjust frequency based on condition
    if (request.condition) {
      switch (request.condition) {
        case 'critical':
          frequencyMonths = Math.max(1, Math.floor(frequencyMonths / 3));
          priority = 'immediate';
          break;
        case 'poor':
          frequencyMonths = Math.max(1, Math.floor(frequencyMonths / 2));
          priority = 'high';
          break;
        case 'fair':
          frequencyMonths = Math.floor(frequencyMonths * 0.8);
          priority = 'medium';
          break;
        case 'good':
          // Keep default frequency
          priority = 'medium';
          break;
        case 'excellent':
          frequencyMonths = Math.floor(frequencyMonths * 1.2);
          priority = 'low';
          break;
      }
    }

    // Calculate next maintenance date
    const nextMaintenanceDate = new Date(baseDate);
    nextMaintenanceDate.setMonth(nextMaintenanceDate.getMonth() + frequencyMonths);

    // Get template for estimated hours and requirements
    const templates = await this.templateRepository.findByDeviceTypeAndMaintenanceType(
      request.deviceId, // Assuming deviceId maps to device type
      request.maintenanceType
    );

    const template = templates.length > 0 ? templates[0] : null;

    return {
      deviceId: request.deviceId,
      nextMaintenanceDate,
      maintenanceType: request.maintenanceType,
      frequencyMonths,
      priority,
      estimatedHours: template?.estimatedDurationHours || 4,
      requiredTools: template?.requiredTools || [],
      requiredParts: template?.requiredParts || []
    };
  }

  async getMaintenanceAnalytics(dateFrom?: Date, dateTo?: Date): Promise<MaintenanceAnalytics> {
    // This would typically involve complex queries across multiple tables
    // For now, returning a basic structure that would be populated by repository methods
    
    const searchCriteria: MaintenanceReportSearchCriteria = {
      dateFrom,
      dateTo,
      limit: 1000 // Get a large sample for analytics
    };

    const { reports } = await this.maintenanceReportRepository.search(searchCriteria);

    const totalReports = reports.length;
    const averageCompletionTime = reports.reduce((sum, report) => sum + report.actualHours, 0) / totalReports || 0;

    // Calculate condition distribution
    const conditionDistribution = reports.reduce((dist, report) => {
      if (report.overallCondition) {
        dist[report.overallCondition] = (dist[report.overallCondition] || 0) + 1;
      }
      return dist;
    }, {} as { [key in OverallCondition]: number });

    return {
      totalReports,
      averageCompletionTime,
      conditionDistribution,
      mostCommonRecommendations: [], // Would be calculated from recommendations
      materialUsageTrends: [], // Would be calculated from materials used
      checklistPerformance: [] // Would be calculated from checklist performance
    };
  }

  async deleteMaintenanceReport(id: UUID): Promise<void> {
    const report = await this.maintenanceReportRepository.findById(id);
    if (!report) {
      throw new Error('Maintenance report not found');
    }

    await this.maintenanceReportRepository.delete(id);
  }

  private async calculateChecklistExecutionResult(
    reportId: UUID, 
    itemUpdates: UpdateMaintenanceChecklistItemRequest[]
  ): Promise<ChecklistExecutionResult> {
    const report = await this.maintenanceReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Maintenance report not found');
    }

    // Apply updates to get current state
    const updatedItems = report.checklistItems.map(item => {
      const update = itemUpdates.find(u => u.itemId === item.itemId);
      if (update) {
        return { ...item, ...update };
      }
      return item;
    });

    const totalItems = updatedItems.length;
    const completedItems = updatedItems.filter(item => 
      item.status === 'pass' || item.status === 'fail'
    ).length;
    const passedItems = updatedItems.filter(item => item.status === 'pass').length;
    const failedItems = updatedItems.filter(item => item.status === 'fail').length;
    const pendingItems = updatedItems.filter(item => item.status === 'pending').length;

    const criticalFailures = updatedItems.filter(item => 
      item.status === 'fail' && item.required
    );

    // Generate recommendations based on failures
    const recommendations = criticalFailures.map(item => ({
      id: `rec-${item.itemId}`,
      priority: 'high' as RecommendationPriority,
      category: 'safety' as any,
      description: `Address failed checklist item: ${item.description}`,
      estimatedHours: 2,
      partIds: []
    }));

    return {
      totalItems,
      completedItems,
      passedItems,
      failedItems,
      pendingItems,
      criticalFailures,
      recommendations
    };
  }

  private determineOverallCondition(executionResult: ChecklistExecutionResult): OverallCondition {
    const { totalItems, passedItems, failedItems, criticalFailures } = executionResult;

    if (criticalFailures.length > 0) {
      return 'critical';
    }

    if (totalItems === 0) {
      return 'fair';
    }

    const passRate = passedItems / totalItems;
    const failRate = failedItems / totalItems;

    if (failRate > 0.3) {
      return 'poor';
    } else if (failRate > 0.1) {
      return 'fair';
    } else if (passRate > 0.9) {
      return 'excellent';
    } else if (passRate > 0.8) {
      return 'good';
    } else {
      return 'fair';
    }
  }
}