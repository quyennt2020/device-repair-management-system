import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Button,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

interface LowStockAlert {
  id: string;
  part_number: string;
  part_name: string;
  category: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity_available: number;
  minimum_stock: number;
  quantity_reserved: number;
  reorder_quantity?: number;
  reorder_level?: number;
}

interface InventoryStats {
  total_parts: number;
  total_warehouses: number;
  total_items: number;
  total_reserved: number;
  total_value: number;
  low_stock_count: number;
}

const LowStockAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [alertsResponse, statsResponse] = await Promise.all([
        apiService.get<LowStockAlert[]>('/api/inventory/alerts/low-stock'),
        apiService.get<InventoryStats>('/api/inventory/stats/summary'),
      ]);

      if (alertsResponse.data) {
        setAlerts(alertsResponse.data);
      }

      if (statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch alerts:', err);
      setError(err.message || 'Không thể tải dữ liệu cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  const getStockLevel = (available: number, minimum: number) => {
    const percentage = (available / minimum) * 100;
    if (percentage <= 50) return { color: 'error', label: 'Rất thấp' };
    if (percentage <= 100) return { color: 'warning', label: 'Thấp' };
    return { color: 'success', label: 'Đủ' };
  };

  const getStockPercentage = (available: number, minimum: number) => {
    return Math.min((available / minimum) * 100, 100);
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
          Cảnh báo Thiếu hàng
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
        >
          Làm mới
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Tổng số linh kiện
                </Typography>
                <Typography variant="h4">
                  {stats.total_parts}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Tổng tồn kho
                </Typography>
                <Typography variant="h4">
                  {parseInt(stats.total_items.toString()).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Đã đặt trước
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {parseInt(stats.total_reserved.toString()).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
              <CardContent>
                <Typography gutterBottom>
                  Cảnh báo thiếu hàng
                </Typography>
                <Typography variant="h4">
                  {stats.low_stock_count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Tổng giá trị tồn kho
                </Typography>
                <Typography variant="h5" color="success.main">
                  {parseFloat(stats.total_value.toString()).toLocaleString('vi-VN')} VNĐ
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Số kho
                </Typography>
                <Typography variant="h5">
                  {stats.total_warehouses} kho
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Low Stock Alerts Table */}
      <Paper>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          <Typography variant="h6">
            Linh kiện cần đặt hàng ({alerts.length})
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Mã linh kiện</TableCell>
                <TableCell>Tên linh kiện</TableCell>
                <TableCell>Danh mục</TableCell>
                <TableCell>Kho</TableCell>
                <TableCell align="right">Tồn kho</TableCell>
                <TableCell align="right">Tồn tối thiểu</TableCell>
                <TableCell>Mức tồn</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="center">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Box sx={{ py: 3 }}>
                      <Typography variant="body2" color="success.main" gutterBottom>
                        ✓ Tất cả linh kiện đều đủ tồn kho
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Không có cảnh báo thiếu hàng
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => {
                  const stockLevel = getStockLevel(alert.quantity_available, alert.minimum_stock);
                  const stockPercentage = getStockPercentage(alert.quantity_available, alert.minimum_stock);

                  return (
                    <TableRow key={`${alert.id}-${alert.warehouse_id}`} hover>
                      <TableCell>{alert.part_number}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {alert.part_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{alert.category}</TableCell>
                      <TableCell>{alert.warehouse_name}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          color={stockPercentage <= 50 ? 'error.main' : 'warning.main'}
                        >
                          {alert.quantity_available}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {alert.minimum_stock}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={stockPercentage}
                            color={stockLevel.color as any}
                            sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {stockPercentage.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={stockLevel.label}
                          color={stockLevel.color as any}
                          size="small"
                          icon={<WarningIcon />}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ShoppingCartIcon />}
                          onClick={() => {
                            // Navigate to create transaction with pre-filled data
                            navigate('/inventory/transactions', {
                              state: {
                                spare_part_id: alert.id,
                                warehouse_id: alert.warehouse_id,
                                suggested_quantity: alert.reorder_quantity || alert.minimum_stock,
                              }
                            });
                          }}
                        >
                          Đặt hàng
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default LowStockAlertsPage;
