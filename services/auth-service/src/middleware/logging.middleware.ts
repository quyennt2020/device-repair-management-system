import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const startTime = Date.now();
  
  // Add request ID to headers for response
  res.setHeader('X-Request-ID', requestId);
  req.headers['x-request-id'] = requestId;

  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
    requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.method !== 'GET' && req.body ? sanitizeBody(req.body) : undefined
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode}`, {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: body?.success,
      error: body?.error?.code
    });
    
    return originalJson.call(this, body);
  };

  next();
};

// Sanitize request body to remove sensitive information
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  // Log security-relevant events
  const securityEvents = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/refresh',
    '/api/auth/change-password',
    '/api/auth/reset-password'
  ];

  if (securityEvents.some(path => req.path.includes(path))) {
    console.log(`[SECURITY] ${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  }

  next();
};