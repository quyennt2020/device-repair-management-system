# Device Repair Management System - Web Application

A modern, responsive React-based web application for managing device repair workflows, built with TypeScript and Material-UI.

## Features

### ✅ Implemented Features

- **Responsive Design**: Mobile-first approach with tablet and desktop optimization
- **Role-based Access Control**: Permission-based navigation and feature access
- **Real-time Notifications**: WebSocket-powered live updates
- **Modern UI/UX**: Material-UI components with custom theming
- **Authentication System**: JWT-based authentication with session management
- **Dashboard**: Executive dashboard with key metrics and charts
- **Navigation**: Collapsible sidebar with role-based menu items
- **Error Handling**: Comprehensive error boundaries and user feedback

### 🔄 Architecture

- **React 18** with TypeScript
- **Material-UI v5** for UI components
- **React Router v6** for navigation
- **React Query** for data fetching and caching
- **Socket.IO Client** for real-time communication
- **React Hook Form** with Yup validation
- **Recharts** for data visualization

### 📱 Responsive Design

- **Mobile (< 768px)**: Collapsible navigation, stacked layouts, touch-optimized
- **Tablet (768px - 1024px)**: Adaptive layouts, optimized for touch
- **Desktop (> 1024px)**: Full sidebar navigation, multi-column layouts

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Backend services running on port 3001

### Installation

1. **Install dependencies**:
   ```bash
   cd web-app
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API endpoints
   ```

3. **Start development server**:
   ```bash
   npm start
   ```

4. **Open browser**: http://localhost:3000

### Demo Credentials

- **Admin**: `admin` / `admin123`
- **Manager**: `manager` / `manager123`
- **Technician**: `tech1` / `tech123`

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Common components (ProtectedRoute, etc.)
│   ├── dashboard/       # Dashboard-specific components
│   └── layout/          # Layout components (AppLayout, Sidebar, etc.)
├── contexts/            # React contexts (Auth, Notifications)
├── hooks/               # Custom React hooks
├── pages/               # Page components
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Dashboard pages
│   └── common/         # Common pages (404, Unauthorized)
├── services/            # API and external services
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
├── App.tsx             # Main application component
└── index.tsx           # Application entry point
```

## Key Components

### Authentication System

- **AuthContext**: Manages user authentication state
- **ProtectedRoute**: Route protection with permission checking
- **LoginPage**: Responsive login form with validation

### Layout System

- **AppLayout**: Main application layout with responsive sidebar
- **Sidebar**: Role-based navigation with collapsible menu
- **NotificationPanel**: Real-time notification display

### Dashboard

- **DashboardPage**: Executive dashboard with key metrics
- **DashboardCard**: Reusable metric display cards
- **Charts**: Data visualization components using Recharts

## Real-time Features

### WebSocket Integration

- Automatic connection management with reconnection logic
- Real-time notifications for case updates
- Live dashboard data updates
- Event-driven architecture

### Notification System

- Toast notifications for user actions
- Persistent notification panel
- Real-time updates via WebSocket
- Categorized notifications (info, success, warning, error)

## Permission System

### Role-based Access Control

```typescript
// Example permission check
<ProtectedRoute requiredPermission={{ resource: 'cases', action: 'read' }}>
  <CasesPage />
</ProtectedRoute>

// Example role check
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>
```

### Available Permissions

- **Dashboard**: `dashboard:read`
- **Cases**: `cases:read`, `cases:create`, `cases:update`, `cases:delete`
- **Documents**: `documents:read`, `documents:create`, `documents:approve`
- **Customers**: `customers:read`, `customers:create`, `customers:update`
- **Devices**: `devices:read`, `devices:create`, `devices:update`
- **Technicians**: `technicians:read`, `technicians:create`, `technicians:update`
- **Inventory**: `inventory:read`, `inventory:update`
- **Analytics**: `analytics:read`
- **Settings**: `settings:read`, `settings:update`

## Mobile Optimization

### Responsive Features

- **Collapsible Navigation**: Mobile-friendly drawer navigation
- **Touch Optimization**: Larger touch targets, swipe gestures
- **Adaptive Layouts**: Stacked layouts on mobile, grid on desktop
- **Optimized Tables**: Card-based display on mobile
- **Progressive Enhancement**: Core functionality works on all devices

### Performance Optimizations

- **Code Splitting**: Route-based code splitting
- **Lazy Loading**: Component lazy loading
- **Image Optimization**: Responsive images with proper sizing
- **Caching**: React Query for efficient data caching

## Development

### Available Scripts

- `npm start`: Start development server
- `npm build`: Build for production
- `npm test`: Run test suite
- `npm run eject`: Eject from Create React App

### Code Quality

- **TypeScript**: Full type safety
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Husky**: Git hooks for quality checks

## Deployment

### Production Build

```bash
npm run build
```

### Environment Variables

```bash
# Production environment
REACT_APP_API_BASE_URL=https://api.yourcompany.com
REACT_APP_WS_URL=wss://api.yourcompany.com
REACT_APP_ENV=production
```

### Docker Deployment

```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **Progressive Enhancement**: Core functionality works on older browsers

## Contributing

1. Follow the existing code structure and patterns
2. Use TypeScript for all new components
3. Implement responsive design for all new features
4. Add proper error handling and loading states
5. Include proper permission checks for protected features
6. Write tests for new functionality

## Next Steps

The following pages are ready for implementation:

- Cases management pages
- Document management pages
- Customer management pages
- Device management pages
- Technician management pages
- Inventory management pages
- Analytics and reporting pages
- Settings and configuration pages

Each page should follow the established patterns for:
- Responsive design
- Permission-based access control
- Real-time updates
- Error handling
- Loading states