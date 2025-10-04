const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'device_repair_db',
  user: process.env.DATABASE_USER || 'drms_user',
  password: process.env.DATABASE_PASSWORD || 'drms_password',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Middleware
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // For demo, accept admin/admin123 and technician/tech123
    if ((username === 'admin' && password === 'admin123') ||
        (username === 'technician' && password === 'tech123')) {

      const token = 'jwt-token-' + Date.now();

      // Get ALL permissions from database
      const allPerms = await pool.query('SELECT id, resource, action FROM permissions');
      const permissions = allPerms.rows.map(p => ({ id: p.id, resource: p.resource, action: p.action }));

      // Create mock user
      const mockUser = {
        id: username === 'admin' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002',
        username: username,
        email: `${username}@drms.com`,
        firstName: username === 'admin' ? 'Admin' : 'Tech',
        lastName: username === 'admin' ? 'User' : 'User',
        roles: [{ id: '1', name: username === 'admin' ? 'admin' : 'technician', description: 'System user' }],
        permissions: permissions,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      res.json({
        success: true,
        data: {
          user: mockUser,
          token: token
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Dashboard stats from real database
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') as open_cases,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_cases,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_cases,
        COUNT(*) as total_cases
      FROM repair_cases
    `);

    const result = stats.rows[0];

    res.json({
      success: true,
      data: {
        totalCases: parseInt(result.total_cases) || 0,
        openCases: parseInt(result.open_cases) || 0,
        inProgressCases: parseInt(result.in_progress_cases) || 0,
        completedCases: parseInt(result.completed_cases) || 0,
        slaCompliance: 94.5,
        revenue: 2450000000,
        avgResolutionTime: 4.2
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Case status distribution
app.get('/api/dashboard/case-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM repair_cases
      GROUP BY status
    `);

    const colorMap = {
      'open': '#ff9800',
      'in_progress': '#2196f3',
      'completed': '#4caf50',
      'cancelled': '#f44336',
      'scheduled': '#9c27b0'
    };

    const data = result.rows.map(row => ({
      name: row.status.charAt(0).toUpperCase() + row.status.slice(1).replace('_', ' '),
      value: parseInt(row.count),
      color: colorMap[row.status] || '#757575'
    }));

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Case status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Technician workload
app.get('/api/dashboard/technician-workload', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.first_name || ' ' || t.last_name as name,
        COUNT(c.id) as case_count
      FROM technicians t
      LEFT JOIN cases c ON t.id = c.assigned_technician_id AND c.status != 'completed'
      WHERE t.is_active = true
      GROUP BY t.id, t.first_name, t.last_name
      ORDER BY case_count DESC
      LIMIT 5
    `);

    const colors = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336'];

    const data = result.rows.map((row, index) => ({
      name: row.name,
      value: parseInt(row.case_count),
      color: colors[index % colors.length]
    }));

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Workload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cases list from real database
app.get('/api/cases', async (req, res) => {
  try {
    const { technician_id } = req.query;

    let query = `
      SELECT
        c.id,
        c.case_number,
        c.title,
        c.description,
        c.status,
        c.priority,
        c.category,
        c.created_at,
        c.sla_due_date,
        COALESCE(cu.contact_info->>'name', cu.company_name, 'N/A') as customer_name,
        d.manufacturer || ' ' || d.model as device_name,
        t.first_name || ' ' || t.last_name as technician_name
      FROM repair_cases c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN technicians t ON c.assigned_technician_id = t.id
    `;

    const queryParams = [];
    if (technician_id) {
      query += ` WHERE c.assigned_technician_id = $1`;
      queryParams.push(technician_id);
    }

    query += ` ORDER BY c.created_at DESC LIMIT 20`;

    const result = await pool.query(query, queryParams);

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.case_number,
        case_number: row.case_number,
        title: row.title,
        customer_name: row.customer_name,
        device_name: row.device_name,
        status: row.status,
        priority: row.priority,
        assigned_technician: row.technician_name,
        created_at: row.created_at,
        sla_due_date: row.sla_due_date
      }))
    });
  } catch (error) {
    console.error('Cases error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get case detail
app.get('/api/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        c.id,
        c.case_number,
        c.title,
        c.description,
        c.status,
        c.priority,
        c.category as service_type,
        c.created_at,
        c.sla_due_date as scheduled_date,
        COALESCE(cu.contact_info->>'name', cu.company_name, 'N/A') as customer_name,
        cu.company_name as customer_company,
        d.manufacturer || ' ' || d.model as device_name,
        d.model as device_model,
        d.serial_number as device_serial,
        t.first_name || ' ' || t.last_name as assigned_technician,
        t.id as assigned_technician_id,
        2 as estimated_duration
      FROM repair_cases c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN technicians t ON c.assigned_technician_id = t.id
      WHERE c.case_number = $1 OR c.id::text = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get case detail error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update case
app.put('/api/cases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority, description, scheduled_date } = req.body;

    const result = await pool.query(`
      UPDATE repair_cases
      SET priority = COALESCE($1, priority),
          description = COALESCE($2, description),
          sla_due_date = COALESCE($3, sla_due_date),
          updated_at = NOW()
      WHERE case_number = $4 OR id::text = $4
      RETURNING *
    `, [priority, description, scheduled_date, id]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get case activities
app.get('/api/cases/:id/activities', async (req, res) => {
  try {
    // Return empty array for now - will implement later
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get case documents
app.get('/api/cases/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        d.id,
        d.case_id,
        d.document_type_id,
        d.status,
        d.content,
        d.version,
        d.created_at,
        d.updated_at,
        dt.name as document_type_name,
        dt.category as document_category
      FROM documents d
      JOIN document_types dt ON d.document_type_id = dt.id
      WHERE d.case_id = (SELECT id FROM repair_cases WHERE case_number = $1 OR id::text = $1)
      ORDER BY d.created_at DESC
    `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create document from case
app.post('/api/cases/:caseId/documents', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { document_type_id } = req.body;

    if (!document_type_id) {
      return res.status(400).json({
        success: false,
        message: 'document_type_id is required'
      });
    }

    // Fetch case data with all related information
    const caseResult = await pool.query(`
      SELECT
        c.id as case_id,
        c.case_number,
        c.title as case_title,
        c.description as case_description,
        c.priority,
        c.category,
        c.status as case_status,
        c.created_at as case_created_at,
        c.sla_due_date,
        -- Customer info
        cu.id as customer_id,
        cu.customer_code,
        cu.company_name,
        cu.contact_info,
        cu.address_info,
        -- Device info
        d.id as device_id,
        d.device_code,
        d.manufacturer,
        d.model,
        d.serial_number,
        d.specifications,
        d.warranty_info,
        dt.id as device_type_id,
        dt.name as device_type_name,
        dt.category as device_category,
        -- Technician info
        t.id as technician_id,
        t.first_name || ' ' || t.last_name as technician_name,
        t.email as technician_email,
        t.phone as technician_phone
      FROM repair_cases c
      LEFT JOIN customers cu ON c.customer_id = cu.id
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
      LEFT JOIN technicians t ON c.assigned_technician_id = t.id
      WHERE c.case_number = $1 OR c.id::text = $1
    `, [caseId]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const caseData = caseResult.rows[0];

    // Get document type info
    const docTypeResult = await pool.query(`
      SELECT * FROM document_types WHERE id = $1
    `, [document_type_id]);

    if (docTypeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document type not found'
      });
    }

    const docType = docTypeResult.rows[0];
    const templateConfig = docType.template_config || {};

    // Get or create a user for created_by
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    let createdBy = null;
    if (userResult.rows.length > 0) {
      createdBy = userResult.rows[0].id;
    } else {
      const newUser = await pool.query(`
        INSERT INTO users (email, password_hash, full_name, status)
        VALUES ('system@drms.com', 'hash', 'System User', 'active')
        RETURNING id
      `);
      createdBy = newUser.rows[0].id;
    }

    // Build content from template config
    const content = {
      // Case information
      case_number: caseData.case_number,
      case_title: caseData.case_title,
      case_description: caseData.case_description,
      case_priority: caseData.priority,
      case_status: caseData.case_status,

      // Customer information
      customer_code: caseData.customer_code,
      customer_name: caseData.contact_info?.name || caseData.company_name,
      customer_company: caseData.company_name,
      customer_email: caseData.contact_info?.email,
      customer_phone: caseData.contact_info?.phone,
      customer_address: caseData.address_info?.address,
      customer_city: caseData.address_info?.city,

      // Device information
      device_code: caseData.device_code,
      device_manufacturer: caseData.manufacturer,
      device_model: caseData.model,
      device_serial: caseData.serial_number,
      device_type: caseData.device_type_name,
      device_category: caseData.device_category,
      device_specifications: caseData.specifications,

      // Technician information
      technician_name: caseData.technician_name,
      technician_email: caseData.technician_email,
      technician_phone: caseData.technician_phone,

      // Document metadata
      inspection_date: new Date().toISOString(),
      report_date: new Date().toISOString(),
      created_by: caseData.technician_name || 'System',

      // Template-based fields
      // Load device-specific checklist based on document category
      ...(templateConfig.device_specific_checklists &&
          caseData.device_type_id &&
          templateConfig.device_specific_checklists[caseData.device_type_id] && {
        // For inspection_report: use inspection_checklist
        ...(docType.category === 'inspection_report' && {
          inspection_checklist: templateConfig.device_specific_checklists[caseData.device_type_id].inspection_checklist?.map(item => ({
            ...item,
            result: null,
            status: 'pending',
            notes: '',
            checked_at: null
          })) || []
        }),
        // For maintenance_report: use maintenance_checklist
        ...(docType.category === 'maintenance_report' && {
          maintenance_checklist: templateConfig.device_specific_checklists[caseData.device_type_id].maintenance_checklist?.map(item => ({
            ...item,
            result: null,
            status: 'pending',
            notes: '',
            checked_at: null
          })) || []
        }),
        // Common spare parts for all document types
        available_spare_parts: templateConfig.device_specific_checklists[caseData.device_type_id].common_spare_parts || []
      }),

      // Initialize custom fields from template
      ...(templateConfig.form_fields?.custom_fields && {
        custom_fields: templateConfig.form_fields.custom_fields.reduce((acc, field) => {
          acc[field.field_name] = null;
          return acc;
        }, {})
      }),

      // Category-specific fields (fallback for templates without device_specific config)
      ...(docType.category === 'inspection_report' && {
        findings: [],
        recommended_parts: [],
        severity_level: 'normal',
        estimated_repair_cost: 0,
        estimated_repair_hours: 0
      }),

      ...(docType.category === 'quotation' && {
        line_items: [],
        subtotal: 0,
        tax_amount: 0,
        total_amount: 0,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        payment_terms: 'Net 30',
        notes: ''
      }),

      ...(docType.category === 'repair_report' && {
        parts_replaced: [],
        procedures_performed: [],
        test_results: [],
        repair_duration_hours: 0,
        completion_notes: ''
      }),

      ...(docType.category === 'maintenance_report' && {
        checklist_items: [],
        overall_condition: 'good',
        maintenance_type: 'preventive',
        next_maintenance_date: null,
        technician_notes: ''
      })
    };

    // Create document
    const result = await pool.query(`
      INSERT INTO documents (
        case_id,
        document_type_id,
        status,
        content,
        version,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'draft', $3, 1, $4, NOW(), NOW())
      RETURNING *
    `, [caseData.case_id, document_type_id, JSON.stringify(content), createdBy]);

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        document_type_name: docType.name,
        document_category: docType.category
      }
    });
  } catch (error) {
    console.error('Create document from case error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new case
app.post('/api/cases', async (req, res) => {
  try {
    const {
      title, description, customer_id, device_id, priority, category,
      service_type, requested_by, assigned_technician_id, scheduled_date
    } = req.body;

    // Generate case number
    const caseCountResult = await pool.query('SELECT COUNT(*) FROM repair_cases');
    const caseNumber = `CASE-${String(parseInt(caseCountResult.rows[0].count) + 1).padStart(3, '0')}`;

    // Get current user ID from mock session (in production, this would come from JWT token)
    const currentUserId = requested_by || '00000000-0000-0000-0000-000000000001';

    const result = await pool.query(`
      INSERT INTO repair_cases (
        case_number, title, description, customer_id, device_id,
        priority, category, service_type, requested_by,
        assigned_technician_id, scheduled_date, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open')
      RETURNING *
    `, [
      caseNumber,
      title || 'New Case',
      description,
      customer_id,
      device_id,
      priority || 'medium',
      category || service_type || 'repair',
      service_type || category || 'repair',
      currentUserId,
      assigned_technician_id || null,
      scheduled_date || null
    ]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Customers endpoints
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        customer_code,
        customer_type,
        company_name as company,
        contact_info->>'name' as name,
        contact_info->>'email' as email,
        contact_info->>'phone' as phone,
        address_info->>'address' as address,
        customer_tier as tier,
        status,
        created_at,
        (SELECT COUNT(*) FROM repair_cases WHERE customer_id = customers.id) as total_cases,
        (SELECT COUNT(*) FROM repair_cases WHERE customer_id = customers.id AND status IN ('open', 'in_progress')) as active_cases,
        (SELECT MAX(created_at) FROM repair_cases WHERE customer_id = customers.id) as last_service_date
      FROM customers
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Customers error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get customer by ID
app.get('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get customer's repair cases
app.get('/api/customers/:id/cases', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        rc.id,
        rc.case_number,
        rc.service_type,
        rc.status,
        rc.priority,
        rc.description,
        rc.created_at,
        rc.actual_completion_date,
        d.device_code,
        d.model,
        d.serial_number,
        CONCAT(t.first_name, ' ', t.last_name) as technician_name
      FROM repair_cases rc
      LEFT JOIN devices d ON rc.device_id = d.id
      LEFT JOIN technicians t ON rc.assigned_technician_id = t.id
      WHERE rc.customer_id = $1
      ORDER BY rc.created_at DESC
    `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get customer cases error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get customer's devices
app.get('/api/customers/:id/devices', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        d.*,
        dt.name as device_type_name,
        COUNT(rc.id) as total_cases
      FROM devices d
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
      LEFT JOIN repair_cases rc ON d.id = rc.device_id
      WHERE d.customer_id = $1
      GROUP BY d.id, dt.name
      ORDER BY d.created_at DESC
    `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get customer devices error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, company, type, address, city, postal_code } = req.body;

    // Generate customer code
    const customerCountResult = await pool.query('SELECT COUNT(*) FROM customers');
    const customerCode = `CUST-${String(parseInt(customerCountResult.rows[0].count) + 1).padStart(3, '0')}`;

    // Build contact_info and address_info JSONB objects
    const contactInfo = {
      name: name || '',
      email: email || '',
      phone: phone || ''
    };

    const addressInfo = {
      address: address || '',
      city: city || '',
      postal_code: postal_code || '',
      country: 'Vietnam'
    };

    const result = await pool.query(`
      INSERT INTO customers (customer_code, customer_type, company_name, contact_info, address_info, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *
    `, [customerCode, type || 'individual', company || '', JSON.stringify(contactInfo), JSON.stringify(addressInfo)]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, type } = req.body;

    const result = await pool.query(`
      UPDATE customers
      SET name = COALESCE($1, name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          company = COALESCE($4, company),
          type = COALESCE($5, type),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [name, email, phone, company, type, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Technicians endpoints
app.get('/api/technicians', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.first_name,
        t.last_name,
        t.email,
        t.phone,
        t.department,
        t.position,
        t.status,
        t.hire_date
      FROM technicians t
      WHERE t.deleted_at IS NULL
      ORDER BY t.first_name, t.last_name
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Technicians error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get technician by ID
app.get('/api/technicians/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        t.id,
        t.first_name,
        t.last_name,
        t.email,
        t.phone,
        t.department,
        t.position,
        t.status,
        t.hire_date,
        t.created_at,
        t.updated_at
      FROM technicians t
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get technician error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create technician
app.post('/api/technicians', async (req, res) => {
  try {
    const { employee_id, first_name, last_name, email, phone, department, position, hire_date, status } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }

    // Generate employee_id if not provided
    const empId = employee_id || `TECH-${Date.now()}`;

    const result = await pool.query(`
      INSERT INTO technicians (employee_id, first_name, last_name, email, phone, department, position, hire_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [empId, first_name, last_name, email, phone, department, position, hire_date || new Date(), status || 'active']);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create technician error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ success: false, message: 'Technician with this email already exists' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// Update technician
app.put('/api/technicians/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, department, position, status, hire_date } = req.body;

    const result = await pool.query(`
      UPDATE technicians
      SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        department = COALESCE($5, department),
        position = COALESCE($6, position),
        status = COALESCE($7, status),
        hire_date = COALESCE($8, hire_date),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [first_name, last_name, email, phone, department, position, status, hire_date, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update technician error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ success: false, message: 'Technician with this email already exists' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// Delete technician
app.delete('/api/technicians/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM technicians
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Technician not found'
      });
    }

    res.json({
      success: true,
      message: 'Technician deleted successfully'
    });
  } catch (error) {
    console.error('Delete technician error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Document Templates endpoints
app.get('/api/document-templates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        dt.id,
        dt.name,
        dt.category,
        dt.template_config,
        dt.required_fields,
        dt.is_active,
        dt.created_at,
        dt.updated_at,
        (SELECT COUNT(*) FROM documents WHERE document_type_id = dt.id) as usage_count
      FROM document_types dt
      ORDER BY dt.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get document templates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single document template
app.get('/api/document-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        dt.*,
        (SELECT COUNT(*) FROM documents WHERE document_type_id = dt.id) as usage_count
      FROM document_types dt
      WHERE dt.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document template not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get document template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create document template
app.post('/api/document-templates', async (req, res) => {
  try {
    const { name, category, template_config, required_fields } = req.body;

    const result = await pool.query(`
      INSERT INTO document_types (name, category, template_config, required_fields)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, category, template_config || {}, required_fields || {}]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create document template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update document template
app.put('/api/document-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, template_config, required_fields, is_active } = req.body;

    const result = await pool.query(`
      UPDATE document_types
      SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        template_config = COALESCE($3, template_config),
        required_fields = COALESCE($4, required_fields),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [name, category, template_config, required_fields, is_active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document template not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update document template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clone/duplicate document template
app.post('/api/document-templates/:id/clone', async (req, res) => {
  try {
    const { id } = req.params;

    // Get original template
    const original = await pool.query(`
      SELECT * FROM document_types WHERE id = $1
    `, [id]);

    if (original.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document template not found'
      });
    }

    const orig = original.rows[0];

    // Create clone with modified name
    const result = await pool.query(`
      INSERT INTO document_types (name, category, template_config, required_fields, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      `${orig.name} (Bản sao)`,
      orig.category,
      orig.template_config,
      orig.required_fields,
      false // Set clone as inactive by default
    ]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Clone document template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete document template
app.delete('/api/document-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if template is being used
    const usageCheck = await pool.query(`
      SELECT COUNT(*) as count FROM documents WHERE document_type_id = $1
    `, [id]);

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa mẫu đang được sử dụng'
      });
    }

    const result = await pool.query(`
      DELETE FROM document_types
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document template not found'
      });
    }

    res.json({
      success: true,
      message: 'Document template deleted successfully'
    });
  } catch (error) {
    console.error('Delete document template error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Documents endpoints
// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id,
        d.case_id,
        d.document_type_id,
        d.status,
        d.content,
        d.version,
        d.created_at,
        d.updated_at,
        dt.name as document_type_name,
        dt.category as document_category
      FROM documents d
      JOIN document_types dt ON d.document_type_id = dt.id
      WHERE d.deleted_at IS NULL
      ORDER BY d.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single document
app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        d.*,
        dt.name as document_type_name,
        dt.category as document_category
      FROM documents d
      JOIN document_types dt ON d.document_type_id = dt.id
      WHERE d.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update document
app.put('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const result = await pool.query(`
      UPDATE documents
      SET
        content = COALESCE($1, content),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [JSON.stringify(content), id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update document status
app.put('/api/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(`
      UPDATE documents
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update document status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Devices endpoints
app.get('/api/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.*,
        COALESCE(c.contact_info->>'name', c.company_name, 'N/A') as customer_name
      FROM devices d
      LEFT JOIN customers c ON d.customer_id = c.id
      ORDER BY d.created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Devices error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device by ID
app.get('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT d.*, c.company_name as customer_name
      FROM devices d
      LEFT JOIN customers c ON d.customer_id = c.id
      WHERE d.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device types
app.get('/api/device-types', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (name, manufacturer, model_series)
        id, name, category, manufacturer, model_series
      FROM device_types
      ORDER BY name, manufacturer, model_series, created_at ASC
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get device types error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/devices', async (req, res) => {
  try {
    const {
      customer_id, manufacturer, model, serial_number, device_type_id,
      specifications, warranty_info, location_info, status
    } = req.body;

    // Generate device code
    const deviceCountResult = await pool.query('SELECT COUNT(*) FROM devices');
    const deviceCode = `DEV-${String(parseInt(deviceCountResult.rows[0].count) + 1).padStart(3, '0')}`;

    const result = await pool.query(`
      INSERT INTO devices (
        device_code, customer_id, manufacturer, model, serial_number,
        device_type_id, specifications, warranty_info, location_info, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      deviceCode,
      customer_id,
      manufacturer,
      model,
      serial_number,
      device_type_id,
      specifications || '{}',
      warranty_info || '{}',
      location_info || '{}',
      status || 'active'
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update device
app.put('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_id, brand, model, serial_number, device_type, status } = req.body;

    const result = await pool.query(`
      UPDATE devices
      SET customer_id = COALESCE($1, customer_id),
          brand = COALESCE($2, brand),
          model = COALESCE($3, model),
          serial_number = COALESCE($4, serial_number),
          device_type = COALESCE($5, device_type),
          status = COALESCE($6, status),
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [customer_id, brand, model, serial_number, device_type, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete device
app.delete('/api/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Tools endpoints
app.get('/api/tools', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        st.id,
        st.tool_code,
        st.tool_name,
        st.category,
        st.manufacturer,
        st.model,
        st.serial_number,
        st.purchase_date,
        st.purchase_cost,
        st.status,
        st.location,
        st.calibration_required,
        st.last_calibration_date,
        st.next_calibration_date,
        st.required_for_device_types,
        st.specifications,
        st.created_at,
        st.updated_at,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'active') as active_assignments
      FROM service_tools st
      LEFT JOIN tool_assignments ta ON st.id = ta.tool_id
      GROUP BY st.id
      ORDER BY st.tool_name
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single tool
app.get('/api/tools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        st.*,
        COUNT(DISTINCT ta.id) FILTER (WHERE ta.status = 'active') as active_assignments,
        COUNT(DISTINCT tm.id) FILTER (WHERE tm.status = 'completed') as completed_maintenance
      FROM service_tools st
      LEFT JOIN tool_assignments ta ON st.id = ta.tool_id
      LEFT JOIN tool_maintenance tm ON st.id = tm.tool_id
      WHERE st.id = $1
      GROUP BY st.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create tool
app.post('/api/tools', async (req, res) => {
  try {
    const {
      tool_code,
      tool_name,
      category,
      manufacturer,
      model,
      serial_number,
      purchase_date,
      purchase_cost,
      status,
      location,
      calibration_required,
      last_calibration_date,
      next_calibration_date,
      required_for_device_types,
      specifications
    } = req.body;

    const result = await pool.query(`
      INSERT INTO service_tools (
        tool_code, tool_name, category, manufacturer, model, serial_number,
        purchase_date, purchase_cost, status, location, calibration_required,
        last_calibration_date, next_calibration_date, required_for_device_types, specifications
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      tool_code, tool_name, category, manufacturer, model, serial_number,
      purchase_date, purchase_cost, status || 'available', location, calibration_required || false,
      last_calibration_date, next_calibration_date,
      JSON.stringify(required_for_device_types || []),
      JSON.stringify(specifications || {})
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create tool error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update tool
app.put('/api/tools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tool_code,
      tool_name,
      category,
      manufacturer,
      model,
      serial_number,
      purchase_date,
      purchase_cost,
      status,
      location,
      calibration_required,
      last_calibration_date,
      next_calibration_date,
      required_for_device_types,
      specifications
    } = req.body;

    const result = await pool.query(`
      UPDATE service_tools
      SET
        tool_code = COALESCE($1, tool_code),
        tool_name = COALESCE($2, tool_name),
        category = COALESCE($3, category),
        manufacturer = COALESCE($4, manufacturer),
        model = COALESCE($5, model),
        serial_number = COALESCE($6, serial_number),
        purchase_date = COALESCE($7, purchase_date),
        purchase_cost = COALESCE($8, purchase_cost),
        status = COALESCE($9, status),
        location = COALESCE($10, location),
        calibration_required = COALESCE($11, calibration_required),
        last_calibration_date = COALESCE($12, last_calibration_date),
        next_calibration_date = COALESCE($13, next_calibration_date),
        required_for_device_types = COALESCE($14, required_for_device_types),
        specifications = COALESCE($15, specifications),
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
    `, [
      tool_code, tool_name, category, manufacturer, model, serial_number,
      purchase_date, purchase_cost, status, location, calibration_required,
      last_calibration_date, next_calibration_date,
      required_for_device_types ? JSON.stringify(required_for_device_types) : null,
      specifications ? JSON.stringify(specifications) : null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete tool
app.delete('/api/tools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM service_tools WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    res.json({
      success: true,
      message: 'Tool deleted successfully'
    });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get tool assignments
app.get('/api/tools/:id/assignments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        ta.*,
        t.first_name || ' ' || t.last_name as technician_name,
        rc.case_number,
        rc.description as case_description
      FROM tool_assignments ta
      LEFT JOIN technicians t ON ta.assigned_to_technician_id = t.id
      LEFT JOIN repair_cases rc ON ta.assigned_to_case_id = rc.id
      WHERE ta.tool_id = $1
      ORDER BY ta.checkout_date DESC
    `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get tool assignments error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get tool maintenance history
app.get('/api/tools/:id/maintenance', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        tm.*,
        t.first_name || ' ' || t.last_name as performed_by_name
      FROM tool_maintenance tm
      LEFT JOIN technicians t ON tm.performed_by = t.id
      WHERE tm.tool_id = $1
      ORDER BY tm.scheduled_date DESC
    `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get tool maintenance error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Contracts endpoints
app.get('/api/contracts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sc.*,
        c.company_name as customer_name,
        u.full_name as manager_name,
        COUNT(DISTINCT sd.id) as sla_count,
        COUNT(DISTINCT CASE WHEN rc.status IN ('open', 'in_progress') THEN rc.id END) as active_cases,
        0 as visits_used
      FROM service_contracts sc
      LEFT JOIN customers c ON sc.customer_id = c.id
      LEFT JOIN users u ON sc.contract_manager_id = u.id
      LEFT JOIN sla_definitions sd ON sc.id = sd.contract_id
      LEFT JOIN repair_cases rc ON rc.customer_id = sc.customer_id
      GROUP BY sc.id, c.company_name, u.full_name
      ORDER BY sc.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single contract
app.get('/api/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT
        sc.*,
        c.company_name as customer_name,
        c.contact_info as customer_contact,
        u.full_name as manager_name,
        COUNT(DISTINCT sd.id) as sla_count
      FROM service_contracts sc
      LEFT JOIN customers c ON sc.customer_id = c.id
      LEFT JOIN users u ON sc.contract_manager_id = u.id
      LEFT JOIN sla_definitions sd ON sc.id = sd.contract_id
      WHERE sc.id = $1
      GROUP BY sc.id, c.company_name, c.contact_info, u.full_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create contract
app.post('/api/contracts', async (req, res) => {
  try {
    const {
      contract_number,
      customer_id,
      contract_type,
      start_date,
      end_date,
      value,
      currency,
      payment_schedule,
      status,
      covered_devices,
      response_time_hours,
      resolution_time_hours,
      included_services,
      excluded_services,
      annual_visit_quota,
      contract_manager_id,
      renewal_date,
      auto_renew
    } = req.body;

    const result = await pool.query(`
      INSERT INTO service_contracts (
        contract_number, customer_id, contract_type, start_date, end_date,
        value, currency, payment_schedule, status, covered_devices,
        response_time_hours, resolution_time_hours, included_services,
        excluded_services, annual_visit_quota, contract_manager_id,
        renewal_date, auto_renew
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      contract_number, customer_id, contract_type, start_date, end_date,
      value, currency || 'VND', payment_schedule, status || 'draft',
      JSON.stringify(covered_devices || []), response_time_hours,
      resolution_time_hours, JSON.stringify(included_services || []),
      JSON.stringify(excluded_services || []), annual_visit_quota || 0,
      contract_manager_id, renewal_date, auto_renew || false
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update contract
app.put('/api/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      contract_number,
      customer_id,
      contract_type,
      start_date,
      end_date,
      value,
      currency,
      payment_schedule,
      status,
      covered_devices,
      response_time_hours,
      resolution_time_hours,
      included_services,
      excluded_services,
      annual_visit_quota,
      visits_used,
      contract_manager_id,
      renewal_date,
      auto_renew
    } = req.body;

    const result = await pool.query(`
      UPDATE service_contracts
      SET
        contract_number = COALESCE($1, contract_number),
        customer_id = COALESCE($2, customer_id),
        contract_type = COALESCE($3, contract_type),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        value = COALESCE($6, value),
        currency = COALESCE($7, currency),
        payment_schedule = COALESCE($8, payment_schedule),
        status = COALESCE($9, status),
        covered_devices = COALESCE($10, covered_devices),
        response_time_hours = COALESCE($11, response_time_hours),
        resolution_time_hours = COALESCE($12, resolution_time_hours),
        included_services = COALESCE($13, included_services),
        excluded_services = COALESCE($14, excluded_services),
        annual_visit_quota = COALESCE($15, annual_visit_quota),
        visits_used = COALESCE($16, visits_used),
        contract_manager_id = COALESCE($17, contract_manager_id),
        renewal_date = COALESCE($18, renewal_date),
        auto_renew = COALESCE($19, auto_renew),
        updated_at = NOW()
      WHERE id = $20
      RETURNING *
    `, [
      contract_number, customer_id, contract_type, start_date, end_date,
      value, currency, payment_schedule, status,
      covered_devices ? JSON.stringify(covered_devices) : null,
      response_time_hours, resolution_time_hours,
      included_services ? JSON.stringify(included_services) : null,
      excluded_services ? JSON.stringify(excluded_services) : null,
      annual_visit_quota, visits_used, contract_manager_id,
      renewal_date, auto_renew, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update contract error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete contract
app.delete('/api/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM service_contracts WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });
  } catch (error) {
    console.error('Delete contract error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get contract SLAs
app.get('/api/contracts/:id/slas', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT *
      FROM sla_definitions
      WHERE contract_id = $1
      ORDER BY priority, created_at
    `, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get contract SLAs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// CHECKLIST MANAGEMENT ENDPOINTS
// ============================================

// Get all device types with their checklists (unique device types only)
app.get('/api/checklists/devices', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (name, manufacturer, model_series)
        id, name, manufacturer, model_series, category
      FROM device_types
      ORDER BY name, manufacturer, model_series, created_at ASC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get checklist config for a specific document type and device
app.get('/api/checklists/:documentType/:deviceId', async (req, res) => {
  try {
    const { documentType, deviceId } = req.params;

    const result = await pool.query(`
      SELECT
        id,
        name,
        category,
        template_config
      FROM document_types
      WHERE category = $1
    `, [documentType]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document type not found' });
    }

    const docType = result.rows[0];
    const deviceConfig = docType.template_config?.device_specific_checklists?.[deviceId];

    res.json({
      success: true,
      data: {
        document_type_id: docType.id,
        document_type_name: docType.name,
        category: docType.category,
        device_config: deviceConfig || null
      }
    });
  } catch (error) {
    console.error('Get checklist error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update checklist for a specific device and document type
app.put('/api/checklists/:documentType/:deviceId', async (req, res) => {
  try {
    const { documentType, deviceId } = req.params;
    const { checklist, checklistType, deviceName } = req.body;

    // Get current template config
    const result = await pool.query(`
      SELECT id, template_config
      FROM document_types
      WHERE category = $1
    `, [documentType]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document type not found' });
    }

    const docType = result.rows[0];
    let templateConfig = docType.template_config || {};

    // Initialize structure if needed
    if (!templateConfig.device_specific_checklists) {
      templateConfig.device_specific_checklists = {};
    }

    if (!templateConfig.device_specific_checklists[deviceId]) {
      templateConfig.device_specific_checklists[deviceId] = {
        device_name: deviceName || 'Unknown Device'
      };
    }

    // Update the specific checklist type
    templateConfig.device_specific_checklists[deviceId][checklistType] = checklist;

    // Save back to database
    await pool.query(`
      UPDATE document_types
      SET template_config = $1
      WHERE id = $2
    `, [templateConfig, docType.id]);

    res.json({
      success: true,
      message: 'Checklist updated successfully',
      data: {
        checklist,
        checklistType
      }
    });
  } catch (error) {
    console.error('Update checklist error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add spare part to device config
app.post('/api/checklists/:documentType/:deviceId/spare-parts', async (req, res) => {
  try {
    const { documentType, deviceId } = req.params;
    const sparePart = req.body;

    // Get current template config
    const result = await pool.query(`
      SELECT id, template_config
      FROM document_types
      WHERE category = $1
    `, [documentType]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document type not found' });
    }

    const docType = result.rows[0];
    let templateConfig = docType.template_config || {};

    // Initialize structure if needed
    if (!templateConfig.device_specific_checklists) {
      templateConfig.device_specific_checklists = {};
    }

    if (!templateConfig.device_specific_checklists[deviceId]) {
      templateConfig.device_specific_checklists[deviceId] = {
        device_name: sparePart.deviceName || 'Unknown Device',
        common_spare_parts: []
      };
    }

    if (!templateConfig.device_specific_checklists[deviceId].common_spare_parts) {
      templateConfig.device_specific_checklists[deviceId].common_spare_parts = [];
    }

    // Add spare part
    templateConfig.device_specific_checklists[deviceId].common_spare_parts.push(sparePart);

    // Save back to database
    await pool.query(`
      UPDATE document_types
      SET template_config = $1
      WHERE id = $2
    `, [templateConfig, docType.id]);

    res.json({
      success: true,
      message: 'Spare part added successfully',
      data: sparePart
    });
  } catch (error) {
    console.error('Add spare part error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// INVENTORY MANAGEMENT ENDPOINTS
// ============================================
const inventoryRoutes = require('./routes/inventory.routes');
app.use('/api/inventory', inventoryRoutes(pool));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

let server;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`🚀 API Gateway with Database running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🗄️  Database: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}`);
  });
}

module.exports = app;