import { Pool } from 'pg';
import { getDbConnection } from '@drms/shared-database';

export async function seedDocumentTypes() {
  const db = getDbConnection();

  const documentTypes = [
    {
      name: 'Standard Inspection Report',
      category: 'inspection_report',
      template_config: {
        sections: ['basic_info', 'findings', 'recommendations'],
        requiredFields: [
          'device_serial_number',
          'inspection_date',
          'technician_id',
          'findings',
          'severity_level',
          'estimated_hours'
        ],
        optionalFields: [
          'recommended_parts',
          'images',
          'technician_notes',
          'customer_present'
        ],
        validationRules: [
          {
            field: 'estimated_hours',
            type: 'range',
            value: { min: 0.5, max: 40 },
            message: 'Estimated hours must be between 0.5 and 40'
          },
          {
            field: 'device_serial_number',
            type: 'required',
            value: true,
            message: 'Device serial number is required'
          }
        ],
        layout: {
          columns: 2,
          sections: [
            {
              id: 'basic_info',
              title: 'Basic Information',
              fields: ['device_serial_number', 'inspection_date', 'technician_id'],
              order: 1,
              collapsible: false
            },
            {
              id: 'findings',
              title: 'Inspection Findings',
              fields: ['findings', 'severity_level', 'images'],
              order: 2,
              collapsible: false
            },
            {
              id: 'recommendations',
              title: 'Recommendations',
              fields: ['recommended_parts', 'estimated_hours', 'technician_notes'],
              order: 3,
              collapsible: true
            }
          ]
        }
      },
      required_fields: [
        'device_serial_number',
        'inspection_date',
        'technician_id',
        'findings',
        'severity_level',
        'estimated_hours'
      ],
      is_active: true
    },
    {
      name: 'Standard Repair Report',
      category: 'repair_report',
      template_config: {
        sections: ['basic_info', 'work_performed', 'results', 'feedback'],
        requiredFields: [
          'repair_date',
          'technician_id',
          'procedures_performed',
          'actual_hours',
          'test_results'
        ],
        optionalFields: [
          'parts_replaced',
          'before_images',
          'after_images',
          'technician_notes',
          'customer_satisfaction_rating'
        ],
        validationRules: [
          {
            field: 'actual_hours',
            type: 'range',
            value: { min: 0.1, max: 50 },
            message: 'Actual hours must be between 0.1 and 50'
          },
          {
            field: 'customer_satisfaction_rating',
            type: 'range',
            value: { min: 1, max: 5 },
            message: 'Customer satisfaction rating must be between 1 and 5'
          }
        ],
        layout: {
          columns: 1,
          sections: [
            {
              id: 'basic_info',
              title: 'Repair Information',
              fields: ['repair_date', 'technician_id', 'actual_hours'],
              order: 1,
              collapsible: false
            },
            {
              id: 'work_performed',
              title: 'Work Performed',
              fields: ['procedures_performed', 'parts_replaced'],
              order: 2,
              collapsible: false
            },
            {
              id: 'results',
              title: 'Results & Testing',
              fields: ['test_results', 'before_images', 'after_images'],
              order: 3,
              collapsible: false
            },
            {
              id: 'feedback',
              title: 'Notes & Feedback',
              fields: ['technician_notes', 'customer_satisfaction_rating'],
              order: 4,
              collapsible: true
            }
          ]
        }
      },
      required_fields: [
        'repair_date',
        'technician_id',
        'procedures_performed',
        'actual_hours',
        'test_results'
      ],
      is_active: true
    },
    {
      name: 'Standard Quotation',
      category: 'quotation',
      template_config: {
        sections: ['basic_info', 'line_items', 'terms'],
        requiredFields: [
          'quotation_date',
          'line_items',
          'total_amount',
          'validity_period'
        ],
        optionalFields: [
          'terms_conditions',
          'notes',
          'discount_amount',
          'tax_amount'
        ],
        validationRules: [
          {
            field: 'total_amount',
            type: 'range',
            value: { min: 0, max: 999999999 },
            message: 'Total amount must be a positive number'
          },
          {
            field: 'validity_period',
            type: 'range',
            value: { min: 1, max: 365 },
            message: 'Validity period must be between 1 and 365 days'
          }
        ],
        layout: {
          columns: 1,
          sections: [
            {
              id: 'basic_info',
              title: 'Quotation Details',
              fields: ['quotation_date', 'validity_period'],
              order: 1,
              collapsible: false
            },
            {
              id: 'line_items',
              title: 'Items & Pricing',
              fields: ['line_items', 'total_amount', 'discount_amount', 'tax_amount'],
              order: 2,
              collapsible: false
            },
            {
              id: 'terms',
              title: 'Terms & Conditions',
              fields: ['terms_conditions', 'notes'],
              order: 3,
              collapsible: true
            }
          ]
        }
      },
      required_fields: [
        'quotation_date',
        'line_items',
        'total_amount',
        'validity_period'
      ],
      is_active: true
    },
    {
      name: 'Preventive Maintenance Report',
      category: 'maintenance_report',
      template_config: {
        sections: ['basic_info', 'checklist', 'recommendations', 'materials'],
        requiredFields: [
          'maintenance_date',
          'technician_id',
          'maintenance_type',
          'checklist_items',
          'overall_condition'
        ],
        optionalFields: [
          'recommendations',
          'next_maintenance_date',
          'materials_used',
          'technician_notes',
          'customer_feedback'
        ],
        validationRules: [
          {
            field: 'maintenance_type',
            type: 'pattern',
            value: '^(preventive|corrective|emergency)$',
            message: 'Maintenance type must be preventive, corrective, or emergency'
          },
          {
            field: 'overall_condition',
            type: 'pattern',
            value: '^(excellent|good|fair|poor|critical)$',
            message: 'Overall condition must be excellent, good, fair, poor, or critical'
          }
        ],
        layout: {
          columns: 2,
          sections: [
            {
              id: 'basic_info',
              title: 'Maintenance Information',
              fields: ['maintenance_date', 'technician_id', 'maintenance_type'],
              order: 1,
              collapsible: false
            },
            {
              id: 'checklist',
              title: 'Maintenance Checklist',
              fields: ['checklist_items', 'overall_condition'],
              order: 2,
              collapsible: false
            },
            {
              id: 'recommendations',
              title: 'Recommendations & Next Steps',
              fields: ['recommendations', 'next_maintenance_date'],
              order: 3,
              collapsible: false
            },
            {
              id: 'materials',
              title: 'Materials & Notes',
              fields: ['materials_used', 'technician_notes', 'customer_feedback'],
              order: 4,
              collapsible: true
            }
          ]
        }
      },
      required_fields: [
        'maintenance_date',
        'technician_id',
        'maintenance_type',
        'checklist_items',
        'overall_condition'
      ],
      is_active: true
    }
  ];

  for (const docType of documentTypes) {
    await db.query(`
      INSERT INTO document_types (
        name, category, template_config, required_fields, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name) DO NOTHING
    `, [
      docType.name,
      docType.category,
      JSON.stringify(docType.template_config),
      JSON.stringify(docType.required_fields),
      docType.is_active
    ]);
  }

  console.log('Document type seeds completed');
}

// Run seeds if called directly
if (require.main === module) {
  seedDocumentTypes()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}