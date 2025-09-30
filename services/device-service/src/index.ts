import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';

import { config } from './config';
import { DeviceService } from './services/device.service';
import { DeviceTypeService } from './services/device-type.service';
import { DeviceController } from './controllers/device.controller';
import { DeviceTypeController } from './controllers/device-type.controller';
import { createDeviceRoutes } from './routes/device.routes';
import { createDeviceTypeRoutes } from './routes/device-type.routes';
import { authMiddleware } from './middleware/auth.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

class DeviceServiceApp {
  private app: express.Application;
  private db: Pool;

  constructor() {
    this.app = express();
    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeDatabase(): void {
    this.db = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.db.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors(config.cors));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
      }
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'Device Service is healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Authentication middleware for all routes except health check
    this.app.use('/api', authMiddleware);
  }

  private initializeRoutes(): void {
    // Initialize services
    const deviceService = new DeviceService(this.db);
    const deviceTypeService = new DeviceTypeService(this.db);

    // Initialize controllers
    const deviceController = new DeviceController(deviceService);
    const deviceTypeController = new DeviceTypeController(deviceTypeService);

    // Initialize routes
    this.app.use('/api/devices', createDeviceRoutes(deviceController));
    this.app.use('/api/device-types', createDeviceTypeRoutes(deviceTypeController));

    // API documentation endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: 'Device Management Service API',
        version: '1.0.0',
        endpoints: {
          devices: {
            'POST /api/devices': 'Create a new device',
            'GET /api/devices': 'Search devices',
            'GET /api/devices/:id': 'Get device by ID',
            'PUT /api/devices/:id': 'Update device',
            'DELETE /api/devices/:id': 'Delete device',
            'GET /api/devices/code/:deviceCode': 'Get device by code',
            'GET /api/devices/serial/:serialNumber': 'Get device by serial number',
            'GET /api/devices/customer/:customerId': 'Get devices by customer',
            'GET /api/devices/type/:deviceTypeId': 'Get devices by type',
            'GET /api/devices/:id/qr-code/image': 'Get QR code image',
            'GET /api/devices/:id/qr-code/svg': 'Get QR code SVG',
            'POST /api/devices/qr-code/parse': 'Parse QR code',
            'POST /api/devices/history': 'Add device history',
            'GET /api/devices/:id/history': 'Get device history',
            'GET /api/devices/:id/timeline': 'Get service timeline',
            'GET /api/devices/:id/parts-history': 'Get parts replacement history',
            'GET /api/devices/:id/metrics': 'Get device metrics',
            'PUT /api/devices/:id/warranty': 'Update warranty info',
            'GET /api/devices/warranty/expiring': 'Get devices with expiring warranty',
            'GET /api/devices/warranty/expired': 'Get devices with expired warranty'
          },
          deviceTypes: {
            'POST /api/device-types': 'Create a new device type',
            'GET /api/device-types': 'Get all device types',
            'GET /api/device-types/:id': 'Get device type by ID',
            'PUT /api/device-types/:id': 'Update device type',
            'DELETE /api/device-types/:id': 'Delete device type',
            'GET /api/device-types/search': 'Search device types',
            'GET /api/device-types/category/:category': 'Get device types by category',
            'GET /api/device-types/manufacturer/:manufacturer': 'Get device types by manufacturer',
            'PUT /api/device-types/:id/specifications': 'Update specifications',
            'PUT /api/device-types/:id/certifications': 'Update required certifications',
            'PUT /api/device-types/:id/maintenance-checklist': 'Update maintenance checklist',
            'GET /api/device-types/:id/certifications': 'Get required certifications',
            'GET /api/device-types/:id/maintenance-checklist': 'Get maintenance checklist',
            'GET /api/device-types/:id/service-hours': 'Get standard service hours',
            'GET /api/device-types/meta/categories': 'Get all categories',
            'GET /api/device-types/meta/manufacturers': 'Get all manufacturers'
          }
        }
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      await this.db.query('SELECT NOW()');
      console.log('✅ Database connection established');

      // Start server
      this.app.listen(config.port, () => {
        console.log(`🚀 Device Service running on port ${config.port}`);
        console.log(`📚 API Documentation: http://localhost:${config.port}/api`);
        console.log(`🏥 Health Check: http://localhost:${config.port}/health`);
        console.log(`🌍 Environment: ${config.nodeEnv}`);
      });
    } catch (error) {
      console.error('❌ Failed to start Device Service:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.db.end();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    }
  }
}

// Start the application
const app = new DeviceServiceApp();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.stop();
  process.exit(0);
});

// Start the server
app.start().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

export default app;