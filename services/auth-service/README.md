# Authentication & Authorization Service

A comprehensive authentication and authorization service for the Device Repair Management System (DRMS) with role-based access control (RBAC), JWT tokens, and context-aware permissions.

## 🚀 Features

### Authentication
- **JWT Token-based Authentication** with refresh token rotation
- **Password Security** with bcrypt hashing and configurable complexity
- **Account Security** with failed attempt tracking and account locking
- **Email Verification** with token-based verification system
- **Password Reset** with secure time-limited tokens
- **Multi-Session Support** with device tracking

### Authorization
- **Role-Based Access Control (RBAC)** with flexible role and permission system
- **Context-Aware Authorization** - users can only access their own resources
- **Permission Management** with granular permissions for all resources
- **Dynamic Role Assignment** with expiration support
- **Bulk Operations** with proper authorization checks

### Security & Monitoring
- **Comprehensive Audit Logging** of all authentication events
- **Security Monitoring** with failed login tracking and suspicious activity detection
- **Rate Limiting** with role-based limits and operation-specific controls
- **Admin Interface** for user and role management
- **Security Alerts** and compliance reporting

## 📁 Project Structure

```
services/auth-service/
├── src/
│   ├── config/
│   │   └── index.ts              # Configuration management
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT authentication middleware
│   │   ├── authorization.middleware.ts # Authorization middleware
│   │   ├── validation.middleware.ts    # Request validation
│   │   ├── logging.middleware.ts       # Request logging
│   │   ├── error.middleware.ts         # Error handling
│   │   └── rate-limit.middleware.ts    # Rate limiting
│   ├── services/
│   │   ├── auth.service.ts       # Core authentication logic
│   │   ├── user.service.ts       # User management
│   │   ├── role.service.ts       # Role and permission management
│   │   ├── authorization.service.ts # Authorization logic
│   │   ├── admin.service.ts      # Admin operations
│   │   ├── email.service.ts      # Email notifications
│   │   └── audit.service.ts      # Audit logging
│   ├── routes/
│   │   ├── auth.routes.ts        # Authentication endpoints
│   │   ├── user.routes.ts        # User management endpoints
│   │   ├── role.routes.ts        # Role management endpoints
│   │   └── admin.routes.ts       # Admin interface endpoints
│   ├── utils/
│   │   └── auth-test.utils.ts    # Testing utilities
│   ├── seeds/
│   │   └── auth-seeds.ts         # Initial data seeding
│   └── index.ts                  # Main application entry
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## 🔐 Authorization System

### Roles Hierarchy

1. **Admin** - Full system access with all permissions
2. **Manager** - Management access with most permissions except system admin
3. **Technician** - Case and inventory management access
4. **Customer Service** - Customer and case management access
5. **Customer** - Limited access to own cases and information
6. **Viewer** - Read-only access to most resources

### Permission Structure

Permissions follow the format: `resource.action`

**Resources:**
- `users` - User management
- `roles` - Role and permission management
- `cases` - Repair case management
- `customers` - Customer management
- `technicians` - Technician management
- `inventory` - Inventory management
- `documents` - Document management
- `reports` - Reports and analytics
- `system` - System administration
- `audit` - Audit log access

**Actions:**
- `read` - View resources
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Remove resources
- `assign` - Assign resources (cases, roles)
- `admin` - Administrative access

### Context-Aware Authorization

The system implements context-aware authorization where users can only access resources they own or are assigned to:

- **Customers** can only see their own cases and information
- **Technicians** can only access cases assigned to them
- **Customer Service** can access all customers and cases
- **Managers** and **Admins** have broader access based on their roles

## 🛠️ API Endpoints

### Authentication Endpoints (`/api/auth`)

```http
POST /api/auth/login              # User login
POST /api/auth/register           # User registration
POST /api/auth/refresh            # Refresh access token
POST /api/auth/logout             # User logout
POST /api/auth/change-password    # Change password
POST /api/auth/request-password-reset  # Request password reset
POST /api/auth/reset-password     # Reset password with token
POST /api/auth/verify-email       # Verify email address
GET  /api/auth/me                 # Get current user profile
POST /api/auth/validate           # Validate token (for other services)
```

### User Management (`/api/users`)

```http
GET    /api/users/profile         # Get user profile
PUT    /api/users/profile         # Update user profile
GET    /api/users/sessions        # Get user sessions
DELETE /api/users/sessions/:id    # Revoke session
POST   /api/users/resend-verification  # Resend email verification
GET    /api/users                 # List users (admin)
GET    /api/users/:id             # Get user by ID
PATCH  /api/users/:id/deactivate  # Deactivate user (admin)
PATCH  /api/users/:id/reactivate  # Reactivate user (admin)
```

### Role Management (`/api/roles`)

```http
GET    /api/roles                 # List all roles
GET    /api/roles/:id             # Get role by ID
POST   /api/roles                 # Create new role (admin)
PUT    /api/roles/:id             # Update role (admin)
DELETE /api/roles/:id             # Delete role (admin)
POST   /api/roles/assign          # Assign role to user
POST   /api/roles/revoke          # Revoke role from user
GET    /api/roles/user/:id        # Get user roles
GET    /api/roles/permissions/all # Get all permissions
```

### Admin Interface (`/api/admin`)

```http
GET    /api/admin/stats           # System statistics
GET    /api/admin/users           # User management with filters
PATCH  /api/admin/users/:id/suspend    # Suspend user
PATCH  /api/admin/users/:id/unsuspend  # Unsuspend user
PATCH  /api/admin/users/:id/unlock     # Unlock user account
PATCH  /api/admin/users/:id/force-password-reset  # Force password reset
GET    /api/admin/users/:id/activity   # User activity log
GET    /api/admin/security/alerts      # Security alerts
PATCH  /api/admin/users/bulk           # Bulk user operations
```

## 🔧 Usage Examples

### Using Authorization Middleware

```typescript
import { authorize, requireAdmin, requirePermissions } from './middleware/authorization.middleware';

// Require admin role
router.get('/admin-only', requireAdmin, handler);

// Require specific permissions
router.post('/create-case', requirePermissions(['cases.create']), handler);

// Context-aware authorization
router.get('/cases/:caseId', authorize({
  permissions: ['cases.read'],
  contextCheck: AuthorizationContext.canAccessCase
}), handler);

// Self-access or admin
router.get('/users/:userId', authorize({
  roles: ['admin'],
  allowSelf: true,
  selfIdParam: 'userId'
}), handler);
```

### Custom Authorization Logic

```typescript
import { AuthorizationService } from './services/authorization.service';

const authService = new AuthorizationService();

// Check if user has permission
const hasPermission = await authService.hasPermission(
  user,
  'cases',
  'update',
  caseId
);

// Get user's effective permissions
const permissions = await authService.getUserEffectivePermissions(userId);

// Bulk operation authorization
const { allowed, denied } = await authService.canPerformBulkOperation(
  user,
  'cases',
  'delete',
  caseIds
);
```

## 🧪 Testing

The service includes comprehensive testing utilities:

```typescript
import { runAuthorizationTests } from './utils/auth-test.utils';

// Run all authorization tests
await runAuthorizationTests();
```

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Run Database Migrations**
   ```bash
   npm run migrate
   ```

4. **Seed Initial Data**
   ```bash
   npm run seed
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🔒 Security Considerations

- **JWT Secrets** - Use strong, unique secrets in production
- **Password Hashing** - Uses bcrypt with configurable rounds (minimum 12)
- **Rate Limiting** - Implements role-based and operation-specific limits
- **Account Locking** - Automatic locking after failed attempts
- **Audit Logging** - Comprehensive logging of all security events
- **Token Rotation** - Refresh tokens are rotated on each use
- **Session Management** - Sessions can be revoked and tracked

## 📊 Monitoring & Analytics

The service provides comprehensive monitoring capabilities:

- **System Statistics** - User counts, login metrics, security events
- **Security Alerts** - Failed logins, suspicious activity, account locks
- **User Activity** - Detailed activity logs per user
- **Audit Trail** - Immutable log of all authentication events
- **Performance Metrics** - Response times, error rates, throughput

## 🔄 Integration

The authentication service is designed to integrate seamlessly with other DRMS services:

- **Token Validation** - Other services can validate tokens via `/api/auth/validate`
- **User Context** - Provides user information and permissions for authorization
- **Audit Integration** - Centralized audit logging for all services
- **Rate Limiting** - Consistent rate limiting across all services

## 📝 Configuration

Key configuration options:

```typescript
export const config = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
    refreshExpiresIn: '7d'
  },
  
  // Password Security
  password: {
    saltRounds: 12,
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  },
  
  // Account Security
  security: {
    maxFailedAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation as needed
4. Ensure all security checks pass
5. Test authorization scenarios thoroughly

## 📄 License

This project is part of the DRMS system and follows the same licensing terms.