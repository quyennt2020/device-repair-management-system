import { Migration } from '../src/migrations';

export const enhanceCaseWorkflowIntegration: Migration = {
  id: '009',
  name: 'Enhance case workflow integration',
  
  async up(client) {
    // Add missing columns to repair_cases table
    await client.query(`
      ALTER TABLE repair_cases 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100),
      ADD COLUMN IF NOT EXISTS reported_issue TEXT,
      ADD COLUMN IF NOT EXISTS resolution TEXT,
      ADD COLUMN IF NOT EXISTS sla_due_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS workflow_started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS workflow_completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_sla_check TIMESTAMP,
      ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'met',
      ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    `);

    // Create case timeline table (more detailed than case_history)
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_timeline (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create case notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        note_type VARCHAR(50) DEFAULT 'internal',
        created_by UUID NOT NULL,
        is_private BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create case attachments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create case escalations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS case_escalations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        escalation_level INTEGER NOT NULL,
        escalation_type VARCHAR(50) NOT NULL,
        reason TEXT,
        sla_status JSONB,
        escalated_by VARCHAR(100) DEFAULT 'system',
        resolved_at TIMESTAMP,
        resolved_by UUID,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create SLA configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sla_configurations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        customer_tier VARCHAR(50) NOT NULL,
        service_type VARCHAR(100) NOT NULL,
        response_time_hours INTEGER NOT NULL,
        resolution_time_hours INTEGER NOT NULL,
        escalation_rules JSONB DEFAULT '[]',
        penalty_rules JSONB DEFAULT '[]',
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create workflow event handling log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_event_handling_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        workflow_instance_id UUID,
        event_type VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL,
        error_message TEXT,
        handled_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create inventory reservations table (for workflow integration)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        part_id UUID NOT NULL,
        quantity INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'reserved',
        reserved_by UUID NOT NULL,
        reserved_at TIMESTAMP DEFAULT NOW(),
        released_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create technician assignments table (for workflow integration)
    await client.query(`
      CREATE TABLE IF NOT EXISTS technician_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID REFERENCES repair_cases(id) ON DELETE CASCADE,
        technician_id UUID NOT NULL,
        assignment_type VARCHAR(50) DEFAULT 'primary',
        status VARCHAR(50) DEFAULT 'active',
        assigned_by UUID NOT NULL,
        assigned_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for new tables
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_case_timeline_case_id ON case_timeline(case_id);
      CREATE INDEX IF NOT EXISTS idx_case_timeline_event_type ON case_timeline(event_type);
      CREATE INDEX IF NOT EXISTS idx_case_timeline_created_at ON case_timeline(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id);
      CREATE INDEX IF NOT EXISTS idx_case_notes_note_type ON case_notes(note_type);
      CREATE INDEX IF NOT EXISTS idx_case_notes_created_at ON case_notes(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_case_attachments_case_id ON case_attachments(case_id);
      CREATE INDEX IF NOT EXISTS idx_case_attachments_created_at ON case_attachments(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_case_escalations_case_id ON case_escalations(case_id);
      CREATE INDEX IF NOT EXISTS idx_case_escalations_level ON case_escalations(escalation_level);
      CREATE INDEX IF NOT EXISTS idx_case_escalations_created_at ON case_escalations(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_sla_configurations_tier_service ON sla_configurations(customer_tier, service_type);
      CREATE INDEX IF NOT EXISTS idx_sla_configurations_active ON sla_configurations(is_active);
      
      CREATE INDEX IF NOT EXISTS idx_workflow_event_log_case_id ON workflow_event_handling_log(case_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_event_log_instance_id ON workflow_event_handling_log(workflow_instance_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_event_log_handled_at ON workflow_event_handling_log(handled_at);
      
      CREATE INDEX IF NOT EXISTS idx_inventory_reservations_case_id ON inventory_reservations(case_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_reservations_part_id ON inventory_reservations(part_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status ON inventory_reservations(status);
      
      CREATE INDEX IF NOT EXISTS idx_technician_assignments_case_id ON technician_assignments(case_id);
      CREATE INDEX IF NOT EXISTS idx_technician_assignments_technician_id ON technician_assignments(technician_id);
      CREATE INDEX IF NOT EXISTS idx_technician_assignments_status ON technician_assignments(status);
    `);

    // Add indexes for new repair_cases columns
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_repair_cases_sla_due_date ON repair_cases(sla_due_date);
      CREATE INDEX IF NOT EXISTS idx_repair_cases_sla_status ON repair_cases(sla_status);
      CREATE INDEX IF NOT EXISTS idx_repair_cases_escalation_level ON repair_cases(escalation_level);
      CREATE INDEX IF NOT EXISTS idx_repair_cases_last_sla_check ON repair_cases(last_sla_check);
      CREATE INDEX IF NOT EXISTS idx_repair_cases_deleted_at ON repair_cases(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_repair_cases_category ON repair_cases(category);
      CREATE INDEX IF NOT EXISTS idx_repair_cases_completed_at ON repair_cases(completed_at);
    `);

    // Insert default SLA configurations
    await client.query(`
      INSERT INTO sla_configurations (
        name, customer_tier, service_type, response_time_hours, resolution_time_hours,
        escalation_rules, penalty_rules, priority, created_by
      ) VALUES 
      (
        'Standard Repair SLA', 'standard', 'repair', 24, 72,
        '[{"level": 1, "triggerAfterHours": 20, "escalationType": "warning", "notifyRoles": ["manager"], "actions": ["notify"]}, {"level": 2, "triggerAfterHours": 48, "escalationType": "critical", "notifyRoles": ["manager", "director"], "actions": ["notify", "reassign"]}]',
        '[{"breachType": "response", "penaltyPercentage": 5, "maxPenaltyAmount": 500, "gracePeriodHours": 2}, {"breachType": "resolution", "penaltyPercentage": 10, "maxPenaltyAmount": 1000, "gracePeriodHours": 4}]',
        100, 'system'
      ),
      (
        'Premium Repair SLA', 'gold', 'repair', 8, 24,
        '[{"level": 1, "triggerAfterHours": 6, "escalationType": "warning", "notifyRoles": ["manager"], "actions": ["notify"]}, {"level": 2, "triggerAfterHours": 16, "escalationType": "critical", "notifyRoles": ["manager", "director"], "actions": ["notify", "reassign"]}]',
        '[{"breachType": "response", "penaltyPercentage": 10, "maxPenaltyAmount": 1000, "gracePeriodHours": 1}, {"breachType": "resolution", "penaltyPercentage": 15, "maxPenaltyAmount": 2000, "gracePeriodHours": 2}]',
        200, 'system'
      ),
      (
        'Platinum Repair SLA', 'platinum', 'repair', 4, 12,
        '[{"level": 1, "triggerAfterHours": 3, "escalationType": "warning", "notifyRoles": ["manager"], "actions": ["notify"]}, {"level": 2, "triggerAfterHours": 8, "escalationType": "critical", "notifyRoles": ["manager", "director"], "actions": ["notify", "reassign"]}]',
        '[{"breachType": "response", "penaltyPercentage": 15, "maxPenaltyAmount": 2000, "gracePeriodHours": 0.5}, {"breachType": "resolution", "penaltyPercentage": 20, "maxPenaltyAmount": 5000, "gracePeriodHours": 1}]',
        300, 'system'
      ),
      (
        'Standard Maintenance SLA', 'standard', 'maintenance', 48, 168,
        '[{"level": 1, "triggerAfterHours": 40, "escalationType": "warning", "notifyRoles": ["manager"], "actions": ["notify"]}, {"level": 2, "triggerAfterHours": 120, "escalationType": "critical", "notifyRoles": ["manager", "director"], "actions": ["notify", "reassign"]}]',
        '[{"breachType": "response", "penaltyPercentage": 3, "maxPenaltyAmount": 300, "gracePeriodHours": 4}, {"breachType": "resolution", "penaltyPercentage": 5, "maxPenaltyAmount": 500, "gracePeriodHours": 8}]',
        100, 'system'
      )
      ON CONFLICT DO NOTHING;
    `);
  },

  async down(client) {
    // Drop new tables
    await client.query('DROP TABLE IF EXISTS technician_assignments CASCADE;');
    await client.query('DROP TABLE IF EXISTS inventory_reservations CASCADE;');
    await client.query('DROP TABLE IF EXISTS workflow_event_handling_log CASCADE;');
    await client.query('DROP TABLE IF EXISTS sla_configurations CASCADE;');
    await client.query('DROP TABLE IF EXISTS case_escalations CASCADE;');
    await client.query('DROP TABLE IF EXISTS case_attachments CASCADE;');
    await client.query('DROP TABLE IF EXISTS case_notes CASCADE;');
    await client.query('DROP TABLE IF EXISTS case_timeline CASCADE;');

    // Remove added columns from repair_cases
    await client.query(`
      ALTER TABLE repair_cases 
      DROP COLUMN IF EXISTS title,
      DROP COLUMN IF EXISTS category,
      DROP COLUMN IF EXISTS subcategory,
      DROP COLUMN IF EXISTS reported_issue,
      DROP COLUMN IF EXISTS resolution,
      DROP COLUMN IF EXISTS sla_due_date,
      DROP COLUMN IF EXISTS completed_at,
      DROP COLUMN IF EXISTS assigned_at,
      DROP COLUMN IF EXISTS workflow_started_at,
      DROP COLUMN IF EXISTS workflow_completed_at,
      DROP COLUMN IF EXISTS last_sla_check,
      DROP COLUMN IF EXISTS sla_status,
      DROP COLUMN IF EXISTS escalation_level,
      DROP COLUMN IF EXISTS escalated_at,
      DROP COLUMN IF EXISTS metadata,
      DROP COLUMN IF EXISTS deleted_at;
    `);
  }
};