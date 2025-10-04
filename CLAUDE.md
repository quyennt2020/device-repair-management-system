# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Device Repair Management System (DRMS) - A comprehensive workflow-driven microservices application for managing device repair processes from initial request to completion.

**Stack**: TypeScript, Node.js, Express, PostgreSQL, Redis, Elasticsearch, MinIO, React

## Essential Commands

### Setup and Development
```bash
# Install all workspace dependencies
npm install

# Start infrastructure (PostgreSQL, Redis, Elasticsearch, MinIO)
npm run docker:up

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start all services in development mode
npm run dev

# Stop infrastructure
npm run docker:down
```

### Individual Service Development
```bash
# Work on a specific service
cd services/{service-name}
npm run dev              # Start service in watch mode
npm run build            # Build service
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
```

### Code Quality
```bash
npm run lint             # Lint all code
npm run lint:fix         # Auto-fix linting issues
npm run format           # Format code with Prettier
npm run type-check       # TypeScript type checking
npm test                 # Run all tests
```

### Web Application
```bash
cd web-app
npm start                # Start dev server (localhost:3000)
npm run build            # Build for production
npm test                 # Run tests
```

## Architecture

### Microservices Structure

The system follows a **microservices architecture** with service-oriented design. Each service is independently deployable and communicates via HTTP/REST APIs.

**Core Services:**
- **api-gateway** (port 3001): API gateway, routing, and static web app serving
- **workflow-service** (port 3002): Workflow engine, execution, monitoring, and visualization
- **case-service** (port 3003): Repair case management, technician assignment, and SLA tracking
- **customer-service** (port 3004): Customer management and relationship tracking
- **device-service** (port 3005): Device registration, history, and tracking
- **document-service** (port 3006): Document templates, dynamic forms, and validation
- **technician-service** (port 3007): Technician management, skills, and availability
- **auth-service** (port 3008): Authentication and authorization
- **inventory-service** (port 3009): Spare parts inventory management
- **data-integration-service** (port 3010): External system integrations and data synchronization

### Shared Libraries

Located in `shared/` directory, used across all services:

- **@drms/shared-types**: Centralized TypeScript type definitions for all domain models (workflow, case, document, customer, device, technician, etc.)
- **@drms/shared-database**: Database connection utilities, migration runner, and seed data

Each service imports types via `@drms/shared-types` and database utilities via `@drms/shared-database`.

### Workflow System

The workflow service is the **orchestration engine** for repair processes:

- **Workflow Definitions**: Define steps, transitions, and conditions
- **Workflow Templates**: Reusable workflow blueprints per device/service type
- **Workflow Execution**: State machine execution with automatic transitions
- **Workflow Monitoring**: Real-time state tracking, SLA monitoring, and alerting
- **Workflow Debugging**: Step-by-step debugging, state inspection, and error analysis
- **Workflow Visualization**: Visual DAG representation of workflow states

Services available in `services/workflow-service/src/services/`:
- `workflow-definition.service.ts`: CRUD for workflow definitions
- `workflow-template.service.ts`: Template management and versioning
- `workflow-execution.service.ts`: Workflow instance execution and state management
- `workflow-monitoring.service.ts`: Real-time monitoring and metrics
- `workflow-debugging.service.ts`: Debug tools and state inspection
- `workflow-visualization.service.ts`: Graph generation for workflows
- `workflow-configuration.service.ts`: Runtime configuration
- `workflow-event.service.ts`: Event emission and handling
- `workflow-alerting.service.ts`: SLA and threshold alerting

### Case Management

The case service implements **intelligent technician assignment**:

**Assignment Algorithm** (see case-service README):
- Skill matching (40%): Technician expertise vs device type/category
- Workload balancing (30%): Current cases vs maximum capacity
- Availability (20%): Active status and schedule
- Location proximity (10%): For onsite services

**SLA Management**: Automatic calculation based on priority, breach detection, and escalation.

### Document Management

The document service provides **dynamic form generation**:

- Document types are templates that define sections, fields, and validation rules
- Forms are generated dynamically based on device type + document category
- Field types are auto-detected from field names (e.g., 'email' → email field, 'notes' → textarea)
- Template inheritance allows creating specialized document types
- Validation rules: required, min_length, max_length, pattern, range

**Categories**: inspection_report, repair_report, quotation, maintenance_report, proposal, receipt, quality_report, custom

### Frontend Architecture

React web application in `web-app/`:
- Material-UI (MUI) components
- React Hook Form for forms
- React Query for data fetching
- React Router for navigation
- WebSocket integration for real-time updates (`src/services/websocket.ts`)
- API service layer in `src/services/api.ts`
- Proxies to API gateway at localhost:3001

## Database Schema

**Shared PostgreSQL database** accessed by all services via `@drms/shared-database` package.

**Configuration:**
- Host: localhost
- Port: 5433 (host) → 5432 (container)
- Database: `device_repair_db`
- User: `drms_user`
- Password: `drms_password`

**Total Migrations: 23** (see `shared/database/migrations/`):

**Core Tables (001-012):**
- 001: Workflow tables (definitions, templates, instances, states)
- 002: Master data (customers, device_types, devices, locations)
- 003: Case tables (repair_cases, case_assignments, sla_compliance)
- 004: Document tables (documents, document_types, document_templates)
- 005: Inventory tables (spare_parts, warehouses, stock_levels)
- 006: Tools tables (service_tools, tool_assignments)
- 007: Contract tables (service_contracts, contract_slas)
- 008: Auth tables (users, roles, permissions, sessions)
- 009: Case-workflow integration
- 010: Customer extended tables
- 011: Device history tracking
- 012: Technician tables (technicians, skills, availability)

**Advanced Features (013-018):**
- 013: Approval workflow system (workflows, instances, records, escalations)
- 014: Enhanced inventory transaction management
- 015: Enhanced quotation management (revisions, comparisons, approvals)
- 016: Repair report tables
- 017: Maintenance report tables
- 018: Data integration tables

**Database Improvements (019-023):**
- 019: SLA tables (sla_definitions, sla_metrics)
- 020: Missing foreign key constraints
- 021: Normalized customer data (customer_contacts, customer_addresses)
- 022: Soft delete support (deleted_at, deleted_by columns)
- 023: Fixed CASCADE delete strategy (changed to RESTRICT for critical FKs)

**Key Features:**
- Soft delete on 10+ critical tables (users, customers, devices, etc.)
- Normalized customer contacts and addresses (no more JSONB)
- Proper FK constraints with RESTRICT on critical relationships
- Auto-generated quotation numbers (QT-YYYY-NNNN format)
- Comprehensive indexes for performance

**Migration commands**:
```bash
npm run db:migrate         # Run all 23 migrations
npm run db:seed            # Seed master data and samples
npm run db:check           # Check database connection
npm run db:status          # Check migration status
```

See `DATABASE_FIX_SUMMARY.md` for complete details on recent database improvements.

## Development Patterns

### Service Structure
Each service follows this structure:
```
services/{service-name}/
├── src/
│   ├── index.ts              # Entry point with Express setup
│   ├── config/               # Configuration and environment
│   ├── routes/               # Express route handlers
│   ├── services/             # Business logic services
│   ├── middleware/           # Custom middleware
│   └── tests/                # Tests
├── package.json
└── tsconfig.json
```

### Adding a New Service

1. Create service directory in `services/`
2. Add to npm workspaces in root `package.json`
3. Import shared types: `import { Type } from '@drms/shared-types'`
4. Import database: `import { db } from '@drms/shared-database'`
5. Set up Express with health check at `/health`
6. Add service to `docker-compose.yml` if needed
7. Configure service URL in related services (e.g., `AUTH_SERVICE_URL`)

### Service Communication

Services communicate via HTTP REST APIs. Service URLs are configured via environment variables (e.g., `WORKFLOW_SERVICE_URL`, `CUSTOMER_SERVICE_URL`).

### Error Handling

All services implement:
- Express error middleware for consistent error responses
- Health check endpoints at `/health`
- Rate limiting
- Request logging
- Graceful shutdown handlers (SIGTERM, SIGINT)

### TypeScript Paths

Path aliases configured in `tsconfig.json`:
- `@shared/*` → `./shared/*/src`
- `@services/*` → `./services/*/src`
- `@apps/*` → `./apps/*/src`

## Testing

### Service Tests
Each service includes tests with Jest:
- Unit tests: Business logic and services
- Integration tests: API endpoints
- Test files: `**/*.test.ts`, `**/*.spec.ts`

Coverage collected from `src/**/*.ts` excluding test files.

### Centralized Testing
The `testing/` directory contains comprehensive test suites:
```bash
npm run test:unit          # Run unit tests
npm run test:integration   # Run integration tests
npm run test:e2e           # Run end-to-end tests
npm run test:performance   # Run performance tests
npm run test:stress        # Run stress tests
npm run test:all           # Run all test suites
npm run test:ci            # CI-specific test run
npm run test:coverage      # Generate coverage report
```

## Infrastructure Services

Started via Docker Compose (`docker-compose.yml`):
- **PostgreSQL** (port 5433→5432): Main database `device_repair_db`
  - User: drms_user / Password: drms_password
  - Volume: postgres-data (persistent)
  - From host: `localhost:5433`
  - From Docker: `postgres:5432`
- **Redis** (port 6379): Caching and session storage
- **Elasticsearch** (port 9200/9300): Search and analytics
- **MinIO** (port 9000/9001): S3-compatible object storage for documents/images

**Important**: All services now use `@drms/shared-database` package for database connections. This package handles connection pooling, retry logic, and error handling automatically.

## Key Configuration

### Environment Variables
See `.env.example` for all configuration options.

Important variables per service:
- `PORT`: Service port
- `NODE_ENV`: development/production/test
- `DATABASE_URL` or `DB_*`: Database connection
  - Note: Use port 5433 when connecting from host machine
  - Use `postgres:5432` when connecting from within Docker
- `REDIS_URL` or `REDIS_*`: Redis connection
- `{SERVICE}_URL`: Other service endpoints
- `JWT_SECRET`: Authentication secret

### SLA Hours (Case Service)
- Low priority: 168 hours (7 days)
- Medium priority: 72 hours (3 days)
- High priority: 24 hours
- Urgent: 4 hours

### Technician Assignment
- `MAX_CASES_PER_TECHNICIAN`: Default 10
- `AUTO_ASSIGN_TECHNICIANS`: Enable/disable auto-assignment

## Important Notes

- This is a **monorepo using npm workspaces** - install dependencies at root level
- All services share a single PostgreSQL database `device_repair_db` on port 5433
- **All services use `@drms/shared-database`** for database connections - no custom pools needed
- Database has **23 migrations** including recent improvements (soft delete, normalized data, FK constraints)
- Web app proxies API requests to api-gateway (port 3001)
- Type definitions are centralized in `@drms/shared-types` - always import from there
- **Docker Desktop must be running** before starting infrastructure
- Database migrations must be run before starting services: `npm run db:migrate`
- Seed data with: `npm run db:seed`
- Health checks are available at `http://localhost:{PORT}/health` for each service
- See `DATABASE_FIX_SUMMARY.md` for recent database improvements

## Troubleshooting

### Database Connection Issues

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
1. **Start Docker Desktop first** - Docker must be running
2. Start infrastructure: `npm run docker:up`
3. Verify containers are running: `docker ps` (should see postgres container)
4. Check if using correct port:
   - From host machine: `localhost:5433`
   - From Docker containers: `postgres:5432`
5. Verify credentials:
   - Database: `device_repair_db`
   - User: `drms_user`
   - Password: `drms_password`
6. Check database status: `npm run db:check`
7. Restart Docker services: `npm run docker:down && npm run docker:up`

### Migration Issues

**Problem**: Migrations fail or won't run

**Solutions**:
1. Ensure Docker Desktop and PostgreSQL are running
2. Check database connection: `npm run db:check`
3. Run migrations: `npm run db:migrate`
4. All 23 migrations should run in sequence
5. Check for TypeScript errors in migration files
6. See `DATABASE_FIX_SUMMARY.md` for migration details

### TypeScript Build Errors

**Problem**: Services fail to compile

**Solutions**:
1. Install dependencies: `npm install` (at root level)
2. Build shared packages first: `cd shared/database && npm run build`
3. Ensure `@drms/shared-database` and `@drms/shared-types` are built
4. Check tsconfig.json module resolution settings
3. Check migration order in `shared/database/migrations/`
4. Verify database connection: `npm run db:check`

### Service Startup Issues

**Problem**: Services fail to start

**Solutions**:
1. Ensure all infrastructure services are running: `npm run docker:up`
2. Run migrations: `npm run db:migrate`
3. Check if ports are already in use
4. Verify environment variables in `.env`
5. Check service logs: `npm run docker:logs`