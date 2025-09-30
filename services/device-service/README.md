# Device Management Service

The Device Management Service is a core component of the Device Repair Management System that handles device registration, QR code generation, device history tracking, warranty management, and device type specifications.

## Features

### Device Management
- ✅ Device registration with unique device codes and serial numbers
- ✅ Device CRUD operations with comprehensive validation
- ✅ Device search and filtering capabilities
- ✅ Device status tracking (active, repair, maintenance, retired, etc.)
- ✅ Location information management

### QR Code Management
- ✅ Automatic QR code generation for each device
- ✅ QR code image generation (PNG format)
- ✅ QR code SVG generation for scalable graphics
- ✅ QR code parsing and validation
- ✅ Quick action support through QR codes

### Device History & Timeline
- ✅ Complete service history tracking
- ✅ Parts replacement history
- ✅ Service timeline visualization
- ✅ Event-based history logging (service, repair, maintenance, etc.)
- ✅ Cost tracking for each service event

### Device Type Management
- ✅ Device type specifications and requirements
- ✅ Required certifications management
- ✅ Maintenance checklist templates
- ✅ Standard service hours configuration
- ✅ Category and manufacturer organization

### Warranty & Contract Management
- ✅ Warranty information tracking
- ✅ Warranty expiration monitoring
- ✅ Contract association management
- ✅ Automated warranty alerts

### Analytics & Metrics
- ✅ Device performance metrics
- ✅ Service cost analysis
- ✅ Maintenance frequency tracking
- ✅ Device availability calculations

## API Endpoints

### Device Management
```
POST   /api/devices                    - Create new device
GET    /api/devices                    - Search devices
GET    /api/devices/:id                - Get device by ID
PUT    /api/devices/:id                - Update device
DELETE /api/devices/:id                - Delete device
GET    /api/devices/code/:deviceCode   - Get device by code
GET    /api/devices/serial/:serialNumber - Get device by serial number
GET    /api/devices/customer/:customerId - Get devices by customer
GET    /api/devices/type/:deviceTypeId - Get devices by type
```

### QR Code Management
```
GET    /api/devices/:id/qr-code/image  - Get QR code as image
GET    /api/devices/:id/qr-code/svg    - Get QR code as SVG
POST   /api/devices/qr-code/parse      - Parse QR code data
```

### Device History
```
POST   /api/devices/history            - Add device history entry
GET    /api/devices/:id/history        - Get device history
GET    /api/devices/:id/timeline       - Get service timeline
GET    /api/devices/:id/parts-history  - Get parts replacement history
GET    /api/devices/:id/metrics        - Get device metrics
```

### Warranty Management
```
PUT    /api/devices/:id/warranty       - Update warranty info
GET    /api/devices/warranty/expiring  - Get devices with expiring warranty
GET    /api/devices/warranty/expired   - Get devices with expired warranty
```

### Device Type Management
```
POST   /api/device-types               - Create device type
GET    /api/device-types               - Get all device types
GET    /api/device-types/:id           - Get device type by ID
PUT    /api/device-types/:id           - Update device type
DELETE /api/device-types/:id           - Delete device type
GET    /api/device-types/search        - Search device types
GET    /api/device-types/category/:category - Get by category
GET    /api/device-types/manufacturer/:manufacturer - Get by manufacturer
```

### Device Type Specifications
```
PUT    /api/device-types/:id/specifications - Update specifications
PUT    /api/device-types/:id/certifications - Update required certifications
PUT    /api/device-types/:id/maintenance-checklist - Update maintenance checklist
GET    /api/device-types/:id/certifications - Get required certifications
GET    /api/device-types/:id/maintenance-checklist - Get maintenance checklist
GET    /api/device-types/:id/service-hours - Get standard service hours
```

### Metadata
```
GET    /api/device-types/meta/categories - Get all categories
GET    /api/device-types/meta/manufacturers - Get all manufacturers
```

## Data Models

### Device
```typescript
interface Device {
  id: UUID;
  deviceCode: string;
  customerId: UUID;
  deviceTypeId: UUID;
  manufacturer: string;
  model: string;
  serialNumber: string;
  specifications: DeviceSpecifications;
  locationInfo: Location;
  status: DeviceStatus;
  warrantyInfo: WarrantyInfo;
  lastServiceDate?: Date;
  nextServiceDate?: Date;
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Device Type
```typescript
interface DeviceType {
  id: UUID;
  name: string;
  category: string;
  manufacturer: string;
  modelSeries: string;
  specifications: DeviceTypeSpecifications;
  standardServiceHours: number;
  requiredCertifications: string[];
  maintenanceChecklist: MaintenanceChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Device History
```typescript
interface DeviceHistory {
  id: UUID;
  deviceId: UUID;
  repairCaseId?: UUID;
  eventType: DeviceEventType;
  eventDate: Date;
  description: string;
  performedBy?: UUID;
  nextActionDate?: Date;
  cost?: number;
  partsUsed?: DevicePartUsage[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
npm run migrate
```

4. Start the service:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Testing

Run the test suite:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Environment Variables

```env
PORT=3005
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=device_repair_system
DB_USER=postgres
DB_PASSWORD=password

# CORS
CORS_ORIGIN=*

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

# QR Code
QR_CODE_BASE_URL=https://device-repair.example.com
QR_CODE_IMAGE_SIZE=256
```

## Architecture

The service follows Clean Architecture principles:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic
- **Repositories**: Handle data persistence
- **Middleware**: Handle cross-cutting concerns (auth, validation, error handling)

## Key Features Implementation

### QR Code Generation
Each device automatically gets a QR code containing:
- Device ID and code
- Serial number
- Customer ID
- Quick action links

### Device History Tracking
All device events are tracked including:
- Service events
- Repair activities
- Parts replacements
- Maintenance activities
- Status changes

### Warranty Management
- Automatic warranty expiration tracking
- Warranty status monitoring
- Integration with service contracts
- Automated alerts for expiring warranties

### Device Type Specifications
- Configurable device specifications
- Required certification tracking
- Maintenance checklist templates
- Standard service hour estimates

## Integration Points

This service integrates with:
- **Customer Service**: For device-customer relationships
- **Case Service**: For repair case associations
- **Inventory Service**: For parts tracking
- **Workflow Service**: For maintenance workflows
- **Contract Service**: For warranty and service contracts

## Performance Considerations

- Database indexes on frequently queried fields
- Pagination for large result sets
- Caching for device type metadata
- Optimized QR code generation
- Efficient search queries

## Security

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting
- SQL injection prevention
- XSS protection

## Monitoring

The service provides:
- Health check endpoint (`/health`)
- Comprehensive logging
- Error tracking
- Performance metrics
- Database connection monitoring

## Future Enhancements

- [ ] Device image management
- [ ] IoT device integration
- [ ] Predictive maintenance alerts
- [ ] Advanced analytics dashboard
- [ ] Mobile app integration
- [ ] Barcode scanning support
- [ ] Device location tracking
- [ ] Automated warranty claims