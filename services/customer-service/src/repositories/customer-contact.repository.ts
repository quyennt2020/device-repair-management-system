import { Pool } from 'pg';
import { CustomerContact, UUID } from '@drms/shared-types';

export class CustomerContactRepository {
  constructor(private db: Pool) {}

  async create(contact: Omit<CustomerContact, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomerContact> {
    const query = `
      INSERT INTO customer_contacts (
        customer_id, name, title, department, email, phone, mobile, 
        is_primary, role
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      contact.customerId,
      contact.name,
      contact.title,
      contact.department,
      contact.email,
      contact.phone,
      contact.mobile,
      contact.isPrimary,
      contact.role
    ]);

    return this.mapRowToContact(result.rows[0]);
  }

  async findByCustomerId(customerId: UUID): Promise<CustomerContact[]> {
    const query = `
      SELECT * FROM customer_contacts 
      WHERE customer_id = $1 
      ORDER BY is_primary DESC, name ASC
    `;
    const result = await this.db.query(query, [customerId]);
    return result.rows.map(row => this.mapRowToContact(row));
  }

  async findById(id: UUID): Promise<CustomerContact | null> {
    const query = 'SELECT * FROM customer_contacts WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToContact(result.rows[0]);
  }

  async update(id: UUID, updates: Partial<Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<CustomerContact> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(updates.name);
    }
    if (updates.title !== undefined) {
      updateFields.push(`title = $${paramIndex++}`);
      updateValues.push(updates.title);
    }
    if (updates.department !== undefined) {
      updateFields.push(`department = $${paramIndex++}`);
      updateValues.push(updates.department);
    }
    if (updates.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(updates.email);
    }
    if (updates.phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      updateValues.push(updates.phone);
    }
    if (updates.mobile !== undefined) {
      updateFields.push(`mobile = $${paramIndex++}`);
      updateValues.push(updates.mobile);
    }
    if (updates.isPrimary !== undefined) {
      updateFields.push(`is_primary = $${paramIndex++}`);
      updateValues.push(updates.isPrimary);
    }
    if (updates.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      updateValues.push(updates.role);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const query = `
      UPDATE customer_contacts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return this.mapRowToContact(result.rows[0]);
  }

  async delete(id: UUID): Promise<void> {
    const query = 'DELETE FROM customer_contacts WHERE id = $1';
    await this.db.query(query, [id]);
  }

  async setPrimary(customerId: UUID, contactId: UUID): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Remove primary flag from all contacts for this customer
      await client.query(
        'UPDATE customer_contacts SET is_primary = false WHERE customer_id = $1',
        [customerId]
      );
      
      // Set the specified contact as primary
      await client.query(
        'UPDATE customer_contacts SET is_primary = true WHERE id = $1 AND customer_id = $2',
        [contactId, customerId]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToContact(row: any): CustomerContact {
    return {
      id: row.id,
      customerId: row.customer_id,
      name: row.name,
      title: row.title,
      department: row.department,
      email: row.email,
      phone: row.phone,
      mobile: row.mobile,
      isPrimary: row.is_primary,
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.customer_id, // fallback
      updatedBy: row.customer_id  // fallback
    };
  }
}