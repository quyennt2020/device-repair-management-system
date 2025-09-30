// Simple test to verify core functionality without external dependencies
import { QRCodeService } from '../services/qr-code.service';

describe('QRCodeService', () => {
  const qrCodeService = new QRCodeService();

  test('should generate QR code data', () => {
    const deviceId = '123e4567-e89b-12d3-a456-426614174000';
    const deviceCode = 'DEV-001';
    const serialNumber = 'SN123456';
    const customerId = '123e4567-e89b-12d3-a456-426614174001';

    const qrData = qrCodeService.generateQRCodeData(
      deviceId,
      deviceCode,
      serialNumber,
      customerId
    );

    expect(qrData.deviceId).toBe(deviceId);
    expect(qrData.deviceCode).toBe(deviceCode);
    expect(qrData.serialNumber).toBe(serialNumber);
    expect(qrData.customerId).toBe(customerId);
    expect(Array.isArray(qrData.quickActions)).toBe(true);
  });

  test('should parse valid QR code data', () => {
    const qrData = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      deviceCode: 'DEV-001',
      serialNumber: 'SN123456',
      customerId: '123e4567-e89b-12d3-a456-426614174001',
      quickActions: ['view_device_info']
    };

    const qrString = JSON.stringify(qrData);
    const parsed = qrCodeService.parseQRCodeData(qrString);

    expect(parsed).toEqual(qrData);
  });

  test('should return null for invalid QR code data', () => {
    const invalidQrString = 'invalid-json';
    const parsed = qrCodeService.parseQRCodeData(invalidQrString);

    expect(parsed).toBeNull();
  });

  test('should validate QR code data structure', () => {
    const validData = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      deviceCode: 'DEV-001',
      serialNumber: 'SN123456',
      customerId: '123e4567-e89b-12d3-a456-426614174001',
      quickActions: []
    };

    const invalidData = {
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      // missing required fields
    };

    expect(qrCodeService.validateQRCodeData(validData)).toBe(true);
    expect(qrCodeService.validateQRCodeData(invalidData)).toBe(false);
  });

  test('should generate unique QR code ID', () => {
    const deviceId = '123e4567-e89b-12d3-a456-426614174000';
    const qrId1 = qrCodeService.generateQRCodeId(deviceId);
    const qrId2 = qrCodeService.generateQRCodeId(deviceId);

    expect(qrId1).toContain('qr_');
    expect(qrId1).toContain(deviceId);
    expect(qrId1).not.toBe(qrId2); // Should be unique due to timestamp
  });
});