import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Password Security
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
  passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE === 'true',
  passwordRequireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE === 'true',
  passwordRequireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS === 'true',
  passwordRequireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL_CHARS === 'true',
  
  // Account Security
  maxFailedLoginAttempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5'),
  lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '30'),
  passwordExpiryDays: parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90'),
  
  // Session Management
  sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60'),
  allowMultipleSessions: process.env.ALLOW_MULTIPLE_SESSIONS === 'true',
  
  // Email Verification
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  emailVerificationExpiryHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || '24'),
  
  // Password Reset
  passwordResetExpiryHours: parseInt(process.env.PASSWORD_RESET_EXPIRY_HOURS || '1'),
  
  // Two-Factor Authentication
  twoFactorRequired: process.env.TWO_FACTOR_REQUIRED === 'true',
  totpIssuer: process.env.TOTP_ISSUER || 'DRMS',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // External Services
  emailServiceUrl: process.env.EMAIL_SERVICE_URL,
  smsServiceUrl: process.env.SMS_SERVICE_URL,
  
  // Security Headers
  securityHeaders: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }
};

// Validation
if (!config.jwtSecret || config.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
  if (config.nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }
  console.warn('⚠️  Using default JWT secret. Please set JWT_SECRET environment variable.');
}

if (config.bcryptRounds < 10) {
  console.warn('⚠️  BCRYPT_ROUNDS is set to less than 10. Consider increasing for better security.');
}

export default config;