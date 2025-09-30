import { Router } from 'express';
import { DeviceTypeController } from '../controllers/device-type.controller';

export function createDeviceTypeRoutes(deviceTypeController: DeviceTypeController): Router {
  const router = Router();

  // Device Type CRUD operations
  router.post('/', deviceTypeController.createDeviceType);
  router.put('/:id', deviceTypeController.updateDeviceType);
  router.get('/:id', deviceTypeController.getDeviceType);
  router.delete('/:id', deviceTypeController.deleteDeviceType);

  // Device Type listing and search
  router.get('/', deviceTypeController.getAllDeviceTypes);
  router.get('/search', deviceTypeController.searchDeviceTypes);
  router.get('/category/:category', deviceTypeController.getDeviceTypesByCategory);
  router.get('/manufacturer/:manufacturer', deviceTypeController.getDeviceTypesByManufacturer);

  // Specifications and Requirements Management
  router.put('/:id/specifications', deviceTypeController.updateSpecifications);
  router.put('/:id/certifications', deviceTypeController.updateRequiredCertifications);
  router.put('/:id/maintenance-checklist', deviceTypeController.updateMaintenanceChecklist);
  
  router.get('/:id/certifications', deviceTypeController.getRequiredCertifications);
  router.get('/:id/maintenance-checklist', deviceTypeController.getMaintenanceChecklist);
  router.get('/:id/service-hours', deviceTypeController.getStandardServiceHours);

  // Category and Manufacturer Management
  router.get('/meta/categories', deviceTypeController.getCategories);
  router.get('/meta/manufacturers', deviceTypeController.getManufacturers);

  return router;
}