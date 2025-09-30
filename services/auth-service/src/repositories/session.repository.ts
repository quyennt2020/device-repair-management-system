import crypto from 'crypto';
import { db } from '@drms/shared-database';
import { UserSession } from '@drms/shared-types';

export class SessionRepository {
  async createSession(sessionData: {
    userId: string;
    deviceInfo: any;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<UserSession> {
    try {
      const refreshToken = crypto.randomBytes(64).toString('hex');
      const accessTokenJti = crypto.randomUUID();

      const result = await db.query(`
        INSERT INTO user_sessions (
          user_id, 
          refresh_token, 
          access_token_jti, 
          device_info, 
          ip_address, 
          user_agent, 
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        sessionData.userId,
        refreshToken,
        accessTokenJti,
        JSON.stringify(sessionData.deviceInfo),
        sessionData.ipAddress,
        sessionData.userAgent,
        sessionData.expiresAt
      ]);

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async findById(sessionId: string): Promise<UserSession | null> {
    try {
      const result = await db.query(`
        SELECT * FROM user_sessions WHERE id = $1
      `, [sessionId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      console.error('Error finding session by ID:', error);
      throw error;
    }
  }

  async findByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    try {
      const result = await db.query(`
        SELECT * FROM user_sessions WHERE refresh_token = $1
      `, [refreshToken]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      console.error('Error finding session by refresh token:', error);
      throw error;
    }
  }

  async updateSession(sessionId: string, updates: {
    refreshToken?: string;
    lastUsedAt?: Date;
  }): Promise<void> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.refreshToken !== undefined) {
        updateFields.push(`refresh_token = $${paramIndex++}`);
        values.push(updates.refreshToken);
      }

      if (updates.lastUsedAt !== undefined) {
        updateFields.push(`last_used_at = $${paramIndex++}`);
        values.push(updates.lastUsedAt);
      }

      if (updateFields.length === 0) {
        return;
      }

      values.push(sessionId);

      await db.query(`
        UPDATE user_sessions 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, values);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await db.query(`
        DELETE FROM user_sessions WHERE id = $1
      `, [sessionId]);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  async deleteUserSessions(userId: string): Promise<void> {
    try {
      await db.query(`
        DELETE FROM user_sessions WHERE user_id = $1
      `, [userId]);
    } catch (error) {
      console.error('Error deleting user sessions:', error);
      throw error;
    }
  }

  async deleteExpiredSessions(): Promise<number> {
    try {
      const result = await db.query(`
        DELETE FROM user_sessions WHERE expires_at < NOW()
      `);

      return result.rowCount || 0;
    } catch (error) {
      console.error('Error deleting expired sessions:', error);
      throw error;
    }
  }

  async getUserActiveSessions(userId: string): Promise<UserSession[]> {
    try {
      const result = await db.query(`
        SELECT * FROM user_sessions 
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY last_used_at DESC
      `, [userId]);

      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      console.error('Error getting user active sessions:', error);
      throw error;
    }
  }

  private mapRowToSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      refreshToken: row.refresh_token,
      accessTokenJti: row.access_token_jti,
      deviceInfo: typeof row.device_info === 'string' ? JSON.parse(row.device_info) : row.device_info,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      expiresAt: row.expires_at,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }
}