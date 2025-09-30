import { Request, Response } from 'express';
import { TechnicianAssignmentService, AssignmentCriteria } from '../services/technician-assignment.service';
import { UUID } from '@drms/shared-types';
import { db } from '@drms/shared-database';

export class TechnicianAssignmentController {
  private assignmentService: TechnicianAssignmentService;

  constructor() {
    this.assignmentService = new TechnicianAssignmentService();
  }

  /**
   * Get available technicians for assignment
   */
  async getAvailableTechnicians(req: Request, res: Response): Promise<void> {
    try {
      const criteria: AssignmentCriteria | undefined = req.query.deviceType || req.query.category ? {
        deviceType: req.query.deviceType as string,
        category: req.query.category as string,
        priority: req.query.priority as any,
        location: req.query.location as string
      } : undefined;

      const technicians = await this.assignmentService.getAvailableTechnicians(criteria);
      
      res.json({
        success: true,
        data: technicians,
        message: 'Available technicians retrieved successfully'
      });
    } catch (error) {
      console.error('Get available technicians error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve available technicians',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Auto-assign technician to case
   */
  async autoAssignTechnician(req: Request, res: Response): Promise<void> {
    try {
      const { caseId, deviceType, category, priority, location } = req.body;

      const criteria: AssignmentCriteria = {
        deviceType,
        category,
        priority,
        location
      };

      const assignedTechnician = await this.assignmentService.autoAssignTechnician(caseId, criteria);
      
      if (!assignedTechnician) {
        res.status(404).json({
          success: false,
          message: 'No suitable technician found for assignment'
        });
        return;
      }

      res.json({
        success: true,
        data: assignedTechnician,
        message: 'Technician auto-assigned successfully'
      });
    } catch (error) {
      console.error('Auto assign technician error:', error);
      res.status(500).json({ 
        error: 'Failed to auto-assign technician',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get technician workload
   */
  async getTechnicianWorkload(req: Request, res: Response): Promise<void> {
    try {
      const technicianId = req.params.technicianId as UUID;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if technician can view their own workload
      if (userRole === 'technician') {
        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || technicianResult.rows[0].id !== technicianId) {
          res.status(403).json({ error: 'Can only view own workload' });
          return;
        }
      }

      const workload = await this.assignmentService.getTechnicianWorkload(technicianId);
      
      res.json({
        success: true,
        data: { workload },
        message: 'Technician workload retrieved successfully'
      });
    } catch (error) {
      console.error('Get technician workload error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve technician workload',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get technician performance metrics
   */
  async getTechnicianPerformance(req: Request, res: Response): Promise<void> {
    try {
      const technicianId = req.params.technicianId as UUID;
      const days = parseInt(req.query.days as string) || 30;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if technician can view their own performance
      if (userRole === 'technician') {
        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || technicianResult.rows[0].id !== technicianId) {
          res.status(403).json({ error: 'Can only view own performance' });
          return;
        }
      }

      const performance = await this.assignmentService.getTechnicianPerformance(technicianId, days);
      
      res.json({
        success: true,
        data: performance,
        message: 'Technician performance retrieved successfully'
      });
    } catch (error) {
      console.error('Get technician performance error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve technician performance',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get reassignment suggestions
   */
  async getReassignmentSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const suggestions = await this.assignmentService.suggestReassignments();
      
      res.json({
        success: true,
        data: suggestions,
        message: 'Reassignment suggestions retrieved successfully'
      });
    } catch (error) {
      console.error('Get reassignment suggestions error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve reassignment suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Validate if technician can be assigned more cases
   */
  async validateAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { technicianId } = req.body;

      const canAssign = await this.assignmentService.canAssignMoreCases(technicianId);
      const currentWorkload = await this.assignmentService.getTechnicianWorkload(technicianId);
      
      res.json({
        success: true,
        data: {
          canAssign,
          currentWorkload,
          maxCases: 10 // This would come from config
        },
        message: 'Assignment validation completed'
      });
    } catch (error) {
      console.error('Validate assignment error:', error);
      res.status(500).json({ 
        error: 'Failed to validate assignment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}