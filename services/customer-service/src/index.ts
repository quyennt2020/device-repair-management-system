import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { config } from './config';
import { errorMiddleware } from './middleware/error.middleware';
import { createCustomerRoutes } from './routes/customer.routes';
import { CustomerController } from './controllers/customer.controller';
import { CustomerService } from './services/customer.service';
import { CustomerRepository } from './repositories/customer.repository';
import { CustomerContactRepository } from './repositories/customer-contact.repository';
import { CustomerAddressRepository } from './repositories/customer-address.repository';
import { CustomerPreferencesRepository } from './repositories/customer-preferences.repository';

class CustomerServiceApp {
  private app: express.Application;
  private db: Pool;

  constructor() {
    this.app = express();
    this.db = new Pool(config.database);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors(config.cors));
    
    // Rate limiting
    const limiter = rateLimit(config.rateLimit);
    this.app.use(limiter);
    
    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'customer-service',
        timestamp: new Date().toISOString()
      });
    });

    // Initialize repositories
    const customerRepository = new CustomerRepository(this.db);
    const contactRepository = new CustomerContactRepository(this.db);
    const addressRepository = new CustomerAddressRepository(this.db);
    const preferencesRepository = new CustomerPreferencesRepository(this.db);

    // Initialize service
    const customerService = new CustomerService(
      customerRepository,
      contactRepository,
      addressRepository,
      preferencesRepository
    );

    // Initialize controller
    const customerController = new CustomerController(customerService);

    // Setup routes
    this.app.use('/api/customers', createCustomerRoutes(customerController));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use(errorMiddleware);
  }

  public async start(): Promise<void> {
    try {
      // Test database connection
      await this.db.query('SELECT 1');
      console.log('Database connected successfully');

      // Start server
      this.app.listen(config.port, () => {
        console.log(`Customer service running on port ${config.port}`);
        console.log(`Environment: ${config.nodeEnv}`);
      });
    } catch (error) {
      console.error('Failed to start customer service:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.db.end();
  }
}

// Start the application
const app = new CustomerServiceApp();
app.start().catch(console.error);

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

export default app;