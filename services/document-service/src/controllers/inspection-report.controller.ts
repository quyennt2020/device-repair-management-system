import { Request, Response } from 'express';
import { InspectionReportService, CreateInspectionReportRequest, UpdateInspectionReportRequest } from '../services/inspection-report.service';
import { UUID } from '../types';

export class InspectionReportController {
  private inspectionReportService: InspectionReportService;

  constructor() {
    this.inspectionReportService = new InspectionReportService();
  }

  // Core CRUD Operations
  createInspectionReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: CreateInspectionReportRequest = req.body;
      const createdBy = req.user?.id || 'system';

      const inspectionReport = await this.inspectionReportService.createInspectionReport(request, createdBy);

      res.status(201).json({
        success: true,
        data: inspectionReport,
        message: 'Inspection report created successfully'
      });
    } catch (error) {
      console.error('Error creating inspection report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to create inspection report',
          statusCode: 500
        }
      });
    }
  };

  getInspectionReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      
      const inspectionReport = await this.inspectionReportService.getInspectionReport(id as UUID);
      
      if (!inspectionReport) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Inspection report not found',
            statusCode: 404
          }
        });
        return;
      }

      res.json({
        success: true,
        data: inspectionReport
      });
    } catch (error) {
      console.error('Error getting inspection report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get inspection report',
          statusCode: 500
        }
      });
    }
  };

  getInspectionReportByDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      
      const inspectionReport = await this.inspectionReportService.getInspectionReportByDocument(documentId as UUID);
      
      if (!inspectionReport) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Inspection report not found for this document',
            statusCode: 404
          }
        });
        return;
      }

      res.json({
        success: true,
        data: inspectionReport
      });
    } catch (error) {
      console.error('Error getting inspection report by document:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get inspection report',
          statusCode: 500
        }
      });
    }
  };

  updateInspectionReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const request: UpdateInspectionReportRequest = req.body;
      const updatedBy = req.user?.id || 'system';

      const inspectionReport = await this.inspectionReportService.updateInspectionReport(
        id as UUID, 
        request, 
        updatedBy
      );

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Inspection report updated successfully'
      });
    } catch (error) {
      console.error('Error updating inspection report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update inspection report',
          statusCode: 500
        }
      });
    }
  };

  deleteInspectionReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await this.inspectionReportService.deleteInspectionReport(id as UUID);

      res.json({
        success: true,
        message: 'Inspection report deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting inspection report:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete inspection report',
          statusCode: 500
        }
      });
    }
  };

  // Findings Management
  addFinding = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;
      const finding = req.body;

      const inspectionReport = await this.inspectionReportService.addFinding(reportId as UUID, finding);

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Finding added successfully'
      });
    } catch (error) {
      console.error('Error adding finding:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to add finding',
          statusCode: 500
        }
      });
    }
  };

  updateFinding = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId, findingId } = req.params;
      const updates = req.body;

      const inspectionReport = await this.inspectionReportService.updateFinding(
        reportId as UUID, 
        findingId, 
        updates
      );

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Finding updated successfully'
      });
    } catch (error) {
      console.error('Error updating finding:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update finding',
          statusCode: 500
        }
      });
    }
  };

  removeFinding = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId, findingId } = req.params;

      const inspectionReport = await this.inspectionReportService.removeFinding(
        reportId as UUID, 
        findingId
      );

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Finding removed successfully'
      });
    } catch (error) {
      console.error('Error removing finding:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to remove finding',
          statusCode: 500
        }
      });
    }
  };

  // Parts Recommendation System
  generatePartsRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { findings } = req.body;

      const recommendations = await this.inspectionReportService.generatePartsRecommendations(findings);

      res.json({
        success: true,
        data: recommendations,
        message: 'Parts recommendations generated successfully'
      });
    } catch (error) {
      console.error('Error generating parts recommendations:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to generate parts recommendations',
          statusCode: 500
        }
      });
    }
  };

  addRecommendedPart = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;
      const part = req.body;

      const inspectionReport = await this.inspectionReportService.addRecommendedPart(reportId as UUID, part);

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Recommended part added successfully'
      });
    } catch (error) {
      console.error('Error adding recommended part:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to add recommended part',
          statusCode: 500
        }
      });
    }
  };

  updateRecommendedPart = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId, partId } = req.params;
      const updates = req.body;

      const inspectionReport = await this.inspectionReportService.updateRecommendedPart(
        reportId as UUID, 
        partId, 
        updates
      );

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Recommended part updated successfully'
      });
    } catch (error) {
      console.error('Error updating recommended part:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update recommended part',
          statusCode: 500
        }
      });
    }
  };

  removeRecommendedPart = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId, partId } = req.params;

      const inspectionReport = await this.inspectionReportService.removeRecommendedPart(
        reportId as UUID, 
        partId
      );

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Recommended part removed successfully'
      });
    } catch (error) {
      console.error('Error removing recommended part:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to remove recommended part',
          statusCode: 500
        }
      });
    }
  };

  // Cost Estimation
  calculateEstimatedCost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { recommendedParts, estimatedHours } = req.body;

      const estimatedCost = this.inspectionReportService.calculateEstimatedCost(recommendedParts, estimatedHours);

      res.json({
        success: true,
        data: {
          estimatedCost,
          breakdown: {
            partsCost: recommendedParts.reduce((total: number, part: any) => 
              total + (part.estimatedCost || 0) * part.quantity, 0
            ),
            laborCost: estimatedHours * 200000,
            totalHours: estimatedHours
          }
        }
      });
    } catch (error) {
      console.error('Error calculating estimated cost:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to calculate estimated cost',
          statusCode: 500
        }
      });
    }
  };

  updatePartCosts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;

      const inspectionReport = await this.inspectionReportService.updatePartCosts(reportId as UUID);

      res.json({
        success: true,
        data: inspectionReport,
        message: 'Part costs updated successfully'
      });
    } catch (error) {
      console.error('Error updating part costs:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update part costs',
          statusCode: 500
        }
      });
    }
  };

  // Severity Assessment
  assessSeverity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { findings, recommendedParts } = req.body;

      const assessment = await this.inspectionReportService.assessSeverity(findings, recommendedParts);

      res.json({
        success: true,
        data: assessment
      });
    } catch (error) {
      console.error('Error assessing severity:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to assess severity',
          statusCode: 500
        }
      });
    }
  };

  // Image Management
  uploadInspectionImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId } = req.params;
      const { caption, imageType } = req.body;
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            message: 'No image file provided',
            statusCode: 400
          }
        });
        return;
      }

      const file = {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      };

      const documentImage = await this.inspectionReportService.uploadInspectionImage(
        reportId as UUID, 
        file, 
        caption,
        imageType
      );

      res.json({
        success: true,
        data: documentImage,
        message: 'Image uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading inspection image:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to upload image',
          statusCode: 500
        }
      });
    }
  };

  removeInspectionImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId, imageId } = req.params;

      await this.inspectionReportService.removeInspectionImage(reportId as UUID, imageId);

      res.json({
        success: true,
        message: 'Image removed successfully'
      });
    } catch (error) {
      console.error('Error removing inspection image:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to remove image',
          statusCode: 500
        }
      });
    }
  };

  updateImageCaption = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId, imageId } = req.params;
      const { caption } = req.body;

      await this.inspectionReportService.updateImageCaption(reportId as UUID, imageId, caption);

      res.json({
        success: true,
        message: 'Image caption updated successfully'
      });
    } catch (error) {
      console.error('Error updating image caption:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update image caption',
          statusCode: 500
        }
      });
    }
  };

  // Comparison and Analysis
  compareInspectionReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reportId1, reportId2 } = req.params;

      const comparison = await this.inspectionReportService.compareInspectionReports(
        reportId1 as UUID, 
        reportId2 as UUID
      );

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error comparing inspection reports:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to compare inspection reports',
          statusCode: 500
        }
      });
    }
  };

  // Search and Analytics
  searchInspectionReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        caseId,
        severityLevel,
        component,
        minHours,
        maxHours,
        dateFrom,
        dateTo,
        page = 1,
        limit = 10
      } = req.query;

      const criteria = {
        caseId: caseId as UUID,
        severityLevel: severityLevel as string,
        component: component as string,
        minHours: minHours ? parseFloat(minHours as string) : undefined,
        maxHours: maxHours ? parseFloat(maxHours as string) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined
      };

      const pagination = {
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string)
      };

      // This would require adding the search method to the service
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          reports: [],
          total: 0,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: 0
        },
        message: 'Search functionality to be implemented'
      });
    } catch (error) {
      console.error('Error searching inspection reports:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to search inspection reports',
          statusCode: 500
        }
      });
    }
  };

  getInspectionAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      // This would require adding analytics methods to the service
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          severityDistribution: {},
          averageEstimatedHours: 0,
          mostCommonFindings: [],
          mostRecommendedParts: []
        },
        message: 'Analytics functionality to be implemented'
      });
    } catch (error) {
      console.error('Error getting inspection analytics:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to get inspection analytics',
          statusCode: 500
        }
      });
    }
  };
}