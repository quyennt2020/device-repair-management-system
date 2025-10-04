import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // SLA Definitions table already exists from migration 007
    // Add missing columns that migration 019 needs
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE sla_definitions ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE sla_definitions ADD COLUMN IF NOT EXISTS customer_tier VARCHAR(20);
        ALTER TABLE sla_definitions ADD COLUMN IF NOT EXISTS service_type VARCHAR(50);
        ALTER TABLE sla_definitions ADD COLUMN IF NOT EXISTS response_time_hours INTEGER;
        ALTER TABLE sla_definitions ADD COLUMN IF NOT EXISTS business_hours_only BOOLEAN DEFAULT true;
        ALTER TABLE sla_definitions ADD COLUMN IF NOT EXISTS penalty_rate DECIMAL(5,2);
      END $$;
    `);

    // SLA Metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sla_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sla_id UUID REFERENCES sla_definitions(id),
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_cases INTEGER DEFAULT 0,
        met_cases INTEGER DEFAULT 0,
        breached_cases INTEGER DEFAULT 0,
        compliance_rate DECIMAL(5,2) DEFAULT 0,
        avg_response_time_hours DECIMAL(8,2),
        avg_resolution_time_hours DECIMAL(8,2),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(sla_id, period_start, period_end)
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sla_definitions_tier ON sla_definitions(customer_tier);
      CREATE INDEX IF NOT EXISTS idx_sla_definitions_service_type ON sla_definitions(service_type);
      CREATE INDEX IF NOT EXISTS idx_sla_definitions_priority ON sla_definitions(priority);
      CREATE INDEX IF NOT EXISTS idx_sla_definitions_active ON sla_definitions(is_active);

      CREATE INDEX IF NOT EXISTS idx_sla_metrics_sla_id ON sla_metrics(sla_id);
      CREATE INDEX IF NOT EXISTS idx_sla_metrics_period ON sla_metrics(period_start, period_end);
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS sla_metrics CASCADE;');
    await client.query('DROP TABLE IF EXISTS sla_definitions CASCADE;');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
