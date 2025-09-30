import { Router } from 'express';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Placeholder routes for certifications - will be implemented when certification controller is created
router.get('/:technicianId/certifications', requirePermission('technician:certifications:read'), (req, res) => {
  res.json({ success: true, data: [], message: 'Certification management coming soon' });
});

router.post('/:technicianId/certifications', requirePermission('technician:certifications:create'), (req, res) => {
  res.json({ success: true, message: 'Certification management coming soon' });
});

export { router as certificationRoutes };