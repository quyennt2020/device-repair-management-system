import React, { useState, useEffect } from 'react';
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
  CircularProgress,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
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

interface SparePartFormData {
  part_number: string;
  part_name: string;
  category: string;
  manufacturer: string;
  specifications: {
    description?: string;
    technical_specs?: string;
    [key: string]: any;
  };
  compatible_devices: string[];
  pricing_info: {
    currency: string;
    unit_cost: number;
    selling_price: number;
  };
  inventory_settings: {
    minimum_stock: number;
    maximum_stock: number;
    reorder_level: number;
    reorder_quantity: number;
    lead_time_days: number;
  };
  status: string;
}

const EditSparePartPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SparePartFormData>({
    part_number: '',
    part_name: '',
    category: '',
    manufacturer: '',
    specifications: {},
    compatible_devices: [],
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

  useEffect(() => {
    fetchSparePart();
  }, [id]);

  const fetchSparePart = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<any>(`/api/inventory/spare-parts/${id}`);

      if (response.data) {
        const part = response.data;
        setFormData({
          part_number: part.part_number || '',
          part_name: part.part_name || '',
          category: part.category || '',
          manufacturer: part.manufacturer || '',
          specifications: part.specifications || {},
          compatible_devices: part.compatible_devices || [],
          pricing_info: {
            currency: part.pricing_info?.currency || 'VND',
            unit_cost: part.pricing_info?.unit_cost || 0,
            selling_price: part.pricing_info?.selling_price || 0,
          },
          inventory_settings: {
            minimum_stock: part.inventory_settings?.minimum_stock || 10,
            maximum_stock: part.inventory_settings?.maximum_stock || 100,
            reorder_level: part.inventory_settings?.reorder_level || 20,
            reorder_quantity: part.inventory_settings?.reorder_quantity || 50,
            lead_time_days: part.inventory_settings?.lead_time_days || 7,
          },
          status: part.status || 'active',
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch spare part:', err);
      setError(err.message || 'Không thể tải dữ liệu linh kiện');
    } finally {
      setLoading(false);
    }
  };

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
    setSaving(true);
    setError(null);

    try {
      await apiService.put(`/api/inventory/spare-parts/${id}`, formData);
      navigate('/inventory');
    } catch (err: any) {
      console.error('Failed to update spare part:', err);
      setError(err.message || 'Không thể cập nhật linh kiện');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Chỉnh sửa Linh kiện
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
                value={formData.specifications?.description || ''}
                onChange={(e) => handleChange('specifications.description', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Thông số kỹ thuật"
                value={formData.specifications?.technical_specs || ''}
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
                  disabled={saving}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                >
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default EditSparePartPage;
