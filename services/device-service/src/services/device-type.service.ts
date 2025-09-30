import { Pool } from 'pg';
import { DeviceType } from '@shared/types/src/device';
import { UUID } from '@shared/types/src/common';
import { DeviceTypeRepository, CreateDeviceTypeRequest, UpdateDeviceTypeRequest } from '../repositories/device-type.repository';

export class DeviceTypeService {
  private deviceTypeRepository: DeviceTypeRepository;

  constructor(db: Pool) {
    this.deviceTypeRepository = new DeviceTypeRepository(db);
  }

  async createDeviceType(request: CreateDeviceTypeRequest): Promise<DeviceType> {
    // Validate required fields
    if (!request.name || !request.category || !request.manufacturer) {
      throw new Error('Name, category, and manufacturer are required');
    }

    if (request.standardServiceHours <= 0) {
      throw new Error('Standard service hours must be greater than 0');
    }

    return this.deviceTypeRepository.create(request);
  }

  async updateDeviceType(id: UUID, request: UpdateDeviceTypeRequest): Promise<DeviceType> {
    const deviceType = await this.deviceTypeRepository.findById(id);
    if (!deviceType) {
      throw new Error(`Device type with ID ${id} not found`);
    }

    if (request.standardServiceHours !== undefined && request.standardServiceHours <= 0) {
      throw new Error('Standard service hours must be greater than 0');
    }

    const updatedDeviceType = await this.deviceTypeRepository.update(id, request);
    if (!updatedDeviceType) {
      throw new Error(`Failed to update device type with ID ${id}`);
    }

    return updatedDeviceType;
  }

  async getDeviceType(id: UUID): Promise<DeviceType> {
    const deviceType = await this.deviceTypeRepository.findById(id);
    if (!deviceType) {
      throw new Error(`Device type with ID ${id} not found`);
    }
    return deviceType;
  }

  async getAllDeviceTypes(): Promise<DeviceType[]> {
    return this.deviceTypeRepository.findAll();
  }

  async getDeviceTypesByCategory(category: string): Promise<DeviceType[]> {
    return this.deviceTypeRepository.findByCategory(category);
  }

  async getDeviceTypesByManufacturer(manufacturer: string): Promise<DeviceType[]> {
    return this.deviceTypeRepository.findByManufacturer(manufacturer);
  }

  async searchDeviceTypes(query: string): Promise<DeviceType[]> {
    return this.deviceTypeRepository.search(query);
  }

  async deleteDeviceType(id: UUID): Promise<void> {
    const deviceType = await this.deviceTypeRepository.findById(id);
    if (!deviceType) {
      throw new Error(`Device type with ID ${id} not found`);
    }

    const deleted = await this.deviceTypeRepository.delete(id);
    if (!deleted) {
      throw new Error(`Failed to delete device type with ID ${id}`);
    }
  }

  // Specifications and Requirements Management
  async updateSpecifications(id: UUID, specifications: Record<string, any>): Promise<DeviceType> {
    return this.updateDeviceType(id, { specifications });
  }

  async updateRequiredCertifications(id: UUID, requiredCertifications: string[]): Promise<DeviceType> {
    return this.updateDeviceType(id, { requiredCertifications });
  }

  async updateMaintenanceChecklist(id: UUID, maintenanceChecklist: any[]): Promise<DeviceType> {
    return this.updateDeviceType(id, { maintenanceChecklist });
  }

  async getRequiredCertifications(id: UUID): Promise<string[]> {
    const deviceType = await this.getDeviceType(id);
    return deviceType.requiredCertifications;
  }

  async getMaintenanceChecklist(id: UUID): Promise<any[]> {
    const deviceType = await this.getDeviceType(id);
    return deviceType.maintenanceChecklist;
  }

  async getStandardServiceHours(id: UUID): Promise<number> {
    const deviceType = await this.getDeviceType(id);
    return deviceType.standardServiceHours;
  }

  // Category Management
  async getCategories(): Promise<string[]> {
    const deviceTypes = await this.getAllDeviceTypes();
    const categories = [...new Set(deviceTypes.map(dt => dt.category))];
    return categories.sort();
  }

  async getManufacturers(): Promise<string[]> {
    const deviceTypes = await this.getAllDeviceTypes();
    const manufacturers = [...new Set(deviceTypes.map(dt => dt.manufacturer))];
    return manufacturers.sort();
  }

  // Validation helpers
  validateSpecifications(specifications: Record<string, any>): boolean {
    // Basic validation - could be extended based on business rules
    return typeof specifications === 'object' && specifications !== null;
  }

  validateMaintenanceChecklist(checklist: any[]): boolean {
    if (!Array.isArray(checklist)) return false;
    
    return checklist.every(item => 
      item &&
      typeof item.id === 'string' &&
      typeof item.description === 'string' &&
      typeof item.category === 'string'
    );
  }

  validateRequiredCertifications(certifications: string[]): boolean {
    return Array.isArray(certifications) && 
           certifications.every(cert => typeof cert === 'string' && cert.length > 0);
  }
}