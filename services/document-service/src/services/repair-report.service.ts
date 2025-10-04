import { Pool } from 'pg';
import { UUID } from '../../../../shared/types/src/common';
import { RepairReport } from '../../../../shared/types/src/document';
import { RepairReportRepository } from '../repositories/repair-report.repository';
import { DocumentRepository } from '../repositories/document.repository';
import {
  CreateRepairReportRequest,
  UpdateRepairReportRequest,
  RepairReportSearchCriteria,
  RepairReportResponse,
  RepairReportValidationResult,
  QualityCheckResult,
  QualityCheckItem,
  CustomerSatisfactionRequest,
  CustomerFeedbackSummary,
  RepairReportAnalytics
} from '../types/repair-report';

export class RepairReportService {
  private repairReportRepository: RepairReportRepository;
  private documentRepository: DocumentRepository;

  constructor(db: Pool) {
    this.repairReportRepository = new RepairReportRepository(db);
    this.documentRepository = new DocumentRepository(db);
  }

  async createRepairReport(request: CreateRepairReportRequest): Promise<RepairReport> {
    // Validate the document exists and is in correct state
    const document = await this.documentRepository.findById(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== 'draft' && document.status !== 'under_review') {
      throw new Error('Cannot create repair report for document in current status');
    }

    // Validate repair report data
    const validationResult = await this.validateRepairReport(request);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Create the repair report
    const repairReport = await this.repairReportRepository.create(request);

    // Update document status if this is the first time creating the repair report
    if (document.status === 'draft') {
      await this.documentRepository.updateStatus(request.documentId, 'under_review');
    }

    return repairReport;
  }

  async getRepairReport(id: UUID): Promise<RepairReport | null> {
    return await this.repairReportRepository.findById(id);
  }

  async getRepairReportByDocumentId(documentId: UUID): Promise<RepairReport | null> {
    return await this.repairReportRepository.findByDocumentId(documentId);
  }

  async updateRepairReport(id: UUID, request: UpdateRepairReportRequest): Promise<RepairReport> {
    const existingReport = await this.repairReportRepository.findById(id);
    if (!existingReport) {
      throw new Error('Repair report not found');
    }

    // Validate the update request
    const validationResult = await this.validateRepairReportUpdate(request);
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    return await this.repairReportRepository.update(id, request);
  }

  async searchRepairReports(criteria: RepairReportSearchCriteria): Promise<{ repairReports: RepairReportResponse[], total: number }> {
    return await this.repairReportRepository.search(criteria);
  }

  async deleteRepairReport(id: UUID): Promise<void> {
    const existingReport = await this.repairReportRepository.findById(id);
    if (!existingReport) {
      throw new Error('Repair report not found');
    }

    // Check if document is in a state that allows deletion
    const document = await this.documentRepository.findById(existingReport.documentId);
    if (document && document.status === 'approved') {
      throw new Error('Cannot delete repair report for approved document');
    }

    await this.repairReportRepository.delete(id);
  }

  async performQualityCheck(id: UUID): Promise<QualityCheckResult> {
    const repairReport = await this.repairReportRepository.findById(id);
    if (!repairReport) {
      throw new Error('Repair report not found');
    }

    const checkedItems: QualityCheckItem[] = [];
    let totalScore = 0;
    let maxScore = 0;

    // Check parts replacement documentation
    maxScore += 20;
    if (repairReport.partsReplaced.length > 0) {
      const partsComplete = repairReport.partsReplaced.every(part => 
        part.partName && 
        part.quantity > 0 && 
        part.replacementReason && 
        part.warrantyMonths > 0
      );
      
      if (partsComplete) {
        totalScore += 20;
        checkedItems.push({
          category: 'parts',
          description: 'Parts replacement documentation complete',
          status: 'pass'
        });
      } else {
        checkedItems.push({
          category: 'parts',
          description: 'Parts replacement documentation incomplete',
          status: 'fail',
          notes: 'Some parts are missing required information'
        });
      }
    } else {
      totalScore += 10; // Partial score if no parts replaced
      checkedItems.push({
        category: 'parts',
        description: 'No parts replaced',
        status: 'warning',
        notes: 'Verify if parts replacement was actually not needed'
      });
    }

    // Check procedures documentation
    maxScore += 25;
    if (repairReport.proceduresPerformed.length > 0) {
      const proceduresComplete = repairReport.proceduresPerformed.every(proc => 
        proc.description && 
        proc.duration > 0 && 
        proc.result
      );
      
      if (proceduresComplete) {
        totalScore += 25;
        checkedItems.push({
          category: 'procedures',
          description: 'Procedures documentation complete',
          status: 'pass'
        });
      } else {
        totalScore += 10;
        checkedItems.push({
          category: 'procedures',
          description: 'Procedures documentation incomplete',
          status: 'fail',
          notes: 'Some procedures are missing required information'
        });
      }
    } else {
      checkedItems.push({
        category: 'procedures',
        description: 'No procedures documented',
        status: 'fail',
        notes: 'At least one procedure should be documented'
      });
    }

    // Check testing documentation
    maxScore += 25;
    if (repairReport.testResults.length > 0) {
      const testsComplete = repairReport.testResults.every(test => 
        test.testName && 
        test.expectedValue && 
        test.actualValue && 
        test.result
      );
      
      const allTestsPassed = repairReport.testResults.every(test => test.result === 'pass');
      
      if (testsComplete) {
        if (allTestsPassed) {
          totalScore += 25;
          checkedItems.push({
            category: 'testing',
            description: 'All tests documented and passed',
            status: 'pass'
          });
        } else {
          totalScore += 15;
          checkedItems.push({
            category: 'testing',
            description: 'Tests documented but some failed',
            status: 'warning',
            notes: 'Review failed tests and ensure proper corrective actions'
          });
        }
      } else {
        totalScore += 5;
        checkedItems.push({
          category: 'testing',
          description: 'Test documentation incomplete',
          status: 'fail',
          notes: 'Some tests are missing required information'
        });
      }
    } else {
      checkedItems.push({
        category: 'testing',
        description: 'No tests documented',
        status: 'fail',
        notes: 'Testing should be performed and documented'
      });
    }

    // Check documentation completeness
    maxScore += 30;
    let docScore = 0;
    
    if (repairReport.technicianNotes && repairReport.technicianNotes.length > 10) {
      docScore += 10;
    }
    
    if (repairReport.actualHours > 0) {
      docScore += 10;
    }
    
    if (repairReport.beforeImages.length > 0 || repairReport.afterImages.length > 0) {
      docScore += 10;
    }
    
    totalScore += docScore;
    
    if (docScore === 30) {
      checkedItems.push({
        category: 'documentation',
        description: 'Documentation complete with notes, hours, and images',
        status: 'pass'
      });
    } else if (docScore >= 20) {
      checkedItems.push({
        category: 'documentation',
        description: 'Documentation mostly complete',
        status: 'warning',
        notes: 'Consider adding more detailed notes or images'
      });
    } else {
      checkedItems.push({
        category: 'documentation',
        description: 'Documentation incomplete',
        status: 'fail',
        notes: 'Missing technician notes, hours tracking, or images'
      });
    }

    const finalScore = Math.round((totalScore / maxScore) * 100);
    const passed = finalScore >= 70; // 70% threshold for passing

    return {
      passed,
      score: finalScore,
      checkedItems,
      overallNotes: passed 
        ? 'Quality check passed. Repair report meets documentation standards.'
        : 'Quality check failed. Please address the identified issues before approval.'
    };
  }

  async recordCustomerSatisfaction(request: CustomerSatisfactionRequest): Promise<void> {
    // Validate rating is within acceptable range
    if (request.rating < 1 || request.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate service aspects ratings
    for (const aspect of request.serviceAspects) {
      if (aspect.rating < 1 || aspect.rating > 5) {
        throw new Error(`Service aspect rating for ${aspect.aspect} must be between 1 and 5`);
      }
    }

    await this.repairReportRepository.recordCustomerSatisfaction(request);
  }

  async getCustomerFeedbackSummary(dateFrom?: Date, dateTo?: Date): Promise<CustomerFeedbackSummary> {
    return await this.repairReportRepository.getCustomerFeedbackSummary(dateFrom, dateTo);
  }

  async getRepairReportAnalytics(dateFrom?: Date, dateTo?: Date): Promise<RepairReportAnalytics> {
    // This would typically involve complex queries across multiple tables
    // For now, returning a basic structure
    return {
      totalReports: 0,
      averageRepairTime: 0,
      mostCommonProcedures: [],
      mostReplacedParts: [],
      qualityTrends: [],
      customerSatisfactionTrend: []
    };
  }

  private async validateRepairReport(request: CreateRepairReportRequest): Promise<RepairReportValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic fields
    if (!request.documentId) {
      errors.push('Document ID is required');
    }

    if (request.actualHours <= 0) {
      errors.push('Actual hours must be greater than 0');
    }

    if (!request.technicianNotes || request.technicianNotes.trim().length === 0) {
      errors.push('Technician notes are required');
    }

    // Validate parts replaced
    if (request.partsReplaced && request.partsReplaced.length > 0) {
      for (let i = 0; i < request.partsReplaced.length; i++) {
        const part = request.partsReplaced[i];
        
        if (!part.partName || part.partName.trim().length === 0) {
          errors.push(`Part ${i + 1}: Part name is required`);
        }
        
        if (part.quantity <= 0) {
          errors.push(`Part ${i + 1}: Quantity must be greater than 0`);
        }
        
        if (!part.replacementReason || part.replacementReason.trim().length === 0) {
          errors.push(`Part ${i + 1}: Replacement reason is required`);
        }
        
        if (part.warrantyMonths < 0) {
          errors.push(`Part ${i + 1}: Warranty months cannot be negative`);
        }
      }
    }

    // Validate procedures performed
    if (request.proceduresPerformed && request.proceduresPerformed.length > 0) {
      for (let i = 0; i < request.proceduresPerformed.length; i++) {
        const procedure = request.proceduresPerformed[i];
        
        if (!procedure.description || procedure.description.trim().length === 0) {
          errors.push(`Procedure ${i + 1}: Description is required`);
        }
        
        if (procedure.duration <= 0) {
          errors.push(`Procedure ${i + 1}: Duration must be greater than 0`);
        }
      }
    } else {
      warnings.push('No procedures documented - verify if this is correct');
    }

    // Validate test results
    if (request.testResults && request.testResults.length > 0) {
      for (let i = 0; i < request.testResults.length; i++) {
        const test = request.testResults[i];
        
        if (!test.testName || test.testName.trim().length === 0) {
          errors.push(`Test ${i + 1}: Test name is required`);
        }
        
        if (!test.expectedValue || test.expectedValue.trim().length === 0) {
          errors.push(`Test ${i + 1}: Expected value is required`);
        }
        
        if (!test.actualValue || test.actualValue.trim().length === 0) {
          errors.push(`Test ${i + 1}: Actual value is required`);
        }
      }
    } else {
      warnings.push('No test results documented - consider adding test validation');
    }

    // Check for images
    if ((!request.beforeImages || request.beforeImages.length === 0) && 
        (!request.afterImages || request.afterImages.length === 0)) {
      warnings.push('No before/after images provided - consider adding visual documentation');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async validateRepairReportUpdate(request: UpdateRepairReportRequest): Promise<RepairReportValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate actual hours if provided
    if (request.actualHours !== undefined && request.actualHours <= 0) {
      errors.push('Actual hours must be greater than 0');
    }

    // Validate customer satisfaction rating if provided
    if (request.customerSatisfactionRating !== undefined) {
      if (request.customerSatisfactionRating < 1 || request.customerSatisfactionRating > 5) {
        errors.push('Customer satisfaction rating must be between 1 and 5');
      }
    }

    // Validate parts if provided
    if (request.partsReplaced) {
      for (let i = 0; i < request.partsReplaced.length; i++) {
        const part = request.partsReplaced[i];
        
        if (!part.partName || part.partName.trim().length === 0) {
          errors.push(`Part ${i + 1}: Part name is required`);
        }
        
        if (part.quantity <= 0) {
          errors.push(`Part ${i + 1}: Quantity must be greater than 0`);
        }
      }
    }

    // Validate procedures if provided
    if (request.proceduresPerformed) {
      for (let i = 0; i < request.proceduresPerformed.length; i++) {
        const procedure = request.proceduresPerformed[i];
        
        if (!procedure.description || procedure.description.trim().length === 0) {
          errors.push(`Procedure ${i + 1}: Description is required`);
        }
        
        if (procedure.duration <= 0) {
          errors.push(`Procedure ${i + 1}: Duration must be greater than 0`);
        }
      }
    }

    // Validate test results if provided
    if (request.testResults) {
      for (let i = 0; i < request.testResults.length; i++) {
        const test = request.testResults[i];
        
        if (!test.testName || test.testName.trim().length === 0) {
          errors.push(`Test ${i + 1}: Test name is required`);
        }
        
        if (!test.expectedValue || test.expectedValue.trim().length === 0) {
          errors.push(`Test ${i + 1}: Expected value is required`);
        }
        
        if (!test.actualValue || test.actualValue.trim().length === 0) {
          errors.push(`Test ${i + 1}: Actual value is required`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}