import { Request, Response, NextFunction } from 'express';
import { WorkloadService } from '../services/workload.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { pool } from '../index';

export class WorkloadController {
  private workloadService: WorkloadService;

  constructor() {
    this.workloadService = new WorkloadService(pool);
  }

  createWorkloadRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workload = await this.workloadService.createWorkloadRecord(req.body);
      res.status(201).json({
        success: true,
        data: workload
      });
    } catch (error) {
      next(error);
    }
  };

  updateWorkloadRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workload = await this.workloadService.updateWorkloadRecord(id, req.body);
      res.json({
        success: true,
        data: workload
      });
    } catch (error) {
      next(error);
    }
  };

  upsertWorkloadRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workload = await this.workloadService.upsertWorkloadRecord(req.body);
      res.json({
        success: true,
        data: workload
      });
    } catch (error) {
      next(error);
    }
  };

  getWorkloadRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const workload = await this.workloadService.getWorkloadRecord(id);
      res.json({
        success: true,
        data: workload
      });
    } catch (error) {
      next(error);
    }
  };

  getTechnicianWorkload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { technicianId } = req.params;
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      
      const workload = await this.workloadService.getTechnicianWorkload(technicianId, date);
      res.json({
        success: true,
        data: workload
      });
    } catch (error) {
      next(error);
    }
  };

  getWorkloadByDateRange = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const technicianId = req.query.technicianId as string;
      
      const workloads = await this.workloadService.getWorkloadByDateRange(startDate, endDate, technicianId);
      res.json({
        success: true,
        data: workloads
      });
    } catch (error) {
      next(error);
    }
  };

  getOverloadedTechnicians = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
      
      const overloadedTechnicians = await this.workloadService.getOverloadedTechnicians(date);
      res.json({
        success: true,
        data: overloadedTechnicians
      });
    } catch (error) {
      next(error);
    }
  };

  getWorkloadSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { technicianId } = req.params;
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      
      const summary = await this.workloadService.getWorkloadSummary(technicianId, days);
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  };

  generateCapacityPlanningReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const department = req.query.department as string;
      
      const report = await this.workloadService.generateCapacityPlanningReport(startDate, endDate, department);
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  };

  getWorkloadDistribution = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const department = req.query.department as string;
      
      const distribution = await this.workloadService.getWorkloadDistribution(date, department);
      res.json({
        success: true,
        data: distribution
      });
    } catch (error) {
      next(error);
    }
  };

  balanceWorkload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const department = req.query.department as string;
      
      const recommendations = await this.workloadService.balanceWorkload(date, department);
      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      next(error);
    }
  };

  deleteWorkloadRecord = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.workloadService.deleteWorkloadRecord(id);
      res.json({
        success: true,
        message: 'Workload record deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}