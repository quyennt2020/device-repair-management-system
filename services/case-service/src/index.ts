import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from './config';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { ScheduledJobsService } from './services/scheduled-jobs.service';

// Import routes
import caseRoutes from './routes/case.routes';
import technicianAssignmentRoutes from './routes/technician-assignment.routes';
import workflowIntegrationRoutes from './routes/workflow-integration.routes';

const app = express();
const scheduledJobs = new ScheduledJobsService();

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
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'case-service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/cases', caseRoutes);
app.use('/api/technician-assignment', technicianAssignmentRoutes);
app.use('/api', workflowIntegrationRoutes);

// 404 handler
app.use(notFoundMiddleware);

// Error handling middleware (must be last)
app.use(errorMiddleware);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Case Service running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Start scheduled jobs
  scheduledJobs.startScheduledJobs();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  scheduledJobs.stopScheduledJobs();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  scheduledJobs.stopScheduledJobs();
  process.exit(0);
});

export default app;