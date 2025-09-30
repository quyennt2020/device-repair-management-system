import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create technicians table
    await client.query(`
      CREATE TABLE technicians (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        hire_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated')),
        department VARCHAR(100),
        position VARCHAR(100),
        supervisor_id UUID REFERENCES technicians(id),
        base_location VARCHAR(255),
        hourly_rate DECIMAL(10,2),
        overtime_rate DECIMAL(10,2),
        travel_allowance DECIMAL(10,2),
        emergency_contact_name VARCHAR(100),
        emergency_contact_phone VARCHAR(20),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create technician_skills table
    await client.query(`
      CREATE TABLE technician_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
        skill_name VARCHAR(100) NOT NULL,
        skill_category VARCHAR(50) NOT NULL,
        proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
        years_experience INTEGER DEFAULT 0,
        certified BOOLEAN DEFAULT false,
        certification_date DATE,
        certification_expiry DATE,
        certification_body VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(technician_id, skill_name)
      );
    `);

    // Create technician_certifications table
    await client.query(`
      CREATE TABLE technician_certifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
        certification_name VARCHAR(100) NOT NULL,
        certification_type VARCHAR(50) NOT NULL,
        issuing_authority VARCHAR(100) NOT NULL,
        certification_number VARCHAR(100),
        issue_date DATE NOT NULL,
        expiry_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended', 'revoked')),
        renewal_required BOOLEAN DEFAULT true,
        renewal_period_months INTEGER,
        document_url VARCHAR(500),
        cost DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create technician_availability table
    await client.query(`
      CREATE TABLE technician_availability (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        shift_start TIME NOT NULL,
        shift_end TIME NOT NULL,
        available_hours DECIMAL(4,2) NOT NULL,
        scheduled_hours DECIMAL(4,2) DEFAULT 0,
        overtime_hours DECIMAL(4,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'on_leave', 'sick', 'training')),
        location VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(technician_id, date)
      );
    `);

    // Create technician_performance table
    await client.query(`
      CREATE TABLE technician_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        cases_completed INTEGER DEFAULT 0,
        cases_assigned INTEGER DEFAULT 0,
        completion_rate DECIMAL(5,2) DEFAULT 0,
        average_resolution_time_hours DECIMAL(8,2) DEFAULT 0,
        customer_satisfaction_avg DECIMAL(3,2) DEFAULT 0,
        customer_satisfaction_count INTEGER DEFAULT 0,
        sla_compliance_rate DECIMAL(5,2) DEFAULT 0,
        first_time_fix_rate DECIMAL(5,2) DEFAULT 0,
        total_hours_worked DECIMAL(8,2) DEFAULT 0,
        overtime_hours DECIMAL(8,2) DEFAULT 0,
        travel_hours DECIMAL(8,2) DEFAULT 0,
        training_hours DECIMAL(8,2) DEFAULT 0,
        revenue_generated DECIMAL(12,2) DEFAULT 0,
        cost_per_hour DECIMAL(10,2) DEFAULT 0,
        efficiency_score DECIMAL(5,2) DEFAULT 0,
        quality_score DECIMAL(5,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(technician_id, period_start, period_end)
      );
    `);

    // Create technician_workload table
    await client.query(`
      CREATE TABLE technician_workload (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        active_cases INTEGER DEFAULT 0,
        pending_cases INTEGER DEFAULT 0,
        scheduled_cases INTEGER DEFAULT 0,
        emergency_cases INTEGER DEFAULT 0,
        total_estimated_hours DECIMAL(8,2) DEFAULT 0,
        capacity_hours DECIMAL(8,2) NOT NULL,
        utilization_rate DECIMAL(5,2) DEFAULT 0,
        overload_threshold DECIMAL(5,2) DEFAULT 100,
        is_overloaded BOOLEAN DEFAULT false,
        location VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(technician_id, date)
      );
    `);

    // Create technician_schedule table
    await client.query(`
      CREATE TABLE technician_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
        case_id UUID,
        appointment_type VARCHAR(50) NOT NULL CHECK (appointment_type IN ('case_work', 'training', 'meeting', 'maintenance', 'travel', 'break')),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        location VARCHAR(255),
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
        estimated_travel_time INTEGER DEFAULT 0,
        actual_start_time TIMESTAMP,
        actual_end_time TIMESTAMP,
        completion_notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX idx_technicians_status ON technicians(status);
      CREATE INDEX idx_technicians_department ON technicians(department);
      CREATE INDEX idx_technicians_base_location ON technicians(base_location);
      CREATE INDEX idx_technician_skills_category ON technician_skills(skill_category);
      CREATE INDEX idx_technician_skills_proficiency ON technician_skills(proficiency_level);
      CREATE INDEX idx_technician_certifications_status ON technician_certifications(status);
      CREATE INDEX idx_technician_certifications_expiry ON technician_certifications(expiry_date);
      CREATE INDEX idx_technician_availability_date ON technician_availability(date);
      CREATE INDEX idx_technician_availability_status ON technician_availability(status);
      CREATE INDEX idx_technician_performance_period ON technician_performance(period_start, period_end);
      CREATE INDEX idx_technician_workload_date ON technician_workload(date);
      CREATE INDEX idx_technician_workload_overloaded ON technician_workload(is_overloaded);
      CREATE INDEX idx_technician_schedule_start_time ON technician_schedule(start_time);
      CREATE INDEX idx_technician_schedule_status ON technician_schedule(status);
      CREATE INDEX idx_technician_schedule_case_id ON technician_schedule(case_id);
    `);

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
    
    await client.query('DROP TABLE IF EXISTS technician_schedule CASCADE');
    await client.query('DROP TABLE IF EXISTS technician_workload CASCADE');
    await client.query('DROP TABLE IF EXISTS technician_performance CASCADE');
    await client.query('DROP TABLE IF EXISTS technician_availability CASCADE');
    await client.query('DROP TABLE IF EXISTS technician_certifications CASCADE');
    await client.query('DROP TABLE IF EXISTS technician_skills CASCADE');
    await client.query('DROP TABLE IF EXISTS technicians CASCADE');
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}