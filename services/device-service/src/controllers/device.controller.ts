import { Request, Response } from 'express';
import { DeviceService } from '../services/device.service';
import { 
  createDeviceSchema, 
  updateDeviceSchema, 
  deviceSearchSchema,
  createDeviceHistorySchema 
} from '../validation/device.validation';

export class DeviceController {
  constructor(private deviceService: DeviceService) {}

  createDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = createDeviceSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
        return;
      }

      const device = await this.deviceService.createDevice(value);
      
      res.status(201).json({
        success: true,
        message: 'Device created successfully',
        data: device
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  updateDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = updateDeviceSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
        return;
      }

      const device = await this.deviceService.updateDevice(id, value);
      
      res.json({
        success: true,
        message: 'Device updated successfully',
        data: device
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  getDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const device = await this.deviceService.getDevice(id);
      
      res.json({
        success: true,
        data: device
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  getDeviceByCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { deviceCode } = req.params;
      const device = await this.deviceService.getDeviceByCode(deviceCode);
      
      res.json({
        success: true,
        data: device
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  getDeviceBySerialNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const { serialNumber } = req.params;
      const device = await this.deviceService.getDeviceBySerialNumber(serialNumber);
      
      res.json({
        success: true,
        data: device
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  searchDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = deviceSearchSchema.validate(req.query);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
        return;
      }

      const { page, limit, ...criteria } = value;
      const result = await this.deviceService.searchDevices(criteria, page, limit);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getDevicesByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const devices = await this.deviceService.getDevicesByCustomer(customerId);
      
      res.json({
        success: true,
        data: devices
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getDevicesByType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { deviceTypeId } = req.params;
      const devices = await this.deviceService.getDevicesByType(deviceTypeId);
      
      res.json({
        success: true,
        data: devices
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  deleteDevice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.deviceService.deleteDevice(id);
      
      res.json({
        success: true,
        message: 'Device deleted successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  // QR Code endpoints
  getQRCodeImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const qrCodeImage = await this.deviceService.getQRCodeImage(id);
      
      res.json({
        success: true,
        data: {
          qrCodeImage
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  getQRCodeSVG = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const qrCodeSVG = await this.deviceService.getQRCodeSVG(id);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(qrCodeSVG);
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  parseQRCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { qrString } = req.body;
      
      if (!qrString) {
        res.status(400).json({
          success: false,
          message: 'QR string is required'
        });
        return;
      }

      const qrData = await this.deviceService.parseQRCode(qrString);
      
      if (!qrData) {
        res.status(400).json({
          success: false,
          message: 'Invalid QR code format'
        });
        return;
      }

      res.json({
        success: true,
        data: qrData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  // Device History endpoints
  addDeviceHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = createDeviceHistorySchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
        return;
      }

      const history = await this.deviceService.addDeviceHistory(value);
      
      res.status(201).json({
        success: true,
        message: 'Device history added successfully',
        data: history
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  getDeviceHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const history = await this.deviceService.getDeviceHistory(id);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getServiceTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const timeline = await this.deviceService.getServiceTimeline(id);
      
      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getPartsReplacementHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const history = await this.deviceService.getPartsReplacementHistory(id);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getDeviceMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const metrics = await this.deviceService.getDeviceMetrics(id);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  // Warranty Management
  updateWarrantyInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { warrantyInfo } = req.body;
      
      if (!warrantyInfo) {
        res.status(400).json({
          success: false,
          message: 'Warranty info is required'
        });
        return;
      }

      const device = await this.deviceService.updateWarrantyInfo(id, warrantyInfo);
      
      res.json({
        success: true,
        message: 'Warranty info updated successfully',
        data: device
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }
  };

  getDevicesWithExpiringWarranty = async (req: Request, res: Response): Promise<void> => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const devices = await this.deviceService.getDevicesWithExpiringWarranty(days);
      
      res.json({
        success: true,
        data: devices
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getDevicesWithExpiredWarranty = async (req: Request, res: Response): Promise<void> => {
    try {
      const devices = await this.deviceService.getDevicesWithExpiredWarranty();
      
      res.json({
        success: true,
        data: devices
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };
}