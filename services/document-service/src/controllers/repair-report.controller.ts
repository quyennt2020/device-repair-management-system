import { Request, Response } from 'express';
import { RepairReportService } from '../services/repair-report.service';
import { 
  CreateRepairReportRequest, 
  UpdateRepairReportRequest,
  RepairReportSearchCriteria,
  CustomerSatisfactionRequest
} from '../types/repair-report';
import { UUID } from '../../../../shared/types/src/common';

export class RepairReportController {
  constructor(private repairReportService: RepairReportService) {}

  async createRepairReport(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateRepairReportRequest = req.body;
      
      // Add validation for required fields
      if (!request.documentId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Document ID is required',
            statusCode: 400
          }
        });
        return;
      }

      const repairReport = await this.repairReportService.createRepairReport(request);
      
      res.status(201).json({
        success: true,
        data: repairReport
      });
    } catch (error) {
      console.error('Error creating repair report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to create repair report',
          statusCode: 500
        }
      });
    }
  }

  async getRepairReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Repair report ID is required',
            statusCode: 400
          }
        });
        return;
      }

      const repairReport = await this.repairReportService.getRepairReport(id as UUID);
      
      if (!repairReport) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Repair report not found',
            statusCode: 404
          }
        });
        return;
      }

      res.json({
        success: true,
        data: repairReport
      });
    } catch (error) {
      console.error('Error getting repair report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get repair report',
          statusCode: 500
        }
      });
    }
  }

  async getRepairReportByDocumentId(req: Request, res: Response): Promise<void> {
    try {
      const { documentId } = req.params;
      
      if (!documentId) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Document ID is required',
            statusCode: 400
          }
        });
        return;
      }

      const repairReport = await this.repairReportService.getRepairReportByDocumentId(documentId as UUID);
      
      if (!repairReport) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Repair report not found for this document',
            statusCode: 404
          }
        });
        return;
      }

      res.json({
        success: true,
        data: repairReport
      });
    } catch (error) {
      console.error('Error getting repair report by document ID:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get repair report',
          statusCode: 500
        }
      });
    }
  }

  async updateRepairReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateRepairReportRequest = req.body;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Repair report ID is required',
            statusCode: 400
          }
        });
        return;
      }

      const repairReport = await this.repairReportService.updateRepairReport(id as UUID, request);
      
      res.json({
        success: true,
        data: repairReport
      });
    } catch (error) {
      console.error('Error updating repair report:', error);
      
      if (error instanceof Error && error.message === 'Repair report not found') {
        res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update repair report',
          statusCode: 500
        }
      });
    }
  }

  async searchRepairReports(req: Request, res: Response): Promise<void> {
    try {
      const criteria: RepairReportSearchCriteria = {
        caseId: req.query.caseId as UUID,
        technicianId: req.query.technicianId as UUID,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        customerSatisfactionRating: req.query.customerSatisfactionRating ? 
          parseInt(req.query.customerSatisfactionRating as string) : undefined,
        overallTestResult: req.query.overallTestResult as 'pass' | 'fail' | 'partial',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const result = await this.repairReportService.searchRepairReports(criteria);
      
      res.json({
        success: true,
        data: result.repairReports,
        meta: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0,
          totalPages: Math.ceil(result.total / (criteria.limit || 50))
        }
      });
    } catch (error) {
      console.error('Error searching repair reports:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to search repair reports',
          statusCode: 500
        }
      });
    }
  }

  async deleteRepairReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Repair report ID is required',
            statusCode: 400
          }
        });
        return;
      }

      await this.repairReportService.deleteRepairReport(id as UUID);
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting repair report:', error);
      
      if (error instanceof Error && error.message === 'Repair report not found') {
        res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete repair report',
          statusCode: 500
        }
      });
    }
  }

  async performQualityCheck(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Repair report ID is required',
            statusCode: 400
          }
        });
        return;
      }

      const qualityCheckResult = await this.repairReportService.performQualityCheck(id as UUID);
      
      res.json({
        success: true,
        data: qualityCheckResult
      });
    } catch (error) {
      console.error('Error performing quality check:', error);
      
      if (error instanceof Error && error.message === 'Repair report not found') {
        res.status(404).json({
          success: false,
          error: {
            message: error.message,
            statusCode: 404
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to perform quality check',
          statusCode: 500
        }
      });
    }
  }

  async recordCustomerSatisfaction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const satisfactionData = req.body;
      
      if (!id) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Repair report ID is required',
            statusCode: 400
          }
        });
        return;
      }

      const request: CustomerSatisfactionRequest = {
        repairReportId: id as UUID,
        rating: satisfactionData.rating,
        comments: satisfactionData.comments,
        wouldRecommend: satisfactionData.wouldRecommend,
        serviceAspects: satisfactionData.serviceAspects || []
      };

      // Validate rating
      if (!request.rating || request.rating < 1 || request.rating > 5) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Rating must be between 1 and 5',
            statusCode: 400
          }
        });
        return;
      }

      await this.repairReportService.recordCustomerSatisfaction(request);
      
      res.json({
        success: true,
        data: {
          message: 'Customer satisfaction recorded successfully'
        }
      });
    } catch (error) {
      console.error('Error recording customer satisfaction:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to record customer satisfaction',
          statusCode: 500
        }
      });
    }
  }

  async getCustomerFeedbackSummary(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const summary = await this.repairReportService.getCustomerFeedbackSummary(dateFrom, dateTo);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting customer feedback summary:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get customer feedback summary',
          statusCode: 500
        }
      });
    }
  }

  async getRepairReportAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const analytics = await this.repairReportService.getRepairReportAnalytics(dateFrom, dateTo);
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting repair report analytics:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get repair report analytics',
          statusCode: 500
        }
      });
    }
  }
}