import { BaseEntity, UUID, Priority } from './common';

export interface WorkflowDefinition extends BaseEntity {
  name: string;
  version: string;
  isActive: boolean;
  metadata: WorkflowMetadata;
  startEvent: string;
  endEvents: string[];
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
  variables: WorkflowVariable[];
  businessRules: BusinessRule[];
  escalationRules: EscalationRule[];
}

export interface WorkflowMetadata {
  description: string;
  category: string;
  estimatedDuration: string;
  applicableCustomerTiers: string[];
  prerequisites?: string[];
  specialFeatures?: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'manual' | 'automatic' | 'approval' | 'system' | 'start_event' | 'end_event';
  isStartStep?: boolean;
  isEndStep?: boolean;
  finalStatus?: string;
  actions?: string[];
  assignmentRules?: AssignmentRule[];
  requiredDocuments?: string[];
  requiredTools?: string[];
  timeoutMinutes?: number;
  timeoutHours?: number;
  chargeable?: boolean;
  autoStart?: boolean;
  maxIterations?: number;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  specialServices?: string[];
  systemAction?: string;
}

export interface WorkflowTransition {
  from: string;
  to: string;
  condition?: string;
  action?: string;
}

export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  defaultValue?: any;
  required: boolean;
}

export interface AssignmentRule {
  role?: string;
  skillLevelMin?: number;
  requiredCertifications?: string[];
  location?: string;
  maxConcurrentCases?: number;
}

export interface EscalationRule {
  stepId: string;
  timeoutHours: number;
  escalationLevels: EscalationLevel[];
}

export interface EscalationLevel {
  level: number;
  afterHours: number;
  notifyRoles: string[];
  actions?: string[];
}

export interface BusinessRule {
  id: string;
  description: string;
  condition: string;
  action: string;
  priority?: number;
}

export interface WorkflowInstance extends BaseEntity {
  definitionId: UUID;
  caseId: UUID;
  currentStepId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  variables: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkflowConfiguration extends BaseEntity {
  deviceTypeId: UUID;
  serviceType: 'repair' | 'maintenance' | 'installation' | 'inspection';
  customerTier?: 'platinum' | 'gold' | 'silver' | 'bronze';
  workflowDefinitionId: UUID;
  slaId?: UUID;
  priority: Priority;
  estimatedDurationHours: number;
  requiredCertifications: string[];
  requiredTools: string[];
  autoAssignmentRules: AssignmentRule;
  isActive: boolean;
}

export interface StepResult {
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  output?: Record<string, any>;
  notes?: string;
  completedBy?: UUID;
  completedAt: Date;
}

export interface WorkflowEvent {
  type: string;
  payload: Record<string, any>;
  timestamp: Date;
  source: string;
}