import { SLAMonitoringService } from './sla-monitoring.service';
import { config } from '../config';

export class ScheduledJobsService {
  private slaMonitoring: SLAMonitoringService;
  private slaMonitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.slaMonitoring = new SLAMonitoringService();
  }

  /**
   * Start all scheduled jobs
   */
  startScheduledJobs(): void {
    console.log('Starting scheduled jobs...');

    // Start SLA monitoring if enabled
    if (config.sla.enableSLAMonitoring) {
      this.startSLAMonitoring();
    }

    console.log('Scheduled jobs started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stopScheduledJobs(): void {
    console.log('Stopping scheduled jobs...');

    if (this.slaMonitoringInterval) {
      clearInterval(this.slaMonitoringInterval);
      this.slaMonitoringInterval = null;
    }

    console.log('Scheduled jobs stopped');
  }

  /**
   * Start SLA monitoring job
   */
  private startSLAMonitoring(): void {
    const intervalMs = config.sla.checkIntervalMinutes * 60 * 1000;
    
    console.log(`Starting SLA monitoring job (interval: ${config.sla.checkIntervalMinutes} minutes)`);

    // Run immediately on startup
    this.runSLAMonitoring();

    // Schedule recurring runs
    this.slaMonitoringInterval = setInterval(() => {
      this.runSLAMonitoring();
    }, intervalMs);
  }

  /**
   * Run SLA monitoring check
   */
  private async runSLAMonitoring(): Promise<void> {
    try {
      console.log('Running SLA monitoring check...');
      
      const startTime = Date.now();
      const results = await this.slaMonitoring.monitorSLACompliance();
      const duration = Date.now() - startTime;

      const escalationsTriggered = results.filter(r => r.escalationTriggered).length;
      const breachedCases = results.filter(r => r.slaStatus.status === 'breached').length;
      const atRiskCases = results.filter(r => r.slaStatus.status === 'at_risk').length;

      console.log(`SLA monitoring completed in ${duration}ms:`, {
        totalCasesChecked: results.length,
        escalationsTriggered,
        breachedCases,
        atRiskCases
      });

      // Log summary if there are issues
      if (escalationsTriggered > 0 || breachedCases > 0) {
        console.warn(`SLA issues detected: ${breachedCases} breached, ${atRiskCases} at risk, ${escalationsTriggered} escalations triggered`);
      }

    } catch (error) {
      console.error('SLA monitoring job error:', error);
    }
  }

  /**
   * Run SLA monitoring manually (for testing or admin triggers)
   */
  async runSLAMonitoringManually(): Promise<any> {
    try {
      console.log('Running manual SLA monitoring check...');
      
      const startTime = Date.now();
      const results = await this.slaMonitoring.monitorSLACompliance();
      const duration = Date.now() - startTime;

      const summary = {
        totalCasesChecked: results.length,
        escalationsTriggered: results.filter(r => r.escalationTriggered).length,
        breachedCases: results.filter(r => r.slaStatus.status === 'breached').length,
        atRiskCases: results.filter(r => r.slaStatus.status === 'at_risk').length,
        duration,
        timestamp: new Date().toISOString()
      };

      console.log('Manual SLA monitoring completed:', summary);
      return { summary, results };

    } catch (error) {
      console.error('Manual SLA monitoring error:', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  getJobStatus(): any {
    return {
      slaMonitoring: {
        enabled: config.sla.enableSLAMonitoring,
        running: this.slaMonitoringInterval !== null,
        intervalMinutes: config.sla.checkIntervalMinutes
      }
    };
  }
}