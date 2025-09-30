import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import { ApprovalWorkflowRepository } from '../repositories/approval-workflow.repository';
import { ApprovalInstanceRepository } from '../repositories/approval-instance.repository';
import { DocumentRepository } from '../repositories/document.repository';
import { 
  CreateApprovalWorkflowRequest,
  SubmitForApprovalRequest,
  ProcessApprovalRequest,
  ApprovalLevel,
  ApprovalWorkflow,
  ApprovalInstance
} from '../types/approval';

// Mock the repositories
const mockWorkflowRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByDocumentTypeId: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  search: vi.fn()
};

const mockInstanceRepository = {
  createInstance: vi.fn(),
  findById: vi.fn(),
  findByDocumentId: vi.fn(),
  updateStatus: vi.fn(),
  updateCurrentLevel: vi.fn(),
  createApprovalRecord: vi.fn(),
  updateApprovalRecord: vi.fn(),
  getApprovalRecords: vi.fn(),
  getPendingApprovalRecords: vi.fn(),
  createEscalationRecord: vi.fn(),
  createDelegationRecord: vi.fn(),
  searchInstances: vi.fn(),
  getPendingApprovals: vi.fn()
};

const mockDocumentRepository = {
  findById: vi.fn(),
  updateStatus: vi.fn()
};

const mockNotificationRepository = {
  createNotification: vi.fn()
};

const mockDocumentTypeRepository = {
  findById: vi.fn()
};

// Mock the dependencies
vi.mock('../repositories/approval-workflow.repository', () => ({
  ApprovalWorkflowRepository: vi.fn(() => mockWorkflowRepository)
}));

vi.mock('../repositories/approval-instance.repository', () => ({
  ApprovalInstanceRepository: vi.fn(() => mockInstanceRepository)
}));

vi.mock('../repositories/document.repository', () => ({
  DocumentRepository: vi.fn(() => mockDocumentRepository)
}));

vi.mock('../repositories/approval-notification.repository', () => ({
  ApprovalNotificationRepository: vi.fn(() => mockNotificationRepository)
}));

vi.mock('../repositories/document-type.repository', () => ({
  DocumentTypeRepository: vi.fn(() => mockDocumentTypeRepository)
}));

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;

  beforeEach(() => {
    service = new ApprovalWorkflowService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createWorkflow', () => {
    it('should create a workflow with valid configuration', async () => {
      const request: CreateApprovalWorkflowRequest = {
        name: 'Test Workflow',
        description: 'Test workflow description',
        documentTypeIds: ['doc-type-1'],
        levels: [
          {
            level: 1,
            name: 'Manager Review',
            approverType: 'role',
            approverRoles: ['manager'],
            requiredApprovals: 1,
            isParallel: false
          },
          {
            level: 2,
            name: 'Director Approval',
            approverType: 'role',
            approverRoles: ['director'],
            requiredApprovals: 1,
            isParallel: false
          }
        ]
      };

      const expectedWorkflow: ApprovalWorkflow = {
        id: 'workflow-1',
        name: request.name,
        description: request.description,
        documentTypeIds: request.documentTypeIds,
        levels: request.levels,
        escalationRules: [],
        delegationRules: [],
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockWorkflowRepository.create.mockResolvedValue(expectedWorkflow);

      const result = await service.createWorkflow(request, 'user-1');

      expect(mockWorkflowRepository.create).toHaveBeenCalledWith(request, 'user-1');
      expect(result).toEqual(expectedWorkflow);
    });

    it('should throw error for invalid workflow configuration', async () => {
      const request: CreateApprovalWorkflowRequest = {
        name: 'Invalid Workflow',
        documentTypeIds: ['doc-type-1'],
        levels: [] // Empty levels should cause validation error
      };

      await expect(service.createWorkflow(request, 'user-1')).rejects.toThrow(
        'Workflow must have at least one level'
      );
    });

    it('should throw error for non-consecutive level numbers', async () => {
      const request: CreateApprovalWorkflowRequest = {
        name: 'Invalid Workflow',
        documentTypeIds: ['doc-type-1'],
        levels: [
          {
            level: 1,
            name: 'Level 1',
            approverType: 'role',
            approverRoles: ['manager'],
            requiredApprovals: 1,
            isParallel: false
          },
          {
            level: 3, // Should be 2
            name: 'Level 3',
            approverType: 'role',
            approverRoles: ['director'],
            requiredApprovals: 1,
            isParallel: false
          }
        ]
      };

      await expect(service.createWorkflow(request, 'user-1')).rejects.toThrow(
        'Workflow levels must be numbered consecutively starting from 1'
      );
    });
  });

  describe('submitDocumentForApproval', () => {
    it('should submit document for approval successfully', async () => {
      const documentId = 'doc-1';
      const workflowId = 'workflow-1';
      const submittedBy = 'user-1';

      const mockDocument = {
        id: documentId,
        documentTypeId: 'doc-type-1',
        status: 'draft',
        content: { title: 'Test Document' }
      };

      const mockWorkflow: ApprovalWorkflow = {
        id: workflowId,
        name: 'Test Workflow',
        documentTypeIds: ['doc-type-1'],
        levels: [
          {
            level: 1,
            name: 'Manager Review',
            approverType: 'user',
            approverIds: ['manager-1'],
            requiredApprovals: 1,
            isParallel: false
          }
        ],
        escalationRules: [],
        delegationRules: [],
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockInstance: ApprovalInstance = {
        id: 'instance-1',
        documentId,
        workflowId,
        currentLevel: 1,
        status: 'in_progress',
        startedAt: new Date(),
        approvals: [],
        escalations: [],
        delegations: [],
        createdBy: submittedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockWorkflowRepository.findByDocumentTypeId.mockResolvedValue([mockWorkflow]);
      mockInstanceRepository.createInstance.mockResolvedValue(mockInstance);
      mockDocumentRepository.updateStatus.mockResolvedValue(undefined);
      mockInstanceRepository.updateStatus.mockResolvedValue(undefined);
      mockInstanceRepository.createApprovalRecord.mockResolvedValue({});
      mockNotificationRepository.createNotification.mockResolvedValue({});

      const request: SubmitForApprovalRequest = {
        documentId,
        submittedBy,
        urgency: 'normal'
      };

      const result = await service.submitDocumentForApproval(request);

      expect(mockDocumentRepository.findById).toHaveBeenCalledWith(documentId);
      expect(mockWorkflowRepository.findByDocumentTypeId).toHaveBeenCalledWith('doc-type-1');
      expect(mockInstanceRepository.createInstance).toHaveBeenCalledWith(
        documentId,
        workflowId,
        submittedBy,
        'normal'
      );
      expect(mockDocumentRepository.updateStatus).toHaveBeenCalledWith(documentId, 'submitted');
      expect(result).toEqual(mockInstance);
    });

    it('should throw error if document not found', async () => {
      mockDocumentRepository.findById.mockResolvedValue(null);

      const request: SubmitForApprovalRequest = {
        documentId: 'non-existent',
        submittedBy: 'user-1'
      };

      await expect(service.submitDocumentForApproval(request)).rejects.toThrow(
        'Document not found'
      );
    });

    it('should throw error if document not in draft status', async () => {
      const mockDocument = {
        id: 'doc-1',
        status: 'approved',
        documentTypeId: 'doc-type-1'
      };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);

      const request: SubmitForApprovalRequest = {
        documentId: 'doc-1',
        submittedBy: 'user-1'
      };

      await expect(service.submitDocumentForApproval(request)).rejects.toThrow(
        'Can only submit documents in draft status'
      );
    });

    it('should throw error if no workflow configured', async () => {
      const mockDocument = {
        id: 'doc-1',
        status: 'draft',
        documentTypeId: 'doc-type-1'
      };

      mockDocumentRepository.findById.mockResolvedValue(mockDocument);
      mockWorkflowRepository.findByDocumentTypeId.mockResolvedValue([]);

      const request: SubmitForApprovalRequest = {
        documentId: 'doc-1',
        submittedBy: 'user-1'
      };

      await expect(service.submitDocumentForApproval(request)).rejects.toThrow(
        'No approval workflow configured for this document type'
      );
    });
  });

  describe('processApproval', () => {
    it('should approve document successfully', async () => {
      const instanceId = 'instance-1';
      const level = 1;
      const approverUserId = 'manager-1';

      const mockInstance: ApprovalInstance = {
        id: instanceId,
        documentId: 'doc-1',
        workflowId: 'workflow-1',
        currentLevel: level,
        status: 'in_progress',
        startedAt: new Date(),
        approvals: [
          {
            id: 'approval-1',
            instanceId,
            level,
            approverUserId,
            status: 'pending',
            createdBy: approverUserId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        escalations: [],
        delegations: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockWorkflow: ApprovalWorkflow = {
        id: 'workflow-1',
        name: 'Test Workflow',
        documentTypeIds: ['doc-type-1'],
        levels: [
          {
            level: 1,
            name: 'Manager Review',
            approverType: 'user',
            approverIds: ['manager-1'],
            requiredApprovals: 1,
            isParallel: false
          }
        ],
        escalationRules: [],
        delegationRules: [],
        isActive: true,
        createdBy: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockInstanceRepository.findById.mockResolvedValue(mockInstance);
      mockWorkflowRepository.findById.mockResolvedValue(mockWorkflow);
      mockInstanceRepository.updateApprovalRecord.mockResolvedValue(undefined);
      mockInstanceRepository.updateStatus.mockResolvedValue(undefined);
      mockDocumentRepository.updateStatus.mockResolvedValue(undefined);
      mockNotificationRepository.createNotification.mockResolvedValue({});

      const request: ProcessApprovalRequest = {
        instanceId,
        level,
        approverUserId,
        action: 'approve',
        comments: 'Looks good'
      };

      await service.processApproval(request);

      expect(mockInstanceRepository.findById).toHaveBeenCalledWith(instanceId);
      expect(mockInstanceRepository.updateApprovalRecord).toHaveBeenCalledWith(
        'approval-1',
        'approved',
        'Looks good'
      );
    });

    it('should reject document successfully', async () => {
      const instanceId = 'instance-1';
      const level = 1;
      const approverUserId = 'manager-1';

      const mockInstance: ApprovalInstance = {
        id: instanceId,
        documentId: 'doc-1',
        workflowId: 'workflow-1',
        currentLevel: level,
        status: 'in_progress',
        startedAt: new Date(),
        approvals: [
          {
            id: 'approval-1',
            instanceId,
            level,
            approverUserId,
            status: 'pending',
            createdBy: approverUserId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        escalations: [],
        delegations: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockInstanceRepository.findById.mockResolvedValue(mockInstance);
      mockInstanceRepository.updateApprovalRecord.mockResolvedValue(undefined);
      mockInstanceRepository.updateStatus.mockResolvedValue(undefined);
      mockDocumentRepository.updateStatus.mockResolvedValue(undefined);
      mockNotificationRepository.createNotification.mockResolvedValue({});

      const request: ProcessApprovalRequest = {
        instanceId,
        level,
        approverUserId,
        action: 'reject',
        comments: 'Needs more information'
      };

      await service.processApproval(request);

      expect(mockInstanceRepository.updateApprovalRecord).toHaveBeenCalledWith(
        'approval-1',
        'rejected',
        'Needs more information'
      );
      expect(mockInstanceRepository.updateStatus).toHaveBeenCalledWith(
        instanceId,
        'rejected',
        expect.any(Date)
      );
      expect(mockDocumentRepository.updateStatus).toHaveBeenCalledWith('doc-1', 'rejected');
    });

    it('should throw error if approval instance not found', async () => {
      mockInstanceRepository.findById.mockResolvedValue(null);

      const request: ProcessApprovalRequest = {
        instanceId: 'non-existent',
        level: 1,
        approverUserId: 'manager-1',
        action: 'approve'
      };

      await expect(service.processApproval(request)).rejects.toThrow(
        'Approval instance not found'
      );
    });

    it('should throw error if no pending approval found', async () => {
      const mockInstance: ApprovalInstance = {
        id: 'instance-1',
        documentId: 'doc-1',
        workflowId: 'workflow-1',
        currentLevel: 1,
        status: 'in_progress',
        startedAt: new Date(),
        approvals: [], // No approvals
        escalations: [],
        delegations: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockInstanceRepository.findById.mockResolvedValue(mockInstance);

      const request: ProcessApprovalRequest = {
        instanceId: 'instance-1',
        level: 1,
        approverUserId: 'manager-1',
        action: 'approve'
      };

      await expect(service.processApproval(request)).rejects.toThrow(
        'No pending approval found for this user at this level'
      );
    });
  });
});