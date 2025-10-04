import { Migration } from '../src/migrations';

export const createCaseTables: Migration = {
  id: '003',
  name: 'Create case management tables',
  
  async up(client) {
    // Repair Cases
    await client.query(`
      CREATE TABLE repair_cases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id UUID REFERENCES customers(id),
        device_id UUID REFERENCES devices(id),
        service_type VARCHAR(50) NOT NULL,
        workflow_configuration_id UUID REFERENCES workflow_configurations(id),
        workflow_instance_id UUID REFERENCES workflow_instances(id),
        current_step_id VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        assigned_technician_id UUID, /* FK added in migration 020 after technicians table exists */
        sla_id UUID,
        description TEXT,
        requested_by UUID NOT NULL,
        scheduled_date TIMESTAMP,
        onsite BOOLEAN DEFAULT false,
        urgency VARCHAR(20) DEFAULT 'normal',
        estimated_completion_date TIMESTAMP,
        actual_completion_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Case History
    await client.query(`
      CREATE TABLE case_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id),
        action VARCHAR(100) NOT NULL,
        description TEXT,
        previous_value JSONB,
        new_value JSONB,
        performed_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // SLA Compliance Tracking
    await client.query(`
      CREATE TABLE sla_compliance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_case_id UUID REFERENCES repair_cases(id),
        sla_id UUID NOT NULL,
        target_response_time INTEGER,
        actual_response_time INTEGER,
        target_resolution_time INTEGER,
        actual_resolution_time INTEGER,
        status VARCHAR(20) NOT NULL,
        breach_reason TEXT,
        penalty_amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_repair_cases_customer_id ON repair_cases(customer_id);
      CREATE INDEX idx_repair_cases_device_id ON repair_cases(device_id);
      CREATE INDEX idx_repair_cases_service_type ON repair_cases(service_type);
      CREATE INDEX idx_repair_cases_workflow_config ON repair_cases(workflow_configuration_id);
      CREATE INDEX idx_repair_cases_workflow_instance ON repair_cases(workflow_instance_id);
      CREATE INDEX idx_repair_cases_technician ON repair_cases(assigned_technician_id);
      CREATE INDEX idx_repair_cases_status ON repair_cases(status);
      CREATE INDEX idx_repair_cases_created_at ON repair_cases(created_at);
      
      CREATE INDEX idx_case_history_case_id ON case_history(case_id);
      CREATE INDEX idx_case_history_created_at ON case_history(created_at);
      
      CREATE INDEX idx_sla_compliance_case_id ON sla_compliance(repair_case_id);
      CREATE INDEX idx_sla_compliance_status ON sla_compliance(status);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS sla_compliance CASCADE;');
    await client.query('DROP TABLE IF EXISTS case_history CASCADE;');
    await client.query('DROP TABLE IF EXISTS repair_cases CASCADE;');
  }
};