const express = require('express');
const router = express.Router();

module.exports = (pool) => {
  // ============================================
  // SPARE PARTS ENDPOINTS
  // ============================================

  // Get all spare parts
  router.get('/spare-parts', async (req, res) => {
    try {
      const { category, status, search } = req.query;

      let query = `
        SELECT sp.*,
          COALESCE(SUM(pi.quantity_available), 0) as total_quantity,
          COALESCE(SUM(pi.quantity_reserved), 0) as total_reserved,
          COUNT(DISTINCT pi.warehouse_id) as warehouse_count
        FROM spare_parts sp
        LEFT JOIN part_inventory pi ON sp.id = pi.spare_part_id
        WHERE sp.deleted_at IS NULL
      `;

      const params = [];
      let paramIndex = 1;

      if (category) {
        query += ` AND sp.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (status) {
        query += ` AND sp.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (search) {
        query += ` AND (sp.part_name ILIKE $${paramIndex} OR sp.part_number ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      query += ` GROUP BY sp.id ORDER BY sp.part_name`;

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get spare parts error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get spare part by ID
  router.get('/spare-parts/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT sp.*,
          json_agg(
            json_build_object(
              'warehouse_id', w.id,
              'warehouse_name', w.warehouse_name,
              'warehouse_code', w.warehouse_code,
              'quantity_available', pi.quantity_available,
              'quantity_reserved', pi.quantity_reserved,
              'quantity_on_order', pi.quantity_on_order,
              'minimum_stock', pi.minimum_stock,
              'maximum_stock', pi.maximum_stock,
              'location_bin', pi.location_bin
            )
          ) FILTER (WHERE pi.id IS NOT NULL) as inventory_by_warehouse
        FROM spare_parts sp
        LEFT JOIN part_inventory pi ON sp.id = pi.spare_part_id
        LEFT JOIN warehouses w ON pi.warehouse_id = w.id
        WHERE sp.id = $1 AND sp.deleted_at IS NULL
        GROUP BY sp.id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Spare part not found' });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get spare part error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create spare part
  router.post('/spare-parts', async (req, res) => {
    try {
      const {
        part_number,
        part_name,
        category,
        manufacturer,
        specifications,
        compatible_devices,
        pricing_info,
        inventory_settings,
        status = 'active'
      } = req.body;

      const result = await pool.query(`
        INSERT INTO spare_parts (
          part_number, part_name, category, manufacturer,
          specifications, compatible_devices, pricing_info,
          inventory_settings, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        part_number,
        part_name,
        category,
        manufacturer,
        JSON.stringify(specifications || {}),
        JSON.stringify(compatible_devices || []),
        JSON.stringify(pricing_info),
        JSON.stringify(inventory_settings),
        status
      ]);

      res.status(201).json({
        success: true,
        message: 'Spare part created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create spare part error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update spare part
  router.put('/spare-parts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        part_number,
        part_name,
        category,
        manufacturer,
        specifications,
        compatible_devices,
        pricing_info,
        inventory_settings,
        status
      } = req.body;

      const result = await pool.query(`
        UPDATE spare_parts
        SET
          part_number = $1,
          part_name = $2,
          category = $3,
          manufacturer = $4,
          specifications = $5,
          compatible_devices = $6,
          pricing_info = $7,
          inventory_settings = $8,
          status = $9,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10 AND deleted_at IS NULL
        RETURNING *
      `, [
        part_number,
        part_name,
        category,
        manufacturer,
        specifications ? JSON.stringify(specifications) : '{}',
        compatible_devices ? JSON.stringify(compatible_devices) : '[]',
        pricing_info ? JSON.stringify(pricing_info) : '{}',
        inventory_settings ? JSON.stringify(inventory_settings) : '{}',
        status,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Spare part not found' });
      }

      res.json({
        success: true,
        message: 'Spare part updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update spare part error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Delete spare part (soft delete)
  router.delete('/spare-parts/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        UPDATE spare_parts
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Spare part not found' });
      }

      res.json({
        success: true,
        message: 'Spare part deleted successfully'
      });
    } catch (error) {
      console.error('Delete spare part error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================
  // WAREHOUSES ENDPOINTS
  // ============================================

  // Get all warehouses
  router.get('/warehouses', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT w.*,
          COUNT(DISTINCT pi.spare_part_id) as parts_count,
          COALESCE(SUM(pi.quantity_available), 0) as total_items
        FROM warehouses w
        LEFT JOIN part_inventory pi ON w.id = pi.warehouse_id
        WHERE w.deleted_at IS NULL
        GROUP BY w.id
        ORDER BY w.warehouse_name
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get warehouses error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get warehouse by ID
  router.get('/warehouses/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT * FROM warehouses
        WHERE id = $1 AND deleted_at IS NULL
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Warehouse not found' });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get warehouse error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create warehouse
  router.post('/warehouses', async (req, res) => {
    try {
      const {
        warehouse_name,
        warehouse_code,
        location,
        manager_id,
        status = 'active'
      } = req.body;

      const result = await pool.query(`
        INSERT INTO warehouses (
          warehouse_name, warehouse_code, location, manager_id, status
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [warehouse_name, warehouse_code, location, manager_id, status]);

      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Create warehouse error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================
  // PART INVENTORY ENDPOINTS
  // ============================================

  // Get inventory for a specific warehouse
  router.get('/warehouses/:warehouseId/inventory', async (req, res) => {
    try {
      const { warehouseId } = req.params;

      const result = await pool.query(`
        SELECT pi.*, sp.part_number, sp.part_name, sp.category, sp.pricing_info
        FROM part_inventory pi
        JOIN spare_parts sp ON pi.spare_part_id = sp.id
        WHERE pi.warehouse_id = $1
        ORDER BY sp.part_name
      `, [warehouseId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get warehouse inventory error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Add part to warehouse inventory
  router.post('/warehouses/:warehouseId/inventory', async (req, res) => {
    try {
      const { warehouseId } = req.params;
      const {
        spare_part_id,
        quantity_available = 0,
        quantity_reserved = 0,
        quantity_on_order = 0,
        minimum_stock = 0,
        maximum_stock = 1000,
        location_bin
      } = req.body;

      // Check if part already exists in this warehouse
      const existing = await pool.query(`
        SELECT id FROM part_inventory
        WHERE spare_part_id = $1 AND warehouse_id = $2
      `, [spare_part_id, warehouseId]);

      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Part already exists in this warehouse. Use PUT to update.'
        });
      }

      const result = await pool.query(`
        INSERT INTO part_inventory (
          spare_part_id, warehouse_id, quantity_available,
          quantity_reserved, quantity_on_order, minimum_stock,
          maximum_stock, location_bin
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        spare_part_id,
        warehouseId,
        quantity_available,
        quantity_reserved,
        quantity_on_order,
        minimum_stock,
        maximum_stock,
        location_bin
      ]);

      res.status(201).json({
        success: true,
        message: 'Part added to warehouse inventory',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Add part to warehouse error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Update inventory levels
  router.put('/inventory/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        quantity_available,
        quantity_reserved,
        quantity_on_order,
        minimum_stock,
        maximum_stock,
        location_bin
      } = req.body;

      const result = await pool.query(`
        UPDATE part_inventory
        SET
          quantity_available = $1,
          quantity_reserved = $2,
          quantity_on_order = $3,
          minimum_stock = $4,
          maximum_stock = $5,
          location_bin = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
      `, [
        quantity_available,
        quantity_reserved,
        quantity_on_order,
        minimum_stock,
        maximum_stock,
        location_bin,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Inventory record not found' });
      }

      res.json({
        success: true,
        message: 'Inventory updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Update inventory error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================
  // INVENTORY TRANSACTIONS ENDPOINTS
  // ============================================

  // Get all transactions
  router.get('/transactions', async (req, res) => {
    try {
      const { spare_part_id, warehouse_id, type, limit = 50 } = req.query;

      let query = `
        SELECT
          it.*,
          it.reference_id as reference_number,
          it.transaction_date as created_at,
          sp.part_name,
          sp.part_number,
          w.warehouse_name
        FROM inventory_transactions it
        LEFT JOIN spare_parts sp ON it.spare_part_id = sp.id
        LEFT JOIN warehouses w ON it.warehouse_id = w.id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (spare_part_id) {
        query += ` AND it.spare_part_id = $${paramIndex}`;
        params.push(spare_part_id);
        paramIndex++;
      }

      if (warehouse_id) {
        query += ` AND it.warehouse_id = $${paramIndex}`;
        params.push(warehouse_id);
        paramIndex++;
      }

      if (type) {
        query += ` AND it.transaction_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      query += ` ORDER BY it.transaction_date DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Create transaction (stock in/out/transfer/adjustment)
  router.post('/transactions', async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        spare_part_id,
        warehouse_id,
        to_warehouse_id, // Only for TRANSFER
        transaction_type, // 'in', 'out', 'adjustment', 'transfer'
        quantity,
        unit_cost,
        reference_number,
        reference_type,
        notes,
        performed_by
      } = req.body;

      // Validate transaction type
      const validTypes = ['in', 'out', 'adjustment', 'transfer'];
      if (!validTypes.includes(transaction_type)) {
        throw new Error(`Invalid transaction type: ${transaction_type}`);
      }

      // Validate quantity - must not be negative for IN, OUT, TRANSFER
      // ADJUSTMENT can be negative
      if (transaction_type !== 'adjustment' && quantity < 0) {
        throw new Error('Số lượng không được âm');
      }

      if (transaction_type !== 'adjustment' && quantity === 0) {
        throw new Error('Số lượng phải lớn hơn 0');
      }

      // Convert reference_number to UUID if valid
      let reference_id = null;
      if (reference_number) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(reference_number)) {
          reference_id = reference_number;
        }
      }

      // ==================== TRANSFER LOGIC ====================
      if (transaction_type === 'transfer') {
        if (!to_warehouse_id) {
          throw new Error('Chuyển kho cần có kho đích (to_warehouse_id)');
        }

        if (warehouse_id === to_warehouse_id) {
          throw new Error('Kho nguồn và kho đích không được trùng nhau');
        }

        // Check source warehouse has enough stock
        const sourceCheck = await client.query(`
          SELECT quantity_available FROM part_inventory
          WHERE spare_part_id = $1 AND warehouse_id = $2
        `, [spare_part_id, warehouse_id]);

        if (sourceCheck.rows.length === 0) {
          throw new Error('Không thể chuyển kho: Linh kiện không tồn tại trong kho nguồn');
        }

        if (sourceCheck.rows[0].quantity_available < quantity) {
          throw new Error(`Không đủ số lượng để chuyển. Tồn kho nguồn: ${sourceCheck.rows[0].quantity_available}, yêu cầu: ${quantity}`);
        }

        // Create OUT transaction from source warehouse
        await client.query(`
          INSERT INTO inventory_transactions (
            spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id,
            notes, performed_by, created_by
          )
          VALUES ($1, $2, 'transfer_out', $3, $4, $5, $6, $7, $8, $8)
        `, [spare_part_id, warehouse_id, quantity, unit_cost,
            reference_type, reference_id, notes, performed_by]);

        // Create IN transaction to destination warehouse
        await client.query(`
          INSERT INTO inventory_transactions (
            spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id,
            notes, performed_by, created_by
          )
          VALUES ($1, $2, 'transfer_in', $3, $4, $5, $6, $7, $8, $8)
        `, [spare_part_id, to_warehouse_id, quantity, unit_cost,
            reference_type, reference_id, notes, performed_by]);

        // Update source warehouse (subtract)
        await client.query(`
          UPDATE part_inventory
          SET quantity_available = quantity_available - $1, updated_at = CURRENT_TIMESTAMP
          WHERE spare_part_id = $2 AND warehouse_id = $3
        `, [quantity, spare_part_id, warehouse_id]);

        // Update destination warehouse (add or create)
        await client.query(`
          INSERT INTO part_inventory (
            spare_part_id, warehouse_id, quantity_available,
            quantity_reserved, quantity_on_order, minimum_stock, maximum_stock
          )
          VALUES ($1, $2, $3, 0, 0, 0, 1000)
          ON CONFLICT (spare_part_id, warehouse_id)
          DO UPDATE SET
            quantity_available = part_inventory.quantity_available + $3,
            updated_at = CURRENT_TIMESTAMP
        `, [spare_part_id, to_warehouse_id, quantity]);

        await client.query('COMMIT');

        return res.status(201).json({
          success: true,
          message: `Đã chuyển ${quantity} linh kiện từ kho nguồn sang kho đích`,
          data: { transaction_type: 'transfer', quantity, from: warehouse_id, to: to_warehouse_id }
        });
      }

      // ==================== IN LOGIC ====================
      if (transaction_type === 'in') {
        // Create transaction record
        const txResult = await client.query(`
          INSERT INTO inventory_transactions (
            spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id,
            notes, performed_by, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
          RETURNING *
        `, [spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id, notes, performed_by]);

        // UPSERT inventory (create if not exists)
        await client.query(`
          INSERT INTO part_inventory (
            spare_part_id, warehouse_id, quantity_available,
            quantity_reserved, quantity_on_order, minimum_stock, maximum_stock
          )
          VALUES ($1, $2, $3, 0, 0, 0, 1000)
          ON CONFLICT (spare_part_id, warehouse_id)
          DO UPDATE SET
            quantity_available = part_inventory.quantity_available + $3,
            updated_at = CURRENT_TIMESTAMP
        `, [spare_part_id, warehouse_id, quantity]);

        await client.query('COMMIT');

        return res.status(201).json({
          success: true,
          message: 'Nhập kho thành công',
          data: txResult.rows[0]
        });
      }

      // ==================== OUT LOGIC ====================
      if (transaction_type === 'out') {
        // Check inventory exists and has enough stock
        const checkInventory = await client.query(`
          SELECT quantity_available FROM part_inventory
          WHERE spare_part_id = $1 AND warehouse_id = $2
        `, [spare_part_id, warehouse_id]);

        if (checkInventory.rows.length === 0) {
          throw new Error('Không thể xuất kho: Linh kiện không tồn tại trong kho này');
        }

        if (checkInventory.rows[0].quantity_available < quantity) {
          throw new Error(`Không đủ số lượng để xuất. Tồn kho: ${checkInventory.rows[0].quantity_available}, yêu cầu: ${quantity}`);
        }

        // Create transaction record
        const txResult = await client.query(`
          INSERT INTO inventory_transactions (
            spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id,
            notes, performed_by, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
          RETURNING *
        `, [spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id, notes, performed_by]);

        // Update inventory (subtract)
        await client.query(`
          UPDATE part_inventory
          SET quantity_available = quantity_available - $1, updated_at = CURRENT_TIMESTAMP
          WHERE spare_part_id = $2 AND warehouse_id = $3
        `, [quantity, spare_part_id, warehouse_id]);

        await client.query('COMMIT');

        return res.status(201).json({
          success: true,
          message: 'Xuất kho thành công',
          data: txResult.rows[0]
        });
      }

      // ==================== ADJUSTMENT LOGIC ====================
      if (transaction_type === 'adjustment') {
        // Check if inventory exists
        const checkInventory = await client.query(`
          SELECT quantity_available FROM part_inventory
          WHERE spare_part_id = $1 AND warehouse_id = $2
        `, [spare_part_id, warehouse_id]);

        if (checkInventory.rows.length === 0) {
          throw new Error('Không thể điều chỉnh: Linh kiện không tồn tại trong kho này');
        }

        const currentQty = checkInventory.rows[0].quantity_available;
        const newQty = currentQty + quantity; // quantity can be positive or negative

        if (newQty < 0) {
          throw new Error(`Điều chỉnh không hợp lệ. Tồn kho hiện tại: ${currentQty}, điều chỉnh: ${quantity > 0 ? '+' : ''}${quantity}, kết quả: ${newQty}`);
        }

        // Create transaction record
        const txResult = await client.query(`
          INSERT INTO inventory_transactions (
            spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id,
            notes, performed_by, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
          RETURNING *
        `, [spare_part_id, warehouse_id, transaction_type, quantity,
            unit_cost, reference_type, reference_id, notes, performed_by]);

        // Update inventory (add or subtract based on quantity sign)
        await client.query(`
          UPDATE part_inventory
          SET quantity_available = quantity_available + $1, updated_at = CURRENT_TIMESTAMP
          WHERE spare_part_id = $2 AND warehouse_id = $3
        `, [quantity, spare_part_id, warehouse_id]);

        await client.query('COMMIT');

        return res.status(201).json({
          success: true,
          message: `Điều chỉnh kho thành công (${quantity > 0 ? '+' : ''}${quantity})`,
          data: txResult.rows[0]
        });
      }

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create transaction error:', error);
      res.status(500).json({ success: false, message: error.message });
    } finally {
      client.release();
    }
  });

  // ============================================
  // LOW STOCK ALERTS
  // ============================================

  router.get('/alerts/low-stock', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          sp.id,
          sp.part_number,
          sp.part_name,
          sp.category,
          pi.warehouse_id,
          w.warehouse_name,
          pi.quantity_available,
          pi.minimum_stock,
          pi.quantity_reserved,
          sp.inventory_settings->'reorder_quantity' as reorder_quantity,
          sp.inventory_settings->'reorder_level' as reorder_level
        FROM part_inventory pi
        JOIN spare_parts sp ON pi.spare_part_id = sp.id
        JOIN warehouses w ON pi.warehouse_id = w.id
        WHERE sp.deleted_at IS NULL
          AND pi.quantity_available <= pi.minimum_stock
        ORDER BY (pi.quantity_available::float / NULLIF(pi.minimum_stock, 0)) ASC
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get low stock alerts error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================
  // INVENTORY SUMMARY/STATS
  // ============================================

  router.get('/stats/summary', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(DISTINCT sp.id) as total_parts,
          COUNT(DISTINCT w.id) as total_warehouses,
          COALESCE(SUM(pi.quantity_available), 0) as total_items,
          COALESCE(SUM(pi.quantity_reserved), 0) as total_reserved,
          COALESCE(SUM(
            (pi.quantity_available::numeric * (sp.pricing_info->>'unit_cost')::numeric)
          ), 0) as total_value,
          COUNT(DISTINCT CASE
            WHEN pi.quantity_available <= pi.minimum_stock THEN pi.id
          END) as low_stock_count
        FROM spare_parts sp
        LEFT JOIN part_inventory pi ON sp.id = pi.spare_part_id
        LEFT JOIN warehouses w ON pi.warehouse_id = w.id
        WHERE sp.deleted_at IS NULL
      `);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Get inventory stats error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ============================================
  // CASE PART USAGE ENDPOINTS
  // ============================================

  // Get parts used in a case
  router.get('/cases/:caseId/parts', async (req, res) => {
    try {
      const { caseId } = req.params;

      // Check if caseId is UUID or case number
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let actualCaseId = caseId;

      if (!uuidRegex.test(caseId)) {
        // It's a case number, need to look up the UUID
        const caseResult = await pool.query(
          'SELECT id FROM repair_cases WHERE case_number = $1',
          [caseId]
        );

        if (caseResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Case not found' });
        }

        actualCaseId = caseResult.rows[0].id;
      }

      const result = await pool.query(`
        SELECT
          cpu.*,
          sp.part_name,
          sp.part_number,
          sp.category,
          sp.manufacturer
        FROM case_part_usage cpu
        JOIN spare_parts sp ON cpu.spare_part_id = sp.id
        WHERE cpu.repair_case_id = $1
        ORDER BY cpu.created_at DESC
      `, [actualCaseId]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Get case parts error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Add part to case (with automatic inventory OUT transaction)
  router.post('/cases/:caseId/parts', async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { caseId } = req.params;

      // Check if caseId is UUID or case number
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let actualCaseId = caseId;

      if (!uuidRegex.test(caseId)) {
        // It's a case number, need to look up the UUID
        const caseResult = await client.query(
          'SELECT id FROM repair_cases WHERE case_number = $1',
          [caseId]
        );

        if (caseResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Case not found' });
        }

        actualCaseId = caseResult.rows[0].id;
      }
      const {
        spare_part_id,
        warehouse_id,
        quantity_used,
        unit_cost,
        total_cost,
        warranty_months = 12,
        installation_date,
        technician_id,
        old_part_serial,
        new_part_serial,
        return_old_part = false,
        performed_by
      } = req.body;

      // Validate required fields
      if (!spare_part_id || !warehouse_id || !quantity_used) {
        throw new Error('spare_part_id, warehouse_id và quantity_used là bắt buộc');
      }

      // Check inventory availability
      const inventoryCheck = await client.query(`
        SELECT quantity_available
        FROM part_inventory
        WHERE spare_part_id = $1 AND warehouse_id = $2
      `, [spare_part_id, warehouse_id]);

      if (inventoryCheck.rows.length === 0) {
        throw new Error('Linh kiện không tồn tại trong kho này');
      }

      if (inventoryCheck.rows[0].quantity_available < quantity_used) {
        throw new Error(`Không đủ số lượng. Tồn kho: ${inventoryCheck.rows[0].quantity_available}, yêu cầu: ${quantity_used}`);
      }

      // Create case_part_usage record
      const casePartResult = await client.query(`
        INSERT INTO case_part_usage (
          repair_case_id, spare_part_id, quantity_used, unit_cost, total_cost,
          warranty_months, installation_date, technician_id,
          old_part_serial, new_part_serial, return_old_part
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        actualCaseId, spare_part_id, quantity_used, unit_cost, total_cost,
        warranty_months, installation_date, technician_id,
        old_part_serial, new_part_serial, return_old_part
      ]);

      // Create OUT transaction (automatic inventory deduction)
      await client.query(`
        INSERT INTO inventory_transactions (
          spare_part_id, warehouse_id, transaction_type, quantity,
          unit_cost, reference_type, reference_id,
          notes, performed_by, created_by
        )
        VALUES ($1, $2, 'out', $3, $4, 'repair_case', $5, $6, $7, $7)
      `, [
        spare_part_id,
        warehouse_id,
        quantity_used,
        unit_cost,
        actualCaseId,
        `Sử dụng trong case - Serial cũ: ${old_part_serial || 'N/A'}, mới: ${new_part_serial || 'N/A'}`,
        performed_by
      ]);

      // Update inventory (subtract quantity)
      await client.query(`
        UPDATE part_inventory
        SET quantity_available = quantity_available - $1, updated_at = CURRENT_TIMESTAMP
        WHERE spare_part_id = $2 AND warehouse_id = $3
      `, [quantity_used, spare_part_id, warehouse_id]);

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: `Đã thêm ${quantity_used} linh kiện vào case và tự động xuất kho`,
        data: casePartResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Add part to case error:', error);
      res.status(500).json({ success: false, message: error.message });
    } finally {
      client.release();
    }
  });

  // Delete part from case (rollback inventory)
  router.delete('/cases/:caseId/parts/:partUsageId', async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { caseId, partUsageId } = req.params;
      const { performed_by, warehouse_id } = req.body;

      // Check if caseId is UUID or case number
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let actualCaseId = caseId;

      if (!uuidRegex.test(caseId)) {
        // It's a case number, need to look up the UUID
        const caseResult = await client.query(
          'SELECT id FROM repair_cases WHERE case_number = $1',
          [caseId]
        );

        if (caseResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Case not found' });
        }

        actualCaseId = caseResult.rows[0].id;
      }

      // Get part usage info before deleting
      const partUsage = await client.query(`
        SELECT * FROM case_part_usage
        WHERE id = $1 AND repair_case_id = $2
      `, [partUsageId, actualCaseId]);

      if (partUsage.rows.length === 0) {
        throw new Error('Không tìm thấy part usage record');
      }

      const { spare_part_id, quantity_used, unit_cost } = partUsage.rows[0];

      if (!warehouse_id) {
        throw new Error('warehouse_id là bắt buộc để rollback inventory');
      }

      // Delete part usage record
      await client.query(`
        DELETE FROM case_part_usage WHERE id = $1
      `, [partUsageId]);

      // Create IN transaction (rollback - return to inventory)
      await client.query(`
        INSERT INTO inventory_transactions (
          spare_part_id, warehouse_id, transaction_type, quantity,
          unit_cost, reference_type, reference_id,
          notes, performed_by, created_by
        )
        VALUES ($1, $2, 'in', $3, $4, 'case_rollback', $5, $6, $7, $7)
      `, [
        spare_part_id,
        warehouse_id,
        quantity_used,
        unit_cost,
        actualCaseId,
        'Hoàn trả do xóa khỏi case',
        performed_by
      ]);

      // Update inventory (add quantity back)
      await client.query(`
        UPDATE part_inventory
        SET quantity_available = quantity_available + $1, updated_at = CURRENT_TIMESTAMP
        WHERE spare_part_id = $2 AND warehouse_id = $3
      `, [quantity_used, spare_part_id, warehouse_id]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Đã xóa part khỏi case và hoàn trả ${quantity_used} vào kho`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Delete part from case error:', error);
      res.status(500).json({ success: false, message: error.message });
    } finally {
      client.release();
    }
  });

  return router;
};
