import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Assignment as CaseIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Warning as OverdueIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import DashboardCard from '../../components/dashboard/DashboardCard';
import CaseStatusChart from '../../components/dashboard/CaseStatusChart';
import RecentCasesTable from '../../components/dashboard/RecentCasesTable';
import TechnicianWorkloadChart from '../../components/dashboard/TechnicianWorkloadChart';

interface DashboardStats {
  totalCases: number;
  completedCases: number;
  pendingCases: number;
  overdueCases: number;
  avgResolutionTime: number;
  customerSatisfaction: number;
  slaCompliance: number;
}

interface RecentCase {
  id: string;
  caseNumber: string;
  customerName: string;
  deviceType: string;
  status: string;
  priority: string;
  createdAt: string;
  assignedTechnician?: string;
}

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, hasPermission } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load dashboard statistics
      const statsResponse = await apiService.get<DashboardStats>('/api/dashboard/stats');
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      // Load recent cases
      const casesResponse = await apiService.get<RecentCase[]>('/api/cases');
      if (casesResponse.success && casesResponse.data) {
        setRecentCases(casesResponse.data.slice(0, 10));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome back, {user?.firstName}!
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Here's what's happening with your repair operations today.
        </Typography>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Total Cases"
            value={stats?.totalCases || 0}
            icon={<CaseIcon />}
            color="primary"
            trend={+12}
            trendLabel="vs last month"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Completed"
            value={stats?.completedCases || 0}
            icon={<CompletedIcon />}
            color="success"
            trend={+8}
            trendLabel="vs last month"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Pending"
            value={stats?.pendingCases || 0}
            icon={<PendingIcon />}
            color="warning"
            trend={-5}
            trendLabel="vs last month"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Overdue"
            value={stats?.overdueCases || 0}
            icon={<OverdueIcon />}
            color="error"
            trend={-15}
            trendLabel="vs last month"
          />
        </Grid>
      </Grid>

      {/* Performance Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Avg Resolution Time
              </Typography>
              <Typography variant="h4" color="primary.main">
                {stats?.avgResolutionTime || 0}h
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Target: 24h
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Satisfaction
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats?.customerSatisfaction || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Target: 90%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SLA Compliance
              </Typography>
              <Typography variant="h4" color="info.main">
                {stats?.slaCompliance || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Target: 95%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts and Tables */}
      <Grid container spacing={3}>
        {/* Case Status Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Case Status Distribution
              </Typography>
              <CaseStatusChart />
            </CardContent>
          </Card>
        </Grid>

        {/* Technician Workload */}
        {hasPermission('technicians', 'read') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Technician Workload
                </Typography>
                <TechnicianWorkloadChart />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Recent Cases */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Cases
              </Typography>
              <RecentCasesTable cases={recentCases} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;