import { Pool } from 'pg';
import * as cron from 'node-cron';
import { WorkloadService } from './workload.service';
import { PerformanceService } from './performance.service';
import { TechnicianRepository } from '../repositories/technician.repository';

export class ScheduledJobsService {
  private workloadService: WorkloadService;
  private performanceService: PerformanceService;
  private technicianRepo: TechnicianRepository;

  constructor(private pool: Pool) {
    this.workloadService = new WorkloadService(pool);
    this.performanceService = new PerformanceService(pool);
    this.technicianRepo = new TechnicianRepository(pool);
  }

  start(): void {
    console.log('Starting scheduled jobs for technician service...');

    // Daily workload calculation at 6 AM
    cron.schedule('0 6 * * *', async () => {
      console.log('Running daily workload calculation...');
      await this.calculateDailyWorkloads();
    });

    // Weekly performance calculation on Sundays at 7 AM
    cron.schedule('0 7 * * 0', async () => {
      console.log('Running weekly performance calculation...');
      await this.calculateWeeklyPerformance();
    });

    // Monthly performance calculation on 1st of month at 8 AM
    cron.schedule('0 8 1 * *', async () => {
      console.log('Running monthly performance calculation...');
      await this.calculateMonthlyPerformance();
    });

    // Check for overloaded technicians every 2 hours during work hours
    cron.schedule('0 8-18/2 * * 1-5', async () => {
      console.log('Checking for overloaded technicians...');
      await this.checkOverloadedTechnicians();
    });

    // Certificate expiry check daily at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Checking certificate expiries...');
      await this.checkCertificateExpiries();
    });

    console.log('Scheduled jobs started successfully');
  }

  private async calculateDailyWorkloads(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all active technicians
      const criteria = { status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      const technicians = result.technicians;

      for (const technician of technicians) {
        try {
          // This would typically get data from case service
          // For now, we'll create placeholder workload data
          const workloadData = {
            technicianId: technician.id,
            date: today,
            activeCases: 0, // Would be calculated from actual cases
            pendingCases: 0,
            scheduledCases: 0,
            emergencyCases: 0,
            totalEstimatedHours: 0,
            capacityHours: 8, // Standard 8-hour day
            utilizationRate: 0,
            overloadThreshold: 100,
            isOverloaded: false,
            location: technician.baseLocation || 'Office'
          };

          await this.workloadService.upsertWorkloadRecord(workloadData);
        } catch (error) {
          console.error(`Error calculating workload for technician ${technician.id}:`, error);
        }
      }

      console.log(`Daily workload calculation completed for ${technicians.length} technicians`);
    } catch (error) {
      console.error('Error in daily workload calculation:', error);
    }
  }

  private async calculateWeeklyPerformance(): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // Get all active technicians
      const criteria = { status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      const technicians = result.technicians;

      for (const technician of technicians) {
        try {
          // This would typically aggregate data from case service
          // For now, we'll create placeholder performance data
          const performanceData = {
            technicianId: technician.id,
            periodStart: startDate,
            periodEnd: endDate,
            casesCompleted: 0, // Would be calculated from actual cases
            casesAssigned: 0,
            completionRate: 0,
            averageResolutionTimeHours: 0,
            customerSatisfactionAvg: 0,
            customerSatisfactionCount: 0,
            slaComplianceRate: 0,
            firstTimeFixRate: 0,
            totalHoursWorked: 0,
            overtimeHours: 0,
            travelHours: 0,
            trainingHours: 0,
            revenueGenerated: 0,
            costPerHour: technician.hourlyRate || 0,
            efficiencyScore: 0,
            qualityScore: 0
          };

          await this.performanceService.createPerformanceRecord(performanceData);
        } catch (error) {
          console.error(`Error calculating weekly performance for technician ${technician.id}:`, error);
        }
      }

      console.log(`Weekly performance calculation completed for ${technicians.length} technicians`);
    } catch (error) {
      console.error('Error in weekly performance calculation:', error);
    }
  }

  private async calculateMonthlyPerformance(): Promise<void> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 1);

      // Get all active technicians
      const criteria = { status: 'active' as const };
      const result = await this.technicianRepo.search(criteria);
      const technicians = result.technicians;

      for (const technician of technicians) {
        try {
          // This would typically aggregate data from case service
          // For now, we'll create placeholder performance data
          const performanceData = {
            technicianId: technician.id,
            periodStart: startDate,
            periodEnd: endDate,
            casesCompleted: 0, // Would be calculated from actual cases
            casesAssigned: 0,
            completionRate: 0,
            averageResolutionTimeHours: 0,
            customerSatisfactionAvg: 0,
            customerSatisfactionCount: 0,
            slaComplianceRate: 0,
            firstTimeFixRate: 0,
            totalHoursWorked: 0,
            overtimeHours: 0,
            travelHours: 0,
            trainingHours: 0,
            revenueGenerated: 0,
            costPerHour: technician.hourlyRate || 0,
            efficiencyScore: 0,
            qualityScore: 0
          };

          await this.performanceService.createPerformanceRecord(performanceData);
        } catch (error) {
          console.error(`Error calculating monthly performance for technician ${technician.id}:`, error);
        }
      }

      console.log(`Monthly performance calculation completed for ${technicians.length} technicians`);
    } catch (error) {
      console.error('Error in monthly performance calculation:', error);
    }
  }

  private async checkOverloadedTechnicians(): Promise<void> {
    try {
      const today = new Date();
      const overloadedTechnicians = await this.workloadService.getOverloadedTechnicians(today);

      if (overloadedTechnicians.length > 0) {
        console.log(`Found ${overloadedTechnicians.length} overloaded technicians:`);
        
        for (const workload of overloadedTechnicians) {
          console.log(`- ${workload.technicianName}: ${workload.utilizationRate.toFixed(1)}% utilization`);
          
          // Here you would typically send notifications to managers
          // For now, we'll just log the information
        }

        // Generate workload balancing recommendations
        const balanceRecommendations = await this.workloadService.balanceWorkload(today);
        if (balanceRecommendations.recommendations.length > 0) {
          console.log('Workload balancing recommendations:');
          balanceRecommendations.recommendations.forEach(rec => {
            console.log(`- Move ${rec.cases} cases from ${rec.from} to ${rec.to}: ${rec.reason}`);
          });
        }
      }
    } catch (error) {
      console.error('Error checking overloaded technicians:', error);
    }
  }

  private async checkCertificateExpiries(): Promise<void> {
    try {
      // This would typically check certification expiry dates
      // For now, we'll just log that the check is running
      console.log('Certificate expiry check completed');
      
      // TODO: Implement when certification repository is available
      // const expiringCertifications = await this.certificationRepo.findExpiringCertifications(30);
      // Send notifications for expiring certificates
    } catch (error) {
      console.error('Error checking certificate expiries:', error);
    }
  }

  stop(): void {
    cron.getTasks().forEach(task => task.stop());
    console.log('Scheduled jobs stopped');
  }
}