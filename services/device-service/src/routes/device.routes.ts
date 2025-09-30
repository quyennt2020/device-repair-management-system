import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller';

export function createDeviceRoutes(deviceController: DeviceController): Router {
  const router = Router();

  // Device CRUD operations
  router.post('/', deviceController.createDevice);
  router.put('/:id', deviceController.updateDevice);
  router.get('/:id', deviceController.getDevice);
  router.delete('/:id', deviceController.deleteDevice);

  // Device search and filtering
  router.get('/', deviceController.searchDevices);
  router.get('/code/:deviceCode', deviceController.getDeviceByCode);
  router.get('/serial/:serialNumber', deviceController.getDeviceBySerialNumber);
  router.get('/customer/:customerId', deviceController.getDevicesByCustomer);
  router.get('/type/:deviceTypeId', deviceController.getDevicesByType);

  // QR Code management
  router.get('/:id/qr-code/image', deviceController.getQRCodeImage);
  router.get('/:id/qr-code/svg', deviceController.getQRCodeSVG);
  router.post('/qr-code/parse', deviceController.parseQRCode);

  // Device History and Timeline
  router.post('/history', deviceController.addDeviceHistory);
  router.get('/:id/history', deviceController.getDeviceHistory);
  router.get('/:id/timeline', deviceController.getServiceTimeline);
  router.get('/:id/parts-history', deviceController.getPartsReplacementHistory);
  router.get('/:id/metrics', deviceController.getDeviceMetrics);

  // Warranty Management
  router.put('/:id/warranty', deviceController.updateWarrantyInfo);
  router.get('/warranty/expiring', deviceController.getDevicesWithExpiringWarranty);
  router.get('/warranty/expired', deviceController.getDevicesWithExpiredWarranty);

  return router;
}