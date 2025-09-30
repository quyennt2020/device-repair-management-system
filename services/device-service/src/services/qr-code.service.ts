import QRCode from 'qrcode';
import { DeviceQRCodeData } from '@shared/types/src/device';
import { UUID } from '@shared/types/src/common';

export class QRCodeService {
  
  /**
   * Generate QR code data for a device
   */
  generateQRCodeData(
    deviceId: UUID,
    deviceCode: string,
    serialNumber: string,
    customerId: UUID
  ): DeviceQRCodeData {
    return {
      deviceId,
      deviceCode,
      serialNumber,
      customerId,
      quickActions: [
        'view_device_info',
        'create_service_request',
        'view_service_history',
        'view_warranty_info'
      ]
    };
  }

  /**
   * Generate QR code as base64 data URL
   */
  async generateQRCodeImage(data: DeviceQRCodeData): Promise<string> {
    const qrData = JSON.stringify(data);
    
    const options = {
      type: 'image/png' as const,
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrData, options);
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code as SVG string
   */
  async generateQRCodeSVG(data: DeviceQRCodeData): Promise<string> {
    const qrData = JSON.stringify(data);
    
    const options = {
      type: 'svg' as const,
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    try {
      const qrCodeSVG = await QRCode.toString(qrData, options);
      return qrCodeSVG;
    } catch (error) {
      throw new Error(`Failed to generate QR code SVG: ${error.message}`);
    }
  }

  /**
   * Parse QR code data from scanned string
   */
  parseQRCodeData(qrString: string): DeviceQRCodeData | null {
    try {
      const data = JSON.parse(qrString);
      
      // Validate required fields
      if (!data.deviceId || !data.deviceCode || !data.serialNumber || !data.customerId) {
        return null;
      }
      
      return {
        deviceId: data.deviceId,
        deviceCode: data.deviceCode,
        serialNumber: data.serialNumber,
        customerId: data.customerId,
        quickActions: data.quickActions || []
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate unique QR code identifier for storage
   */
  generateQRCodeId(deviceId: UUID): string {
    return `qr_${deviceId}_${Date.now()}`;
  }

  /**
   * Validate QR code data structure
   */
  validateQRCodeData(data: any): boolean {
    return (
      data &&
      typeof data.deviceId === 'string' &&
      typeof data.deviceCode === 'string' &&
      typeof data.serialNumber === 'string' &&
      typeof data.customerId === 'string' &&
      Array.isArray(data.quickActions)
    );
  }
}