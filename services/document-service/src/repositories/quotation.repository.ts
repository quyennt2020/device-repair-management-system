import { Pool } from 'pg';
import { 
  EnhancedQuotation, 
  QuotationRevision, 
  QuotationComparison, 
  QuotationApproval,
  QuotationCustomerResponse,
  QuotationValidityTracking,
  QuotationLineItemDetail,
  QuotationSearchCriteria,
  CreateQuotationRequest,
  UpdateQuotationRequest,
  CreateQuotationRevisionRequest,
  CreateQuotationComparisonRequest,
  SubmitQuotationApprovalRequest,
  SubmitCustomerResponseRequest,
  ExtendQuotationValidityRequest
} from '../types/quotation';
import { UUID } from '../../../../shared/types/src/common';

export class QuotationRepository {
  constructor(private db: Pool) {}

  async createQuotation(request: CreateQuotationRequest, createdBy: UUID): Promise<EnhancedQuotation> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Calculate totals
      const totalAmount = request.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      // Create quotation
      const quotationResult = await client.query(`
        INSERT INTO quotations (
          document_id, line_items, total_amount, currency, validity_period, 
          terms_conditions, notes, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
        RETURNING *
      `, [
        request.documentId,
        JSON.stringify(request.lineItems),
        totalAmount,
        request.currency || 'VND',
        request.validityPeriod || 30,
        request.termsConditions || '',
        request.notes || '',
        createdBy
      ]);

      const quotation = quotationResult.rows[0];

      // Create validity tracking
      await client.query(`
        INSERT INTO quotation_validity_tracking (quotation_id, original_expiry_date, status)
        VALUES ($1, $2, 'active')
      `, [quotation.id, quotation.expiry_date]);

      // Create line item details
      for (const item of request.lineItems) {
        await client.query(`
          INSERT INTO quotation_line_item_details (
            quotation_id, line_item_id, part_id, labor_category, 
            markup_percentage, discount_percentage, tax_rate, warranty_months,
            cost_breakdown
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          quotation.id,
          item.id,
          item.partId,
          item.laborCategory,
          item.markupPercentage || 0,
          item.discountPercentage || 0,
          item.taxRate || 0,
          item.warrantyMonths || 0,
          JSON.stringify({
            baseCost: item.unitPrice * item.quantity,
            markup: (item.unitPrice * item.quantity) * (item.markupPercentage || 0) / 100,
            discount: (item.unitPrice * item.quantity) * (item.discountPercentage || 0) / 100,
            tax: (item.unitPrice * item.quantity) * (item.taxRate || 0) / 100
          })
        ]);
      }

      await client.query('COMMIT');
      return this.mapToEnhancedQuotation(quotation);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateQuotation(id: UUID, request: UpdateQuotationRequest, updatedBy: UUID): Promise<EnhancedQuotation> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (request.lineItems) {
        const totalAmount = request.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
        updates.push(`line_items = $${paramIndex++}`);
        values.push(JSON.stringify(request.lineItems));
        updates.push(`total_amount = $${paramIndex++}`);
        values.push(totalAmount);
      }

      if (request.discountAmount !== undefined) {
        updates.push(`discount_amount = $${paramIndex++}`);
        values.push(request.discountAmount);
      }

      if (request.taxAmount !== undefined) {
        updates.push(`tax_amount = $${paramIndex++}`);
        values.push(request.taxAmount);
      }

      if (request.validityPeriod !== undefined) {
        updates.push(`validity_period = $${paramIndex++}`);
        values.push(request.validityPeriod);
      }

      if (request.termsConditions !== undefined) {
        updates.push(`terms_conditions = $${paramIndex++}`);
        values.push(request.termsConditions);
      }

      if (request.notes !== undefined) {
        updates.push(`notes = $${paramIndex++}`);
        values.push(request.notes);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id);

      const result = await client.query(`
        UPDATE quotations 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      await client.query('COMMIT');
      return this.mapToEnhancedQuotation(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getQuotationById(id: UUID): Promise<EnhancedQuotation | null> {
    const result = await this.db.query(`
      SELECT * FROM quotations WHERE id = $1
    `, [id]);

    return result.rows.length > 0 ? this.mapToEnhancedQuotation(result.rows[0]) : null;
  }

  async getQuotationByNumber(quotationNumber: string): Promise<EnhancedQuotation | null> {
    const result = await this.db.query(`
      SELECT * FROM quotations WHERE quotation_number = $1
    `, [quotationNumber]);

    return result.rows.length > 0 ? this.mapToEnhancedQuotation(result.rows[0]) : null;
  }

  async searchQuotations(criteria: QuotationSearchCriteria): Promise<{ quotations: EnhancedQuotation[], total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.caseId) {
      conditions.push(`d.case_id = $${paramIndex++}`);
      values.push(criteria.caseId);
    }

    if (criteria.quotationNumber) {
      conditions.push(`q.quotation_number ILIKE $${paramIndex++}`);
      values.push(`%${criteria.quotationNumber}%`);
    }

    if (criteria.status) {
      conditions.push(`q.status = $${paramIndex++}`);
      values.push(criteria.status);
    }

    if (criteria.approvalStatus) {
      conditions.push(`q.approval_status = $${paramIndex++}`);
      values.push(criteria.approvalStatus);
    }

    if (criteria.customerResponseStatus) {
      conditions.push(`q.customer_response_status = $${paramIndex++}`);
      values.push(criteria.customerResponseStatus);
    }

    if (criteria.createdBy) {
      conditions.push(`q.created_by = $${paramIndex++}`);
      values.push(criteria.createdBy);
    }

    if (criteria.createdAfter) {
      conditions.push(`q.created_at >= $${paramIndex++}`);
      values.push(criteria.createdAfter);
    }

    if (criteria.createdBefore) {
      conditions.push(`q.created_at <= $${paramIndex++}`);
      values.push(criteria.createdBefore);
    }

    if (criteria.expiryAfter) {
      conditions.push(`q.expiry_date >= $${paramIndex++}`);
      values.push(criteria.expiryAfter);
    }

    if (criteria.expiryBefore) {
      conditions.push(`q.expiry_date <= $${paramIndex++}`);
      values.push(criteria.expiryBefore);
    }

    if (criteria.minAmount) {
      conditions.push(`q.final_amount >= $${paramIndex++}`);
      values.push(criteria.minAmount);
    }

    if (criteria.maxAmount) {
      conditions.push(`q.final_amount <= $${paramIndex++}`);
      values.push(criteria.maxAmount);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Get total count
    const countResult = await this.db.query(`
      SELECT COUNT(*) as total
      FROM quotations q
      JOIN documents d ON q.document_id = d.id
      ${whereClause}
    `, values);

    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const limit = criteria.limit || 50;
    const offset = criteria.offset || 0;

    const result = await this.db.query(`
      SELECT q.*
      FROM quotations q
      JOIN documents d ON q.document_id = d.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...values, limit, offset]);

    const quotations = result.rows.map(row => this.mapToEnhancedQuotation(row));

    return { quotations, total };
  }

  async createRevision(request: CreateQuotationRevisionRequest, createdBy: UUID): Promise<QuotationRevision> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get current revision number
      const currentRevisionResult = await client.query(`
        SELECT revision_number FROM quotations WHERE id = $1
      `, [request.quotationId]);

      const newRevisionNumber = currentRevisionResult.rows[0].revision_number + 1;
      const totalAmount = request.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);

      // Create revision record
      const revisionResult = await client.query(`
        INSERT INTO quotation_revisions (
          quotation_id, revision_number, line_items, total_amount, 
          currency, validity_period, terms_conditions, revision_reason, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        request.quotationId,
        newRevisionNumber,
        JSON.stringify(request.lineItems),
        totalAmount,
        'VND',
        request.validityPeriod || 30,
        request.termsConditions || '',
        request.revisionReason,
        createdBy
      ]);

      // Update main quotation
      await client.query(`
        UPDATE quotations 
        SET revision_number = $1, line_items = $2, total_amount = $3,
            validity_period = $4, terms_conditions = $5, status = 'draft',
            approval_status = 'pending', updated_at = NOW()
        WHERE id = $6
      `, [
        newRevisionNumber,
        JSON.stringify(request.lineItems),
        totalAmount,
        request.validityPeriod || 30,
        request.termsConditions || '',
        request.quotationId
      ]);

      await client.query('COMMIT');
      return this.mapToQuotationRevision(revisionResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getQuotationRevisions(quotationId: UUID): Promise<QuotationRevision[]> {
    const result = await this.db.query(`
      SELECT * FROM quotation_revisions 
      WHERE quotation_id = $1 
      ORDER BY revision_number DESC
    `, [quotationId]);

    return result.rows.map(row => this.mapToQuotationRevision(row));
  }

  async createComparison(request: CreateQuotationComparisonRequest, createdBy: UUID): Promise<QuotationComparison> {
    // Get quotations for comparison
    const quotationsResult = await this.db.query(`
      SELECT * FROM quotations WHERE id = ANY($1)
    `, [request.quotationIds]);

    const quotations = quotationsResult.rows.map(row => this.mapToEnhancedQuotation(row));
    
    // Perform comparison logic
    const comparisonResult = this.performQuotationComparison(quotations, request.comparisonCriteria);

    const result = await this.db.query(`
      INSERT INTO quotation_comparisons (
        case_id, name, description, quotation_ids, 
        comparison_criteria, comparison_result, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      request.caseId,
      request.name,
      request.description || '',
      JSON.stringify(request.quotationIds),
      JSON.stringify(request.comparisonCriteria),
      JSON.stringify(comparisonResult),
      createdBy
    ]);

    return this.mapToQuotationComparison(result.rows[0]);
  }

  async getComparison(id: UUID): Promise<QuotationComparison | null> {
    const result = await this.db.query(`
      SELECT * FROM quotation_comparisons WHERE id = $1
    `, [id]);

    return result.rows.length > 0 ? this.mapToQuotationComparison(result.rows[0]) : null;
  }

  async getComparisonsByCase(caseId: UUID): Promise<QuotationComparison[]> {
    const result = await this.db.query(`
      SELECT * FROM quotation_comparisons 
      WHERE case_id = $1 
      ORDER BY created_at DESC
    `, [caseId]);

    return result.rows.map(row => this.mapToQuotationComparison(row));
  }

  async submitApproval(request: SubmitQuotationApprovalRequest, approverUserId: UUID): Promise<QuotationApproval> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Create or update approval record
      const approvalResult = await client.query(`
        INSERT INTO quotation_approvals (
          quotation_id, approval_level, approver_role, approver_user_id, 
          status, comments, approved_at
        ) VALUES ($1, $2, 'manager', $3, $4, $5, $6)
        ON CONFLICT (quotation_id, approval_level) 
        DO UPDATE SET 
          approver_user_id = $3, status = $4, comments = $5, 
          approved_at = $6
        RETURNING *
      `, [
        request.quotationId,
        request.approvalLevel,
        approverUserId,
        request.status,
        request.comments || '',
        request.status === 'approved' ? new Date() : null
      ]);

      // Update quotation approval status
      await client.query(`
        UPDATE quotations 
        SET approval_status = $1, updated_at = NOW()
        WHERE id = $2
      `, [request.status, request.quotationId]);

      await client.query('COMMIT');
      return this.mapToQuotationApproval(approvalResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async submitCustomerResponse(request: SubmitCustomerResponseRequest, createdBy: UUID): Promise<QuotationCustomerResponse> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      const responseResult = await client.query(`
        INSERT INTO quotation_customer_responses (
          quotation_id, response_type, customer_comments, 
          requested_changes, customer_signature_url, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        request.quotationId,
        request.responseType,
        request.customerComments || '',
        JSON.stringify(request.requestedChanges || []),
        request.customerSignatureUrl || '',
        createdBy
      ]);

      // Update quotation customer response status
      await client.query(`
        UPDATE quotations 
        SET customer_response_status = $1, 
            customer_approved_at = $2,
            customer_signature_url = $3,
            updated_at = NOW()
        WHERE id = $4
      `, [
        request.responseType,
        request.responseType === 'approved' ? new Date() : null,
        request.customerSignatureUrl || '',
        request.quotationId
      ]);

      await client.query('COMMIT');
      return this.mapToQuotationCustomerResponse(responseResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async extendValidity(request: ExtendQuotationValidityRequest, approvedBy: UUID): Promise<QuotationValidityTracking> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update validity tracking
      const validityResult = await client.query(`
        UPDATE quotation_validity_tracking 
        SET extended_expiry_date = $1, extension_reason = $2, 
            extension_approved_by = $3, status = 'extended', updated_at = NOW()
        WHERE quotation_id = $4
        RETURNING *
      `, [request.newExpiryDate, request.extensionReason, approvedBy, request.quotationId]);

      // Update quotation expiry date
      await client.query(`
        UPDATE quotations 
        SET expiry_date = $1, updated_at = NOW()
        WHERE id = $2
      `, [request.newExpiryDate, request.quotationId]);

      await client.query('COMMIT');
      return this.mapToQuotationValidityTracking(validityResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getExpiringQuotations(daysAhead: number = 7): Promise<EnhancedQuotation[]> {
    const result = await this.db.query(`
      SELECT q.* FROM quotations q
      JOIN quotation_validity_tracking vt ON q.id = vt.quotation_id
      WHERE vt.status = 'active' 
        AND q.expiry_date <= CURRENT_DATE + INTERVAL '${daysAhead} days'
        AND q.status NOT IN ('expired', 'cancelled', 'superseded')
      ORDER BY q.expiry_date ASC
    `);

    return result.rows.map(row => this.mapToEnhancedQuotation(row));
  }

  private performQuotationComparison(quotations: EnhancedQuotation[], criteria: any): any {
    // Implement comparison logic based on criteria
    const summary = {
      totalQuotations: quotations.length,
      lowestCost: Math.min(...quotations.map(q => q.finalAmount)),
      highestCost: Math.max(...quotations.map(q => q.finalAmount)),
      averageCost: quotations.reduce((sum, q) => sum + q.finalAmount, 0) / quotations.length,
      recommendedQuotationId: quotations.sort((a, b) => a.finalAmount - b.finalAmount)[0]?.id
    };

    const details = quotations.map(q => ({
      quotationId: q.id,
      quotationNumber: q.quotationNumber,
      totalAmount: q.finalAmount,
      lineItemCount: q.lineItems.length,
      score: this.calculateQuotationScore(q, criteria),
      pros: this.getQuotationPros(q, quotations),
      cons: this.getQuotationCons(q, quotations)
    }));

    const recommendations = this.generateRecommendations(quotations, summary);

    return { summary, details, recommendations };
  }

  private calculateQuotationScore(quotation: EnhancedQuotation, criteria: any): number {
    // Simple scoring algorithm - can be enhanced based on requirements
    let score = 100;
    
    // Price factor (lower is better)
    const avgPrice = criteria.averagePrice || quotation.finalAmount;
    if (quotation.finalAmount > avgPrice) {
      score -= (quotation.finalAmount - avgPrice) / avgPrice * 20;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private getQuotationPros(quotation: EnhancedQuotation, allQuotations: EnhancedQuotation[]): string[] {
    const pros: string[] = [];
    const avgAmount = allQuotations.reduce((sum, q) => sum + q.finalAmount, 0) / allQuotations.length;
    
    if (quotation.finalAmount < avgAmount) {
      pros.push('Below average cost');
    }
    
    if (quotation.lineItems.length > 0) {
      pros.push('Detailed breakdown provided');
    }
    
    return pros;
  }

  private getQuotationCons(quotation: EnhancedQuotation, allQuotations: EnhancedQuotation[]): string[] {
    const cons: string[] = [];
    const avgAmount = allQuotations.reduce((sum, q) => sum + q.finalAmount, 0) / allQuotations.length;
    
    if (quotation.finalAmount > avgAmount * 1.2) {
      cons.push('Significantly above average cost');
    }
    
    return cons;
  }

  private generateRecommendations(quotations: EnhancedQuotation[], summary: any): any[] {
    const recommendations: any[] = [];
    
    if (summary.highestCost - summary.lowestCost > summary.averageCost * 0.3) {
      recommendations.push({
        type: 'cost_saving',
        message: 'Significant cost variation detected. Consider negotiating with higher-priced vendors.',
        potentialSavings: summary.highestCost - summary.lowestCost
      });
    }
    
    return recommendations;
  }

  private mapToEnhancedQuotation(row: any): EnhancedQuotation {
    return {
      id: row.id,
      documentId: row.document_id,
      quotationNumber: row.quotation_number,
      revisionNumber: row.revision_number || 1,
      parentQuotationId: row.parent_quotation_id,
      status: row.status || 'draft',
      lineItems: JSON.parse(row.line_items || '[]'),
      totalAmount: parseFloat(row.total_amount || '0'),
      discountAmount: parseFloat(row.discount_amount || '0'),
      taxAmount: parseFloat(row.tax_amount || '0'),
      finalAmount: parseFloat(row.final_amount || row.total_amount || '0'),
      currency: row.currency || 'VND',
      validityPeriod: row.validity_period || 30,
      expiryDate: row.expiry_date,
      termsConditions: row.terms_conditions || '',
      approvalStatus: row.approval_status || 'pending',
      customerResponseStatus: row.customer_response_status || 'pending',
      customerApprovedAt: row.customer_approved_at,
      customerSignatureUrl: row.customer_signature_url,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToQuotationRevision(row: any): QuotationRevision {
    return {
      id: row.id,
      quotationId: row.quotation_id,
      revisionNumber: row.revision_number,
      lineItems: JSON.parse(row.line_items || '[]'),
      totalAmount: parseFloat(row.total_amount || '0'),
      currency: row.currency || 'VND',
      validityPeriod: row.validity_period || 30,
      termsConditions: row.terms_conditions || '',
      revisionReason: row.revision_reason || '',
      createdBy: row.created_by,
      createdAt: row.created_at
    };
  }

  private mapToQuotationComparison(row: any): QuotationComparison {
    return {
      id: row.id,
      caseId: row.case_id,
      name: row.name,
      description: row.description,
      quotationIds: JSON.parse(row.quotation_ids || '[]'),
      comparisonCriteria: JSON.parse(row.comparison_criteria || '{}'),
      comparisonResult: JSON.parse(row.comparison_result || '{}'),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToQuotationApproval(row: any): QuotationApproval {
    return {
      id: row.id,
      quotationId: row.quotation_id,
      approvalLevel: row.approval_level,
      approverRole: row.approver_role,
      approverUserId: row.approver_user_id,
      status: row.status,
      comments: row.comments,
      approvedAt: row.approved_at,
      createdAt: row.created_at
    };
  }

  private mapToQuotationCustomerResponse(row: any): QuotationCustomerResponse {
    return {
      id: row.id,
      quotationId: row.quotation_id,
      responseType: row.response_type,
      customerComments: row.customer_comments,
      requestedChanges: JSON.parse(row.requested_changes || '[]'),
      responseDate: row.response_date,
      customerSignatureUrl: row.customer_signature_url,
      createdBy: row.created_by,
      createdAt: row.created_at
    };
  }

  private mapToQuotationValidityTracking(row: any): QuotationValidityTracking {
    return {
      id: row.id,
      quotationId: row.quotation_id,
      originalExpiryDate: row.original_expiry_date,
      extendedExpiryDate: row.extended_expiry_date,
      extensionReason: row.extension_reason,
      extensionApprovedBy: row.extension_approved_by,
      notificationSentDates: JSON.parse(row.notification_sent_dates || '[]'),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}