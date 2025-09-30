import { Pool } from 'pg';
import { WorkloadRepository } from '../repositories/workload.repository';
import { TechnicianRepository } from '../repositories/technician.repository';
import { 
  TechnicianWorkload, 
  CreateWorkloadRequest, 
  UpdateWorkloadRequest,
  WorkloadSummary,
  CapacityPlanningReport,
  WorkloadDistribution
} from '@shared/types/src/technician';
import { createError } from '../middleware/error.middleware';

export class WorkloadService {
  private workloadRepo: WorkloadRepository;
  private technicianRepo: TechnicianRepository;

  constructor(private pool: Pool) {
    this.workloadRepo = new WorkloadRepository(pool);
    this.technicianRepo = new TechnicianRepository(pool);
  }

  async createWorkloadRecord(data: CreateWorkloadRequest): Promise<TechnicianWorkload> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(data.technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    // Calculate derived metrics
    const calculatedData = this.calculateWorkloadMetrics(data);

    return await this.workloadRepo.create(calculatedData);
  }

  async updateWorkloadRecord(id: string, data: UpdateWorkloadRequest): Promise<TechnicianWorkload> {
    // Validate record exists
    const existingRecord = await this.workloadRepo.findById(id);
    if (!existingRecord) {
      throw createError('Workload record not found', 404);
    }

    // Calculate derived metrics
    const calculatedData = this.calculateWorkloadMetrics(data);

    return await this.workloadRepo.update(id, calculatedData);
  }

  async upsertWorkloadRecord(data: CreateWorkloadRequest): Promise<TechnicianWorkload> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(data.technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    // Calculate derived metrics
    const calculatedData = this.calculateWorkloadMetrics(data);

    return await this.workloadRepo.upsert(calculatedData);
  }

  async getWorkloadRecord(id: string): Promise<TechnicianWorkload> {
    const workload = await this.workloadRepo.findById(id);
    if (!workload) {
      throw createError('Workload record not found', 404);
    }
    return workload;
  }

  async getTechnicianWorkload(technicianId: string, date: Date): Promise<TechnicianWorkload | null> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    return await this.workloadRepo.findByTechnicianAndDate(technicianId, date);
  }

  async getWorkloadByDateRange(startDate: Date, endDate: Date, technicianId?: string): Promise<TechnicianWorkload[]> {
    if (technicianId) {
      // Validate technician exists
      const technician = await this.technicianRepo.findById(technicianId);
      if (!technician) {
        throw createError('Technician not found', 404);
      }
    }

    return await this.workloadRepo.findByDateRange(startDate, endDate, technicianId);
  }

  async getOverloadedTechnicians(date?: Date): Promise<TechnicianWorkload[]> {
    return await this.workloadRepo.findOverloadedTechnicians(date);
  }

  async getWorkloadSummary(technicianId: string, days: number = 7): Promise<WorkloadSummary> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    return await this.workloadRepo.getWorkloadSummary(technicianId, days);
  }

  async generateCapacityPlanningReport(startDate: Date, endDate: Date, department?: string): Promise<CapacityPlanningReport> {
    // Get all active technicians
    let technicians;
    if (department) {
      const criteria = { department, status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      technicians = result.technicians;
    } else {
      const criteria = { status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      technicians = result.technicians;
    }

    // Get workload data for all technicians
    const workloadData = await this.workloadRepo.findByDateRange(startDate, endDate);
    
    // Calculate capacity metrics
    const totalCapacity = technicians.length * this.getWorkingDaysInPeriod(startDate, endDate) * 8; // Assuming 8 hours per day
    const totalUtilized = workloadData.reduce((sum, w) => sum + w.totalEstimatedHours, 0);
    const overloadedDays = workloadData.filter(w => w.isOverloaded).length;
    
    // Group by technician
    const technicianWorkloads = technicians.map(tech => {
      const techWorkloads = workloadData.filter(w => w.technicianId === tech.id);
      const avgUtilization = techWorkloads.length > 0 
        ? techWorkloads.reduce((sum, w) => sum + w.utilizationRate, 0) / techWorkloads.length 
        : 0;
      
      return {
        technician: tech,
        avgUtilization,
        overloadedDays: techWorkloads.filter(w => w.isOverloaded).length,
        totalHours: techWorkloads.reduce((sum, w) => sum + w.totalEstimatedHours, 0)
      };
    });

    // Identify bottlenecks and recommendations
    const bottlenecks = this.identifyBottlenecks(technicianWorkloads);
    const recommendations = this.generateCapacityRecommendations(technicianWorkloads, totalCapacity, totalUtilized);

    return {
      period: { startDate, endDate },
      department,
      totalTechnicians: technicians.length,
      totalCapacityHours: totalCapacity,
      totalUtilizedHours: totalUtilized,
      overallUtilization: (totalUtilized / totalCapacity) * 100,
      overloadedDays,
      technicianWorkloads,
      bottlenecks,
      recommendations,
      trends: await this.calculateCapacityTrends(startDate, endDate, department)
    };
  }

  async getWorkloadDistribution(date: Date, department?: string): Promise<WorkloadDistribution> {
    // Get technicians
    let technicians;
    if (department) {
      const criteria = { department, status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      technicians = result.technicians;
    } else {
      const criteria = { status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      technicians = result.technicians;
    }

    // Get workload data for the date
    const workloadData = await this.workloadRepo.findByDateRange(date, date);
    
    // Calculate distribution metrics
    const utilizationRates = workloadData.map(w => w.utilizationRate);
    const avgUtilization = utilizationRates.length > 0 
      ? utilizationRates.reduce((a, b) => a + b, 0) / utilizationRates.length 
      : 0;
    
    const underutilized = workloadData.filter(w => w.utilizationRate < 70).length;
    const optimal = workloadData.filter(w => w.utilizationRate >= 70 && w.utilizationRate <= 90).length;
    const overloaded = workloadData.filter(w => w.utilizationRate > 90).length;

    return {
      date,
      department,
      totalTechnicians: technicians.length,
      avgUtilization,
      distribution: {
        underutilized,
        optimal,
        overloaded
      },
      workloadData: workloadData.map(w => ({
        technicianId: w.technicianId,
        technicianName: w.technicianName || 'Unknown',
        utilizationRate: w.utilizationRate,
        activeCases: w.activeCases,
        isOverloaded: w.isOverloaded
      }))
    };
  }

  async balanceWorkload(date: Date, department?: string): Promise<{ recommendations: Array<{ from: string, to: string, cases: number, reason: string }> }> {
    const distribution = await this.getWorkloadDistribution(date, department);
    const recommendations: Array<{ from: string, to: string, cases: number, reason: string }> = [];

    // Find overloaded and underutilized technicians
    const overloaded = distribution.workloadData.filter(w => w.utilizationRate > 90);
    const underutilized = distribution.workloadData.filter(w => w.utilizationRate < 70);

    // Generate rebalancing recommendations
    overloaded.forEach(over => {
      const excessCases = Math.ceil((over.utilizationRate - 85) / 10); // Rough calculation
      
      underutilized.forEach(under => {
        if (excessCases > 0 && under.utilizationRate < 80) {
          const casesToMove = Math.min(excessCases, 3); // Don't move too many at once
          recommendations.push({
            from: over.technicianName,
            to: under.technicianName,
            cases: casesToMove,
            reason: `Balance workload: ${over.technicianName} is ${over.utilizationRate.toFixed(1)}% utilized, ${under.technicianName} is ${under.utilizationRate.toFixed(1)}% utilized`
          });
        }
      });
    });

    return { recommendations };
  }

  async deleteWorkloadRecord(id: string): Promise<void> {
    const existingRecord = await this.workloadRepo.findById(id);
    if (!existingRecord) {
      throw createError('Workload record not found', 404);
    }

    await this.workloadRepo.delete(id);
  }

  private calculateWorkloadMetrics(data: CreateWorkloadRequest | UpdateWorkloadRequest): CreateWorkloadRequest | UpdateWorkloadRequest {
    const result = { ...data };

    // Calculate utilization rate
    if (data.totalEstimatedHours !== undefined && data.capacityHours !== undefined && data.capacityHours > 0) {
      result.utilizationRate = (data.totalEstimatedHours / data.capacityHours) * 100;
    }

    // Determine if overloaded
    if (result.utilizationRate !== undefined && data.overloadThreshold !== undefined) {
      result.isOverloaded = result.utilizationRate > data.overloadThreshold;
    }

    return result;
  }

  private getWorkingDaysInPeriod(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  }

  private identifyBottlenecks(technicianWorkloads: Array<{ technician: any, avgUtilization: number, overloadedDays: number }>): string[] {
    const bottlenecks: string[] = [];

    const highUtilization = technicianWorkloads.filter(tw => tw.avgUtilization > 95);
    if (highUtilization.length > 0) {
      bottlenecks.push(`${highUtilization.length} technician(s) consistently over 95% utilization`);
    }

    const frequentOverload = technicianWorkloads.filter(tw => tw.overloadedDays > 5);
    if (frequentOverload.length > 0) {
      bottlenecks.push(`${frequentOverload.length} technician(s) overloaded more than 5 days`);
    }

    const avgUtilization = technicianWorkloads.reduce((sum, tw) => sum + tw.avgUtilization, 0) / technicianWorkloads.length;
    if (avgUtilization > 85) {
      bottlenecks.push('Overall team utilization is high, consider hiring additional technicians');
    }

    return bottlenecks;
  }

  private generateCapacityRecommendations(
    technicianWorkloads: Array<{ technician: any, avgUtilization: number, overloadedDays: number }>,
    totalCapacity: number,
    totalUtilized: number
  ): string[] {
    const recommendations: string[] = [];

    const overallUtilization = (totalUtilized / totalCapacity) * 100;

    if (overallUtilization > 90) {
      recommendations.push('Consider hiring additional technicians to reduce overall workload');
    } else if (overallUtilization < 60) {
      recommendations.push('Team capacity is underutilized, consider taking on additional work');
    }

    const imbalanced = technicianWorkloads.some(tw => tw.avgUtilization > 90) && 
                     technicianWorkloads.some(tw => tw.avgUtilization < 60);
    if (imbalanced) {
      recommendations.push('Workload distribution is uneven, consider rebalancing assignments');
    }

    const skillGaps = technicianWorkloads.filter(tw => tw.avgUtilization < 50);
    if (skillGaps.length > 0) {
      recommendations.push('Some technicians are underutilized, consider cross-training or skill development');
    }

    return recommendations;
  }

  private async calculateCapacityTrends(startDate: Date, endDate: Date, department?: string): Promise<{ utilizationTrend: number, overloadTrend: number }> {
    // Calculate previous period for comparison
    const periodDuration = endDate.getTime() - startDate.getTime();
    const previousPeriodEnd = new Date(startDate.getTime());
    const previousPeriodStart = new Date(startDate.getTime() - periodDuration);

    const currentData = await this.workloadRepo.findByDateRange(startDate, endDate);
    const previousData = await this.workloadRepo.findByDateRange(previousPeriodStart, previousPeriodEnd);

    const currentAvgUtilization = currentData.length > 0 
      ? currentData.reduce((sum, w) => sum + w.utilizationRate, 0) / currentData.length 
      : 0;
    
    const previousAvgUtilization = previousData.length > 0 
      ? previousData.reduce((sum, w) => sum + w.utilizationRate, 0) / previousData.length 
      : 0;

    const currentOverloadRate = currentData.length > 0 
      ? (currentData.filter(w => w.isOverloaded).length / currentData.length) * 100 
      : 0;
    
    const previousOverloadRate = previousData.length > 0 
      ? (previousData.filter(w => w.isOverloaded).length / previousData.length) * 100 
      : 0;

    return {
      utilizationTrend: previousAvgUtilization > 0 
        ? ((currentAvgUtilization - previousAvgUtilization) / previousAvgUtilization) * 100 
        : 0,
      overloadTrend: previousOverloadRate > 0 
        ? ((currentOverloadRate - previousOverloadRate) / previousOverloadRate) * 100 
        : 0
    };
  }
}