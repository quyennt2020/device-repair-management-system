import { MigrationRunner, Migration } from './migrations';
import { createWorkflowTables } from '../migrations/001_create_workflow_tables';
import { createMasterDataTables } from '../migrations/002_create_master_data_tables';
import { createCaseTables } from '../migrations/003_create_case_tables';
import { createDocumentTables } from '../migrations/004_create_document_tables';
import { createInventoryTables } from '../migrations/005_create_inventory_tables';
import { createToolsTables } from '../migrations/006_create_tools_tables';
import { createContractTables } from '../migrations/007_create_contract_tables';
import { createAuthTables } from '../migrations/008_create_auth_tables';
import { enhanceCaseWorkflowIntegration } from '../migrations/009_enhance_case_workflow_integration';
import { createCustomerExtendedTables } from '../migrations/010_create_customer_extended_tables';
import { createDeviceHistoryTable } from '../migrations/011_create_device_history_table';
import * as migration012 from '../migrations/012_create_technician_tables';
import { createApprovalWorkflowTables } from '../migrations/013_create_approval_workflow_tables';
import { enhanceInventoryTransactionManagement } from '../migrations/014_enhance_inventory_transaction_management';
import { enhanceQuotationManagement } from '../migrations/015_enhance_quotation_management';
import * as migration016 from '../migrations/016_create_repair_report_tables';
import * as migration017 from '../migrations/017_create_maintenance_report_tables';
import * as migration018 from '../migrations/018_create_data_integration_tables';
import * as migration019 from '../migrations/019_create_sla_tables';
import * as migration020 from '../migrations/020_add_missing_foreign_keys';
import * as migration021 from '../migrations/021_normalize_customer_data';
import * as migration022 from '../migrations/022_add_soft_delete';
import * as migration023 from '../migrations/023_fix_cascade_deletes';
import { db } from './connection';
import { Pool } from 'pg';

// Helper to convert Pool-based migrations to Migration interface
function wrapPoolMigration(id: string, name: string, upFn: (pool: Pool) => Promise<void>, downFn: (pool: Pool) => Promise<void>): Migration {
  return {
    id,
    name,
    up: async (client) => {
      // Create a minimal pool-like object that uses the client
      // The client is already managed by the transaction, so we provide a fake connect that returns the client
      // and a no-op release
      const poolLike = {
        query: client.query.bind(client),
        connect: async () => {
          // Return a proxy that forwards all method calls to client but no-ops release
          return new Proxy(client, {
            get(target, prop) {
              if (prop === 'release') {
                return () => {}; // No-op release
              }
              const value = (target as any)[prop];
              if (typeof value === 'function') {
                return value.bind(target);
              }
              return value;
            }
          });
        },
      } as any;
      await upFn(poolLike);
    },
    down: async (client) => {
      const poolLike = {
        query: client.query.bind(client),
        connect: async () => {
          return new Proxy(client, {
            get(target, prop) {
              if (prop === 'release') {
                return () => {};
              }
              const value = (target as any)[prop];
              if (typeof value === 'function') {
                return value.bind(target);
              }
              return value;
            }
          });
        },
      } as any;
      await downFn(poolLike);
    },
  };
}

const migrations = [
  createWorkflowTables,
  createMasterDataTables,
  createCaseTables,
  createDocumentTables,
  createInventoryTables,
  createToolsTables,
  createContractTables,
  createAuthTables,
  enhanceCaseWorkflowIntegration,
  createCustomerExtendedTables,
  createDeviceHistoryTable,
  wrapPoolMigration('012', 'Create technician tables', migration012.up, migration012.down),
  createApprovalWorkflowTables,
  enhanceInventoryTransactionManagement,
  enhanceQuotationManagement,
  wrapPoolMigration('016', 'Create repair report tables', migration016.up, migration016.down),
  wrapPoolMigration('017', 'Create maintenance report tables', migration017.up, migration017.down),
  wrapPoolMigration('018', 'Create data integration tables', migration018.up, migration018.down),
  wrapPoolMigration('019', 'Create SLA tables', migration019.up, migration019.down),
  wrapPoolMigration('020', 'Add missing foreign keys', migration020.up, migration020.down),
  wrapPoolMigration('021', 'Normalize customer data', migration021.up, migration021.down),
  wrapPoolMigration('022', 'Add soft delete support', migration022.up, migration022.down),
  wrapPoolMigration('023', 'Fix CASCADE delete strategy', migration023.up, migration023.down),
];

async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Test connection first
    const connected = await db.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    const runner = new MigrationRunner(migrations);
    await runner.runMigrations();
    
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };