import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('  🔒 Changing risky CASCADE deletes to RESTRICT...');

    // Fix user_roles: Prevent deleting users who have roles
    console.log('    - Fixing user_roles.user_id CASCADE → RESTRICT');
    await client.query(`
      ALTER TABLE user_roles
      DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
    `);

    // Fix technicians: Prevent deleting users who are technicians
    console.log('    - Fixing technicians.user_id CASCADE → RESTRICT');
    await client.query(`
      ALTER TABLE technicians
      DROP CONSTRAINT IF EXISTS technicians_user_id_fkey,
      ADD CONSTRAINT technicians_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
    `);

    // Keep CASCADE for cleanup tables (sessions, tokens, etc.)
    console.log('    - Keeping CASCADE for session/token cleanup tables');

    // Change repair_cases to RESTRICT to prevent accidental data loss
    console.log('    - Fixing repair_cases.customer_id CASCADE → RESTRICT');
    await client.query(`
      ALTER TABLE repair_cases
      DROP CONSTRAINT IF EXISTS repair_cases_customer_id_fkey,
      ADD CONSTRAINT repair_cases_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
    `);

    console.log('    - Fixing repair_cases.device_id CASCADE → RESTRICT');
    await client.query(`
      ALTER TABLE repair_cases
      DROP CONSTRAINT IF EXISTS repair_cases_device_id_fkey,
      ADD CONSTRAINT repair_cases_device_id_fkey
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT;
    `);

    console.log('  ✅ CASCADE delete strategy updated successfully');

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

    // Revert back to CASCADE (original behavior)
    await client.query(`
      ALTER TABLE user_roles
      DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey,
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE technicians
      DROP CONSTRAINT IF EXISTS technicians_user_id_fkey,
      ADD CONSTRAINT technicians_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE repair_cases
      DROP CONSTRAINT IF EXISTS repair_cases_customer_id_fkey,
      ADD CONSTRAINT repair_cases_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

      ALTER TABLE repair_cases
      DROP CONSTRAINT IF EXISTS repair_cases_device_id_fkey,
      ADD CONSTRAINT repair_cases_device_id_fkey
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
