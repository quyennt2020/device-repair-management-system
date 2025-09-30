import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, View, Event } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Person,
  LocationOn,
  Schedule,
  Build,
  Warning,
  CheckCircle,
  Cancel,
  Refresh,
  FilterList,
  CalendarToday,
  ViewWeek,
  ViewDay,
  ViewModule,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';

const localizer = momentLocalizer(moment);

interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  skills: string[];
  avatar?: string;
  status: 'available' | 'busy' | 'offline';
  location?: string;
}

interface Customer {
  id: string;
  name: string;
  company: string;
  address: string;
  phone: string;
  email: string;
}

interface ServiceAppointment extends Event {
  id: string;
  caseId?: string;
  customerId: string;
  customer: Customer;
  technicianId: string;
  technician: Technician;
  serviceType: 'repair' | 'maintenance' | 'installation' | 'inspection';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  location: string;
  estimatedDuration: number; // in minutes
  requiredTools: string[];
  notes?: string;
  isOnsite: boolean;
  travelTime?: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

interface AppointmentCalendarProps {
  appointments: ServiceAppointment[];
  technicians: Technician[];
  customers: Customer[];
  onCreateAppointment?: (appointment: Partial<ServiceAppointment>) => Promise<void>;
  onUpdateAppointment?: (id: string, updates: Partial<ServiceAppointment>) => Promise<void>;
  onDeleteAppointment?: (id: string) => Promise<void>;
  onAppointmentClick?: (appointment: ServiceAppointment) => void;
  readOnly?: boolean;
  defaultView?: View;
  showTechnicianFilter?: boolean;
  showStatusFilter?: boolean;
}

interface AppointmentFormData {
  customerId: string;
  technicianId: string;
  serviceType: string;
  priority: string;
  start: Date;
  end: Date;
  location: string;
  notes: string;
  isOnsite: boolean;
  requiredTools: string[];
}

const serviceTypeColors = {
  repair: '#f44336',
  maintenance: '#4caf50',
  installation: '#2196f3',
  inspection: '#ff9800',
};

const priorityColors = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
  urgent: '#9c27b0',
};

const statusColors = {
  scheduled: '#9e9e9e',
  confirmed: '#2196f3',
  in_progress: '#ff9800',
  completed: '#4caf50',
  cancelled: '#f44336',
};

export const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  appointments,
  technicians,
  customers,
  onCreateAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  onAppointmentClick,
  readOnly = false,
  defaultView = 'week',
  showTechnicianFilter = true,
  showStatusFilter = true,
}) => {
  const [view, setView] = useState<View>(defaultView);
  const [date, setDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState<ServiceAppointment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [formData, setFormData] = useState<AppointmentFormData>({
    customerId: '',
    technicianId: '',
    serviceType: 'repair',
    priority: 'medium',
    start: new Date(),
    end: moment().add(2, 'hours').toDate(),
    location: '',
    notes: '',
    isOnsite: true,
    requiredTools: [],
  });

  // Filter appointments based on selected filters
  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      if (selectedTechnicians.length > 0 && !selectedTechnicians.includes(appointment.technicianId)) {
        return false;
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(appointment.status)) {
        return false;
      }
      return true;
    });
  }, [appointments, selectedTechnicians, selectedStatuses]);

  // Custom event style getter
  const eventStyleGetter = useCallback((event: ServiceAppointment) => {
    const backgroundColor = serviceTypeColors[event.serviceType] || '#757575';
    const borderColor = priorityColors[event.priority] || '#757575';

    return {
      style: {
        backgroundColor,
        borderColor,
        borderWidth: '2px',
        borderStyle: 'solid',
        opacity: event.status === 'cancelled' ? 0.5 : 1,
      },
    };
  }, []);

  // Custom event component
  const EventComponent = ({ event }: { event: ServiceAppointment }) => (
    <Box sx={{ p: 0.5, height: '100%', overflow: 'hidden' }}>
      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
        {event.customer.name}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block' }}>
        {event.technician.name}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
        <Chip
          label={event.status}
          size="small"
          sx={{
            height: 16,
            fontSize: '0.6rem',
            backgroundColor: statusColors[event.status],
            color: 'white',
          }}
        />
      </Box>
    </Box>
  );

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    if (readOnly) return;

    setFormData({
      ...formData,
      start,
      end,
    });
    setIsEditing(false);
    setFormOpen(true);
  }, [formData, readOnly]);

  const handleSelectEvent = useCallback((event: ServiceAppointment) => {
    setSelectedAppointment(event);
    if (onAppointmentClick) {
      onAppointmentClick(event);
    } else {
      setDetailsOpen(true);
    }
  }, [onAppointmentClick]);

  const handleCreateAppointment = async () => {
    if (!onCreateAppointment) return;

    const customer = customers.find(c => c.id === formData.customerId);
    const technician = technicians.find(t => t.id === formData.technicianId);

    if (!customer || !technician) return;

    const newAppointment: Partial<ServiceAppointment> = {
      ...formData,
      serviceType: formData.serviceType as 'repair' | 'maintenance' | 'installation' | 'inspection',
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      title: `${formData.serviceType} - ${customer.name}`,
      customer,
      technician,
      estimatedDuration: moment(formData.end).diff(moment(formData.start), 'minutes'),
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await onCreateAppointment(newAppointment);
      setFormOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create appointment:', error);
    }
  };

  const handleUpdateAppointment = async () => {
    if (!onUpdateAppointment || !selectedAppointment) return;

    const customer = customers.find(c => c.id === formData.customerId);
    const technician = technicians.find(t => t.id === formData.technicianId);

    if (!customer || !technician) return;

    const updates: Partial<ServiceAppointment> = {
      ...formData,
      serviceType: formData.serviceType as 'repair' | 'maintenance' | 'installation' | 'inspection',
      priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent',
      title: `${formData.serviceType} - ${customer.name}`,
      customer,
      technician,
      estimatedDuration: moment(formData.end).diff(moment(formData.start), 'minutes'),
      updatedAt: new Date(),
    };

    try {
      await onUpdateAppointment(selectedAppointment.id, updates);
      setFormOpen(false);
      setDetailsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to update appointment:', error);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!onDeleteAppointment || !selectedAppointment) return;

    try {
      await onDeleteAppointment(selectedAppointment.id);
      setDetailsOpen(false);
    } catch (error) {
      console.error('Failed to delete appointment:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      technicianId: '',
      serviceType: 'repair',
      priority: 'medium',
      start: new Date(),
      end: moment().add(2, 'hours').toDate(),
      location: '',
      notes: '',
      isOnsite: true,
      requiredTools: [],
    });
  };

  const openEditForm = (appointment: ServiceAppointment) => {
    setFormData({
      customerId: appointment.customerId,
      technicianId: appointment.technicianId,
      serviceType: appointment.serviceType,
      priority: appointment.priority,
      start: appointment.start as Date,
      end: appointment.end as Date,
      location: appointment.location,
      notes: appointment.notes || '',
      isOnsite: appointment.isOnsite,
      requiredTools: appointment.requiredTools,
    });
    setIsEditing(true);
    setDetailsOpen(false);
    setFormOpen(true);
  };

  // Get technician workload for the current view
  const getTechnicianWorkload = (technicianId: string) => {
    const techAppointments = filteredAppointments.filter(
      app => app.technicianId === technicianId &&
        moment(app.start).isSame(date, view === 'day' ? 'day' : 'week')
    );
    return techAppointments.length;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterMoment}>
      <Box>
        {/* Calendar Controls */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => {
                    resetForm();
                    setIsEditing(false);
                    setFormOpen(true);
                  }}
                  disabled={readOnly}
                >
                  New Appointment
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </Button>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant={view === 'day' ? 'contained' : 'outlined'}
                  startIcon={<ViewDay />}
                  onClick={() => setView('day')}
                  size="small"
                >
                  Day
                </Button>
                <Button
                  variant={view === 'week' ? 'contained' : 'outlined'}
                  startIcon={<ViewWeek />}
                  onClick={() => setView('week')}
                  size="small"
                >
                  Week
                </Button>
                <Button
                  variant={view === 'month' ? 'contained' : 'outlined'}
                  startIcon={<ViewModule />}
                  onClick={() => setView('month')}
                  size="small"
                >
                  Month
                </Button>
              </Box>
            </Grid>
          </Grid>

          {/* Filters */}
          {(showTechnicianFilter || showStatusFilter) && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                {showTechnicianFilter && (
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Filter by Technician</InputLabel>
                      <Select
                        multiple
                        value={selectedTechnicians}
                        onChange={(e) => setSelectedTechnicians(e.target.value as string[])}
                        label="Filter by Technician"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => {
                              const tech = technicians.find(t => t.id === value);
                              return (
                                <Chip key={value} label={tech?.name} size="small" />
                              );
                            })}
                          </Box>
                        )}
                      >
                        {technicians.map((tech) => (
                          <MenuItem key={tech.id} value={tech.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar src={tech.avatar} sx={{ width: 24, height: 24 }}>
                                {tech.name.charAt(0)}
                              </Avatar>
                              {tech.name}
                              <Badge
                                badgeContent={getTechnicianWorkload(tech.id)}
                                color="primary"
                                sx={{ ml: 'auto' }}
                              />
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {showStatusFilter && (
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Filter by Status</InputLabel>
                      <Select
                        multiple
                        value={selectedStatuses}
                        onChange={(e) => setSelectedStatuses(e.target.value as string[])}
                        label="Filter by Status"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selected.map((value) => (
                              <Chip
                                key={value}
                                label={value}
                                size="small"
                                sx={{
                                  backgroundColor: statusColors[value as keyof typeof statusColors],
                                  color: 'white',
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      >
                        {Object.keys(statusColors).map((status) => (
                          <MenuItem key={status} value={status}>
                            <Chip
                              label={status}
                              size="small"
                              sx={{
                                backgroundColor: statusColors[status as keyof typeof statusColors],
                                color: 'white',
                                mr: 1,
                              }}
                            />
                            {status}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </Paper>

        {/* Calendar */}
        <Paper sx={{ p: 1, height: 600 }}>
          <Calendar
            localizer={localizer}
            events={filteredAppointments}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable={!readOnly}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventComponent,
            }}
            step={30}
            timeslots={2}
            min={moment().hour(7).minute(0).toDate()}
            max={moment().hour(19).minute(0).toDate()}
          />
        </Paper>

        {/* Appointment Form Dialog */}
        <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {isEditing ? 'Edit Appointment' : 'New Appointment'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Customer</InputLabel>
                  <Select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    label="Customer"
                  >
                    {customers.map((customer) => (
                      <MenuItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.company}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Technician</InputLabel>
                  <Select
                    value={formData.technicianId}
                    onChange={(e) => setFormData({ ...formData, technicianId: e.target.value })}
                    label="Technician"
                  >
                    {technicians.map((tech) => (
                      <MenuItem key={tech.id} value={tech.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar src={tech.avatar} sx={{ width: 24, height: 24 }}>
                            {tech.name.charAt(0)}
                          </Avatar>
                          {tech.name}
                          <Chip
                            label={tech.status}
                            size="small"
                            color={tech.status === 'available' ? 'success' : 'default'}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Service Type</InputLabel>
                  <Select
                    value={formData.serviceType}
                    onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                    label="Service Type"
                  >
                    <MenuItem value="repair">Repair</MenuItem>
                    <MenuItem value="maintenance">Maintenance</MenuItem>
                    <MenuItem value="installation">Installation</MenuItem>
                    <MenuItem value="inspection">Inspection</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Time"
                  value={moment(formData.start)}
                  onChange={(newValue) =>
                    setFormData({ ...formData, start: newValue?.toDate() || new Date() })
                  }
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Time"
                  value={moment(formData.end)}
                  onChange={(newValue) =>
                    setFormData({ ...formData, end: newValue?.toDate() || new Date() })
                  }
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={isEditing ? handleUpdateAppointment : handleCreateAppointment}
            >
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Appointment Details Dialog */}
        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">Appointment Details</Typography>
              {selectedAppointment && (
                <Chip
                  label={selectedAppointment.status}
                  sx={{
                    backgroundColor: statusColors[selectedAppointment.status],
                    color: 'white',
                  }}
                />
              )}
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedAppointment && (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" mb={1}>Customer</Typography>
                        <Typography variant="body1">{selectedAppointment.customer.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {selectedAppointment.customer.company}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {selectedAppointment.customer.phone}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" mb={1}>Technician</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar src={selectedAppointment.technician.avatar}>
                            {selectedAppointment.technician.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body1">
                              {selectedAppointment.technician.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              {selectedAppointment.technician.phone}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selectedAppointment.technician.skills.map((skill) => (
                            <Chip key={skill} label={skill} size="small" />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" mb={2}>Service Details</Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="textSecondary">Service Type</Typography>
                            <Typography variant="body1">{selectedAppointment.serviceType}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="textSecondary">Priority</Typography>
                            <Chip
                              label={selectedAppointment.priority}
                              size="small"
                              sx={{
                                backgroundColor: priorityColors[selectedAppointment.priority],
                                color: 'white',
                              }}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="textSecondary">Start Time</Typography>
                            <Typography variant="body1">
                              {moment(selectedAppointment.start).format('MMMM Do YYYY, h:mm A')}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="textSecondary">End Time</Typography>
                            <Typography variant="body1">
                              {moment(selectedAppointment.end).format('MMMM Do YYYY, h:mm A')}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="textSecondary">Location</Typography>
                            <Typography variant="body1">{selectedAppointment.location}</Typography>
                          </Grid>
                          {selectedAppointment.notes && (
                            <Grid item xs={12}>
                              <Typography variant="body2" color="textSecondary">Notes</Typography>
                              <Typography variant="body1">{selectedAppointment.notes}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>

                  {selectedAppointment.requiredTools.length > 0 && (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" mb={1}>Required Tools</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {selectedAppointment.requiredTools.map((tool) => (
                              <Chip key={tool} label={tool} size="small" icon={<Build />} />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)}>Close</Button>
            {!readOnly && selectedAppointment && (
              <>
                <Button
                  startIcon={<Edit />}
                  onClick={() => openEditForm(selectedAppointment)}
                >
                  Edit
                </Button>
                <Button
                  startIcon={<Delete />}
                  color="error"
                  onClick={handleDeleteAppointment}
                >
                  Delete
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AppointmentCalendar;

// Export types
export type { ServiceAppointment, Technician, Customer };