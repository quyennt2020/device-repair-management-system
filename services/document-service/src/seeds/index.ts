import { seedDocumentTypes } from './document-type-seeds';
import { seedApprovalWorkflows } from './approval-workflow-seeds';
import { createInspectionReportTables, seedInspectionReportData } from './inspection-report-seeds';
import { seedQuotationData } from './quotation-seeds';
import { seedRepairReports } from './repair-report-seeds';
import { seedMaintenanceReportData } from './maintenance-report-seeds';
import { pool } from '../../../../shared/database/src/connection';

export async function seedDocumentService(): Promise<void> {
  console.log('Starting document service seeding...');

  try {
    // Seed document types first
    await seedDocumentTypes();
    
    // Then seed approval workflows (depends on document types)
    await seedApprovalWorkflows();
    
    // Create inspection report tables and seed data
    await createInspectionReportTables();
    await seedInspectionReportData();
    
    // Seed quotation data
    await seedQuotationData(pool);
    
    // Seed repair report data
    await seedRepairReports(pool);
    
    // Seed maintenance report data
    await seedMaintenanceReportData(pool);
    
    console.log('Document service seeding completed successfully');
  } catch (error) {
    console.error('Document service seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDocumentService()
    .then(() => {
      console.log('All seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}