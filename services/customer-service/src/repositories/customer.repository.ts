import { Pool, PoolClient } from 'pg';
import { 
  Customer, 
  CreateCustomerRequest, 
  UpdateCustomerRequest, 
  CustomerSearchCriteria, 
  CustomerSearchResult,
  CustomerHistory,
  CustomerMetrics,
  CustomerPreferences,
  CustomerContact,
  CustomerAddress,
  UUID
} from '../../../shared/types/src/customer';

export class CustomerRepository {
  constructor(private db: Pool) {}

  async create(request: CreateCustomerRequest): Promise<Customer> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Insert customer
      const customerQuery = `
        INSERT INTO customers (
          customer_code, customer_type, company_name, tax_code, industry,
          contact_info, address_info, credit_limit, payment_terms, 
          customer_tier, account_manager_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const customerResult = await client.query(customerQuery, [
        request.customerCode,
        request.customerType,
        request.companyName,
        request.taxCode,
        request.industry,
        JSON.stringify(request.contactInfo),
        JSON.stringify(request.addressInfo),
        request.creditLimit,
        request.paymentTerms,
        request.customerTier || 'bronze',
        request.accountManagerId
      ]);

      const customer = this.mapRowToCustomer(customerResult.rows[0]);

      // Log customer creation event
      await this.createHistoryEntry(client, customer.id, 'created', 'Customer profile created', customer.createdBy);

      await client.query('COMMIT');
      return customer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: UUID): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCustomer(result.rows[0]);
  }

  async findByCode(customerCode: string): Promise<Customer | null> {
    const query = 'SELECT * FROM customers WHERE customer_code = $1';
    const result = await this.db.query(query, [customerCode]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToCustomer(result.rows[0]);
  }

  async update(id: UUID, request: UpdateCustomerRequest, updatedBy: UUID): Promise<Customer> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Get current customer for comparison
      const currentCustomer = await this.findById(id);
      if (!currentCustomer) {
        throw new Error('Customer not found');
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (request.companyName !== undefined) {
        updateFields.push(`company_name = $${paramIndex++}`);
        updateValues.push(request.companyName);
      }
      if (request.taxCode !== undefined) {
        updateFields.push(`tax_code = $${paramIndex++}`);
        updateValues.push(request.taxCode);
      }
      if (request.industry !== undefined) {
        updateFields.push(`industry = $${paramIndex++}`);
        updateValues.push(request.industry);
      }
      if (request.contactInfo !== undefined) {
        updateFields.push(`contact_info = $${paramIndex++}`);
        updateValues.push(JSON.stringify({ ...currentCustomer.contactInfo, ...request.contactInfo }));
      }
      if (request.creditLimit !== undefined) {
        updateFields.push(`credit_limit = $${paramIndex++}`);
        updateValues.push(request.creditLimit);
      }
      if (request.paymentTerms !== undefined) {
        updateFields.push(`payment_terms = $${paramIndex++}`);
        updateValues.push(request.paymentTerms);
      }
      if (request.customerTier !== undefined) {
        updateFields.push(`customer_tier = $${paramIndex++}`);
        updateValues.push(request.customerTier);
        
        // Log tier change
        if (currentCustomer.customerTier !== request.customerTier) {
          await this.createHistoryEntry(
            client, 
            id, 
            'tier_changed', 
            `Customer tier changed from ${currentCustomer.customerTier} to ${request.customerTier}`,
            updatedBy
          );
        }
      }
      if (request.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(request.status);
        
        // Log status change
        if (currentCustomer.status !== request.status) {
          await this.createHistoryEntry(
            client, 
            id, 
            'status_changed', 
            `Customer status changed from ${currentCustomer.status} to ${request.status}`,
            updatedBy
          );
        }
      }
      if (request.accountManagerId !== undefined) {
        updateFields.push(`account_manager_id = $${paramIndex++}`);
        updateValues.push(request.accountManagerId);
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id);

      const query = `
        UPDATE customers 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, updateValues);
      const updatedCustomer = this.mapRowToCustomer(result.rows[0]);

      // Log update event
      await this.createHistoryEntry(client, id, 'updated', 'Customer profile updated', updatedBy);

      await client.query('COMMIT');
      return updatedCustomer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(criteria: CustomerSearchCriteria, page: number = 1, limit: number = 20): Promise<CustomerSearchResult> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.query) {
      conditions.push(`(
        customer_code ILIKE $${paramIndex} OR 
        company_name ILIKE $${paramIndex} OR 
        contact_info->>'name' ILIKE $${paramIndex}
      )`);
      values.push(`%${criteria.query}%`);
      paramIndex++;
    }

    if (criteria.customerType) {
      conditions.push(`customer_type = $${paramIndex++}`);
      values.push(criteria.customerType);
    }

    if (criteria.customerTier) {
      conditions.push(`customer_tier = $${paramIndex++}`);
      values.push(criteria.customerTier);
    }

    if (criteria.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(criteria.status);
    }

    if (criteria.industry) {
      conditions.push(`industry = $${paramIndex++}`);
      values.push(criteria.industry);
    }

    if (criteria.accountManagerId) {
      conditions.push(`account_manager_id = $${paramIndex++}`);
      values.push(criteria.accountManagerId);
    }

    if (criteria.createdDateFrom) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(criteria.createdDateFrom);
    }

    if (criteria.createdDateTo) {
      conditions.push(`created_at <= $${paramIndex++}`);
      values.push(criteria.createdDateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM customers ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get customers
    const customersQuery = `
      SELECT * FROM customers 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(limit, offset);

    const customersResult = await this.db.query(customersQuery, values);
    const customers = customersResult.rows.map(row => this.mapRowToCustomer(row));

    return {
      customers,
      total,
      page,
      limit
    };
  }

  async getHistory(customerId: UUID): Promise<CustomerHistory[]> {
    const query = `
      SELECT * FROM customer_history 
      WHERE customer_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await this.db.query(query, [customerId]);
    return result.rows.map(row => this.mapRowToHistory(row));
  }

  async getMetrics(customerId: UUID): Promise<CustomerMetrics> {
    const query = `
      SELECT 
        c.id as customer_id,
        COUNT(rc.id) as total_cases,
        COUNT(CASE WHEN rc.status = 'completed' THEN 1 END) as completed_cases,
        AVG(EXTRACT(EPOCH FROM (rc.completed_at - rc.created_at))/3600) as avg_resolution_hours,
        COALESCE(SUM(rc.total_cost), 0) as total_revenue,
        AVG(rc.customer_satisfaction_rating) as avg_satisfaction_rating,
        MAX(rc.completed_at) as last_service_date,
        COUNT(DISTINCT sc.id) as contracts_count,
        COUNT(DISTINCT CASE WHEN sc.status = 'active' THEN sc.id END) as active_contracts_count
      FROM customers c
      LEFT JOIN repair_cases rc ON c.id = rc.customer_id
      LEFT JOIN service_contracts sc ON c.id = sc.customer_id
      WHERE c.id = $1
      GROUP BY c.id
    `;
    
    const result = await this.db.query(query, [customerId]);
    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }
    
    const row = result.rows[0];
    return {
      customerId,
      totalCases: parseInt(row.total_cases) || 0,
      completedCases: parseInt(row.completed_cases) || 0,
      averageResolutionTime: parseFloat(row.avg_resolution_hours) || 0,
      totalRevenue: parseFloat(row.total_revenue) || 0,
      averageSatisfactionRating: parseFloat(row.avg_satisfaction_rating) || 0,
      lastServiceDate: row.last_service_date,
      contractsCount: parseInt(row.contracts_count) || 0,
      activeContractsCount: parseInt(row.active_contracts_count) || 0
    };
  }

  private async createHistoryEntry(
    client: PoolClient, 
    customerId: UUID, 
    eventType: string, 
    description: string, 
    performedBy: UUID,
    relatedEntityId?: UUID,
    relatedEntityType?: string
  ): Promise<void> {
    const query = `
      INSERT INTO customer_history (
        customer_id, event_type, description, related_entity_id, 
        related_entity_type, performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await client.query(query, [
      customerId, eventType, description, relatedEntityId, 
      relatedEntityType, performedBy
    ]);
  }

  private mapRowToCustomer(row: any): Customer {
    return {
      id: row.id,
      customerCode: row.customer_code,
      customerType: row.customer_type,
      companyName: row.company_name,
      taxCode: row.tax_code,
      industry: row.industry,
      contactInfo: row.contact_info,
      addressInfo: row.address_info,
      creditLimit: row.credit_limit ? parseFloat(row.credit_limit) : undefined,
      paymentTerms: row.payment_terms,
      customerTier: row.customer_tier,
      status: row.status,
      accountManagerId: row.account_manager_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by || row.id, // fallback for existing data
      updatedBy: row.updated_by || row.id
    };
  }

  private mapRowToHistory(row: any): CustomerHistory {
    return {
      id: row.id,
      customerId: row.customer_id,
      eventType: row.event_type,
      description: row.description,
      relatedEntityId: row.related_entity_id,
      relatedEntityType: row.related_entity_type,
      performedBy: row.performed_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.performed_by,
      updatedBy: row.performed_by
    };
  }
}