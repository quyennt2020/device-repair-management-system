import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { dbErrorHandler, DatabaseError } from './error-handler';
import { retryManager } from './retry-manager';

dotenv.config();

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;

  private constructor() {
    // Use connection string if available, otherwise use individual params
    const connectionString = process.env.DATABASE_URL;

    this.pool = connectionString ? new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }) : new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5433'),
      database: process.env.DATABASE_NAME || 'device_repair_db',
      user: process.env.DATABASE_USER || 'drms_user',
      password: process.env.DATABASE_PASSWORD || 'drms_password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      const sanitizedError = dbErrorHandler.sanitizeErrorForLogging(err);
      console.error(`💥 Unexpected error on idle client: ${sanitizedError}`);
      
      // Don't exit immediately, log the error and let the application handle it
      const dbError = dbErrorHandler.handleConnectionError(err);
      console.error(`🚨 Pool error type: ${dbError.errorType}, retryable: ${dbError.retryable}`);
    });
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async getClient(): Promise<PoolClient> {
    return retryManager.executeWithRetry(async () => {
      try {
        return await this.pool.connect();
      } catch (error) {
        // Log sanitized error
        console.error(`Database connection error: ${dbErrorHandler.sanitizeErrorForLogging(error)}`);
        throw error;
      }
    });
  }

  public async query(text: string, params?: any[]): Promise<any> {
    return retryManager.executeWithRetry(async () => {
      const client = await this.getClient();
      try {
        const result = await client.query(text, params);
        return result;
      } catch (error) {
        console.error(`Database query error: ${dbErrorHandler.sanitizeErrorForLogging(error)}`);
        throw error;
      } finally {
        client.release();
      }
    });
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('✅ Database connection successful:', result.rows[0]);
      return true;
    } catch (error) {
      const dbError = dbErrorHandler.handleConnectionError(error);
      console.error(`❌ Database connection test failed: ${dbError.message}`);
      console.error(`🔍 Error details: ${dbErrorHandler.sanitizeErrorForLogging(error)}`);
      return false;
    }
  }
}

export const db = DatabaseConnection.getInstance();