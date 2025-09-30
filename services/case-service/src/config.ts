import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.CASE_SERVICE_PORT || '3002'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Case Management
  case: {
    defaultPriority: process.env.DEFAULT_CASE_PRIORITY || 'medium',
    autoAssignTechnicians: process.env.AUTO_ASSIGN_TECHNICIANS === 'true',
    maxCasesPerTechnician: parseInt(process.env.MAX_CASES_PER_TECHNICIAN || '10'),
    defaultSLA: {
      low: parseInt(process.env.SLA_LOW_HOURS || '72'),
      medium: parseInt(process.env.SLA_MEDIUM_HOURS || '48'),
      high: parseInt(process.env.SLA_HIGH_HOURS || '24'),
      urgent: parseInt(process.env.SLA_URGENT_HOURS || '8')
    },
    escalationThresholds: {
      warning: parseInt(process.env.ESCALATION_WARNING_HOURS || '2'),
      critical: parseInt(process.env.ESCALATION_CRITICAL_HOURS || '1')
    }
  },
  
  // Workflow Integration
  integrations: {
    enableWorkflowIntegration: process.env.ENABLE_WORKFLOW_INTEGRATION === 'true',
    workflowServiceUrl: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:3003',
    workflowTimeout: parseInt(process.env.WORKFLOW_TIMEOUT_MS || '30000'),
    retryAttempts: parseInt(process.env.WORKFLOW_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.WORKFLOW_RETRY_DELAY_MS || '1000')
  },
  
  // SLA Management
  sla: {
    enableSLAMonitoring: process.env.ENABLE_SLA_MONITORING === 'true',
    checkIntervalMinutes: parseInt(process.env.SLA_CHECK_INTERVAL_MINUTES || '15'),
    escalationEnabled: process.env.SLA_ESCALATION_ENABLED === 'true',
    penaltyCalculationEnabled: process.env.SLA_PENALTY_CALCULATION_ENABLED === 'true'
  },
  
  // Notifications
  notifications: {
    enableNotifications: process.env.ENABLE_NOTIFICATIONS === 'true',
    emailServiceUrl: process.env.EMAIL_SERVICE_URL,
    smsServiceUrl: process.env.SMS_SERVICE_URL,
    webhookUrl: process.env.WEBHOOK_URL
  },
  
  // External Services
  services: {
    authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    documentServiceUrl: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3004',
    customerServiceUrl: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:3005',
    deviceServiceUrl: process.env.DEVICE_SERVICE_URL || 'http://localhost:3006',
    technicianServiceUrl: process.env.TECHNICIAN_SERVICE_URL || 'http://localhost:3007'
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Database
  database: {
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '10000')
  }
};

// Validation
if (config.integrations.enableWorkflowIntegration && !config.integrations.workflowServiceUrl) {
  console.warn('⚠️  Workflow integration is enabled but WORKFLOW_SERVICE_URL is not set');
}

if (config.sla.enableSLAMonitoring && config.sla.checkIntervalMinutes < 5) {
  console.warn('⚠️  SLA check interval is less than 5 minutes. This may cause performance issues.');
}

export default config;