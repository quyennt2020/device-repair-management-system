import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  AccountTree as DiagramIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../../services/api';

interface WorkflowStep {
  id: string;
  step_name: string;
  step_code: string;
  step_type: string;
  order_number: number;
  required_fields?: string[];
  automated: boolean;
  sla_hours?: number;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  is_active: boolean;
  config: {
    code?: string;
    description?: string;
    steps?: WorkflowStep[];
  };
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
}

interface WorkflowInstance {
  id: string;
  case_id: string;
  case_number: string;
  current_step: string;
  status: string;
  started_at: string;
  completed_at?: string;
}

const WorkflowDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (id) {
      fetchWorkflowDetails();
      fetchWorkflowInstances();
    }
  }, [id]);

  const fetchWorkflowDetails = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/api/workflows/definitions/${id}`);
      if ((response as any).success) {
        setWorkflow((response as any).data);
      }
    } catch (error) {
      console.error('Error fetching workflow details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowInstances = async () => {
    try {
      const response = await apiService.get(`/api/workflows/instances?workflow_id=${id}`);
      if ((response as any).success) {
        setInstances((response as any).data || []);
      }
    } catch (error) {
      console.error('Error fetching workflow instances:', error);
    }
  };

  if (loading || !workflow) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading workflow details...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => navigate('/workflows')}>
            Back
          </Button>
          <Typography variant="h4" fontWeight="bold">
            {workflow.name}
          </Typography>
          <Chip
            icon={workflow.is_active ? <ActiveIcon /> : <InactiveIcon />}
            label={workflow.is_active ? 'Active' : 'Inactive'}
            color={workflow.is_active ? 'success' : 'error'}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/workflows/${id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="contained"
            startIcon={<DiagramIcon />}
            onClick={() => navigate(`/workflows/${id}/diagram`)}
          >
            View Diagram
          </Button>
        </Box>
      </Box>

      {/* Overview Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Workflow Code
              </Typography>
              <Typography variant="h6" fontFamily="monospace" fontWeight="bold">
                {workflow.config?.code || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Version
              </Typography>
              <Typography variant="h6">v{workflow.version}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {workflow.config?.description || 'No description provided'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Created At
              </Typography>
              <Typography variant="body1">
                {new Date(workflow.created_at).toLocaleString('vi-VN')}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body1">
                {new Date(workflow.updated_at).toLocaleString('vi-VN')}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Steps" />
          <Tab label="Active Instances" />
          <Tab label="Configuration" />
        </Tabs>
      </Box>

      {/* Steps Tab */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Step Code</TableCell>
                <TableCell>Step Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>SLA</TableCell>
                <TableCell>Automated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workflow.steps && workflow.steps.length > 0 ? (
                workflow.steps
                  .sort((a, b) => (a.order_number || 0) - (b.order_number || 0))
                  .map((step) => (
                    <TableRow key={step.id}>
                      <TableCell>
                        <Chip label={step.order_number || 'N/A'} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        <Typography fontFamily="monospace" variant="body2">
                          {step.step_code || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="500">{step.step_name || 'N/A'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={step.step_type || 'N/A'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {step.sla_hours ? `${step.sla_hours}h` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={step.automated ? 'Yes' : 'No'}
                          size="small"
                          color={step.automated ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">No steps defined yet</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Instances Tab */}
      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Case Number</TableCell>
                <TableCell>Current Step</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Started At</TableCell>
                <TableCell>Completed At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instances.length > 0 ? (
                instances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell>
                      <Button
                        variant="text"
                        onClick={() => navigate(`/cases/${instance.case_id}`)}
                      >
                        {instance.case_number}
                      </Button>
                    </TableCell>
                    <TableCell>{instance.current_step}</TableCell>
                    <TableCell>
                      <Chip
                        label={instance.status}
                        size="small"
                        color={
                          instance.status === 'completed'
                            ? 'success'
                            : instance.status === 'running'
                            ? 'info'
                            : 'warning'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(instance.started_at).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      {instance.completed_at
                        ? new Date(instance.completed_at).toLocaleString('vi-VN')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">No active instances</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Configuration Tab */}
      {tabValue === 2 && (
        <Box>
          <Grid container spacing={3}>
            {/* General Settings */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    General Settings
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" color="text.secondary">
                        Workflow Code
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        {workflow.config?.code || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Chip
                        label={workflow.is_active ? 'Active' : 'Inactive'}
                        color={workflow.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {workflow.config?.description || 'No description'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Triggers */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Triggers
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="Manual Start" size="small" color="primary" variant="outlined" />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="Case Creation" size="small" color="primary" variant="outlined" />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      Workflow can be triggered when a new repair case is created or started manually
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Notifications */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Notifications
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="Email" size="small" color="success" />
                      <Typography variant="body2">On step completion</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="SMS" size="small" color="success" />
                      <Typography variant="body2">On approval required</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="In-App" size="small" color="success" />
                      <Typography variant="body2">Real-time updates</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Escalation Rules */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Escalation Rules
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Typography variant="body2" fontWeight="500">
                        SLA Warning (80% threshold)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Notify supervisor when 80% of SLA time has elapsed
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight="500">
                        SLA Breach
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Escalate to manager immediately upon SLA breach
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight="500">
                        Approval Timeout
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Auto-escalate after 72 hours without customer response
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Integration Settings */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Integrations
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Email Service</Typography>
                      <Chip label="Connected" size="small" color="success" />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">SMS Gateway</Typography>
                      <Chip label="Connected" size="small" color="success" />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Document Storage</Typography>
                      <Chip label="MinIO" size="small" color="primary" variant="outlined" />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Payment Gateway</Typography>
                      <Chip label="Not configured" size="small" color="default" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Advanced Settings */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Advanced Settings
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Auto-assignment
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Enabled" size="small" color="success" />
                        <Typography variant="caption">
                          Based on skills and workload
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Parallel execution
                      </Typography>
                      <Chip label="Disabled" size="small" color="default" />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Allow step skipping
                      </Typography>
                      <Chip label="Disabled" size="small" color="default" />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Retry failed steps
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label="Enabled" size="small" color="success" />
                        <Typography variant="caption">Max 3 retries</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Workflow timeout
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        30 days
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Data retention
                      </Typography>
                      <Typography variant="body1" fontWeight="500">
                        2 years
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default WorkflowDetailsPage;
