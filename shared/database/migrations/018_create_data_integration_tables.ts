import { Pool } from 'pg'

export async function up(db: Pool): Promise<void> {
  // Import/Export requests tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS import_requests (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      format VARCHAR(20) NOT NULL,
      source JSONB NOT NULL,
      mapping JSONB NOT NULL,
      options JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      error_message TEXT,
      total_records INTEGER,
      processed_records INTEGER,
      successful_records INTEGER,
      failed_records INTEGER
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_import_requests_status ON import_requests(status)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_import_requests_created_by ON import_requests(created_by)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_import_requests_created_at ON import_requests(created_at)
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS export_requests (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      format VARCHAR(20) NOT NULL,
      filters JSONB NOT NULL,
      fields JSONB NOT NULL,
      options JSONB NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      file_url VARCHAR(500),
      file_size BIGINT,
      record_count INTEGER,
      error_message TEXT
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_export_requests_status ON export_requests(status)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_export_requests_created_by ON export_requests(created_by)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_export_requests_created_at ON export_requests(created_at)
  `)

  // Sync configurations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_configurations (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      source_system JSONB NOT NULL,
      target_system JSONB NOT NULL,
      sync_type VARCHAR(20) NOT NULL,
      schedule JSONB NOT NULL,
      mapping JSONB NOT NULL,
      filters JSONB NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_sync_at TIMESTAMP WITH TIME ZONE,
      next_sync_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_configurations_is_active ON sync_configurations(is_active)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_configurations_next_sync ON sync_configurations(next_sync_at)
  `)

  // Sync history table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sync_history (
      id VARCHAR(255) PRIMARY KEY,
      configuration_id VARCHAR(255) NOT NULL REFERENCES sync_configurations(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      records_processed INTEGER DEFAULT 0,
      records_updated INTEGER DEFAULT 0,
      records_created INTEGER DEFAULT 0,
      records_failed INTEGER DEFAULT 0,
      errors JSONB,
      duration INTEGER,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_history_config_id ON sync_history(configuration_id)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON sync_history(started_at)
  `)

  // Backup configurations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS backup_configurations (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      schedule JSONB NOT NULL,
      retention_days INTEGER NOT NULL DEFAULT 30,
      include_files BOOLEAN NOT NULL DEFAULT false,
      compression BOOLEAN NOT NULL DEFAULT true,
      encryption BOOLEAN NOT NULL DEFAULT false,
      storage_location JSONB NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_backup_at TIMESTAMP WITH TIME ZONE,
      next_backup_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backup_configurations_is_active ON backup_configurations(is_active)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backup_configurations_next_backup ON backup_configurations(next_backup_at)
  `)

  // Backup records table
  await db.query(`
    CREATE TABLE IF NOT EXISTS backup_records (
      id VARCHAR(255) PRIMARY KEY,
      configuration_id VARCHAR(255) NOT NULL REFERENCES backup_configurations(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL,
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      file_size BIGINT,
      record_count INTEGER,
      file_path VARCHAR(1000),
      error_message TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backup_records_config_id ON backup_records(configuration_id)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backup_records_status ON backup_records(status)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_backup_records_started_at ON backup_records(started_at)
  `)

  // External systems table for sync configurations
  await db.query(`
    CREATE TABLE IF NOT EXISTS external_systems (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL,
      connection JSONB NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_external_systems_type ON external_systems(type)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_external_systems_is_active ON external_systems(is_active)
  `)

  // Data mapping templates table
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_mapping_templates (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      source_type VARCHAR(50) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      mapping JSONB NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_data_mapping_templates_source_target ON data_mapping_templates(source_type, target_type)
  `)

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_data_mapping_templates_is_active ON data_mapping_templates(is_active)
  `)

  console.log('Data integration tables created successfully')
}

export async function down(db: Pool): Promise<void> {
  await db.query('DROP TABLE IF EXISTS data_mapping_templates CASCADE')
  await db.query('DROP TABLE IF EXISTS external_systems CASCADE')
  await db.query('DROP TABLE IF EXISTS backup_records CASCADE')
  await db.query('DROP TABLE IF EXISTS backup_configurations CASCADE')
  await db.query('DROP TABLE IF EXISTS sync_history CASCADE')
  await db.query('DROP TABLE IF EXISTS sync_configurations CASCADE')
  await db.query('DROP TABLE IF EXISTS export_requests CASCADE')
  await db.query('DROP TABLE IF EXISTS import_requests CASCADE')
  
  console.log('Data integration tables dropped successfully')
}