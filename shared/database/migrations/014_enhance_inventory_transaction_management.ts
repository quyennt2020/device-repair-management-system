import { Migration } from '../src/migrations';

export const enhanceInventoryTransactionManagement: Migration = {
  id: '014',
  name: 'Enhance inventory transaction management',
  
  async up(client) {
    // Part Reservations table
    await client.query(`
      CREATE TABLE part_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        spare_part_id UUID REFERENCES spare_parts(id) NOT NULL,
        warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        reserved_for UUID NOT NULL,
        reservation_type VARCHAR(20) NOT NULL CHECK (reservation_type IN ('quotation', 'case', 'maintenance', 'emergency')),
        reserved_by UUID NOT NULL,
        expiry_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released', 'expired')),
        consumed_quantity INTEGER DEFAULT 0 CHECK (consumed_quantity >= 0),
        released_quantity INTEGER DEFAULT 0 CHECK (released_quantity >= 0),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL,
        CONSTRAINT check_consumed_released_quantity CHECK (consumed_quantity + released_quantity <= quantity)
      );
    `);

    // Inventory Reconciliations table
    await client.query(`
      CREATE TABLE inventory_reconciliations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_id VARCHAR(50) UNIQUE NOT NULL,
        warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
        performed_by UUID NOT NULL,
        reconciliation_type VARCHAR(30) NOT NULL CHECK (reconciliation_type IN ('full_stocktake', 'cycle_count', 'spot_check', 'variance_investigation')),
        status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
        start_date TIMESTAMP NOT NULL,
        completed_date TIMESTAMP,
        total_items_checked INTEGER DEFAULT 0,
        discrepancies_found INTEGER DEFAULT 0,
        total_adjustment_value DECIMAL(12,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL
      );
    `);

    // Reconciliation Items table
    await client.query(`
      CREATE TABLE reconciliation_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_id UUID REFERENCES inventory_reconciliations(id) NOT NULL,
        spare_part_id UUID REFERENCES spare_parts(id) NOT NULL,
        expected_quantity INTEGER NOT NULL,
        counted_quantity INTEGER NOT NULL,
        variance INTEGER GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
        variance_value DECIMAL(10,2),
        counted_by UUID NOT NULL,
        counted_at TIMESTAMP NOT NULL,
        notes TEXT,
        images JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL,
        UNIQUE(reconciliation_id, spare_part_id)
      );
    `);

    // Consumption Tracking table (enhanced case_part_usage)
    await client.query(`
      CREATE TABLE consumption_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repair_case_id UUID REFERENCES repair_cases(id) NOT NULL,
        spare_part_id UUID REFERENCES spare_parts(id) NOT NULL,
        warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
        reservation_id UUID REFERENCES part_reservations(id),
        quantity_consumed INTEGER NOT NULL CHECK (quantity_consumed > 0),
        unit_cost DECIMAL(10,2) NOT NULL,
        total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity_consumed * unit_cost) STORED,
        consumed_by UUID NOT NULL,
        consumed_at TIMESTAMP DEFAULT NOW(),
        workflow_step_id VARCHAR(100),
        installation_notes TEXT,
        warranty_months INTEGER DEFAULT 12,
        serial_numbers JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL
      );
    `);

    // Transaction Audit Log table
    await client.query(`
      CREATE TABLE transaction_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES inventory_transactions(id) NOT NULL,
        audit_action VARCHAR(20) NOT NULL CHECK (audit_action IN ('create', 'update', 'delete', 'approve', 'reject', 'cancel')),
        performed_by UUID NOT NULL,
        performed_at TIMESTAMP DEFAULT NOW(),
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by UUID NOT NULL
      );
    `);

    // Add additional columns to inventory_transactions for enhanced tracking
    await client.query(`
      ALTER TABLE inventory_transactions 
      ADD COLUMN batch_id UUID,
      ADD COLUMN expiry_date DATE,
      ADD COLUMN supplier_id UUID,
      ADD COLUMN purchase_order_id UUID,
      ADD COLUMN created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN created_by UUID;
    `);

    // Update existing records to have created_by
    await client.query(`
      UPDATE inventory_transactions 
      SET created_by = performed_by 
      WHERE created_by IS NULL;
    `);

    // Make created_by NOT NULL after updating existing records
    await client.query(`
      ALTER TABLE inventory_transactions 
      ALTER COLUMN created_by SET NOT NULL;
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX idx_part_reservations_spare_part ON part_reservations(spare_part_id);
      CREATE INDEX idx_part_reservations_warehouse ON part_reservations(warehouse_id);
      CREATE INDEX idx_part_reservations_reserved_for ON part_reservations(reserved_for);
      CREATE INDEX idx_part_reservations_status ON part_reservations(status);
      CREATE INDEX idx_part_reservations_expiry ON part_reservations(expiry_date);
      CREATE INDEX idx_part_reservations_type ON part_reservations(reservation_type);
      
      CREATE INDEX idx_inventory_reconciliations_warehouse ON inventory_reconciliations(warehouse_id);
      CREATE INDEX idx_inventory_reconciliations_status ON inventory_reconciliations(status);
      CREATE INDEX idx_inventory_reconciliations_date ON inventory_reconciliations(start_date);
      CREATE INDEX idx_inventory_reconciliations_performed_by ON inventory_reconciliations(performed_by);
      
      CREATE INDEX idx_reconciliation_items_reconciliation ON reconciliation_items(reconciliation_id);
      CREATE INDEX idx_reconciliation_items_spare_part ON reconciliation_items(spare_part_id);
      CREATE INDEX idx_reconciliation_items_variance ON reconciliation_items(variance) WHERE variance != 0;
      
      CREATE INDEX idx_consumption_tracking_case ON consumption_tracking(repair_case_id);
      CREATE INDEX idx_consumption_tracking_part ON consumption_tracking(spare_part_id);
      CREATE INDEX idx_consumption_tracking_warehouse ON consumption_tracking(warehouse_id);
      CREATE INDEX idx_consumption_tracking_reservation ON consumption_tracking(reservation_id);
      CREATE INDEX idx_consumption_tracking_date ON consumption_tracking(consumed_at);
      
      CREATE INDEX idx_transaction_audit_log_transaction ON transaction_audit_log(transaction_id);
      CREATE INDEX idx_transaction_audit_log_action ON transaction_audit_log(audit_action);
      CREATE INDEX idx_transaction_audit_log_performed_by ON transaction_audit_log(performed_by);
      CREATE INDEX idx_transaction_audit_log_date ON transaction_audit_log(performed_at);
      
      CREATE INDEX idx_inventory_transactions_batch ON inventory_transactions(batch_id);
      CREATE INDEX idx_inventory_transactions_supplier ON inventory_transactions(supplier_id);
      CREATE INDEX idx_inventory_transactions_po ON inventory_transactions(purchase_order_id);
    `);

    // Create triggers for automatic audit logging
    await client.query(`
      CREATE OR REPLACE FUNCTION audit_inventory_transaction()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO transaction_audit_log (
            transaction_id, audit_action, performed_by, new_values, created_by
          ) VALUES (
            NEW.id, 'create', NEW.performed_by, 
            jsonb_build_object(
              'transaction_type', NEW.transaction_type,
              'quantity', NEW.quantity,
              'unit_cost', NEW.unit_cost,
              'reference_type', NEW.reference_type,
              'reference_id', NEW.reference_id
            ),
            NEW.performed_by
          );
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          INSERT INTO transaction_audit_log (
            transaction_id, audit_action, performed_by, old_values, new_values, created_by
          ) VALUES (
            NEW.id, 'update', NEW.performed_by,
            jsonb_build_object(
              'transaction_type', OLD.transaction_type,
              'quantity', OLD.quantity,
              'unit_cost', OLD.unit_cost,
              'notes', OLD.notes
            ),
            jsonb_build_object(
              'transaction_type', NEW.transaction_type,
              'quantity', NEW.quantity,
              'unit_cost', NEW.unit_cost,
              'notes', NEW.notes
            ),
            NEW.performed_by
          );
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO transaction_audit_log (
            transaction_id, audit_action, performed_by, old_values, created_by
          ) VALUES (
            OLD.id, 'delete', OLD.performed_by,
            jsonb_build_object(
              'transaction_type', OLD.transaction_type,
              'quantity', OLD.quantity,
              'unit_cost', OLD.unit_cost
            ),
            OLD.performed_by
          );
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      CREATE TRIGGER trigger_audit_inventory_transaction
        AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
        FOR EACH ROW EXECUTE FUNCTION audit_inventory_transaction();
    `);

    // Create function to automatically expire reservations
    await client.query(`
      CREATE OR REPLACE FUNCTION expire_reservations()
      RETURNS void AS $$
      BEGIN
        UPDATE part_reservations 
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'active' 
        AND expiry_date IS NOT NULL 
        AND expiry_date < NOW();
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  async down(client) {
    await client.query('DROP TRIGGER IF EXISTS trigger_audit_inventory_transaction ON inventory_transactions;');
    await client.query('DROP FUNCTION IF EXISTS audit_inventory_transaction();');
    await client.query('DROP FUNCTION IF EXISTS expire_reservations();');
    
    await client.query('DROP TABLE IF EXISTS transaction_audit_log CASCADE;');
    await client.query('DROP TABLE IF EXISTS consumption_tracking CASCADE;');
    await client.query('DROP TABLE IF EXISTS reconciliation_items CASCADE;');
    await client.query('DROP TABLE IF EXISTS inventory_reconciliations CASCADE;');
    await client.query('DROP TABLE IF EXISTS part_reservations CASCADE;');
    
    await client.query(`
      ALTER TABLE inventory_transactions 
      DROP COLUMN IF EXISTS batch_id,
      DROP COLUMN IF EXISTS expiry_date,
      DROP COLUMN IF EXISTS supplier_id,
      DROP COLUMN IF EXISTS purchase_order_id,
      DROP COLUMN IF EXISTS created_at,
      DROP COLUMN IF EXISTS updated_at,
      DROP COLUMN IF EXISTS created_by;
    `);
  }
};