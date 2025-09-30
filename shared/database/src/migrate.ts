import { MigrationRunner } from './migrations';
import { createWorkflowTables } from '../migrations/001_create_workflow_tables';
import { createMasterDataTables } from '../migrations/002_create_master_data_tables';
import { createCaseTables } from '../migrations/003_create_case_tables';
import { createDocumentTables } from '../migrations/004_create_document_tables';
import { createInventoryTables } from '../migrations/005_create_inventory_tables';
import { createToolsTables } from '../migrations/006_create_tools_tables';
import { createContractTables } from '../migrations/007_create_contract_tables';
import { enhanceCaseWorkflowIntegration } from '../migrations/009_enhance_case_workflow_integration';
import { createCustomerExtendedTables } from '../migrations/010_create_customer_extended_tables';
import { db } from './connection';

const migrations = [
  createWorkflowTables,
  createMasterDataTables,
  createCaseTables,
  createDocumentTables,
  createInventoryTables,
  createToolsTables,
  createContractTables,
  enhanceCaseWorkflowIntegration,
  createCustomerExtendedTables,
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