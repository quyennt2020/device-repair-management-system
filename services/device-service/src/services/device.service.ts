import { Pool } from 'pg';
import { 
  Device, 
  DeviceType,
  DeviceHistory,
  CreateDeviceRequest, 
  UpdateDeviceRequest, 
  DeviceSearchCriteria, 
  DeviceSearchResult,
  DeviceQRCodeData,
  DeviceEventType,
  DevicePartUsage
} from '@shared/types/src/device';
import { UUID } from '@shared/types/src/common';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceTypeRepository } from '../repositories/device-type.repository';
import { DeviceHistoryRepository, CreateDeviceHistoryRequest } from '../repositories/device-history.repository';
import { QRCodeService } from './qr-code.service';

export class DeviceService {
  private deviceRepository: DeviceRepository;
  private deviceTypeRepository: DeviceTypeRepository;
  private deviceHistoryRepository: DeviceHistoryRepository;
  private qrCodeService: QRCodeService;

  constructor(db: Pool) {
    this.deviceRepository = new DeviceRepository(db);
    this.deviceTypeRepository = new DeviceTypeRepository(db);
    this.deviceHistoryRepository = new DeviceHistoryRepository(db);
    this.qrCodeService = new QRCodeService();
  }

  // Device Management
  async createDevice(request: CreateDeviceRequest): Promise<Device> {
    // Check if device code already exists
    const existingByCode = await this.deviceRepository.findByDeviceCode(request.deviceCode);
    if (existingByCode) {
      throw new Error(`Device with code ${request.deviceCode} already exists`);
    }

    // Check if serial number already exists
    const existingBySerial = await this.deviceRepository.findBySerialNumber(request.serialNumber);
    if (existingBySerial) {
      throw new Error(`Device with serial number ${request.serialNumber} already exists`);
    }

    // Verify device type exists
    const deviceType = await this.deviceTypeRepository.findById(request.deviceTypeId);
    if (!deviceType) {
      throw new Error(`Device type with ID ${request.deviceTypeId} not found`);
    }

    // Create device
    const device = await this.deviceRepository.create(request);

    // Generate and store QR code
    await this.generateAndStoreQRCode(device);

    // Create initial history entry
    await this.deviceHistoryRepository.create({
      deviceId: device.id,
      eventType: 'installation',
      eventDate: new Date(),
      description: `Device ${device.deviceCode} registered and installed`,
      performedBy: undefined // Could be passed from request context
    });

    return device;
  }

  async updateDevice(id: UUID, request: UpdateDeviceRequest): Promise<Device> {
    const device = await this.deviceRepository.findById(id);
    if (!device) {
      throw new Error(`Device with ID ${id} not found`);
    }

    const updatedDevice = await this.deviceRepository.update(id, request);
    if (!updatedDevice) {
      throw new Error(`Failed to update device with ID ${id}`);
    }

    // Create history entry for significant changes
    if (request.status && request.status !== device.status) {
      await this.deviceHistoryRepository.create({
        deviceId: id,
        eventType: this.getEventTypeFromStatus(request.status),
        eventDate: new Date(),
        description: `Device status changed from ${device.status} to ${request.status}`,
        performedBy: undefined // Could be passed from request context
      });
    }

    return updatedDevice;
  }

  async getDevice(id: UUID): Promise<Device> {
    const device = await this.deviceRepository.findById(id);
    if (!device) {
      throw new Error(`Device with ID ${id} not found`);
    }
    return device;
  }

  async getDeviceByCode(deviceCode: string): Promise<Device> {
    const device = await this.deviceRepository.findByDeviceCode(deviceCode);
    if (!device) {
      throw new Error(`Device with code ${deviceCode} not found`);
    }
    return device;
  }

  async getDeviceBySerialNumber(serialNumber: string): Promise<Device> {
    const device = await this.deviceRepository.findBySerialNumber(serialNumber);
    if (!device) {
      throw new Error(`Device with serial number ${serialNumber} not found`);
    }
    return device;
  }

  async getDeviceByQRCode(qrCode: string): Promise<Device> {
    const device = await this.deviceRepository.findByQRCode(qrCode);
    if (!device) {
      throw new Error(`Device with QR code ${qrCode} not found`);
    }
    return device;
  }

  async searchDevices(criteria: DeviceSearchCriteria, page: number = 1, limit: number = 20): Promise<DeviceSearchResult> {
    return this.deviceRepository.search(criteria, page, limit);
  }

  async getDevicesByCustomer(customerId: UUID): Promise<Device[]> {
    return this.deviceRepository.findByCustomerId(customerId);
  }

  async getDevicesByType(deviceTypeId: UUID): Promise<Device[]> {
    return this.deviceRepository.findByDeviceTypeId(deviceTypeId);
  }

  async deleteDevice(id: UUID): Promise<void> {
    const device = await this.deviceRepository.findById(id);
    if (!device) {
      throw new Error(`Device with ID ${id} not found`);
    }

    // Create retirement history entry
    await this.deviceHistoryRepository.create({
      deviceId: id,
      eventType: 'retirement',
      eventDate: new Date(),
      description: `Device ${device.deviceCode} retired and removed from system`,
      performedBy: undefined // Could be passed from request context
    });

    const deleted = await this.deviceRepository.delete(id);
    if (!deleted) {
      throw new Error(`Failed to delete device with ID ${id}`);
    }
  }

  // QR Code Management
  async generateAndStoreQRCode(device: Device): Promise<string> {
    const qrData = this.qrCodeService.generateQRCodeData(
      device.id,
      device.deviceCode,
      device.serialNumber,
      device.customerId
    );

    const qrCodeId = this.qrCodeService.generateQRCodeId(device.id);
    
    // Store QR code ID in device record
    await this.deviceRepository.updateQRCode(device.id, qrCodeId);

    return qrCodeId;
  }

  async getQRCodeImage(deviceId: UUID): Promise<string> {
    const device = await this.getDevice(deviceId);
    
    const qrData = this.qrCodeService.generateQRCodeData(
      device.id,
      device.deviceCode,
      device.serialNumber,
      device.customerId
    );

    return this.qrCodeService.generateQRCodeImage(qrData);
  }

  async getQRCodeSVG(deviceId: UUID): Promise<string> {
    const device = await this.getDevice(deviceId);
    
    const qrData = this.qrCodeService.generateQRCodeData(
      device.id,
      device.deviceCode,
      device.serialNumber,
      device.customerId
    );

    return this.qrCodeService.generateQRCodeSVG(qrData);
  }

  async parseQRCode(qrString: string): Promise<DeviceQRCodeData | null> {
    return this.qrCodeService.parseQRCodeData(qrString);
  }

  // Device History & Timeline
  async addDeviceHistory(request: CreateDeviceHistoryRequest): Promise<DeviceHistory> {
    // Verify device exists
    const device = await this.deviceRepository.findById(request.deviceId);
    if (!device) {
      throw new Error(`Device with ID ${request.deviceId} not found`);
    }

    const history = await this.deviceHistoryRepository.create(request);

    // Update device's last service date if this is a service event
    if (['service', 'repair', 'maintenance'].includes(request.eventType)) {
      await this.deviceRepository.updateLastServiceDate(request.deviceId, request.eventDate);
    }

    return history;
  }

  async getDeviceHistory(deviceId: UUID): Promise<DeviceHistory[]> {
    return this.deviceHistoryRepository.findByDeviceId(deviceId);
  }

  async getServiceTimeline(deviceId: UUID): Promise<DeviceHistory[]> {
    return this.deviceHistoryRepository.getServiceTimeline(deviceId);
  }

  async getPartsReplacementHistory(deviceId: UUID): Promise<DeviceHistory[]> {
    return this.deviceHistoryRepository.getPartsReplacementHistory(deviceId);
  }

  async getDeviceHistoryByType(deviceId: UUID, eventType: DeviceEventType): Promise<DeviceHistory[]> {
    return this.deviceHistoryRepository.findByDeviceIdAndEventType(deviceId, eventType);
  }

  async getDeviceHistoryByDateRange(deviceId: UUID, startDate: Date, endDate: Date): Promise<DeviceHistory[]> {
    return this.deviceHistoryRepository.findByDateRange(deviceId, startDate, endDate);
  }

  // Device Analytics
  async getDeviceMetrics(deviceId: UUID): Promise<any> {
    const totalServiceCases = await this.deviceHistoryRepository.getServiceCount(deviceId, 'service');
    const totalRepairCases = await this.deviceHistoryRepository.getServiceCount(deviceId, 'repair');
    const totalMaintenanceCases = await this.deviceHistoryRepository.getServiceCount(deviceId, 'maintenance');
    const totalServiceCost = await this.deviceHistoryRepository.getTotalServiceCost(deviceId);
    const lastServiceDate = await this.deviceHistoryRepository.getLastServiceDate(deviceId);

    return {
      deviceId,
      totalServiceCases,
      totalRepairCases,
      totalMaintenanceCases,
      totalServiceCost,
      lastServiceDate,
      // Additional metrics could be calculated here
      totalDowntime: 0, // Would need more complex calculation
      averageRepairTime: 0, // Would need more complex calculation
      mtbf: null, // Mean Time Between Failures
      mttr: null, // Mean Time To Repair
      availabilityPercentage: 95 // Would need more complex calculation
    };
  }

  // Warranty & Contract Management
  async updateWarrantyInfo(deviceId: UUID, warrantyInfo: any): Promise<Device> {
    return this.updateDevice(deviceId, { warrantyInfo });
  }

  async getDevicesWithExpiringWarranty(days: number = 30): Promise<Device[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const criteria: DeviceSearchCriteria = {
      warrantyStatus: 'expiring_soon'
    };

    const result = await this.searchDevices(criteria, 1, 1000);
    
    // Filter by actual warranty expiry date
    return result.devices.filter(device => {
      if (!device.warrantyInfo?.endDate) return false;
      const warrantyEndDate = new Date(device.warrantyInfo.endDate);
      return warrantyEndDate <= cutoffDate && warrantyEndDate >= new Date();
    });
  }

  async getDevicesWithExpiredWarranty(): Promise<Device[]> {
    const criteria: DeviceSearchCriteria = {
      warrantyStatus: 'expired'
    };

    const result = await this.searchDevices(criteria, 1, 1000);
    
    // Filter by actual warranty expiry date
    return result.devices.filter(device => {
      if (!device.warrantyInfo?.endDate) return false;
      const warrantyEndDate = new Date(device.warrantyInfo.endDate);
      return warrantyEndDate < new Date();
    });
  }

  // Helper methods
  private getEventTypeFromStatus(status: string): DeviceEventType {
    switch (status) {
      case 'repair':
        return 'repair';
      case 'maintenance':
        return 'maintenance';
      case 'retired':
        return 'retirement';
      default:
        return 'service';
    }
  }
}