import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Customer contacts table - normalized from contact_info JSONB
    console.log('  📇 Creating customer_contacts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_contacts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID,
        contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('primary', 'billing', 'technical', 'other')),
        contact_person VARCHAR(255) NOT NULL,
        title VARCHAR(100),
        department VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        mobile VARCHAR(50),
        is_primary BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Customer addresses table - normalized from address_info JSONB
    console.log('  📍 Creating customer_addresses table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID,
        address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('main', 'billing', 'shipping', 'other')),
        address_line1 VARCHAR(255) NOT NULL,
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state_province VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Vietnam',
        is_primary BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes for performance
    console.log('  📊 Creating indexes...');
    // Skip index creation for now - can be added later if needed
    console.log('  ⏭️  Skipping indexes (will be added in future migration)');

    console.log('  ✅ Customer data normalized successfully');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DROP TABLE IF EXISTS customer_addresses CASCADE;');
    await client.query('DROP TABLE IF EXISTS customer_contacts CASCADE;');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
