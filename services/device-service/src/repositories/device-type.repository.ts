import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DeviceType } from '@shared/types/src/device';
import { UUID } from '@shared/types/src/common';

export interface CreateDeviceTypeRequest {
  name: string;
  category: string;
  manufacturer: string;
  modelSeries: string;
  specifications: Record<string, any>;
  standardServiceHours: number;
  requiredCertifications: string[];
  maintenanceChecklist: any[];
}

export interface UpdateDeviceTypeRequest {
  name?: string;
  category?: string;
  manufacturer?: string;
  modelSeries?: string;
  specifications?: Record<string, any>;
  standardServiceHours?: number;
  requiredCertifications?: string[];
  maintenanceChecklist?: any[];
}

export class DeviceTypeRepository {
  constructor(private db: Pool) {}

  async create(request: CreateDeviceTypeRequest): Promise<DeviceType> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO device_types (
        id, name, category, manufacturer, model_series, 
        specifications, standard_service_hours, required_certifications, 
        maintenance_checklist, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      id,
      request.name,
      request.category,
      request.manufacturer,
      request.modelSeries,
      JSON.stringify(request.specifications),
      request.standardServiceHours,
      JSON.stringify(request.requiredCertifications),
      JSON.stringify(request.maintenanceChecklist),
      now,
      now
    ];
    
    const result = await this.db.query(query, values);
    return this.mapRowToDeviceType(result.rows[0]);
  }

  async findById(id: UUID): Promise<DeviceType | null> {
    const query = 'SELECT * FROM device_types WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDeviceType(result.rows[0]);
  }

  async findAll(): Promise<DeviceType[]> {
    const query = 'SELECT * FROM device_types ORDER BY name';
    const result = await this.db.query(query);
    
    return result.rows.map(row => this.mapRowToDeviceType(row));
  }

  async findByCategory(category: string): Promise<DeviceType[]> {
    const query = 'SELECT * FROM device_types WHERE category = $1 ORDER BY name';
    const result = await this.db.query(query, [category]);
    
    return result.rows.map(row => this.mapRowToDeviceType(row));
  }

  async findByManufacturer(manufacturer: string): Promise<DeviceType[]> {
    const query = 'SELECT * FROM device_types WHERE manufacturer ILIKE $1 ORDER BY name';
    const result = await this.db.query(query, [`%${manufacturer}%`]);
    
    return result.rows.map(row => this.mapRowToDeviceType(row));
  }

  async search(query: string): Promise<DeviceType[]> {
    const searchQuery = `
      SELECT * FROM device_types 
      WHERE name ILIKE $1 OR category ILIKE $1 OR manufacturer ILIKE $1 OR model_series ILIKE $1
      ORDER BY name
    `;
    const result = await this.db.query(searchQuery, [`%${query}%`]);
    
    return result.rows.map(row => this.mapRowToDeviceType(row));
  }

  async update(id: UUID, request: UpdateDeviceTypeRequest): Promise<DeviceType | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }
    
    if (request.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(request.category);
    }
    
    if (request.manufacturer !== undefined) {
      updates.push(`manufacturer = $${paramIndex++}`);
      values.push(request.manufacturer);
    }
    
    if (request.modelSeries !== undefined) {
      updates.push(`model_series = $${paramIndex++}`);
      values.push(request.modelSeries);
    }
    
    if (request.specifications !== undefined) {
      updates.push(`specifications = $${paramIndex++}`);
      values.push(JSON.stringify(request.specifications));
    }
    
    if (request.standardServiceHours !== undefined) {
      updates.push(`standard_service_hours = $${paramIndex++}`);
      values.push(request.standardServiceHours);
    }
    
    if (request.requiredCertifications !== undefined) {
      updates.push(`required_certifications = $${paramIndex++}`);
      values.push(JSON.stringify(request.requiredCertifications));
    }
    
    if (request.maintenanceChecklist !== undefined) {
      updates.push(`maintenance_checklist = $${paramIndex++}`);
      values.push(JSON.stringify(request.maintenanceChecklist));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE device_types 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDeviceType(result.rows[0]);
  }

  async delete(id: UUID): Promise<boolean> {
    const query = 'DELETE FROM device_types WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rowCount > 0;
  }

  private mapRowToDeviceType(row: any): DeviceType {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      manufacturer: row.manufacturer,
      modelSeries: row.model_series,
      specifications: row.specifications || {},
      standardServiceHours: parseFloat(row.standard_service_hours),
      requiredCertifications: row.required_certifications || [],
      maintenanceChecklist: row.maintenance_checklist || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}