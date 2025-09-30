import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { 
  Device, 
  CreateDeviceRequest, 
  UpdateDeviceRequest, 
  DeviceSearchCriteria, 
  DeviceSearchResult,
  DeviceHistory,
  DeviceEventType,
  DevicePartUsage
} from '@shared/types/src/device';
import { UUID } from '@shared/types/src/common';

export class DeviceRepository {
  constructor(private db: Pool) {}

  async create(request: CreateDeviceRequest): Promise<Device> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO devices (
        id, device_code, customer_id, device_type_id, manufacturer, 
        model, serial_number, specifications, location_info, 
        warranty_info, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      id,
      request.deviceCode,
      request.customerId,
      request.deviceTypeId,
      request.manufacturer,
      request.model,
      request.serialNumber,
      JSON.stringify(request.specifications),
      JSON.stringify(request.locationInfo),
      JSON.stringify(request.warrantyInfo || {}),
      'active',
      now,
      now
    ];
    
    const result = await this.db.query(query, values);
    return this.mapRowToDevice(result.rows[0]);
  }

  async findById(id: UUID): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDevice(result.rows[0]);
  }

  async findByDeviceCode(deviceCode: string): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE device_code = $1';
    const result = await this.db.query(query, [deviceCode]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDevice(result.rows[0]);
  }

  async findBySerialNumber(serialNumber: string): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE serial_number = $1';
    const result = await this.db.query(query, [serialNumber]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDevice(result.rows[0]);
  }

  async findByQRCode(qrCode: string): Promise<Device | null> {
    const query = 'SELECT * FROM devices WHERE qr_code = $1';
    const result = await this.db.query(query, [qrCode]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDevice(result.rows[0]);
  }

  async update(id: UUID, request: UpdateDeviceRequest): Promise<Device | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.manufacturer !== undefined) {
      updates.push(`manufacturer = $${paramIndex++}`);
      values.push(request.manufacturer);
    }
    
    if (request.model !== undefined) {
      updates.push(`model = $${paramIndex++}`);
      values.push(request.model);
    }
    
    if (request.specifications !== undefined) {
      updates.push(`specifications = $${paramIndex++}`);
      values.push(JSON.stringify(request.specifications));
    }
    
    if (request.locationInfo !== undefined) {
      updates.push(`location_info = $${paramIndex++}`);
      values.push(JSON.stringify(request.locationInfo));
    }
    
    if (request.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(request.status);
    }
    
    if (request.warrantyInfo !== undefined) {
      updates.push(`warranty_info = $${paramIndex++}`);
      values.push(JSON.stringify(request.warrantyInfo));
    }
    
    if (request.nextServiceDate !== undefined) {
      updates.push(`next_service_date = $${paramIndex++}`);
      values.push(request.nextServiceDate);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE devices 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDevice(result.rows[0]);
  }

  async updateQRCode(id: UUID, qrCode: string): Promise<void> {
    const query = 'UPDATE devices SET qr_code = $1, updated_at = $2 WHERE id = $3';
    await this.db.query(query, [qrCode, new Date(), id]);
  }

  async updateLastServiceDate(id: UUID, serviceDate: Date): Promise<void> {
    const query = 'UPDATE devices SET last_service_date = $1, updated_at = $2 WHERE id = $3';
    await this.db.query(query, [serviceDate, new Date(), id]);
  }

  async search(criteria: DeviceSearchCriteria, page: number = 1, limit: number = 20): Promise<DeviceSearchResult> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (criteria.query) {
      conditions.push(`(
        device_code ILIKE $${paramIndex} OR 
        manufacturer ILIKE $${paramIndex} OR 
        model ILIKE $${paramIndex} OR 
        serial_number ILIKE $${paramIndex}
      )`);
      values.push(`%${criteria.query}%`);
      paramIndex++;
    }

    if (criteria.customerId) {
      conditions.push(`customer_id = $${paramIndex++}`);
      values.push(criteria.customerId);
    }

    if (criteria.deviceTypeId) {
      conditions.push(`device_type_id = $${paramIndex++}`);
      values.push(criteria.deviceTypeId);
    }

    if (criteria.manufacturer) {
      conditions.push(`manufacturer ILIKE $${paramIndex++}`);
      values.push(`%${criteria.manufacturer}%`);
    }

    if (criteria.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(criteria.status);
    }

    if (criteria.lastServiceDateFrom) {
      conditions.push(`last_service_date >= $${paramIndex++}`);
      values.push(criteria.lastServiceDateFrom);
    }

    if (criteria.lastServiceDateTo) {
      conditions.push(`last_service_date <= $${paramIndex++}`);
      values.push(criteria.lastServiceDateTo);
    }

    if (criteria.nextServiceDateFrom) {
      conditions.push(`next_service_date >= $${paramIndex++}`);
      values.push(criteria.nextServiceDateFrom);
    }

    if (criteria.nextServiceDateTo) {
      conditions.push(`next_service_date <= $${paramIndex++}`);
      values.push(criteria.nextServiceDateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) FROM devices ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Data query
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT * FROM devices 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    values.push(limit, offset);
    const dataResult = await this.db.query(dataQuery, values);

    const devices = dataResult.rows.map(row => this.mapRowToDevice(row));

    return {
      devices,
      total,
      page,
      limit
    };
  }

  async findByCustomerId(customerId: UUID): Promise<Device[]> {
    const query = 'SELECT * FROM devices WHERE customer_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [customerId]);
    
    return result.rows.map(row => this.mapRowToDevice(row));
  }

  async findByDeviceTypeId(deviceTypeId: UUID): Promise<Device[]> {
    const query = 'SELECT * FROM devices WHERE device_type_id = $1 ORDER BY created_at DESC';
    const result = await this.db.query(query, [deviceTypeId]);
    
    return result.rows.map(row => this.mapRowToDevice(row));
  }

  async delete(id: UUID): Promise<boolean> {
    const query = 'DELETE FROM devices WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rowCount > 0;
  }

  private mapRowToDevice(row: any): Device {
    return {
      id: row.id,
      deviceCode: row.device_code,
      customerId: row.customer_id,
      deviceTypeId: row.device_type_id,
      manufacturer: row.manufacturer,
      model: row.model,
      serialNumber: row.serial_number,
      specifications: row.specifications || {},
      locationInfo: row.location_info || {},
      status: row.status,
      warrantyInfo: row.warranty_info || {},
      lastServiceDate: row.last_service_date,
      nextServiceDate: row.next_service_date,
      qrCode: row.qr_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}