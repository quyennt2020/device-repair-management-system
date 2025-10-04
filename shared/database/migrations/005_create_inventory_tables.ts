import { Migration } from '../src/migrations';

export const createInventoryTables: Migration = {
  id: '005',
  name: 'Create inventory management tables',
  
  async up(client) {
    // Warehouses
    await client.query(`
      CREATE TABLE warehouses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        warehouse_name VARCHAR(255) NOT NULL,
        warehouse_code VARCHAR(50) UNIQUE NOT NULL,
        location VARCHAR(255),
        manager_id UUID,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Spare Parts
    await client.query(`
      CREATE TABLE spare_parts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        part_number VARCHAR(100) UNIQUE NOT NULL,
        part_name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        manufacturer VARCHAR(100),
        specifications JSONB DEFAULT '{}',
        compatible_devices JSONB DEFAULT '[]',
        pricing_info JSONB NOT NULL,
        inventory_settings JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Part Inventory
    await client.query(`
      CREATE TABLE part_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        spare_part_id UUID REFERENCES spare_parts(id),
        warehouse_id UUID REFERENCES warehouses(id),
        quantity_available INTEGER NOT NULL DEFAULT 0,
        quantity_reserved INTEGER NOT NULL DEFAULT 0,
        quantity_on_order INTEGER NOT NULL DEFAULT 0,
        minimum_stock INTEGER DEFAULT 0,
        maximum_stock INTEGER DEFAULT 1000,
        last_stocktake_date DATE,
        location_bin VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(spare_part_id, warehouse_id)
      );
    `);

    // Inventory Transactions
    await client.query(`
      CREATE TABLE inventory_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        spare_part_id UUID REFERENCES spare_parts(id),
        warehouse_id UUID REFERENCES warehouses(id),
        transaction_type VARCHAR(20) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost DECIMAL(10,2),
        reference_type VARCHAR(50),
        reference_id UUID,
        performed_by UUID NOT NULL,
        transaction_date TIMESTAMP DEFAULT NOW(),
        notes TEXT
      );
    `);

    // Case Part Usage
    await client.query(`
      CREATE TABLE case_part_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_case_id UUID REFERENCES repair_cases(id),
        spare_part_id UUID REFERENCES spare_parts(id),
        quantity_used INTEGER NOT NULL,
        unit_cost DECIMAL(10,2),
        total_cost DECIMAL(10,2),
        warranty_months INTEGER DEFAULT 12,
        installation_date TIMESTAMP,
        technician_id UUID, /* FK added in migration 020 */
        old_part_serial VARCHAR(100),
        new_part_serial VARCHAR(100),
        return_old_part BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_warehouses_code ON warehouses(warehouse_code);
      CREATE INDEX idx_warehouses_status ON warehouses(status);
      
      CREATE INDEX idx_spare_parts_number ON spare_parts(part_number);
      CREATE INDEX idx_spare_parts_category ON spare_parts(category);
      CREATE INDEX idx_spare_parts_manufacturer ON spare_parts(manufacturer);
      CREATE INDEX idx_spare_parts_status ON spare_parts(status);
      
      CREATE INDEX idx_part_inventory_part_id ON part_inventory(spare_part_id);
      CREATE INDEX idx_part_inventory_warehouse_id ON part_inventory(warehouse_id);
      CREATE INDEX idx_part_inventory_quantity ON part_inventory(quantity_available);
      
      CREATE INDEX idx_inventory_transactions_part_id ON inventory_transactions(spare_part_id);
      CREATE INDEX idx_inventory_transactions_warehouse_id ON inventory_transactions(warehouse_id);
      CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
      CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(transaction_date);
      
      CREATE INDEX idx_case_part_usage_case_id ON case_part_usage(repair_case_id);
      CREATE INDEX idx_case_part_usage_part_id ON case_part_usage(spare_part_id);
      CREATE INDEX idx_case_part_usage_technician ON case_part_usage(technician_id);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS case_part_usage CASCADE;');
    await client.query('DROP TABLE IF EXISTS inventory_transactions CASCADE;');
    await client.query('DROP TABLE IF EXISTS part_inventory CASCADE;');
    await client.query('DROP TABLE IF EXISTS spare_parts CASCADE;');
    await client.query('DROP TABLE IF EXISTS warehouses CASCADE;');
  }
};