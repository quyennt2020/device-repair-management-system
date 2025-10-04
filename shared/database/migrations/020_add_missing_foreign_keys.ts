import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add FK for workflow_configurations.device_type_id
    console.log('  📎 Adding FK: workflow_configurations.device_type_id → device_types.id');
    await client.query(`
      ALTER TABLE workflow_configurations
      ADD CONSTRAINT fk_workflow_config_device_type
      FOREIGN KEY (device_type_id) REFERENCES device_types(id)
      ON DELETE RESTRICT;
    `);

    // Add FK for workflow_configurations.sla_id (references migration 019)
    console.log('  📎 Adding FK: workflow_configurations.sla_id → sla_definitions.id');
    await client.query(`
      ALTER TABLE workflow_configurations
      ADD CONSTRAINT fk_workflow_config_sla
      FOREIGN KEY (sla_id) REFERENCES sla_definitions(id)
      ON DELETE SET NULL;
    `);

    // Add FK for repair_cases.sla_id
    console.log('  📎 Adding FK: repair_cases.sla_id → sla_definitions.id');
    await client.query(`
      ALTER TABLE repair_cases
      ADD CONSTRAINT fk_repair_cases_sla
      FOREIGN KEY (sla_id) REFERENCES sla_definitions(id)
      ON DELETE SET NULL;
    `);

    // Add FK for sla_compliance.sla_id
    console.log('  📎 Adding FK: sla_compliance.sla_id → sla_definitions.id');
    await client.query(`
      ALTER TABLE sla_compliance
      ADD CONSTRAINT fk_sla_compliance_sla
      FOREIGN KEY (sla_id) REFERENCES sla_definitions(id)
      ON DELETE RESTRICT;
    `);

    // Add FK for repair_cases.assigned_technician_id (deferred from migration 003)
    console.log('  📎 Adding FK: repair_cases.assigned_technician_id → technicians.id');
    await client.query(`
      ALTER TABLE repair_cases
      ADD CONSTRAINT fk_repair_cases_technician
      FOREIGN KEY (assigned_technician_id) REFERENCES technicians(id)
      ON DELETE SET NULL;
    `);

    // Add FK for case_part_usage.technician_id (deferred from migration 005)
    console.log('  📎 Adding FK: case_part_usage.technician_id → technicians.id');
    await client.query(`
      ALTER TABLE case_part_usage
      ADD CONSTRAINT fk_case_part_usage_technician
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
      ON DELETE SET NULL;
    `);

    // Add FK for tool_assignments.assigned_to_technician_id (deferred from migration 006)
    console.log('  📎 Adding FK: tool_assignments.assigned_to_technician_id → technicians.id');
    await client.query(`
      ALTER TABLE tool_assignments
      ADD CONSTRAINT fk_tool_assignments_technician
      FOREIGN KEY (assigned_to_technician_id) REFERENCES technicians(id)
      ON DELETE SET NULL;
    `);

    console.log('  ✅ All foreign keys added successfully');

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

    await client.query(`
      ALTER TABLE workflow_configurations
      DROP CONSTRAINT IF EXISTS fk_workflow_config_device_type;

      ALTER TABLE workflow_configurations
      DROP CONSTRAINT IF EXISTS fk_workflow_config_sla;

      ALTER TABLE repair_cases
      DROP CONSTRAINT IF EXISTS fk_repair_cases_sla;

      ALTER TABLE sla_compliance
      DROP CONSTRAINT IF EXISTS fk_sla_compliance_sla;

      ALTER TABLE repair_cases
      DROP CONSTRAINT IF EXISTS fk_repair_cases_technician;

      ALTER TABLE case_part_usage
      DROP CONSTRAINT IF EXISTS fk_case_part_usage_technician;

      ALTER TABLE tool_assignments
      DROP CONSTRAINT IF EXISTS fk_tool_assignments_technician;
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
