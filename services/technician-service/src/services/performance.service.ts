import { Pool } from 'pg';
import { PerformanceRepository } from '../repositories/performance.repository';
import { TechnicianRepository } from '../repositories/technician.repository';
import { 
  TechnicianPerformance, 
  CreatePerformanceRequest, 
  UpdatePerformanceRequest,
  PerformanceMetrics,
  PerformanceReport,
  PerformanceComparison
} from '@shared/types/src/technician';
import { createError } from '../middleware/error.middleware';

export class PerformanceService {
  private performanceRepo: PerformanceRepository;
  private technicianRepo: TechnicianRepository;

  constructor(private pool: Pool) {
    this.performanceRepo = new PerformanceRepository(pool);
    this.technicianRepo = new TechnicianRepository(pool);
  }

  async createPerformanceRecord(data: CreatePerformanceRequest): Promise<TechnicianPerformance> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(data.technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    // Validate period dates
    if (data.periodStart >= data.periodEnd) {
      throw createError('Period start date must be before end date', 400);
    }

    // Calculate derived metrics
    const calculatedData = this.calculateDerivedMetrics(data);

    return await this.performanceRepo.create(calculatedData);
  }

  async getPerformanceRecord(id: string): Promise<TechnicianPerformance> {
    const performance = await this.performanceRepo.findById(id);
    if (!performance) {
      throw createError('Performance record not found', 404);
    }
    return performance;
  }

  async updatePerformanceRecord(id: string, data: UpdatePerformanceRequest): Promise<TechnicianPerformance> {
    // Validate record exists
    const existingRecord = await this.performanceRepo.findById(id);
    if (!existingRecord) {
      throw createError('Performance record not found', 404);
    }

    // Calculate derived metrics if relevant fields are updated
    const calculatedData = this.calculateDerivedMetrics(data);

    return await this.performanceRepo.update(id, calculatedData);
  }

  async getTechnicianPerformanceHistory(technicianId: string, limit?: number): Promise<TechnicianPerformance[]> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    return await this.performanceRepo.findByTechnicianId(technicianId, limit);
  }

  async getPerformanceMetrics(technicianId: string, periodStart: Date, periodEnd: Date): Promise<PerformanceMetrics> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    return await this.performanceRepo.getPerformanceMetrics(technicianId, periodStart, periodEnd);
  }

  async getTopPerformers(limit: number = 10, metric: string = 'efficiency_score'): Promise<TechnicianPerformance[]> {
    const validMetrics = [
      'efficiency_score', 'quality_score', 'completion_rate', 
      'customer_satisfaction_avg', 'sla_compliance_rate', 'first_time_fix_rate'
    ];
    
    if (!validMetrics.includes(metric)) {
      throw createError('Invalid performance metric', 400);
    }

    return await this.performanceRepo.getTopPerformers(limit, metric);
  }

  async generatePerformanceReport(technicianId: string, periodStart: Date, periodEnd: Date): Promise<PerformanceReport> {
    // Validate technician exists
    const technician = await this.technicianRepo.findById(technicianId);
    if (!technician) {
      throw createError('Technician not found', 404);
    }

    const performanceHistory = await this.performanceRepo.findByTechnicianId(technicianId);
    const currentMetrics = await this.performanceRepo.getPerformanceMetrics(technicianId, periodStart, periodEnd);
    
    // Calculate previous period for comparison
    const periodDuration = periodEnd.getTime() - periodStart.getTime();
    const previousPeriodEnd = new Date(periodStart.getTime());
    const previousPeriodStart = new Date(periodStart.getTime() - periodDuration);
    
    const previousMetrics = await this.performanceRepo.getPerformanceMetrics(
      technicianId, 
      previousPeriodStart, 
      previousPeriodEnd
    );

    // Calculate trends
    const trends = this.calculateTrends(currentMetrics, previousMetrics);
    
    // Get performance ranking
    const allPerformers = await this.performanceRepo.getTopPerformers(1000, 'efficiency_score');
    const ranking = allPerformers.findIndex(p => p.technicianId === technicianId) + 1;

    return {
      technician,
      periodStart,
      periodEnd,
      currentMetrics,
      previousMetrics,
      trends,
      performanceHistory: performanceHistory.slice(0, 12), // Last 12 periods
      ranking,
      totalTechnicians: allPerformers.length,
      strengths: this.identifyStrengths(currentMetrics),
      improvementAreas: this.identifyImprovementAreas(currentMetrics),
      recommendations: this.generateRecommendations(currentMetrics, trends)
    };
  }

  async comparePerformance(technicianIds: string[], periodStart: Date, periodEnd: Date): Promise<PerformanceComparison> {
    const comparisons = await Promise.all(
      technicianIds.map(async (id) => {
        const technician = await this.technicianRepo.findById(id);
        if (!technician) {
          throw createError(`Technician ${id} not found`, 404);
        }
        
        const metrics = await this.performanceRepo.getPerformanceMetrics(id, periodStart, periodEnd);
        return { technician, metrics };
      })
    );

    // Calculate averages and rankings
    const avgMetrics = this.calculateAverageMetrics(comparisons.map(c => c.metrics));
    const rankings = this.calculateRankings(comparisons);

    return {
      periodStart,
      periodEnd,
      comparisons,
      averageMetrics: avgMetrics,
      rankings,
      insights: this.generateComparisonInsights(comparisons)
    };
  }

  async deletePerformanceRecord(id: string): Promise<void> {
    const existingRecord = await this.performanceRepo.findById(id);
    if (!existingRecord) {
      throw createError('Performance record not found', 404);
    }

    await this.performanceRepo.delete(id);
  }

  private calculateDerivedMetrics(data: CreatePerformanceRequest | UpdatePerformanceRequest): CreatePerformanceRequest | UpdatePerformanceRequest {
    const result = { ...data };

    // Calculate completion rate
    if (data.casesCompleted !== undefined && data.casesAssigned !== undefined && data.casesAssigned > 0) {
      result.completionRate = (data.casesCompleted / data.casesAssigned) * 100;
    }

    // Calculate efficiency score (cases completed per hour worked)
    if (data.casesCompleted !== undefined && data.totalHoursWorked !== undefined && data.totalHoursWorked > 0) {
      result.efficiencyScore = (data.casesCompleted / data.totalHoursWorked) * 10; // Scale to 0-100
    }

    // Calculate quality score based on customer satisfaction and first-time fix rate
    if (data.customerSatisfactionAvg !== undefined && data.firstTimeFixRate !== undefined) {
      result.qualityScore = (data.customerSatisfactionAvg * 20 + data.firstTimeFixRate) / 2; // Scale to 0-100
    }

    return result;
  }

  private calculateTrends(current: PerformanceMetrics, previous: PerformanceMetrics): Record<string, number> {
    const trends: Record<string, number> = {};

    const metrics = [
      'avgCompletionRate', 'avgResolutionTime', 'avgCustomerSatisfaction',
      'avgSlaCompliance', 'avgFirstTimeFix', 'avgEfficiency', 'avgQuality'
    ];

    metrics.forEach(metric => {
      const currentValue = current[metric as keyof PerformanceMetrics] as number;
      const previousValue = previous[metric as keyof PerformanceMetrics] as number;
      
      if (previousValue > 0) {
        trends[metric] = ((currentValue - previousValue) / previousValue) * 100;
      } else {
        trends[metric] = 0;
      }
    });

    return trends;
  }

  private identifyStrengths(metrics: PerformanceMetrics): string[] {
    const strengths: string[] = [];

    if (metrics.avgCustomerSatisfaction >= 4.5) {
      strengths.push('Excellent customer satisfaction');
    }
    if (metrics.avgSlaCompliance >= 95) {
      strengths.push('Outstanding SLA compliance');
    }
    if (metrics.avgFirstTimeFix >= 85) {
      strengths.push('High first-time fix rate');
    }
    if (metrics.avgEfficiency >= 8) {
      strengths.push('High efficiency');
    }
    if (metrics.avgQuality >= 85) {
      strengths.push('Excellent quality scores');
    }

    return strengths;
  }

  private identifyImprovementAreas(metrics: PerformanceMetrics): string[] {
    const areas: string[] = [];

    if (metrics.avgCustomerSatisfaction < 3.5) {
      areas.push('Customer satisfaction needs improvement');
    }
    if (metrics.avgSlaCompliance < 80) {
      areas.push('SLA compliance below target');
    }
    if (metrics.avgFirstTimeFix < 70) {
      areas.push('First-time fix rate needs improvement');
    }
    if (metrics.avgEfficiency < 5) {
      areas.push('Efficiency could be improved');
    }
    if (metrics.avgResolutionTime > 8) {
      areas.push('Resolution time is above average');
    }

    return areas;
  }

  private generateRecommendations(metrics: PerformanceMetrics, trends: Record<string, number>): string[] {
    const recommendations: string[] = [];

    if (metrics.avgCustomerSatisfaction < 4.0) {
      recommendations.push('Consider additional customer service training');
    }
    if (metrics.avgFirstTimeFix < 75) {
      recommendations.push('Focus on diagnostic skills improvement');
    }
    if (trends.avgEfficiency < -10) {
      recommendations.push('Review workload distribution and time management');
    }
    if (metrics.avgSlaCompliance < 85) {
      recommendations.push('Implement better time tracking and prioritization');
    }

    return recommendations;
  }

  private calculateAverageMetrics(metricsArray: PerformanceMetrics[]): PerformanceMetrics {
    const count = metricsArray.length;
    if (count === 0) {
      throw createError('No metrics to calculate average', 400);
    }

    const sums = metricsArray.reduce((acc, metrics) => {
      Object.keys(metrics).forEach(key => {
        acc[key] = (acc[key] || 0) + (metrics[key as keyof PerformanceMetrics] as number);
      });
      return acc;
    }, {} as Record<string, number>);

    const averages: PerformanceMetrics = {} as PerformanceMetrics;
    Object.keys(sums).forEach(key => {
      averages[key as keyof PerformanceMetrics] = sums[key] / count as any;
    });

    return averages;
  }

  private calculateRankings(comparisons: Array<{ technician: any, metrics: PerformanceMetrics }>): Record<string, Array<{ technicianId: string, rank: number, value: number }>> {
    const rankings: Record<string, Array<{ technicianId: string, rank: number, value: number }>> = {};

    const metrics = ['avgEfficiency', 'avgQuality', 'avgCustomerSatisfaction', 'avgSlaCompliance'];

    metrics.forEach(metric => {
      const sorted = comparisons
        .map(c => ({
          technicianId: c.technician.id,
          value: c.metrics[metric as keyof PerformanceMetrics] as number
        }))
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({ ...item, rank: index + 1 }));

      rankings[metric] = sorted;
    });

    return rankings;
  }

  private generateComparisonInsights(comparisons: Array<{ technician: any, metrics: PerformanceMetrics }>): string[] {
    const insights: string[] = [];

    if (comparisons.length < 2) {
      return insights;
    }

    // Find best and worst performers
    const efficiencyScores = comparisons.map(c => c.metrics.avgEfficiency);
    const maxEfficiency = Math.max(...efficiencyScores);
    const minEfficiency = Math.min(...efficiencyScores);
    
    if (maxEfficiency - minEfficiency > 3) {
      insights.push('Significant efficiency gap exists between team members');
    }

    const satisfactionScores = comparisons.map(c => c.metrics.avgCustomerSatisfaction);
    const avgSatisfaction = satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length;
    
    if (avgSatisfaction > 4.0) {
      insights.push('Team maintains high customer satisfaction overall');
    } else if (avgSatisfaction < 3.5) {
      insights.push('Team customer satisfaction needs improvement');
    }

    return insights;
  }
}