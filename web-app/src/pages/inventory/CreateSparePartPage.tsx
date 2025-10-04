import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  InputAdornment,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

const CATEGORIES = [
  'Electronic Components',
  'PCB',
  'Sensors',
  'Power Supply',
  'Mechanical Parts',
  'Cables & Connectors',
  'Tools & Equipment',
];

const CreateSparePartPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    part_number: '',
    part_name: '',
    category: '',
    manufacturer: '',
    specifications: {
      description: '',
      technical_specs: '',
    },
    compatible_devices: [] as string[],
    pricing_info: {
      currency: 'VND',
      unit_cost: 0,
      selling_price: 0,
    },
    inventory_settings: {
      minimum_stock: 10,
      maximum_stock: 100,
      reorder_level: 20,
      reorder_quantity: 50,
      lead_time_days: 7,
    },
    status: 'active',
  });

  const handleChange = (field: string, value: any) => {
    const keys = field.split('.');
    if (keys.length === 1) {
      setFormData({ ...formData, [field]: value });
    } else if (keys.length === 2) {
      setFormData({
        ...formData,
        [keys[0]]: {
          ...(formData[keys[0] as keyof typeof formData] as any),
          [keys[1]]: value,
        },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiService.post('/api/inventory/spare-parts', formData);
      navigate('/inventory');
    } catch (err: any) {
      console.error('Failed to create spare part:', err);
      setError(err.message || 'Không thể tạo linh kiện');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Thêm Linh kiện mới
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/inventory')}>
          Quay lại
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Thông tin cơ bản
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                label="Mã linh kiện"
                value={formData.part_number}
                onChange={(e) => handleChange('part_number', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                label="Tên linh kiện"
                value={formData.part_name}
                onChange={(e) => handleChange('part_name', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Danh mục</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  label="Danh mục"
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nhà sản xuất"
                value={formData.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Mô tả"
                value={formData.specifications.description}
                onChange={(e) => handleChange('specifications.description', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Thông số kỹ thuật"
                value={formData.specifications.technical_specs}
                onChange={(e) => handleChange('specifications.technical_specs', e.target.value)}
                placeholder="Ví dụ: Điện áp: 25V, Dung lượng: 470uF"
              />
            </Grid>

            {/* Pricing Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Thông tin giá
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="number"
                label="Giá nhập"
                value={formData.pricing_info.unit_cost}
                onChange={(e) => handleChange('pricing_info.unit_cost', parseFloat(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">VNĐ</InputAdornment>,
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="number"
                label="Giá bán"
                value={formData.pricing_info.selling_price}
                onChange={(e) => handleChange('pricing_info.selling_price', parseFloat(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">VNĐ</InputAdornment>,
                }}
              />
            </Grid>

            {/* Inventory Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Cài đặt tồn kho
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="number"
                label="Tồn kho tối thiểu"
                value={formData.inventory_settings.minimum_stock}
                onChange={(e) => handleChange('inventory_settings.minimum_stock', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="number"
                label="Tồn kho tối đa"
                value={formData.inventory_settings.maximum_stock}
                onChange={(e) => handleChange('inventory_settings.maximum_stock', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="number"
                label="Mức đặt hàng lại"
                value={formData.inventory_settings.reorder_level}
                onChange={(e) => handleChange('inventory_settings.reorder_level', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                required
                fullWidth
                type="number"
                label="Số lượng đặt hàng"
                value={formData.inventory_settings.reorder_quantity}
                onChange={(e) => handleChange('inventory_settings.reorder_quantity', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Thời gian giao hàng (ngày)"
                value={formData.inventory_settings.lead_time_days}
                onChange={(e) => handleChange('inventory_settings.lead_time_days', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Trạng thái</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  label="Trạng thái"
                >
                  <MenuItem value="active">Hoạt động</MenuItem>
                  <MenuItem value="inactive">Không hoạt động</MenuItem>
                  <MenuItem value="discontinued">Ngừng sản xuất</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Submit Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/inventory')}
                  disabled={loading}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? 'Đang tạo...' : 'Tạo linh kiện'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default CreateSparePartPage;
