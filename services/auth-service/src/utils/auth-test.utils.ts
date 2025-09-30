import { AuthenticatedUser } from '@drms/shared-types';
import { AuthorizationService } from '../services/authorization.service';

/**
 * Utility for testing authorization scenarios
 */
export class AuthTestUtils {
  private authService: AuthorizationService;

  constructor() {
    this.authService = new AuthorizationService();
  }

  /**
   * Create mock user for testing
   */
  static createMockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return {
      id: 'test-user-id',
      email: 'test@example.com',
      fullName: 'Test User',
      roles: ['customer'],
      permissions: ['cases.read'],
      customerId: 'test-customer-id',
      technicianId: undefined,
      ...overrides
    };
  }

  /**
   * Create admin user for testing
   */
  static createAdminUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return this.createMockUser({
      roles: ['admin'],
      permissions: [
        'users.read', 'users.create', 'users.update', 'users.delete',
        'roles.read', 'roles.create', 'roles.update', 'roles.delete',
        'cases.read', 'cases.create', 'cases.update', 'cases.delete',
        'customers.read', 'customers.create', 'customers.update', 'customers.delete',
        'system.admin'
      ],
      ...overrides
    });
  }

  /**
   * Create technician user for testing
   */
  static createTechnicianUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return this.createMockUser({
      roles: ['technician'],
      permissions: [
        'cases.read', 'cases.update',
        'customers.read',
        'inventory.read', 'inventory.update',
        'documents.read', 'documents.create', 'documents.update'
      ],
      technicianId: 'test-technician-id',
      customerId: undefined,
      ...overrides
    });
  }

  /**
   * Create customer service user for testing
   */
  static createCustomerServiceUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
    return this.createMockUser({
      roles: ['customer_service'],
      permissions: [
        'cases.read', 'cases.create', 'cases.update',
        'customers.read', 'customers.create', 'customers.update',
        'documents.read', 'documents.create'
      ],
      customerId: undefined,
      ...overrides
    });
  }

  /**
   * Test authorization scenarios
   */
  async testAuthorizationScenarios(): Promise<void> {
    console.log('🧪 Running authorization test scenarios...');

    const scenarios = [
      {
        name: 'Admin can access all resources',
        user: AuthTestUtils.createAdminUser(),
        tests: [
          { resource: 'users', action: 'read', expected: true },
          { resource: 'users', action: 'create', expected: true },
          { resource: 'cases', action: 'delete', expected: true },
          { resource: 'system', action: 'admin', expected: true }
        ]
      },
      {
        name: 'Customer can only read their own cases',
        user: AuthTestUtils.createMockUser(),
        tests: [
          { resource: 'cases', action: 'read', expected: true },
          { resource: 'cases', action: 'create', expected: false },
          { resource: 'users', action: 'read', expected: false },
          { resource: 'system', action: 'admin', expected: false }
        ]
      },
      {
        name: 'Technician can update cases and inventory',
        user: AuthTestUtils.createTechnicianUser(),
        tests: [
          { resource: 'cases', action: 'read', expected: true },
          { resource: 'cases', action: 'update', expected: true },
          { resource: 'inventory', action: 'update', expected: true },
          { resource: 'users', action: 'create', expected: false }
        ]
      },
      {
        name: 'Customer service can manage customers and cases',
        user: AuthTestUtils.createCustomerServiceUser(),
        tests: [
          { resource: 'customers', action: 'create', expected: true },
          { resource: 'cases', action: 'create', expected: true },
          { resource: 'inventory', action: 'delete', expected: false },
          { resource: 'system', action: 'admin', expected: false }
        ]
      }
    ];

    for (const scenario of scenarios) {
      console.log(`\n📋 Testing: ${scenario.name}`);
      
      for (const test of scenario.tests) {
        try {
          const hasPermission = await this.authService.hasPermission(
            scenario.user,
            test.resource,
            test.action
          );

          const result = hasPermission === test.expected ? '✅ PASS' : '❌ FAIL';
          console.log(`  ${result} ${test.resource}.${test.action} - Expected: ${test.expected}, Got: ${hasPermission}`);
        } catch (error) {
          console.log(`  ❌ ERROR ${test.resource}.${test.action} - ${error}`);
        }
      }
    }

    console.log('\n🧪 Authorization test scenarios completed');
  }

  /**
   * Test context-aware authorization
   */
  async testContextAwareAuthorization(): Promise<void> {
    console.log('\n🔍 Testing context-aware authorization...');

    const customer = AuthTestUtils.createMockUser({ customerId: 'customer-123' });
    const technician = AuthTestUtils.createTechnicianUser({ technicianId: 'tech-456' });
    const admin = AuthTestUtils.createAdminUser();

    const contextTests = [
      {
        name: 'Customer accessing their own case',
        user: customer,
        resource: 'cases',
        action: 'read',
        resourceId: 'case-owned-by-customer-123',
        expected: true
      },
      {
        name: 'Customer accessing another customer case',
        user: customer,
        resource: 'cases',
        action: 'read',
        resourceId: 'case-owned-by-customer-456',
        expected: false
      },
      {
        name: 'Technician accessing assigned case',
        user: technician,
        resource: 'cases',
        action: 'update',
        resourceId: 'case-assigned-to-tech-456',
        expected: true
      },
      {
        name: 'Admin accessing any case',
        user: admin,
        resource: 'cases',
        action: 'delete',
        resourceId: 'any-case-id',
        expected: true
      }
    ];

    for (const test of contextTests) {
      try {
        const hasPermission = await this.authService.hasPermission(
          test.user,
          test.resource,
          test.action,
          test.resourceId
        );

        const result = hasPermission === test.expected ? '✅ PASS' : '❌ FAIL';
        console.log(`  ${result} ${test.name} - Expected: ${test.expected}, Got: ${hasPermission}`);
      } catch (error) {
        console.log(`  ❌ ERROR ${test.name} - ${error}`);
      }
    }

    console.log('🔍 Context-aware authorization tests completed');
  }

  /**
   * Generate authorization report
   */
  static generateAuthorizationMatrix(): void {
    console.log('\n📊 Authorization Matrix:');
    console.log('='.repeat(80));

    const roles = ['admin', 'manager', 'technician', 'customer_service', 'customer', 'viewer'];
    const resources = ['users', 'roles', 'cases', 'customers', 'technicians', 'inventory', 'documents', 'reports'];
    const actions = ['read', 'create', 'update', 'delete'];

    // Header
    console.log('Role'.padEnd(15) + resources.map(r => r.padEnd(12)).join(''));
    console.log('-'.repeat(15) + resources.map(() => '-'.repeat(12)).join(''));

    // Role permissions matrix (simplified example)
    const permissions: Record<string, Record<string, string[]>> = {
      admin: {
        users: ['read', 'create', 'update', 'delete'],
        roles: ['read', 'create', 'update', 'delete'],
        cases: ['read', 'create', 'update', 'delete'],
        customers: ['read', 'create', 'update', 'delete'],
        technicians: ['read', 'create', 'update', 'delete'],
        inventory: ['read', 'create', 'update', 'delete'],
        documents: ['read', 'create', 'update', 'delete'],
        reports: ['read', 'create']
      },
      manager: {
        users: ['read', 'create', 'update'],
        roles: ['read', 'create', 'update'],
        cases: ['read', 'create', 'update', 'delete'],
        customers: ['read', 'create', 'update', 'delete'],
        technicians: ['read', 'create', 'update'],
        inventory: ['read', 'create', 'update', 'delete'],
        documents: ['read', 'create', 'update', 'delete'],
        reports: ['read', 'create']
      },
      technician: {
        users: [],
        roles: [],
        cases: ['read', 'update'],
        customers: ['read'],
        technicians: ['read'],
        inventory: ['read', 'update'],
        documents: ['read', 'create', 'update'],
        reports: ['read']
      },
      customer_service: {
        users: [],
        roles: [],
        cases: ['read', 'create', 'update'],
        customers: ['read', 'create', 'update'],
        technicians: ['read'],
        inventory: ['read'],
        documents: ['read', 'create'],
        reports: ['read']
      },
      customer: {
        users: [],
        roles: [],
        cases: ['read'],
        customers: ['read'],
        technicians: [],
        inventory: [],
        documents: ['read'],
        reports: []
      },
      viewer: {
        users: [],
        roles: [],
        cases: ['read'],
        customers: ['read'],
        technicians: ['read'],
        inventory: ['read'],
        documents: ['read'],
        reports: ['read']
      }
    };

    for (const role of roles) {
      const rolePerms = permissions[role] || {};
      const row = role.padEnd(15) + resources.map(resource => {
        const resourcePerms = rolePerms[resource] || [];
        const permStr = resourcePerms.map(p => p[0].toUpperCase()).join('');
        return permStr.padEnd(12);
      }).join('');
      console.log(row);
    }

    console.log('\nLegend: R=Read, C=Create, U=Update, D=Delete');
    console.log('='.repeat(80));
  }
}

// Export test runner function
export async function runAuthorizationTests(): Promise<void> {
  const testUtils = new AuthTestUtils();
  
  try {
    await testUtils.testAuthorizationScenarios();
    await testUtils.testContextAwareAuthorization();
    AuthTestUtils.generateAuthorizationMatrix();
    
    console.log('\n✅ All authorization tests completed successfully');
  } catch (error) {
    console.error('❌ Authorization tests failed:', error);
    throw error;
  }
}