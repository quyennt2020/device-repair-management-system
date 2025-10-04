import { Migration } from '../src/migrations';

export const createMasterDataTables: Migration = {
  id: '002',
  name: 'Create master data tables',
  
  async up(client) {
    // Customers
    await client.query(`
      CREATE TABLE customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_code VARCHAR(50) UNIQUE NOT NULL,
        customer_type VARCHAR(20) NOT NULL,
        company_name VARCHAR(255),
        tax_code VARCHAR(50),
        industry VARCHAR(100),
        contact_info JSONB NOT NULL,
        address_info JSONB NOT NULL,
        credit_limit DECIMAL(15,2),
        payment_terms INTEGER,
        customer_tier VARCHAR(20) DEFAULT 'bronze',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Device Types
    await client.query(`
      CREATE TABLE device_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        manufacturer VARCHAR(100),
        model_series VARCHAR(100),
        specifications JSONB DEFAULT '{}',
        standard_service_hours DECIMAL(5,2),
        required_certifications JSONB DEFAULT '[]',
        maintenance_checklist JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Devices
    await client.query(`
      CREATE TABLE devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_code VARCHAR(50) UNIQUE NOT NULL,
        customer_id UUID REFERENCES customers(id),
        device_type_id UUID REFERENCES device_types(id),
        manufacturer VARCHAR(100),
        model VARCHAR(100),
        serial_number VARCHAR(100),
        specifications JSONB DEFAULT '{}',
        location_info JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        warranty_info JSONB DEFAULT '{}',
        last_service_date DATE,
        next_service_date DATE,
        qr_code VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_customers_code ON customers(customer_code);
      CREATE INDEX idx_customers_type ON customers(customer_type);
      CREATE INDEX idx_customers_status ON customers(status);

      CREATE INDEX idx_devices_customer_id ON devices(customer_id);
      CREATE INDEX idx_devices_type_id ON devices(device_type_id);
      CREATE INDEX idx_devices_serial ON devices(serial_number);
      CREATE INDEX idx_devices_status ON devices(status);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS devices CASCADE;');
    await client.query('DROP TABLE IF EXISTS device_types CASCADE;');
    await client.query('DROP TABLE IF EXISTS customers CASCADE;');
  }
};