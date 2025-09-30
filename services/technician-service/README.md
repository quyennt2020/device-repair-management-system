# Technician Management Service

This service manages technician profiles, skills, certifications, performance tracking, workload monitoring, and capacity planning for the Device Repair Management System.

## Features

### Core Technician Management
- ✅ Technician profile management with skills and certifications
- ✅ Technician search and filtering
- ✅ Team hierarchy management (supervisors and team members)
- ✅ Department and location-based organization
- ✅ Technician status management (active, inactive, on leave)

### Performance Tracking
- ✅ Performance metrics calculation and storage
- ✅ Performance history tracking
- ✅ Performance comparison between technicians
- ✅ Top performers identification
- ✅ Performance report generation with trends and recommendations

### Workload Management
- ✅ Daily workload tracking and calculation
- ✅ Capacity planning and utilization monitoring
- ✅ Overload detection and alerting
- ✅ Workload distribution analysis
- ✅ Workload balancing recommendations

### Scheduled Jobs
- ✅ Daily workload calculation
- ✅ Weekly and monthly performance calculation
- ✅ Overload monitoring and alerting
- ✅ Certificate expiry checking

### Skills & Certifications (Planned)
- 🔄 Skill management with proficiency levels
- 🔄 Certification tracking with expiry dates
- 🔄 Skill-based technician matching
- 🔄 Certification compliance monitoring

### Availability & Scheduling (Planned)
- 🔄 Technician availability management
- 🔄 Schedule management and calendar integration
- 🔄 Appointment scheduling
- 🔄 Time tracking and reporting

## API Endpoints

### Technician Management
```
POST   /api/technicians                    - Create technician
GET    /api/technicians/:id               - Get technician by ID
GET    /api/technicians/employee/:id      - Get technician by employee ID
PUT    /api/technicians/:id               - Update technician
GET    /api/technicians                   - Search technicians
GET    /api/technicians/available/search  - Get available technicians
GET    /api/technicians/:id/profile       - Get technician profile
GET    /api/technicians/:id/summary       - Get technician summary
DELETE /api/technicians/:id               - Delete technician
```

### Performance Management
```
POST   /api/technicians/performance                    - Create performance record
GET    /api/technicians/performance/:id               - Get performance record
PUT    /api/technicians/performance/:id               - Update performance record
GET    /api/technicians/:id/performance/history       - Get performance history
GET    /api/technicians/:id/performance/metrics       - Get performance metrics
GET    /api/technicians/performance/top-performers    - Get top performers
GET    /api/technicians/:id/performance/report        - Generate performance report
POST   /api/technicians/performance/compare           - Compare performance
```

### Workload Management
```
POST   /api/technicians/workload                      - Create workload record
PUT    /api/technicians/workload/:id                  - Update workload record
POST   /api/technicians/workload/upsert               - Upsert workload record
GET    /api/technicians/:id/workload                  - Get technician workload
GET    /api/technicians/workload/overloaded/list      - Get overloaded technicians
GET    /api/technicians/:id/workload/summary          - Get workload summary
GET    /api/technicians/workload/capacity-planning/report - Capacity planning report
GET    /api/technicians/workload/distribution/current - Get workload distribution
GET    /api/technicians/workload/balance/recommendations - Workload balancing
```

## Database Schema

### Core Tables
- `technicians` - Technician profiles and basic information
- `technician_skills` - Skills with proficiency levels
- `technician_certifications` - Certifications with expiry tracking
- `technician_availability` - Daily availability and schedules
- `technician_performance` - Performance metrics by period
- `technician_workload` - Daily workload tracking
- `technician_schedule` - Appointments and scheduled activities

## Configuration

### Environment Variables
```bash
PORT=3006
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repair_management
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-jwt-secret
```

### Required Permissions
- `technician:create` - Create technicians
- `technician:read` - View technician information
- `technician:update` - Update technician information
- `technician:delete` - Delete technicians
- `technician:performance:*` - Performance management
- `technician:workload:*` - Workload management
- `technician:skills:*` - Skills management
- `technician:certifications:*` - Certification management

## Usage Examples

### Create a Technician
```javascript
const technician = await fetch('/api/technicians', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    employeeId: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+1234567890',
    hireDate: '2024-01-01',
    department: 'Technical Services',
    position: 'Senior Technician',
    baseLocation: 'Main Office',
    hourlyRate: 25.00
  })
});
```

### Get Performance Report
```javascript
const report = await fetch(
  `/api/technicians/${technicianId}/performance/report?periodStart=2024-01-01&periodEnd=2024-01-31`,
  {
    headers: { 'Authorization': 'Bearer ' + token }
  }
);
```

### Check Workload Distribution
```javascript
const distribution = await fetch(
  `/api/technicians/workload/distribution/current?date=2024-01-15&department=Technical Services`,
  {
    headers: { 'Authorization': 'Bearer ' + token }
  }
);
```

## Integration Points

### With Case Service
- Receives case assignment notifications
- Updates workload based on case assignments
- Provides technician availability for case routing

### With Auth Service
- Validates user permissions
- Links technicians to user accounts
- Manages role-based access control

### With Workflow Service
- Provides technician skills for workflow step requirements
- Validates technician qualifications for workflow assignments

## Development

### Setup
```bash
cd services/technician-service
npm install
npm run dev
```

### Testing
```bash
npm test
npm run test:watch
```

### Building
```bash
npm run build
npm start
```

## Monitoring

The service includes:
- Health check endpoint at `/health`
- Performance metrics tracking
- Workload monitoring with alerts
- Scheduled job status logging
- Error tracking and reporting

## Future Enhancements

1. **Advanced Analytics**
   - Predictive performance modeling
   - Skill gap analysis
   - Capacity forecasting

2. **Mobile Integration**
   - Technician mobile app support
   - Real-time location tracking
   - Mobile performance reporting

3. **AI-Powered Features**
   - Intelligent workload balancing
   - Performance optimization suggestions
   - Automated skill development recommendations

4. **Integration Enhancements**
   - HR system integration
   - Training system integration
   - Customer feedback integration