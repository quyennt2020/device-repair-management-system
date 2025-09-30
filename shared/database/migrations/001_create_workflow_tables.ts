import { Migration } from '../src/migrations';

export const createWorkflowTables: Migration = {
  id: '001',
  name: 'Create workflow tables',
  
  async up(client) {
    // Workflow Definitions
    await client.query(`
      CREATE TABLE workflow_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        config JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, version)
      );
    `);

    // Workflow Instances
    await client.query(`
      CREATE TABLE workflow_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        definition_id UUID REFERENCES workflow_definitions(id),
        case_id UUID NOT NULL,
        current_step_id VARCHAR(100),
        status VARCHAR(50) NOT NULL,
        variables JSONB DEFAULT '{}',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Workflow Configurations
    await client.query(`
      CREATE TABLE workflow_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_type_id UUID NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        customer_tier VARCHAR(20),
        workflow_definition_id UUID REFERENCES workflow_definitions(id),
        sla_id UUID,
        priority VARCHAR(20) DEFAULT 'medium',
        estimated_duration_hours DECIMAL(5,2),
        required_certifications JSONB DEFAULT '[]',
        required_tools JSONB DEFAULT '[]',
        auto_assignment_rules JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(device_type_id, service_type, customer_tier)
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_workflow_instances_case_id ON workflow_instances(case_id);
      CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
      CREATE INDEX idx_workflow_configurations_device_type ON workflow_configurations(device_type_id);
      CREATE INDEX idx_workflow_configurations_service_type ON workflow_configurations(service_type);
      CREATE INDEX idx_workflow_configurations_active ON workflow_configurations(is_active);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS workflow_configurations CASCADE;');
    await client.query('DROP TABLE IF EXISTS workflow_instances CASCADE;');
    await client.query('DROP TABLE IF EXISTS workflow_definitions CASCADE;');
  }
};