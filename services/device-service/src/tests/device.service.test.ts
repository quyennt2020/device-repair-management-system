import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { DeviceService } from '../services/device.service';
import { CreateDeviceRequest, UpdateDeviceRequest, DeviceSearchCriteria } from '@shared/types/src/device';

// Mock the database
const mockDb = {
  query: vi.fn(),
} as unknown as Pool;

describe('DeviceService', () => {
  let deviceService: DeviceService;

  beforeEach(() => {
    vi.clearAllMocks();
    deviceService = new DeviceService(mockDb);
  });

  describe('createDevice', () => {
    it('should create a device successfully', async () => {
      const createRequest: CreateDeviceRequest = {
        deviceCode: 'DEV-001',
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        deviceTypeId: '123e4567-e89b-12d3-a456-426614174001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        serialNumber: 'SN123456',
        specifications: { power: '220V' },
        locationInfo: { address: 'Test Address' }
      };

      const mockDevice = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        device_code: 'DEV-001',
        customer_id: '123e4567-e89b-12d3-a456-426614174000',
        device_type_id: '123e4567-e89b-12d3-a456-426614174001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        serial_number: 'SN123456',
        specifications: { power: '220V' },
        location_info: { address: 'Test Address' },
        warranty_info: {},
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock repository calls
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // findByDeviceCode
        .mockResolvedValueOnce({ rows: [] }) // findBySerialNumber
        .mockResolvedValueOnce({ rows: [{ id: '123e4567-e89b-12d3-a456-426614174001' }] }) // findDeviceType
        .mockResolvedValueOnce({ rows: [mockDevice] }) // create device
        .mockResolvedValueOnce({ rows: [] }) // updateQRCode
        .mockResolvedValueOnce({ rows: [{ id: 'history-id' }] }); // create history

      const result = await deviceService.createDevice(createRequest);

      expect(result.deviceCode).toBe('DEV-001');
      expect(result.manufacturer).toBe('Test Manufacturer');
      expect(result.status).toBe('active');
    });

    it('should throw error if device code already exists', async () => {
      const createRequest: CreateDeviceRequest = {
        deviceCode: 'DEV-001',
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        deviceTypeId: '123e4567-e89b-12d3-a456-426614174001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        serialNumber: 'SN123456',
        specifications: {},
        locationInfo: {}
      };

      // Mock existing device
      (mockDb.query as any).mockResolvedValueOnce({ 
        rows: [{ id: 'existing-id', device_code: 'DEV-001' }] 
      });

      await expect(deviceService.createDevice(createRequest))
        .rejects.toThrow('Device with code DEV-001 already exists');
    });

    it('should throw error if serial number already exists', async () => {
      const createRequest: CreateDeviceRequest = {
        deviceCode: 'DEV-001',
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        deviceTypeId: '123e4567-e89b-12d3-a456-426614174001',
        manufacturer: 'Test Manufacturer',
        model: 'Test Model',
        serialNumber: 'SN123456',
        specifications: {},
        locationInfo: {}
      };

      // Mock no existing device code but existing serial number
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // findByDeviceCode
        .mockResolvedValueOnce({ rows: [{ id: 'existing-id', serial_number: 'SN123456' }] }); // findBySerialNumber

      await expect(deviceService.createDevice(createRequest))
        .rejects.toThrow('Device with serial number SN123456 already exists');
    });
  });

  describe('updateDevice', () => {
    it('should update device successfully', async () => {
      const deviceId = '123e4567-e89b-12d3-a456-426614174002';
      const updateRequest: UpdateDeviceRequest = {
        manufacturer: 'Updated Manufacturer',
        status: 'maintenance'
      };

      const existingDevice = {
        id: deviceId,
        device_code: 'DEV-001',
        status: 'active',
        manufacturer: 'Old Manufacturer'
      };

      const updatedDevice = {
        ...existingDevice,
        manufacturer: 'Updated Manufacturer',
        status: 'maintenance',
        updated_at: new Date()
      };

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [existingDevice] }) // findById
        .mockResolvedValueOnce({ rows: [updatedDevice] }) // update
        .mockResolvedValueOnce({ rows: [{ id: 'history-id' }] }); // create history

      const result = await deviceService.updateDevice(deviceId, updateRequest);

      expect(result.manufacturer).toBe('Updated Manufacturer');
      expect(result.status).toBe('maintenance');
    });

    it('should throw error if device not found', async () => {
      const deviceId = '123e4567-e89b-12d3-a456-426614174002';
      const updateRequest: UpdateDeviceRequest = {
        manufacturer: 'Updated Manufacturer'
      };

      (mockDb.query as any).mockResolvedValueOnce({ rows: [] }); // findById

      await expect(deviceService.updateDevice(deviceId, updateRequest))
        .rejects.toThrow('Device with ID 123e4567-e89b-12d3-a456-426614174002 not found');
    });
  });

  describe('searchDevices', () => {
    it('should search devices with criteria', async () => {
      const criteria: DeviceSearchCriteria = {
        query: 'test',
        status: 'active'
      };

      const mockDevices = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          device_code: 'DEV-001',
          manufacturer: 'Test Manufacturer',
          status: 'active'
        }
      ];

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count query
        .mockResolvedValueOnce({ rows: mockDevices }); // data query

      const result = await deviceService.searchDevices(criteria, 1, 20);

      expect(result.devices).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('QR Code functionality', () => {
    it('should generate QR code image', async () => {
      const deviceId = '123e4567-e89b-12d3-a456-426614174002';
      const mockDevice = {
        id: deviceId,
        device_code: 'DEV-001',
        serial_number: 'SN123456',
        customer_id: '123e4567-e89b-12d3-a456-426614174000'
      };

      (mockDb.query as any).mockResolvedValueOnce({ rows: [mockDevice] }); // findById

      const result = await deviceService.getQRCodeImage(deviceId);

      expect(result).toContain('data:image/png;base64');
    });

    it('should parse QR code data', async () => {
      const qrData = {
        deviceId: '123e4567-e89b-12d3-a456-426614174002',
        deviceCode: 'DEV-001',
        serialNumber: 'SN123456',
        customerId: '123e4567-e89b-12d3-a456-426614174000',
        quickActions: ['view_device_info']
      };

      const qrString = JSON.stringify(qrData);
      const result = await deviceService.parseQRCode(qrString);

      expect(result).toEqual(qrData);
    });

    it('should return null for invalid QR code', async () => {
      const invalidQrString = 'invalid-qr-data';
      const result = await deviceService.parseQRCode(invalidQrString);

      expect(result).toBeNull();
    });
  });

  describe('Device History', () => {
    it('should add device history', async () => {
      const historyRequest = {
        deviceId: '123e4567-e89b-12d3-a456-426614174002',
        eventType: 'repair' as const,
        eventDate: new Date(),
        description: 'Device repaired',
        cost: 100
      };

      const mockDevice = { id: historyRequest.deviceId };
      const mockHistory = {
        id: 'history-id',
        device_id: historyRequest.deviceId,
        event_type: historyRequest.eventType,
        event_date: historyRequest.eventDate,
        description: historyRequest.description,
        cost: historyRequest.cost,
        parts_used: [],
        created_at: new Date(),
        updated_at: new Date()
      };

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [mockDevice] }) // findById
        .mockResolvedValueOnce({ rows: [mockHistory] }) // create history
        .mockResolvedValueOnce({ rows: [] }); // updateLastServiceDate

      const result = await deviceService.addDeviceHistory(historyRequest);

      expect(result.eventType).toBe('repair');
      expect(result.description).toBe('Device repaired');
      expect(result.cost).toBe(100);
    });

    it('should get device history', async () => {
      const deviceId = '123e4567-e89b-12d3-a456-426614174002';
      const mockHistory = [
        {
          id: 'history-1',
          device_id: deviceId,
          event_type: 'repair',
          event_date: new Date(),
          description: 'Device repaired'
        }
      ];

      (mockDb.query as any).mockResolvedValueOnce({ rows: mockHistory });

      const result = await deviceService.getDeviceHistory(deviceId);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('repair');
    });
  });

  describe('Warranty Management', () => {
    it('should get devices with expiring warranty', async () => {
      const mockDevices = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          device_code: 'DEV-001',
          warranty_info: {
            hasWarranty: true,
            endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now
          }
        }
      ];

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count
        .mockResolvedValueOnce({ rows: mockDevices }); // data

      const result = await deviceService.getDevicesWithExpiringWarranty(30);

      expect(result).toHaveLength(1);
      expect(result[0].warrantyInfo.hasWarranty).toBe(true);
    });

    it('should get devices with expired warranty', async () => {
      const mockDevices = [
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          device_code: 'DEV-001',
          warranty_info: {
            hasWarranty: true,
            endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
          }
        }
      ];

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // count
        .mockResolvedValueOnce({ rows: mockDevices }); // data

      const result = await deviceService.getDevicesWithExpiredWarranty();

      expect(result).toHaveLength(1);
      expect(result[0].warrantyInfo.hasWarranty).toBe(true);
    });
  });

  describe('Device Metrics', () => {
    it('should get device metrics', async () => {
      const deviceId = '123e4567-e89b-12d3-a456-426614174002';

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // service count
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // repair count
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // maintenance count
        .mockResolvedValueOnce({ rows: [{ total_cost: '1500.00' }] }) // total cost
        .mockResolvedValueOnce({ rows: [{ last_service_date: new Date() }] }); // last service date

      const result = await deviceService.getDeviceMetrics(deviceId);

      expect(result.deviceId).toBe(deviceId);
      expect(result.totalServiceCases).toBe(5);
      expect(result.totalRepairCases).toBe(2);
      expect(result.totalMaintenanceCases).toBe(3);
      expect(result.totalServiceCost).toBe(1500);
    });
  });
});