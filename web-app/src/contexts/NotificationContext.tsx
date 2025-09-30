import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { NotificationMessage } from '../types/common';

interface NotificationState {
  notifications: NotificationMessage[];
  unreadCount: number;
}

interface NotificationAction {
  type: 'ADD_NOTIFICATION' | 'MARK_READ' | 'MARK_ALL_READ' | 'REMOVE_NOTIFICATION' | 'SET_NOTIFICATIONS';
  payload?: any;
}

interface NotificationContextType extends NotificationState {
  addNotification: (notification: Omit<NotificationMessage, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
};

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      const newNotification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: new Date(),
        read: false,
      };
      return {
        notifications: [newNotification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    
    case 'MARK_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload.id
            ? { ...notification, read: true }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    
    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification => ({
          ...notification,
          read: true,
        })),
        unreadCount: 0,
      };
    
    case 'REMOVE_NOTIFICATION':
      const notificationToRemove = state.notifications.find(n => n.id === action.payload.id);
      return {
        notifications: state.notifications.filter(n => n.id !== action.payload.id),
        unreadCount: notificationToRemove && !notificationToRemove.read 
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    
    case 'SET_NOTIFICATIONS':
      const unreadCount = action.payload.filter((n: NotificationMessage) => !n.read).length;
      return {
        notifications: action.payload,
        unreadCount,
      };
    
    default:
      return state;
  }
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  useEffect(() => {
    // Listen for WebSocket notifications
    const handleWebSocketNotification = (event: CustomEvent<NotificationMessage>) => {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: event.detail,
      });
    };

    window.addEventListener('websocket_notification', handleWebSocketNotification as EventListener);

    return () => {
      window.removeEventListener('websocket_notification', handleWebSocketNotification as EventListener);
    };
  }, []);

  const addNotification = (notification: Omit<NotificationMessage, 'id' | 'timestamp' | 'read'>): void => {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: notification,
    });
  };

  const markAsRead = (id: string): void => {
    dispatch({
      type: 'MARK_READ',
      payload: { id },
    });
  };

  const markAllAsRead = (): void => {
    dispatch({ type: 'MARK_ALL_READ' });
  };

  const removeNotification = (id: string): void => {
    dispatch({
      type: 'REMOVE_NOTIFICATION',
      payload: { id },
    });
  };

  const contextValue: NotificationContextType = {
    ...state,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}