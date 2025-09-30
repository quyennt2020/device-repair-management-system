import { io, Socket } from 'socket.io-client';
import { NotificationMessage } from '../types/common';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(userId: string): void {
    if (this.socket?.connected) {
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token found, cannot connect to WebSocket');
      return;
    }

    this.socket = io(process.env.REACT_APP_WS_URL || 'http://localhost:3001', {
      auth: {
        token,
        userId,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.handleReconnect();
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });

    // Handle real-time notifications
    this.socket.on('notification', (notification: NotificationMessage) => {
      this.handleNotification(notification);
    });

    // Handle case status updates
    this.socket.on('case_status_update', (data: any) => {
      this.handleCaseStatusUpdate(data);
    });

    // Handle workflow step updates
    this.socket.on('workflow_step_update', (data: any) => {
      this.handleWorkflowStepUpdate(data);
    });

    // Handle document approval updates
    this.socket.on('document_approval_update', (data: any) => {
      this.handleDocumentApprovalUpdate(data);
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.socket?.connect();
      }, delay);
    }
  }

  private handleNotification(notification: NotificationMessage): void {
    // Dispatch custom event for notification components to listen
    window.dispatchEvent(new CustomEvent('websocket_notification', {
      detail: notification
    }));
  }

  private handleCaseStatusUpdate(data: any): void {
    window.dispatchEvent(new CustomEvent('case_status_update', {
      detail: data
    }));
  }

  private handleWorkflowStepUpdate(data: any): void {
    window.dispatchEvent(new CustomEvent('workflow_step_update', {
      detail: data
    }));
  }

  private handleDocumentApprovalUpdate(data: any): void {
    window.dispatchEvent(new CustomEvent('document_approval_update', {
      detail: data
    }));
  }

  // Subscribe to specific case updates
  subscribeToCase(caseId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe_case', { caseId });
    }
  }

  // Unsubscribe from case updates
  unsubscribeFromCase(caseId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe_case', { caseId });
    }
  }

  // Subscribe to workflow instance updates
  subscribeToWorkflow(workflowInstanceId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe_workflow', { workflowInstanceId });
    }
  }

  // Send message
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const webSocketService = new WebSocketService();