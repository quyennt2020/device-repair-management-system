const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3001;

// Helper function to parse JSON body
function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      callback(null, parsed);
    } catch (error) {
      callback(error, null);
    }
  });
}

// Helper function to send JSON response
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health' && method === 'GET') {
    sendJSON(res, { status: 'OK', timestamp: new Date().toISOString() });
    return;
  }

  // Mock authentication endpoints
  if (pathname === '/api/auth/login' && method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) {
        sendJSON(res, { success: false, message: 'Invalid JSON' }, 400);
        return;
      }

      const { username, password } = body;
    
    // Mock user data
    const mockUsers = [
      {
        id: '1',
        username: 'admin',
        email: 'admin@drms.com',
        firstName: 'Admin',
        lastName: 'User',
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

      if (!user || (password !== 'admin123' && password !== 'tech123')) {
        sendJSON(res, {
          success: false,
          message: 'Invalid credentials'
        }, 401);
        return;
      }

      const token = 'mock-jwt-token-' + Date.now();

      sendJSON(res, {
        success: true,
        data: {
          user: user,
          token: token
        }
      });
    });
  }

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
const buildPath = path.join(__dirname, '../../web-app/build');
app.use(express.static(buildPath));

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Frontend served at: http://localhost:${PORT}`);
});

module.exports = app;