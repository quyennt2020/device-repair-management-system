import { table } from 'console';
import { table } from 'console';
import { Migration } from '../src/migrations';

export const createDocumentTables: Migration = {
  id: '004',
  name: 'Create document management tables',
  
  async up(client) {
    // Document Types
    await client.query(`
      CREATE TABLE document_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        template_config JSONB NOT NULL,
        required_fields JSONB NOT NULL,
        approval_workflow_id UUID,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Documents
    await client.query(`
      CREATE TABLE documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id),
        document_type_id UUID REFERENCES document_types(id),
        step_execution_id UUID,
        status VARCHAR(50) DEFAULT 'draft',
        content JSONB NOT NULL,
        version INTEGER DEFAULT 1,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Document Approvals
    await client.query(`
      CREATE TABLE document_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id),
        approver_user_id UUID NOT NULL,
        approval_level INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        comments TEXT,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Attachments
    await client.query(`
      CREATE TABLE attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id),
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size BIGINT NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        uploaded_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    -- Auto-save table for draft functionality
    await client.query(`
      CREATE TABLE document_auto_saves (
        document_id UUID PRIMARY KEY REFERENCES documents(id),
        content JSONB NOT NULL,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Inspection Reports
    await client.query(`
      CREATE TABLE inspection_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id),
        findings JSONB NOT NULL,
        recommended_parts JSONB DEFAULT '[]',
        estimated_hours DECIMAL(5,2),
        severity_level VARCHAR(20),
        images JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Quotations
    await client.query(`
      CREATE TABLE quotations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id),
        line_items JSONB NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'VND',
        validity_period INTEGER DEFAULT 30,
        terms_conditions TEXT,
        customer_approved_at TIMESTAMP,
        customer_signature_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Repair Reports
    await client.query(`
      CREATE TABLE repair_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id),
        parts_replaced JSONB DEFAULT '[]',
        procedures_performed JSONB DEFAULT '[]',
        actual_hours DECIMAL(5,2),
        test_results JSONB DEFAULT '{}',
        technician_notes TEXT,
        before_images JSONB DEFAULT '[]',
        after_images JSONB DEFAULT '[]',
        customer_satisfaction_rating INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Maintenance Reports
    await client.query(`
      CREATE TABLE maintenance_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id),
        maintenance_type VARCHAR(50) NOT NULL,
        checklist_template_id UUID NOT NULL,
        checklist_items JSONB NOT NULL,
        overall_condition VARCHAR(20),
        recommendations JSONB DEFAULT '[]',
        next_maintenance_date DATE,
        maintenance_frequency_months INTEGER,
        actual_hours DECIMAL(5,2),
        materials_used JSONB DEFAULT '[]',
        technician_notes TEXT,
        customer_feedback TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Maintenance Checklist Templates
    await client.query(`
      CREATE TABLE maintenance_checklist_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        device_type_id UUID REFERENCES device_types(id),
        maintenance_type VARCHAR(50) NOT NULL,
        version VARCHAR(10) DEFAULT '1.0',
        is_active BOOLEAN DEFAULT true,
        checklist_items JSONB NOT NULL,
        estimated_duration_hours DECIMAL(4,2),
        required_tools JSONB DEFAULT '[]',
        required_parts JSONB DEFAULT '[]',
        safety_requirements JSONB DEFAULT '[]',
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_document_types_name ON document_types(name);
      CREATE INDEX idx_document_types_category ON document_types(category);
      
      CREATE INDEX idx_documents_case_id ON documents(case_id);
      CREATE INDEX idx_documents_type_id ON documents(document_type_id);
      CREATE INDEX idx_documents_status ON documents(status);
      CREATE INDEX idx_documents_step_execution ON documents(step_execution_id);
      
      CREATE INDEX idx_document_approvals_document_id ON document_approvals(document_id);
      CREATE INDEX idx_document_approvals_approver ON document_approvals(approver_user_id);
      CREATE INDEX idx_document_approvals_status ON document_approvals(status);
      
      CREATE INDEX idx_attachments_document_id ON attachments(document_id);
      CREATE INDEX idx_attachments_uploaded_by ON attachments(uploaded_by);
      
      CREATE INDEX idx_document_auto_saves_document_id ON document_auto_saves(document_id);
      
      CREATE INDEX idx_inspection_reports_document_id ON inspection_reports(document_id);
      CREATE INDEX idx_inspection_reports_severity ON inspection_reports(severity_level);
      
      CREATE INDEX idx_quotations_document_id ON quotations(document_id);
      CREATE INDEX idx_quotations_total_amount ON quotations(total_amount);
      CREATE INDEX idx_quotations_customer_approved ON quotations(customer_approved_at);
      
      CREATE INDEX idx_repair_reports_document_id ON repair_reports(document_id);
      CREATE INDEX idx_repair_reports_actual_hours ON repair_reports(actual_hours);
      
      CREATE INDEX idx_maintenance_reports_document_id ON maintenance_reports(document_id);
      CREATE INDEX idx_maintenance_reports_type ON maintenance_reports(maintenance_type);
      CREATE INDEX idx_maintenance_reports_template ON maintenance_reports(checklist_template_id);
      CREATE INDEX idx_maintenance_reports_next_date ON maintenance_reports(next_maintenance_date);
      
      CREATE INDEX idx_maintenance_templates_device_type ON maintenance_checklist_templates(device_type_id);
      CREATE INDEX idx_maintenance_templates_type ON maintenance_checklist_templates(maintenance_type);
      CREATE INDEX idx_maintenance_templates_active ON maintenance_checklist_templates(is_active);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS document_auto_saves CASCADE;');
    await client.query('DROP TABLE IF EXISTS attachments CASCADE;');
    await client.query('DROP TABLE IF EXISTS maintenance_checklist_templates CASCADE;');
    await client.query('DROP TABLE IF EXISTS maintenance_reports CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_reports CASCADE;');
    await client.query('DROP TABLE IF EXISTS quotations CASCADE;');
    await client.query('DROP TABLE IF EXISTS inspection_reports CASCADE;');
    await client.query('DROP TABLE IF EXISTS document_approvals CASCADE;');
    await client.query('DROP TABLE IF EXISTS documents CASCADE;');
    await client.query('DROP TABLE IF EXISTS document_types CASCADE;');
  }
};