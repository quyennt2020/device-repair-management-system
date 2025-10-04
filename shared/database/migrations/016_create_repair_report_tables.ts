import { Pool } from 'pg';

export async function up(db: Pool): Promise<void> {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    // Create repair_reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        actual_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
        technician_notes TEXT NOT NULL,
        customer_satisfaction_rating INTEGER CHECK (customer_satisfaction_rating >= 1 AND customer_satisfaction_rating <= 5),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID,
        updated_by UUID,
        
        CONSTRAINT unique_repair_report_per_document UNIQUE (document_id)
      );
    `);

    // Create repair_report_parts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_report_parts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_report_id UUID NOT NULL REFERENCES repair_reports(id) ON DELETE CASCADE,
        part_id UUID NOT NULL,
        part_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        serial_numbers JSONB DEFAULT '[]',
        old_part_condition TEXT,
        replacement_reason TEXT NOT NULL,
        warranty_months INTEGER NOT NULL DEFAULT 0 CHECK (warranty_months >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create repair_report_procedures table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_report_procedures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_report_id UUID NOT NULL REFERENCES repair_reports(id) ON DELETE CASCADE,
        procedure_type VARCHAR(50) NOT NULL CHECK (
          procedure_type IN ('calibration', 'adjustment', 'cleaning', 'testing', 'repair', 'replacement')
        ),
        description TEXT NOT NULL,
        duration DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (duration >= 0),
        result VARCHAR(20) NOT NULL CHECK (result IN ('successful', 'partial', 'failed')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create repair_report_tests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_report_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_report_id UUID NOT NULL REFERENCES repair_reports(id) ON DELETE CASCADE,
        test_name VARCHAR(255) NOT NULL,
        expected_value TEXT NOT NULL,
        actual_value TEXT NOT NULL,
        result VARCHAR(10) NOT NULL CHECK (result IN ('pass', 'fail')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create repair_report_images table
    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_report_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_report_id UUID NOT NULL REFERENCES repair_reports(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        caption TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        image_type VARCHAR(20) NOT NULL CHECK (image_type IN ('before', 'during', 'after')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create repair_report_feedback table for detailed customer satisfaction
    await client.query(`
      CREATE TABLE IF NOT EXISTS repair_report_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_report_id UUID NOT NULL REFERENCES repair_reports(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comments TEXT,
        would_recommend BOOLEAN DEFAULT NULL,
        service_aspects JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        CONSTRAINT unique_feedback_per_repair_report UNIQUE (repair_report_id)
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_reports_document_id ON repair_reports(document_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_reports_created_at ON repair_reports(created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_reports_satisfaction_rating ON repair_reports(customer_satisfaction_rating);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_parts_repair_report_id ON repair_report_parts(repair_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_parts_part_id ON repair_report_parts(part_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_procedures_repair_report_id ON repair_report_procedures(repair_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_procedures_type ON repair_report_procedures(procedure_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_tests_repair_report_id ON repair_report_tests(repair_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_tests_result ON repair_report_tests(result);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_images_repair_report_id ON repair_report_images(repair_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_images_type ON repair_report_images(image_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_feedback_repair_report_id ON repair_report_feedback(repair_report_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_report_feedback_rating ON repair_report_feedback(rating);
    `);

    // Add triggers for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_repair_reports_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_repair_reports_updated_at ON repair_reports;
      CREATE TRIGGER trigger_repair_reports_updated_at
        BEFORE UPDATE ON repair_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_repair_reports_updated_at();
    `);

    await client.query('COMMIT');
    console.log('✅ Repair report tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating repair report tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down(db: Pool): Promise<void> {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    // Drop triggers and functions
    await client.query('DROP TRIGGER IF EXISTS trigger_repair_reports_updated_at ON repair_reports;');
    await client.query('DROP FUNCTION IF EXISTS update_repair_reports_updated_at();');

    // Drop tables in reverse order (due to foreign key constraints)
    await client.query('DROP TABLE IF EXISTS repair_report_feedback CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_report_images CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_report_tests CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_report_procedures CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_report_parts CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_reports CASCADE;');

    await client.query('COMMIT');
    console.log('✅ Repair report tables dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error dropping repair report tables:', error);
    throw error;
  } finally {
    client.release();
  }
}