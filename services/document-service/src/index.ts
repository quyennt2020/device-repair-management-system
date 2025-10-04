import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

import { documentTypeRoutes } from './routes/document-type.routes';
import { documentTemplateRoutes } from './routes/document-template.routes';
import { documentRoutes } from './routes/document.routes';
import approvalWorkflowRoutes from './routes/approval-workflow.routes';
import inspectionReportRoutes from './routes/inspection-report.routes';
import { createQuotationRoutes } from './routes/quotation.routes';
import { createRepairReportRoutes } from './routes/repair-report.routes';
import maintenanceReportRoutes from './routes/maintenance-report.routes';
import maintenanceChecklistTemplateRoutes from './routes/maintenance-checklist-template.routes';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { ApprovalScheduledJobsService } from './services/approval-scheduled-jobs.service';
import { getDbConnection } from '../../../shared/database/src/connection';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'document-service' });
});

// Serve uploaded files
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// Routes
app.use('/api/document-types', documentTypeRoutes);
app.use('/api/document-templates', documentTemplateRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/approval-workflows', approvalWorkflowRoutes);
app.use('/api/inspection-reports', inspectionReportRoutes);
app.use('/api/quotations', createQuotationRoutes(getDbConnection()));
app.use('/api/repair-reports', createRepairReportRoutes(getDbConnection()));
app.use('/api/maintenance-reports', maintenanceReportRoutes);
app.use('/api/maintenance-checklist-templates', maintenanceChecklistTemplateRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Document Service running on port ${PORT}`);
  
  // Start approval scheduled jobs
  if (process.env.NODE_ENV !== 'test') {
    const scheduledJobsService = new ApprovalScheduledJobsService();
    scheduledJobsService.startScheduledJobs(15); // Run every 15 minutes
    console.log('Approval scheduled jobs started');
  }
});

export default app;