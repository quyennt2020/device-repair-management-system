import { Pool } from 'pg';
import { TechnicianRepository } from '../repositories/technician.repository';
import { SkillRepository } from '../repositories/skill.repository';
import { PerformanceRepository } from '../repositories/performance.repository';
import { WorkloadRepository } from '../repositories/workload.repository';
import { 
  Technician, 
  CreateTechnicianRequest, 
  UpdateTechnicianRequest, 
  TechnicianSearchCriteria,
  TechnicianProfile,
  TechnicianSummary
} from '@shared/types/src/technician';
import { createError } from '../middleware/error.middleware';

export class TechnicianService {
  private technicianRepo: TechnicianRepository;
  private skillRepo: SkillRepository;
  private performanceRepo: PerformanceRepository;
  private workloadRepo: WorkloadRepository;

  constructor(private pool: Pool) {
    this.technicianRepo = new TechnicianRepository(pool);
    this.skillRepo = new SkillRepository(pool);
    this.performanceRepo = new PerformanceRepository(pool);
    this.workloadRepo = new WorkloadRepository(pool);
  }

  async createTechnician(data: CreateTechnicianRequest): Promise<Technician> {
    // Validate employee ID uniqueness
    const existingTechnician = await this.technicianRepo.findByEmployeeId(data.employeeId);
    if (existingTechnician) {
      throw createError('Employee ID already exists', 400);
    }

    // Validate supervisor exists if provided
    if (data.supervisorId) {
      const supervisor = await this.technicianRepo.findById(data.supervisorId);
      if (!supervisor) {
        throw createError('Supervisor not found', 400);
      }
    }

    return await this.technicianRepo.create(data);
  }

  async getTechnician(id: string): Promise<Technician> {
    const technician = await this.technicianRepo.findById(id);
    if (!technician) {
      throw createError('Technician not found', 404);
    }
    return technician;
  }

  async getTechnicianByEmployeeId(employeeId: string): Promise<Technician> {
    const technician = await this.technicianRepo.findByEmployeeId(employeeId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }
    return technician;
  }

  async updateTechnician(id: string, data: UpdateTechnicianRequest): Promise<Technician> {
    // Validate technician exists
    const existingTechnician = await this.technicianRepo.findById(id);
    if (!existingTechnician) {
      throw createError('Technician not found', 404);
    }

    // Validate supervisor exists if provided
    if (data.supervisorId) {
      const supervisor = await this.technicianRepo.findById(data.supervisorId);
      if (!supervisor) {
        throw createError('Supervisor not found', 400);
      }
      
      // Prevent circular supervision
      if (data.supervisorId === id) {
        throw createError('Technician cannot supervise themselves', 400);
      }
    }

    return await this.technicianRepo.update(id, data);
  }

  async searchTechnicians(criteria: TechnicianSearchCriteria): Promise<{ technicians: Technician[], total: number }> {
    return await this.technicianRepo.search(criteria);
  }

  async getAvailableTechnicians(date: Date, requiredSkills?: string[]): Promise<Technician[]> {
    return await this.technicianRepo.findAvailableTechnicians(date, requiredSkills);
  }

  async getTechnicianProfile(id: string): Promise<TechnicianProfile> {
    const technician = await this.getTechnician(id);
    const skills = await this.skillRepo.findByTechnicianId(id);
    const recentPerformance = await this.performanceRepo.findByTechnicianId(id, 3);
    const currentWorkload = await this.workloadRepo.findByTechnicianAndDate(id, new Date());

    return {
      technician,
      skills,
      recentPerformance,
      currentWorkload
    };
  }

  async getTechnicianSummary(id: string): Promise<TechnicianSummary> {
    const technician = await this.getTechnician(id);
    const skills = await this.skillRepo.findByTechnicianId(id);
    
    // Get performance metrics for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const performanceMetrics = await this.performanceRepo.getPerformanceMetrics(
      id, 
      thirtyDaysAgo, 
      new Date()
    );
    
    // Get workload summary for last 7 days
    const workloadSummary = await this.workloadRepo.getWorkloadSummary(id, 7);
    
    // Get current workload
    const currentWorkload = await this.workloadRepo.findByTechnicianAndDate(id, new Date());

    return {
      technician,
      skillCount: skills.length,
      topSkills: skills
        .sort((a, b) => b.proficiencyLevel - a.proficiencyLevel)
        .slice(0, 5)
        .map(s => ({ name: s.skillName, level: s.proficiencyLevel })),
      performanceMetrics,
      workloadSummary,
      currentUtilization: currentWorkload?.utilizationRate || 0,
      isOverloaded: currentWorkload?.isOverloaded || false
    };
  }

  async getTeamMembers(supervisorId: string): Promise<Technician[]> {
    const criteria: TechnicianSearchCriteria = {
      supervisorId,
      status: 'active'
    };
    const result = await this.technicianRepo.search(criteria);
    return result.technicians;
  }

  async deactivateTechnician(id: string, reason?: string): Promise<Technician> {
    const updateData: UpdateTechnicianRequest = {
      status: 'inactive',
      notes: reason ? `Deactivated: ${reason}` : 'Deactivated'
    };
    return await this.updateTechnician(id, updateData);
  }

  async reactivateTechnician(id: string): Promise<Technician> {
    const updateData: UpdateTechnicianRequest = {
      status: 'active'
    };
    return await this.updateTechnician(id, updateData);
  }

  async deleteTechnician(id: string): Promise<void> {
    // Check if technician has any active cases or is supervising others
    const teamMembers = await this.getTeamMembers(id);
    if (teamMembers.length > 0) {
      throw createError('Cannot delete technician who is supervising other technicians', 400);
    }

    // TODO: Check for active cases when case service is integrated
    
    await this.technicianRepo.delete(id);
  }

  async getTechniciansByDepartment(department: string): Promise<Technician[]> {
    const criteria: TechnicianSearchCriteria = {
      department,
      status: 'active'
    };
    const result = await this.technicianRepo.search(criteria);
    return result.technicians;
  }

  async getTechniciansByLocation(location: string): Promise<Technician[]> {
    const criteria: TechnicianSearchCriteria = {
      baseLocation: location,
      status: 'active'
    };
    const result = await this.technicianRepo.search(criteria);
    return result.technicians;
  }

  async validateTechnicianAssignment(technicianId: string, requiredSkills: string[], requiredCertifications: string[]): Promise<{ valid: boolean, missingSkills: string[], missingCertifications: string[] }> {
    const technician = await this.getTechnician(technicianId);
    if (technician.status !== 'active') {
      return {
        valid: false,
        missingSkills: requiredSkills,
        missingCertifications: requiredCertifications
      };
    }

    const skills = await this.skillRepo.findByTechnicianId(technicianId);
    const technicianSkills = skills.map(s => s.skillName);
    
    const missingSkills = requiredSkills.filter(skill => !technicianSkills.includes(skill));
    
    // TODO: Check certifications when certification repository is implemented
    const missingCertifications: string[] = [];

    return {
      valid: missingSkills.length === 0 && missingCertifications.length === 0,
      missingSkills,
      missingCertifications
    };
  }
}