import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tables = [
      'users',
      'customers',
      'devices',
      'technicians',
      'repair_cases',
      'documents',
      'spare_parts',
      'warehouses',
      'workflow_definitions',
      'workflow_templates'
    ];

    console.log('  🗑️  Adding soft delete columns to critical tables...');

    for (const table of tables) {
      // Check if table exists first
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = '${table}'
        );
      `);

      if (!tableExists.rows[0].exists) {
        console.log(`    - Skipping ${table} (table does not exist)`);
        continue;
      }

      console.log(`    - Adding soft delete to ${table}`);

      await client.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS deleted_by UUID;
      `);

      // Create partial index for non-deleted records (better performance)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_not_deleted
        ON ${table}(id)
        WHERE deleted_at IS NULL;
      `);

      // Create index for deleted records (for audit/recovery)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_deleted_at
        ON ${table}(deleted_at)
        WHERE deleted_at IS NOT NULL;
      `);
    }

    console.log('  ✅ Soft delete columns added to all critical tables');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tables = [
      'users', 'customers', 'devices', 'technicians',
      'repair_cases', 'documents', 'spare_parts', 'warehouses',
      'workflow_definitions', 'workflow_templates'
    ];

    for (const table of tables) {
      await client.query(`
        DROP INDEX IF EXISTS idx_${table}_not_deleted;
        DROP INDEX IF EXISTS idx_${table}_deleted_at;

        ALTER TABLE ${table}
        DROP COLUMN IF EXISTS deleted_at,
        DROP COLUMN IF EXISTS deleted_by;
      `);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
