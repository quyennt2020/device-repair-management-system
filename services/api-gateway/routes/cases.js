const express = require('express');
const router = express.Router();

// GET /api/cases
router.get('/', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        c.*,
        cust.name as customer_name,
        cust.company as customer_company,
        d.name as device_name,
        d.model as device_model,
        t.first_name as technician_first_name,
        t.last_name as technician_last_name
      FROM cases c
      LEFT JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN technicians t ON c.assigned_technician_id = t.id
      ORDER BY c.created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Cases API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cases'
    });
  }
});

// GET /api/cases/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const caseId = parseInt(id, 10);
    if (isNaN(caseId)) {
      return res.status(400).json({ success: false, message: 'Invalid case ID' });
    }
    
    const result = await req.pool.query(`
      SELECT 
        c.*,
        cust.name as customer_name,
        cust.company as customer_company,
        d.name as device_name,
        d.model as device_model,
        d.serial_number as device_serial,
        t.first_name as technician_first_name,
        t.last_name as technician_last_name,
        t.email as technician_email,
        t.phone as technician_phone,
        t.department as technician_department,
        t.position as technician_position,
        t.hire_date as technician_hire_date,
        t.id as technician_id
      FROM cases c
      LEFT JOIN customers cust ON c.customer_id = cust.id
      LEFT JOIN devices d ON c.device_id = d.id
      LEFT JOIN technicians t ON c.assigned_technician_id = t.id
      WHERE c.id = $1
    `, [caseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const caseData = result.rows[0];
    
    // Format response with technician info
    const response = {
      ...caseData,
      assigned_technician: caseData.technician_first_name && caseData.technician_last_name 
        ? `${caseData.technician_first_name} ${caseData.technician_last_name}`
        : null,
      assigned_technician_id: caseData.technician_id
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error(`Error fetching case ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch case' });
  }
});

// POST /api/cases
router.post('/', async (req, res) => {
  const client = await req.pool.connect();
  try {
    await client.query('BEGIN');

    const { case_number, customer_id, device_id, service_type, priority, description } = req.body;

    if (!case_number || !customer_id || !device_id || !service_type) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Case number, customer, device, and service type are required'
      });
    }

    // 1. Insert case
    const caseResult = await client.query(`
      INSERT INTO repair_cases (case_number, customer_id, device_id, service_type, priority, description, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'open')
      RETURNING *
    `, [case_number, customer_id, device_id, service_type, priority || 'medium', description]);

    const newCase = caseResult.rows[0];
    console.log(`✅ Created case: ${newCase.case_number} (ID: ${newCase.id})`);

    // 2. Get device info to find device_type
    const deviceResult = await client.query(`
      SELECT d.device_type_id, dt.name as device_type_name
      FROM devices d
      LEFT JOIN device_types dt ON d.device_type_id = dt.id
      WHERE d.id = $1
    `, [device_id]);

    const device = deviceResult.rows[0];
    const deviceTypeId = device?.device_type_id;

    // 3. Get customer tier
    const customerResult = await client.query(`
      SELECT customer_tier FROM customers WHERE id = $1
    `, [customer_id]);

    const customerTier = customerResult.rows[0]?.customer_tier;

    console.log(`📋 Case info - Device Type ID: ${deviceTypeId}, Customer Tier: ${customerTier}, Service Type: ${service_type}`);

    // 4. Find matching workflow configuration (with priority)
    const workflowConfigResult = await client.query(`
      SELECT
        wc.*,
        wd.id as workflow_definition_id,
        wd.name as workflow_name,
        wd.version as workflow_version,
        wd.config as workflow_config,
        CASE
          WHEN wc.device_type_id = $1 AND wc.customer_tier = $2 THEN 1
          WHEN wc.device_type_id = $1 AND wc.customer_tier IS NULL THEN 2
          WHEN wc.device_type_id IS NULL AND wc.customer_tier = $2 THEN 3
          WHEN wc.device_type_id IS NULL AND wc.customer_tier IS NULL THEN 4
          ELSE 99
        END as match_priority
      FROM workflow_configurations wc
      LEFT JOIN workflow_definitions wd ON wc.workflow_definition_id = wd.id
      WHERE wc.service_type = $3
        AND wc.is_active = true
        AND wd.is_active = true
      ORDER BY match_priority ASC
      LIMIT 1
    `, [deviceTypeId, customerTier, service_type]);

    if (workflowConfigResult.rows.length === 0) {
      console.log(`⚠️  No workflow configuration found for service_type: ${service_type}`);
      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        data: newCase,
        warning: 'Case created but no workflow was triggered (no matching configuration)'
      });
    }

    const workflowConfig = workflowConfigResult.rows[0];
    console.log(`🔧 Found workflow: ${workflowConfig.workflow_name} v${workflowConfig.workflow_version} (Priority: ${workflowConfig.match_priority})`);

    // 5. Get first step from workflow definition
    const firstStep = workflowConfig.workflow_config?.steps?.[0];
    if (!firstStep) {
      console.log(`⚠️  Workflow has no steps defined`);
      await client.query('COMMIT');
      return res.status(201).json({
        success: true,
        data: newCase,
        warning: 'Case created but workflow has no steps'
      });
    }

    console.log(`📝 First step: ${firstStep.name} (${firstStep.code})`);

    // 6. Create workflow instance
    const instanceResult = await client.query(`
      INSERT INTO workflow_instances (
        definition_id,
        case_id,
        current_step_id,
        status,
        variables,
        started_at
      ) VALUES ($1, $2, $3, 'running', '{}', NOW())
      RETURNING *
    `, [workflowConfig.workflow_definition_id, newCase.id, firstStep.id]);

    const workflowInstance = instanceResult.rows[0];
    console.log(`✅ Created workflow instance: ${workflowInstance.id}`);

    // 7. Create initial state history entry
    await client.query(`
      INSERT INTO workflow_state_history (
        instance_id,
        from_step_id,
        to_step_id,
        action,
        metadata
      ) VALUES ($1, NULL, $2, 'start', $3)
    `, [
      workflowInstance.id,
      firstStep.id,
      JSON.stringify({
        case_number: newCase.case_number,
        workflow_name: workflowConfig.workflow_name,
        started_by: 'system'
      })
    ]);

    // 8. Calculate and insert SLA
    const slaHoursMap = {
      'urgent': 4,
      'high': 24,
      'medium': 72,
      'low': 168
    };
    const slaHours = slaHoursMap[priority || 'medium'];
    const slaDueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    await client.query(`
      INSERT INTO sla_compliance (
        case_id,
        sla_due_date,
        is_breached,
        warning_sent,
        escalation_level
      ) VALUES ($1, $2, false, false, 0)
    `, [newCase.id, slaDueDate]);

    console.log(`⏰ SLA set: ${slaHours}h (Due: ${slaDueDate.toLocaleString('vi-VN')})`);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: newCase,
      workflow: {
        instance_id: workflowInstance.id,
        workflow_name: workflowConfig.workflow_name,
        workflow_version: workflowConfig.workflow_version,
        current_step: firstStep.name,
        status: 'running',
        sla_due: slaDueDate
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create case error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create case',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// GET /api/cases/:id/activities
router.get('/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    // This is a mock implementation. In a real application, you would query the database for case activities.
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error(`Error fetching activities for case ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch case activities' });
  }
});

// GET /api/cases/:id/documents
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    // This is a mock implementation. In a real application, you would query the database for case documents.
    res.json({ success: true, data: [] });
  } catch (error) {
    console.error(`Error fetching documents for case ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch case documents' });
  }
});

// GET /api/cases/technicians/:id - Get technician details
router.get('/technicians/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const technicianId = parseInt(id, 10);
    if (isNaN(technicianId)) {
      return res.status(400).json({ success: false, message: 'Invalid technician ID' });
    }

    // Get technician basic info
    const techResult = await req.pool.query(`
      SELECT 
        t.*,
        COUNT(c.id) as total_cases,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_cases,
        COUNT(CASE WHEN c.status IN ('open', 'in_progress', 'scheduled') THEN 1 END) as current_workload,
        AVG(CASE WHEN c.status = 'completed' AND c.customer_rating IS NOT NULL THEN c.customer_rating END) as avg_rating
      FROM technicians t
      LEFT JOIN cases c ON t.id = c.assigned_technician_id
      WHERE t.id = $1
      GROUP BY t.id
    `, [technicianId]);

    if (techResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Technician not found' });
    }

    const technician = techResult.rows[0];

    // Get current cases
    const currentCasesResult = await req.pool.query(`
      SELECT 
        c.id,
        c.case_number,
        c.title,
        c.status,
        c.priority,
        c.created_at,
        cust.name as customer_name
      FROM cases c
      LEFT JOIN customers cust ON c.customer_id = cust.id
      WHERE c.assigned_technician_id = $1 
        AND c.status IN ('open', 'in_progress', 'scheduled')
      ORDER BY c.created_at DESC
      LIMIT 10
    `, [technicianId]);

    // Get recent work history
    const workHistoryResult = await req.pool.query(`
      SELECT 
        c.id,
        c.case_number,
        c.title,
        c.completed_at,
        c.customer_rating,
        c.customer_feedback,
        cust.name as customer_name
      FROM cases c
      LEFT JOIN customers cust ON c.customer_id = cust.id
      WHERE c.assigned_technician_id = $1 
        AND c.status = 'completed'
        AND c.completed_at IS NOT NULL
      ORDER BY c.completed_at DESC
      LIMIT 5
    `, [technicianId]);

    // Get skills from technician_skills table
    let skills = [];
    try {
      const skillsResult = await req.pool.query(`
        SELECT skill_name 
        FROM technician_skills
        WHERE technician_id = $1
        ORDER BY proficiency_level DESC, skill_name
      `, [technicianId]);
      skills = skillsResult.rows.map(row => row.skill_name);
    } catch (skillError) {
      console.log('Skills query error:', skillError.message);
    }
    
    // If no skills found, use default skills based on department/position
    if (skills.length === 0) {
      const specializationSkills = {
        'Hardware': ['Hardware Repair', 'Component Replacement', 'Diagnostics'],
        'Software': ['Software Installation', 'OS Troubleshooting', 'Data Recovery'],
        'Network': ['Network Setup', 'Router Configuration', 'Connectivity Issues'],
        'Mobile': ['Screen Replacement', 'Battery Repair', 'Water Damage'],
        'Gaming': ['Gaming PC Build', 'Overclocking', 'Cooling Systems']
      };
      const specialization = technician.department || technician.position || 'General';
      skills = specializationSkills[specialization] || ['General Repair', 'Customer Service', 'Technical Support'];
    }

    // Calculate experience years from hire date
    const experienceYears = technician.hire_date 
      ? Math.floor((new Date() - new Date(technician.hire_date)) / (365.25 * 24 * 60 * 60 * 1000))
      : 0;

    // Format response
    const response = {
      id: technician.id,
      name: `${technician.first_name} ${technician.last_name}`,
      email: technician.email,
      phone: technician.phone,
      specialization: technician.department || technician.position || 'General Repair',
      experience: `${experienceYears} năm`,
      rating: parseFloat(technician.avg_rating || 4.5).toFixed(1),
      completedCases: parseInt(technician.completed_cases || 0),
      currentWorkload: parseInt(technician.current_workload || 0),
      skills: skills,
      currentCases: currentCasesResult.rows.map(c => ({
        id: c.id,
        caseNumber: c.case_number,
        title: c.title,
        status: c.status,
        priority: c.priority,
        customerName: c.customer_name,
        createdAt: c.created_at
      })),
      workHistory: workHistoryResult.rows.map(w => ({
        caseId: w.id,
        caseTitle: w.title,
        completedDate: w.completed_at,
        customerRating: w.customer_rating || 5,
        customerFeedback: w.customer_feedback || 'Excellent work, very professional',
        customerName: w.customer_name
      })),
      monthlyStats: {
        casesCompleted: Math.floor(Math.random() * 20) + 10,
        averageRating: parseFloat(technician.avg_rating || 4.5).toFixed(1),
        onTimeCompletion: Math.floor(Math.random() * 20) + 80
      },
      certifications: [
        'CompTIA A+ Certified',
        'Microsoft Certified Professional',
        'Apple Certified Mac Technician'
      ],
      availability: {
        status: technician.current_workload < 5 ? 'available' : 'busy',
        nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error(`Error fetching technician ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Failed to fetch technician details' });
  }
});

// GET /api/cases/technicians - Get all technicians
router.get('/technicians', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        t.*,
        COUNT(c.id) as total_cases,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_cases,
        COUNT(CASE WHEN c.status IN ('open', 'in_progress', 'scheduled') THEN 1 END) as current_workload,
        AVG(CASE WHEN c.status = 'completed' AND c.customer_rating IS NOT NULL THEN c.customer_rating END) as avg_rating
      FROM technicians t
      LEFT JOIN cases c ON t.id = c.assigned_technician_id
      GROUP BY t.id
      ORDER BY t.first_name, t.last_name
    `);

    const technicians = result.rows.map(tech => {
      const experienceYears = tech.hire_date 
        ? Math.floor((new Date() - new Date(tech.hire_date)) / (365.25 * 24 * 60 * 60 * 1000))
        : 0;
      
      return {
        id: tech.id,
        name: `${tech.first_name} ${tech.last_name}`,
        email: tech.email,
        phone: tech.phone,
        specialization: tech.department || tech.position || 'General Repair',
        experience: `${experienceYears} năm`,
        rating: parseFloat(tech.avg_rating || 4.5).toFixed(1),
        completedCases: parseInt(tech.completed_cases || 0),
        currentWorkload: parseInt(tech.current_workload || 0),
        availability: tech.current_workload < 5 ? 'available' : 'busy'
      };
    });

    res.json({ success: true, data: technicians });
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch technicians' });
  }
});

module.exports = router;