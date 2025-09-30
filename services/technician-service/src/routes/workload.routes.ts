import { Router } from 'express';
import { WorkloadController } from '../controllers/workload.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();
const workloadController = new WorkloadController();

// Create workload record
router.post('/workload', requirePermission('technician:workload:create'), workloadController.createWorkloadRecord);

// Update workload record
router.put('/workload/:id', requirePermission('technician:workload:update'), workloadController.updateWorkloadRecord);

// Upsert workload record (create or update)
router.post('/workload/upsert', requirePermission('technician:workload:create'), workloadController.upsertWorkloadRecord);

// Get workload record by ID
router.get('/workload/:id', requirePermission('technician:workload:read'), workloadController.getWorkloadRecord);

// Get technician workload for a specific date
router.get('/:technicianId/workload', requirePermission('technician:workload:read'), workloadController.getTechnicianWorkload);

// Get workload by date range
router.get('/workload/range/search', requirePermission('technician:workload:read'), workloadController.getWorkloadByDateRange);

// Get overloaded technicians
router.get('/workload/overloaded/list', requirePermission('technician:workload:read'), workloadController.getOverloadedTechnicians);

// Get workload summary for a technician
router.get('/:technicianId/workload/summary', requirePermission('technician:workload:read'), workloadController.getWorkloadSummary);

// Generate capacity planning report
router.get('/workload/capacity-planning/report', requirePermission('technician:workload:read'), workloadController.generateCapacityPlanningReport);

// Get workload distribution
router.get('/workload/distribution/current', requirePermission('technician:workload:read'), workloadController.getWorkloadDistribution);

// Get workload balancing recommendations
router.get('/workload/balance/recommendations', requirePermission('technician:workload:read'), workloadController.balanceWorkload);

// Delete workload record
router.delete('/workload/:id', requirePermission('technician:workload:delete'), workloadController.deleteWorkloadRecord);

export { router as workloadRoutes };