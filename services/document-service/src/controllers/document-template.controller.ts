import { Request, Response, NextFunction } from 'express';
import { DocumentTemplateService } from '../services/document-template.service';
import { DocumentCategory, UUID } from '../types';
import { createError } from '../middleware/error.middleware';

export class DocumentTemplateController {
  private documentTemplateService: DocumentTemplateService;

  constructor() {
    this.documentTemplateService = new DocumentTemplateService();
  }

  generateDynamicForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceTypeId, category } = req.params;
      const { documentTypeId } = req.query;
      
      if (!deviceTypeId || !category) {
        throw createError('Device type ID and category are required', 400);
      }

      const dynamicForm = await this.documentTemplateService.generateDynamicForm(
        deviceTypeId as UUID,
        category as DocumentCategory,
        documentTypeId as UUID | undefined
      );
      
      res.json({
        success: true,
        data: dynamicForm
      });
    } catch (error) {
      next(error);
    }
  };

  validateDocumentContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentTypeId } = req.params;
      const { content } = req.body;
      
      if (!documentTypeId) {
        throw createError('Document type ID is required', 400);
      }

      if (!content) {
        throw createError('Document content is required', 400);
      }

      const validation = await this.documentTemplateService.validateDocumentContent(
        documentTypeId as UUID,
        content
      );
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      next(error);
    }
  };

  getFormPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { documentTypeId } = req.params;
      const { deviceTypeId } = req.query;
      
      if (!documentTypeId) {
        throw createError('Document type ID is required', 400);
      }

      // Generate form for preview purposes
      const dynamicForm = await this.documentTemplateService.generateDynamicForm(
        (deviceTypeId as UUID) || 'default-device-type',
        'custom', // Default category for preview
        documentTypeId as UUID
      );
      
      res.json({
        success: true,
        data: {
          ...dynamicForm,
          isPreview: true
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getFieldSuggestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.params;
      
      if (!category) {
        throw createError('Category is required', 400);
      }

      // Return suggested fields based on document category
      const suggestions = this.getFieldSuggestionsForCategory(category as DocumentCategory);
      
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      next(error);
    }
  };

  private getFieldSuggestionsForCategory(category: DocumentCategory) {
    const suggestions: Record<DocumentCategory, any> = {
      inspection_report: {
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
        sections: [
          {
            id: 'basic_info',
            title: 'Basic Information',
            fields: ['device_serial_number', 'inspection_date', 'technician_id']
          },
          {
            id: 'findings',
            title: 'Inspection Findings',
            fields: ['findings', 'severity_level', 'images']
          },
          {
            id: 'recommendations',
            title: 'Recommendations',
            fields: ['recommended_parts', 'estimated_hours', 'technician_notes']
          }
        ]
      },
      repair_report: {
        requiredFields: [
          'repair_date',
          'technician_id',
          'procedures_performed',
          'parts_replaced',
          'actual_hours',
          'test_results'
        ],
        optionalFields: [
          'before_images',
          'after_images',
          'technician_notes',
          'customer_satisfaction_rating'
        ],
        sections: [
          {
            id: 'basic_info',
            title: 'Repair Information',
            fields: ['repair_date', 'technician_id', 'actual_hours']
          },
          {
            id: 'work_performed',
            title: 'Work Performed',
            fields: ['procedures_performed', 'parts_replaced']
          },
          {
            id: 'results',
            title: 'Results & Testing',
            fields: ['test_results', 'before_images', 'after_images']
          },
          {
            id: 'feedback',
            title: 'Notes & Feedback',
            fields: ['technician_notes', 'customer_satisfaction_rating']
          }
        ]
      },
      quotation: {
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
        sections: [
          {
            id: 'basic_info',
            title: 'Quotation Details',
            fields: ['quotation_date', 'validity_period']
          },
          {
            id: 'line_items',
            title: 'Items & Pricing',
            fields: ['line_items', 'total_amount', 'discount_amount', 'tax_amount']
          },
          {
            id: 'terms',
            title: 'Terms & Conditions',
            fields: ['terms_conditions', 'notes']
          }
        ]
      },
      maintenance_report: {
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
        sections: [
          {
            id: 'basic_info',
            title: 'Maintenance Information',
            fields: ['maintenance_date', 'technician_id', 'maintenance_type']
          },
          {
            id: 'checklist',
            title: 'Maintenance Checklist',
            fields: ['checklist_items', 'overall_condition']
          },
          {
            id: 'recommendations',
            title: 'Recommendations & Next Steps',
            fields: ['recommendations', 'next_maintenance_date']
          },
          {
            id: 'materials',
            title: 'Materials & Notes',
            fields: ['materials_used', 'technician_notes', 'customer_feedback']
          }
        ]
      },
      proposal: {
        requiredFields: [
          'proposal_date',
          'proposed_solution',
          'estimated_cost',
          'timeline'
        ],
        optionalFields: [
          'alternative_solutions',
          'benefits',
          'risks',
          'assumptions'
        ],
        sections: [
          {
            id: 'basic_info',
            title: 'Proposal Details',
            fields: ['proposal_date', 'timeline']
          },
          {
            id: 'solution',
            title: 'Proposed Solution',
            fields: ['proposed_solution', 'estimated_cost']
          },
          {
            id: 'alternatives',
            title: 'Alternatives & Analysis',
            fields: ['alternative_solutions', 'benefits', 'risks', 'assumptions']
          }
        ]
      },
      receipt: {
        requiredFields: [
          'receipt_date',
          'payment_method',
          'amount_paid',
          'items'
        ],
        optionalFields: [
          'tax_amount',
          'discount_amount',
          'notes'
        ],
        sections: [
          {
            id: 'payment_info',
            title: 'Payment Information',
            fields: ['receipt_date', 'payment_method', 'amount_paid']
          },
          {
            id: 'items',
            title: 'Items & Charges',
            fields: ['items', 'tax_amount', 'discount_amount']
          },
          {
            id: 'notes',
            title: 'Additional Notes',
            fields: ['notes']
          }
        ]
      },
      quality_report: {
        requiredFields: [
          'inspection_date',
          'inspector_id',
          'quality_checks',
          'overall_result'
        ],
        optionalFields: [
          'defects_found',
          'corrective_actions',
          'inspector_notes',
          'images'
        ],
        sections: [
          {
            id: 'basic_info',
            title: 'Quality Inspection',
            fields: ['inspection_date', 'inspector_id']
          },
          {
            id: 'checks',
            title: 'Quality Checks',
            fields: ['quality_checks', 'overall_result']
          },
          {
            id: 'issues',
            title: 'Issues & Actions',
            fields: ['defects_found', 'corrective_actions']
          },
          {
            id: 'documentation',
            title: 'Documentation',
            fields: ['inspector_notes', 'images']
          }
        ]
      },
      custom: {
        requiredFields: [
          'document_title',
          'created_date',
          'content'
        ],
        optionalFields: [
          'description',
          'attachments',
          'notes'
        ],
        sections: [
          {
            id: 'basic_info',
            title: 'Document Information',
            fields: ['document_title', 'created_date', 'description']
          },
          {
            id: 'content',
            title: 'Content',
            fields: ['content', 'attachments', 'notes']
          }
        ]
      }
    };

    return suggestions[category] || suggestions.custom;
  }
}