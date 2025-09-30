import { Router } from 'express';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Placeholder routes for availability - will be implemented when availability controller is created
router.get('/:technicianId/availability', requirePermission('technician:availability:read'), (req, res) => {
  res.json({ success: true, data: [], message: 'Availability management coming soon' });
});

router.post('/:technicianId/availability', requirePermission('technician:availability:create'), (req, res) => {
  res.json({ success: true, message: 'Availability management coming soon' });
});

export { router as availabilityRoutes };