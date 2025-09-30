import { Request, Response, NextFunction } from 'express';
import { TechnicianService } from '../services/technician.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { pool } from '../index';

export class TechnicianController {
  private technicianService: TechnicianService;

  constructor() {
    this.technicianService = new TechnicianService(pool);
  }

  createTechnician = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const technician = await this.technicianService.createTechnician(req.body);
      res.status(201).json({
        success: true,
        data: technician
      });
    } catch (error) {
      next(error);
    }
  };

  getTechnician = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const technician = await this.technicianService.getTechnician(id);
      res.json({
        success: true,
        data: technician
      });
    } catch (error) {
      next(error);
    }
  };

  getTechnicianByEmployeeId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { employeeId } = req.params;
      const technician = await this.technicianService.getTechnicianByEmployeeId(employeeId);
      res.json({
        success: true,
        data: technician
      });
    } catch (error) {
      next(error);
    }
  };

  updateTechnician = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const technician = await this.technicianService.updateTechnician(id, req.body);
      res.json({
        success: true,
        data: technician
      });
    } catch (error) {
      next(error);
    }
  };

  searchTechnicians = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria = {
        status: req.query.status as string,
        department: req.query.department as string,
        baseLocation: req.query.baseLocation as string,
        supervisorId: req.query.supervisorId as string,
        searchTerm: req.query.searchTerm as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.technicianService.searchTechnicians(criteria);
      res.json({
        success: true,
        data: result.technicians,
        pagination: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getAvailableTechnicians = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      const requiredSkills = req.query.requiredSkills 
        ? (req.query.requiredSkills as string).split(',') 
        : undefined;

      const technicians = await this.technicianService.getAvailableTechnicians(date, requiredSkills);
      res.json({
        success: true,
        data: technicians
      });
    } catch (error) {
      next(error);
    }
  };

  getTechnicianProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const profile = await this.technicianService.getTechnicianProfile(id);
      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  };

  getTechnicianSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const summary = await this.technicianService.getTechnicianSummary(id);
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  };

  getTeamMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { supervisorId } = req.params;
      const teamMembers = await this.technicianService.getTeamMembers(supervisorId);
      res.json({
        success: true,
        data: teamMembers
      });
    } catch (error) {
      next(error);
    }
  };

  getTechniciansByDepartment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { department } = req.params;
      const technicians = await this.technicianService.getTechniciansByDepartment(department);
      res.json({
        success: true,
        data: technicians
      });
    } catch (error) {
      next(error);
    }
  };

  getTechniciansByLocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { location } = req.params;
      const technicians = await this.technicianService.getTechniciansByLocation(location);
      res.json({
        success: true,
        data: technicians
      });
    } catch (error) {
      next(error);
    }
  };

  validateTechnicianAssignment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { requiredSkills = [], requiredCertifications = [] } = req.body;
      
      const validation = await this.technicianService.validateTechnicianAssignment(
        id, 
        requiredSkills, 
        requiredCertifications
      );
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  };

  deactivateTechnician = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const technician = await this.technicianService.deactivateTechnician(id, reason);
      res.json({
        success: true,
        data: technician
      });
    } catch (error) {
      next(error);
    }
  };

  reactivateTechnician = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const technician = await this.technicianService.reactivateTechnician(id);
      res.json({
        success: true,
        data: technician
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTechnician = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.technicianService.deleteTechnician(id);
      res.json({
        success: true,
        message: 'Technician deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}