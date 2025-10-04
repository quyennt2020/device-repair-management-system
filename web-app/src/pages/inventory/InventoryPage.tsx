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
  TablePagination,
  IconButton,
  Chip,
  Button,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Stack,
  LinearProgress,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Add as AddIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

interface SparePart {
  id: string;
  part_number: string;
  part_name: string;
  category: string;
  manufacturer: string;
  pricing_info: {
    unit_cost?: number;
    selling_price?: number;
  };
  total_quantity: number;
  total_reserved: number;
  warehouse_count: number;
  inventory_settings?: {
    minimum_stock?: number;
    maximum_stock?: number;
  };
}

interface Warehouse {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
}

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterWarehouse, setFilterWarehouse] = useState('all');
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [partsResponse, warehousesResponse] = await Promise.all([
        apiService.get<SparePart[]>('/api/inventory/spare-parts'),
        apiService.get<Warehouse[]>('/api/inventory/warehouses')
      ]);

      if (partsResponse.data) {
        setSpareParts(partsResponse.data);
      }

      if (warehousesResponse.data) {
        setWarehouses(warehousesResponse.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch inventory data:', err);
      setError(err.message || 'Không thể tải dữ liệu tồn kho');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStockStatus = (part: SparePart) => {
    const minStock = part.inventory_settings?.minimum_stock || 0;
    const maxStock = part.inventory_settings?.maximum_stock || 100;
    const available = part.total_quantity || 0;

    if (available <= minStock) {
      return { label: 'Thiếu hàng', color: 'error' as const, icon: <WarningIcon /> };
    }
    if (available >= maxStock * 0.9) {
      return { label: 'Đầy kho', color: 'warning' as const, icon: <TrendingUpIcon /> };
    }
    return { label: 'Bình thường', color: 'success' as const, icon: null };
  };

  const getStockPercentage = (part: SparePart) => {
    const maxStock = part.inventory_settings?.maximum_stock || 100;
    const available = part.total_quantity || 0;
    return (available / maxStock) * 100;
  };

  const filteredInventory = spareParts.filter((part) => {
    const matchesSearch = part.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || part.category === filterCategory;
    // Note: Warehouse filter will be implemented when we have per-warehouse data
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from spare parts
  const categories = Array.from(new Set(spareParts.map(p => p.category).filter(Boolean)));

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
          Quản lý Tồn kho
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            onClick={() => navigate('/inventory/transactions')}
          >
            Giao dịch kho
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/inventory/warehouses/create')}
          >
            Thêm kho
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/inventory/spare-parts/create')}
          >
            Thêm linh kiện
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Tìm kiếm linh kiện..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1 }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Danh mục</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Danh mục"
            >
              <MenuItem value="all">Tất cả</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Kho</InputLabel>
            <Select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              label="Kho"
            >
              <MenuItem value="all">Tất cả</MenuItem>
              {warehouses.map(wh => (
                <MenuItem key={wh.id} value={wh.id}>{wh.warehouse_name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Mã linh kiện</TableCell>
              <TableCell>Tên linh kiện</TableCell>
              <TableCell>Nhà sản xuất</TableCell>
              <TableCell>Danh mục</TableCell>
              <TableCell>Tồn kho</TableCell>
              <TableCell>Đã đặt</TableCell>
              <TableCell>Mức tồn</TableCell>
              <TableCell align="right">Đơn giá</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    Không có dữ liệu
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((part) => {
                  const status = getStockStatus(part);
                  const stockPercentage = getStockPercentage(part);
                  const minStock = part.inventory_settings?.minimum_stock || 0;
                  const maxStock = part.inventory_settings?.maximum_stock || 100;
                  const unitCost = part.pricing_info?.unit_cost || 0;
                  const totalValue = unitCost * (part.total_quantity || 0);

                  return (
                    <TableRow key={part.id} hover>
                      <TableCell>{part.part_number}</TableCell>
                      <TableCell>{part.part_name}</TableCell>
                      <TableCell>{part.manufacturer || 'N/A'}</TableCell>
                      <TableCell>{part.category || 'N/A'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {part.total_quantity || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {part.total_reserved || 0}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(stockPercentage, 100)}
                              color={stockPercentage <= 20 ? 'error' : stockPercentage >= 90 ? 'warning' : 'primary'}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {minStock}-{maxStock}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {unitCost.toLocaleString('vi-VN')} đ
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={status.label}
                          color={status.color}
                          size="small"
                          icon={status.icon || undefined}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Xem chi tiết">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/inventory/spare-parts/${part.id}`)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Chỉnh sửa">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/inventory/spare-parts/${part.id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredInventory.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Số hàng mỗi trang:"
        />
      </TableContainer>
    </Box>
  );
};

export default InventoryPage;
