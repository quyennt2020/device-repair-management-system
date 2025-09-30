import { Pool } from 'pg';
import { TechnicianWorkload, CreateWorkloadRequest, UpdateWorkloadRequest, WorkloadSummary } from '@shared/types/src/technician';

export class WorkloadRepository {
  constructor(private pool: Pool) {}

  async create(data: CreateWorkloadRequest): Promise<TechnicianWorkload> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO technician_workload (
          technician_id, date, active_cases, pending_cases, scheduled_cases,
          emergency_cases, total_estimated_hours, capacity_hours,
          utilization_rate, overload_threshold, is_overloaded, location, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const values = [
        data.technicianId, data.date, data.activeCases, data.pendingCases,
        data.scheduledCases, data.emergencyCases, data.totalEstimatedHours,
        data.capacityHours, data.utilizationRate, data.overloadThreshold,
        data.isOverloaded, data.location, data.notes
      ];
      
      const result = await client.query(query, values);
      return this.mapRowToWorkload(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<TechnicianWorkload | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT tw.*, t.first_name, t.last_name, t.employee_id
        FROM technician_workload tw
        JOIN technicians t ON tw.technician_id = t.id
        WHERE tw.id = $1
      `;
      const result = await client.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToWorkload(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findByTechnicianAndDate(technicianId: string, date: Date): Promise<TechnicianWorkload | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT tw.*, t.first_name, t.last_name, t.employee_id
        FROM technician_workload tw
        JOIN technicians t ON tw.technician_id = t.id
        WHERE tw.technician_id = $1 AND tw.date = $2
      `;
      const result = await client.query(query, [technicianId, date.toISOString().split('T')[0]]);
      return result.rows.length > 0 ? this.mapRowToWorkload(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findByDateRange(startDate: Date, endDate: Date, technicianId?: string): Promise<TechnicianWorkload[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT tw.*, t.first_name, t.last_name, t.employee_id
        FROM technician_workload tw
        JOIN technicians t ON tw.technician_id = t.id
        WHERE tw.date >= $1 AND tw.date <= $2
      `;
      
      const values: any[] = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
      
      if (technicianId) {
        query += ` AND tw.technician_id = $3`;
        values.push(technicianId);
      }
      
      query += ` ORDER BY tw.date DESC, t.last_name, t.first_name`;
      
      const result = await client.query(query, values);
      return result.rows.map(row => this.mapRowToWorkload(row));
    } finally {
      client.release();
    }
  }

  async findOverloadedTechnicians(date?: Date): Promise<TechnicianWorkload[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT tw.*, t.first_name, t.last_name, t.employee_id
        FROM technician_workload tw
        JOIN technicians t ON tw.technician_id = t.id
        WHERE tw.is_overloaded = true
      `;
      
      const values: any[] = [];
      
      if (date) {
        query += ` AND tw.date = $1`;
        values.push(date.toISOString().split('T')[0]);
      } else {
        query += ` AND tw.date >= CURRENT_DATE`;
      }
      
      query += ` ORDER BY tw.utilization_rate DESC`;
      
      const result = await client.query(query, values);
      return result.rows.map(row => this.mapRowToWorkload(row));
    } finally {
      client.release();
    }
  }

  async update(id: string, data: UpdateWorkloadRequest): Promise<TechnicianWorkload> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (data.activeCases !== undefined) {
        fields.push(`active_cases = $${paramCount++}`);
        values.push(data.activeCases);
      }
      if (data.pendingCases !== undefined) {
        fields.push(`pending_cases = $${paramCount++}`);
        values.push(data.pendingCases);
      }
      if (data.scheduledCases !== undefined) {
        fields.push(`scheduled_cases = $${paramCount++}`);
        values.push(data.scheduledCases);
      }
      if (data.emergencyCases !== undefined) {
        fields.push(`emergency_cases = $${paramCount++}`);
        values.push(data.emergencyCases);
      }
      if (data.totalEstimatedHours !== undefined) {
        fields.push(`total_estimated_hours = $${paramCount++}`);
        values.push(data.totalEstimatedHours);
      }
      if (data.capacityHours !== undefined) {
        fields.push(`capacity_hours = $${paramCount++}`);
        values.push(data.capacityHours);
      }
      if (data.utilizationRate !== undefined) {
        fields.push(`utilization_rate = $${paramCount++}`);
        values.push(data.utilizationRate);
      }
      if (data.overloadThreshold !== undefined) {
        fields.push(`overload_threshold = $${paramCount++}`);
        values.push(data.overloadThreshold);
      }
      if (data.isOverloaded !== undefined) {
        fields.push(`is_overloaded = $${paramCount++}`);
        values.push(data.isOverloaded);
      }
      if (data.location !== undefined) {
        fields.push(`location = $${paramCount++}`);
        values.push(data.location);
      }
      if (data.notes !== undefined) {
        fields.push(`notes = $${paramCount++}`);
        values.push(data.notes);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE technician_workload 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Workload record not found');
      }
      
      return this.mapRowToWorkload(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async upsert(data: CreateWorkloadRequest): Promise<TechnicianWorkload> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO technician_workload (
          technician_id, date, active_cases, pending_cases, scheduled_cases,
          emergency_cases, total_estimated_hours, capacity_hours,
          utilization_rate, overload_threshold, is_overloaded, location, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (technician_id, date)
        DO UPDATE SET
          active_cases = EXCLUDED.active_cases,
          pending_cases = EXCLUDED.pending_cases,
          scheduled_cases = EXCLUDED.scheduled_cases,
          emergency_cases = EXCLUDED.emergency_cases,
          total_estimated_hours = EXCLUDED.total_estimated_hours,
          capacity_hours = EXCLUDED.capacity_hours,
          utilization_rate = EXCLUDED.utilization_rate,
          overload_threshold = EXCLUDED.overload_threshold,
          is_overloaded = EXCLUDED.is_overloaded,
          location = EXCLUDED.location,
          notes = EXCLUDED.notes,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const values = [
        data.technicianId, data.date, data.activeCases, data.pendingCases,
        data.scheduledCases, data.emergencyCases, data.totalEstimatedHours,
        data.capacityHours, data.utilizationRate, data.overloadThreshold,
        data.isOverloaded, data.location, data.notes
      ];
      
      const result = await client.query(query, values);
      return this.mapRowToWorkload(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async getWorkloadSummary(technicianId: string, days: number = 7): Promise<WorkloadSummary> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT 
          AVG(utilization_rate) as avg_utilization,
          MAX(utilization_rate) as max_utilization,
          SUM(active_cases) as total_active_cases,
          SUM(pending_cases) as total_pending_cases,
          SUM(emergency_cases) as total_emergency_cases,
          AVG(total_estimated_hours) as avg_estimated_hours,
          COUNT(CASE WHEN is_overloaded THEN 1 END) as overloaded_days,
          COUNT(*) as total_days
        FROM technician_workload
        WHERE technician_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      `;
      
      const result = await client.query(query, [technicianId]);
      const row = result.rows[0];
      
      return {
        avgUtilization: parseFloat(row.avg_utilization) || 0,
        maxUtilization: parseFloat(row.max_utilization) || 0,
        totalActiveCases: parseInt(row.total_active_cases) || 0,
        totalPendingCases: parseInt(row.total_pending_cases) || 0,
        totalEmergencyCases: parseInt(row.total_emergency_cases) || 0,
        avgEstimatedHours: parseFloat(row.avg_estimated_hours) || 0,
        overloadedDays: parseInt(row.overloaded_days) || 0,
        totalDays: parseInt(row.total_days) || 0,
        overloadPercentage: parseInt(row.total_days) > 0 
          ? (parseInt(row.overloaded_days) / parseInt(row.total_days)) * 100 
          : 0
      };
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM technician_workload WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('Workload record not found');
      }
    } finally {
      client.release();
    }
  }

  private mapRowToWorkload(row: any): TechnicianWorkload {
    return {
      id: row.id,
      technicianId: row.technician_id,
      technicianName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : undefined,
      employeeId: row.employee_id,
      date: row.date,
      activeCases: row.active_cases,
      pendingCases: row.pending_cases,
      scheduledCases: row.scheduled_cases,
      emergencyCases: row.emergency_cases,
      totalEstimatedHours: parseFloat(row.total_estimated_hours),
      capacityHours: parseFloat(row.capacity_hours),
      utilizationRate: parseFloat(row.utilization_rate),
      overloadThreshold: parseFloat(row.overload_threshold),
      isOverloaded: row.is_overloaded,
      location: row.location,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}