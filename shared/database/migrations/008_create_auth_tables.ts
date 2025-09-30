import { Migration } from '../src/migrations';

export const createAuthTables: Migration = {
  id: '008',
  name: 'Create authentication and authorization tables',
  
  async up(client) {
    // Users table
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        email_verified BOOLEAN DEFAULT false,
        email_verified_at TIMESTAMP,
        last_login_at TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        password_changed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Roles table
    await client.query(`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Permissions table
    await client.query(`
      CREATE TABLE permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        resource VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // User roles junction table
    await client.query(`
      CREATE TABLE user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        UNIQUE(user_id, role_id)
      );
    `);

    // Role permissions junction table
    await client.query(`
      CREATE TABLE role_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(role_id, permission_id)
      );
    `);

    // User sessions table
    await client.query(`
      CREATE TABLE user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(500) UNIQUE NOT NULL,
        access_token_jti VARCHAR(255) UNIQUE NOT NULL,
        device_info JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        last_used_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Password reset tokens table
    await client.query(`
      CREATE TABLE password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Email verification tokens table
    await client.query(`
      CREATE TABLE email_verification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Audit log table
    await client.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_status ON users(status);
      CREATE INDEX idx_users_last_login ON users(last_login_at);
      
      CREATE INDEX idx_roles_name ON roles(name);
      CREATE INDEX idx_roles_system ON roles(is_system_role);
      
      CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
      
      CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
      CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
      CREATE INDEX idx_user_roles_expires ON user_roles(expires_at);
      
      CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
      CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
      
      CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
      CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
      CREATE INDEX idx_user_sessions_last_used ON user_sessions(last_used_at);
      
      CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
      
      CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
      CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
      
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
      CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
    `);
  },

  async down(client) {
    await client.query('DROP TABLE IF EXISTS audit_logs CASCADE;');
    await client.query('DROP TABLE IF EXISTS email_verification_tokens CASCADE;');
    await client.query('DROP TABLE IF EXISTS password_reset_tokens CASCADE;');
    await client.query('DROP TABLE IF EXISTS user_sessions CASCADE;');
    await client.query('DROP TABLE IF EXISTS role_permissions CASCADE;');
    await client.query('DROP TABLE IF EXISTS user_roles CASCADE;');
    await client.query('DROP TABLE IF EXISTS permissions CASCADE;');
    await client.query('DROP TABLE IF EXISTS roles CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
  }
};