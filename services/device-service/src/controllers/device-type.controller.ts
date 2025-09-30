import { Request, Response } from 'express';
import { DeviceTypeService } from '../services/device-type.service';
import { createDeviceTypeSchema, updateDeviceTypeSchema } from '../validation/device.validation';

export class DeviceTypeController {
  constructor(private deviceTypeService: DeviceTypeService) {}

  createDeviceType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = createDeviceTypeSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
        return;
      }

      const deviceType = await this.deviceTypeService.createDeviceType(value);
      
      res.status(201).json({
        success: true,
        message: 'Device type created successfully',
        data: deviceType
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  };

  updateDeviceType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { error, value } = updateDeviceTypeSchema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(d => d.message)
        });
        return;
      }

      const deviceType = await this.deviceTypeService.updateDeviceType(id, value);
      
      res.json({
        success: true,
        message: 'Device type updated successfully',
        data: deviceType
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

  getDeviceType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const deviceType = await this.deviceTypeService.getDeviceType(id);
      
      res.json({
        success: true,
        data: deviceType
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

  getAllDeviceTypes = async (req: Request, res: Response): Promise<void> => {
    try {
      const deviceTypes = await this.deviceTypeService.getAllDeviceTypes();
      
      res.json({
        success: true,
        data: deviceTypes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getDeviceTypesByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.params;
      const deviceTypes = await this.deviceTypeService.getDeviceTypesByCategory(category);
      
      res.json({
        success: true,
        data: deviceTypes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getDeviceTypesByManufacturer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { manufacturer } = req.params;
      const deviceTypes = await this.deviceTypeService.getDeviceTypesByManufacturer(manufacturer);
      
      res.json({
        success: true,
        data: deviceTypes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  searchDeviceTypes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
        return;
      }

      const deviceTypes = await this.deviceTypeService.searchDeviceTypes(q);
      
      res.json({
        success: true,
        data: deviceTypes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  deleteDeviceType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.deviceTypeService.deleteDeviceType(id);
      
      res.json({
        success: true,
        message: 'Device type deleted successfully'
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

  // Specifications and Requirements Management
  updateSpecifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { specifications } = req.body;
      
      if (!specifications || typeof specifications !== 'object') {
        res.status(400).json({
          success: false,
          message: 'Valid specifications object is required'
        });
        return;
      }

      const deviceType = await this.deviceTypeService.updateSpecifications(id, specifications);
      
      res.json({
        success: true,
        message: 'Specifications updated successfully',
        data: deviceType
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

  updateRequiredCertifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { requiredCertifications } = req.body;
      
      if (!Array.isArray(requiredCertifications)) {
        res.status(400).json({
          success: false,
          message: 'Required certifications must be an array'
        });
        return;
      }

      const deviceType = await this.deviceTypeService.updateRequiredCertifications(id, requiredCertifications);
      
      res.json({
        success: true,
        message: 'Required certifications updated successfully',
        data: deviceType
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

  updateMaintenanceChecklist = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { maintenanceChecklist } = req.body;
      
      if (!Array.isArray(maintenanceChecklist)) {
        res.status(400).json({
          success: false,
          message: 'Maintenance checklist must be an array'
        });
        return;
      }

      const deviceType = await this.deviceTypeService.updateMaintenanceChecklist(id, maintenanceChecklist);
      
      res.json({
        success: true,
        message: 'Maintenance checklist updated successfully',
        data: deviceType
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

  getRequiredCertifications = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const certifications = await this.deviceTypeService.getRequiredCertifications(id);
      
      res.json({
        success: true,
        data: certifications
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

  getMaintenanceChecklist = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const checklist = await this.deviceTypeService.getMaintenanceChecklist(id);
      
      res.json({
        success: true,
        data: checklist
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

  getStandardServiceHours = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hours = await this.deviceTypeService.getStandardServiceHours(id);
      
      res.json({
        success: true,
        data: { standardServiceHours: hours }
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

  // Category and Manufacturer Management
  getCategories = async (req: Request, res: Response): Promise<void> => {
    try {
      const categories = await this.deviceTypeService.getCategories();
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

  getManufacturers = async (req: Request, res: Response): Promise<void> => {
    try {
      const manufacturers = await this.deviceTypeService.getManufacturers();
      
      res.json({
        success: true,
        data: manufacturers
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };
}