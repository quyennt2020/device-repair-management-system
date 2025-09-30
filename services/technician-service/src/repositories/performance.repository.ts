import { Pool } from 'pg';
import { TechnicianPerformance, CreatePerformanceRequest, UpdatePerformanceRequest, PerformanceMetrics } from '@shared/types/src/technician';

export class PerformanceRepository {
  constructor(private pool: Pool) {}

  async create(data: CreatePerformanceRequest): Promise<TechnicianPerformance> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO technician_performance (
          technician_id, period_start, period_end, cases_completed, cases_assigned,
          completion_rate, average_resolution_time_hours, customer_satisfaction_avg,
          customer_satisfaction_count, sla_compliance_rate, first_time_fix_rate,
          total_hours_worked, overtime_hours, travel_hours, training_hours,
          revenue_generated, cost_per_hour, efficiency_score, quality_score, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `;
      
      const values = [
        data.technicianId, data.periodStart, data.periodEnd, data.casesCompleted,
        data.casesAssigned, data.completionRate, data.averageResolutionTimeHours,
        data.customerSatisfactionAvg, data.customerSatisfactionCount,
        data.slaComplianceRate, data.firstTimeFixRate, data.totalHoursWorked,
        data.overtimeHours, data.travelHours, data.trainingHours,
        data.revenueGenerated, data.costPerHour, data.efficiencyScore,
        data.qualityScore, data.notes
      ];
      
      const result = await client.query(query, values);
      return this.mapRowToPerformance(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<TechnicianPerformance | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT tp.*, t.first_name, t.last_name, t.employee_id
        FROM technician_performance tp
        JOIN technicians t ON tp.technician_id = t.id
        WHERE tp.id = $1
      `;
      const result = await client.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToPerformance(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findByTechnicianId(technicianId: string, limit?: number): Promise<TechnicianPerformance[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT tp.*, t.first_name, t.last_name, t.employee_id
        FROM technician_performance tp
        JOIN technicians t ON tp.technician_id = t.id
        WHERE tp.technician_id = $1 
        ORDER BY tp.period_start DESC
      `;
      
      const values: any[] = [technicianId];
      
      if (limit) {
        query += ` LIMIT $2`;
        values.push(limit);
      }
      
      const result = await client.query(query, values);
      return result.rows.map(row => this.mapRowToPerformance(row));
    } finally {
      client.release();
    }
  }

  async findByPeriod(periodStart: Date, periodEnd: Date): Promise<TechnicianPerformance[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT tp.*, t.first_name, t.last_name, t.employee_id
        FROM technician_performance tp
        JOIN technicians t ON tp.technician_id = t.id
        WHERE tp.period_start >= $1 AND tp.period_end <= $2
        ORDER BY tp.efficiency_score DESC, tp.quality_score DESC
      `;
      const result = await client.query(query, [periodStart, periodEnd]);
      return result.rows.map(row => this.mapRowToPerformance(row));
    } finally {
      client.release();
    }
  }

  async update(id: string, data: UpdatePerformanceRequest): Promise<TechnicianPerformance> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (data.casesCompleted !== undefined) {
        fields.push(`cases_completed = $${paramCount++}`);
        values.push(data.casesCompleted);
      }
      if (data.casesAssigned !== undefined) {
        fields.push(`cases_assigned = $${paramCount++}`);
        values.push(data.casesAssigned);
      }
      if (data.completionRate !== undefined) {
        fields.push(`completion_rate = $${paramCount++}`);
        values.push(data.completionRate);
      }
      if (data.averageResolutionTimeHours !== undefined) {
        fields.push(`average_resolution_time_hours = $${paramCount++}`);
        values.push(data.averageResolutionTimeHours);
      }
      if (data.customerSatisfactionAvg !== undefined) {
        fields.push(`customer_satisfaction_avg = $${paramCount++}`);
        values.push(data.customerSatisfactionAvg);
      }
      if (data.customerSatisfactionCount !== undefined) {
        fields.push(`customer_satisfaction_count = $${paramCount++}`);
        values.push(data.customerSatisfactionCount);
      }
      if (data.slaComplianceRate !== undefined) {
        fields.push(`sla_compliance_rate = $${paramCount++}`);
        values.push(data.slaComplianceRate);
      }
      if (data.firstTimeFixRate !== undefined) {
        fields.push(`first_time_fix_rate = $${paramCount++}`);
        values.push(data.firstTimeFixRate);
      }
      if (data.totalHoursWorked !== undefined) {
        fields.push(`total_hours_worked = $${paramCount++}`);
        values.push(data.totalHoursWorked);
      }
      if (data.overtimeHours !== undefined) {
        fields.push(`overtime_hours = $${paramCount++}`);
        values.push(data.overtimeHours);
      }
      if (data.travelHours !== undefined) {
        fields.push(`travel_hours = $${paramCount++}`);
        values.push(data.travelHours);
      }
      if (data.trainingHours !== undefined) {
        fields.push(`training_hours = $${paramCount++}`);
        values.push(data.trainingHours);
      }
      if (data.revenueGenerated !== undefined) {
        fields.push(`revenue_generated = $${paramCount++}`);
        values.push(data.revenueGenerated);
      }
      if (data.costPerHour !== undefined) {
        fields.push(`cost_per_hour = $${paramCount++}`);
        values.push(data.costPerHour);
      }
      if (data.efficiencyScore !== undefined) {
        fields.push(`efficiency_score = $${paramCount++}`);
        values.push(data.efficiencyScore);
      }
      if (data.qualityScore !== undefined) {
        fields.push(`quality_score = $${paramCount++}`);
        values.push(data.qualityScore);
      }
      if (data.notes !== undefined) {
        fields.push(`notes = $${paramCount++}`);
        values.push(data.notes);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE technician_performance 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Performance record not found');
      }
      
      return this.mapRowToPerformance(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getPerformanceMetrics(technicianId: string, periodStart: Date, periodEnd: Date): Promise<PerformanceMetrics> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          AVG(completion_rate) as avg_completion_rate,
          AVG(average_resolution_time_hours) as avg_resolution_time,
          AVG(customer_satisfaction_avg) as avg_customer_satisfaction,
          AVG(sla_compliance_rate) as avg_sla_compliance,
          AVG(first_time_fix_rate) as avg_first_time_fix,
          SUM(total_hours_worked) as total_hours,
          SUM(overtime_hours) as total_overtime,
          SUM(cases_completed) as total_cases,
          AVG(efficiency_score) as avg_efficiency,
          AVG(quality_score) as avg_quality,
          SUM(revenue_generated) as total_revenue
        FROM technician_performance
        WHERE technician_id = $1 
        AND period_start >= $2 
        AND period_end <= $3
      `;
      
      const result = await client.query(query, [technicianId, periodStart, periodEnd]);
      const row = result.rows[0];
      
      return {
        avgCompletionRate: parseFloat(row.avg_completion_rate) || 0,
        avgResolutionTime: parseFloat(row.avg_resolution_time) || 0,
        avgCustomerSatisfaction: parseFloat(row.avg_customer_satisfaction) || 0,
        avgSlaCompliance: parseFloat(row.avg_sla_compliance) || 0,
        avgFirstTimeFix: parseFloat(row.avg_first_time_fix) || 0,
        totalHours: parseFloat(row.total_hours) || 0,
        totalOvertime: parseFloat(row.total_overtime) || 0,
        totalCases: parseInt(row.total_cases) || 0,
        avgEfficiency: parseFloat(row.avg_efficiency) || 0,
        avgQuality: parseFloat(row.avg_quality) || 0,
        totalRevenue: parseFloat(row.total_revenue) || 0
      };
    } finally {
      client.release();
    }
  }

  async getTopPerformers(limit: number = 10, metric: string = 'efficiency_score'): Promise<TechnicianPerformance[]> {
    const client = await this.pool.connect();
    try {
      const validMetrics = [
        'efficiency_score', 'quality_score', 'completion_rate', 
        'customer_satisfaction_avg', 'sla_compliance_rate', 'first_time_fix_rate'
      ];
      
      if (!validMetrics.includes(metric)) {
        throw new Error('Invalid metric');
      }
      
      const query = `
        SELECT tp.*, t.first_name, t.last_name, t.employee_id
        FROM technician_performance tp
        JOIN technicians t ON tp.technician_id = t.id
        WHERE tp.period_start >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY tp.${metric} DESC
        LIMIT $1
      `;
      
      const result = await client.query(query, [limit]);
      return result.rows.map(row => this.mapRowToPerformance(row));
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM technician_performance WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('Performance record not found');
      }
    } finally {
      client.release();
    }
  }

  private mapRowToPerformance(row: any): TechnicianPerformance {
    return {
      id: row.id,
      technicianId: row.technician_id,
      technicianName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : undefined,
      employeeId: row.employee_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      casesCompleted: row.cases_completed,
      casesAssigned: row.cases_assigned,
      completionRate: parseFloat(row.completion_rate),
      averageResolutionTimeHours: parseFloat(row.average_resolution_time_hours),
      customerSatisfactionAvg: parseFloat(row.customer_satisfaction_avg),
      customerSatisfactionCount: row.customer_satisfaction_count,
      slaComplianceRate: parseFloat(row.sla_compliance_rate),
      firstTimeFixRate: parseFloat(row.first_time_fix_rate),
      totalHoursWorked: parseFloat(row.total_hours_worked),
      overtimeHours: parseFloat(row.overtime_hours),
      travelHours: parseFloat(row.travel_hours),
      trainingHours: parseFloat(row.training_hours),
      revenueGenerated: parseFloat(row.revenue_generated),
      costPerHour: parseFloat(row.cost_per_hour),
      efficiencyScore: parseFloat(row.efficiency_score),
      qualityScore: parseFloat(row.quality_score),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}