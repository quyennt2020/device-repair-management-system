import { Request, Response } from 'express';
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import { 
  CreateApprovalWorkflowRequest,
  UpdateApprovalWorkflowRequest,
  SubmitForApprovalRequest,
  ProcessApprovalRequest,
  DelegateApprovalRequest,
  EscalateApprovalRequest,
  ApprovalWorkflowSearchCriteria,
  ApprovalInstanceSearchCriteria,
  PendingApprovalsSearchCriteria
} from '../types/approval';

export class ApprovalWorkflowController {
  private approvalWorkflowService: ApprovalWorkflowService;

  constructor() {
    this.approvalWorkflowService = new ApprovalWorkflowService();
  }

  // Workflow Management
  createWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: CreateApprovalWorkflowRequest = req.body;
      const createdBy = req.user?.id;

      if (!createdBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const workflow = await this.approvalWorkflowService.createWorkflow(request, createdBy);
      
      res.status(201).json({
        success: true,
        data: workflow
      });
    } catch (error) {
      console.error('Error creating approval workflow:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to create approval workflow',
          statusCode: 400
        }
      });
    }
  };

  getWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const workflow = await this.approvalWorkflowService.getWorkflow(id);

      if (!workflow) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Approval workflow not found',
            statusCode: 404
          }
        });
        return;
      }

      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      console.error('Error getting approval workflow:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get approval workflow',
          statusCode: 500
        }
      });
    }
  };

  updateWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const request: UpdateApprovalWorkflowRequest = req.body;
      const updatedBy = req.user?.id;

      if (!updatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const workflow = await this.approvalWorkflowService.updateWorkflow(id, request, updatedBy);
      
      res.json({
        success: true,
        data: workflow
      });
    } catch (error) {
      console.error('Error updating approval workflow:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to update approval workflow',
          statusCode: 400
        }
      });
    }
  };

  deleteWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.approvalWorkflowService.deleteWorkflow(id);
      
      res.json({
        success: true,
        message: 'Approval workflow deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting approval workflow:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete approval workflow',
          statusCode: 400
        }
      });
    }
  };

  searchWorkflows = async (req: Request, res: Response): Promise<void> => {
    try {
      const criteria: ApprovalWorkflowSearchCriteria = {
        name: req.query.name as string,
        documentTypeId: req.query.documentTypeId as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        createdBy: req.query.createdBy as string,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.approvalWorkflowService.searchWorkflows(criteria);
      
      res.json({
        success: true,
        data: result.workflows,
        meta: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0
        }
      });
    } catch (error) {
      console.error('Error searching approval workflows:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to search approval workflows',
          statusCode: 500
        }
      });
    }
  };

  // Document Approval Process
  submitForApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: SubmitForApprovalRequest = {
        documentId: req.params.documentId,
        submittedBy: req.user?.id!,
        comments: req.body.comments,
        urgency: req.body.urgency
      };

      if (!request.submittedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const instance = await this.approvalWorkflowService.submitDocumentForApproval(request);
      
      res.status(201).json({
        success: true,
        data: instance
      });
    } catch (error) {
      console.error('Error submitting document for approval:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to submit document for approval',
          statusCode: 400
        }
      });
    }
  };

  processApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: ProcessApprovalRequest = {
        instanceId: req.params.instanceId,
        level: parseInt(req.body.level),
        approverUserId: req.user?.id!,
        action: req.body.action,
        comments: req.body.comments
      };

      if (!request.approverUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.approvalWorkflowService.processApproval(request);
      
      res.json({
        success: true,
        message: 'Approval processed successfully'
      });
    } catch (error) {
      console.error('Error processing approval:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to process approval',
          statusCode: 400
        }
      });
    }
  };

  delegateApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: DelegateApprovalRequest = {
        instanceId: req.params.instanceId,
        level: parseInt(req.body.level),
        fromUserId: req.user?.id!,
        toUserId: req.body.toUserId,
        reason: req.body.reason,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
      };

      if (!request.fromUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.approvalWorkflowService.delegateApproval(request);
      
      res.json({
        success: true,
        message: 'Approval delegated successfully'
      });
    } catch (error) {
      console.error('Error delegating approval:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to delegate approval',
          statusCode: 400
        }
      });
    }
  };

  escalateApproval = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: EscalateApprovalRequest = {
        instanceId: req.params.instanceId,
        fromLevel: parseInt(req.body.fromLevel),
        toLevel: parseInt(req.body.toLevel),
        reason: req.body.reason,
        escalatedBy: req.user?.id!
      };

      if (!request.escalatedBy) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      await this.approvalWorkflowService.escalateApproval(request);
      
      res.json({
        success: true,
        message: 'Approval escalated successfully'
      });
    } catch (error) {
      console.error('Error escalating approval:', error);
      res.status(400).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to escalate approval',
          statusCode: 400
        }
      });
    }
  };

  // Query Methods
  searchApprovalInstances = async (req: Request, res: Response): Promise<void> => {
    try {
      const criteria: ApprovalInstanceSearchCriteria = {
        documentId: req.query.documentId as string,
        workflowId: req.query.workflowId as string,
        status: req.query.status as any,
        currentLevel: req.query.currentLevel ? parseInt(req.query.currentLevel as string) : undefined,
        submittedBy: req.query.submittedBy as string,
        approverUserId: req.query.approverUserId as string,
        startedAfter: req.query.startedAfter ? new Date(req.query.startedAfter as string) : undefined,
        startedBefore: req.query.startedBefore ? new Date(req.query.startedBefore as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      const result = await this.approvalWorkflowService.searchApprovalInstances(criteria);
      
      res.json({
        success: true,
        data: result.instances,
        meta: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0
        }
      });
    } catch (error) {
      console.error('Error searching approval instances:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to search approval instances',
          statusCode: 500
        }
      });
    }
  };

  getPendingApprovals = async (req: Request, res: Response): Promise<void> => {
    try {
      const criteria: PendingApprovalsSearchCriteria = {
        approverUserId: req.user?.id!,
        workflowId: req.query.workflowId as string,
        urgency: req.query.urgency as any,
        level: req.query.level ? parseInt(req.query.level as string) : undefined,
        submittedAfter: req.query.submittedAfter ? new Date(req.query.submittedAfter as string) : undefined,
        submittedBefore: req.query.submittedBefore ? new Date(req.query.submittedBefore as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
      };

      if (!criteria.approverUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const result = await this.approvalWorkflowService.getPendingApprovals(criteria);
      
      res.json({
        success: true,
        data: result.approvals,
        meta: {
          total: result.total,
          limit: criteria.limit || 50,
          offset: criteria.offset || 0
        }
      });
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get pending approvals',
          statusCode: 500
        }
      });
    }
  };

  getApprovalHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const history = await this.approvalWorkflowService.getApprovalHistory(documentId);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting approval history:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to get approval history',
          statusCode: 500
        }
      });
    }
  };
}