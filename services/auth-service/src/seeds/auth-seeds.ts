import { db } from '@drms/shared-database';

export async function seedAuthData() {
  console.log('🌱 Seeding authentication data...');

  try {
    // Create default permissions
    const permissions = [
      // User management
      { name: 'users.read', displayName: 'Read Users', description: 'View user information', resource: 'users', action: 'read' },
      { name: 'users.create', displayName: 'Create Users', description: 'Create new users', resource: 'users', action: 'create' },
      { name: 'users.update', displayName: 'Update Users', description: 'Update user information', resource: 'users', action: 'update' },
      { name: 'users.delete', displayName: 'Delete Users', description: 'Delete users', resource: 'users', action: 'delete' },
      
      // Role management
      { name: 'roles.read', displayName: 'Read Roles', description: 'View roles and permissions', resource: 'roles', action: 'read' },
      { name: 'roles.create', displayName: 'Create Roles', description: 'Create new roles', resource: 'roles', action: 'create' },
      { name: 'roles.update', displayName: 'Update Roles', description: 'Update role permissions', resource: 'roles', action: 'update' },
      { name: 'roles.delete', displayName: 'Delete Roles', description: 'Delete roles', resource: 'roles', action: 'delete' },
      { name: 'roles.assign', displayName: 'Assign Roles', description: 'Assign roles to users', resource: 'roles', action: 'assign' },
      
      // Case management
      { name: 'cases.read', displayName: 'Read Cases', description: 'View repair cases', resource: 'cases', action: 'read' },
      { name: 'cases.create', displayName: 'Create Cases', description: 'Create new repair cases', resource: 'cases', action: 'create' },
      { name: 'cases.update', displayName: 'Update Cases', description: 'Update case information', resource: 'cases', action: 'update' },
      { name: 'cases.delete', displayName: 'Delete Cases', description: 'Delete cases', resource: 'cases', action: 'delete' },
      { name: 'cases.assign', displayName: 'Assign Cases', description: 'Assign cases to technicians', resource: 'cases', action: 'assign' },
      
      // Customer management
      { name: 'customers.read', displayName: 'Read Customers', description: 'View customer information', resource: 'customers', action: 'read' },
      { name: 'customers.create', displayName: 'Create Customers', description: 'Create new customers', resource: 'customers', action: 'create' },
      { name: 'customers.update', displayName: 'Update Customers', description: 'Update customer information', resource: 'customers', action: 'update' },
      { name: 'customers.delete', displayName: 'Delete Customers', description: 'Delete customers', resource: 'customers', action: 'delete' },
      
      // Technician management
      { name: 'technicians.read', displayName: 'Read Technicians', description: 'View technician information', resource: 'technicians', action: 'read' },
      { name: 'technicians.create', displayName: 'Create Technicians', description: 'Create new technicians', resource: 'technicians', action: 'create' },
      { name: 'technicians.update', displayName: 'Update Technicians', description: 'Update technician information', resource: 'technicians', action: 'update' },
      { name: 'technicians.delete', displayName: 'Delete Technicians', description: 'Delete technicians', resource: 'technicians', action: 'delete' },
      
      // Inventory management
      { name: 'inventory.read', displayName: 'Read Inventory', description: 'View inventory items', resource: 'inventory', action: 'read' },
      { name: 'inventory.create', displayName: 'Create Inventory', description: 'Add new inventory items', resource: 'inventory', action: 'create' },
      { name: 'inventory.update', displayName: 'Update Inventory', description: 'Update inventory information', resource: 'inventory', action: 'update' },
      { name: 'inventory.delete', displayName: 'Delete Inventory', description: 'Remove inventory items', resource: 'inventory', action: 'delete' },
      
      // Document management
      { name: 'documents.read', displayName: 'Read Documents', description: 'View documents', resource: 'documents', action: 'read' },
      { name: 'documents.create', displayName: 'Create Documents', description: 'Upload new documents', resource: 'documents', action: 'create' },
      { name: 'documents.update', displayName: 'Update Documents', description: 'Update document information', resource: 'documents', action: 'update' },
      { name: 'documents.delete', displayName: 'Delete Documents', description: 'Delete documents', resource: 'documents', action: 'delete' },
      
      // Reports and analytics
      { name: 'reports.read', displayName: 'Read Reports', description: 'View reports and analytics', resource: 'reports', action: 'read' },
      { name: 'reports.create', displayName: 'Create Reports', description: 'Generate custom reports', resource: 'reports', action: 'create' },
      
      // System administration
      { name: 'system.admin', displayName: 'System Administration', description: 'Full system administration access', resource: 'system', action: 'admin' },
      { name: 'audit.read', displayName: 'Read Audit Logs', description: 'View audit logs', resource: 'audit', action: 'read' }
    ];

    console.log('Creating permissions...');
    for (const permission of permissions) {
      await db.query(`
        INSERT INTO permissions (name, display_name, description, resource, action, is_system_permission)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (name) DO NOTHING
      `, [permission.name, permission.displayName, permission.description, permission.resource, permission.action]);
    }

    // Create default roles
    const roles = [
      {
        name: 'admin',
        displayName: 'System Administrator',
        description: 'Full system access with all permissions',
        permissions: permissions.map(p => p.name) // All permissions
      },
      {
        name: 'manager',
        displayName: 'Manager',
        description: 'Management access with most permissions except system admin',
        permissions: permissions.filter(p => !p.name.includes('system.admin')).map(p => p.name)
      },
      {
        name: 'technician',
        displayName: 'Technician',
        description: 'Technician access for case and inventory management',
        permissions: [
          'cases.read', 'cases.create', 'cases.update',
          'customers.read',
          'inventory.read', 'inventory.update',
          'documents.read', 'documents.create', 'documents.update',
          'technicians.read'
        ]
      },
      {
        name: 'customer_service',
        displayName: 'Customer Service',
        description: 'Customer service representative access',
        permissions: [
          'cases.read', 'cases.create', 'cases.update',
          'customers.read', 'customers.create', 'customers.update',
          'documents.read', 'documents.create',
          'technicians.read'
        ]
      },
      {
        name: 'customer',
        displayName: 'Customer',
        description: 'Customer access to their own cases and information',
        permissions: [
          'cases.read',
          'customers.read',
          'documents.read'
        ]
      },
      {
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access to most resources',
        permissions: [
          'cases.read',
          'customers.read',
          'technicians.read',
          'inventory.read',
          'documents.read',
          'reports.read'
        ]
      }
    ];

    console.log('Creating roles...');
    for (const role of roles) {
      // Create role
      const roleResult = await db.query(`
        INSERT INTO roles (name, display_name, description, is_system_role)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description
        RETURNING id
      `, [role.name, role.displayName, role.description]);

      const roleId = roleResult.rows[0].id;

      // Clear existing permissions for this role
      await db.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Assign permissions to role
      for (const permissionName of role.permissions) {
        const permissionResult = await db.query(
          'SELECT id FROM permissions WHERE name = $1',
          [permissionName]
        );

        if (permissionResult.rows.length > 0) {
          const permissionId = permissionResult.rows[0].id;
          await db.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [roleId, permissionId]);
        }
      }
    }

    console.log('✅ Authentication data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding authentication data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedAuthData()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}