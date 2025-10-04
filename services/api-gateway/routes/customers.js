const express = require('express');
const router = express.Router();

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const result = await req.pool.query(`
      SELECT 
        c.*,
        COUNT(cases.id) as total_cases,
        COUNT(CASE WHEN cases.status = 'open' THEN 1 END) as open_cases,
        COUNT(CASE WHEN cases.status = 'completed' THEN 1 END) as completed_cases
      FROM customers c
      LEFT JOIN cases ON c.id = cases.customer_id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Customers API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers'
    });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { name, company, email, phone, address, city, tier } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }
    
    const result = await req.app.locals.db.query(`
      INSERT INTO customers (name, company, email, phone, address, city, tier)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, company, email, phone, address, city, tier || 'bronze']);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
});

module.exports = router;