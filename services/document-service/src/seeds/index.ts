import { seedDocumentTypes } from './document-type-seeds';
import { seedApprovalWorkflows } from './approval-workflow-seeds';

export async function seedDocumentService(): Promise<void> {
  console.log('Starting document service seeding...');

  try {
    // Seed document types first
    await seedDocumentTypes();
    
    // Then seed approval workflows (depends on document types)
    await seedApprovalWorkflows();
    
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