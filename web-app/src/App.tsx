import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UnauthorizedPage from './pages/common/UnauthorizedPage';
import NotFoundPage from './pages/common/NotFoundPage';
import SpecializedComponentsDemo from './pages/demo/SpecializedComponentsDemo';
import CasesPage from './pages/cases/CasesPage';
import CreateCasePage from './pages/cases/CreateCasePage';
import CaseDetailsPage from './pages/cases/CaseDetailsPage';
import CustomersPage from './pages/customers/CustomersPage';
import CreateCustomerPage from './pages/customers/CreateCustomerPage';
import EditCustomerPage from './pages/customers/EditCustomerPage';
import CustomerDetailsPage from './pages/customers/CustomerDetailsPage';
import DevicesPage from './pages/devices/DevicesPage';
import CreateDevicePage from './pages/devices/CreateDevicePage';
import EditDevicePage from './pages/devices/EditDevicePage';
import DeviceDetailsPage from './pages/devices/DeviceDetailsPage';
import DocumentsPage from './pages/documents/DocumentsPage';
import DocumentDetailsPage from './pages/documents/DocumentDetailsPage';
import DocumentTemplatesPage from './pages/documents/DocumentTemplatesPage';
import DocumentTemplateDetailsPage from './pages/documents/DocumentTemplateDetailsPage';
import EditDocumentTemplatePage from './pages/documents/EditDocumentTemplatePage';
import InventoryPage from './pages/inventory/InventoryPage';
import CreateSparePartPage from './pages/inventory/CreateSparePartPage';
import EditSparePartPage from './pages/inventory/EditSparePartPage';
import SparePartDetailsPage from './pages/inventory/SparePartDetailsPage';
import StockTransactionPage from './pages/inventory/StockTransactionPage';
import LowStockAlertsPage from './pages/inventory/LowStockAlertsPage';
import CreateWarehousePage from './pages/inventory/CreateWarehousePage';
import TechniciansPage from './pages/technicians/TechniciansPage';
import CreateTechnicianPage from './pages/technicians/CreateTechnicianPage';
import EditTechnicianPage from './pages/technicians/EditTechnicianPage';
import TechnicianDetailsPage from './pages/technicians/TechnicianDetailsPage';
import ToolsPage from './pages/tools/ToolsPage';
import CreateToolPage from './pages/tools/CreateToolPage';
import EditToolPage from './pages/tools/EditToolPage';
import ToolDetailPage from './pages/tools/ToolDetailPage';
import ContractsPage from './pages/contracts/ContractsPage';
import CreateContractPage from './pages/contracts/CreateContractPage';
import ChecklistManagementPage from './pages/checklists/ChecklistManagementPage';
import ChecklistEditorPage from './pages/checklists/ChecklistEditorPage';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 8,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0, 0, 0, 0.12)',
        },
      },
    },
  },
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <NotificationProvider>
              <Router>
                <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                
                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Dashboard */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route
                    path="dashboard"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'dashboard', action: 'read' }}>
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Cases */}
                  <Route
                    path="cases"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'cases', action: 'read' }}>
                        <CasesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cases/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'cases', action: 'create' }}>
                        <CreateCasePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cases/my"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'cases', action: 'read' }}>
                        <div>My Cases Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cases/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'cases', action: 'read' }}>
                        <CaseDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Documents */}
                  <Route
                    path="documents"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'read' }}>
                        <DocumentsPage />
                      </ProtectedRoute>
                    }
                  />
                  {/* Specific document routes BEFORE :id route */}
                  <Route
                    path="documents/pending"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'read' }}>
                        <DocumentsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="documents/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'create' }}>
                        <DocumentsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="documents/templates"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'document_templates', action: 'read' }}>
                        <DocumentTemplatesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="documents/templates/:id/edit"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'document_templates', action: 'update' }}>
                        <EditDocumentTemplatePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="documents/templates/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'document_templates', action: 'read' }}>
                        <DocumentTemplateDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  {/* Dynamic :id route LAST */}
                  <Route
                    path="documents/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'read' }}>
                        <DocumentDetailsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Checklists */}
                  <Route
                    path="checklists"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'read' }}>
                        <ChecklistManagementPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="checklists/edit/:documentType/:deviceId/:checklistType"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'update' }}>
                        <ChecklistEditorPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Customers */}
                  <Route
                    path="customers"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'customers', action: 'read' }}>
                        <CustomersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="customers/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'customers', action: 'create' }}>
                        <CreateCustomerPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="customers/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'customers', action: 'read' }}>
                        <CustomerDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="customers/:id/edit"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'customers', action: 'update' }}>
                        <EditCustomerPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Devices */}
                  <Route
                    path="devices"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'read' }}>
                        <DevicesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="devices/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'create' }}>
                        <CreateDevicePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="devices/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'read' }}>
                        <DeviceDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="devices/:id/edit"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'update' }}>
                        <EditDevicePage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Technicians */}
                  <Route
                    path="technicians"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'technicians', action: 'read' }}>
                        <TechniciansPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="technicians/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'technicians', action: 'create' }}>
                        <CreateTechnicianPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="technicians/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'technicians', action: 'read' }}>
                        <TechnicianDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="technicians/:id/edit"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'technicians', action: 'update' }}>
                        <EditTechnicianPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Inventory */}
                  <Route
                    path="inventory"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'read' }}>
                        <InventoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/spare-parts/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'create' }}>
                        <CreateSparePartPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/spare-parts/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'read' }}>
                        <SparePartDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/spare-parts/:id/edit"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'update' }}>
                        <EditSparePartPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/parts"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'read' }}>
                        <InventoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/transactions"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'create' }}>
                        <StockTransactionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/alerts"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'read' }}>
                        <LowStockAlertsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/warehouses/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'create' }}>
                        <CreateWarehousePage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Tools */}
                  <Route
                    path="tools"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'tools', action: 'read' }}>
                        <ToolsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="tools/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'tools', action: 'create' }}>
                        <CreateToolPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="tools/:id"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'tools', action: 'read' }}>
                        <ToolDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="tools/:id/edit"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'tools', action: 'update' }}>
                        <EditToolPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Contracts */}
                  <Route
                    path="contracts"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'contracts', action: 'read' }}>
                        <ContractsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="contracts/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'contracts', action: 'create' }}>
                        <CreateContractPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Schedule */}
                  <Route
                    path="schedule"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'schedule', action: 'read' }}>
                        <div>Schedule Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Certificates */}
                  <Route
                    path="certificates"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'certificates', action: 'read' }}>
                        <div>Certificates Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Analytics */}
                  <Route
                    path="analytics/dashboard"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'analytics', action: 'read' }}>
                        <div>Analytics Dashboard Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="analytics/reports"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'analytics', action: 'read' }}>
                        <div>Analytics Reports Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Settings */}
                  <Route
                    path="settings/workflows"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'workflows', action: 'read' }}>
                        <div>Workflow Settings Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="settings/users"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'users', action: 'read' }}>
                        <div>Users & Roles Settings Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="settings/system"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'system_settings', action: 'read' }}>
                        <div>System Settings Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Demo */}
                  <Route path="demo/components" element={<SpecializedComponentsDemo />} />
                  
                  {/* Profile and Help */}
                  <Route path="profile" element={<div>Profile Page - Coming Soon</div>} />
                  <Route path="help" element={<div>Help & Support Page - Coming Soon</div>} />
                </Route>
                
                {/* 404 Not Found */}
                <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Router>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;