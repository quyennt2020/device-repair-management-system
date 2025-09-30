import { Pool } from 'pg';
import { getDbConnection } from '../../../../shared/database/src/connection';

export async function seedApprovalWorkflows(): Promise<void> {
  const db: Pool = getDbConnection();

  console.log('Seeding approval workflows...');

  try {
    // First, get some document type IDs to reference
    const documentTypesResult = await db.query(`
      SELECT id, name FROM document_types 
      WHERE name IN ('Inspection Report', 'Quotation', 'Repair Report')
      LIMIT 3
    `);

    if (documentTypesResult.rows.length === 0) {
      console.log('No document types found. Please seed document types first.');
      return;
    }

    const inspectionReportTypeId = documentTypesResult.rows.find(row => row.name === 'Inspection Report')?.id;
    const quotationTypeId = documentTypesResult.rows.find(row => row.name === 'Quotation')?.id;
    const repairReportTypeId = documentTypesResult.rows.find(row => row.name === 'Repair Report')?.id;

    // Get some user IDs for approvers (assuming they exist from auth service seeds)
    const usersResult = await db.query(`
      SELECT id FROM users 
      WHERE role IN ('manager', 'director', 'quality_inspector')
      LIMIT 10
    `);

    const userIds = usersResult.rows.map(row => row.id);
    const managerIds = userIds.slice(0, 3);
    const directorIds = userIds.slice(3, 5);
    const qualityInspectorIds = userIds.slice(5, 8);

    // Create approval workflows
    const workflows = [
      {
        name: 'Standard Inspection Report Approval',
        description: 'Standard approval workflow for inspection reports',
        documentTypeIds: inspectionReportTypeId ? [inspectionReportTypeId] : [],
        levels: [
          {
            level: 1,
            name: 'Manager Review',
            approverType: 'user',
            approverIds: managerIds,
            requiredApprovals: 1,
            isParallel: false,
            timeoutHours: 24
          },
          {
            level: 2,
            name: 'Quality Inspector Verification',
            approverType: 'user',
            approverIds: qualityInspectorIds,
            requiredApprovals: 1,
            isParallel: false,
            timeoutHours: 48
          }
        ],
        escalationRules: [
          {
            fromLevel: 1,
            toLevel: 2,
            triggerAfterHours: 24,
            escalationType: 'timeout',
            notifyUsers: directorIds,
            autoApprove: false
          }
        ],
        notifications: [
          {
            type: 'approval_request',
            recipientType: 'approver',
            template: 'approval_request',
            channels: ['email', 'in_app'],
            triggerEvents: ['on_submit']
          }
        ]
      },
      {
        name: 'High-Value Quotation Approval',
        description: 'Multi-level approval for quotations over certain amount',
        documentTypeIds: quotationTypeId ? [quotationTypeId] : [],
        levels: [
          {
            level: 1,
            name: 'Manager Approval',
            approverType: 'user',
            approverIds: managerIds,
            requiredApprovals: 1,
            isParallel: false,
            timeoutHours: 12,
            skipConditions: [
              {
                field: 'totalAmount',
                operator: 'less_than',
                value: 5000000 // Skip if less than 5M VND
              }
            ]
          },
          {
            level: 2,
            name: 'Director Approval',
            approverType: 'user',
            approverIds: directorIds,
            requiredApprovals: 1,
            isParallel: false,
            timeoutHours: 24
          }
        ],
        escalationRules: [
          {
            fromLevel: 1,
            toLevel: 2,
            triggerAfterHours: 12,
            escalationType: 'timeout',
            notifyUsers: directorIds,
            autoApprove: false
          }
        ]
      },
      {
        name: 'Simple Repair Report Approval',
        description: 'Single-level approval for repair reports',
        documentTypeIds: repairReportTypeId ? [repairReportTypeId] : [],
        levels: [
          {
            level: 1,
            name: 'Quality Check',
            approverType: 'user',
            approverIds: qualityInspectorIds,
            requiredApprovals: 1,
            isParallel: false,
            timeoutHours: 8
          }
        ],
        escalationRules: [
          {
            fromLevel: 1,
            toLevel: 1, // Self-escalation (auto-approve)
            triggerAfterHours: 8,
            escalationType: 'timeout',
            notifyUsers: managerIds,
            autoApprove: true
          }
        ]
      },
      {
        name: 'Emergency Document Approval',
        description: 'Fast-track approval for emergency situations',
        documentTypeIds: [inspectionReportTypeId, quotationTypeId, repairReportTypeId].filter(Boolean),
        levels: [
          {
            level: 1,
            name: 'Emergency Approval',
            approverType: 'user',
            approverIds: [...managerIds, ...directorIds],
            requiredApprovals: 1,
            isParallel: true, // Any of the approvers can approve
            timeoutHours: 2
          }
        ],
        escalationRules: [
          {
            fromLevel: 1,
            toLevel: 1,
            triggerAfterHours: 2,
            escalationType: 'timeout',
            notifyUsers: directorIds,
            autoApprove: true
          }
        ]
      }
    ];

    // Insert workflows
    for (const workflow of workflows) {
      if (workflow.documentTypeIds.length === 0) {
        console.log(`Skipping workflow "${workflow.name}" - no document types available`);
        continue;
      }

      const result = await db.query(`
        INSERT INTO approval_workflows (
          name, description, document_type_ids, levels, 
          escalation_rules, delegation_rules, notifications, 
          is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name
      `, [
        workflow.name,
        workflow.description,
        JSON.stringify(workflow.documentTypeIds),
        JSON.stringify(workflow.levels),
        JSON.stringify(workflow.escalationRules || []),
        JSON.stringify([]), // delegation_rules
        JSON.stringify(workflow.notifications || []),
        true, // is_active
        userIds[0] || 'system' // created_by
      ]);

      console.log(`Created approval workflow: ${result.rows[0].name} (${result.rows[0].id})`);
    }

    // Update document types to reference their approval workflows
    if (inspectionReportTypeId) {
      const inspectionWorkflowResult = await db.query(`
        SELECT id FROM approval_workflows 
        WHERE name = 'Standard Inspection Report Approval'
        LIMIT 1
      `);
      
      if (inspectionWorkflowResult.rows.length > 0) {
        await db.query(`
          UPDATE document_types 
          SET approval_workflow_id = $1 
          WHERE id = $2
        `, [inspectionWorkflowResult.rows[0].id, inspectionReportTypeId]);
        
        console.log('Updated Inspection Report document type with approval workflow');
      }
    }

    if (quotationTypeId) {
      const quotationWorkflowResult = await db.query(`
        SELECT id FROM approval_workflows 
        WHERE name = 'High-Value Quotation Approval'
        LIMIT 1
      `);
      
      if (quotationWorkflowResult.rows.length > 0) {
        await db.query(`
          UPDATE document_types 
          SET approval_workflow_id = $1 
          WHERE id = $2
        `, [quotationWorkflowResult.rows[0].id, quotationTypeId]);
        
        console.log('Updated Quotation document type with approval workflow');
      }
    }

    if (repairReportTypeId) {
      const repairWorkflowResult = await db.query(`
        SELECT id FROM approval_workflows 
        WHERE name = 'Simple Repair Report Approval'
        LIMIT 1
      `);
      
      if (repairWorkflowResult.rows.length > 0) {
        await db.query(`
          UPDATE document_types 
          SET approval_workflow_id = $1 
          WHERE id = $2
        `, [repairWorkflowResult.rows[0].id, repairReportTypeId]);
        
        console.log('Updated Repair Report document type with approval workflow');
      }
    }

    console.log('Approval workflow seeding completed successfully');

  } catch (error) {
    console.error('Error seeding approval workflows:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedApprovalWorkflows()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}