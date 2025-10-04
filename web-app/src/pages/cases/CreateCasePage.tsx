import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Paper
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
}

interface Device {
  id: string;
  brand: string;
  model: string;
  serial_number: string;
  customer_id: string | null;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  skills: string[];
}

interface CreateCaseForm {
  customer_id: string;
  device_id: string;
  service_type: string;
  priority: string;
  description: string;
  assigned_technician_id: string;
  scheduled_date: string;
  estimated_duration: number;
}

const steps = ['Thông tin cơ bản', 'Chi tiết dịch vụ', 'Phân công & Lịch trình'];

const CreateCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Data lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);

  // Form data
  const [formData, setFormData] = useState<CreateCaseForm>({
    customer_id: '',
    device_id: '',
    service_type: '',
    priority: 'medium',
    description: '',
    assigned_technician_id: '',
    scheduled_date: '',
    estimated_duration: 2
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (formData.customer_id) {
      const customerDevices = devices.filter(d => d.customer_id === formData.customer_id);
      setFilteredDevices(customerDevices);
      // Reset device selection if current device doesn't belong to selected customer
      if (formData.device_id && !customerDevices.find(d => d.id === formData.device_id)) {
        setFormData(prev => ({ ...prev, device_id: '' }));
      }
    } else {
      setFilteredDevices([]);
    }
  }, [formData.customer_id, devices]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [customersRes, devicesRes, techniciansRes] = await Promise.all([
        apiService.get<Customer[]>('/api/customers'),
        apiService.get<Device[]>('/api/devices'),
        apiService.get<Technician[]>('/api/technicians')
      ]);

      setCustomers(customersRes.data || []);
      setDevices(devicesRes.data || []);
      setTechnicians(techniciansRes.data || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setError('Không thể tải dữ liệu ban đầu');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateCaseForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        const step0Valid = !!(formData.customer_id && formData.device_id);
        console.log('Step 0 validation:', { customer_id: formData.customer_id, device_id: formData.device_id, valid: step0Valid });
        return step0Valid;
      case 1:
        const step1Valid = !!(formData.service_type && formData.description.trim());
        console.log('Step 1 validation:', { service_type: formData.service_type, description: formData.description, valid: step1Valid });
        return step1Valid;
      case 2:
        const step2Valid = !!(formData.scheduled_date);
        console.log('Step 2 validation:', { scheduled_date: formData.scheduled_date, valid: step2Valid });
        return step2Valid;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get customer name for title
      const selectedCustomer = customers.find(c => c.id === formData.customer_id);
      const customerName = selectedCustomer?.name || selectedCustomer?.company || 'Customer';

      const payload = {
        title: `${formData.service_type} - ${customerName}`,
        description: formData.description,
        customer_id: formData.customer_id,
        device_id: formData.device_id,
        service_type: formData.service_type,
        category: formData.service_type, // Use service_type as category
        priority: formData.priority,
        assigned_technician_id: formData.assigned_technician_id || null,
        scheduled_date: formData.scheduled_date || null,
        requested_by: localStorage.getItem('user_id') || '00000000-0000-0000-0000-000000000001'
      };

      console.log('Submitting payload:', payload);
      const response = await apiService.post('/api/cases', payload);
      console.log('API response:', response);

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/cases');
        }, 2000);
      } else {
        setError('Server returned error: ' + (response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.message || 'Có lỗi xảy ra khi tạo case');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Chọn khách hàng và thiết bị
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={customers}
                getOptionLabel={(option) => `${option.name}${option.company ? ' - ' + option.company : ''}`}
                value={customers.find(c => c.id === formData.customer_id) || null}
                onChange={(_, value) => handleInputChange('customer_id', value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Khách hàng"
                    required
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={filteredDevices}
                getOptionLabel={(option) => `${option.brand} ${option.model} (${option.serial_number})`}
                value={filteredDevices.find(d => d.id === formData.device_id) || null}
                onChange={(_, value) => handleInputChange('device_id', value?.id || '')}
                disabled={!formData.customer_id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Thiết bị"
                    required
                    fullWidth
                    helperText={!formData.customer_id ? "Vui lòng chọn khách hàng trước" : `${filteredDevices.length} thiết bị có sẵn`}
                  />
                )}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Chi tiết dịch vụ
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Loại dịch vụ</InputLabel>
                <Select
                  value={formData.service_type}
                  label="Loại dịch vụ"
                  onChange={(e) => handleInputChange('service_type', e.target.value)}
                >
                  <MenuItem value="repair">Sửa chữa</MenuItem>
                  <MenuItem value="maintenance">Bảo trì</MenuItem>
                  <MenuItem value="inspection">Kiểm tra</MenuItem>
                  <MenuItem value="calibration">Hiệu chuẩn</MenuItem>
                  <MenuItem value="installation">Lắp đặt</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Độ ưu tiên</InputLabel>
                <Select
                  value={formData.priority}
                  label="Độ ưu tiên"
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                >
                  <MenuItem value="low">Thấp</MenuItem>
                  <MenuItem value="medium">Trung bình</MenuItem>
                  <MenuItem value="high">Cao</MenuItem>
                  <MenuItem value="urgent">Khẩn cấp</MenuItem>
                  <MenuItem value="emergency">Khẩn cấp</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Mô tả chi tiết"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                required
                placeholder="Mô tả chi tiết về vấn đề, yêu cầu dịch vụ..."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Thời gian ước tính (giờ)"
                value={formData.estimated_duration}
                onChange={(e) => handleInputChange('estimated_duration', parseInt(e.target.value) || 0)}
                inputProps={{ min: 0.5, step: 0.5 }}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Phân công và lịch trình
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={technicians}
                getOptionLabel={(option) => `${option.first_name} ${option.last_name} - ${option.email}`}
                value={technicians.find(t => t.id === formData.assigned_technician_id) || null}
                onChange={(_, value) => handleInputChange('assigned_technician_id', value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Kỹ thuật viên"
                    fullWidth
                    helperText="Để trống để hệ thống tự động phân công"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Ngày giờ dự kiến"
                value={formData.scheduled_date}
                onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (success) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          Case đã được tạo thành công! Đang chuyển hướng...
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/cases')}
          sx={{ mr: 2 }}
        >
          Quay lại
        </Button>
        <Typography variant="h4" component="h1">
          Tạo Case Mới
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Paper sx={{ p: 3, mb: 3 }}>
            {renderStepContent(activeStep)}
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Quay lại
            </Button>
            
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading || !validateStep(activeStep)}
                  startIcon={<SaveIcon />}
                >
                  {loading ? 'Đang tạo...' : 'Tạo Case'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!validateStep(activeStep)}
                >
                  Tiếp theo
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateCasePage;