import { Migration } from '../src/migrations';

export const createCustomerExtendedTables: Migration = {
  id: '010',
  name: 'Create customer extended tables',
  
  async up(client) {
    // Customer History table
    await client.query(`
      CREATE TABLE customer_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        related_entity_id UUID,
        related_entity_type VARCHAR(50),
        performed_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Customer Contacts table (separate from JSONB for better querying)
    await client.query(`
      CREATE TABLE customer_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        title VARCHAR(100),
        department VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        mobile VARCHAR(50),
        is_primary BOOLEAN DEFAULT false,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Customer Addresses table (separate from JSONB for better querying)
    await client.query(`
      CREATE TABLE customer_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        address_type VARCHAR(50) NOT NULL,
        address_name VARCHAR(255) NOT NULL,
        street_address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state_province VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) NOT NULL,
        contact_person VARCHAR(255),
        phone VARCHAR(50),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Customer Preferences table
    await client.query(`
      CREATE TABLE customer_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
        preferred_technicians JSONB DEFAULT '[]',
        preferred_service_times JSONB DEFAULT '[]',
        communication_preferences JSONB NOT NULL DEFAULT '{}',
        special_instructions TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(customer_id)
      );
    `);

    // Add account_manager_id to customers table if not exists
    await client.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS account_manager_id UUID;
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_customer_history_customer_id ON customer_history(customer_id);
      CREATE INDEX idx_customer_history_event_type ON customer_history(event_type);
      CREATE INDEX idx_customer_history_created_at ON customer_history(created_at);
      
      CREATE INDEX idx_customer_contacts_customer_id ON customer_contacts(customer_id);
      CREATE INDEX idx_customer_contacts_email ON customer_contacts(email);
      CREATE INDEX idx_customer_contacts_is_primary ON customer_contacts(is_primary);
      
      CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);
      CREATE INDEX idx_customer_addresses_type ON customer_addresses(address_type);
      CREATE INDEX idx_customer_addresses_is_default ON customer_addresses(is_default);
      
      CREATE INDEX idx_customer_preferences_customer_id ON customer_preferences(customer_id);
      CREATE INDEX idx_customers_account_manager ON customers(account_manager_id);
      CREATE INDEX idx_customers_tier ON customers(customer_tier);
    `);

    // Ensure only one primary contact per customer
    await client.query(`
      CREATE UNIQUE INDEX idx_customer_contacts_primary_unique 
      ON customer_contacts(customer_id) 
      WHERE is_primary = true;
    `);

    // Ensure only one default address per customer
    await client.query(`
      CREATE UNIQUE INDEX idx_customer_addresses_default_unique 
      ON customer_addresses(customer_id) 
      WHERE is_default = true;
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS customer_preferences CASCADE;');
    await client.query('DROP TABLE IF EXISTS customer_addresses CASCADE;');
    await client.query('DROP TABLE IF EXISTS customer_contacts CASCADE;');
    await client.query('DROP TABLE IF EXISTS customer_history CASCADE;');
    await client.query('ALTER TABLE customers DROP COLUMN IF EXISTS account_manager_id;');
  }
};