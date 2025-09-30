import { Pool } from 'pg';
import { CustomerPreferences, UUID } from '../../../shared/types/src/customer';

export class CustomerPreferencesRepository {
  constructor(private db: Pool) {}

  async create(preferences: Omit<CustomerPreferences, 'createdAt' | 'updatedAt'>): Promise<CustomerPreferences> {
    const query = `
      INSERT INTO customer_preferences (
        customer_id, preferred_technicians, preferred_service_times, 
        communication_preferences, special_instructions
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      preferences.customerId,
      JSON.stringify(preferences.preferredTechnicians),
      JSON.stringify(preferences.preferredServiceTimes),
      JSON.stringify(preferences.communicationPreferences),
      preferences.specialInstructions
    ]);

    return this.mapRowToPreferences(result.rows[0]);
  }

  async findByCustomerId(customerId: UUID): Promise<CustomerPreferences | null> {
    const query = 'SELECT * FROM customer_preferences WHERE customer_id = $1';
    const result = await this.db.query(query, [customerId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToPreferences(result.rows[0]);
  }

  async update(customerId: UUID, updates: Partial<Omit<CustomerPreferences, 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<CustomerPreferences> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.preferredTechnicians !== undefined) {
      updateFields.push(`preferred_technicians = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updates.preferredTechnicians));
    }
    if (updates.preferredServiceTimes !== undefined) {
      updateFields.push(`preferred_service_times = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updates.preferredServiceTimes));
    }
    if (updates.communicationPreferences !== undefined) {
      updateFields.push(`communication_preferences = $${paramIndex++}`);
      updateValues.push(JSON.stringify(updates.communicationPreferences));
    }
    if (updates.specialInstructions !== undefined) {
      updateFields.push(`special_instructions = $${paramIndex++}`);
      updateValues.push(updates.specialInstructions);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(customerId);

    const query = `
      UPDATE customer_preferences 
      SET ${updateFields.join(', ')}
      WHERE customer_id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return this.mapRowToPreferences(result.rows[0]);
  }

  async upsert(preferences: Omit<CustomerPreferences, 'createdAt' | 'updatedAt'>): Promise<CustomerPreferences> {
    const existing = await this.findByCustomerId(preferences.customerId);
    
    if (existing) {
      return this.update(preferences.customerId, preferences);
    } else {
      return this.create(preferences);
    }
  }

  async delete(customerId: UUID): Promise<void> {
    const query = 'DELETE FROM customer_preferences WHERE customer_id = $1';
    await this.db.query(query, [customerId]);
  }

  private mapRowToPreferences(row: any): CustomerPreferences {
    return {
      customerId: row.customer_id,
      preferredTechnicians: row.preferred_technicians || [],
      preferredServiceTimes: row.preferred_service_times || [],
      communicationPreferences: row.communication_preferences || {},
      specialInstructions: row.special_instructions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.customer_id, // fallback
      updatedBy: row.customer_id  // fallback
    };
  }
}