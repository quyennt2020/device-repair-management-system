# Device Repair Management System (DRMS)

A comprehensive workflow-driven system for managing device repair processes, from initial request to completion.

## Architecture

This system is built using a microservices architecture with the following key components:

- **Workflow Engine**: Core workflow management and execution
- **Case Service**: Repair case lifecycle management
- **Document Service**: Document creation, approval, and management
- **Customer Service**: Customer information and relationship management
- **Device Service**: Device registration and history tracking
- **Technician Service**: Technician management and assignment
- **Inventory Service**: Spare parts inventory management
- **Tools Service**: Service tools tracking and assignment
- **Contract Service**: Service contracts and SLA management

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 15+

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Start infrastructure services:**
   ```bash
   npm run docker:up
   ```

3. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Seed development data:**
   ```bash
   npm run db:seed
   ```

5. **Start development servers:**
   ```bash
   npm run dev
   ```

### Available Services

- **API Gateway**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Elasticsearch**: http://localhost:9200
- **MinIO Console**: http://localhost:9001

## Project Structure

```
device-repair-management-system/
├── services/                 # Microservices
│   ├── api-gateway/         # API Gateway and authentication
│   ├── workflow-service/    # Workflow engine
│   ├── case-service/        # Case management
│   ├── document-service/    # Document management
│   ├── customer-service/    # Customer management
│   ├── device-service/      # Device management
│   ├── technician-service/  # Technician management
│   ├── inventory-service/   # Inventory management
│   ├── tools-service/       # Service tools management
│   └── contract-service/    # Contract and SLA management
├── shared/                  # Shared libraries
│   ├── types/              # TypeScript type definitions
│   ├── database/           # Database utilities and migrations
│   └── utils/              # Common utilities
├── apps/                   # Client applications
│   ├── web-app/           # React web application
│   └── mobile-app/        # React Native mobile app
└── docs/                  # Documentation
```

## Development

### Scripts

- `npm run dev` - Start all services in development mode
- `npm run build` - Build all services
- `npm run test` - Run tests for all services
- `npm run lint` - Lint all code
- `npm run format` - Format code with Prettier
- `npm run docker:up` - Start infrastructure services
- `npm run docker:down` - Stop infrastructure services

### Testing

Each service includes comprehensive testing:

- **Unit Tests**: Business logic and domain services
- **Integration Tests**: API endpoints and database operations
- **End-to-End Tests**: Complete user workflows

Run tests with:
```bash
npm run test
```

### Code Quality

The project uses:

- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** for type safety
- **Husky** for git hooks (pre-commit, pre-push)

## Key Features

### Workflow Management
- Configurable workflows per device type and service type
- Support for warranty vs non-warranty repair flows
- Automatic technician assignment based on skills and availability
- Real-time workflow monitoring and debugging

### Document Management
- Dynamic document templates based on device types
- Multi-level approval workflows
- Rich document editing with image support
- Maintenance checklists with configurable templates

### Smart Assignment
- Skill-based technician matching
- Workload balancing
- Tool availability checking
- Location optimization for onsite services

### SLA Management
- Real-time SLA monitoring
- Automatic escalation and notifications
- Compliance reporting and penalty calculation
- Contract-based service level differentiation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.