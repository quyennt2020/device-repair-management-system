import { AuditableEntity, UUID, ContactInfo, Location } from './common';

export interface Technician extends AuditableEntity {
  employeeCode: string;
  userId: UUID;
  personalInfo: TechnicianPersonalInfo;
  employmentInfo: TechnicianEmploymentInfo;
  skills: TechnicianSkills;
  certifications: TechnicianCertification[];
  scheduleInfo: TechnicianSchedule;
  performanceMetrics: TechnicianPerformanceMetrics;
  maxConcurrentCases: number;
  status: TechnicianStatus;
}

export interface TechnicianPersonalInfo extends ContactInfo {
  fullName: string;
  dateOfBirth?: Date;
  address?: Location;
  emergencyContact?: ContactInfo;
}

export interface TechnicianEmploymentInfo {
  department: string;
  position: string;
  hireDate: Date;
  supervisorId?: UUID;
  employmentType: EmploymentType;
  hourlyRate?: number;
  salaryGrade?: string;
}

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';

export interface TechnicianSkills {
  [skillName: string]: number; // 1-5 skill level
}

export interface TechnicianCertification {
  id: string;
  certificateId: UUID;
  name: string;
  code: string;
  issueDate: Date;
  expiryDate: Date;
  certificateNumber: string;
  issuingAuthority: string;
  status: CertificationStatus;
  attachmentUrl?: string;
}

export type CertificationStatus = 'valid' | 'expired' | 'suspended' | 'pending_renewal';

export interface TechnicianSchedule {
  workingHours: WorkingHours;
  availableDays: DayOfWeek[];
  timeZone: string;
  shiftType: ShiftType;
  overtimeAllowed: boolean;
  maxOvertimeHours?: number;
}

export interface WorkingHours {
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  breakDuration?: number; // minutes
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type ShiftType = 'day' | 'night' | 'rotating' | 'flexible';

export interface TechnicianPerformanceMetrics {
  averageRating: number;
  totalCasesCompleted: number;
  averageResolutionTime: number;
  customerSatisfactionScore: number;
  qualityScore: number;
  onTimeCompletionRate: number;
  certificationComplianceRate: number;
  lastPerformanceReviewDate?: Date;
}

export type TechnicianStatus = 
  | 'active'
  | 'on_leave'
  | 'sick_leave'
  | 'training'
  | 'resigned'
  | 'terminated'
  | 'suspended';

export interface TechnicianAvailability extends AuditableEntity {
  technicianId: UUID;
  date: Date;
  shift: ShiftType;
  status: AvailabilityStatus;
  notes?: string;
  overrideReason?: string;
}

export type AvailabilityStatus = 
  | 'available'
  | 'assigned'
  | 'on_leave'
  | 'sick'
  | 'training'
  | 'overtime'
  | 'unavailable';

export interface TechnicianAssignment extends AuditableEntity {
  technicianId: UUID;
  caseId: UUID;
  assignedAt: Date;
  estimatedStartDate?: Date;
  estimatedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  notes?: string;
}

export type AssignmentStatus = 
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'reassigned';

export type AssignmentPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TechnicianWorkload {
  technicianId: UUID;
  activeCases: number;
  maxConcurrentCases: number;
  utilizationPercentage: number;
  averageCaseDuration: number;
  upcomingAssignments: TechnicianAssignment[];
  availableCapacity: number;
}

export interface TechnicianLocation extends AuditableEntity {
  technicianId: UUID;
  location: Location;
  timestamp: Date;
  accuracy?: number;
  isOnsite: boolean;
  caseId?: UUID;
}

export interface TechnicianTraining extends AuditableEntity {
  technicianId: UUID;
  trainingName: string;
  trainingType: TrainingType;
  provider: string;
  startDate: Date;
  endDate: Date;
  status: TrainingStatus;
  certificateEarned?: string;
  cost?: number;
  notes?: string;
}

export type TrainingType = 'certification' | 'skill_development' | 'safety' | 'product_specific' | 'soft_skills';
export type TrainingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

export interface TechnicianReview extends AuditableEntity {
  technicianId: UUID;
  reviewerId: UUID;
  reviewPeriod: ReviewPeriod;
  overallRating: number;
  technicalSkillsRating: number;
  customerServiceRating: number;
  timeManagementRating: number;
  communicationRating: number;
  strengths: string[];
  areasForImprovement: string[];
  goals: ReviewGoal[];
  comments: string;
}

export interface ReviewPeriod {
  startDate: Date;
  endDate: Date;
  type: 'quarterly' | 'semi_annual' | 'annual' | 'probationary';
}

export interface ReviewGoal {
  description: string;
  targetDate: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  notes?: string;
}

// DTOs
export interface CreateTechnicianRequest {
  employeeCode: string;
  userId: UUID;
  personalInfo: TechnicianPersonalInfo;
  employmentInfo: TechnicianEmploymentInfo;
  skills: TechnicianSkills;
  scheduleInfo: TechnicianSchedule;
  maxConcurrentCases?: number;
}

export interface UpdateTechnicianRequest {
  personalInfo?: Partial<TechnicianPersonalInfo>;
  employmentInfo?: Partial<TechnicianEmploymentInfo>;
  skills?: TechnicianSkills;
  scheduleInfo?: TechnicianSchedule;
  maxConcurrentCases?: number;
  status?: TechnicianStatus;
}

export interface TechnicianSearchCriteria {
  query?: string;
  department?: string;
  position?: string;
  status?: TechnicianStatus;
  skillName?: string;
  minSkillLevel?: number;
  certificationCode?: string;
  availableDate?: Date;
  location?: Location;
  maxDistance?: number; // km
}

export interface TechnicianSearchResult {
  technicians: Technician[];
  total: number;
  page: number;
  limit: number;
}

export interface TechnicianAssignmentRequest {
  technicianId: UUID;
  caseId: UUID;
  estimatedStartDate?: Date;
  estimatedEndDate?: Date;
  priority: AssignmentPriority;
  notes?: string;
}

export interface TechnicianAssignmentScore {
  technicianId: UUID;
  score: number;
  factors: ScoreFactor[];
  confidence: number;
  availability: boolean;
  estimatedStartDate?: Date;
}

export interface ScoreFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}