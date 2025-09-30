import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthState, AuthContextType, LoginCredentials, User } from '../types/auth';
import { apiService } from '../services/api';
import { webSocketService } from '../services/websocket';

interface AuthAction {
  type: 'LOGIN_START' | 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'RESTORE_SESSION';
  payload?: any;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'RESTORE_SESSION':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Check if we're in demo mode (when accessing demo routes)
    const isDemoMode = window.location.pathname.startsWith('/demo');
    
    if (isDemoMode) {
      // Create a mock user for demo mode
      const mockUser: User = {
        id: 'demo-user',
        username: 'demo',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        roles: [
          {
            id: 'admin-role',
            name: 'admin',
            description: 'Administrator',
            permissions: []
          }
        ],
        permissions: [
          { id: '1', resource: 'dashboard', action: 'read', description: 'Read dashboard' },
          { id: '2', resource: 'cases', action: 'read', description: 'Read cases' },
          { id: '3', resource: 'documents', action: 'read', description: 'Read documents' },
          { id: '4', resource: 'customers', action: 'read', description: 'Read customers' },
          { id: '5', resource: 'devices', action: 'read', description: 'Read devices' },
          { id: '6', resource: 'technicians', action: 'read', description: 'Read technicians' },
          { id: '7', resource: 'inventory', action: 'read', description: 'Read inventory' },
          { id: '8', resource: 'tools', action: 'read', description: 'Read tools' },
          { id: '9', resource: 'contracts', action: 'read', description: 'Read contracts' },
          { id: '10', resource: 'schedule', action: 'read', description: 'Read schedule' },
          { id: '11', resource: 'certificates', action: 'read', description: 'Read certificates' },
          { id: '12', resource: 'analytics', action: 'read', description: 'Read analytics' },
          { id: '13', resource: 'workflows', action: 'read', description: 'Read workflows' },
          { id: '14', resource: 'users', action: 'read', description: 'Read users' },
          { id: '15', resource: 'system_settings', action: 'read', description: 'Read system settings' },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      dispatch({
        type: 'RESTORE_SESSION',
        payload: { user: mockUser, token: 'demo-token' }
      });
      return;
    }
    
    // Try to restore session from localStorage
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        dispatch({
          type: 'RESTORE_SESSION',
          payload: { user, token }
        });
        
        // Connect to WebSocket (only if not in demo mode)
        try {
          webSocketService.connect(user.id);
        } catch (error) {
          console.warn('WebSocket connection failed (this is expected in demo mode):', error);
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        dispatch({ type: 'LOGIN_FAILURE' });
      }
    } else {
      dispatch({ type: 'LOGIN_FAILURE' });
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      // Check if we're in demo mode
      const isDemoMode = window.location.pathname.startsWith('/demo');
      
      if (isDemoMode || credentials.username === 'demo') {
        // Mock login for demo mode
        const mockUser: User = {
          id: 'demo-user',
          username: 'demo',
          email: 'demo@example.com',
          firstName: 'Demo',
          lastName: 'User',
          roles: [
            {
              id: 'admin-role',
              name: 'admin',
              description: 'Administrator',
              permissions: []
            }
          ],
          permissions: [
            { id: '1', resource: 'dashboard', action: 'read', description: 'Read dashboard' },
            { id: '2', resource: 'cases', action: 'read', description: 'Read cases' },
            { id: '3', resource: 'documents', action: 'read', description: 'Read documents' },
            { id: '4', resource: 'customers', action: 'read', description: 'Read customers' },
            { id: '5', resource: 'devices', action: 'read', description: 'Read devices' },
            { id: '6', resource: 'technicians', action: 'read', description: 'Read technicians' },
            { id: '7', resource: 'inventory', action: 'read', description: 'Read inventory' },
            { id: '8', resource: 'tools', action: 'read', description: 'Read tools' },
            { id: '9', resource: 'contracts', action: 'read', description: 'Read contracts' },
            { id: '10', resource: 'schedule', action: 'read', description: 'Read schedule' },
            { id: '11', resource: 'certificates', action: 'read', description: 'Read certificates' },
            { id: '12', resource: 'analytics', action: 'read', description: 'Read analytics' },
            { id: '13', resource: 'workflows', action: 'read', description: 'Read workflows' },
            { id: '14', resource: 'users', action: 'read', description: 'Read users' },
            { id: '15', resource: 'system_settings', action: 'read', description: 'Read system settings' },
          ],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        const token = 'demo-token';
        
        // Store in localStorage
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user: mockUser, token }
        });
        
        return;
      }
      
      const response = await apiService.post<{ user: User; token: string }>('/auth/login', credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store in localStorage
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token }
        });
        
        // Connect to WebSocket
        try {
          webSocketService.connect(user.id);
        } catch (error) {
          console.warn('WebSocket connection failed:', error);
        }
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      dispatch({ type: 'LOGIN_FAILURE' });
      throw error;
    }
  };

  const logout = (): void => {
    // Disconnect WebSocket (only if not in demo mode)
    try {
      webSocketService.disconnect();
    } catch (error) {
      console.warn('WebSocket disconnect failed (this is expected in demo mode):', error);
    }
    
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    dispatch({ type: 'LOGOUT' });
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!state.user) return false;
    
    return state.user.permissions.some(
      permission => permission.resource === resource && permission.action === action
    );
  };

  const hasRole = (roleName: string): boolean => {
    if (!state.user) return false;
    
    return state.user.roles.some(role => role.name === roleName);
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}