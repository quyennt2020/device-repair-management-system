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
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UnauthorizedPage from './pages/common/UnauthorizedPage';
import NotFoundPage from './pages/common/NotFoundPage';
import SpecializedComponentsDemo from './pages/demo/SpecializedComponentsDemo';

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
                        <div>Cases Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="cases/create"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'cases', action: 'create' }}>
                        <div>Create Case Page - Coming Soon</div>
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
                        <div>Case Details Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Documents */}
                  <Route
                    path="documents"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'read' }}>
                        <div>Documents Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="documents/pending"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'documents', action: 'approve' }}>
                        <div>Pending Documents Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="documents/templates"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'document_templates', action: 'read' }}>
                        <div>Document Templates Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Customers */}
                  <Route
                    path="customers"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'customers', action: 'read' }}>
                        <div>Customers Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Devices */}
                  <Route
                    path="devices"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'devices', action: 'read' }}>
                        <div>Devices Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Technicians */}
                  <Route
                    path="technicians"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'technicians', action: 'read' }}>
                        <div>Technicians Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Inventory */}
                  <Route
                    path="inventory/parts"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'read' }}>
                        <div>Inventory Parts Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="inventory/transactions"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'inventory', action: 'read' }}>
                        <div>Inventory Transactions Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Tools */}
                  <Route
                    path="tools"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'tools', action: 'read' }}>
                        <div>Service Tools Page - Coming Soon</div>
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Contracts */}
                  <Route
                    path="contracts"
                    element={
                      <ProtectedRoute requiredPermission={{ resource: 'contracts', action: 'read' }}>
                        <div>Contracts & SLA Page - Coming Soon</div>
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
  );
};

export default App;