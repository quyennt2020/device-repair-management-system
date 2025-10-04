const express = require('express');
const router = express.Router();

// GET /api/devices
router.get('/', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        d.*,
        c.name as customer_name,
        c.company as customer_company,
        COUNT(cases.id) as total_cases,
        COUNT(CASE WHEN cases.status = 'open' THEN 1 END) as open_cases
      FROM devices d
      LEFT JOIN customers c ON d.customer_id = c.id
      LEFT JOIN cases ON d.id = cases.device_id
      WHERE d.is_active = true
      GROUP BY d.id, c.name, c.company
      ORDER BY d.created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Devices API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices'
    });
  }
});

module.exports = router;