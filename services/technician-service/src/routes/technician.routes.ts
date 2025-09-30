import { Router } from 'express';
import { TechnicianController } from '../controllers/technician.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();
const technicianController = new TechnicianController();

// Create technician
router.post('/', requirePermission('technician:create'), technicianController.createTechnician);

// Get technician by ID
router.get('/:id', requirePermission('technician:read'), technicianController.getTechnician);

// Get technician by employee ID
router.get('/employee/:employeeId', requirePermission('technician:read'), technicianController.getTechnicianByEmployeeId);

// Update technician
router.put('/:id', requirePermission('technician:update'), technicianController.updateTechnician);

// Search technicians
router.get('/', requirePermission('technician:read'), technicianController.searchTechnicians);

// Get available technicians
router.get('/available/search', requirePermission('technician:read'), technicianController.getAvailableTechnicians);

// Get technician profile (includes skills, performance, workload)
router.get('/:id/profile', requirePermission('technician:read'), technicianController.getTechnicianProfile);

// Get technician summary
router.get('/:id/summary', requirePermission('technician:read'), technicianController.getTechnicianSummary);

// Get team members (technicians supervised by a supervisor)
router.get('/:supervisorId/team', requirePermission('technician:read'), technicianController.getTeamMembers);

// Get technicians by department
router.get('/department/:department', requirePermission('technician:read'), technicianController.getTechniciansByDepartment);

// Get technicians by location
router.get('/location/:location', requirePermission('technician:read'), technicianController.getTechniciansByLocation);

// Validate technician assignment
router.post('/:id/validate-assignment', requirePermission('technician:read'), technicianController.validateTechnicianAssignment);

// Deactivate technician
router.patch('/:id/deactivate', requirePermission('technician:update'), technicianController.deactivateTechnician);

// Reactivate technician
router.patch('/:id/reactivate', requirePermission('technician:update'), technicianController.reactivateTechnician);

// Delete technician
router.delete('/:id', requirePermission('technician:delete'), technicianController.deleteTechnician);

export { router as technicianRoutes };