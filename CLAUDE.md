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
- **device-service**: Device registration, history, and tracking
- **document-service** (port 3006): Document templates, dynamic forms, and validation
- **technician-service**: Technician management, skills, and availability
- **auth-service**: Authentication and authorization

**Planned Services:**
- **inventory-service**: Spare parts inventory management
- **tools-service**: Service tools tracking
- **contract-service**: Service contracts and SLA definitions

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

**Shared database** accessed by all services via connection pooling.

Key table groups (see `shared/database/migrations/`):
- Workflow tables (`001_create_workflow_tables.ts`)
- Master data (device types, locations, etc.) (`002_create_master_data_tables.ts`)
- Case tables (`003_create_case_tables.ts`)
- Document tables (`004_create_document_tables.ts`)
- Inventory, tools, contract tables
- Auth and user tables (`008_create_auth_tables.ts`)
- Approval workflow tables (`013_create_approval_workflow_tables.ts`)

**Migration commands**:
```bash
npm run db:migrate    # Run migrations
npm run db:seed       # Seed data
```

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

Each service includes tests with Jest:
- Unit tests: Business logic and services
- Integration tests: API endpoints
- Test files: `**/*.test.ts`, `**/*.spec.ts`

Coverage collected from `src/**/*.ts` excluding test files.

## Infrastructure Services

Started via Docker Compose (`docker-compose.yml`):
- **PostgreSQL** (port 5432): Main database
- **Redis** (port 6379): Caching and session storage
- **Elasticsearch** (port 9200/9300): Search and analytics
- **MinIO** (port 9000/9001): S3-compatible object storage for documents/images

## Key Configuration

### Environment Variables
See `.env.example` for all configuration options.

Important variables per service:
- `PORT`: Service port
- `NODE_ENV`: development/production/test
- `DATABASE_URL` or `DB_*`: Database connection
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
- All services share a single PostgreSQL database with different table groups
- Services are designed to run independently but share database connection
- Web app proxies API requests to api-gateway (port 3001)
- Type definitions are centralized in `@drms/shared-types` - always import from there
- Database migrations must be run before starting services
- Health checks are available at `http://localhost:{PORT}/health` for each service