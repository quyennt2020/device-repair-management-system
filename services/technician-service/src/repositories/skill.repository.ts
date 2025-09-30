import { Pool } from 'pg';
import { TechnicianSkill, CreateSkillRequest, UpdateSkillRequest } from '@shared/types/src/technician';

export class SkillRepository {
  constructor(private pool: Pool) {}

  async create(data: CreateSkillRequest): Promise<TechnicianSkill> {
    const client = await this.pool.connect();
    try {
      const query = `
        INSERT INTO technician_skills (
          technician_id, skill_name, skill_category, proficiency_level,
          years_experience, certified, certification_date, certification_expiry,
          certification_body, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        data.technicianId, data.skillName, data.skillCategory,
        data.proficiencyLevel, data.yearsExperience, data.certified,
        data.certificationDate, data.certificationExpiry,
        data.certificationBody, data.notes
      ];
      
      const result = await client.query(query, values);
      return this.mapRowToSkill(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<TechnicianSkill | null> {
    const client = await this.pool.connect();
    try {
      const query = 'SELECT * FROM technician_skills WHERE id = $1';
      const result = await client.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToSkill(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async findByTechnicianId(technicianId: string): Promise<TechnicianSkill[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT * FROM technician_skills 
        WHERE technician_id = $1 
        ORDER BY skill_category, skill_name
      `;
      const result = await client.query(query, [technicianId]);
      return result.rows.map(row => this.mapRowToSkill(row));
    } finally {
      client.release();
    }
  }

  async findBySkillName(skillName: string): Promise<TechnicianSkill[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT ts.*, t.first_name, t.last_name, t.employee_id
        FROM technician_skills ts
        JOIN technicians t ON ts.technician_id = t.id
        WHERE ts.skill_name = $1 
        ORDER BY ts.proficiency_level DESC, t.last_name, t.first_name
      `;
      const result = await client.query(query, [skillName]);
      return result.rows.map(row => ({
        ...this.mapRowToSkill(row),
        technicianName: `${row.first_name} ${row.last_name}`,
        employeeId: row.employee_id
      }));
    } finally {
      client.release();
    }
  }

  async update(id: string, data: UpdateSkillRequest): Promise<TechnicianSkill> {
    const client = await this.pool.connect();
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (data.skillCategory !== undefined) {
        fields.push(`skill_category = $${paramCount++}`);
        values.push(data.skillCategory);
      }
      if (data.proficiencyLevel !== undefined) {
        fields.push(`proficiency_level = $${paramCount++}`);
        values.push(data.proficiencyLevel);
      }
      if (data.yearsExperience !== undefined) {
        fields.push(`years_experience = $${paramCount++}`);
        values.push(data.yearsExperience);
      }
      if (data.certified !== undefined) {
        fields.push(`certified = $${paramCount++}`);
        values.push(data.certified);
      }
      if (data.certificationDate !== undefined) {
        fields.push(`certification_date = $${paramCount++}`);
        values.push(data.certificationDate);
      }
      if (data.certificationExpiry !== undefined) {
        fields.push(`certification_expiry = $${paramCount++}`);
        values.push(data.certificationExpiry);
      }
      if (data.certificationBody !== undefined) {
        fields.push(`certification_body = $${paramCount++}`);
        values.push(data.certificationBody);
      }
      if (data.notes !== undefined) {
        fields.push(`notes = $${paramCount++}`);
        values.push(data.notes);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE technician_skills 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Skill not found');
      }
      
      return this.mapRowToSkill(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      const query = 'DELETE FROM technician_skills WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('Skill not found');
      }
    } finally {
      client.release();
    }
  }

  async getSkillCategories(): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      const query = `
        SELECT DISTINCT skill_category 
        FROM technician_skills 
        ORDER BY skill_category
      `;
      const result = await client.query(query);
      return result.rows.map(row => row.skill_category);
    } finally {
      client.release();
    }
  }

  async getSkillNames(category?: string): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      let query = `
        SELECT DISTINCT skill_name 
        FROM technician_skills
      `;
      const values: any[] = [];
      
      if (category) {
        query += ` WHERE skill_category = $1`;
        values.push(category);
      }
      
      query += ` ORDER BY skill_name`;
      
      const result = await client.query(query, values);
      return result.rows.map(row => row.skill_name);
    } finally {
      client.release();
    }
  }

  private mapRowToSkill(row: any): TechnicianSkill {
    return {
      id: row.id,
      technicianId: row.technician_id,
      skillName: row.skill_name,
      skillCategory: row.skill_category,
      proficiencyLevel: row.proficiency_level,
      yearsExperience: row.years_experience,
      certified: row.certified,
      certificationDate: row.certification_date,
      certificationExpiry: row.certification_expiry,
      certificationBody: row.certification_body,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}