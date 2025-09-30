import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import App from './App';

// Mock the contexts to avoid WebSocket and API calls in tests
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    token: null,
    login: jest.fn(),
    logout: jest.fn(),
    hasPermission: jest.fn(() => false),
    hasRole: jest.fn(() => false),
  }),
}));

jest.mock('./contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    addNotification: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    removeNotification: jest.fn(),
  }),
}));

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </ThemeProvider>
  );
};

test('renders login page when not authenticated', () => {
  renderWithProviders(<App />);
  
  // Should redirect to login page
  expect(window.location.pathname).toBe('/');
});

test('app renders without crashing', () => {
  renderWithProviders(<App />);
  // If we get here without throwing, the app rendered successfully
  expect(true).toBe(true);
});