import { db } from './connection';

export async function seedDatabase(): Promise<void> {
    try {
        console.log('🌱 Starting database seeding...');

        // Seed Device Types
        await seedDeviceTypes();

        // Seed Document Types
        await seedDocumentTypes();

        // Seed Workflow Definitions
        await seedWorkflowDefinitions();

        // Seed Sample Customers
        await seedSampleCustomers();

        // Seed Sample Technicians
        await seedSampleTechnicians();

        // Seed Sample Tools
        await seedSampleTools();

        // Seed Sample Parts
        await seedSampleParts();

        // Seed Sample Devices (connected to customers and device types)
        await seedSampleDevices();

        // Seed Sample Contracts (connected to customers)
        await seedSampleContracts();

        // Seed Sample Cases (connected to customers, devices, technicians)
        await seedSampleCases();

        console.log('✅ Database seeding completed successfully!');
    } catch (error) {
        console.error('❌ Database seeding failed:', error);
        throw error;
    }
}

async function seedDeviceTypes(): Promise<void> {
    console.log('📱 Seeding device types...');

    const deviceTypes = [
        {
            name: 'Máy đo X100',
            category: 'measurement',
            manufacturer: 'TechCorp',
            model_series: 'X100',
            specifications: JSON.stringify({
                accuracy: '±0.1%',
                range: '0-1000V',
                display: 'LCD'
            }),
            standard_service_hours: 2.5,
            required_certifications: JSON.stringify(['electronics-cert']),
            maintenance_checklist: JSON.stringify([
                'Check display functionality',
                'Calibrate measurement accuracy',
                'Inspect cables and connectors'
            ])
        },
        {
            name: 'Analyzer Pro 200',
            category: 'analysis',
            manufacturer: 'AnalyTech',
            model_series: 'Pro 200',
            specifications: JSON.stringify({
                channels: 8,
                frequency_range: '1Hz-100MHz',
                resolution: '16-bit'
            }),
            standard_service_hours: 4.0,
            required_certifications: JSON.stringify(['calibration-cert', 'electronics-cert']),
            maintenance_checklist: JSON.stringify([
                'Check all input channels',
                'Verify frequency response',
                'Update firmware if needed'
            ])
        }
    ];

    for (const deviceType of deviceTypes) {
        const existing = await db.query(`SELECT id FROM device_types WHERE name = $1 LIMIT 1`, [deviceType.name]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO device_types (name, category, manufacturer, model_series, specifications, standard_service_hours, required_certifications, maintenance_checklist)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
                deviceType.name,
                deviceType.category,
                deviceType.manufacturer,
                deviceType.model_series,
                deviceType.specifications,
                deviceType.standard_service_hours,
                deviceType.required_certifications,
                deviceType.maintenance_checklist
            ]);
        }
    }
}

async function seedDocumentTypes(): Promise<void> {
    console.log('📄 Seeding document types...');

    const documentTypes = [
        {
            name: 'Inspection Report',
            category: 'inspection_report',
            template_config: JSON.stringify({
                sections: ['basic_info', 'findings', 'recommendations', 'images'],
                required_fields: ['findings', 'severity_level']
            }),
            required_fields: JSON.stringify(['findings', 'severity_level', 'estimated_hours'])
        },
        {
            name: 'Repair Report',
            category: 'repair_report',
            template_config: JSON.stringify({
                sections: ['parts_replaced', 'procedures', 'test_results', 'images'],
                required_fields: ['procedures_performed', 'actual_hours']
            }),
            required_fields: JSON.stringify(['procedures_performed', 'actual_hours'])
        },
        {
            name: 'Quotation',
            category: 'quotation',
            template_config: JSON.stringify({
                sections: ['line_items', 'terms', 'validity'],
                required_fields: ['line_items', 'total_amount']
            }),
            required_fields: JSON.stringify(['line_items', 'total_amount', 'validity_period'])
        },
        {
            name: 'Maintenance Report',
            category: 'maintenance_report',
            template_config: JSON.stringify({
                sections: ['checklist', 'condition_assessment', 'recommendations'],
                required_fields: ['checklist_items', 'overall_condition']
            }),
            required_fields: JSON.stringify(['checklist_items', 'overall_condition'])
        },
        {
            name: 'Revised Quotation',
            category: 'quotation',
            template_config: JSON.stringify({
                sections: ['original_quote', 'revisions', 'new_total', 'justification'],
                required_fields: ['original_amount', 'revised_amount', 'discount_percentage', 'revision_reason']
            }),
            required_fields: JSON.stringify(['original_amount', 'revised_amount', 'discount_percentage'])
        },
        {
            name: 'Alternative Proposal',
            category: 'proposal',
            template_config: JSON.stringify({
                sections: ['current_issue', 'alternative_solutions', 'cost_comparison', 'recommendations'],
                required_fields: ['alternatives', 'recommended_option']
            }),
            required_fields: JSON.stringify(['alternatives', 'recommended_option'])
        },
        {
            name: 'Return Receipt',
            category: 'receipt',
            template_config: JSON.stringify({
                sections: ['device_condition', 'customer_acknowledgment', 'charges'],
                required_fields: ['return_condition', 'customer_signature', 'inspection_fee']
            }),
            required_fields: JSON.stringify(['return_condition', 'customer_signature'])
        },
        {
            name: 'VIP Quality Report',
            category: 'quality_report',
            template_config: JSON.stringify({
                sections: ['detailed_testing', 'performance_metrics', 'certification', 'warranty_extension'],
                required_fields: ['test_results', 'quality_score', 'certification_status']
            }),
            required_fields: JSON.stringify(['test_results', 'quality_score'])
        }
    ];

    for (const docType of documentTypes) {
        const existing = await db.query(`SELECT id FROM document_types WHERE name = $1 AND category = $2 LIMIT 1`, [docType.name, docType.category]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO document_types (name, category, template_config, required_fields)
        VALUES ($1, $2, $3, $4)
      `, [docType.name, docType.category, docType.template_config, docType.required_fields]);
        }
    }
}

async function seedWorkflowDefinitions(): Promise<void> {
    console.log('⚙️ Seeding workflow definitions...');

    const workflows = [
        {
            name: 'Standard Repair Workflow',
            version: '1.0',
            config: JSON.stringify({
                metadata: {
                    description: 'Standard repair workflow for regular customers',
                    category: 'repair',
                    estimatedDuration: '5-7 days',
                    applicableCustomerTiers: ['bronze', 'silver', 'gold']
                },
                startEvent: 'case_created',
                endEvents: ['completed', 'cancelled'],
                steps: [
                    {
                        id: 'start',
                        name: 'Workflow Start',
                        type: 'start_event',
                        isStartStep: true,
                        transitions: [{ to: 'registration', condition: 'always' }]
                    },
                    {
                        id: 'registration',
                        name: 'Đăng ký tiếp nhận',
                        type: 'manual',
                        assignmentRules: { role: 'customer_service' },
                        requiredDocuments: [],
                        transitions: [{ to: 'inspection', condition: 'status == completed' }]
                    },
                    {
                        id: 'inspection',
                        name: 'Kiểm tra thiết bị',
                        type: 'manual',
                        assignmentRules: { role: 'technician', skillLevelMin: 2 },
                        requiredDocuments: ['inspection_report'],
                        timeoutHours: 4,
                        transitions: [{ to: 'quotation', condition: 'inspection_report.status == approved' }]
                    },
                    {
                        id: 'quotation',
                        name: 'Tạo báo giá',
                        type: 'manual',
                        assignmentRules: { role: 'estimator' },
                        requiredDocuments: ['quotation'],
                        transitions: [{ to: 'customer_approval', condition: 'quotation.status == approved' }]
                    },
                    {
                        id: 'customer_approval',
                        name: 'Phê duyệt khách hàng',
                        type: 'external_approval',
                        timeoutHours: 72,
                        transitions: [
                            { to: 'repair', condition: 'customer_approval.status == approved' },
                            { to: 'quotation_revision', condition: 'customer_approval.status == rejected && customer_approval.reason == price_too_high' },
                            { to: 'alternative_solution', condition: 'customer_approval.status == rejected && customer_approval.reason == scope_change' },
                            { to: 'device_return', condition: 'customer_approval.status == rejected && customer_approval.reason == no_repair' },
                            { to: 'cancelled', condition: 'customer_approval.status == timeout' }
                        ]
                    },
                    {
                        id: 'quotation_revision',
                        name: 'Điều chỉnh báo giá',
                        type: 'manual',
                        assignmentRules: { role: 'estimator' },
                        requiredDocuments: ['revised_quotation'],
                        transitions: [
                            { to: 'manager_review', condition: 'revised_quotation.discount > 10' },
                            { to: 'customer_approval', condition: 'revised_quotation.discount <= 10' }
                        ]
                    },
                    {
                        id: 'manager_review',
                        name: 'Phê duyệt giảm giá',
                        type: 'approval',
                        assignmentRules: { role: 'manager' },
                        transitions: [
                            { to: 'customer_approval', condition: 'manager_review.status == approved' },
                            { to: 'alternative_solution', condition: 'manager_review.status == rejected' }
                        ]
                    },
                    {
                        id: 'alternative_solution',
                        name: 'Đề xuất giải pháp thay thế',
                        type: 'manual',
                        assignmentRules: { role: 'senior_technician' },
                        requiredDocuments: ['alternative_proposal'],
                        transitions: [
                            { to: 'customer_approval', condition: 'alternative_proposal.status == approved' },
                            { to: 'device_return', condition: 'alternative_proposal.status == rejected' }
                        ]
                    },
                    {
                        id: 'device_return',
                        name: 'Trả thiết bị cho khách hàng',
                        type: 'manual',
                        assignmentRules: { role: 'customer_service' },
                        requiredDocuments: ['return_receipt'],
                        chargeable: true, // Có thể tính phí inspection
                        transitions: [
                            { to: 'completed', condition: 'return_receipt.status == completed' }
                        ]
                    },
                    {
                        id: 'repair',
                        name: 'Thực hiện sửa chữa',
                        type: 'manual',
                        assignmentRules: { role: 'technician', skillLevelMin: 3 },
                        requiredDocuments: ['repair_report'],
                        transitions: [{ to: 'quality_check', condition: 'repair_report.status == approved' }]
                    },
                    {
                        id: 'quality_check',
                        name: 'Kiểm tra chất lượng',
                        type: 'manual',
                        assignmentRules: { role: 'quality_inspector' },
                        transitions: [
                            { to: 'delivery', condition: 'quality_check.result == pass' },
                            { to: 'repair', condition: 'quality_check.result == fail' }
                        ]
                    },
                    {
                        id: 'delivery',
                        name: 'Giao hàng',
                        type: 'manual',
                        assignmentRules: { role: 'delivery_staff' },
                        transitions: [{ to: 'completed', condition: 'delivery.status == completed' }]
                    },
                    {
                        id: 'completed',
                        name: 'Hoàn thành',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'completed',
                        actions: ['send_completion_notification', 'update_device_history', 'close_case']
                    },
                    {
                        id: 'cancelled',
                        name: 'Hủy bỏ',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'cancelled',
                        actions: ['send_cancellation_notification', 'release_resources', 'close_case']
                    }
                ],
                businessRules: [
                    {
                        id: 'max_revision_attempts',
                        description: 'Maximum 2 quotation revisions allowed',
                        condition: 'quotation_revision.attempts <= 2',
                        action: 'block_further_revisions'
                    },
                    {
                        id: 'auto_cancel_timeout',
                        description: 'Auto cancel if customer no response for 7 days',
                        condition: 'customer_approval.pending_days >= 7',
                        action: 'auto_cancel_case'
                    }
                ],
                escalationRules: [
                    {
                        stepId: 'customer_approval',
                        timeoutHours: 72,
                        escalationLevels: [
                            { level: 1, afterHours: 48, notifyRoles: ['account_manager'] },
                            { level: 2, afterHours: 72, notifyRoles: ['sales_manager'] }
                        ]
                    }
                ]
            })
        },
        {
            name: 'Warranty Repair Workflow',
            version: '1.0',
            config: JSON.stringify({
                metadata: {
                    description: 'Fast-track workflow for warranty repairs',
                    category: 'warranty_repair',
                    estimatedDuration: '1-2 days',
                    applicableCustomerTiers: ['all'],
                    prerequisites: ['valid_warranty']
                },
                startEvent: 'warranty_case_created',
                endEvents: ['completed', 'transferred_to_standard'],
                steps: [
                    {
                        id: 'start',
                        name: 'Warranty Workflow Start',
                        type: 'start_event',
                        isStartStep: true,
                        transitions: [{ to: 'warranty_verification', condition: 'always' }]
                    },
                    {
                        id: 'warranty_verification',
                        name: 'Xác minh bảo hành',
                        type: 'automatic',
                        systemAction: 'checkWarrantyStatus',
                        transitions: [
                            { to: 'fast_inspection', condition: 'warranty.status == valid' },
                            { to: 'standard_flow', condition: 'warranty.status == expired' }
                        ]
                    },
                    {
                        id: 'fast_inspection',
                        name: 'Kiểm tra nhanh',
                        type: 'manual',
                        assignmentRules: { role: 'technician', skillLevelMin: 2 },
                        requiredDocuments: ['inspection_report'],
                        timeoutHours: 2,
                        transitions: [{ to: 'warranty_repair', condition: 'inspection.covered_by_warranty == true' }]
                    },
                    {
                        id: 'warranty_repair',
                        name: 'Sửa chữa bảo hành',
                        type: 'manual',
                        assignmentRules: { role: 'technician' },
                        requiredDocuments: ['repair_report'],
                        chargeable: false,
                        transitions: [{ to: 'delivery', condition: 'repair.status == completed' }]
                    },
                    {
                        id: 'delivery',
                        name: 'Giao hàng',
                        type: 'manual',
                        chargeable: false,
                        transitions: [{ to: 'completed', condition: 'delivery.status == completed' }]
                    },
                    {
                        id: 'completed',
                        name: 'Hoàn thành bảo hành',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'completed',
                        actions: ['send_warranty_completion_notification', 'update_warranty_record', 'close_case']
                    },
                    {
                        id: 'transferred_to_standard',
                        name: 'Chuyển sang quy trình tiêu chuẩn',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'transferred',
                        actions: ['create_standard_case', 'transfer_case_data', 'notify_customer']
                    }
                ],
                businessRules: [
                    {
                        id: 'warranty_validity_check',
                        description: 'Must verify warranty is valid and covers the issue',
                        condition: 'warranty.status == valid && warranty.covers_issue == true',
                        action: 'proceed_with_warranty_repair'
                    },
                    {
                        id: 'warranty_exclusion_check',
                        description: 'Check if issue is excluded from warranty',
                        condition: 'issue.type in warranty.exclusions',
                        action: 'transfer_to_standard_workflow'
                    }
                ],
                escalationRules: [
                    {
                        stepId: 'warranty_verification',
                        timeoutHours: 2,
                        escalationLevels: [
                            { level: 1, afterHours: 1, notifyRoles: ['warranty_manager'] }
                        ]
                    }
                ]
            })
        },
        {
            name: 'Premium Customer Workflow',
            version: '1.0',
            config: JSON.stringify({
                metadata: {
                    description: 'VIP workflow with premium services and multiple options',
                    category: 'premium_repair',
                    estimatedDuration: '2-4 days',
                    applicableCustomerTiers: ['platinum'],
                    specialFeatures: ['dedicated_account_manager', 'priority_handling', 'multiple_alternatives']
                },
                startEvent: 'vip_case_created',
                endEvents: ['completed', 'compensated', 'escalated_to_executive'],
                steps: [
                    {
                        id: 'start',
                        name: 'VIP Workflow Start',
                        type: 'start_event',
                        isStartStep: true,
                        transitions: [{ to: 'vip_registration', condition: 'always' }]
                    },
                    {
                        id: 'vip_registration',
                        name: 'Đăng ký VIP',
                        type: 'manual',
                        assignmentRules: { role: 'account_manager' },
                        requiredDocuments: [],
                        transitions: [{ to: 'priority_inspection', condition: 'status == completed' }]
                    },
                    {
                        id: 'priority_inspection',
                        name: 'Kiểm tra ưu tiên',
                        type: 'manual',
                        assignmentRules: { role: 'senior_technician', skillLevelMin: 4 },
                        requiredDocuments: ['detailed_inspection_report'],
                        timeoutHours: 2, // Nhanh hơn cho VIP
                        transitions: [
                            { to: 'pre_approved_repair', condition: 'inspection.estimated_cost <= customer.pre_approved_limit' },
                            { to: 'vip_quotation', condition: 'inspection.estimated_cost > customer.pre_approved_limit' }
                        ]
                    },
                    {
                        id: 'pre_approved_repair',
                        name: 'Sửa chữa được pre-approve',
                        type: 'manual',
                        assignmentRules: { role: 'senior_technician' },
                        requiredDocuments: ['repair_report'],
                        autoStart: true, // Tự động bắt đầu không cần approval
                        transitions: [{ to: 'quality_check', condition: 'repair_report.status == approved' }]
                    },
                    {
                        id: 'vip_quotation',
                        name: 'Báo giá VIP',
                        type: 'manual',
                        assignmentRules: { role: 'account_manager' },
                        requiredDocuments: ['vip_quotation'],
                        transitions: [
                            { to: 'customer_consultation', condition: 'vip_quotation.status == approved' }
                        ]
                    },
                    {
                        id: 'customer_consultation',
                        name: 'Tư vấn khách hàng',
                        type: 'manual',
                        assignmentRules: { role: 'account_manager' },
                        timeoutHours: 24, // VIP có thời gian tư vấn lâu hơn
                        transitions: [
                            { to: 'pre_approved_repair', condition: 'consultation.result == approved' },
                            { to: 'negotiation', condition: 'consultation.result == negotiate' },
                            { to: 'alternative_options', condition: 'consultation.result == alternatives' },
                            { to: 'vip_device_return', condition: 'consultation.result == declined' }
                        ]
                    },
                    {
                        id: 'negotiation',
                        name: 'Đàm phán với khách hàng',
                        type: 'manual',
                        assignmentRules: { role: 'sales_manager' },
                        maxIterations: 3, // Tối đa 3 lần đàm phán
                        transitions: [
                            { to: 'pre_approved_repair', condition: 'negotiation.result == agreed' },
                            { to: 'alternative_options', condition: 'negotiation.iterations >= 3 && negotiation.result == no_agreement' }
                        ]
                    },
                    {
                        id: 'alternative_options',
                        name: 'Đề xuất các lựa chọn khác',
                        type: 'manual',
                        assignmentRules: { role: 'technical_consultant' },
                        requiredDocuments: ['alternative_options_report'],
                        transitions: [
                            { to: 'customer_consultation', condition: 'alternatives.customer_interested == true' },
                            { to: 'partial_repair', condition: 'alternatives.selected_option == partial' },
                            { to: 'upgrade_proposal', condition: 'alternatives.selected_option == upgrade' },
                            { to: 'vip_device_return', condition: 'alternatives.selected_option == none' }
                        ]
                    },
                    {
                        id: 'partial_repair',
                        name: 'Sửa chữa một phần',
                        type: 'manual',
                        assignmentRules: { role: 'technician' },
                        requiredDocuments: ['partial_repair_report'],
                        transitions: [
                            { to: 'quality_check', condition: 'partial_repair.status == completed' }
                        ]
                    },
                    {
                        id: 'upgrade_proposal',
                        name: 'Đề xuất nâng cấp thiết bị',
                        type: 'manual',
                        assignmentRules: { role: 'sales_engineer' },
                        requiredDocuments: ['upgrade_proposal'],
                        transitions: [
                            { to: 'upgrade_execution', condition: 'upgrade_proposal.customer_approved == true' },
                            { to: 'vip_device_return', condition: 'upgrade_proposal.customer_approved == false' }
                        ]
                    },
                    {
                        id: 'upgrade_execution',
                        name: 'Thực hiện nâng cấp',
                        type: 'manual',
                        assignmentRules: { role: 'senior_technician', requiredCertifications: ['upgrade-cert'] },
                        requiredDocuments: ['upgrade_report'],
                        transitions: [
                            { to: 'quality_check', condition: 'upgrade.status == completed' }
                        ]
                    },
                    {
                        id: 'vip_device_return',
                        name: 'Trả thiết bị VIP',
                        type: 'manual',
                        assignmentRules: { role: 'account_manager' },
                        requiredDocuments: ['vip_return_receipt'],
                        chargeable: false, // VIP không tính phí inspection
                        specialServices: ['free_pickup', 'detailed_report', 'future_discount'],
                        transitions: [
                            { to: 'completed', condition: 'vip_return.status == completed' }
                        ]
                    },
                    {
                        id: 'quality_check',
                        name: 'Kiểm tra chất lượng VIP',
                        type: 'manual',
                        assignmentRules: { role: 'quality_manager' }, // Cao cấp hơn cho VIP
                        requiredDocuments: ['vip_quality_report'],
                        transitions: [
                            { to: 'vip_delivery', condition: 'quality_check.result == pass' },
                            { to: 'pre_approved_repair', condition: 'quality_check.result == fail && quality_check.retry_count < 2' },
                            { to: 'escalation', condition: 'quality_check.result == fail && quality_check.retry_count >= 2' }
                        ]
                    },
                    {
                        id: 'escalation',
                        name: 'Báo cáo cấp cao',
                        type: 'manual',
                        assignmentRules: { role: 'service_director' },
                        urgency: 'high',
                        transitions: [
                            { to: 'replacement_device', condition: 'escalation.decision == replace' },
                            { to: 'expert_repair', condition: 'escalation.decision == expert_repair' },
                            { to: 'compensation', condition: 'escalation.decision == compensate' }
                        ]
                    },
                    {
                        id: 'replacement_device',
                        name: 'Thay thế thiết bị mới',
                        type: 'manual',
                        assignmentRules: { role: 'inventory_manager' },
                        transitions: [{ to: 'vip_delivery' }]
                    },
                    {
                        id: 'expert_repair',
                        name: 'Sửa chữa bởi chuyên gia',
                        type: 'manual',
                        assignmentRules: { role: 'expert_technician', skillLevelMin: 5 },
                        requiredDocuments: ['expert_repair_report'],
                        transitions: [{ to: 'quality_check' }]
                    },
                    {
                        id: 'compensation',
                        name: 'Bồi thường khách hàng',
                        type: 'manual',
                        assignmentRules: { role: 'customer_relations' },
                        requiredDocuments: ['compensation_agreement'],
                        transitions: [{ to: 'completed' }]
                    },
                    {
                        id: 'vip_delivery',
                        name: 'Giao hàng VIP',
                        type: 'manual',
                        assignmentRules: { role: 'vip_delivery_team' },
                        specialServices: ['white_glove_delivery', 'installation_support', 'training'],
                        transitions: [{ to: 'completed', condition: 'delivery.status == completed' }]
                    },
                    {
                        id: 'completed',
                        name: 'Hoàn thành VIP',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'completed',
                        actions: [
                            'send_vip_completion_notification',
                            'schedule_follow_up_call',
                            'update_customer_satisfaction',
                            'offer_extended_warranty',
                            'close_case'
                        ]
                    },
                    {
                        id: 'compensated',
                        name: 'Đã bồi thường',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'compensated',
                        actions: [
                            'process_compensation_payment',
                            'send_apology_letter',
                            'schedule_executive_follow_up',
                            'close_case'
                        ]
                    },
                    {
                        id: 'escalated_to_executive',
                        name: 'Báo cáo ban điều hành',
                        type: 'end_event',
                        isEndStep: true,
                        finalStatus: 'escalated',
                        actions: [
                            'create_executive_report',
                            'schedule_executive_meeting',
                            'prepare_action_plan',
                            'maintain_case_open'
                        ]
                    }
                ],
                businessRules: [
                    {
                        id: 'vip_pre_approval_limit',
                        description: 'VIP customers have pre-approved repair limit',
                        condition: 'estimated_cost <= customer.vip_pre_approval_limit',
                        action: 'auto_approve_repair'
                    },
                    {
                        id: 'vip_escalation_threshold',
                        description: 'Escalate to executive if quality fails twice',
                        condition: 'quality_check.fail_count >= 2',
                        action: 'escalate_to_executive'
                    },
                    {
                        id: 'vip_compensation_trigger',
                        description: 'Automatic compensation for delays over 48 hours',
                        condition: 'case.duration_hours > 48',
                        action: 'offer_compensation'
                    }
                ],
                escalationRules: [
                    {
                        stepId: 'customer_consultation',
                        timeoutHours: 24,
                        escalationLevels: [
                            { level: 1, afterHours: 12, notifyRoles: ['account_manager'] },
                            { level: 2, afterHours: 24, notifyRoles: ['sales_director'] }
                        ]
                    },
                    {
                        stepId: 'escalation',
                        timeoutHours: 4,
                        escalationLevels: [
                            { level: 1, afterHours: 2, notifyRoles: ['service_director'] },
                            { level: 2, afterHours: 4, notifyRoles: ['ceo'] }
                        ]
                    }
                ]
            })
        }
    ];

    for (const workflow of workflows) {
        const existing = await db.query(`SELECT id FROM workflow_definitions WHERE name = $1 AND version = $2 LIMIT 1`, [workflow.name, workflow.version]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO workflow_definitions (name, version, config)
        VALUES ($1, $2, $3)
      `, [workflow.name, workflow.version, workflow.config]);
        }
    }
}

async function seedSampleCustomers(): Promise<void> {
    console.log('👥 Seeding sample customers...');

    const customers = [
        {
            customer_code: 'CUST-001',
            customer_type: 'company',
            company_name: 'Công ty ABC',
            tax_code: '0123456789',
            industry: 'Manufacturing',
            contact_info: JSON.stringify({
                email: 'contact@abc.com',
                phone: '+84-123-456-789',
                contact_person: 'Nguyễn Văn A'
            }),
            address_info: JSON.stringify({
                address: '123 Nguyễn Trãi',
                city: 'Hà Nội',
                country: 'Vietnam'
            }),
            customer_tier: 'gold',
            credit_limit: 50000000,
            payment_terms: 30
        },
        {
            customer_code: 'CUST-002',
            customer_type: 'company',
            company_name: 'Công ty XYZ',
            tax_code: '0987654321',
            industry: 'Technology',
            contact_info: JSON.stringify({
                email: 'info@xyz.com',
                phone: '+84-987-654-321',
                contact_person: 'Trần Thị B'
            }),
            address_info: JSON.stringify({
                address: '456 Lê Lợi',
                city: 'TP.HCM',
                country: 'Vietnam'
            }),
            customer_tier: 'silver',
            credit_limit: 30000000,
            payment_terms: 15
        }
    ];

    for (const customer of customers) {
        const existing = await db.query(`SELECT id FROM customers WHERE customer_code = $1 LIMIT 1`, [customer.customer_code]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO customers (customer_code, customer_type, company_name, tax_code, industry, contact_info, address_info, customer_tier, credit_limit, payment_terms)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
                customer.customer_code,
                customer.customer_type,
                customer.company_name,
                customer.tax_code,
                customer.industry,
                customer.contact_info,
                customer.address_info,
                customer.customer_tier,
                customer.credit_limit,
                customer.payment_terms
            ]);
        }
    }
}

async function seedSampleTechnicians(): Promise<void> {
    console.log('🔧 Seeding sample technicians...');

    const technicians = [
        {
            employee_id: 'TECH-001',
            first_name: 'Văn Tâm',
            last_name: 'Nguyễn',
            email: 'tam.nguyen@company.com',
            phone: '+84-123-111-111',
            hire_date: '2020-01-15',
            department: 'Technical Services',
            position: 'Senior Technician',
            status: 'active'
        },
        {
            employee_id: 'TECH-002',
            first_name: 'Thị Lan',
            last_name: 'Trần',
            email: 'lan.tran@company.com',
            phone: '+84-123-222-222',
            hire_date: '2021-06-01',
            department: 'Technical Services',
            position: 'Technician',
            status: 'active'
        }
    ];

    for (const technician of technicians) {
        const existing = await db.query(`SELECT id FROM technicians WHERE employee_id = $1 LIMIT 1`, [technician.employee_id]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO technicians (employee_id, first_name, last_name, email, phone, hire_date, department, position, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
                technician.employee_id,
                technician.first_name,
                technician.last_name,
                technician.email,
                technician.phone,
                technician.hire_date,
                technician.department,
                technician.position,
                technician.status
            ]);
        }
    }
}

async function seedSampleTools(): Promise<void> {
    console.log('🔨 Seeding sample tools...');

    const tools = [
        {
            tool_code: 'TOOL-001',
            tool_name: 'Digital Multimeter',
            category: 'measurement',
            manufacturer: 'Fluke',
            model: '87V',
            serial_number: 'FL87V001',
            purchase_date: '2023-01-15',
            purchase_cost: 5000000,
            location: 'Workshop A',
            calibration_required: true,
            last_calibration_date: '2024-01-15',
            next_calibration_date: '2025-01-15',
            required_for_device_types: JSON.stringify(['measurement-device-x100']),
            specifications: JSON.stringify({
                accuracy: '±0.05%',
                range: '0-1000V DC/AC'
            })
        },
        {
            tool_code: 'TOOL-002',
            tool_name: 'Calibration Kit',
            category: 'calibration',
            manufacturer: 'Keysight',
            model: 'E5071C',
            serial_number: 'KS5071001',
            purchase_date: '2023-03-20',
            purchase_cost: 25000000,
            location: 'Calibration Lab',
            calibration_required: true,
            last_calibration_date: '2024-03-20',
            next_calibration_date: '2025-03-20',
            required_for_device_types: JSON.stringify(['analyzer-pro-200']),
            specifications: JSON.stringify({
                frequency_range: '300kHz-20GHz',
                accuracy: '±0.01%'
            })
        }
    ];

    for (const tool of tools) {
        const existing = await db.query(`SELECT id FROM service_tools WHERE tool_code = $1 LIMIT 1`, [tool.tool_code]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO service_tools (tool_code, tool_name, category, manufacturer, model, serial_number, purchase_date, purchase_cost, location, calibration_required, last_calibration_date, next_calibration_date, required_for_device_types, specifications)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
                tool.tool_code,
                tool.tool_name,
                tool.category,
                tool.manufacturer,
                tool.model,
                tool.serial_number,
                tool.purchase_date,
                tool.purchase_cost,
                tool.location,
                tool.calibration_required,
                tool.last_calibration_date,
                tool.next_calibration_date,
                tool.required_for_device_types,
                tool.specifications
            ]);
        }
    }
}

async function seedSampleParts(): Promise<void> {
    console.log('🔩 Seeding sample parts...');

    // First create a warehouse
    const existingWarehouse = await db.query(`SELECT id FROM warehouses WHERE warehouse_code = 'WH-001' LIMIT 1`);
    if (existingWarehouse.rows.length === 0) {
        await db.query(`
      INSERT INTO warehouses (warehouse_name, warehouse_code, location, status)
      VALUES ('Main Warehouse', 'WH-001', 'Hà Nội', 'active')
    `);
    }

    const parts = [
        {
            part_number: 'LCD-X100-001',
            part_name: 'LCD Display Module',
            category: 'Display',
            manufacturer: 'TechCorp',
            specifications: JSON.stringify({
                size: '3.5 inch',
                resolution: '320x240',
                backlight: 'LED'
            }),
            compatible_devices: JSON.stringify(['measurement-device-x100']),
            pricing_info: JSON.stringify({
                unit_cost: 2000000,
                selling_price: 2500000,
                currency: 'VND'
            }),
            inventory_settings: JSON.stringify({
                reorder_level: 5,
                reorder_quantity: 20,
                lead_time_days: 14
            })
        },
        {
            part_number: 'CAP-470-25',
            part_name: 'Capacitor 470uF/25V',
            category: 'Electronic Components',
            manufacturer: 'Panasonic',
            specifications: JSON.stringify({
                capacitance: '470uF',
                voltage: '25V',
                tolerance: '±20%'
            }),
            compatible_devices: JSON.stringify(['measurement-device-x100', 'analyzer-pro-200']),
            pricing_info: JSON.stringify({
                unit_cost: 40000,
                selling_price: 50000,
                currency: 'VND'
            }),
            inventory_settings: JSON.stringify({
                reorder_level: 50,
                reorder_quantity: 200,
                lead_time_days: 7
            })
        }
    ];

    for (const part of parts) {
        const existing = await db.query(`SELECT id FROM spare_parts WHERE part_number = $1 LIMIT 1`, [part.part_number]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO spare_parts (part_number, part_name, category, manufacturer, specifications, compatible_devices, pricing_info, inventory_settings)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
                part.part_number,
                part.part_name,
                part.category,
                part.manufacturer,
                part.specifications,
                part.compatible_devices,
                part.pricing_info,
                part.inventory_settings
            ]);
        }

        // Add initial inventory
        await db.query(`
      INSERT INTO part_inventory (spare_part_id, warehouse_id, quantity_available, minimum_stock, maximum_stock)
      SELECT sp.id, w.id, 100, 10, 500
      FROM spare_parts sp, warehouses w
      WHERE sp.part_number = $1 AND w.warehouse_code = 'WH-001'
      AND NOT EXISTS (
        SELECT 1 FROM part_inventory pi
        WHERE pi.spare_part_id = sp.id AND pi.warehouse_id = w.id
      )
    `, [part.part_number]);
    }
}

async function seedSampleDevices(): Promise<void> {
    console.log('📱 Seeding sample devices...');

    const devices = [
        {
            device_code: 'DEV-001',
            serial_number: 'X100-2023-001',
            manufacturer: 'TechCorp',
            model: 'X100',
            status: 'active'
        },
        {
            device_code: 'DEV-002',
            serial_number: 'PRO200-2023-002',
            manufacturer: 'AnalyTech',
            model: 'Pro 200',
            status: 'active'
        },
        {
            device_code: 'DEV-003',
            serial_number: 'X100-2022-003',
            manufacturer: 'TechCorp',
            model: 'X100',
            status: 'in_repair'
        }
    ];

    for (const device of devices) {
        const existing = await db.query(`SELECT id FROM devices WHERE device_code = $1 LIMIT 1`, [device.device_code]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO devices (device_code, serial_number, manufacturer, model, status, device_type_id, customer_id)
        SELECT $1, $2, $3, $4, $5,
          (SELECT id FROM device_types WHERE manufacturer = $3 LIMIT 1),
          (SELECT id FROM customers LIMIT 1)
      `, [
                device.device_code,
                device.serial_number,
                device.manufacturer,
                device.model,
                device.status
            ]);
        }
    }
}

async function seedSampleContracts(): Promise<void> {
    console.log('📋 Seeding sample contracts...');

    const contracts = [
        {
            contract_number: 'CNT-2024-001',
            customer_id: '(SELECT id FROM customers WHERE customer_code = \'CUST-001\' LIMIT 1)',
            contract_type: 'maintenance',
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            value: 120000000,
            currency: 'VND',
            payment_schedule: 'quarterly',
            status: 'active',
            response_time_hours: 24,
            resolution_time_hours: 72,
            annual_visit_quota: 12
        },
        {
            contract_number: 'CNT-2024-002',
            customer_id: '(SELECT id FROM customers WHERE customer_code = \'CUST-002\' LIMIT 1)',
            contract_type: 'full_service',
            start_date: '2024-02-01',
            end_date: '2025-01-31',
            value: 200000000,
            currency: 'VND',
            payment_schedule: 'monthly',
            status: 'active',
            response_time_hours: 12,
            resolution_time_hours: 48,
            annual_visit_quota: 24
        }
    ];

    for (const contract of contracts) {
        const existing = await db.query(`SELECT id FROM service_contracts WHERE contract_number = $1 LIMIT 1`, [contract.contract_number]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO service_contracts (contract_number, customer_id, contract_type, start_date, end_date, value, currency, payment_schedule, status, response_time_hours, resolution_time_hours, annual_visit_quota)
        SELECT $1, ${contract.customer_id}, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      `, [
                contract.contract_number,
                contract.contract_type,
                contract.start_date,
                contract.end_date,
                contract.value,
                contract.currency,
                contract.payment_schedule,
                contract.status,
                contract.response_time_hours,
                contract.resolution_time_hours,
                contract.annual_visit_quota
            ]);
        }
    }
}

async function seedSampleCases(): Promise<void> {
    console.log('🔧 Seeding sample cases...');

    const cases = [
        {
            case_number: 'CASE-2024-001',
            case_type: 'maintenance',
            priority: 'medium',
            status: 'in_progress',
            reported_issue: 'Màn hình LCD hiển thị không rõ',
            diagnosis: 'LCD bị mờ do ánh sáng nền yếu'
        },
        {
            case_number: 'CASE-2024-002',
            case_type: 'repair',
            priority: 'high',
            status: 'assigned',
            reported_issue: 'Kênh 3 và 4 không đọc được tín hiệu',
            diagnosis: null
        },
        {
            case_number: 'CASE-2024-003',
            case_type: 'calibration',
            priority: 'low',
            status: 'completed',
            reported_issue: 'Hiệu chuẩn định kỳ hàng năm',
            diagnosis: 'Độ chính xác sai lệch 0.3%'
        }
    ];

    for (const repairCase of cases) {
        const existing = await db.query(`SELECT id FROM repair_cases WHERE case_number = $1 LIMIT 1`, [repairCase.case_number]);
        if (existing.rows.length === 0) {
            await db.query(`
        INSERT INTO repair_cases (case_number, customer_id, device_id, case_type, priority, status, reported_issue, diagnosis)
        SELECT $1,
          (SELECT id FROM customers LIMIT 1),
          (SELECT id FROM devices LIMIT 1),
          $2, $3, $4, $5, $6
      `, [
                repairCase.case_number,
                repairCase.case_type,
                repairCase.priority,
                repairCase.status,
                repairCase.reported_issue,
                repairCase.diagnosis
            ]);
        }
    }

    // Assign technicians to cases
    console.log('👷 Assigning technicians to cases...');

    await db.query(`
    INSERT INTO case_assignments (case_id, technician_id, assignment_type, assigned_date, status)
    SELECT
      rc.id,
      t.id,
      'primary',
      NOW(),
      'active'
    FROM repair_cases rc
    CROSS JOIN technicians t
    WHERE rc.case_number = 'CASE-2024-001' AND t.employee_id = 'TECH-001'
    AND NOT EXISTS (
      SELECT 1 FROM case_assignments ca
      WHERE ca.case_id = rc.id AND ca.technician_id = t.id
    )
  `);

    await db.query(`
    INSERT INTO case_assignments (case_id, technician_id, assignment_type, assigned_date, status)
    SELECT
      rc.id,
      t.id,
      'primary',
      NOW(),
      'active'
    FROM repair_cases rc
    CROSS JOIN technicians t
    WHERE rc.case_number = 'CASE-2024-002' AND t.employee_id = 'TECH-002'
    AND NOT EXISTS (
      SELECT 1 FROM case_assignments ca
      WHERE ca.case_id = rc.id AND ca.technician_id = t.id
    )
  `);

    await db.query(`
    INSERT INTO case_assignments (case_id, technician_id, assignment_type, assigned_date, status, completion_date)
    SELECT
      rc.id,
      t.id,
      'primary',
      '2024-09-15',
      'completed',
      '2024-09-15'
    FROM repair_cases rc
    CROSS JOIN technicians t
    WHERE rc.case_number = 'CASE-2024-003' AND t.employee_id = 'TECH-001'
    AND NOT EXISTS (
      SELECT 1 FROM case_assignments ca
      WHERE ca.case_id = rc.id AND ca.technician_id = t.id
    )
  `);

    // Assign tools to cases
    console.log('🔨 Assigning tools to cases...');

    await db.query(`
    INSERT INTO tool_assignments (tool_id, case_id, technician_id, checkout_date, status)
    SELECT
      st.id,
      rc.id,
      t.id,
      NOW(),
      'active'
    FROM service_tools st
    CROSS JOIN repair_cases rc
    CROSS JOIN technicians t
    WHERE st.tool_code = 'TOOL-001'
      AND rc.case_number = 'CASE-2024-001'
      AND t.employee_id = 'TECH-001'
    AND NOT EXISTS (
      SELECT 1 FROM tool_assignments ta
      WHERE ta.tool_id = st.id AND ta.case_id = rc.id
    )
  `);

    await db.query(`
    INSERT INTO tool_assignments (tool_id, case_id, technician_id, checkout_date, status)
    SELECT
      st.id,
      rc.id,
      t.id,
      NOW(),
      'active'
    FROM service_tools st
    CROSS JOIN repair_cases rc
    CROSS JOIN technicians t
    WHERE st.tool_code = 'TOOL-002'
      AND rc.case_number = 'CASE-2024-002'
      AND t.employee_id = 'TECH-002'
    AND NOT EXISTS (
      SELECT 1 FROM tool_assignments ta
      WHERE ta.tool_id = st.id AND ta.case_id = rc.id
    )
  `);
}

// Run seeding if this file is executed directly
if (require.main === module) {
    seedDatabase()
        .then(() => {
            console.log('✅ Seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}