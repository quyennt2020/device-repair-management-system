import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create maintenance_checklist_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_checklist_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        device_type_id UUID NOT NULL,
        maintenance_type VARCHAR(50) NOT NULL CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency')),
        version VARCHAR(50) NOT NULL DEFAULT '1.0',
        is_active BOOLEAN NOT NULL DEFAULT true,
        estimated_duration_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        required_tools UUID[] DEFAULT '{}',
        required_parts UUID[] DEFAULT '{}',
        safety_requirements TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        updated_by UUID,
        
        CONSTRAINT fk_maintenance_template_device_type 
          FOREIGN KEY (device_type_id) REFERENCES device_types(id) ON DELETE CASCADE,
        CONSTRAINT unique_template_device_type_maintenance_version 
          UNIQUE (device_type_id, maintenance_type, version)
      );
    `);

    // Create checklist_template_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS checklist_template_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('visual', 'measurement', 'test', 'adjustment', 'replacement')),
        required BOOLEAN NOT NULL DEFAULT false,
        order_index INTEGER NOT NULL,
        expected_value VARCHAR(255),
        tolerance VARCHAR(100),
        instructions TEXT,
        safety_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_checklist_item_template 
          FOREIGN KEY (template_id) REFERENCES maintenance_checklist_templates(id) ON DELETE CASCADE,
        CONSTRAINT unique_template_order 
          UNIQUE (template_id, order_index)
      );
    `);

    // Create maintenance_reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL,
        maintenance_type VARCHAR(50) NOT NULL CHECK (maintenance_type IN ('preventive', 'corrective', 'emergency')),
        checklist_template_id UUID NOT NULL,
        overall_condition VARCHAR(50) CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor', 'critical')),
        next_maintenance_date DATE,
        maintenance_frequency_months INTEGER,
        actual_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
        technician_notes TEXT,
        customer_feedback TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID,
        updated_by UUID,
        
        CONSTRAINT fk_maintenance_report_document 
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        CONSTRAINT fk_maintenance_report_template 
          FOREIGN KEY (checklist_template_id) REFERENCES maintenance_checklist_templates(id),
        CONSTRAINT unique_maintenance_report_document 
          UNIQUE (document_id)
      );
    `);

    // Create maintenance_checklist_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_checklist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        maintenance_report_id UUID NOT NULL,
        item_id VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('visual', 'measurement', 'test', 'adjustment', 'replacement')),
        required BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pass', 'fail', 'na', 'pending')),
        actual_value VARCHAR(255),
        expected_value VARCHAR(255),
        notes TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        completed_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_maintenance_checklist_item_report 
          FOREIGN KEY (maintenance_report_id) REFERENCES maintenance_reports(id) ON DELETE CASCADE,
        CONSTRAINT unique_maintenance_checklist_item 
          UNIQUE (maintenance_report_id, item_id)
      );
    `);

    // Create maintenance_checklist_item_images table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_checklist_item_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        checklist_item_id UUID NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        caption TEXT,
        image_type VARCHAR(50) CHECK (image_type IN ('before', 'during', 'after')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_checklist_item_image 
          FOREIGN KEY (checklist_item_id) REFERENCES maintenance_checklist_items(id) ON DELETE CASCADE
      );
    `);

    // Create maintenance_recommendations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        maintenance_report_id UUID NOT NULL,
        priority VARCHAR(50) NOT NULL CHECK (priority IN ('immediate', 'high', 'medium', 'low')),
        category VARCHAR(50) NOT NULL CHECK (category IN ('safety', 'performance', 'efficiency', 'compliance')),
        description TEXT NOT NULL,
        estimated_cost DECIMAL(12,2),
        estimated_hours DECIMAL(5,2),
        due_date DATE,
        part_ids UUID[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_maintenance_recommendation_report 
          FOREIGN KEY (maintenance_report_id) REFERENCES maintenance_reports(id) ON DELETE CASCADE
      );
    `);

    // Create maintenance_materials_used table
    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance_materials_used (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        maintenance_report_id UUID NOT NULL,
        material_id UUID NOT NULL,
        material_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit_cost DECIMAL(12,2) NOT NULL,
        total_cost DECIMAL(12,2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_maintenance_material_report 
          FOREIGN KEY (maintenance_report_id) REFERENCES maintenance_reports(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_templates_device_type 
        ON maintenance_checklist_templates(device_type_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_templates_maintenance_type 
        ON maintenance_checklist_templates(maintenance_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_templates_active 
        ON maintenance_checklist_templates(is_active);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template 
        ON checklist_template_items(template_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_checklist_template_items_order 
        ON checklist_template_items(template_id, order_index);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_reports_document 
        ON maintenance_reports(document_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_reports_template 
        ON maintenance_reports(checklist_template_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_reports_condition 
        ON maintenance_reports(overall_condition);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_reports_next_date 
        ON maintenance_reports(next_maintenance_date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_checklist_items_report 
        ON maintenance_checklist_items(maintenance_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_checklist_items_status 
        ON maintenance_checklist_items(status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_checklist_items_completed 
        ON maintenance_checklist_items(completed_at, completed_by);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_recommendations_report 
        ON maintenance_recommendations(maintenance_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_recommendations_priority 
        ON maintenance_recommendations(priority);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_recommendations_due_date 
        ON maintenance_recommendations(due_date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_maintenance_materials_report 
        ON maintenance_materials_used(maintenance_report_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Maintenance report tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating maintenance report tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Drop tables in reverse order due to foreign key constraints
    await client.query('DROP TABLE IF EXISTS maintenance_materials_used CASCADE');
    await client.query('DROP TABLE IF EXISTS maintenance_recommendations CASCADE');
    await client.query('DROP TABLE IF EXISTS maintenance_checklist_item_images CASCADE');
    await client.query('DROP TABLE IF EXISTS maintenance_checklist_items CASCADE');
    await client.query('DROP TABLE IF EXISTS maintenance_reports CASCADE');
    await client.query('DROP TABLE IF EXISTS checklist_template_items CASCADE');
    await client.query('DROP TABLE IF EXISTS maintenance_checklist_templates CASCADE');

    await client.query('COMMIT');
    console.log('✅ Maintenance report tables dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping maintenance report tables:', error);
    throw error;
  } finally {
    client.release();
  }
}