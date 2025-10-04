import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '@drms/shared-database';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mock authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Mock user data - in production, this would query the database
    const mockUsers = [
      {
        id: '1',
        username: 'admin',
        email: 'admin@drms.com',
        firstName: 'Admin',
        lastName: 'User',
        password: await bcrypt.hash('admin123', 10),
        roles: [{ id: '1', name: 'admin', description: 'Administrator', permissions: [] }],
        permissions: [
          { id: '1', resource: 'dashboard', action: 'read', description: 'Read dashboard' },
          { id: '2', resource: 'cases', action: 'read', description: 'Read cases' },
          { id: '3', resource: 'cases', action: 'create', description: 'Create cases' },
          { id: '4', resource: 'cases', action: 'update', description: 'Update cases' },
          { id: '5', resource: 'documents', action: 'read', description: 'Read documents' },
          { id: '6', resource: 'customers', action: 'read', description: 'Read customers' },
          { id: '7', resource: 'devices', action: 'read', description: 'Read devices' },
          { id: '8', resource: 'technicians', action: 'read', description: 'Read technicians' },
          { id: '9', resource: 'inventory', action: 'read', description: 'Read inventory' },
          { id: '10', resource: 'tools', action: 'read', description: 'Read tools' },
          { id: '11', resource: 'contracts', action: 'read', description: 'Read contracts' },
          { id: '12', resource: 'schedule', action: 'read', description: 'Read schedule' },
          { id: '13', resource: 'certificates', action: 'read', description: 'Read certificates' },
          { id: '14', resource: 'analytics', action: 'read', description: 'Read analytics' },
          { id: '15', resource: 'workflows', action: 'read', description: 'Read workflows' },
          { id: '16', resource: 'users', action: 'read', description: 'Read users' },
          { id: '17', resource: 'system_settings', action: 'read', description: 'Read system settings' },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        username: 'technician',
        email: 'tech@drms.com',
        firstName: 'John',
        lastName: 'Technician',
        password: await bcrypt.hash('tech123', 10),
        roles: [{ id: '2', name: 'technician', description: 'Technician', permissions: [] }],
        permissions: [
          { id: '1', resource: 'dashboard', action: 'read', description: 'Read dashboard' },
          { id: '2', resource: 'cases', action: 'read', description: 'Read cases' },
          { id: '3', resource: 'cases', action: 'update', description: 'Update cases' },
          { id: '5', resource: 'documents', action: 'read', description: 'Read documents' },
          { id: '7', resource: 'devices', action: 'read', description: 'Read devices' },
          { id: '9', resource: 'inventory', action: 'read', description: 'Read inventory' },
          { id: '10', resource: 'tools', action: 'read', description: 'Read tools' },
          { id: '12', resource: 'schedule', action: 'read', description: 'Read schedule' },
        ],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    const user = mockUsers.find(u => u.username === username);
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Mock dashboard data endpoints
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalCases: 1247,
      openCases: 45,
      inProgressCases: 32,
      completedCases: 78,
      slaCompliance: 94.5,
      revenue: 2450000000,
      avgResolutionTime: 4.2
    }
  });
});

app.get('/api/dashboard/case-status', (req, res) => {
  res.json({
    success: true,
    data: [
      { name: 'Open', value: 45, color: '#ff9800' },
      { name: 'In Progress', value: 32, color: '#2196f3' },
      { name: 'Completed', value: 78, color: '#4caf50' },
      { name: 'Cancelled', value: 12, color: '#f44336' },
    ]
  });
});

app.get('/api/dashboard/technician-workload', (req, res) => {
  res.json({
    success: true,
    data: [
      { name: 'Nguyễn Văn A', value: 8, color: '#2196f3' },
      { name: 'Trần Thị B', value: 6, color: '#4caf50' },
      { name: 'Lê Văn C', value: 10, color: '#ff9800' },
      { name: 'Phạm Thị D', value: 4, color: '#9c27b0' },
    ]
  });
});

// Mock cases endpoints
app.get('/api/cases', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'RC-2024-001',
        title: 'Sửa chữa thiết bị đo X100',
        customer: 'Công ty ABC',
        device: 'Thiết bị đo X100',
        status: 'in_progress',
        priority: 'high',
        assignedTechnician: 'Nguyễn Văn A',
        createdAt: '2024-01-15T08:00:00Z',
        dueDate: '2024-01-20T17:00:00Z'
      },
      {
        id: 'RC-2024-002',
        title: 'Bảo trì định kỳ thiết bị Y200',
        customer: 'Công ty XYZ',
        device: 'Thiết bị Y200',
        status: 'scheduled',
        priority: 'medium',
        assignedTechnician: 'Trần Thị B',
        createdAt: '2024-01-14T10:30:00Z',
        dueDate: '2024-01-18T16:00:00Z'
      }
    ]
  });
});

// Serve static files from React build
const buildPath = path.join(__dirname, '../../../web-app/build');
app.use(express.static(buildPath));

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Send periodic updates
  const interval = setInterval(() => {
    socket.emit('notification', {
      id: Date.now().toString(),
      title: 'System Update',
      message: 'Real-time data updated',
      type: 'info',
      timestamp: new Date(),
      read: false
    });
  }, 30000); // Every 30 seconds

  socket.on('disconnect', () => {
    clearInterval(interval);
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

server.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend served at: http://localhost:${PORT}`);
});

export default app;