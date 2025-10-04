import { DatabaseErrorType, dbErrorHandler } from './error-handler';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RetryManager {
  private config: RetryConfig;
  
  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 8000,  // 8 seconds
      backoffMultiplier: 2,
      ...config
    };
  }
  
  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const maxAttempts = maxRetries || this.config.maxAttempts;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          console.log(`✅ Database operation succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        const dbError = dbErrorHandler.handleConnectionError(error, attempt);
        
        // Log sanitized error
        console.error(`❌ Database operation failed (attempt ${attempt}/${maxAttempts}): ${dbErrorHandler.sanitizeErrorForLogging(error)}`);
        
        // Don't retry if error is not retryable
        if (!dbError.retryable) {
          console.error(`🚫 Error is not retryable, stopping attempts`);
          throw dbError;
        }
        
        // Don't retry if this was the last attempt
        if (attempt >= maxAttempts) {
          console.error(`🚫 Max retry attempts (${maxAttempts}) reached`);
          throw dbError;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, dbError.errorType);
        console.log(`⏳ Retrying in ${delay}ms...`);
        
        // Wait before next attempt
        await this.sleep(delay);
      }
    }
    
    // This should never be reached, but just in case
    throw dbErrorHandler.handleConnectionError(lastError, maxAttempts);
  }
  
  /**
   * Calculate delay based on attempt number and error type
   */
  private calculateDelay(attempt: number, errorType: DatabaseErrorType): number {
    let delay = this.config.baseDelay;
    
    // Different strategies for different error types
    switch (errorType) {
      case DatabaseErrorType.AUTHENTICATION_FAILED:
        // Shorter delays for auth errors (might be temporary)
        delay = Math.min(1000 * attempt, 3000);
        break;
        
      case DatabaseErrorType.CONNECTION_TIMEOUT:
      case DatabaseErrorType.NETWORK_ERROR:
        // Exponential backoff for network issues
        delay = Math.min(
          this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelay
        );
        break;
        
      case DatabaseErrorType.DATABASE_UNAVAILABLE:
        // Longer delays for database unavailable
        delay = Math.min(2000 * attempt, this.config.maxDelay);
        break;
        
      default:
        delay = this.config.baseDelay * attempt;
    }
    
    // Add some jitter to avoid thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

// Export default instance
export const retryManager = new RetryManager();