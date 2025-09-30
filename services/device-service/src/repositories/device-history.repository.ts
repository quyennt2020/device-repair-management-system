import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DeviceHistory, DeviceEventType, DevicePartUsage } from '@shared/types/src/device';
import { UUID } from '@shared/types/src/common';

export interface CreateDeviceHistoryRequest {
  deviceId: UUID;
  repairCaseId?: UUID;
  eventType: DeviceEventType;
  eventDate: Date;
  description: string;
  performedBy?: UUID;
  nextActionDate?: Date;
  cost?: number;
  partsUsed?: DevicePartUsage[];
}

export class DeviceHistoryRepository {
  constructor(private db: Pool) {}

  async create(request: CreateDeviceHistoryRequest): Promise<DeviceHistory> {
    const id = uuidv4();
    const now = new Date();
    
    const query = `
      INSERT INTO device_history (
        id, device_id, repair_case_id, event_type, event_date, 
        description, performed_by, next_action_date, cost, 
        parts_used, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const values = [
      id,
      request.deviceId,
      request.repairCaseId,
      request.eventType,
      request.eventDate,
      request.description,
      request.performedBy,
      request.nextActionDate,
      request.cost,
      JSON.stringify(request.partsUsed || []),
      now,
      now
    ];
    
    const result = await this.db.query(query, values);
    return this.mapRowToDeviceHistory(result.rows[0]);
  }

  async findById(id: UUID): Promise<DeviceHistory | null> {
    const query = 'SELECT * FROM device_history WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDeviceHistory(result.rows[0]);
  }

  async findByDeviceId(deviceId: UUID): Promise<DeviceHistory[]> {
    const query = `
      SELECT * FROM device_history 
      WHERE device_id = $1 
      ORDER BY event_date DESC, created_at DESC
    `;
    const result = await this.db.query(query, [deviceId]);
    
    return result.rows.map(row => this.mapRowToDeviceHistory(row));
  }

  async findByDeviceIdAndEventType(deviceId: UUID, eventType: DeviceEventType): Promise<DeviceHistory[]> {
    const query = `
      SELECT * FROM device_history 
      WHERE device_id = $1 AND event_type = $2 
      ORDER BY event_date DESC, created_at DESC
    `;
    const result = await this.db.query(query, [deviceId, eventType]);
    
    return result.rows.map(row => this.mapRowToDeviceHistory(row));
  }

  async findByCaseId(repairCaseId: UUID): Promise<DeviceHistory[]> {
    const query = `
      SELECT * FROM device_history 
      WHERE repair_case_id = $1 
      ORDER BY event_date DESC, created_at DESC
    `;
    const result = await this.db.query(query, [repairCaseId]);
    
    return result.rows.map(row => this.mapRowToDeviceHistory(row));
  }

  async findByDateRange(deviceId: UUID, startDate: Date, endDate: Date): Promise<DeviceHistory[]> {
    const query = `
      SELECT * FROM device_history 
      WHERE device_id = $1 AND event_date BETWEEN $2 AND $3 
      ORDER BY event_date DESC, created_at DESC
    `;
    const result = await this.db.query(query, [deviceId, startDate, endDate]);
    
    return result.rows.map(row => this.mapRowToDeviceHistory(row));
  }

  async getServiceTimeline(deviceId: UUID): Promise<DeviceHistory[]> {
    const query = `
      SELECT * FROM device_history 
      WHERE device_id = $1 
      ORDER BY event_date ASC, created_at ASC
    `;
    const result = await this.db.query(query, [deviceId]);
    
    return result.rows.map(row => this.mapRowToDeviceHistory(row));
  }

  async getPartsReplacementHistory(deviceId: UUID): Promise<DeviceHistory[]> {
    const query = `
      SELECT * FROM device_history 
      WHERE device_id = $1 AND parts_used IS NOT NULL AND parts_used != '[]'
      ORDER BY event_date DESC, created_at DESC
    `;
    const result = await this.db.query(query, [deviceId]);
    
    return result.rows.map(row => this.mapRowToDeviceHistory(row));
  }

  async getLastServiceDate(deviceId: UUID): Promise<Date | null> {
    const query = `
      SELECT MAX(event_date) as last_service_date 
      FROM device_history 
      WHERE device_id = $1 AND event_type IN ('service', 'repair', 'maintenance')
    `;
    const result = await this.db.query(query, [deviceId]);
    
    return result.rows[0]?.last_service_date || null;
  }

  async getTotalServiceCost(deviceId: UUID): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(cost), 0) as total_cost 
      FROM device_history 
      WHERE device_id = $1 AND cost IS NOT NULL
    `;
    const result = await this.db.query(query, [deviceId]);
    
    return parseFloat(result.rows[0]?.total_cost || '0');
  }

  async getServiceCount(deviceId: UUID, eventType?: DeviceEventType): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM device_history WHERE device_id = $1';
    const values: any[] = [deviceId];
    
    if (eventType) {
      query += ' AND event_type = $2';
      values.push(eventType);
    }
    
    const result = await this.db.query(query, values);
    return parseInt(result.rows[0]?.count || '0');
  }

  async update(id: UUID, updates: Partial<CreateDeviceHistoryRequest>): Promise<DeviceHistory | null> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    
    if (updates.nextActionDate !== undefined) {
      updateFields.push(`next_action_date = $${paramIndex++}`);
      values.push(updates.nextActionDate);
    }
    
    if (updates.cost !== undefined) {
      updateFields.push(`cost = $${paramIndex++}`);
      values.push(updates.cost);
    }
    
    if (updates.partsUsed !== undefined) {
      updateFields.push(`parts_used = $${paramIndex++}`);
      values.push(JSON.stringify(updates.partsUsed));
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    updateFields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const query = `
      UPDATE device_history 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToDeviceHistory(result.rows[0]);
  }

  async delete(id: UUID): Promise<boolean> {
    const query = 'DELETE FROM device_history WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rowCount > 0;
  }

  private mapRowToDeviceHistory(row: any): DeviceHistory {
    return {
      id: row.id,
      deviceId: row.device_id,
      repairCaseId: row.repair_case_id,
      eventType: row.event_type,
      eventDate: row.event_date,
      description: row.description,
      performedBy: row.performed_by,
      nextActionDate: row.next_action_date,
      cost: row.cost ? parseFloat(row.cost) : undefined,
      partsUsed: row.parts_used || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}