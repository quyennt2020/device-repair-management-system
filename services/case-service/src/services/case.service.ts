import { db } from '@drms/shared-database';
import { 
  RepairCase, 
  CaseStatus, 
  CasePriority,
  UUID,
  CreateCaseRequest,
  UpdateCaseRequest,
  CaseFilters
} from '@drms/shared-types';
import { config } from '../config';
import { WorkflowIntegrationService } from './workflow-integration.service';
import { NotificationService } from './notification.service';
import { TechnicianAssignmentService } from './technician-assignment.service';

export interface CaseWithDetails extends RepairCase {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deviceBrand: string;
  deviceModel: string;
  deviceSerialNumber?: string;
  technicianName?: string;
  technicianEmail?: string;
  workflowInstanceId?: UUID;
  workflowStatus?: string;
  attachmentCount: number;
  noteCount: number;
  timelineCount: number;
}

export interface CaseStatistics {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  completedCases: number;
  overdueCase: number;
  averageResolutionTime: number;
  casesByPriority: Record<CasePriority, number>;
  casesByStatus: Record<CaseStatus, number>;
  technicianWorkload: Array<{
    technicianId: UUID;
    technicianName: string;
    activeCases: number;
    completedCases: number;
    averageResolutionTime: number;
  }>;
}

export class CaseService {
  private workflowIntegration: WorkflowIntegrationService;
  private notificationService: NotificationService;
  private technicianAssignment: TechnicianAssignmentService;

  constructor() {
    this.workflowIntegration = new WorkflowIntegrationService();
    this.notificationService = new NotificationService();
    this.technicianAssignment = new TechnicianAssignmentService();
  }

  /**
   * Create a new repair case
   */
  async createCase(request: CreateCaseRequest, createdBy: UUID): Promise<CaseWithDetails> {
    try {
      // Validate customer and device
      await this.validateCustomerAndDevice(request.customerId, request.deviceId);

      // Generate case number
      const caseNumber = await this.generateCaseNumber();

      // Calculate SLA due date
      const priority = request.priority || config.case.defaultPriority as CasePriority;
      const slaHours = config.case.defaultSLA[priority];
      const slaDueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000);

      // Create case
      const result = await db.query(`
        INSERT INTO repair_cases (
          case_number, customer_id, device_id, title, description,
          priority, status, category, subcategory, reported_issue,
          sla_due_date, created_by, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        caseNumber,
        request.customerId,
        request.deviceId,
        request.title,
        request.description,
        priority,
        'open',
        request.category,
        request.subcategory,
        request.reportedIssue,
        slaDueDate,
        createdBy,
        JSON.stringify(request.metadata || {})
      ]);

      const caseData = result.rows[0];

      // Auto-assign technician if enabled
      if (config.case.autoAssignTechnicians) {
        const assignedTechnician = await this.technicianAssignment.autoAssignTechnician(
          caseData.id,
          {
            deviceType: request.deviceType || 'unknown',
            category: request.category,
            priority,
            location: request.location
          }
        );

        if (assignedTechnician) {
          await this.assignTechnician(caseData.id, assignedTechnician.id, createdBy);
        }
      }

      // Start workflow if integration is enabled
      if (config.integrations.enableWorkflowIntegration) {
        const workflowInstance = await this.workflowIntegration.startWorkflowForCase(caseData.id, {
          deviceType: request.deviceType || 'unknown',
          serviceType: request.category || 'repair',
          customerTier: request.customerTier || 'standard',
          priority,
          customerId: request.customerId,
          deviceId: request.deviceId
        });

        if (workflowInstance) {
          // Log workflow start
          await this.addCaseTimelineEntry(
            caseData.id,
            'workflow_started',
            `Workflow started: ${workflowInstance.workflowName || 'Unknown'}`,
            createdBy,
            { workflowInstanceId: workflowInstance.id }
          );
        }
      }

      // Send notifications
      await this.notificationService.sendCaseCreatedNotifications(caseData.id);

      // Log case creation
      await this.addCaseTimelineEntry(
        caseData.id,
        'case_created',
        'Case created',
        createdBy,
        { priority, category: request.category }
      );

      return await this.getCaseById(caseData.id) as CaseWithDetails;
    } catch (error) {
      console.error('Create case error:', error);
      throw error;
    }
  }

  /**
   * Get case by ID with full details
   */
  async getCaseById(caseId: UUID): Promise<CaseWithDetails | null> {
    try {
      const result = await db.query(`
        SELECT 
          rc.*,
          c.name as customer_name,
          c.email as customer_email,
          c.phone as customer_phone,
          d.brand as device_brand,
          d.model as device_model,
          d.serial_number as device_serial_number,
          t.full_name as technician_name,
          t.email as technician_email,
          wi.id as workflow_instance_id,
          wi.status as workflow_status,
          (SELECT COUNT(*) FROM case_attachments WHERE case_id = rc.id) as attachment_count,
          (SELECT COUNT(*) FROM case_notes WHERE case_id = rc.id) as note_count,
          (SELECT COUNT(*) FROM case_timeline WHERE case_id = rc.id) as timeline_count
        FROM repair_cases rc
        JOIN customers c ON rc.customer_id = c.id
        JOIN devices d ON rc.device_id = d.id
        LEFT JOIN technicians tech ON rc.assigned_technician_id = tech.id
        LEFT JOIN users t ON tech.user_id = t.id
        LEFT JOIN workflow_instances wi ON rc.id = wi.case_id AND wi.status IN ('running', 'suspended')
        WHERE rc.id = $1 AND rc.deleted_at IS NULL
      `, [caseId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapCaseWithDetails(result.rows[0]);
    } catch (error) {
      console.error('Get case by ID error:', error);
      throw error;
    }
  }

  /**
   * Get cases with filtering and pagination
   */
  async getCases(filters: CaseFilters = {}): Promise<{
    cases: CaseWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        priority,
        category,
        customerId,
        technicianId,
        deviceId,
        search,
        createdAfter,
        createdBefore,
        dueBefore,
        overdue
      } = filters;

      const offset = (page - 1) * limit;
      const conditions = ['rc.deleted_at IS NULL'];
      const params = [];
      let paramCount = 1;

      // Build WHERE conditions
      if (status) {
        conditions.push(`rc.status = $${paramCount++}`);
        params.push(status);
      }

      if (priority) {
        conditions.push(`rc.priority = $${paramCount++}`);
        params.push(priority);
      }

      if (category) {
        conditions.push(`rc.category = $${paramCount++}`);
        params.push(category);
      }

      if (customerId) {
        conditions.push(`rc.customer_id = $${paramCount++}`);
        params.push(customerId);
      }

      if (technicianId) {
        conditions.push(`rc.assigned_technician_id = $${paramCount++}`);
        params.push(technicianId);
      }

      if (deviceId) {
        conditions.push(`rc.device_id = $${paramCount++}`);
        params.push(deviceId);
      }

      if (search) {
        conditions.push(`(
          rc.case_number ILIKE $${paramCount} OR 
          rc.title ILIKE $${paramCount} OR 
          rc.description ILIKE $${paramCount} OR
          c.name ILIKE $${paramCount}
        )`);
        params.push(`%${search}%`);
        paramCount++;
      }

      if (createdAfter) {
        conditions.push(`rc.created_at >= $${paramCount++}`);
        params.push(createdAfter);
      }

      if (createdBefore) {
        conditions.push(`rc.created_at <= $${paramCount++}`);
        params.push(createdBefore);
      }

      if (dueBefore) {
        conditions.push(`rc.sla_due_date <= $${paramCount++}`);
        params.push(dueBefore);
      }

      if (overdue) {
        conditions.push(`rc.sla_due_date < NOW() AND rc.status NOT IN ('completed', 'cancelled')`);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM repair_cases rc
        JOIN customers c ON rc.customer_id = c.id
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get cases
      const casesQuery = `
        SELECT 
          rc.*,
          c.name as customer_name,
          c.email as customer_email,
          c.phone as customer_phone,
          d.brand as device_brand,
          d.model as device_model,
          d.serial_number as device_serial_number,
          t.full_name as technician_name,
          t.email as technician_email,
          wi.id as workflow_instance_id,
          wi.status as workflow_status,
          (SELECT COUNT(*) FROM case_attachments WHERE case_id = rc.id) as attachment_count,
          (SELECT COUNT(*) FROM case_notes WHERE case_id = rc.id) as note_count,
          (SELECT COUNT(*) FROM case_timeline WHERE case_id = rc.id) as timeline_count
        FROM repair_cases rc
        JOIN customers c ON rc.customer_id = c.id
        JOIN devices d ON rc.device_id = d.id
        LEFT JOIN technicians tech ON rc.assigned_technician_id = tech.id
        LEFT JOIN users t ON tech.user_id = t.id
        LEFT JOIN workflow_instances wi ON rc.id = wi.case_id AND wi.status IN ('running', 'suspended')
        ${whereClause}
        ORDER BY 
          CASE WHEN rc.sla_due_date < NOW() AND rc.status NOT IN ('completed', 'cancelled') THEN 0 ELSE 1 END,
          rc.priority = 'urgent' DESC,
          rc.priority = 'high' DESC,
          rc.priority = 'medium' DESC,
          rc.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;
      
      params.push(limit, offset);
      const casesResult = await db.query(casesQuery, params);

      const cases = casesResult.rows.map(row => this.mapCaseWithDetails(row));

      return {
        cases,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Get cases error:', error);
      throw error;
    }
  }

  /**
   * Update case
   */
  async updateCase(caseId: UUID, updates: UpdateCaseRequest, updatedBy: UUID): Promise<CaseWithDetails> {
    try {
      const existingCase = await this.getCaseById(caseId);
      if (!existingCase) {
        throw new Error('Case not found');
      }

      const setClause = [];
      const values = [];
      let paramCount = 1;
      const changes = [];

      if (updates.title !== undefined) {
        setClause.push(`title = $${paramCount++}`);
        values.push(updates.title);
        changes.push(`Title changed from "${existingCase.title}" to "${updates.title}"`);
      }

      if (updates.description !== undefined) {
        setClause.push(`description = $${paramCount++}`);
        values.push(updates.description);
        changes.push('Description updated');
      }

      if (updates.priority !== undefined && updates.priority !== existingCase.priority) {
        setClause.push(`priority = $${paramCount++}`);
        values.push(updates.priority);
        changes.push(`Priority changed from ${existingCase.priority} to ${updates.priority}`);
        
        // Recalculate SLA if priority changed
        const slaHours = config.case.defaultSLA[updates.priority];
        const newSlaDueDate = new Date(existingCase.createdAt.getTime() + slaHours * 60 * 60 * 1000);
        setClause.push(`sla_due_date = $${paramCount++}`);
        values.push(newSlaDueDate);
        changes.push(`SLA due date updated to ${newSlaDueDate.toISOString()}`);
      }

      if (updates.category !== undefined) {
        setClause.push(`category = $${paramCount++}`);
        values.push(updates.category);
        changes.push(`Category changed to ${updates.category}`);
      }

      if (updates.subcategory !== undefined) {
        setClause.push(`subcategory = $${paramCount++}`);
        values.push(updates.subcategory);
        changes.push(`Subcategory changed to ${updates.subcategory}`);
      }

      if (updates.reportedIssue !== undefined) {
        setClause.push(`reported_issue = $${paramCount++}`);
        values.push(updates.reportedIssue);
        changes.push('Reported issue updated');
      }

      if (updates.metadata !== undefined) {
        setClause.push(`metadata = $${paramCount++}`);
        values.push(JSON.stringify({ ...existingCase.metadata, ...updates.metadata }));
        changes.push('Metadata updated');
      }

      if (setClause.length === 0) {
        throw new Error('No fields to update');
      }

      setClause.push(`updated_at = NOW()`);
      values.push(caseId);

      await db.query(`
        UPDATE repair_cases 
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
      `, values);

      // Log changes
      if (changes.length > 0) {
        await this.addCaseTimelineEntry(
          caseId,
          'case_updated',
          changes.join('; '),
          updatedBy,
          updates
        );
      }

      // Send notifications for significant changes
      if (updates.priority && updates.priority !== existingCase.priority) {
        await this.notificationService.sendPriorityChangeNotification(caseId, existingCase.priority, updates.priority);
      }

      return await this.getCaseById(caseId) as CaseWithDetails;
    } catch (error) {
      console.error('Update case error:', error);
      throw error;
    }
  }

  /**
   * Update case status
   */
  async updateCaseStatus(caseId: UUID, newStatus: CaseStatus, updatedBy: UUID, comment?: string): Promise<void> {
    try {
      const existingCase = await this.getCaseById(caseId);
      if (!existingCase) {
        throw new Error('Case not found');
      }

      if (existingCase.status === newStatus) {
        return; // No change needed
      }

      const now = new Date();
      const updateFields = ['status = $1', 'updated_at = $2'];
      const values = [newStatus, now];
      let paramCount = 3;

      // Set completion date for completed/cancelled cases
      if (newStatus === 'completed' || newStatus === 'cancelled') {
        updateFields.push(`completed_at = $${paramCount++}`);
        values.push(now);
      }

      values.push(caseId);

      await db.query(`
        UPDATE repair_cases 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount - 1}
      `, values);

      // Log status change
      await this.addCaseTimelineEntry(
        caseId,
        'status_changed',
        `Status changed from ${existingCase.status} to ${newStatus}${comment ? `: ${comment}` : ''}`,
        updatedBy,
        { oldStatus: existingCase.status, newStatus, comment }
      );

      // Handle workflow status updates
      if (config.integrations.enableWorkflowIntegration) {
        await this.workflowIntegration.handleCaseStatusChange(caseId, newStatus, updatedBy);
      }

      // Send notifications
      await this.notificationService.sendStatusChangeNotification(caseId, existingCase.status, newStatus);

    } catch (error) {
      console.error('Update case status error:', error);
      throw error;
    }
  }

  /**
   * Assign technician to case
   */
  async assignTechnician(caseId: UUID, technicianId: UUID, assignedBy: UUID): Promise<void> {
    try {
      const existingCase = await this.getCaseById(caseId);
      if (!existingCase) {
        throw new Error('Case not found');
      }

      // Validate technician
      const technician = await this.validateTechnician(technicianId);
      if (!technician) {
        throw new Error('Technician not found or inactive');
      }

      // Check technician workload
      const currentWorkload = await this.technicianAssignment.getTechnicianWorkload(technicianId);
      if (currentWorkload >= config.case.maxCasesPerTechnician) {
        throw new Error('Technician has reached maximum case limit');
      }

      const previousTechnicianId = existingCase.assignedTechnicianId;

      await db.query(`
        UPDATE repair_cases 
        SET assigned_technician_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [technicianId, caseId]);

      // Log assignment
      const message = previousTechnicianId 
        ? `Technician reassigned from ${existingCase.technicianName} to ${technician.fullName}`
        : `Technician assigned: ${technician.fullName}`;

      await this.addCaseTimelineEntry(
        caseId,
        'technician_assigned',
        message,
        assignedBy,
        { 
          previousTechnicianId, 
          newTechnicianId: technicianId,
          technicianName: technician.fullName
        }
      );

      // Update case status if it's still open
      if (existingCase.status === 'open') {
        await this.updateCaseStatus(caseId, 'assigned', assignedBy, 'Technician assigned');
      }

      // Send notifications
      await this.notificationService.sendTechnicianAssignmentNotification(caseId, technicianId, previousTechnicianId);

    } catch (error) {
      console.error('Assign technician error:', error);
      throw error;
    }
  }

  /**
   * Add note to case
   */
  async addCaseNote(
    caseId: UUID,
    content: string,
    noteType: 'internal' | 'customer' | 'technician',
    createdBy: UUID,
    isPrivate: boolean = false
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO case_notes (case_id, content, note_type, created_by, is_private)
        VALUES ($1, $2, $3, $4, $5)
      `, [caseId, content, noteType, createdBy, isPrivate]);

      // Log note addition
      await this.addCaseTimelineEntry(
        caseId,
        'note_added',
        `${noteType} note added${isPrivate ? ' (private)' : ''}`,
        createdBy,
        { noteType, isPrivate, contentLength: content.length }
      );

      // Send notifications for customer-visible notes
      if (!isPrivate && noteType === 'technician') {
        await this.notificationService.sendNoteAddedNotification(caseId, content);
      }

    } catch (error) {
      console.error('Add case note error:', error);
      throw error;
    }
  }

  /**
   * Get case statistics
   */
  async getCaseStatistics(filters: {
    technicianId?: UUID;
    customerId?: UUID;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<CaseStatistics> {
    try {
      const { technicianId, customerId, dateFrom, dateTo } = filters;
      const conditions = ['deleted_at IS NULL'];
      const params = [];
      let paramCount = 1;

      if (technicianId) {
        conditions.push(`assigned_technician_id = $${paramCount++}`);
        params.push(technicianId);
      }

      if (customerId) {
        conditions.push(`customer_id = $${paramCount++}`);
        params.push(customerId);
      }

      if (dateFrom) {
        conditions.push(`created_at >= $${paramCount++}`);
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push(`created_at <= $${paramCount++}`);
        params.push(dateTo);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get basic statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_cases,
          COUNT(CASE WHEN status IN ('open', 'assigned', 'in_progress') THEN 1 END) as open_cases,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_cases,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cases,
          COUNT(CASE WHEN sla_due_date < NOW() AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue_cases,
          AVG(CASE WHEN completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_resolution_hours
        FROM repair_cases
        ${whereClause}
      `;
      const statsResult = await db.query(statsQuery, params);
      const stats = statsResult.rows[0];

      // Get cases by priority
      const priorityQuery = `
        SELECT priority, COUNT(*) as count
        FROM repair_cases
        ${whereClause}
        GROUP BY priority
      `;
      const priorityResult = await db.query(priorityQuery, params);
      const casesByPriority = priorityResult.rows.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {} as Record<CasePriority, number>);

      // Get cases by status
      const statusQuery = `
        SELECT status, COUNT(*) as count
        FROM repair_cases
        ${whereClause}
        GROUP BY status
      `;
      const statusResult = await db.query(statusQuery, params);
      const casesByStatus = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<CaseStatus, number>);

      // Get technician workload
      const workloadQuery = `
        SELECT 
          t.id as technician_id,
          u.full_name as technician_name,
          COUNT(CASE WHEN rc.status IN ('assigned', 'in_progress') THEN 1 END) as active_cases,
          COUNT(CASE WHEN rc.status = 'completed' THEN 1 END) as completed_cases,
          AVG(CASE WHEN rc.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (rc.completed_at - rc.created_at))/3600 END) as avg_resolution_hours
        FROM technicians t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN repair_cases rc ON t.id = rc.assigned_technician_id AND rc.deleted_at IS NULL
        ${conditions.length > 1 ? `AND ${conditions.slice(1).join(' AND ')}` : ''}
        GROUP BY t.id, u.full_name
        ORDER BY active_cases DESC
      `;
      const workloadResult = await db.query(workloadQuery, params.slice(technicianId ? 1 : 0));
      const technicianWorkload = workloadResult.rows.map(row => ({
        technicianId: row.technician_id,
        technicianName: row.technician_name,
        activeCases: parseInt(row.active_cases),
        completedCases: parseInt(row.completed_cases),
        averageResolutionTime: parseFloat(row.avg_resolution_hours) || 0
      }));

      return {
        totalCases: parseInt(stats.total_cases),
        openCases: parseInt(stats.open_cases),
        inProgressCases: parseInt(stats.in_progress_cases),
        completedCases: parseInt(stats.completed_cases),
        overdueCase: parseInt(stats.overdue_cases),
        averageResolutionTime: parseFloat(stats.avg_resolution_hours) || 0,
        casesByPriority,
        casesByStatus,
        technicianWorkload
      };
    } catch (error) {
      console.error('Get case statistics error:', error);
      throw error;
    }
  }

  /**
   * Delete case (soft delete)
   */
  async deleteCase(caseId: UUID, deletedBy: UUID): Promise<void> {
    try {
      const existingCase = await this.getCaseById(caseId);
      if (!existingCase) {
        throw new Error('Case not found');
      }

      if (existingCase.status === 'in_progress') {
        throw new Error('Cannot delete case that is in progress');
      }

      await db.query(`
        UPDATE repair_cases 
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [caseId]);

      // Log deletion
      await this.addCaseTimelineEntry(
        caseId,
        'case_deleted',
        'Case deleted',
        deletedBy
      );

    } catch (error) {
      console.error('Delete case error:', error);
      throw error;
    }
  }

  // Helper methods

  private async validateCustomerAndDevice(customerId: UUID, deviceId: UUID): Promise<void> {
    const result = await db.query(`
      SELECT c.id as customer_id, d.id as device_id
      FROM customers c
      CROSS JOIN devices d
      WHERE c.id = $1 AND d.id = $2 AND c.deleted_at IS NULL AND d.deleted_at IS NULL
    `, [customerId, deviceId]);

    if (result.rows.length === 0) {
      throw new Error('Invalid customer or device');
    }
  }

  private async validateTechnician(technicianId: UUID): Promise<{ id: UUID; fullName: string } | null> {
    const result = await db.query(`
      SELECT t.id, u.full_name
      FROM technicians t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1 AND t.is_active = true AND u.deleted_at IS NULL
    `, [technicianId]);

    return result.rows.length > 0 ? {
      id: result.rows[0].id,
      fullName: result.rows[0].full_name
    } : null;
  }

  private async generateCaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM repair_cases
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year]);

    const count = parseInt(result.rows[0].count) + 1;
    return `RC${year}${count.toString().padStart(6, '0')}`;
  }

  private async addCaseTimelineEntry(
    caseId: UUID,
    eventType: string,
    description: string,
    createdBy: UUID,
    metadata?: any
  ): Promise<void> {
    await db.query(`
      INSERT INTO case_timeline (case_id, event_type, description, created_by, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `, [caseId, eventType, description, createdBy, JSON.stringify(metadata || {})]);
  }

  private mapCaseWithDetails(row: any): CaseWithDetails {
    return {
      id: row.id,
      caseNumber: row.case_number,
      customerId: row.customer_id,
      deviceId: row.device_id,
      assignedTechnicianId: row.assigned_technician_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      category: row.category,
      subcategory: row.subcategory,
      reportedIssue: row.reported_issue,
      resolution: row.resolution,
      slaDueDate: row.sla_due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      createdBy: row.created_by,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      deviceBrand: row.device_brand,
      deviceModel: row.device_model,
      deviceSerialNumber: row.device_serial_number,
      technicianName: row.technician_name,
      technicianEmail: row.technician_email,
      workflowInstanceId: row.workflow_instance_id,
      workflowStatus: row.workflow_status,
      attachmentCount: parseInt(row.attachment_count) || 0,
      noteCount: parseInt(row.note_count) || 0,
      timelineCount: parseInt(row.timeline_count) || 0
    };
  }
}