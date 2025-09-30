import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import {
  WorkflowVisualization,
  DocumentEditor,
  AppointmentCalendar,
  DashboardWidgets,
} from '../../components/specialized';
import type {
  WorkflowDefinition,
  WorkflowInstance,
  DocumentTemplate,
  DocumentContent,
  ServiceAppointment,
  Technician,
  Customer,
  KPIData,
  ChartData,
  TimeSeriesData,
  TechnicianPerformance,
  RecentActivity,
} from '../../components/specialized';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`specialized-tabpanel-${index}`}
      aria-labelledby={`specialized-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Mock data for demonstrations
const mockWorkflowDefinition: WorkflowDefinition = {
  id: 'workflow-repair-premium',
  name: 'Premium Repair Workflow',
  version: '1.0',
  steps: [
    {
      id: 'registration',
      name: 'Đăng ký tiếp nhận',
      type: 'manual',
      status: 'completed',
      assignedTo: 'Customer Service',
      estimatedDuration: 0.5,
      actualDuration: 0.3,
    },
    {
      id: 'device_inspection',
      name: 'Kiểm tra thiết bị',
      type: 'manual',
      status: 'in_progress',
      assignedTo: 'Technician A',
      estimatedDuration: 2,
      requiredDocuments: ['inspection_report'],
      requiredTools: ['multimeter'],
    },
    {
      id: 'quotation_approval',
      name: 'Phê duyệt báo giá',
      type: 'approval',
      status: 'pending',
      assignedTo: 'Manager',
      estimatedDuration: 1,
      requiredDocuments: ['quotation'],
    },
    {
      id: 'repair_execution',
      name: 'Thực hiện sửa chữa',
      type: 'manual',
      status: 'pending',
      estimatedDuration: 4,
      requiredTools: ['multimeter', 'calibration-kit'],
    },
    {
      id: 'quality_check',
      name: 'Kiểm tra chất lượng',
      type: 'manual',
      status: 'pending',
      estimatedDuration: 1,
    },
    {
      id: 'delivery',
      name: 'Giao hàng',
      type: 'manual',
      status: 'pending',
      estimatedDuration: 0.5,
    },
  ],
  transitions: [
    { from: 'registration', to: 'device_inspection', label: 'Complete' },
    { from: 'device_inspection', to: 'quotation_approval', label: 'Approved' },
    { from: 'quotation_approval', to: 'repair_execution', label: 'Approved' },
    { from: 'repair_execution', to: 'quality_check', label: 'Complete' },
    { from: 'quality_check', to: 'delivery', label: 'Pass' },
    { from: 'quality_check', to: 'repair_execution', label: 'Fail' },
  ],
};

const mockWorkflowInstance: WorkflowInstance = {
  id: 'instance-001',
  definitionId: 'workflow-repair-premium',
  currentStepId: 'device_inspection',
  status: 'running',
  startedAt: new Date('2024-01-15T08:00:00'),
  variables: {
    caseId: 'case-2024-001',
    deviceType: 'measurement-device-x100',
    customerTier: 'gold',
  },
};

const mockDocumentTemplate: DocumentTemplate = {
  id: 'inspection-report-template',
  name: 'Inspection Report Template',
  fields: [
    {
      id: 'inspector_name',
      name: 'Inspector Name',
      type: 'text',
      required: true,
    },
    {
      id: 'inspection_date',
      name: 'Inspection Date',
      type: 'date',
      required: true,
    },
    {
      id: 'device_condition',
      name: 'Device Condition',
      type: 'select',
      required: true,
      options: ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'],
    },
    {
      id: 'estimated_hours',
      name: 'Estimated Repair Hours',
      type: 'number',
      required: true,
      validation: { min: 0, max: 100 },
    },
    {
      id: 'findings',
      name: 'Detailed Findings',
      type: 'multiline',
      required: true,
    },
  ],
  content: '<h2>Inspection Report</h2><p>Device inspection completed on {{inspection_date}} by {{inspector_name}}.</p>',
};

const mockTechnicians: Technician[] = [
  {
    id: 'tech-001',
    name: 'Nguyễn Văn A',
    email: 'tech1@company.com',
    phone: '0901234567',
    skills: ['Electronics', 'Calibration', 'Repair'],
    status: 'available',
    location: 'Hà Nội',
  },
  {
    id: 'tech-002',
    name: 'Trần Thị B',
    email: 'tech2@company.com',
    phone: '0901234568',
    skills: ['Mechanical', 'Installation', 'Maintenance'],
    status: 'busy',
    location: 'TP.HCM',
  },
];

const mockCustomers: Customer[] = [
  {
    id: 'customer-001',
    name: 'Công ty ABC',
    company: 'ABC Manufacturing',
    address: '123 Đường ABC, Hà Nội',
    phone: '0241234567',
    email: 'contact@abc.com',
  },
  {
    id: 'customer-002',
    name: 'Công ty XYZ',
    company: 'XYZ Industries',
    address: '456 Đường XYZ, TP.HCM',
    phone: '0281234567',
    email: 'info@xyz.com',
  },
];

const mockAppointments: ServiceAppointment[] = [
  {
    id: 'apt-001',
    title: 'Repair - Công ty ABC',
    start: new Date('2024-01-15T09:00:00'),
    end: new Date('2024-01-15T11:00:00'),
    customerId: 'customer-001',
    customer: mockCustomers[0],
    technicianId: 'tech-001',
    technician: mockTechnicians[0],
    serviceType: 'repair',
    priority: 'high',
    status: 'confirmed',
    location: '123 Đường ABC, Hà Nội',
    estimatedDuration: 120,
    requiredTools: ['multimeter', 'calibration-kit'],
    isOnsite: true,
    createdAt: new Date('2024-01-10T10:00:00'),
    updatedAt: new Date('2024-01-10T10:00:00'),
  },
  {
    id: 'apt-002',
    title: 'Maintenance - Công ty XYZ',
    start: new Date('2024-01-15T14:00:00'),
    end: new Date('2024-01-15T16:00:00'),
    customerId: 'customer-002',
    customer: mockCustomers[1],
    technicianId: 'tech-002',
    technician: mockTechnicians[1],
    serviceType: 'maintenance',
    priority: 'medium',
    status: 'scheduled',
    location: '456 Đường XYZ, TP.HCM',
    estimatedDuration: 120,
    requiredTools: ['basic-tools'],
    isOnsite: true,
    createdAt: new Date('2024-01-10T11:00:00'),
    updatedAt: new Date('2024-01-10T11:00:00'),
  },
];

const mockKPIs: KPIData[] = [
  {
    label: 'Total Cases',
    value: 1247,
    previousValue: 1180,
    format: 'number',
    trend: 'up',
    color: '#2196f3',
  },
  {
    label: 'SLA Compliance',
    value: 94.5,
    target: 95,
    format: 'percentage',
    trend: 'down',
    color: '#4caf50',
  },
  {
    label: 'Revenue',
    value: 2450000000,
    previousValue: 2200000000,
    format: 'currency',
    trend: 'up',
    color: '#ff9800',
  },
  {
    label: 'Avg Resolution Time',
    value: 4.2,
    previousValue: 4.8,
    format: 'duration',
    trend: 'down',
    color: '#9c27b0',
  },
];

const mockCaseStatusData: ChartData[] = [
  { name: 'Open', value: 45, color: '#ff9800' },
  { name: 'In Progress', value: 32, color: '#2196f3' },
  { name: 'Completed', value: 78, color: '#4caf50' },
  { name: 'Cancelled', value: 12, color: '#f44336' },
];

const mockTechnicianWorkloadData: ChartData[] = [
  { name: 'Nguyễn Văn A', value: 8, color: '#2196f3' },
  { name: 'Trần Thị B', value: 6, color: '#4caf50' },
  { name: 'Lê Văn C', value: 10, color: '#ff9800' },
  { name: 'Phạm Thị D', value: 4, color: '#9c27b0' },
];

const mockRevenueData: TimeSeriesData[] = [
  { timestamp: '2024-01-01', revenue: 180000000 },
  { timestamp: '2024-01-02', revenue: 195000000 },
  { timestamp: '2024-01-03', revenue: 210000000 },
  { timestamp: '2024-01-04', revenue: 185000000 },
  { timestamp: '2024-01-05', revenue: 220000000 },
  { timestamp: '2024-01-06', revenue: 235000000 },
  { timestamp: '2024-01-07', revenue: 250000000 },
];

const mockSLAComplianceData: TimeSeriesData[] = [
  { timestamp: '2024-01-01', compliance: 92 },
  { timestamp: '2024-01-02', compliance: 94 },
  { timestamp: '2024-01-03', compliance: 96 },
  { timestamp: '2024-01-04', compliance: 93 },
  { timestamp: '2024-01-05', compliance: 95 },
  { timestamp: '2024-01-06', compliance: 97 },
  { timestamp: '2024-01-07', compliance: 94 },
];

const mockTechnicianPerformance: TechnicianPerformance[] = [
  {
    id: 'tech-001',
    name: 'Nguyễn Văn A',
    casesCompleted: 45,
    averageRating: 4.8,
    efficiency: 92,
    utilization: 85,
    status: 'available',
  },
  {
    id: 'tech-002',
    name: 'Trần Thị B',
    casesCompleted: 38,
    averageRating: 4.6,
    efficiency: 88,
    utilization: 78,
    status: 'busy',
  },
];

const mockRecentActivities: RecentActivity[] = [
  {
    id: 'activity-001',
    type: 'case_created',
    title: 'New repair case created',
    description: 'Case RC-2024-001 created for Công ty ABC',
    timestamp: new Date('2024-01-15T10:30:00'),
    severity: 'info',
    userName: 'Customer Service',
  },
  {
    id: 'activity-002',
    type: 'document_approved',
    title: 'Inspection report approved',
    description: 'Inspection report for case RC-2024-001 has been approved',
    timestamp: new Date('2024-01-15T10:15:00'),
    severity: 'success',
    userName: 'Manager A',
  },
  {
    id: 'activity-003',
    type: 'sla_breach',
    title: 'SLA breach warning',
    description: 'Case RC-2024-002 is at risk of SLA breach',
    timestamp: new Date('2024-01-15T10:00:00'),
    severity: 'warning',
  },
];

export const SpecializedComponentsDemo: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [documentContent, setDocumentContent] = useState<DocumentContent>({
    richText: '<h2>Sample Inspection Report</h2><p>This is a sample inspection report with rich text content.</p>',
    fields: {
      inspector_name: 'Nguyễn Văn A',
      inspection_date: '2024-01-15',
      device_condition: 'Good',
      estimated_hours: 4,
      findings: 'Device is in good condition with minor calibration needed.',
    },
    attachments: [],
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDocumentSave = async (content: DocumentContent) => {
    console.log('Saving document:', content);
    setDocumentContent(content);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleCreateAppointment = async (appointment: Partial<ServiceAppointment>) => {
    console.log('Creating appointment:', appointment);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleUpdateAppointment = async (id: string, updates: Partial<ServiceAppointment>) => {
    console.log('Updating appointment:', id, updates);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleDeleteAppointment = async (id: string) => {
    console.log('Deleting appointment:', id);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleDashboardRefresh = () => {
    console.log('Refreshing dashboard data...');
    // Simulate data refresh
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Specialized UI Components Demo
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This page demonstrates the specialized UI components implemented for the device repair management system.
        Each component is fully functional with mock data.
      </Alert>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="specialized components tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Workflow Visualization" />
          <Tab label="Document Editor" />
          <Tab label="Appointment Calendar" />
          <Tab label="Dashboard Widgets" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" gutterBottom>
            Workflow Visualization Component
          </Typography>
          <Typography variant="body1" paragraph>
            Interactive workflow diagram showing the repair process flow with real-time status updates.
          </Typography>
          <WorkflowVisualization
            definition={mockWorkflowDefinition}
            instance={mockWorkflowInstance}
            interactive={true}
            onStepClick={(step) => console.log('Step clicked:', step)}
            onExecuteStep={(stepId) => console.log('Execute step:', stepId)}
            height={500}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom>
            Document Editor Component
          </Typography>
          <Typography variant="body1" paragraph>
            Rich text editor with template fields, file upload, and image cropping capabilities.
          </Typography>
          <DocumentEditor
            template={mockDocumentTemplate}
            initialContent={documentContent}
            onSave={handleDocumentSave}
            autoSave={true}
            autoSaveInterval={10000}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom>
            Appointment Calendar Component
          </Typography>
          <Typography variant="body1" paragraph>
            Full-featured calendar for scheduling and managing service appointments with technician assignment.
          </Typography>
          <AppointmentCalendar
            appointments={mockAppointments}
            technicians={mockTechnicians}
            customers={mockCustomers}
            onCreateAppointment={handleCreateAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onAppointmentClick={(appointment) => console.log('Appointment clicked:', appointment)}
            defaultView="week"
            showTechnicianFilter={true}
            showStatusFilter={true}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" gutterBottom>
            Dashboard Widgets Component
          </Typography>
          <Typography variant="body1" paragraph>
            Comprehensive dashboard with KPIs, charts, and real-time data visualization.
          </Typography>
          <DashboardWidgets
            kpis={mockKPIs}
            caseStatusData={mockCaseStatusData}
            technicianWorkloadData={mockTechnicianWorkloadData}
            revenueData={mockRevenueData}
            slaComplianceData={mockSLAComplianceData}
            technicianPerformance={mockTechnicianPerformance}
            recentActivities={mockRecentActivities}
            onRefresh={handleDashboardRefresh}
            refreshInterval={30000}
            realTimeUpdates={true}
          />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default SpecializedComponentsDemo;