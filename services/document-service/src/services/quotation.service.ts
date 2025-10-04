import { QuotationRepository } from '../repositories/quotation.repository';
import { 
  EnhancedQuotation, 
  QuotationRevision, 
  QuotationComparison, 
  QuotationApproval,
  QuotationCustomerResponse,
  QuotationValidityTracking,
  QuotationSearchCriteria,
  QuotationSearchResult,
  QuotationAnalytics,
  CreateQuotationRequest,
  UpdateQuotationRequest,
  CreateQuotationRevisionRequest,
  CreateQuotationComparisonRequest,
  SubmitQuotationApprovalRequest,
  SubmitCustomerResponseRequest,
  ExtendQuotationValidityRequest
} from '../types/quotation';
import { UUID } from '../../../../shared/types/src/common';
import { Pool } from 'pg';

export class QuotationService {
  private quotationRepository: QuotationRepository;

  constructor(private db: Pool) {
    this.quotationRepository = new QuotationRepository(db);
  }

  async createQuotation(request: CreateQuotationRequest, createdBy: UUID): Promise<EnhancedQuotation> {
    // Validate line items
    this.validateLineItems(request.lineItems);
    
    // Calculate totals and validate amounts
    const calculatedTotals = this.calculateTotals(request.lineItems);
    
    // Create quotation
    const quotation = await this.quotationRepository.createQuotation(request, createdBy);
    
    // Send notification to stakeholders
    await this.sendQuotationCreatedNotification(quotation);
    
    return quotation;
  }

  async updateQuotation(id: UUID, request: UpdateQuotationRequest, updatedBy: UUID): Promise<EnhancedQuotation> {
    // Check if quotation exists and can be updated
    const existingQuotation = await this.quotationRepository.getQuotationById(id);
    if (!existingQuotation) {
      throw new Error('Quotation not found');
    }

    if (!this.canUpdateQuotation(existingQuotation)) {
      throw new Error('Quotation cannot be updated in current status');
    }

    // Validate line items if provided
    if (request.lineItems) {
      this.validateLineItems(request.lineItems);
    }

    const updatedQuotation = await this.quotationRepository.updateQuotation(id, request, updatedBy);
    
    // Send update notification
    await this.sendQuotationUpdatedNotification(updatedQuotation);
    
    return updatedQuotation;
  }

  async getQuotationById(id: UUID): Promise<EnhancedQuotation | null> {
    return await this.quotationRepository.getQuotationById(id);
  }

  async getQuotationByNumber(quotationNumber: string): Promise<EnhancedQuotation | null> {
    return await this.quotationRepository.getQuotationByNumber(quotationNumber);
  }

  async searchQuotations(criteria: QuotationSearchCriteria): Promise<QuotationSearchResult> {
    const { quotations, total } = await this.quotationRepository.searchQuotations(criteria);
    
    return {
      quotations,
      total,
      limit: criteria.limit || 50,
      offset: criteria.offset || 0
    };
  }

  async createRevision(request: CreateQuotationRevisionRequest, createdBy: UUID): Promise<QuotationRevision> {
    // Check if quotation exists
    const existingQuotation = await this.quotationRepository.getQuotationById(request.quotationId);
    if (!existingQuotation) {
      throw new Error('Quotation not found');
    }

    // Validate line items
    this.validateLineItems(request.lineItems);

    const revision = await this.quotationRepository.createRevision(request, createdBy);
    
    // Send revision notification
    await this.sendQuotationRevisionNotification(revision, existingQuotation);
    
    return revision;
  }

  async getQuotationRevisions(quotationId: UUID): Promise<QuotationRevision[]> {
    return await this.quotationRepository.getQuotationRevisions(quotationId);
  }

  async createComparison(request: CreateQuotationComparisonRequest, createdBy: UUID): Promise<QuotationComparison> {
    // Validate quotation IDs exist
    for (const quotationId of request.quotationIds) {
      const quotation = await this.quotationRepository.getQuotationById(quotationId);
      if (!quotation) {
        throw new Error(`Quotation ${quotationId} not found`);
      }
    }

    if (request.quotationIds.length < 2) {
      throw new Error('At least 2 quotations are required for comparison');
    }

    return await this.quotationRepository.createComparison(request, createdBy);
  }

  async getComparison(id: UUID): Promise<QuotationComparison | null> {
    return await this.quotationRepository.getComparison(id);
  }

  async getComparisonsByCase(caseId: UUID): Promise<QuotationComparison[]> {
    return await this.quotationRepository.getComparisonsByCase(caseId);
  }

  async submitApproval(request: SubmitQuotationApprovalRequest, approverUserId: UUID): Promise<QuotationApproval> {
    // Check if quotation exists
    const quotation = await this.quotationRepository.getQuotationById(request.quotationId);
    if (!quotation) {
      throw new Error('Quotation not found');
    }

    // Validate approval permissions
    await this.validateApprovalPermissions(approverUserId, request.approvalLevel);

    const approval = await this.quotationRepository.submitApproval(request, approverUserId);
    
    // Send approval notification
    await this.sendApprovalNotification(approval, quotation);
    
    // If approved, check if we need to proceed to next approval level or complete
    if (request.status === 'approved') {
      await this.processApprovalWorkflow(quotation, request.approvalLevel);
    }
    
    return approval;
  }

  async submitCustomerResponse(request: SubmitCustomerResponseRequest, createdBy: UUID): Promise<QuotationCustomerResponse> {
    // Check if quotation exists and is in valid state for customer response
    const quotation = await this.quotationRepository.getQuotationById(request.quotationId);
    if (!quotation) {
      throw new Error('Quotation not found');
    }

    if (quotation.approvalStatus !== 'approved') {
      throw new Error('Quotation must be approved before customer can respond');
    }

    if (this.isQuotationExpired(quotation)) {
      throw new Error('Quotation has expired');
    }

    const response = await this.quotationRepository.submitCustomerResponse(request, createdBy);
    
    // Send customer response notification
    await this.sendCustomerResponseNotification(response, quotation);
    
    // Process response workflow
    await this.processCustomerResponseWorkflow(quotation, response);
    
    return response;
  }

  async extendValidity(request: ExtendQuotationValidityRequest, approvedBy: UUID): Promise<QuotationValidityTracking> {
    // Check if quotation exists
    const quotation = await this.quotationRepository.getQuotationById(request.quotationId);
    if (!quotation) {
      throw new Error('Quotation not found');
    }

    // Validate extension request
    if (request.newExpiryDate <= new Date()) {
      throw new Error('New expiry date must be in the future');
    }

    if (request.newExpiryDate <= quotation.expiryDate) {
      throw new Error('New expiry date must be later than current expiry date');
    }

    const validityTracking = await this.quotationRepository.extendValidity(request, approvedBy);
    
    // Send extension notification
    await this.sendValidityExtensionNotification(quotation, validityTracking);
    
    return validityTracking;
  }

  async getExpiringQuotations(daysAhead: number = 7): Promise<EnhancedQuotation[]> {
    return await this.quotationRepository.getExpiringQuotations(daysAhead);
  }

  async processExpiringQuotations(): Promise<void> {
    // Get quotations expiring in 7, 3, and 1 days
    const quotationsExpiring7Days = await this.getExpiringQuotations(7);
    const quotationsExpiring3Days = await this.getExpiringQuotations(3);
    const quotationsExpiring1Day = await this.getExpiringQuotations(1);

    // Send notifications
    for (const quotation of quotationsExpiring7Days) {
      await this.sendExpiryWarningNotification(quotation, 7);
    }

    for (const quotation of quotationsExpiring3Days) {
      await this.sendExpiryWarningNotification(quotation, 3);
    }

    for (const quotation of quotationsExpiring1Day) {
      await this.sendExpiryWarningNotification(quotation, 1);
    }

    // Mark expired quotations
    await this.markExpiredQuotations();
  }

  async getQuotationAnalytics(caseId?: UUID, dateFrom?: Date, dateTo?: Date): Promise<QuotationAnalytics> {
    const client = await this.db.connect();
    
    try {
      let whereClause = '';
      const params: any[] = [];
      let paramIndex = 1;

      if (caseId) {
        whereClause += ` AND d.case_id = $${paramIndex++}`;
        params.push(caseId);
      }

      if (dateFrom) {
        whereClause += ` AND q.created_at >= $${paramIndex++}`;
        params.push(dateFrom);
      }

      if (dateTo) {
        whereClause += ` AND q.created_at <= $${paramIndex++}`;
        params.push(dateTo);
      }

      // Get basic statistics
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_quotations,
          COUNT(CASE WHEN q.approval_status = 'approved' THEN 1 END) as approved_quotations,
          COUNT(CASE WHEN q.approval_status = 'rejected' THEN 1 END) as rejected_quotations,
          COUNT(CASE WHEN q.status = 'expired' THEN 1 END) as expired_quotations,
          AVG(q.final_amount) as average_amount,
          SUM(q.final_amount) as total_value
        FROM quotations q
        JOIN documents d ON q.document_id = d.id
        WHERE 1=1 ${whereClause}
      `, params);

      const stats = statsResult.rows[0];

      // Calculate approval rate and average approval time
      const approvalRate = stats.total_quotations > 0 
        ? (stats.approved_quotations / stats.total_quotations) * 100 
        : 0;

      // Get top line items
      const topLineItemsResult = await client.query(`
        SELECT 
          item->>'description' as description,
          COUNT(*) as frequency,
          SUM((item->>'totalPrice')::numeric) as total_value,
          AVG((item->>'unitPrice')::numeric) as average_price
        FROM quotations q
        JOIN documents d ON q.document_id = d.id,
        jsonb_array_elements(q.line_items) as item
        WHERE 1=1 ${whereClause}
        GROUP BY item->>'description'
        ORDER BY frequency DESC, total_value DESC
        LIMIT 10
      `, params);

      const topLineItems = topLineItemsResult.rows.map(row => ({
        description: row.description,
        frequency: parseInt(row.frequency),
        totalValue: parseFloat(row.total_value || '0'),
        averagePrice: parseFloat(row.average_price || '0')
      }));

      // Get monthly trends
      const trendsResult = await client.query(`
        SELECT 
          TO_CHAR(q.created_at, 'YYYY-MM') as month,
          COUNT(*) as quotation_count,
          SUM(q.final_amount) as total_value,
          COUNT(CASE WHEN q.approval_status = 'approved' THEN 1 END)::float / COUNT(*)::float * 100 as approval_rate
        FROM quotations q
        JOIN documents d ON q.document_id = d.id
        WHERE 1=1 ${whereClause}
        GROUP BY TO_CHAR(q.created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `, params);

      const monthlyTrends = trendsResult.rows.map(row => ({
        month: row.month,
        quotationCount: parseInt(row.quotation_count),
        totalValue: parseFloat(row.total_value || '0'),
        approvalRate: parseFloat(row.approval_rate || '0')
      }));

      return {
        totalQuotations: parseInt(stats.total_quotations),
        approvedQuotations: parseInt(stats.approved_quotations),
        rejectedQuotations: parseInt(stats.rejected_quotations),
        expiredQuotations: parseInt(stats.expired_quotations),
        averageAmount: parseFloat(stats.average_amount || '0'),
        totalValue: parseFloat(stats.total_value || '0'),
        approvalRate,
        averageApprovalTime: 0, // TODO: Calculate from approval timestamps
        topLineItems,
        monthlyTrends
      };
    } finally {
      client.release();
    }
  }

  private validateLineItems(lineItems: any[]): void {
    if (!lineItems || lineItems.length === 0) {
      throw new Error('At least one line item is required');
    }

    for (const item of lineItems) {
      if (!item.description || item.description.trim() === '') {
        throw new Error('Line item description is required');
      }

      if (!item.quantity || item.quantity <= 0) {
        throw new Error('Line item quantity must be greater than 0');
      }

      if (!item.unitPrice || item.unitPrice < 0) {
        throw new Error('Line item unit price must be non-negative');
      }

      if (!item.totalPrice || item.totalPrice !== item.quantity * item.unitPrice) {
        throw new Error('Line item total price must equal quantity × unit price');
      }
    }
  }

  private calculateTotals(lineItems: any[]): { subtotal: number; tax: number; total: number } {
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const tax = lineItems.reduce((sum, item) => sum + (item.totalPrice * (item.taxRate || 0) / 100), 0);
    const total = subtotal + tax;

    return { subtotal, tax, total };
  }

  private canUpdateQuotation(quotation: EnhancedQuotation): boolean {
    return ['draft', 'submitted'].includes(quotation.status) && 
           quotation.approvalStatus === 'pending' &&
           !this.isQuotationExpired(quotation);
  }

  private isQuotationExpired(quotation: EnhancedQuotation): boolean {
    return new Date() > quotation.expiryDate;
  }

  private async validateApprovalPermissions(userId: UUID, approvalLevel: number): Promise<void> {
    // TODO: Implement role-based approval permissions
    // For now, assume all users can approve at any level
  }

  private async processApprovalWorkflow(quotation: EnhancedQuotation, currentLevel: number): Promise<void> {
    // TODO: Implement multi-level approval workflow
    // For now, single level approval
  }

  private async processCustomerResponseWorkflow(quotation: EnhancedQuotation, response: QuotationCustomerResponse): Promise<void> {
    // TODO: Implement customer response workflow
    // e.g., if approved, create work order; if changes requested, create revision
  }

  private async markExpiredQuotations(): Promise<void> {
    await this.db.query(`
      UPDATE quotations 
      SET status = 'expired', updated_at = NOW()
      WHERE expiry_date < CURRENT_DATE 
        AND status NOT IN ('expired', 'cancelled', 'superseded')
    `);

    await this.db.query(`
      UPDATE quotation_validity_tracking 
      SET status = 'expired', updated_at = NOW()
      WHERE original_expiry_date < CURRENT_DATE 
        AND (extended_expiry_date IS NULL OR extended_expiry_date < CURRENT_DATE)
        AND status = 'active'
    `);
  }

  // Notification methods (placeholder implementations)
  private async sendQuotationCreatedNotification(quotation: EnhancedQuotation): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Quotation created: ${quotation.quotationNumber}`);
  }

  private async sendQuotationUpdatedNotification(quotation: EnhancedQuotation): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Quotation updated: ${quotation.quotationNumber}`);
  }

  private async sendQuotationRevisionNotification(revision: QuotationRevision, quotation: EnhancedQuotation): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Quotation revision created: ${quotation.quotationNumber} v${revision.revisionNumber}`);
  }

  private async sendApprovalNotification(approval: QuotationApproval, quotation: EnhancedQuotation): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Quotation ${approval.status}: ${quotation.quotationNumber}`);
  }

  private async sendCustomerResponseNotification(response: QuotationCustomerResponse, quotation: EnhancedQuotation): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Customer response received: ${quotation.quotationNumber} - ${response.responseType}`);
  }

  private async sendValidityExtensionNotification(quotation: EnhancedQuotation, tracking: QuotationValidityTracking): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Quotation validity extended: ${quotation.quotationNumber}`);
  }

  private async sendExpiryWarningNotification(quotation: EnhancedQuotation, daysUntilExpiry: number): Promise<void> {
    // TODO: Implement notification service integration
    console.log(`Quotation expiring in ${daysUntilExpiry} days: ${quotation.quotationNumber}`);
  }
}