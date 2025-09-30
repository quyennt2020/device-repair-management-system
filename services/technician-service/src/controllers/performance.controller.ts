import { Request, Response, NextFunction } from 'express';
import { PerformanceService } from '../services/performance.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { pool } from '../index';

export class PerformanceController {
  private performanceService: PerformanceService;

  constructor() {
    this.performanceService = new PerformanceService(pool);
  }

  createPerformanceRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const performance = await this.performanceService.createPerformanceRecord(req.body);
      res.status(201).json({
        success: true,
        data: performance
      });
    } catch (error) {
      next(error);
    }
  };

  getPerformanceRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const performance = await this.performanceService.getPerformanceRecord(id);
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      next(error);
    }
  };

  updatePerformanceRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const performance = await this.performanceService.updatePerformanceRecord(id, req.body);
      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      next(error);
    }
  };

  getTechnicianPerformanceHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { technicianId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const history = await this.performanceService.getTechnicianPerformanceHistory(technicianId, limit);
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      next(error);
    }
  };

  getPerformanceMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { technicianId } = req.params;
      const periodStart = new Date(req.query.periodStart as string);
      const periodEnd = new Date(req.query.periodEnd as string);
      
      const metrics = await this.performanceService.getPerformanceMetrics(technicianId, periodStart, periodEnd);
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  };

  getTopPerformers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const metric = req.query.metric as string || 'efficiency_score';
      
      const topPerformers = await this.performanceService.getTopPerformers(limit, metric);
      res.json({
        success: true,
        data: topPerformers
      });
    } catch (error) {
      next(error);
    }
  };

  generatePerformanceReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { technicianId } = req.params;
      const periodStart = new Date(req.query.periodStart as string);
      const periodEnd = new Date(req.query.periodEnd as string);
      
      const report = await this.performanceService.generatePerformanceReport(technicianId, periodStart, periodEnd);
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  };

  comparePerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { technicianIds } = req.body;
      const periodStart = new Date(req.body.periodStart);
      const periodEnd = new Date(req.body.periodEnd);
      
      if (!Array.isArray(technicianIds) || technicianIds.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'At least 2 technician IDs are required for comparison'
        });
      }
      
      const comparison = await this.performanceService.comparePerformance(technicianIds, periodStart, periodEnd);
      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      next(error);
    }
  };

  deletePerformanceRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.performanceService.deletePerformanceRecord(id);
      res.json({
        success: true,
        message: 'Performance record deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}