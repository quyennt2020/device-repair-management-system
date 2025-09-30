import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Avatar,
  Badge,
  Alert,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Refresh,
  MoreVert,
  Warning,
  CheckCircle,
  Schedule,
  Person,
  Build,
  Assignment,
  AttachMoney,
  Speed,
  Timeline,
  PieChart,
  BarChart,
  ShowChart,
  Notifications,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

interface KPIData {
  label: string;
  value: number;
  previousValue?: number;
  target?: number;
  unit?: string;
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}

interface ChartData {
  name: string;
  value: number;
  color?: string;
  [key: string]: any;
}

interface TimeSeriesData {
  timestamp: string;
  [key: string]: any;
}

interface TechnicianPerformance {
  id: string;
  name: string;
  avatar?: string;
  casesCompleted: number;
  averageRating: number;
  efficiency: number;
  utilization: number;
  status: 'available' | 'busy' | 'offline';
}

interface RecentActivity {
  id: string;
  type: 'case_created' | 'case_completed' | 'document_approved' | 'sla_breach' | 'technician_assigned';
  title: string;
  description: string;
  timestamp: Date;
  severity: 'info' | 'success' | 'warning' | 'error';
  userId?: string;
  userName?: string;
}

interface DashboardWidgetsProps {
  kpis: KPIData[];
  caseStatusData: ChartData[];
  technicianWorkloadData: ChartData[];
  revenueData: TimeSeriesData[];
  slaComplianceData: TimeSeriesData[];
  technicianPerformance: TechnicianPerformance[];
  recentActivities: RecentActivity[];
  onRefresh?: () => void;
  refreshInterval?: number;
  realTimeUpdates?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const formatValue = (value: number, format?: string, unit?: string): string => {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'duration':
      return `${value.toFixed(1)}h`;
    default:
      return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
  }
};

const getTrendIcon = (trend?: string, change?: number) => {
  if (!trend || !change) return null;
  
  if (trend === 'up' || change > 0) {
    return <TrendingUp sx={{ color: 'success.main', fontSize: 16 }} />;
  } else if (trend === 'down' || change < 0) {
    return <TrendingDown sx={{ color: 'error.main', fontSize: 16 }} />;
  }
  return null;
};

const KPIWidget: React.FC<{ kpi: KPIData }> = ({ kpi }) => {
  const change = kpi.previousValue ? 
    ((kpi.value - kpi.previousValue) / kpi.previousValue) * 100 : 0;
  
  const progressValue = kpi.target ? (kpi.value / kpi.target) * 100 : undefined;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="textSecondary">
            {kpi.label}
          </Typography>
          {getTrendIcon(kpi.trend, change)}
        </Box>
        
        <Typography variant="h4" sx={{ mb: 1, color: kpi.color }}>
          {formatValue(kpi.value, kpi.format, kpi.unit)}
        </Typography>
        
        {kpi.previousValue && (
          <Typography variant="body2" color={change >= 0 ? 'success.main' : 'error.main'}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}% from last period
          </Typography>
        )}
        
        {kpi.target && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Progress to target</Typography>
              <Typography variant="caption">{progressValue?.toFixed(1)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(progressValue || 0, 100)}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const ChartWidget: React.FC<{
  title: string;
  data: ChartData[] | TimeSeriesData[];
  type: 'pie' | 'bar' | 'line' | 'area' | 'doughnut' | 'radialBar';
  height?: number;
  showLegend?: boolean;
  dataKey?: string;
  xAxisKey?: string;
}> = ({ title, data, type, height = 300, showLegend = true, dataKey = 'value', xAxisKey = 'name' }) => {
  const renderChart = () => {
    switch (type) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey={dataKey}
              >
                {(data as ChartData[]).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              {showLegend && <Legend />}
              <RechartsTooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        );

      case 'doughnut':
        const doughnutData = {
          labels: (data as ChartData[]).map(item => item.name),
          datasets: [
            {
              data: (data as ChartData[]).map(item => item.value),
              backgroundColor: (data as ChartData[]).map((item, index) => 
                item.color || COLORS[index % COLORS.length]
              ),
              borderWidth: 2,
            },
          ],
        };
        return (
          <Box sx={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Doughnut
              data={doughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: showLegend,
                    position: 'bottom',
                  },
                },
              }}
            />
          </Box>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RechartsBarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <RechartsTooltip />
              {showLegend && <Legend />}
              <Bar dataKey={dataKey} fill="#8884d8">
                {(data as ChartData[]).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <RechartsTooltip />
              {showLegend && <Legend />}
              <Line type="monotone" dataKey={dataKey} stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <RechartsTooltip />
              {showLegend && <Legend />}
              <Area type="monotone" dataKey={dataKey} stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'radialBar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" data={data}>
              <RadialBar dataKey={dataKey} cornerRadius={10} fill="#8884d8" />
              <RechartsTooltip />
            </RadialBarChart>
          </ResponsiveContainer>
        );

      default:
        return <Typography>Unsupported chart type</Typography>;
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={title}
        action={
          <IconButton size="small">
            <MoreVert />
          </IconButton>
        }
      />
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
};

const TechnicianPerformanceWidget: React.FC<{ technicians: TechnicianPerformance[] }> = ({ technicians }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title="Technician Performance" />
      <CardContent sx={{ pt: 0 }}>
        <List>
          {technicians.slice(0, 5).map((tech) => (
            <ListItem key={tech.id} divider>
              <ListItemIcon>
                <Badge
                  color={tech.status === 'available' ? 'success' : 
                         tech.status === 'busy' ? 'warning' : 'default'}
                  variant="dot"
                >
                  <Avatar src={tech.avatar} sx={{ width: 32, height: 32 }}>
                    {tech.name.charAt(0)}
                  </Avatar>
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={tech.name}
                secondary={
                  <Box>
                    <Typography variant="caption" display="block">
                      Cases: {tech.casesCompleted} | Rating: {tech.averageRating.toFixed(1)}/5
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption">Efficiency:</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={tech.efficiency}
                        sx={{ flexGrow: 1, height: 4 }}
                      />
                      <Typography variant="caption">{tech.efficiency}%</Typography>
                    </Box>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Chip
                  label={`${tech.utilization}%`}
                  size="small"
                  color={tech.utilization > 80 ? 'error' : tech.utilization > 60 ? 'warning' : 'success'}
                />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

const RecentActivityWidget: React.FC<{ activities: RecentActivity[] }> = ({ activities }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'case_created': return <Assignment />;
      case 'case_completed': return <CheckCircle />;
      case 'document_approved': return <CheckCircle />;
      case 'sla_breach': return <Warning />;
      case 'technician_assigned': return <Person />;
      default: return <Notifications />;
    }
  };

  const getActivityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'success.main';
      case 'warning': return 'warning.main';
      case 'error': return 'error.main';
      default: return 'info.main';
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title="Recent Activity" />
      <CardContent sx={{ pt: 0, maxHeight: 400, overflow: 'auto' }}>
        <List>
          {activities.slice(0, 10).map((activity) => (
            <ListItem key={activity.id} divider>
              <ListItemIcon>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '50%',
                    backgroundColor: getActivityColor(activity.severity),
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getActivityIcon(activity.type)}
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={activity.title}
                secondary={
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      {activity.description}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(activity.timestamp).toLocaleString()} 
                      {activity.userName && ` • ${activity.userName}`}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  kpis,
  caseStatusData,
  technicianWorkloadData,
  revenueData,
  slaComplianceData,
  technicianPerformance,
  recentActivities,
  onRefresh,
  refreshInterval = 30000,
  realTimeUpdates = false,
}) => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(realTimeUpdates);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        if (onRefresh) {
          onRefresh();
          setLastRefresh(new Date());
        }
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, onRefresh]);

  const handleManualRefresh = () => {
    if (onRefresh) {
      onRefresh();
      setLastRefresh(new Date());
    }
  };

  return (
    <Box>
      {/* Header with refresh controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="textSecondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleManualRefresh}
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {kpis.map((kpi, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <KPIWidget kpi={kpi} />
          </Grid>
        ))}
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <ChartWidget
            title="Case Status Distribution"
            data={caseStatusData}
            type="doughnut"
            height={300}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartWidget
            title="Technician Workload"
            data={technicianWorkloadData}
            type="bar"
            height={300}
            xAxisKey="name"
            dataKey="value"
          />
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <ChartWidget
            title="Revenue Trend"
            data={revenueData}
            type="area"
            height={300}
            xAxisKey="timestamp"
            dataKey="revenue"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ChartWidget
            title="SLA Compliance"
            data={slaComplianceData}
            type="line"
            height={300}
            xAxisKey="timestamp"
            dataKey="compliance"
          />
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TechnicianPerformanceWidget technicians={technicianPerformance} />
        </Grid>
        <Grid item xs={12} md={6}>
          <RecentActivityWidget activities={recentActivities} />
        </Grid>
      </Grid>

      {/* Real-time update indicator */}
      {realTimeUpdates && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000,
          }}
        >
          <Chip
            icon={autoRefresh ? <CircularProgress size={16} /> : <Schedule />}
            label={autoRefresh ? 'Live Updates' : 'Updates Paused'}
            color={autoRefresh ? 'success' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            clickable
          />
        </Box>
      )}
    </Box>
  );
};

export default DashboardWidgets;

// Export types
export type { KPIData, ChartData, TimeSeriesData, TechnicianPerformance, RecentActivity };