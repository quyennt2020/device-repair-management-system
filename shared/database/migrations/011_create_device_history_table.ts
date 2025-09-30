import { Migration } from '../src/migrations';

export const createDeviceHistoryTable: Migration = {
  id: '011',
  name: 'Create device history table',
  
  async up(client) {
    // Device History table
    await client.query(`
      CREATE TABLE device_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        repair_case_id UUID,
        event_type VARCHAR(50) NOT NULL,
        event_date TIMESTAMP NOT NULL,
        description TEXT NOT NULL,
        performed_by UUID,
        next_action_date TIMESTAMP,
        cost DECIMAL(15,2),
        parts_used JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for device history
    await client.query(`
      CREATE INDEX idx_device_history_device_id ON device_history(device_id);
      CREATE INDEX idx_device_history_case_id ON device_history(repair_case_id);
      CREATE INDEX idx_device_history_event_type ON device_history(event_type);
      CREATE INDEX idx_device_history_event_date ON device_history(event_date);
      CREATE INDEX idx_device_history_performed_by ON device_history(performed_by);
    `);

    // Add check constraint for event_type
    await client.query(`
      ALTER TABLE device_history 
      ADD CONSTRAINT chk_device_history_event_type 
      CHECK (event_type IN ('service', 'repair', 'calibration', 'inspection', 'maintenance', 'installation', 'relocation', 'retirement'));
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS device_history CASCADE;');
  }
};