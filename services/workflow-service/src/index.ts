import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { workflowDefinitionRoutes } from './routes/workflow-definition.routes';
import { workflowTemplateRoutes } from './routes/workflow-template.routes';
import { workflowExecutionRoutes } from './routes/workflow-execution.routes';
import { workflowMonitoringRoutes } from './routes/workflow-monitoring.routes';
import { workflowDebuggingRoutes } from './routes/workflow-debugging.routes';
import { workflowVisualizationRoutes } from './routes/workflow-visualization.routes';
import { workflowConfigurationRoutes } from './routes/workflow-configuration.routes';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { db } from '@drms/shared-database';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'workflow-service',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      dependencies: {
        database: 'connected',
        authService: config.authServiceUrl
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'workflow-service',
      error: 'Database connection failed'
    });
  }
});

// API routes
app.use('/api/workflows', workflowDefinitionRoutes);
app.use('/api/workflow-templates', workflowTemplateRoutes);
app.use('/api/workflow-execution', workflowExecutionRoutes);
app.use('/api/workflow-monitoring', workflowMonitoringRoutes);
app.use('/api/workflow-debugging', workflowDebuggingRoutes);
app.use('/api/workflow-visualization', workflowVisualizationRoutes);
app.use('/api/workflow-configurations', workflowConfigurationRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found'
    }
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🔄 Workflow Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Auth Service: ${config.authServiceUrl}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await db.close();
  process.exit(0);
});

export default app;