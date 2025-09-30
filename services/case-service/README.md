# Case Service

The Case Service is a core component of the Device Repair Management System (DRMS) that handles all case-related operations including case creation, management, technician assignment, and workflow integration.

## Features

### Core Case Management
- **Case Creation**: Create repair cases with automatic case number generation
- **Case Lifecycle**: Track cases through various statuses (open, assigned, in_progress, completed, etc.)
- **Case Updates**: Update case details, priority, and status
- **Case Search**: Advanced filtering and search capabilities with pagination
- **Case Statistics**: Comprehensive analytics and reporting

### Technician Assignment
- **Smart Assignment**: Intelligent technician assignment based on skills, workload, and availability
- **Workload Balancing**: Automatic workload distribution among technicians
- **Performance Tracking**: Monitor technician performance metrics
- **Assignment Validation**: Ensure technicians don't exceed maximum case limits

### Integration Features
- **Workflow Integration**: Seamless integration with workflow service for automated processes
- **Notification System**: Real-time notifications for case events
- **Timeline Tracking**: Complete audit trail of case activities
- **Note Management**: Internal and customer-facing notes with privacy controls

## API Endpoints

### Case Management
- `POST /api/cases` - Create a new case
- `GET /api/cases` - Get cases with filtering and pagination
- `GET /api/cases/:id` - Get case details by ID
- `PUT /api/cases/:id` - Update case details
- `PATCH /api/cases/:id/status` - Update case status
- `DELETE /api/cases/:id` - Soft delete case (Admin only)

### Case Activities
- `POST /api/cases/:id/notes` - Add note to case
- `GET /api/cases/:id/notes` - Get case notes
- `GET /api/cases/:id/timeline` - Get case timeline
- `PATCH /api/cases/:id/assign` - Assign technician to case

### Analytics
- `GET /api/cases/statistics` - Get case statistics and metrics

### Technician Assignment
- `GET /api/technician-assignment/available` - Get available technicians
- `POST /api/technician-assignment/auto-assign` - Auto-assign technician
- `GET /api/technician-assignment/workload/:id` - Get technician workload
- `GET /api/technician-assignment/performance/:id` - Get performance metrics
- `GET /api/technician-assignment/suggestions` - Get reassignment suggestions

## Configuration

The service uses environment variables for configuration:

```env
# Server Configuration
CASE_SERVICE_PORT=3003
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# External Services
AUTH_SERVICE_URL=http://localhost:3001
WORKFLOW_SERVICE_URL=http://localhost:3002
NOTIFICATION_SERVICE_URL=http://localhost:3004

# Case Configuration
DEFAULT_CASE_PRIORITY=medium
AUTO_ASSIGN_TECHNICIANS=true
MAX_CASES_PER_TECHNICIAN=10

# SLA Configuration (in hours)
SLA_LOW_HOURS=168
SLA_MEDIUM_HOURS=72
SLA_HIGH_HOURS=24
SLA_URGENT_HOURS=4

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
MAX_FILES_PER_CASE=20

# Notifications
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=false
ENABLE_PUSH_NOTIFICATIONS=true

# Integrations
ENABLE_WORKFLOW_INTEGRATION=true
ENABLE_INVENTORY_INTEGRATION=true
ENABLE_CONTRACT_INTEGRATION=true
```

## Authentication & Authorization

The service implements role-based access control:

- **Customer**: Can create cases for themselves, view own cases, add customer notes
- **Technician**: Can view assigned cases, update case status, add technician notes
- **Staff**: Can manage all cases, assign technicians, access analytics
- **Admin**: Full access to all features including case deletion

## Data Models

### Case
```typescript
interface RepairCase {
  id: UUID;
  caseNumber: string;
  customerId: UUID;
  deviceId: UUID;
  assignedTechnicianId?: UUID;
  title: string;
  description: string;
  priority: CasePriority;
  status: CaseStatus;
  category: string;
  subcategory?: string;
  reportedIssue: string;
  resolution?: string;
  slaDueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  createdBy: UUID;
  metadata: Record<string, any>;
}
```

### Case Statistics
```typescript
interface CaseStatistics {
  totalCases: number;
  openCases: number;
  inProgressCases: number;
  completedCases: number;
  overdueCase: number;
  averageResolutionTime: number;
  casesByPriority: Record<CasePriority, number>;
  casesByStatus: Record<CaseStatus, number>;
  technicianWorkload: TechnicianWorkload[];
}
```

## Business Logic

### Case Creation Flow
1. Validate customer and device existence
2. Generate unique case number
3. Calculate SLA due date based on priority
4. Auto-assign technician if enabled
5. Start workflow process if integration enabled
6. Send creation notifications
7. Log timeline entry

### Technician Assignment Algorithm
The smart assignment system considers:
- **Skill Matching** (40%): Technician skills vs. device type/category
- **Workload Balancing** (30%): Current active cases vs. maximum limit
- **Availability** (20%): Technician active status and schedule
- **Location Proximity** (10%): Distance for onsite services

### SLA Management
- Automatic SLA calculation based on priority levels
- SLA breach detection and notifications
- SLA recalculation when priority changes
- Overdue case highlighting in listings

## Error Handling

The service implements comprehensive error handling:
- Input validation with detailed error messages
- Database constraint violation handling
- External service integration error handling
- Graceful degradation for non-critical features

## Performance Considerations

- Database query optimization with proper indexing
- Pagination for large result sets
- Caching for frequently accessed data
- Background processing for heavy operations
- Connection pooling for database connections

## Testing

Run tests with:
```bash
npm test
npm run test:watch
npm run test:coverage
```

## Development

Start development server:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

## Dependencies

- **Express**: Web framework
- **TypeScript**: Type safety
- **PostgreSQL**: Database
- **JWT**: Authentication
- **Express Validator**: Input validation
- **Multer**: File uploads
- **Sharp**: Image processing

## Health Check

The service provides a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "service": "case-service",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```