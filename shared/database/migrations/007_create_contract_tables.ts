import { Migration } from '../src/migrations';

export const createContractTables: Migration = {
  id: '007',
  name: 'Create contract and SLA management tables',
  
  async up(client) {
    // Service Contracts
    await client.query(`
      CREATE TABLE service_contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_number VARCHAR(50) UNIQUE NOT NULL,
        customer_id UUID REFERENCES customers(id),
        contract_type VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        value DECIMAL(15,2),
        currency VARCHAR(3) DEFAULT 'VND',
        payment_schedule VARCHAR(20),
        status VARCHAR(20) DEFAULT 'draft',
        covered_devices JSONB DEFAULT '[]',
        response_time_hours INTEGER,
        resolution_time_hours INTEGER,
        included_services JSONB DEFAULT '[]',
        excluded_services JSONB DEFAULT '[]',
        annual_visit_quota INTEGER DEFAULT 0,
        visits_used INTEGER DEFAULT 0,
        contract_manager_id UUID,
        renewal_date DATE,
        auto_renew BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // SLA Definitions
    await client.query(`
      CREATE TABLE sla_definitions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        contract_id UUID REFERENCES service_contracts(id),
        priority VARCHAR(20) NOT NULL,
        response_time_minutes INTEGER NOT NULL,
        resolution_time_hours INTEGER NOT NULL,
        availability_percentage DECIMAL(5,2) DEFAULT 99.9,
        penalties JSONB DEFAULT '{}',
        escalation_rules JSONB DEFAULT '[]',
        service_hours VARCHAR(50) DEFAULT 'business_hours',
        applies_to JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Warranties
    await client.query(`
      CREATE TABLE warranties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID REFERENCES devices(id),
        warranty_type VARCHAR(50) NOT NULL,
        provider VARCHAR(255),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        coverage_terms JSONB DEFAULT '{}',
        covered_parts JSONB DEFAULT '[]',
        covered_services JSONB DEFAULT '[]',
        claim_procedure TEXT,
        warranty_document_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Onsite Services
    await client.query(`
      CREATE TABLE onsite_services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_case_id UUID REFERENCES repair_cases(id),
        service_type VARCHAR(50) NOT NULL,
        customer_address_id UUID,
        scheduled_date DATE,
        scheduled_time_slot VARCHAR(20),
        estimated_duration INTEGER,
        assigned_technicians JSONB DEFAULT '[]',
        required_tools JSONB DEFAULT '[]',
        required_parts JSONB DEFAULT '[]',
        travel_distance_km DECIMAL(6,2),
        travel_time_minutes INTEGER,
        status VARCHAR(20) DEFAULT 'scheduled',
        actual_start_time TIMESTAMP,
        actual_end_time TIMESTAMP,
        customer_signature VARCHAR(500),
        satisfaction_rating INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Onsite Checkpoints
    await client.query(`
      CREATE TABLE onsite_checkpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        onsite_service_id UUID REFERENCES onsite_services(id),
        checkpoint_type VARCHAR(20) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        location_lat DECIMAL(10,8),
        location_long DECIMAL(11,8),
        photo_url VARCHAR(500),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Certificates
    await client.query(`
      CREATE TABLE certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        certificate_name VARCHAR(255) NOT NULL,
        certificate_type VARCHAR(50) NOT NULL,
        issuing_organization VARCHAR(255),
        description TEXT,
        validity_period_months INTEGER,
        required_for_device_types JSONB DEFAULT '[]',
        renewal_requirements TEXT,
        is_mandatory BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Device Certificates
    await client.query(`
      CREATE TABLE device_certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID REFERENCES devices(id),
        certificate_type VARCHAR(50) NOT NULL,
        certificate_number VARCHAR(100),
        issue_date DATE,
        expiry_date DATE,
        issued_by VARCHAR(255),
        next_due_date DATE,
        status VARCHAR(20) DEFAULT 'valid',
        attachment_url VARCHAR(500),
        reminder_days_before INTEGER[] DEFAULT '{30,15,7}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_service_contracts_number ON service_contracts(contract_number);
      CREATE INDEX idx_service_contracts_customer_id ON service_contracts(customer_id);
      CREATE INDEX idx_service_contracts_status ON service_contracts(status);
      CREATE INDEX idx_service_contracts_end_date ON service_contracts(end_date);
      
      CREATE INDEX idx_sla_definitions_contract_id ON sla_definitions(contract_id);
      CREATE INDEX idx_sla_definitions_priority ON sla_definitions(priority);
      CREATE INDEX idx_sla_definitions_active ON sla_definitions(is_active);
      
      CREATE INDEX idx_warranties_device_id ON warranties(device_id);
      CREATE INDEX idx_warranties_type ON warranties(warranty_type);
      CREATE INDEX idx_warranties_end_date ON warranties(end_date);
      CREATE INDEX idx_warranties_status ON warranties(status);
      
      CREATE INDEX idx_onsite_services_case_id ON onsite_services(repair_case_id);
      CREATE INDEX idx_onsite_services_scheduled_date ON onsite_services(scheduled_date);
      CREATE INDEX idx_onsite_services_status ON onsite_services(status);
      
      CREATE INDEX idx_onsite_checkpoints_service_id ON onsite_checkpoints(onsite_service_id);
      CREATE INDEX idx_onsite_checkpoints_type ON onsite_checkpoints(checkpoint_type);
      
      CREATE INDEX idx_certificates_type ON certificates(certificate_type);
      CREATE INDEX idx_certificates_mandatory ON certificates(is_mandatory);
      
      CREATE INDEX idx_device_certificates_device_id ON device_certificates(device_id);
      CREATE INDEX idx_device_certificates_expiry_date ON device_certificates(expiry_date);
      CREATE INDEX idx_device_certificates_status ON device_certificates(status);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS device_certificates CASCADE;');
    await client.query('DROP TABLE IF EXISTS certificates CASCADE;');
    await client.query('DROP TABLE IF EXISTS onsite_checkpoints CASCADE;');
    await client.query('DROP TABLE IF EXISTS onsite_services CASCADE;');
    await client.query('DROP TABLE IF EXISTS warranties CASCADE;');
    await client.query('DROP TABLE IF EXISTS sla_definitions CASCADE;');
    await client.query('DROP TABLE IF EXISTS service_contracts CASCADE;');
  }
};