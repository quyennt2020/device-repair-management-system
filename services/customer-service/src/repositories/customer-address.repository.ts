import { Pool } from 'pg';
import { CustomerAddress, UUID } from '@drms/shared-types';

export class CustomerAddressRepository {
  constructor(private db: Pool) {}

  async create(address: Omit<CustomerAddress, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomerAddress> {
    const query = `
      INSERT INTO customer_addresses (
        customer_id, address_type, address_name, street_address, city, 
        state_province, postal_code, country, contact_person, phone, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      address.customerId,
      address.addressType,
      address.addressName,
      address.streetAddress,
      address.city,
      address.stateProvince,
      address.postalCode,
      address.country,
      address.contactPerson,
      address.phone,
      address.isDefault
    ]);

    return this.mapRowToAddress(result.rows[0]);
  }

  async findByCustomerId(customerId: UUID): Promise<CustomerAddress[]> {
    const query = `
      SELECT * FROM customer_addresses 
      WHERE customer_id = $1 
      ORDER BY is_default DESC, address_name ASC
    `;
    const result = await this.db.query(query, [customerId]);
    return result.rows.map(row => this.mapRowToAddress(row));
  }

  async findById(id: UUID): Promise<CustomerAddress | null> {
    const query = 'SELECT * FROM customer_addresses WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToAddress(result.rows[0]);
  }

  async update(id: UUID, updates: Partial<Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<CustomerAddress> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.addressType !== undefined) {
      updateFields.push(`address_type = $${paramIndex++}`);
      updateValues.push(updates.addressType);
    }
    if (updates.addressName !== undefined) {
      updateFields.push(`address_name = $${paramIndex++}`);
      updateValues.push(updates.addressName);
    }
    if (updates.streetAddress !== undefined) {
      updateFields.push(`street_address = $${paramIndex++}`);
      updateValues.push(updates.streetAddress);
    }
    if (updates.city !== undefined) {
      updateFields.push(`city = $${paramIndex++}`);
      updateValues.push(updates.city);
    }
    if (updates.stateProvince !== undefined) {
      updateFields.push(`state_province = $${paramIndex++}`);
      updateValues.push(updates.stateProvince);
    }
    if (updates.postalCode !== undefined) {
      updateFields.push(`postal_code = $${paramIndex++}`);
      updateValues.push(updates.postalCode);
    }
    if (updates.country !== undefined) {
      updateFields.push(`country = $${paramIndex++}`);
      updateValues.push(updates.country);
    }
    if (updates.contactPerson !== undefined) {
      updateFields.push(`contact_person = $${paramIndex++}`);
      updateValues.push(updates.contactPerson);
    }
    if (updates.phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      updateValues.push(updates.phone);
    }
    if (updates.isDefault !== undefined) {
      updateFields.push(`is_default = $${paramIndex++}`);
      updateValues.push(updates.isDefault);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const query = `
      UPDATE customer_addresses 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query(query, updateValues);
    return this.mapRowToAddress(result.rows[0]);
  }

  async delete(id: UUID): Promise<void> {
    const query = 'DELETE FROM customer_addresses WHERE id = $1';
    await this.db.query(query, [id]);
  }

  async setDefault(customerId: UUID, addressId: UUID): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Remove default flag from all addresses for this customer
      await client.query(
        'UPDATE customer_addresses SET is_default = false WHERE customer_id = $1',
        [customerId]
      );
      
      // Set the specified address as default
      await client.query(
        'UPDATE customer_addresses SET is_default = true WHERE id = $1 AND customer_id = $2',
        [addressId, customerId]
      );
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private mapRowToAddress(row: any): CustomerAddress {
    return {
      id: row.id,
      customerId: row.customer_id,
      addressType: row.address_type,
      addressName: row.address_name,
      streetAddress: row.street_address,
      city: row.city,
      stateProvince: row.state_province,
      postalCode: row.postal_code,
      country: row.country,
      contactPerson: row.contact_person,
      phone: row.phone,
      isDefault: row.is_default,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.customer_id, // fallback
      updatedBy: row.customer_id  // fallback
    };
  }
}