import { 
  InspectionReport, 
  InspectionFinding, 
  RecommendedPart, 
  SeverityLevel, 
  PartUrgency,
  DocumentImage,
  UUID 
} from '../types';
import { InspectionReportRepository } from '../repositories/inspection-report.repository';
import { DocumentService } from './document.service';
import { FileStorageService, FileUpload } from './file-storage.service';

export interface CreateInspectionReportRequest {
  documentId: UUID;
  findings: InspectionFinding[];
  recommendedParts?: RecommendedPart[];
  estimatedHours: number;
  severityLevel: SeverityLevel;
  technicianNotes?: string;
  images?: string[];
}

export interface UpdateInspectionReportRequest {
  findings?: InspectionFinding[];
  recommendedParts?: RecommendedPart[];
  estimatedHours?: number;
  severityLevel?: SeverityLevel;
  technicianNotes?: string;
  images?: string[];
}

export interface InspectionFindingRequest {
  component: string;
  issue: string;
  severity: SeverityLevel;
  description: string;
  recommendation?: string;
}

export interface RecommendedPartRequest {
  partName: string;
  partNumber?: string;
  quantity: number;
  reason: string;
  estimatedCost?: number;
  urgency: PartUrgency;
}

export interface SeverityAssessmentResult {
  overallSeverity: SeverityLevel;
  requiresEscalation: boolean;
  escalationReason?: string;
  recommendedActions: string[];
  estimatedCost: number;
  estimatedHours: number;
}

export interface EscalationRule {
  condition: EscalationCondition;
  action: EscalationAction;
  notifyRoles: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationCondition {
  severityLevel?: SeverityLevel;
  estimatedCost?: number;
  criticalComponents?: string[];
  multipleHighSeverityFindings?: boolean;
}

export interface EscalationAction {
  type: 'notify_manager' | 'require_approval' | 'escalate_case' | 'emergency_response';
  parameters?: Record<string, any>;
}

export class InspectionReportService {
  private inspectionReportRepository: InspectionReportRepository;
  private documentService: DocumentService;
  private fileStorageService: FileStorageService;

  // Escalation rules configuration
  private escalationRules: EscalationRule[] = [
    {
      condition: { severityLevel: 'critical' },
      action: { type: 'emergency_response' },
      notifyRoles: ['manager', 'technical_lead', 'customer_service'],
      priority: 'critical'
    },
    {
      condition: { estimatedCost: 10000000 }, // 10M VND
      action: { type: 'require_approval' },
      notifyRoles: ['manager', 'finance'],
      priority: 'high'
    },
    {
      condition: { 
        criticalComponents: ['main_board', 'power_supply', 'display_module'] 
      },
      action: { type: 'escalate_case' },
      notifyRoles: ['technical_lead'],
      priority: 'high'
    },
    {
      condition: { multipleHighSeverityFindings: true },
      action: { type: 'notify_manager' },
      notifyRoles: ['manager'],
      priority: 'medium'
    }
  ];

  constructor() {
    this.inspectionReportRepository = new InspectionReportRepository();
    this.documentService = new DocumentService();
    this.fileStorageService = new FileStorageService();
  }

  // Core CRUD Operations
  async createInspectionReport(request: CreateInspectionReportRequest, createdBy: UUID): Promise<InspectionReport> {
    // Validate document exists and is of correct type
    const document = await this.documentService.getDocument(request.documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Perform severity assessment
    const severityAssessment = await this.assessSeverity(request.findings, request.recommendedParts || []);
    
    // Auto-generate parts recommendations if not provided
    const recommendedParts = request.recommendedParts || 
      await this.generatePartsRecommendations(request.findings);

    // Calculate estimated cost
    const estimatedCost = this.calculateEstimatedCost(recommendedParts, request.estimatedHours);

    const inspectionReport = await this.inspectionReportRepository.create({
      ...request,
      recommendedParts,
      images: request.images || []
    });

    // Check for escalation
    if (severityAssessment.requiresEscalation) {
      await this.handleEscalation(inspectionReport, severityAssessment);
    }

    return inspectionReport;
  }

  async getInspectionReport(id: UUID): Promise<InspectionReport | null> {
    return this.inspectionReportRepository.findById(id);
  }

  async getInspectionReportByDocument(documentId: UUID): Promise<InspectionReport | null> {
    return this.inspectionReportRepository.findByDocumentId(documentId);
  }

  async updateInspectionReport(
    id: UUID, 
    request: UpdateInspectionReportRequest, 
    updatedBy: UUID
  ): Promise<InspectionReport> {
    const existingReport = await this.inspectionReportRepository.findById(id);
    if (!existingReport) {
      throw new Error('Inspection report not found');
    }

    // If findings or parts are updated, reassess severity
    if (request.findings || request.recommendedParts) {
      const findings = request.findings || existingReport.findings;
      const recommendedParts = request.recommendedParts || existingReport.recommendedParts;
      
      const severityAssessment = await this.assessSeverity(findings, recommendedParts);
      
      if (severityAssessment.requiresEscalation) {
        const updatedReport = await this.inspectionReportRepository.update(id, request);
        await this.handleEscalation(updatedReport, severityAssessment);
        return updatedReport;
      }
    }

    return this.inspectionReportRepository.update(id, request);
  }

  async deleteInspectionReport(id: UUID): Promise<void> {
    const report = await this.inspectionReportRepository.findById(id);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    // Delete associated images
    for (const image of report.images) {
      try {
        await this.fileStorageService.deleteFile(image.url);
      } catch (error) {
        console.error(`Failed to delete image ${image.id}:`, error);
      }
    }

    await this.inspectionReportRepository.delete(id);
  }

  // Findings Management
  async addFinding(reportId: UUID, finding: InspectionFindingRequest): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const newFinding: InspectionFinding = {
      ...finding,
      id: crypto.randomUUID()
    };

    const updatedFindings = [...report.findings, newFinding];
    
    return this.updateInspectionReport(reportId, { 
      findings: updatedFindings 
    }, 'system');
  }

  async updateFinding(
    reportId: UUID, 
    findingId: string, 
    updates: Partial<InspectionFindingRequest>
  ): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const updatedFindings = report.findings.map(finding => 
      finding.id === findingId ? { ...finding, ...updates } : finding
    );

    return this.updateInspectionReport(reportId, { 
      findings: updatedFindings 
    }, 'system');
  }

  async removeFinding(reportId: UUID, findingId: string): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const updatedFindings = report.findings.filter(finding => finding.id !== findingId);
    
    return this.updateInspectionReport(reportId, { 
      findings: updatedFindings 
    }, 'system');
  }

  // Parts Recommendation System
  async generatePartsRecommendations(findings: InspectionFinding[]): Promise<RecommendedPart[]> {
    const recommendations: RecommendedPart[] = [];

    for (const finding of findings) {
      const partRecommendations = await this.getPartRecommendationsForFinding(finding);
      recommendations.push(...partRecommendations);
    }

    return this.deduplicateRecommendations(recommendations);
  }

  private async getPartRecommendationsForFinding(finding: InspectionFinding): Promise<RecommendedPart[]> {
    const recommendations: RecommendedPart[] = [];

    // Component-based part recommendations
    const componentPartMap: Record<string, RecommendedPart[]> = {
      'display_module': [
        {
          partName: 'LCD Display Module',
          partNumber: 'LCD-X100-001',
          quantity: 1,
          reason: `Replace faulty display module - ${finding.issue}`,
          estimatedCost: 2500000,
          urgency: finding.severity === 'critical' ? 'immediate' : 'scheduled'
        }
      ],
      'main_board': [
        {
          partName: 'Main Control Board',
          partNumber: 'MCB-X100-001',
          quantity: 1,
          reason: `Replace main board - ${finding.issue}`,
          estimatedCost: 5000000,
          urgency: finding.severity === 'critical' ? 'immediate' : 'scheduled'
        }
      ],
      'power_supply': [
        {
          partName: 'Power Supply Unit',
          partNumber: 'PSU-X100-001',
          quantity: 1,
          reason: `Replace power supply - ${finding.issue}`,
          estimatedCost: 1500000,
          urgency: finding.severity === 'critical' ? 'immediate' : 'scheduled'
        }
      ],
      'capacitor': [
        {
          partName: 'Capacitor 470uF/25V',
          partNumber: 'CAP-470-25',
          quantity: 1,
          reason: `Replace faulty capacitor - ${finding.issue}`,
          estimatedCost: 50000,
          urgency: 'immediate'
        }
      ],
      'sensor': [
        {
          partName: 'Temperature Sensor',
          partNumber: 'TEMP-SENS-001',
          quantity: 1,
          reason: `Replace temperature sensor - ${finding.issue}`,
          estimatedCost: 300000,
          urgency: finding.severity === 'high' ? 'immediate' : 'scheduled'
        }
      ]
    };

    // Find matching components
    const componentKey = Object.keys(componentPartMap).find(key => 
      finding.component.toLowerCase().includes(key) || 
      finding.issue.toLowerCase().includes(key)
    );

    if (componentKey) {
      recommendations.push(...componentPartMap[componentKey]);
    }

    // Issue-based recommendations
    if (finding.issue.toLowerCase().includes('leak')) {
      recommendations.push({
        partName: 'Seal Kit',
        partNumber: 'SEAL-KIT-001',
        quantity: 1,
        reason: `Replace seals due to leakage - ${finding.issue}`,
        estimatedCost: 200000,
        urgency: 'immediate'
      });
    }

    if (finding.issue.toLowerCase().includes('calibration')) {
      recommendations.push({
        partName: 'Calibration Certificate',
        partNumber: 'CAL-CERT-001',
        quantity: 1,
        reason: `Recalibration required - ${finding.issue}`,
        estimatedCost: 500000,
        urgency: 'scheduled'
      });
    }

    return recommendations;
  }

  private deduplicateRecommendations(recommendations: RecommendedPart[]): RecommendedPart[] {
    const seen = new Set<string>();
    return recommendations.filter(part => {
      const key = `${part.partName}-${part.partNumber}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async addRecommendedPart(reportId: UUID, part: RecommendedPartRequest): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const newPart: RecommendedPart = {
      ...part,
      id: crypto.randomUUID()
    };

    const updatedParts = [...report.recommendedParts, newPart];
    
    return this.updateInspectionReport(reportId, { 
      recommendedParts: updatedParts 
    }, 'system');
  }

  async updateRecommendedPart(
    reportId: UUID, 
    partId: string, 
    updates: Partial<RecommendedPartRequest>
  ): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const updatedParts = report.recommendedParts.map(part => 
      part.id === partId ? { ...part, ...updates } : part
    );

    return this.updateInspectionReport(reportId, { 
      recommendedParts: updatedParts 
    }, 'system');
  }

  async removeRecommendedPart(reportId: UUID, partId: string): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const updatedParts = report.recommendedParts.filter(part => part.id !== partId);
    
    return this.updateInspectionReport(reportId, { 
      recommendedParts: updatedParts 
    }, 'system');
  }

  // Cost Estimation
  calculateEstimatedCost(recommendedParts: RecommendedPart[], estimatedHours: number): number {
    const partsCost = recommendedParts.reduce((total, part) => 
      total + (part.estimatedCost || 0) * part.quantity, 0
    );

    const laborCost = estimatedHours * 200000; // 200k VND per hour
    
    return partsCost + laborCost;
  }

  async updatePartCosts(reportId: UUID): Promise<InspectionReport> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    // In a real implementation, this would fetch current prices from inventory service
    const updatedParts = await Promise.all(
      report.recommendedParts.map(async (part) => {
        // Mock price lookup - in reality would call inventory service
        const currentPrice = await this.lookupPartPrice(part.partNumber);
        return {
          ...part,
          estimatedCost: currentPrice || part.estimatedCost
        };
      })
    );

    return this.updateInspectionReport(reportId, { 
      recommendedParts: updatedParts 
    }, 'system');
  }

  private async lookupPartPrice(partNumber?: string): Promise<number | undefined> {
    // Mock implementation - would integrate with inventory service
    const mockPrices: Record<string, number> = {
      'LCD-X100-001': 2500000,
      'MCB-X100-001': 5000000,
      'PSU-X100-001': 1500000,
      'CAP-470-25': 50000,
      'TEMP-SENS-001': 300000,
      'SEAL-KIT-001': 200000,
      'CAL-CERT-001': 500000
    };

    return partNumber ? mockPrices[partNumber] : undefined;
  }

  // Severity Assessment and Escalation
  async assessSeverity(
    findings: InspectionFinding[], 
    recommendedParts: RecommendedPart[]
  ): Promise<SeverityAssessmentResult> {
    // Determine overall severity
    const severityLevels = findings.map(f => f.severity);
    const overallSeverity = this.calculateOverallSeverity(severityLevels);

    // Calculate costs
    const estimatedCost = this.calculateEstimatedCost(recommendedParts, 0);

    // Check escalation conditions
    const requiresEscalation = this.checkEscalationConditions(findings, recommendedParts, estimatedCost);
    
    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(findings, overallSeverity);

    return {
      overallSeverity,
      requiresEscalation,
      escalationReason: requiresEscalation ? this.getEscalationReason(findings, estimatedCost) : undefined,
      recommendedActions,
      estimatedCost,
      estimatedHours: this.estimateRepairHours(findings)
    };
  }

  private calculateOverallSeverity(severityLevels: SeverityLevel[]): SeverityLevel {
    if (severityLevels.includes('critical')) return 'critical';
    if (severityLevels.includes('high')) return 'high';
    if (severityLevels.includes('medium')) return 'medium';
    return 'low';
  }

  private checkEscalationConditions(
    findings: InspectionFinding[], 
    recommendedParts: RecommendedPart[], 
    estimatedCost: number
  ): boolean {
    return this.escalationRules.some(rule => {
      const condition = rule.condition;
      
      // Check severity level
      if (condition.severityLevel) {
        const hasSeverity = findings.some(f => f.severity === condition.severityLevel);
        if (hasSeverity) return true;
      }

      // Check estimated cost
      if (condition.estimatedCost && estimatedCost >= condition.estimatedCost) {
        return true;
      }

      // Check critical components
      if (condition.criticalComponents) {
        const hasCriticalComponent = findings.some(f => 
          condition.criticalComponents!.some(comp => 
            f.component.toLowerCase().includes(comp)
          )
        );
        if (hasCriticalComponent) return true;
      }

      // Check multiple high severity findings
      if (condition.multipleHighSeverityFindings) {
        const highSeverityCount = findings.filter(f => 
          ['high', 'critical'].includes(f.severity)
        ).length;
        if (highSeverityCount >= 2) return true;
      }

      return false;
    });
  }

  private getEscalationReason(findings: InspectionFinding[], estimatedCost: number): string {
    const reasons: string[] = [];

    if (findings.some(f => f.severity === 'critical')) {
      reasons.push('Critical severity findings detected');
    }

    if (estimatedCost >= 10000000) {
      reasons.push(`High repair cost estimated: ${estimatedCost.toLocaleString()} VND`);
    }

    const criticalComponents = ['main_board', 'power_supply', 'display_module'];
    const affectedCriticalComponents = findings.filter(f => 
      criticalComponents.some(comp => f.component.toLowerCase().includes(comp))
    );

    if (affectedCriticalComponents.length > 0) {
      reasons.push(`Critical components affected: ${affectedCriticalComponents.map(f => f.component).join(', ')}`);
    }

    const highSeverityCount = findings.filter(f => ['high', 'critical'].includes(f.severity)).length;
    if (highSeverityCount >= 2) {
      reasons.push(`Multiple high severity findings (${highSeverityCount})`);
    }

    return reasons.join('; ');
  }

  private generateRecommendedActions(findings: InspectionFinding[], severity: SeverityLevel): string[] {
    const actions: string[] = [];

    if (severity === 'critical') {
      actions.push('Immediate repair required - device should not be used');
      actions.push('Notify customer of safety concerns');
      actions.push('Escalate to technical lead');
    } else if (severity === 'high') {
      actions.push('Schedule repair within 24 hours');
      actions.push('Inform customer of urgency');
    } else if (severity === 'medium') {
      actions.push('Schedule repair within 1 week');
      actions.push('Monitor device condition');
    } else {
      actions.push('Schedule routine maintenance');
      actions.push('Document for future reference');
    }

    // Component-specific actions
    if (findings.some(f => f.component.toLowerCase().includes('safety'))) {
      actions.push('Perform safety inspection before return to service');
    }

    if (findings.some(f => f.issue.toLowerCase().includes('calibration'))) {
      actions.push('Full calibration required after repair');
    }

    return actions;
  }

  private estimateRepairHours(findings: InspectionFinding[]): number {
    let totalHours = 0;

    for (const finding of findings) {
      switch (finding.severity) {
        case 'critical':
          totalHours += 4;
          break;
        case 'high':
          totalHours += 2;
          break;
        case 'medium':
          totalHours += 1;
          break;
        case 'low':
          totalHours += 0.5;
          break;
      }

      // Component-specific time estimates
      if (finding.component.toLowerCase().includes('main_board')) {
        totalHours += 2;
      }
      if (finding.component.toLowerCase().includes('calibration')) {
        totalHours += 1;
      }
    }

    return Math.max(totalHours, 0.5); // Minimum 30 minutes
  }

  private async handleEscalation(report: InspectionReport, assessment: SeverityAssessmentResult): Promise<void> {
    // Find applicable escalation rules
    const applicableRules = this.escalationRules.filter(rule => {
      // This would contain the same logic as checkEscalationConditions
      // but return the specific rules that match
      return true; // Simplified for now
    });

    for (const rule of applicableRules) {
      await this.executeEscalationAction(report, rule, assessment);
    }
  }

  private async executeEscalationAction(
    report: InspectionReport, 
    rule: EscalationRule, 
    assessment: SeverityAssessmentResult
  ): Promise<void> {
    switch (rule.action.type) {
      case 'emergency_response':
        await this.triggerEmergencyResponse(report, assessment);
        break;
      case 'require_approval':
        await this.requireManagerApproval(report, assessment);
        break;
      case 'escalate_case':
        await this.escalateCase(report, assessment);
        break;
      case 'notify_manager':
        await this.notifyManager(report, assessment);
        break;
    }
  }

  private async triggerEmergencyResponse(report: InspectionReport, assessment: SeverityAssessmentResult): Promise<void> {
    // Implementation would integrate with notification service
    console.log(`EMERGENCY: Critical inspection report ${report.id} requires immediate attention`);
    console.log(`Reason: ${assessment.escalationReason}`);
  }

  private async requireManagerApproval(report: InspectionReport, assessment: SeverityAssessmentResult): Promise<void> {
    // Implementation would integrate with approval workflow service
    console.log(`Manager approval required for inspection report ${report.id}`);
    console.log(`Estimated cost: ${assessment.estimatedCost.toLocaleString()} VND`);
  }

  private async escalateCase(report: InspectionReport, assessment: SeverityAssessmentResult): Promise<void> {
    // Implementation would integrate with case service
    console.log(`Case escalation triggered for inspection report ${report.id}`);
  }

  private async notifyManager(report: InspectionReport, assessment: SeverityAssessmentResult): Promise<void> {
    // Implementation would integrate with notification service
    console.log(`Manager notification sent for inspection report ${report.id}`);
  }

  // Image Management
  async uploadInspectionImage(
    reportId: UUID, 
    file: FileUpload, 
    caption?: string,
    imageType: 'before' | 'during' | 'after' = 'during'
  ): Promise<DocumentImage> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    // Validate image
    this.fileStorageService.validateFileSize(file.size, 5); // 5MB limit
    this.fileStorageService.validateFileType(file.mimeType, [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ]);

    // Store image
    const storedFile = await this.fileStorageService.storeImage(file, reportId);

    const documentImage: DocumentImage = {
      id: crypto.randomUUID(),
      fileName: storedFile.fileName,
      url: storedFile.url,
      caption,
      timestamp: new Date(),
      imageType
    };

    // Update report with new image
    const updatedImages = [...report.images, documentImage];
    await this.updateInspectionReport(reportId, { images: updatedImages }, 'system');

    return documentImage;
  }

  async removeInspectionImage(reportId: UUID, imageId: string): Promise<void> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const image = report.images.find(img => img.id === imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    // Delete file from storage
    await this.fileStorageService.deleteFile(image.url);

    // Update report
    const updatedImages = report.images.filter(img => img.id !== imageId);
    await this.updateInspectionReport(reportId, { images: updatedImages }, 'system');
  }

  async updateImageCaption(reportId: UUID, imageId: string, caption: string): Promise<void> {
    const report = await this.inspectionReportRepository.findById(reportId);
    if (!report) {
      throw new Error('Inspection report not found');
    }

    const updatedImages = report.images.map(img => 
      img.id === imageId ? { ...img, caption } : img
    );

    await this.updateInspectionReport(reportId, { images: updatedImages }, 'system');
  }

  // Comparison and Analysis
  async compareInspectionReports(reportId1: UUID, reportId2: UUID): Promise<any> {
    const [report1, report2] = await Promise.all([
      this.inspectionReportRepository.findById(reportId1),
      this.inspectionReportRepository.findById(reportId2)
    ]);

    if (!report1 || !report2) {
      throw new Error('One or both inspection reports not found');
    }

    return {
      severityComparison: {
        report1: report1.severityLevel,
        report2: report2.severityLevel,
        change: this.compareSeverityLevels(report1.severityLevel, report2.severityLevel)
      },
      findingsComparison: {
        report1Count: report1.findings.length,
        report2Count: report2.findings.length,
        newFindings: this.findNewFindings(report1.findings, report2.findings),
        resolvedFindings: this.findResolvedFindings(report1.findings, report2.findings)
      },
      costComparison: {
        report1Cost: this.calculateEstimatedCost(report1.recommendedParts, report1.estimatedHours),
        report2Cost: this.calculateEstimatedCost(report2.recommendedParts, report2.estimatedHours),
        difference: this.calculateEstimatedCost(report2.recommendedParts, report2.estimatedHours) - 
                   this.calculateEstimatedCost(report1.recommendedParts, report1.estimatedHours)
      }
    };
  }

  private compareSeverityLevels(severity1: SeverityLevel, severity2: SeverityLevel): string {
    const severityOrder = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const level1 = severityOrder[severity1];
    const level2 = severityOrder[severity2];

    if (level1 < level2) return 'increased';
    if (level1 > level2) return 'decreased';
    return 'unchanged';
  }

  private findNewFindings(oldFindings: InspectionFinding[], newFindings: InspectionFinding[]): InspectionFinding[] {
    return newFindings.filter(newFinding => 
      !oldFindings.some(oldFinding => 
        oldFinding.component === newFinding.component && 
        oldFinding.issue === newFinding.issue
      )
    );
  }

  private findResolvedFindings(oldFindings: InspectionFinding[], newFindings: InspectionFinding[]): InspectionFinding[] {
    return oldFindings.filter(oldFinding => 
      !newFindings.some(newFinding => 
        oldFinding.component === newFinding.component && 
        oldFinding.issue === newFinding.issue
      )
    );
  }
}