import { Migration } from '../src/migrations';

export const enhanceQuotationManagement: Migration = {
  id: '015',
  name: 'Enhance quotation management with revisions, comparisons, and workflow',
  
  async up(client) {
    // Quotation Revisions for version history
    await client.query(`
      CREATE TABLE quotation_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID REFERENCES quotations(id),
        revision_number INTEGER NOT NULL,
        line_items JSONB NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'VND',
        validity_period INTEGER DEFAULT 30,
        terms_conditions TEXT,
        revision_reason TEXT,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(quotation_id, revision_number)
      );
    `);

    // Quotation Comparisons for tracking different versions
    await client.query(`
      CREATE TABLE quotation_comparisons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        quotation_ids JSONB NOT NULL, /* Array of quotation IDs being compared */
        comparison_criteria JSONB, /* Criteria used for comparison */
        comparison_result JSONB, /* Results of the comparison */
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Quotation Approval Workflow
    await client.query(`
      CREATE TABLE quotation_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID REFERENCES quotations(id),
        approval_level INTEGER NOT NULL,
        approver_role VARCHAR(50) NOT NULL,
        approver_user_id UUID,
        status VARCHAR(50) DEFAULT 'pending',
        comments TEXT,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(quotation_id, approval_level)
      );
    `);

    // Customer Quotation Responses
    await client.query(`
      CREATE TABLE quotation_customer_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID REFERENCES quotations(id),
        response_type VARCHAR(50) NOT NULL, /* 'approved', 'rejected', 'requested_changes' */
        customer_comments TEXT,
        requested_changes JSONB,
        response_date TIMESTAMP DEFAULT NOW(),
        customer_signature_url VARCHAR(500),
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Quotation Validity Tracking
    await client.query(`
      CREATE TABLE quotation_validity_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID REFERENCES quotations(id),
        original_expiry_date DATE NOT NULL,
        extended_expiry_date DATE,
        extension_reason TEXT,
        extension_approved_by UUID,
        notification_sent_dates JSONB DEFAULT '[]', /* Array of dates when notifications were sent */
        status VARCHAR(50) DEFAULT 'active', /* 'active', 'expired', 'extended', 'cancelled' */
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Quotation Line Item Details (enhanced)
    await client.query(`
      CREATE TABLE quotation_line_item_details (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quotation_id UUID REFERENCES quotations(id),
        line_item_id VARCHAR(50) NOT NULL, /* Reference to line item in JSONB */
        part_id UUID, /* Reference to inventory parts */
        labor_category VARCHAR(100),
        markup_percentage DECIMAL(5,2) DEFAULT 0,
        discount_percentage DECIMAL(5,2) DEFAULT 0,
        tax_rate DECIMAL(5,2) DEFAULT 0,
        warranty_months INTEGER DEFAULT 0,
        supplier_quote_reference VARCHAR(255),
        cost_breakdown JSONB, /* Detailed cost breakdown */
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add new columns to existing quotations table
    await client.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS parent_quotation_id UUID REFERENCES quotations(id),
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS expiry_date DATE,
      ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS final_amount DECIMAL(15,2),
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS customer_response_status VARCHAR(50) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_by UUID,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX idx_quotation_revisions_quotation_id ON quotation_revisions(quotation_id);
      CREATE INDEX idx_quotation_revisions_revision_number ON quotation_revisions(revision_number);
      CREATE INDEX idx_quotation_revisions_created_by ON quotation_revisions(created_by);
      
      CREATE INDEX idx_quotation_comparisons_case_id ON quotation_comparisons(case_id);
      CREATE INDEX idx_quotation_comparisons_created_by ON quotation_comparisons(created_by);
      
      CREATE INDEX idx_quotation_approvals_quotation_id ON quotation_approvals(quotation_id);
      CREATE INDEX idx_quotation_approvals_status ON quotation_approvals(status);
      CREATE INDEX idx_quotation_approvals_approver ON quotation_approvals(approver_user_id);
      
      CREATE INDEX idx_quotation_customer_responses_quotation_id ON quotation_customer_responses(quotation_id);
      CREATE INDEX idx_quotation_customer_responses_type ON quotation_customer_responses(response_type);
      
      CREATE INDEX idx_quotation_validity_quotation_id ON quotation_validity_tracking(quotation_id);
      CREATE INDEX idx_quotation_validity_status ON quotation_validity_tracking(status);
      CREATE INDEX idx_quotation_validity_expiry ON quotation_validity_tracking(original_expiry_date);
      
      CREATE INDEX idx_quotation_line_details_quotation_id ON quotation_line_item_details(quotation_id);
      CREATE INDEX idx_quotation_line_details_part_id ON quotation_line_item_details(part_id);
      
      CREATE INDEX idx_quotations_number ON quotations(quotation_number);
      CREATE INDEX idx_quotations_status ON quotations(status);
      CREATE INDEX idx_quotations_expiry_date ON quotations(expiry_date);
      CREATE INDEX idx_quotations_parent_id ON quotations(parent_quotation_id);
      CREATE INDEX idx_quotations_approval_status ON quotations(approval_status);
      CREATE INDEX idx_quotations_customer_response ON quotations(customer_response_status);
    `);

    // Create function to generate quotation number
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_quotation_number()
      RETURNS TEXT AS $$
      DECLARE
        year_part TEXT;
        sequence_num INTEGER;
        quotation_number TEXT;
      BEGIN
        year_part := TO_CHAR(NOW(), 'YYYY');
        
        SELECT COALESCE(MAX(CAST(SUBSTRING(quotation_number FROM 'QT-' || year_part || '-(.*)') AS INTEGER)), 0) + 1
        INTO sequence_num
        FROM quotations
        WHERE quotation_number LIKE 'QT-' || year_part || '-%';
        
        quotation_number := 'QT-' || year_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
        
        RETURN quotation_number;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-generate quotation number
    await client.query(`
      CREATE OR REPLACE FUNCTION set_quotation_number()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.quotation_number IS NULL THEN
          NEW.quotation_number := generate_quotation_number();
        END IF;
        
        /* Calculate final amount */
        NEW.final_amount := NEW.total_amount - COALESCE(NEW.discount_amount, 0) + COALESCE(NEW.tax_amount, 0);

        /* Set expiry date if not provided */
        IF NEW.expiry_date IS NULL THEN
          NEW.expiry_date := CURRENT_DATE + INTERVAL '1 day' * COALESCE(NEW.validity_period, 30);
        END IF;
        
        NEW.updated_at := NOW();
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      CREATE TRIGGER trigger_set_quotation_number
        BEFORE INSERT OR UPDATE ON quotations
        FOR EACH ROW
        EXECUTE FUNCTION set_quotation_number();
    `);
  },

  async down(client) {
    await client.query('DROP TRIGGER IF EXISTS trigger_set_quotation_number ON quotations;');
    await client.query('DROP FUNCTION IF EXISTS set_quotation_number();');
    await client.query('DROP FUNCTION IF EXISTS generate_quotation_number();');
    
    await client.query('DROP TABLE IF EXISTS quotation_line_item_details CASCADE;');
    await client.query('DROP TABLE IF EXISTS quotation_validity_tracking CASCADE;');
    await client.query('DROP TABLE IF EXISTS quotation_customer_responses CASCADE;');
    await client.query('DROP TABLE IF EXISTS quotation_approvals CASCADE;');
    await client.query('DROP TABLE IF EXISTS quotation_comparisons CASCADE;');
    await client.query('DROP TABLE IF EXISTS quotation_revisions CASCADE;');
    
    await client.query(`
      ALTER TABLE quotations 
      DROP COLUMN IF EXISTS quotation_number,
      DROP COLUMN IF EXISTS revision_number,
      DROP COLUMN IF EXISTS parent_quotation_id,
      DROP COLUMN IF EXISTS status,
      DROP COLUMN IF EXISTS expiry_date,
      DROP COLUMN IF EXISTS discount_amount,
      DROP COLUMN IF EXISTS tax_amount,
      DROP COLUMN IF EXISTS final_amount,
      DROP COLUMN IF EXISTS approval_status,
      DROP COLUMN IF EXISTS customer_response_status,
      DROP COLUMN IF EXISTS notes,
      DROP COLUMN IF EXISTS created_by,
      DROP COLUMN IF EXISTS updated_at;
    `);
  }
};