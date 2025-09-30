import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { errorMiddleware } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { technicianRoutes } from './routes/technician.routes';
import { skillRoutes } from './routes/skill.routes';
import { certificationRoutes } from './routes/certification.routes';
import { availabilityRoutes } from './routes/availability.routes';
import { performanceRoutes } from './routes/performance.routes';
import { workloadRoutes } from './routes/workload.routes';
import { scheduleRoutes } from './routes/schedule.routes';
import { ScheduledJobsService } from './services/scheduled-jobs.service';

dotenv.config();

const app = express();
const port = process.env.PORT || 3006;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'repair_management',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(loggingMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'technician-service' });
});

// Routes
app.use('/api/technicians', authMiddleware, technicianRoutes);
app.use('/api/technicians', authMiddleware, skillRoutes);
app.use('/api/technicians', authMiddleware, certificationRoutes);
app.use('/api/technicians', authMiddleware, availabilityRoutes);
app.use('/api/technicians', authMiddleware, performanceRoutes);
app.use('/api/technicians', authMiddleware, workloadRoutes);
app.use('/api/technicians', authMiddleware, scheduleRoutes);

// Error handling
app.use(errorMiddleware);

// Start scheduled jobs
const scheduledJobsService = new ScheduledJobsService(pool);
scheduledJobsService.start();

app.listen(port, () => {
  console.log(`Technician service running on port ${port}`);
});

export { pool };