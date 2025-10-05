import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Collapse,
  Toolbar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as CaseIcon,
  Description as DocumentIcon,
  People as CustomerIcon,
  Devices as DeviceIcon,
  Engineering as TechnicianIcon,
  AccountTree as WorkflowIcon,
  Inventory as InventoryIcon,
  Build as ToolsIcon,
  Assignment as ContractIcon,
  Schedule as ScheduleIcon,
  VerifiedUser as CertificateIcon,
  ChecklistRtl as ChecklistIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  path?: string;
  permission?: { resource: string; action: string };
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/dashboard',
    permission: { resource: 'dashboard', action: 'read' },
  },
  {
    id: 'cases',
    label: 'Cases',
    icon: <CaseIcon />,
    permission: { resource: 'cases', action: 'read' },
    children: [
      {
        id: 'cases-list',
        label: 'All Cases',
        icon: <CaseIcon />,
        path: '/cases',
        permission: { resource: 'cases', action: 'read' },
      },
      {
        id: 'cases-create',
        label: 'Create Case',
        icon: <CaseIcon />,
        path: '/cases/create',
        permission: { resource: 'cases', action: 'create' },
      },
      {
        id: 'cases-my',
        label: 'My Cases',
        icon: <CaseIcon />,
        path: '/cases/my',
        permission: { resource: 'cases', action: 'read' },
      },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: <DocumentIcon />,
    permission: { resource: 'documents', action: 'read' },
    children: [
      {
        id: 'documents-list',
        label: 'All Documents',
        icon: <DocumentIcon />,
        path: '/documents',
        permission: { resource: 'documents', action: 'read' },
      },
      {
        id: 'documents-pending',
        label: 'Pending Approval',
        icon: <DocumentIcon />,
        path: '/documents/pending',
        permission: { resource: 'documents', action: 'approve' },
      },
      {
        id: 'documents-templates',
        label: 'Templates',
        icon: <DocumentIcon />,
        path: '/documents/templates',
        permission: { resource: 'document_templates', action: 'read' },
      },
      {
        id: 'documents-checklists',
        label: 'Manage Checklists',
        icon: <ChecklistIcon />,
        path: '/checklists',
        permission: { resource: 'documents', action: 'update' },
      },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: <CustomerIcon />,
    path: '/customers',
    permission: { resource: 'customers', action: 'read' },
  },
  {
    id: 'devices',
    label: 'Devices',
    icon: <DeviceIcon />,
    path: '/devices',
    permission: { resource: 'devices', action: 'read' },
  },
  {
    id: 'technicians',
    label: 'Technicians',
    icon: <TechnicianIcon />,
    path: '/technicians',
    permission: { resource: 'technicians', action: 'read' },
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: <WorkflowIcon />,
    permission: { resource: 'workflows', action: 'read' },
    children: [
      {
        id: 'workflows-list',
        label: 'All Workflows',
        icon: <WorkflowIcon />,
        path: '/workflows',
        permission: { resource: 'workflows', action: 'read' },
      },
      {
        id: 'workflows-create',
        label: 'Create Workflow',
        icon: <WorkflowIcon />,
        path: '/workflows/create',
        permission: { resource: 'workflows', action: 'create' },
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <InventoryIcon />,
    permission: { resource: 'inventory', action: 'read' },
    children: [
      {
        id: 'inventory-parts',
        label: 'Spare Parts',
        icon: <InventoryIcon />,
        path: '/inventory/parts',
        permission: { resource: 'inventory', action: 'read' },
      },
      {
        id: 'inventory-transactions',
        label: 'Transactions',
        icon: <InventoryIcon />,
        path: '/inventory/transactions',
        permission: { resource: 'inventory', action: 'read' },
      },
    ],
  },
  {
    id: 'tools',
    label: 'Service Tools',
    icon: <ToolsIcon />,
    path: '/tools',
    permission: { resource: 'tools', action: 'read' },
  },
  {
    id: 'contracts',
    label: 'Contracts & SLA',
    icon: <ContractIcon />,
    path: '/contracts',
    permission: { resource: 'contracts', action: 'read' },
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: <ScheduleIcon />,
    path: '/schedule',
    permission: { resource: 'schedule', action: 'read' },
  },
  {
    id: 'certificates',
    label: 'Certificates',
    icon: <CertificateIcon />,
    path: '/certificates',
    permission: { resource: 'certificates', action: 'read' },
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <AnalyticsIcon />,
    permission: { resource: 'analytics', action: 'read' },
    children: [
      {
        id: 'analytics-dashboard',
        label: 'Executive Dashboard',
        icon: <AnalyticsIcon />,
        path: '/analytics/dashboard',
        permission: { resource: 'analytics', action: 'read' },
      },
      {
        id: 'analytics-reports',
        label: 'Reports',
        icon: <AnalyticsIcon />,
        path: '/analytics/reports',
        permission: { resource: 'analytics', action: 'read' },
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <SettingsIcon />,
    permission: { resource: 'settings', action: 'read' },
    children: [
      {
        id: 'settings-users',
        label: 'Users & Roles',
        icon: <SettingsIcon />,
        path: '/settings/users',
        permission: { resource: 'users', action: 'read' },
      },
      {
        id: 'settings-system',
        label: 'System Settings',
        icon: <SettingsIcon />,
        path: '/settings/system',
        permission: { resource: 'system_settings', action: 'read' },
      },
    ],
  },
];

interface SidebarProps {
  onItemClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);

  const handleItemClick = (item: MenuItem) => {
    if (item.path) {
      navigate(item.path);
      onItemClick?.();
    } else if (item.children) {
      toggleExpanded(item.id);
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isItemVisible = (item: MenuItem): boolean => {
    if (!item.permission) return true;
    return hasPermission(item.permission.resource, item.permission.action);
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.children) {
      return item.children.some(child => child.path === location.pathname);
    }
    return false;
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    if (!isItemVisible(item)) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isActive = isItemActive(item);

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => handleItemClick(item)}
            selected={isActive}
            sx={{
              pl: 2 + level * 2,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                color: isActive ? 'inherit' : 'text.secondary',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: level > 0 ? '0.875rem' : '1rem',
                fontWeight: isActive ? 600 : 400,
              }}
            />
            {hasChildren && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>
        
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderMenuItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
          DRMS
        </Typography>
      </Toolbar>
      <Divider />
      
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List>
          {menuItems.map(item => renderMenuItem(item))}
        </List>
      </Box>
    </Box>
  );
};

export default Sidebar;