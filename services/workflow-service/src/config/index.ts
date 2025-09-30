import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.WORKFLOW_SERVICE_PORT || '3002'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS Configuration
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // Authentication Service
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  
  // Workflow Configuration
  workflow: {
    maxStepsPerWorkflow: parseInt(process.env.MAX_STEPS_PER_WORKFLOW || '50'),
    maxVersionsToKeep: parseInt(process.env.MAX_VERSIONS_TO_KEEP || '10'),
    defaultTimeout: parseInt(process.env.DEFAULT_STEP_TIMEOUT || '3600000'), // 1 hour in ms
    maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '86400000'), // 24 hours in ms
  },
  
  // Validation
  validation: {
    maxNameLength: 255,
    maxDescriptionLength: 1000,
    maxConditionLength: 2000,
    maxActionLength: 2000,
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // External Services
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL,
  caseServiceUrl: process.env.CASE_SERVICE_URL,
  
  // Performance
  cacheEnabled: process.env.CACHE_ENABLED === 'true',
  cacheTtl: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
};

// Validation
if (config.workflow.maxStepsPerWorkflow > 100) {
  console.warn('⚠️  MAX_STEPS_PER_WORKFLOW is set very high. Consider reducing for performance.');
}

if (config.workflow.maxExecutionTime > 7 * 24 * 60 * 60 * 1000) { // 7 days
  console.warn('⚠️  MAX_EXECUTION_TIME is set very high. Consider reducing to prevent runaway workflows.');
}

export default config;