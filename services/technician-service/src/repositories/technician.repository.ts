import { Pool } from 'pg';
import { Technician, CreateTechnicianRequest, UpdateTechnicianRequest, TechnicianSearchCriteria } from '@shared/types/src/technician';

export class TechnicianRepository {
  constructor(private pool: Pool) {}

  async create(data: CreateTechnicianRequest): Promise<Technician> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO technicians (
          user_id, employee_id, first_name, last_name, email, phone,
          hire_date, status, department, position, supervisor_id,
          base_location, hourly_rate, overtime_rate, travel_allowance,
          emergency_contact_name, emergency_contact_phone, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;
      
      const values = [
        data.userId, data.employeeId, data.firstName, data.lastName,
        data.email, data.phone, data.hireDate, data.status || 'active',
        data.department, data.position, data.supervisorId, data.baseLocation,
        data.hourlyRate, data.overtimeRate, data.travelAllowance,
        data.emergencyContactName, data.emergencyContactPhone, data.notes
      ];
      
      const result = await client.query(query, values);
      return this.mapRowToTechnician(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Technician | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT t.*, 
               s.first_name as supervisor_first_name,
               s.last_name as supervisor_last_name
        FROM technicians t
        LEFT JOIN technicians s ON t.supervisor_id = s.id
        WHERE t.id = $1
      `;
      
      const result = await client.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToTechnician(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findByEmployeeId(employeeId: string): Promise<Technician | null> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT t.*, 
               s.first_name as supervisor_first_name,
               s.last_name as supervisor_last_name
        FROM technicians t
        LEFT JOIN technicians s ON t.supervisor_id = s.id
        WHERE t.employee_id = $1
      `;
      
      const result = await client.query(query, [employeeId]);
      return result.rows.length > 0 ? this.mapRowToTechnician(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async update(id: string, data: UpdateTechnicianRequest): Promise<Technician> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (data.firstName !== undefined) {
        fields.push(`first_name = $${paramCount++}`);
        values.push(data.firstName);
      }
      if (data.lastName !== undefined) {
        fields.push(`last_name = $${paramCount++}`);
        values.push(data.lastName);
      }
      if (data.email !== undefined) {
        fields.push(`email = $${paramCount++}`);
        values.push(data.email);
      }
      if (data.phone !== undefined) {
        fields.push(`phone = $${paramCount++}`);
        values.push(data.phone);
      }
      if (data.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.department !== undefined) {
        fields.push(`department = $${paramCount++}`);
        values.push(data.department);
      }
      if (data.position !== undefined) {
        fields.push(`position = $${paramCount++}`);
        values.push(data.position);
      }
      if (data.supervisorId !== undefined) {
        fields.push(`supervisor_id = $${paramCount++}`);
        values.push(data.supervisorId);
      }
      if (data.baseLocation !== undefined) {
        fields.push(`base_location = $${paramCount++}`);
        values.push(data.baseLocation);
      }
      if (data.hourlyRate !== undefined) {
        fields.push(`hourly_rate = $${paramCount++}`);
        values.push(data.hourlyRate);
      }
      if (data.overtimeRate !== undefined) {
        fields.push(`overtime_rate = $${paramCount++}`);
        values.push(data.overtimeRate);
      }
      if (data.travelAllowance !== undefined) {
        fields.push(`travel_allowance = $${paramCount++}`);
        values.push(data.travelAllowance);
      }
      if (data.emergencyContactName !== undefined) {
        fields.push(`emergency_contact_name = $${paramCount++}`);
        values.push(data.emergencyContactName);
      }
      if (data.emergencyContactPhone !== undefined) {
        fields.push(`emergency_contact_phone = $${paramCount++}`);
        values.push(data.emergencyContactPhone);
      }
      if (data.notes !== undefined) {
        fields.push(`notes = $${paramCount++}`);
        values.push(data.notes);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE technicians 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Technician not found');
      }
      
      return this.mapRowToTechnician(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async search(criteria: TechnicianSearchCriteria): Promise<{ technicians: Technician[], total: number }> {
    const client = await this.pool.connect();
    try {
      let whereClause = 'WHERE 1=1';
      const values: any[] = [];
      let paramCount = 1;

      if (criteria.status) {
        whereClause += ` AND t.status = $${paramCount++}`;
        values.push(criteria.status);
      }

      if (criteria.department) {
        whereClause += ` AND t.department = $${paramCount++}`;
        values.push(criteria.department);
      }

      if (criteria.baseLocation) {
        whereClause += ` AND t.base_location ILIKE $${paramCount++}`;
        values.push(`%${criteria.baseLocation}%`);
      }

      if (criteria.supervisorId) {
        whereClause += ` AND t.supervisor_id = $${paramCount++}`;
        values.push(criteria.supervisorId);
      }

      if (criteria.searchTerm) {
        whereClause += ` AND (
          t.first_name ILIKE $${paramCount} OR 
          t.last_name ILIKE $${paramCount} OR 
          t.employee_id ILIKE $${paramCount} OR 
          t.email ILIKE $${paramCount}
        )`;
        values.push(`%${criteria.searchTerm}%`);
        paramCount++;
      }

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM technicians t
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].total);

      // Main query with pagination
      const limit = criteria.limit || 50;
      const offset = criteria.offset || 0;

      const query = `
        SELECT t.*, 
               s.first_name as supervisor_first_name,
               s.last_name as supervisor_last_name
        FROM technicians t
        LEFT JOIN technicians s ON t.supervisor_id = s.id
        ${whereClause}
        ORDER BY t.last_name, t.first_name
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;

      values.push(limit, offset);
      const result = await client.query(query, values);
      
      const technicians = result.rows.map(row => this.mapRowToTechnician(row));
      
      return { technicians, total };
    } finally {
      client.release();
    }
  }

  async findAvailableTechnicians(date: Date, requiredSkills?: string[]): Promise<Technician[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT DISTINCT t.*, 
               s.first_name as supervisor_first_name,
               s.last_name as supervisor_last_name
        FROM technicians t
        LEFT JOIN technicians s ON t.supervisor_id = s.id
        LEFT JOIN technician_availability ta ON t.id = ta.technician_id AND ta.date = $1
        WHERE t.status = 'active'
        AND (ta.status IS NULL OR ta.status = 'available')
      `;
      
      const values: any[] = [date.toISOString().split('T')[0]];
      let paramCount = 2;

      if (requiredSkills && requiredSkills.length > 0) {
        query += `
          AND t.id IN (
            SELECT ts.technician_id 
            FROM technician_skills ts 
            WHERE ts.skill_name = ANY($${paramCount++})
            AND ts.proficiency_level >= 3
            GROUP BY ts.technician_id
            HAVING COUNT(DISTINCT ts.skill_name) = $${paramCount++}
          )
        `;
        values.push(requiredSkills, requiredSkills.length);
      }

      query += ` ORDER BY t.last_name, t.first_name`;

      const result = await client.query(query, values);
      return result.rows.map(row => this.mapRowToTechnician(row));
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM technicians WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('Technician not found');
      }
    } finally {
      client.release();
    }
  }

  private mapRowToTechnician(row: any): Technician {
    return {
      id: row.id,
      userId: row.user_id,
      employeeId: row.employee_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      hireDate: row.hire_date,
      status: row.status,
      department: row.department,
      position: row.position,
      supervisorId: row.supervisor_id,
      supervisorName: row.supervisor_first_name && row.supervisor_last_name 
        ? `${row.supervisor_first_name} ${row.supervisor_last_name}` 
        : undefined,
      baseLocation: row.base_location,
      hourlyRate: row.hourly_rate ? parseFloat(row.hourly_rate) : undefined,
      overtimeRate: row.overtime_rate ? parseFloat(row.overtime_rate) : undefined,
      travelAllowance: row.travel_allowance ? parseFloat(row.travel_allowance) : undefined,
      emergencyContactName: row.emergency_contact_name,
      emergencyContactPhone: row.emergency_contact_phone,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}