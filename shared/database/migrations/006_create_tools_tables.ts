import { Migration } from '../src/migrations';

export const createToolsTables: Migration = {
  id: '006',
  name: 'Create service tools management tables',
  
  async up(client) {
    // Service Tools
    await client.query(`
      CREATE TABLE service_tools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tool_code VARCHAR(50) UNIQUE NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        manufacturer VARCHAR(100),
        model VARCHAR(100),
        serial_number VARCHAR(100),
        purchase_date DATE,
        purchase_cost DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'available',
        location VARCHAR(255),
        calibration_required BOOLEAN DEFAULT false,
        last_calibration_date DATE,
        next_calibration_date DATE,
        required_for_device_types JSONB DEFAULT '[]',
        specifications JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tool Assignments
    await client.query(`
      CREATE TABLE tool_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tool_id UUID REFERENCES service_tools(id),
        assigned_to_technician_id UUID REFERENCES technicians(id),
        assigned_to_case_id UUID REFERENCES repair_cases(id),
        checkout_date TIMESTAMP DEFAULT NOW(),
        expected_return_date TIMESTAMP,
        actual_return_date TIMESTAMP,
        condition_checkout VARCHAR(50) DEFAULT 'good',
        condition_return VARCHAR(50),
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tool Maintenance
    await client.query(`
      CREATE TABLE tool_maintenance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tool_id UUID REFERENCES service_tools(id),
        maintenance_type VARCHAR(50) NOT NULL,
        scheduled_date DATE,
        completed_date DATE,
        performed_by UUID,
        cost DECIMAL(10,2),
        next_maintenance_date DATE,
        status VARCHAR(20) DEFAULT 'scheduled',
        notes TEXT,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_service_tools_code ON service_tools(tool_code);
      CREATE INDEX idx_service_tools_category ON service_tools(category);
      CREATE INDEX idx_service_tools_status ON service_tools(status);
      CREATE INDEX idx_service_tools_next_calibration ON service_tools(next_calibration_date);
      
      CREATE INDEX idx_tool_assignments_tool_id ON tool_assignments(tool_id);
      CREATE INDEX idx_tool_assignments_technician_id ON tool_assignments(assigned_to_technician_id);
      CREATE INDEX idx_tool_assignments_case_id ON tool_assignments(assigned_to_case_id);
      CREATE INDEX idx_tool_assignments_checkout_date ON tool_assignments(checkout_date);
      CREATE INDEX idx_tool_assignments_status ON tool_assignments(status);
      
      CREATE INDEX idx_tool_maintenance_tool_id ON tool_maintenance(tool_id);
      CREATE INDEX idx_tool_maintenance_type ON tool_maintenance(maintenance_type);
      CREATE INDEX idx_tool_maintenance_scheduled_date ON tool_maintenance(scheduled_date);
      CREATE INDEX idx_tool_maintenance_status ON tool_maintenance(status);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS tool_maintenance CASCADE;');
    await client.query('DROP TABLE IF EXISTS tool_assignments CASCADE;');
    await client.query('DROP TABLE IF EXISTS service_tools CASCADE;');
  }
};