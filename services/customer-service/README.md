# Customer Service

Customer management service for the device repair management system. This service handles all customer-related operations including customer profiles, contacts, addresses, preferences, and service level management.

## Features

### Core Customer Management
- **Customer CRUD Operations**: Create, read, update, and delete customer profiles
- **Customer Search**: Advanced search with filters by type, tier, status, industry, etc.
- **Customer History**: Complete audit trail of all customer-related events
- **Customer Metrics**: Performance metrics including case statistics, revenue, satisfaction ratings

### Contact Management
- **Multiple Contacts**: Support for multiple contact persons per customer
- **Contact Roles**: Technical, purchasing, management, finance, operations roles
- **Primary Contact**: Designation of primary contact person
- **Contact Information**: Email, phone, mobile, title, department

### Address Management
- **Multiple Addresses**: Support for multiple addresses per customer
- **Address Types**: Billing, shipping, service, headquarters addresses
- **Default Address**: Designation of default address
- **Location Information**: Complete address details with contact person

### Customer Preferences
- **Preferred Technicians**: Customer can specify preferred technicians
- **Service Time Preferences**: Preferred service time windows
- **Communication Preferences**: Email, SMS, phone preferences with notification types
- **Special Instructions**: Custom instructions for service delivery

### Service Level Management
- **Customer Tiers**: Platinum, Gold, Silver, Bronze tiers
- **SLA Configuration**: Automatic SLA assignment based on customer tier
- **Service Priority**: Priority assignment based on tier
- **Tier History**: Track tier changes with audit trail

## API Endpoints

### Customer Management
```
POST   /api/customers                    # Create customer
GET    /api/customers/search             # Search customers
GET    /api/customers/:id                # Get customer by ID
GET    /api/customers/code/:code         # Get customer by code
PUT    /api/customers/:id                # Update customer
GET    /api/customers/:id/history        # Get customer history
GET    /api/customers/:id/metrics        # Get customer metrics
GET    /api/customers/:id/service-level  # Get service level info
PUT    /api/customers/:id/tier           # Update customer tier
```

### Contact Management
```
POST   /api/customers/:id/contacts              # Add contact
GET    /api/customers/:id/contacts              # Get contacts
PUT    /api/customers/contacts/:contactId       # Update contact
DELETE /api/customers/contacts/:contactId       # Delete contact
PUT    /api/customers/:id/contacts/:contactId/primary  # Set primary contact
```

### Address Management
```
POST   /api/customers/:id/addresses             # Add address
GET    /api/customers/:id/addresses             # Get addresses
PUT    /api/customers/addresses/:addressId      # Update address
DELETE /api/customers/addresses/:addressId      # Delete address
PUT    /api/customers/:id/addresses/:addressId/default  # Set default address
```

### Preferences Management
```
GET    /api/customers/:id/preferences           # Get preferences
PUT    /api/customers/:id/preferences           # Update preferences
```

## Database Schema

### Main Tables
- `customers` - Core customer information
- `customer_contacts` - Customer contact persons
- `customer_addresses` - Customer addresses
- `customer_preferences` - Customer preferences and settings
- `customer_history` - Audit trail of customer events

### Key Features
- **Audit Trail**: All changes are logged with timestamps and user information
- **Referential Integrity**: Foreign key constraints ensure data consistency
- **Unique Constraints**: Prevent duplicate primary contacts and default addresses
- **Indexes**: Optimized for common query patterns

## Service Integration

### Requirements Mapping
This service implements the following requirements:

**Requirement 4.1**: Customer profile creation with company and contact management
- ✅ Create customer profiles with complete company information
- ✅ Manage multiple contact persons with roles and responsibilities
- ✅ Support both individual and company customer types

**Requirement 4.2**: Customer history tracking with service and contract information
- ✅ Complete audit trail of all customer events
- ✅ Integration with case and contract services for comprehensive history
- ✅ Performance metrics and service statistics

**Requirement 4.3**: Automatic SLA and pricing application for contracted customers
- ✅ Service level determination based on customer tier
- ✅ Integration points for contract and SLA services
- ✅ Automatic priority assignment

**Requirement 4.4**: Preferred technician and service preference loading
- ✅ Customer preferences management
- ✅ Preferred technician assignment
- ✅ Service time preferences and special instructions

**Requirement 4.5**: Service level updates based on tier changes
- ✅ Customer tier management with history tracking
- ✅ Automatic service level recalculation
- ✅ Notification of tier changes for dependent services

## Usage Examples

### Create Customer
```javascript
POST /api/customers
{
  "customerCode": "CUST-001",
  "customerType": "company",
  "companyName": "ABC Technology Ltd",
  "taxCode": "0123456789",
  "industry": "Technology",
  "contactInfo": {
    "name": "John Doe",
    "email": "john@abc.com",
    "phone": "+84-123-456-789"
  },
  "addressInfo": [{
    "addressType": "headquarters",
    "addressName": "Head Office",
    "streetAddress": "123 Tech Street",
    "city": "Ho Chi Minh City",
    "country": "Vietnam",
    "isDefault": true
  }],
  "customerTier": "gold",
  "creditLimit": 100000
}
```

### Update Customer Preferences
```javascript
PUT /api/customers/:id/preferences
{
  "preferredTechnicians": ["tech-001", "tech-002"],
  "preferredServiceTimes": [{
    "dayOfWeek": 1,
    "startTime": "08:00",
    "endTime": "17:00"
  }],
  "communicationPreferences": {
    "email": true,
    "sms": false,
    "phone": true,
    "preferredLanguage": "vi",
    "notificationTypes": ["case_created", "case_completed"]
  },
  "specialInstructions": "Please coordinate with security before entering premises"
}
```

## Development

### Setup
```bash
cd services/customer-service
npm install
npm run dev
```

### Testing
```bash
npm test
npm run test:watch
```

### Build
```bash
npm run build
npm start
```

## Environment Variables

```env
PORT=3004
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=device_repair_db
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key
REDIS_HOST=localhost
REDIS_PORT=6379
```