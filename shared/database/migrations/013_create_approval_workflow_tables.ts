import { Migration } from '../src/migrations';

export const createApprovalWorkflowTables: Migration = {
  id: '013',
  name: 'Create approval workflow tables',
  
  async up(client) {
    // Approval Workflows
    await client.query(`
      CREATE TABLE approval_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        document_type_ids JSONB NOT NULL DEFAULT '[]',
        levels JSONB NOT NULL DEFAULT '[]',
        escalation_rules JSONB NOT NULL DEFAULT '[]',
        delegation_rules JSONB NOT NULL DEFAULT '[]',
        notifications JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Approval Instances (per document)
    await client.query(`
      CREATE TABLE approval_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
        workflow_id UUID REFERENCES approval_workflows(id),
        current_level INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        urgency VARCHAR(20) DEFAULT 'normal',
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        submitted_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Individual Approval Records
    await client.query(`
      CREATE TABLE approval_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID REFERENCES approval_instances(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        approver_user_id UUID NOT NULL,
        original_approver_user_id UUID, -- If delegated
        status VARCHAR(50) DEFAULT 'pending',
        comments TEXT,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP,
        time_spent_minutes INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    -- Escalation Records
    await client.query(`
      CREATE TABLE escalation_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID REFERENCES approval_instances(id) ON DELETE CASCADE,
        from_level INTEGER NOT NULL,
        to_level INTEGER NOT NULL,
        reason TEXT NOT NULL,
        escalation_type VARCHAR(50) NOT NULL,
        escalated_by UUID,
        escalated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    -- Delegation Records
    await client.query(`
      CREATE TABLE delegation_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID REFERENCES approval_instances(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        from_user_id UUID NOT NULL,
        to_user_id UUID NOT NULL,
        delegated_at TIMESTAMP DEFAULT NOW(),
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    -- Approval Notifications Queue
    await client.query(`
      CREATE TABLE approval_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID REFERENCES approval_instances(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        recipient_user_id UUID NOT NULL,
        channel VARCHAR(20) NOT NULL,
        template VARCHAR(100) NOT NULL,
        data JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        scheduled_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    -- Create indexes for performance
    await client.query(`
      CREATE INDEX idx_approval_workflows_name ON approval_workflows(name);
      CREATE INDEX idx_approval_workflows_active ON approval_workflows(is_active);
      CREATE INDEX idx_approval_workflows_document_types ON approval_workflows USING GIN(document_type_ids);
      
      CREATE INDEX idx_approval_instances_document_id ON approval_instances(document_id);
      CREATE INDEX idx_approval_instances_workflow_id ON approval_instances(workflow_id);
      CREATE INDEX idx_approval_instances_status ON approval_instances(status);
      CREATE INDEX idx_approval_instances_current_level ON approval_instances(current_level);
      CREATE INDEX idx_approval_instances_submitted_by ON approval_instances(submitted_by);
      CREATE INDEX idx_approval_instances_started_at ON approval_instances(started_at);
      
      CREATE INDEX idx_approval_records_instance_id ON approval_records(instance_id);
      CREATE INDEX idx_approval_records_approver ON approval_records(approver_user_id);
      CREATE INDEX idx_approval_records_level ON approval_records(level);
      CREATE INDEX idx_approval_records_status ON approval_records(status);
      CREATE INDEX idx_approval_records_approved_at ON approval_records(approved_at);
      
      CREATE INDEX idx_escalation_records_instance_id ON escalation_records(instance_id);
      CREATE INDEX idx_escalation_records_escalated_by ON escalation_records(escalated_by);
      CREATE INDEX idx_escalation_records_escalated_at ON escalation_records(escalated_at);
      
      CREATE INDEX idx_delegation_records_instance_id ON delegation_records(instance_id);
      CREATE INDEX idx_delegation_records_from_user ON delegation_records(from_user_id);
      CREATE INDEX idx_delegation_records_to_user ON delegation_records(to_user_id);
      CREATE INDEX idx_delegation_records_delegated_at ON delegation_records(delegated_at);
      
      CREATE INDEX idx_approval_notifications_instance_id ON approval_notifications(instance_id);
      CREATE INDEX idx_approval_notifications_recipient ON approval_notifications(recipient_user_id);
      CREATE INDEX idx_approval_notifications_status ON approval_notifications(status);
      CREATE INDEX idx_approval_notifications_scheduled_at ON approval_notifications(scheduled_at);
      CREATE INDEX idx_approval_notifications_type ON approval_notifications(notification_type);
    `);

    -- Create composite indexes for common queries
    await client.query(`
      CREATE INDEX idx_approval_records_approver_status ON approval_records(approver_user_id, status);
      CREATE INDEX idx_approval_instances_status_level ON approval_instances(status, current_level);
      CREATE INDEX idx_approval_notifications_status_scheduled ON approval_notifications(status, scheduled_at);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS approval_notifications CASCADE;');
    await client.query('DROP TABLE IF EXISTS delegation_records CASCADE;');
    await client.query('DROP TABLE IF EXISTS escalation_records CASCADE;');
    await client.query('DROP TABLE IF EXISTS approval_records CASCADE;');
    await client.query('DROP TABLE IF EXISTS approval_instances CASCADE;');
    await client.query('DROP TABLE IF EXISTS approval_workflows CASCADE;');
  }
};