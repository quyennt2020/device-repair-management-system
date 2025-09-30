import { Request, Response } from 'express';
import { CaseService } from '../services/case.service';
import { CreateCaseRequest, UpdateCaseRequest, CaseFilters, UUID } from '@drms/shared-types';
import { db } from '@drms/shared-database';

export class CaseController {
  private caseService: CaseService;

  constructor() {
    this.caseService = new CaseService();
  }

  /**
   * Create a new repair case
   */
  async createCase(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const request: CreateCaseRequest = {
        customerId: req.body.customerId,
        deviceId: req.body.deviceId,
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        category: req.body.category,
        subcategory: req.body.subcategory,
        reportedIssue: req.body.reportedIssue,
        deviceType: req.body.deviceType,
        location: req.body.location,
        metadata: req.body.metadata
      };

      // If user is a customer, ensure they can only create cases for themselves
      if (req.user?.role === 'customer') {
        const customerResult = await db.query(
          'SELECT id FROM customers WHERE user_id = $1',
          [userId]
        );
        
        if (customerResult.rows.length === 0 || customerResult.rows[0].id !== request.customerId) {
          res.status(403).json({ error: 'Cannot create case for another customer' });
          return;
        }
      }

      const caseData = await this.caseService.createCase(request, userId);
      
      res.status(201).json({
        success: true,
        data: caseData,
        message: 'Case created successfully'
      });
    } catch (error) {
      console.error('Create case error:', error);
      res.status(500).json({ 
        error: 'Failed to create case',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cases with filtering and pagination
   */
  async getCases(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      let filters: CaseFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as any,
        priority: req.query.priority as any,
        category: req.query.category as string,
        customerId: req.query.customerId as UUID,
        technicianId: req.query.technicianId as UUID,
        deviceId: req.query.deviceId as UUID,
        search: req.query.search as string,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
        dueBefore: req.query.dueBefore ? new Date(req.query.dueBefore as string) : undefined,
        overdue: req.query.overdue === 'true'
      };

      // Apply role-based filtering
      if (userRole === 'customer') {
        // Customers can only see their own cases
        const customerResult = await db.query(
          'SELECT id FROM customers WHERE user_id = $1',
          [userId]
        );
        
        if (customerResult.rows.length === 0) {
          res.status(403).json({ error: 'Customer profile not found' });
          return;
        }
        
        filters.customerId = customerResult.rows[0].id;
      } else if (userRole === 'technician') {
        // Technicians can see cases assigned to them or unassigned cases
        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length > 0) {
          filters.technicianId = technicianResult.rows[0].id;
        }
      }

      const result = await this.caseService.getCases(filters);
      
      res.json({
        success: true,
        data: result,
        message: 'Cases retrieved successfully'
      });
    } catch (error) {
      console.error('Get cases error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve cases',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get case by ID
   */
  async getCaseById(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const caseData = await this.caseService.getCaseById(caseId);
      
      if (!caseData) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      // Check access permissions
      if (userRole === 'customer') {
        const customerResult = await db.query(
          'SELECT id FROM customers WHERE user_id = $1',
          [userId]
        );
        
        if (customerResult.rows.length === 0 || customerResult.rows[0].id !== caseData.customerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      } else if (userRole === 'technician') {
        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || 
            (caseData.assignedTechnicianId && technicianResult.rows[0].id !== caseData.assignedTechnicianId)) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      res.json({
        success: true,
        data: caseData,
        message: 'Case retrieved successfully'
      });
    } catch (error) {
      console.error('Get case by ID error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve case',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update case
   */
  async updateCase(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const updates: UpdateCaseRequest = {
        title: req.body.title,
        description: req.body.description,
        priority: req.body.priority,
        category: req.body.category,
        subcategory: req.body.subcategory,
        reportedIssue: req.body.reportedIssue,
        metadata: req.body.metadata
      };

      const updatedCase = await this.caseService.updateCase(caseId, updates, userId);
      
      res.json({
        success: true,
        data: updatedCase,
        message: 'Case updated successfully'
      });
    } catch (error) {
      console.error('Update case error:', error);
      res.status(500).json({ 
        error: 'Failed to update case',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update case status
   */
  async updateCaseStatus(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { status, comment } = req.body;

      // Check if technician can update this case
      if (userRole === 'technician') {
        const caseData = await this.caseService.getCaseById(caseId);
        if (!caseData) {
          res.status(404).json({ error: 'Case not found' });
          return;
        }

        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || 
            technicianResult.rows[0].id !== caseData.assignedTechnicianId) {
          res.status(403).json({ error: 'Can only update status of assigned cases' });
          return;
        }
      }

      await this.caseService.updateCaseStatus(caseId, status, userId, comment);
      
      res.json({
        success: true,
        message: 'Case status updated successfully'
      });
    } catch (error) {
      console.error('Update case status error:', error);
      res.status(500).json({ 
        error: 'Failed to update case status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Assign technician to case
   */
  async assignTechnician(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;
      const { technicianId } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.caseService.assignTechnician(caseId, technicianId, userId);
      
      res.json({
        success: true,
        message: 'Technician assigned successfully'
      });
    } catch (error) {
      console.error('Assign technician error:', error);
      res.status(500).json({ 
        error: 'Failed to assign technician',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add note to case
   */
  async addCaseNote(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { content, noteType, isPrivate } = req.body;

      // Check access permissions
      if (userRole === 'customer') {
        const caseData = await this.caseService.getCaseById(caseId);
        if (!caseData) {
          res.status(404).json({ error: 'Case not found' });
          return;
        }

        const customerResult = await db.query(
          'SELECT id FROM customers WHERE user_id = $1',
          [userId]
        );
        
        if (customerResult.rows.length === 0 || customerResult.rows[0].id !== caseData.customerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        // Customers can only add customer notes and cannot make them private
        if (noteType !== 'customer' || isPrivate) {
          res.status(403).json({ error: 'Invalid note type for customer' });
          return;
        }
      } else if (userRole === 'technician') {
        const caseData = await this.caseService.getCaseById(caseId);
        if (!caseData) {
          res.status(404).json({ error: 'Case not found' });
          return;
        }

        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || 
            technicianResult.rows[0].id !== caseData.assignedTechnicianId) {
          res.status(403).json({ error: 'Can only add notes to assigned cases' });
          return;
        }
      }

      await this.caseService.addCaseNote(caseId, content, noteType, userId, isPrivate || false);
      
      res.json({
        success: true,
        message: 'Note added successfully'
      });
    } catch (error) {
      console.error('Add case note error:', error);
      res.status(500).json({ 
        error: 'Failed to add note',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get case statistics
   */
  async getCaseStatistics(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        technicianId: req.query.technicianId as UUID,
        customerId: req.query.customerId as UUID,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
      };

      const statistics = await this.caseService.getCaseStatistics(filters);
      
      res.json({
        success: true,
        data: statistics,
        message: 'Statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Get case statistics error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get case timeline
   */
  async getCaseTimeline(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check access permissions (same as getCaseById)
      const caseData = await this.caseService.getCaseById(caseId);
      if (!caseData) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      if (userRole === 'customer') {
        const customerResult = await db.query(
          'SELECT id FROM customers WHERE user_id = $1',
          [userId]
        );
        
        if (customerResult.rows.length === 0 || customerResult.rows[0].id !== caseData.customerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      } else if (userRole === 'technician') {
        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || 
            (caseData.assignedTechnicianId && technicianResult.rows[0].id !== caseData.assignedTechnicianId)) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      const result = await db.query(`
        SELECT 
          ct.*,
          u.full_name as created_by_name
        FROM case_timeline ct
        LEFT JOIN users u ON ct.created_by = u.id
        WHERE ct.case_id = $1
        ORDER BY ct.created_at DESC
      `, [caseId]);

      res.json({
        success: true,
        data: result.rows,
        message: 'Timeline retrieved successfully'
      });
    } catch (error) {
      console.error('Get case timeline error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve timeline',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get case notes
   */
  async getCaseNotes(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check access permissions
      const caseData = await this.caseService.getCaseById(caseId);
      if (!caseData) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      let query = `
        SELECT 
          cn.*,
          u.full_name as created_by_name
        FROM case_notes cn
        LEFT JOIN users u ON cn.created_by = u.id
        WHERE cn.case_id = $1
      `;
      const params = [caseId];

      // Filter private notes for customers
      if (userRole === 'customer') {
        const customerResult = await db.query(
          'SELECT id FROM customers WHERE user_id = $1',
          [userId]
        );
        
        if (customerResult.rows.length === 0 || customerResult.rows[0].id !== caseData.customerId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        query += ' AND is_private = false';
      } else if (userRole === 'technician') {
        const technicianResult = await db.query(
          'SELECT id FROM technicians WHERE user_id = $1',
          [userId]
        );
        
        if (technicianResult.rows.length === 0 || 
            (caseData.assignedTechnicianId && technicianResult.rows[0].id !== caseData.assignedTechnicianId)) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }
      }

      query += ' ORDER BY cn.created_at DESC';

      const result = await db.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        message: 'Notes retrieved successfully'
      });
    } catch (error) {
      console.error('Get case notes error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve notes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete case (soft delete)
   */
  async deleteCase(req: Request, res: Response): Promise<void> {
    try {
      const caseId = req.params.id as UUID;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.caseService.deleteCase(caseId, userId);
      
      res.json({
        success: true,
        message: 'Case deleted successfully'
      });
    } catch (error) {
      console.error('Delete case error:', error);
      res.status(500).json({ 
        error: 'Failed to delete case',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}