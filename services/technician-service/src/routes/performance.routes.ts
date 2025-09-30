import { Router } from 'express';
import { PerformanceController } from '../controllers/performance.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();
const performanceController = new PerformanceController();

// Create performance record
router.post('/performance', requirePermission('technician:performance:create'), performanceController.createPerformanceRecord);

// Get performance record by ID
router.get('/performance/:id', requirePermission('technician:performance:read'), performanceController.getPerformanceRecord);

// Update performance record
router.put('/performance/:id', requirePermission('technician:performance:update'), performanceController.updatePerformanceRecord);

// Get technician performance history
router.get('/:technicianId/performance/history', requirePermission('technician:performance:read'), performanceController.getTechnicianPerformanceHistory);

// Get performance metrics for a technician in a period
router.get('/:technicianId/performance/metrics', requirePermission('technician:performance:read'), performanceController.getPerformanceMetrics);

// Get top performers
router.get('/performance/top-performers', requirePermission('technician:performance:read'), performanceController.getTopPerformers);

// Generate performance report
router.get('/:technicianId/performance/report', requirePermission('technician:performance:read'), performanceController.generatePerformanceReport);

// Compare performance between technicians
router.post('/performance/compare', requirePermission('technician:performance:read'), performanceController.comparePerformance);

// Delete performance record
router.delete('/performance/:id', requirePermission('technician:performance:delete'), performanceController.deletePerformanceRecord);

export { router as performanceRoutes };