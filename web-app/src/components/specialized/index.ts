// Workflow Components
export { default as WorkflowVisualization } from '../workflow/WorkflowVisualization';

// Document Components  
export { default as DocumentEditor } from '../document/DocumentEditor';

// Scheduling Components
export { default as AppointmentCalendar } from '../scheduling/AppointmentCalendar';

// Dashboard Components
export { default as DashboardWidgets } from '../dashboard/DashboardWidgets';

// Re-export types for convenience
export type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
} from '../workflow/WorkflowVisualization';

export type {
  DocumentTemplate,
  DocumentContent,
  DocumentAttachment,
} from '../document/DocumentEditor';

export type {
  ServiceAppointment,
  Technician,
  Customer,
} from '../scheduling/AppointmentCalendar';

export type {
  KPIData,
  ChartData,
  TimeSeriesData,
  TechnicianPerformance,
  RecentActivity,
} from '../dashboard/DashboardWidgets';