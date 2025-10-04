export enum DatabaseErrorType {
  AUTHENTICATION_FAILED = 'auth_failed',
  CONNECTION_TIMEOUT = 'connection_timeout',
  NETWORK_ERROR = 'network_error',
  DATABASE_UNAVAILABLE = 'db_unavailable',
  CONFIGURATION_ERROR = 'config_error'
}

export interface DatabaseError extends Error {
  code: string;
  errorType: DatabaseErrorType;
  timestamp: Date;
  retryable: boolean;
  attemptNumber: number;
}

export class DatabaseErrorHandler {
  
  /**
   * Classify database error based on error code and message
   */
  classifyError(error: any): DatabaseErrorType {
    if (!error) return DatabaseErrorType.DATABASE_UNAVAILABLE;
    
    const code = error.code || '';
    const message = error.message || '';
    
    // PostgreSQL error codes
    switch (code) {
      case '28P01': // Invalid password
      case '28000': // Invalid authorization specification
        return DatabaseErrorType.AUTHENTICATION_FAILED;
      
      case 'ECONNREFUSED':
      case 'ENOTFOUND':
      case 'EHOSTUNREACH':
        return DatabaseErrorType.NETWORK_ERROR;
      
      case 'ETIMEDOUT':
      case 'ECONNRESET':
        return DatabaseErrorType.CONNECTION_TIMEOUT;
      
      case '3D000': // Invalid catalog name (database doesn't exist)
      case '08006': // Connection failure
        return DatabaseErrorType.DATABASE_UNAVAILABLE;
      
      default:
        // Check message patterns
        if (message.includes('password authentication failed')) {
          return DatabaseErrorType.AUTHENTICATION_FAILED;
        }
        if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
          return DatabaseErrorType.CONNECTION_TIMEOUT;
        }
        if (message.includes('ECONNREFUSED') || message.includes('connection refused')) {
          return DatabaseErrorType.NETWORK_ERROR;
        }
        
        return DatabaseErrorType.DATABASE_UNAVAILABLE;
    }
  }
  
  /**
   * Determine if error is retryable
   */
  isRetryableError(error: any): boolean {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case DatabaseErrorType.CONNECTION_TIMEOUT:
      case DatabaseErrorType.NETWORK_ERROR:
      case DatabaseErrorType.DATABASE_UNAVAILABLE:
        return true;
      
      case DatabaseErrorType.AUTHENTICATION_FAILED:
        return true; // Retry a few times in case of temporary auth issues
      
      case DatabaseErrorType.CONFIGURATION_ERROR:
        return false; // Don't retry config errors
      
      default:
        return false;
    }
  }
  
  /**
   * Create standardized database error
   */
  handleConnectionError(error: any, attemptNumber: number = 1): DatabaseError {
    const errorType = this.classifyError(error);
    const retryable = this.isRetryableError(error);
    
    const dbError: DatabaseError = {
      name: 'DatabaseError',
      message: this.getUserFriendlyMessage(errorType),
      code: error.code || 'UNKNOWN',
      errorType,
      timestamp: new Date(),
      retryable,
      attemptNumber,
      stack: error.stack
    };
    
    return dbError;
  }
  
  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(errorType: DatabaseErrorType): string {
    switch (errorType) {
      case DatabaseErrorType.AUTHENTICATION_FAILED:
        return 'Database connection authentication failed';
      case DatabaseErrorType.CONNECTION_TIMEOUT:
        return 'Database connection timeout, please try again';
      case DatabaseErrorType.NETWORK_ERROR:
        return 'Network error connecting to database';
      case DatabaseErrorType.DATABASE_UNAVAILABLE:
        return 'Database service is temporarily unavailable';
      case DatabaseErrorType.CONFIGURATION_ERROR:
        return 'Database configuration error';
      default:
        return 'Database connection error';
    }
  }
  
  /**
   * Sanitize error for logging (remove sensitive information)
   */
  sanitizeErrorForLogging(error: any): string {
    if (!error) return 'Unknown error';
    
    let message = error.message || error.toString();
    
    // Remove sensitive information
    message = message.replace(/password[=\s]+[^\s]+/gi, 'password=***');
    message = message.replace(/pwd[=\s]+[^\s]+/gi, 'pwd=***');
    message = message.replace(/user[=\s]+[^\s]+/gi, 'user=***');
    message = message.replace(/username[=\s]+[^\s]+/gi, 'username=***');
    
    // Remove connection strings
    message = message.replace(/postgresql:\/\/[^@]+@/gi, 'postgresql://***@');
    message = message.replace(/postgres:\/\/[^@]+@/gi, 'postgres://***@');
    
    return `${error.code || 'UNKNOWN'}: ${message}`;
  }
}

// Export singleton instance
export const dbErrorHandler = new DatabaseErrorHandler();