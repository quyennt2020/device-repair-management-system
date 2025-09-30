import { Router } from 'express';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Placeholder routes for schedule - will be implemented when schedule controller is created
router.get('/:technicianId/schedule', requirePermission('technician:schedule:read'), (req, res) => {
  res.json({ success: true, data: [], message: 'Schedule management coming soon' });
});

router.post('/:technicianId/schedule', requirePermission('technician:schedule:create'), (req, res) => {
  res.json({ success: true, message: 'Schedule management coming soon' });
});

export { router as scheduleRoutes };