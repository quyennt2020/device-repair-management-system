import { Request, Response } from 'express';
import { QuotationService } from '../services/quotation.service';
import { 
  CreateQuotationRequest,
  UpdateQuotationRequest,
  CreateQuotationRevisionRequest,
  CreateQuotationComparisonRequest,
  SubmitQuotationApprovalRequest,
  SubmitCustomerResponseRequest,
  ExtendQuotationValidityRequest,
  QuotationSearchCriteria
} from '../types/quotation';
import { UUID } from '../../../../shared/types/src/common';
import { ApiResponse } from '../types';

export class QuotationController {
  constructor(private quotationService: QuotationService) {}

  async createQuotation(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateQuotationRequest = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const quotation = await this.quotationService.createQuotation(request, createdBy);

      const response: ApiResponse = {
        success: true,
        data: quotation
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating quotation:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async updateQuotation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateQuotationRequest = req.body;
      const updatedBy = req.user?.id as UUID;

      if (!updatedBy) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const quotation = await this.quotationService.updateQuotation(id as UUID, request, updatedBy);

      const response: ApiResponse = {
        success: true,
        data: quotation
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating quotation:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode 
        }
      });
    }
  }

  async getQuotationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const quotation = await this.quotationService.getQuotationById(id as UUID);

      if (!quotation) {
        res.status(404).json({
          success: false,
          error: { message: 'Quotation not found', statusCode: 404 }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: quotation
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting quotation:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async getQuotationByNumber(req: Request, res: Response): Promise<void> {
    try {
      const { quotationNumber } = req.params;
      const quotation = await this.quotationService.getQuotationByNumber(quotationNumber);

      if (!quotation) {
        res.status(404).json({
          success: false,
          error: { message: 'Quotation not found', statusCode: 404 }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: quotation
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting quotation by number:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async searchQuotations(req: Request, res: Response): Promise<void> {
    try {
      const criteria: QuotationSearchCriteria = {
        caseId: req.query.caseId as UUID,
        quotationNumber: req.query.quotationNumber as string,
        status: req.query.status as any,
        approvalStatus: req.query.approvalStatus as any,
        customerResponseStatus: req.query.customerResponseStatus as any,
        createdBy: req.query.createdBy as UUID,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
        expiryAfter: req.query.expiryAfter ? new Date(req.query.expiryAfter as string) : undefined,
        expiryBefore: req.query.expiryBefore ? new Date(req.query.expiryBefore as string) : undefined,
        minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
        maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.quotationService.searchQuotations(criteria);

      const response: ApiResponse = {
        success: true,
        data: result.quotations,
        meta: {
          total: result.total,
          limit: result.limit,
          page: Math.floor(result.offset / result.limit) + 1,
          totalPages: Math.ceil(result.total / result.limit)
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error searching quotations:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async createRevision(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateQuotationRevisionRequest = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const revision = await this.quotationService.createRevision(request, createdBy);

      const response: ApiResponse = {
        success: true,
        data: revision
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating quotation revision:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode 
        }
      });
    }
  }

  async getQuotationRevisions(req: Request, res: Response): Promise<void> {
    try {
      const { quotationId } = req.params;
      const revisions = await this.quotationService.getQuotationRevisions(quotationId as UUID);

      const response: ApiResponse = {
        success: true,
        data: revisions
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting quotation revisions:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async createComparison(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateQuotationComparisonRequest = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const comparison = await this.quotationService.createComparison(request, createdBy);

      const response: ApiResponse = {
        success: true,
        data: comparison
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating quotation comparison:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode 
        }
      });
    }
  }

  async getComparison(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const comparison = await this.quotationService.getComparison(id as UUID);

      if (!comparison) {
        res.status(404).json({
          success: false,
          error: { message: 'Comparison not found', statusCode: 404 }
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: comparison
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting comparison:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async getComparisonsByCase(req: Request, res: Response): Promise<void> {
    try {
      const { caseId } = req.params;
      const comparisons = await this.quotationService.getComparisonsByCase(caseId as UUID);

      const response: ApiResponse = {
        success: true,
        data: comparisons
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting comparisons by case:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async submitApproval(req: Request, res: Response): Promise<void> {
    try {
      const request: SubmitQuotationApprovalRequest = req.body;
      const approverUserId = req.user?.id as UUID;

      if (!approverUserId) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const approval = await this.quotationService.submitApproval(request, approverUserId);

      const response: ApiResponse = {
        success: true,
        data: approval
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error submitting quotation approval:', error);
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode 
        }
      });
    }
  }

  async submitCustomerResponse(req: Request, res: Response): Promise<void> {
    try {
      const request: SubmitCustomerResponseRequest = req.body;
      const createdBy = req.user?.id as UUID;

      if (!createdBy) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const response = await this.quotationService.submitCustomerResponse(request, createdBy);

      const apiResponse: ApiResponse = {
        success: true,
        data: response
      };

      res.status(201).json(apiResponse);
    } catch (error) {
      console.error('Error submitting customer response:', error);
      const statusCode = error instanceof Error && 
        (error.message.includes('not found') ? 404 : 
         error.message.includes('expired') || error.message.includes('approved') ? 400 : 500);
      res.status(statusCode).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode 
        }
      });
    }
  }

  async extendValidity(req: Request, res: Response): Promise<void> {
    try {
      const request: ExtendQuotationValidityRequest = req.body;
      const approvedBy = req.user?.id as UUID;

      if (!approvedBy) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated', statusCode: 401 }
        });
        return;
      }

      const validityTracking = await this.quotationService.extendValidity(request, approvedBy);

      const response: ApiResponse = {
        success: true,
        data: validityTracking
      };

      res.json(response);
    } catch (error) {
      console.error('Error extending quotation validity:', error);
      const statusCode = error instanceof Error && 
        (error.message.includes('not found') ? 404 : 
         error.message.includes('must be') ? 400 : 500);
      res.status(statusCode).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode 
        }
      });
    }
  }

  async getExpiringQuotations(req: Request, res: Response): Promise<void> {
    try {
      const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string) : 7;
      const quotations = await this.quotationService.getExpiringQuotations(daysAhead);

      const response: ApiResponse = {
        success: true,
        data: quotations
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting expiring quotations:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async getQuotationAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.query.caseId as UUID;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const analytics = await this.quotationService.getQuotationAnalytics(caseId, dateFrom, dateTo);

      const response: ApiResponse = {
        success: true,
        data: analytics
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting quotation analytics:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }

  async processExpiringQuotations(req: Request, res: Response): Promise<void> {
    try {
      await this.quotationService.processExpiringQuotations();

      const response: ApiResponse = {
        success: true,
        data: { message: 'Expiring quotations processed successfully' }
      };

      res.json(response);
    } catch (error) {
      console.error('Error processing expiring quotations:', error);
      res.status(500).json({
        success: false,
        error: { 
          message: error instanceof Error ? error.message : 'Internal server error',
          statusCode: 500 
        }
      });
    }
  }
}