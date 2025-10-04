import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit as EditIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';

interface SparePart {
  id: string;
  part_number: string;
  part_name: string;
  category: string;
  manufacturer: string;
  specifications: any;
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
  inventory_by_warehouse?: Array<{
    warehouse_id: string;
    warehouse_name: string;
    warehouse_code: string;
    quantity_available: number;
    quantity_reserved: number;
    quantity_on_order: number;
    minimum_stock: number;
    maximum_stock: number;
    location_bin: string;
  }>;
}

const SparePartDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sparePart, setSparePart] = useState<SparePart | null>(null);

  useEffect(() => {
    fetchSparePart();
  }, [id]);

  const fetchSparePart = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<SparePart>(`/api/inventory/spare-parts/${id}`);

      if (response.data) {
        setSparePart(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch spare part:', err);
      setError(err.message || 'Không thể tải dữ liệu linh kiện');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'discontinued':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Hoạt động';
      case 'inactive':
        return 'Không hoạt động';
      case 'discontinued':
        return 'Ngừng sản xuất';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !sparePart) {
    return (
      <Box>
        <Alert severity="error">{error || 'Không tìm thấy linh kiện'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/inventory')}>
          Quay lại
        </Button>
      </Box>
    );
  }

  const totalQuantity = sparePart.inventory_by_warehouse?.reduce(
    (sum, inv) => sum + (inv.quantity_available || 0),
    0
  ) || 0;

  const totalReserved = sparePart.inventory_by_warehouse?.reduce(
    (sum, inv) => sum + (inv.quantity_reserved || 0),
    0
  ) || 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Chi tiết Linh kiện
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/inventory')}>
            Quay lại
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/inventory/spare-parts/${id}/edit`)}
          >
            Chỉnh sửa
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Thông tin cơ bản
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Mã linh kiện
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {sparePart.part_number}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Tên linh kiện
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {sparePart.part_name}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Danh mục
                </Typography>
                <Typography variant="body1">{sparePart.category}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Nhà sản xuất
                </Typography>
                <Typography variant="body1">{sparePart.manufacturer || 'N/A'}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Trạng thái
                </Typography>
                <Chip
                  label={getStatusLabel(sparePart.status)}
                  color={getStatusColor(sparePart.status) as any}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Grid>

              {sparePart.specifications?.description && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Mô tả
                  </Typography>
                  <Typography variant="body1">{sparePart.specifications.description}</Typography>
                </Grid>
              )}

              {sparePart.specifications?.technical_specs && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Thông số kỹ thuật
                  </Typography>
                  <Typography variant="body1">{sparePart.specifications.technical_specs}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Pricing & Inventory */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Thông tin giá
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Giá nhập
              </Typography>
              <Typography variant="h6" color="primary">
                {sparePart.pricing_info?.unit_cost?.toLocaleString('vi-VN')} VNĐ
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Giá bán
              </Typography>
              <Typography variant="h6" color="success.main">
                {sparePart.pricing_info?.selling_price?.toLocaleString('vi-VN')} VNĐ
              </Typography>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tồn kho tổng
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Tồn kho khả dụng
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {totalQuantity}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Đã đặt trước
              </Typography>
              <Typography variant="h6" color="warning.main">
                {totalReserved}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Inventory Settings */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Cài đặt tồn kho
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={2.4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Tồn kho tối thiểu
                    </Typography>
                    <Typography variant="h6">
                      {sparePart.inventory_settings?.minimum_stock || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={2.4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Tồn kho tối đa
                    </Typography>
                    <Typography variant="h6">
                      {sparePart.inventory_settings?.maximum_stock || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={2.4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Mức đặt hàng lại
                    </Typography>
                    <Typography variant="h6">
                      {sparePart.inventory_settings?.reorder_level || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={2.4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Số lượng đặt hàng
                    </Typography>
                    <Typography variant="h6">
                      {sparePart.inventory_settings?.reorder_quantity || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={2.4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      Thời gian giao hàng
                    </Typography>
                    <Typography variant="h6">
                      {sparePart.inventory_settings?.lead_time_days || 0} ngày
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Inventory by Warehouse */}
        {sparePart.inventory_by_warehouse && sparePart.inventory_by_warehouse.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Tồn kho theo kho
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Kho</TableCell>
                      <TableCell>Mã kho</TableCell>
                      <TableCell align="right">Khả dụng</TableCell>
                      <TableCell align="right">Đã đặt</TableCell>
                      <TableCell align="right">Đang đặt hàng</TableCell>
                      <TableCell>Vị trí</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sparePart.inventory_by_warehouse.map((inv, index) => (
                      <TableRow key={index}>
                        <TableCell>{inv.warehouse_name}</TableCell>
                        <TableCell>{inv.warehouse_code}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">{inv.quantity_available || 0}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="warning.main">{inv.quantity_reserved || 0}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="info.main">{inv.quantity_on_order || 0}</Typography>
                        </TableCell>
                        <TableCell>{inv.location_bin || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default SparePartDetailsPage;
