import { Router } from 'express';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Placeholder routes for skills - will be implemented when skill controller is created
router.get('/:technicianId/skills', requirePermission('technician:skills:read'), (req, res) => {
  res.json({ success: true, data: [], message: 'Skills management coming soon' });
});

router.post('/:technicianId/skills', requirePermission('technician:skills:create'), (req, res) => {
  res.json({ success: true, message: 'Skills management coming soon' });
});

export { router as skillRoutes };