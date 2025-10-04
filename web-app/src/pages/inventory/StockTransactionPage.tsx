import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface SparePart {
  id: string;
  part_number: string;
  part_name: string;
  category: string;
}

interface Warehouse {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
}

interface Transaction {
  id: string;
  spare_part_id: string;
  warehouse_id: string;
  to_warehouse_id?: string; // For transfer transactions
  transaction_type: string;
  quantity: number;
  unit_cost: number;
  reference_number?: string;
  reference_type?: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
  part_name?: string;
  part_number?: string;
  warehouse_name?: string;
}

const TRANSACTION_TYPES = [
  { value: 'in', label: 'Nhập kho', color: 'success' },
  { value: 'out', label: 'Xuất kho', color: 'error' },
  { value: 'adjustment', label: 'Điều chỉnh', color: 'warning' },
  { value: 'transfer', label: 'Chuyển kho', color: 'info' },
  { value: 'transfer_in', label: 'Chuyển đến', color: 'success' },
  { value: 'transfer_out', label: 'Chuyển đi', color: 'error' },
];

const StockTransactionPage: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const [formData, setFormData] = useState({
    spare_part_id: '',
    warehouse_id: '',
    to_warehouse_id: '', // For transfer transactions
    transaction_type: 'in',
    quantity: 0,
    unit_cost: 0,
    reference_number: '',
    reference_type: '',
    notes: '',
    performed_by: user?.id || '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txResponse, partsResponse, whResponse] = await Promise.all([
        apiService.get<Transaction[]>('/api/inventory/transactions?limit=50'),
        apiService.get<SparePart[]>('/api/inventory/spare-parts'),
        apiService.get<Warehouse[]>('/api/inventory/warehouses'),
      ]);

      if (txResponse.data) {
        setTransactions(txResponse.data);
      }
      if (partsResponse.data) {
        setSpareParts(partsResponse.data);
      }
      if (whResponse.data) {
        setWarehouses(whResponse.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate user is logged in
    if (!user?.id) {
      setError('Bạn cần đăng nhập để thực hiện giao dịch');
      return;
    }

    // Ensure performed_by has the current user ID
    const transactionData = {
      ...formData,
      performed_by: user.id
    };

    try {
      await apiService.post('/api/inventory/transactions', transactionData);
      setOpenDialog(false);

      // Reset form
      setFormData({
        spare_part_id: '',
        warehouse_id: '',
        to_warehouse_id: '',
        transaction_type: 'in',
        quantity: 0,
        unit_cost: 0,
        reference_number: '',
        reference_type: '',
        notes: '',
        performed_by: user?.id || '',
      });

      // Refresh transactions
      fetchData();
    } catch (err: any) {
      console.error('Failed to create transaction:', err);
      setError(err.message || 'Không thể tạo giao dịch');
    }
  };

  const getTransactionTypeInfo = (type: string) => {
    return TRANSACTION_TYPES.find(t => t.value === type) || TRANSACTION_TYPES[0];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Giao dịch Kho
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Tạo giao dịch
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Transaction History */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Thời gian</TableCell>
              <TableCell>Loại giao dịch</TableCell>
              <TableCell>Linh kiện</TableCell>
              <TableCell>Mã linh kiện</TableCell>
              <TableCell>Kho</TableCell>
              <TableCell align="right">Số lượng</TableCell>
              <TableCell align="right">Đơn giá</TableCell>
              <TableCell>Tham chiếu</TableCell>
              <TableCell>Ghi chú</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    {loading ? 'Đang tải...' : 'Chưa có giao dịch nào'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => {
                const txInfo = getTransactionTypeInfo(tx.transaction_type);
                return (
                  <TableRow key={tx.id}>
                    <TableCell>{formatDate(tx.created_at)}</TableCell>
                    <TableCell>
                      <Chip
                        label={txInfo.label}
                        color={txInfo.color as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{tx.part_name || 'N/A'}</TableCell>
                    <TableCell>{tx.part_number || 'N/A'}</TableCell>
                    <TableCell>{tx.warehouse_name || 'N/A'}</TableCell>
                    <TableCell align="right">
                      <Typography
                        fontWeight="bold"
                        color={
                          tx.transaction_type === 'in' || tx.transaction_type === 'transfer_in'
                            ? 'success.main'
                            : tx.transaction_type === 'out' || tx.transaction_type === 'transfer_out'
                            ? 'error.main'
                            : 'warning.main'
                        }
                      >
                        {tx.transaction_type === 'in' || tx.transaction_type === 'transfer_in'
                          ? '+'
                          : tx.transaction_type === 'out' || tx.transaction_type === 'transfer_out'
                          ? '-'
                          : tx.quantity > 0
                          ? '+'
                          : ''}
                        {Math.abs(tx.quantity)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {tx.unit_cost?.toLocaleString('vi-VN')} đ
                    </TableCell>
                    <TableCell>{tx.reference_number || '-'}</TableCell>
                    <TableCell>{tx.notes || '-'}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Transaction Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>Tạo giao dịch mới</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Loại giao dịch</InputLabel>
                  <Select
                    value={formData.transaction_type}
                    onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                    label="Loại giao dịch"
                  >
                    {TRANSACTION_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <Autocomplete
                    options={spareParts}
                    getOptionLabel={(option) => `${option.part_number} - ${option.part_name}`}
                    value={spareParts.find(p => p.id === formData.spare_part_id) || null}
                    onChange={(_, newValue) => {
                      setFormData({ ...formData, spare_part_id: newValue?.id || '' });
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Linh kiện" required />
                    )}
                  />
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>{formData.transaction_type === 'transfer' ? 'Kho nguồn' : 'Kho'}</InputLabel>
                  <Select
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                    label={formData.transaction_type === 'transfer' ? 'Kho nguồn' : 'Kho'}
                  >
                    {warehouses.map((wh) => (
                      <MenuItem key={wh.id} value={wh.id}>
                        {wh.warehouse_name} ({wh.warehouse_code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Destination warehouse - only for TRANSFER */}
              {formData.transaction_type === 'transfer' && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Kho đích</InputLabel>
                    <Select
                      value={formData.to_warehouse_id}
                      onChange={(e) => setFormData({ ...formData, to_warehouse_id: e.target.value })}
                      label="Kho đích"
                    >
                      {warehouses
                        .filter((wh) => wh.id !== formData.warehouse_id)
                        .map((wh) => (
                          <MenuItem key={wh.id} value={wh.id}>
                            {wh.warehouse_name} ({wh.warehouse_code})
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label={formData.transaction_type === 'adjustment' ? 'Số lượng điều chỉnh (+/-)' : 'Số lượng'}
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  inputProps={{
                    min: formData.transaction_type === 'adjustment' ? undefined : 1
                  }}
                  helperText={formData.transaction_type === 'adjustment' ? 'Số dương để tăng, số âm để giảm' : ''}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Đơn giá"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">VNĐ</InputAdornment>,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Số tham chiếu"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="PO-2024-001"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Loại tham chiếu</InputLabel>
                  <Select
                    value={formData.reference_type}
                    onChange={(e) => setFormData({ ...formData, reference_type: e.target.value })}
                    label="Loại tham chiếu"
                  >
                    <MenuItem value="">Không có</MenuItem>
                    <MenuItem value="purchase_order">Đơn mua hàng</MenuItem>
                    <MenuItem value="repair_case">Phiếu sửa chữa</MenuItem>
                    <MenuItem value="return">Trả hàng</MenuItem>
                    <MenuItem value="other">Khác</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Ghi chú"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
            <Button type="submit" variant="contained">
              Tạo giao dịch
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default StockTransactionPage;

