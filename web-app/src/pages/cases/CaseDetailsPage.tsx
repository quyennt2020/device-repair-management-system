import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,

  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  Person as PersonIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface CaseDetails {
  id: string;
  case_number: string;
  customer_name: string;
  customer_company: string;
  device_name: string;
  device_model: string;
  device_serial: string;
  service_type: string;
  status: string;
  priority: string;
  description: string;
  assigned_technician: string;
  assigned_technician_id: string;
  created_at: string;
  scheduled_date: string;
  estimated_duration: number;
  actual_start_time?: string;
  actual_end_time?: string;
  resolution_notes?: string;
}

interface CaseActivity {
  id: string;
  activity_type: string;
  description: string;
  created_by: string;
  created_at: string;
  metadata?: any;
}

interface CaseDocument {
  id: string;
  document_number: string;
  document_type_id: string;
  document_type_name: string;
  document_category: string;
  status: string;
  content: any;
  version: number;
  created_at: string;
  updated_at: string;
}

interface CasePartUsage {
  id: string;
  repair_case_id: string;
  spare_part_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  warranty_months: number;
  installation_date: string;
  technician_id?: string;
  old_part_serial?: string;
  new_part_serial?: string;
  return_old_part: boolean;
  created_at: string;
  part_name?: string;
  part_number?: string;
  category?: string;
  manufacturer?: string;
}

interface SparePart {
  id: string;
  part_number: string;
  part_name: string;
  category: string;
  manufacturer: string;
}

interface Warehouse {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
}

interface DocumentType {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

const CaseDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [activities, setActivities] = useState<CaseActivity[]>([]);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [parts, setParts] = useState<CasePartUsage[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [createDocDialogOpen, setCreateDocDialogOpen] = useState(false);
  const [addPartDialogOpen, setAddPartDialogOpen] = useState(false);
  const [deletePartDialogOpen, setDeletePartDialogOpen] = useState(false);
  const [partToDelete, setPartToDelete] = useState<string | null>(null);

  // Form states
  const [editForm, setEditForm] = useState<Partial<CaseDetails>>({});
  const [newStatus, setNewStatus] = useState('');
  const [newNote, setNewNote] = useState('');
  const [selectedDocumentTypeId, setSelectedDocumentTypeId] = useState('');

  // Part form
  const [partForm, setPartForm] = useState({
    spare_part_id: '',
    warehouse_id: '',
    quantity_used: 1,
    unit_cost: 0,
    warranty_months: 12,
    installation_date: new Date().toISOString().split('T')[0],
    old_part_serial: '',
    new_part_serial: '',
    return_old_part: false,
  });

  useEffect(() => {
    if (id) {
      fetchCaseDetails();
      fetchDocumentTypes();
      fetchInventoryData();
    }
  }, [id]);

  const fetchCaseDetails = async () => {
    try {
      setLoading(true);
      const [caseRes, activitiesRes, documentsRes, partsRes] = await Promise.all([
        apiService.get<CaseDetails>(`/api/cases/${id}`),
        apiService.get<CaseActivity[]>(`/api/cases/${id}/activities`),
        apiService.get<CaseDocument[]>(`/api/cases/${id}/documents`),
        apiService.get<CasePartUsage[]>(`/api/inventory/cases/${id}/parts`)
      ]);

      setCaseDetails(caseRes.data || null);
      setActivities(activitiesRes.data || []);
      setDocuments(documentsRes.data || []);
      setParts(partsRes.data || []);
      setEditForm(caseRes.data || {});
    } catch (error: any) {
      setError(error.message || 'Không thể tải thông tin case');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryData = async () => {
    try {
      const [sparePartsRes, warehousesRes] = await Promise.all([
        apiService.get<SparePart[]>('/api/inventory/spare-parts'),
        apiService.get<Warehouse[]>('/api/inventory/warehouses')
      ]);

      setSpareParts(sparePartsRes.data || []);
      setWarehouses(warehousesRes.data || []);
    } catch (error: any) {
      console.error('Error fetching inventory data:', error);
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const response = await apiService.get<DocumentType[]>('/api/document-templates');
      setDocumentTypes(response.data?.filter(dt => dt.is_active) || []);
    } catch (error: any) {
      console.error('Error fetching document types:', error);
    }
  };

  const handleCreateDocument = async () => {
    if (!selectedDocumentTypeId) {
      setError('Vui lòng chọn loại tài liệu');
      return;
    }

    try {
      const response = await apiService.post<{ id: string }>(`/api/cases/${id}/documents`, {
        document_type_id: selectedDocumentTypeId
      });

      setCreateDocDialogOpen(false);
      setSelectedDocumentTypeId('');

      // Navigate to document details page (or refresh documents list)
      if (response.data?.id) {
        navigate(`/documents/${response.data.id}`);
      } else {
        fetchCaseDetails();
      }
    } catch (error: any) {
      setError(error.message || 'Không thể tạo tài liệu');
    }
  };

  const handleUpdateCase = async () => {
    try {
      await apiService.put(`/api/cases/${id}`, editForm);
      setEditDialogOpen(false);
      fetchCaseDetails();
    } catch (error: any) {
      setError(error.message || 'Không thể cập nhật case');
    }
  };

  const handleStatusChange = async () => {
    try {
      await apiService.put(`/api/cases/${id}/status`, { 
        status: newStatus,
        notes: newNote 
      });
      setStatusDialogOpen(false);
      setNewNote('');
      fetchCaseDetails();
    } catch (error: any) {
      setError(error.message || 'Không thể cập nhật trạng thái');
    }
  };

  const handleAddNote = async () => {
    try {
      await apiService.post(`/api/cases/${id}/notes`, {
        note: newNote
      });
      setNoteDialogOpen(false);
      setNewNote('');
      fetchCaseDetails();
    } catch (error: any) {
      setError(error.message || 'Không thể thêm ghi chú');
    }
  };

  const handleAddPart = async () => {
    setError(null);
    setSuccess(null);

    // Validate
    if (!partForm.spare_part_id || !partForm.warehouse_id) {
      setError('Vui lòng chọn linh kiện và kho');
      return;
    }

    if (partForm.quantity_used <= 0) {
      setError('Số lượng phải lớn hơn 0');
      return;
    }

    try {
      const total_cost = partForm.unit_cost * partForm.quantity_used;

      await apiService.post(`/api/inventory/cases/${id}/parts`, {
        ...partForm,
        total_cost,
        technician_id: caseDetails?.assigned_technician_id || null,
        performed_by: user?.id || 'system',
      });

      setSuccess('Đã thêm linh kiện và tự động xuất kho');
      setAddPartDialogOpen(false);

      // Reset form
      setPartForm({
        spare_part_id: '',
        warehouse_id: '',
        quantity_used: 1,
        unit_cost: 0,
        warranty_months: 12,
        installation_date: new Date().toISOString().split('T')[0],
        old_part_serial: '',
        new_part_serial: '',
        return_old_part: false,
      });

      fetchCaseDetails();
    } catch (error: any) {
      setError(error.message || 'Không thể thêm linh kiện');
    }
  };

  const handleRemovePart = async () => {
    if (!partToDelete) return;

    setError(null);
    setSuccess(null);

    try {
      // Need warehouse_id for rollback - get it from the first warehouse for now
      const warehouse_id = warehouses[0]?.id;
      if (!warehouse_id) {
        throw new Error('Không tìm thấy kho');
      }

      await apiService.delete(`/api/inventory/cases/${id}/parts/${partToDelete}`, {
        data: { warehouse_id, performed_by: user?.id || 'system' }
      });

      setSuccess('Đã xóa linh kiện và hoàn trả vào kho');
      setDeletePartDialogOpen(false);
      setPartToDelete(null);
      fetchCaseDetails();
    } catch (error: any) {
      setError(error.message || 'Không thể xóa linh kiện');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'warning';
      case 'in_progress': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'scheduled': return 'primary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'urgent': return 'error';
      case 'emergency': return 'error';
      default: return 'default';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'status_change': return <CheckCircleIcon />;
      case 'assignment': return <PersonIcon />;
      case 'note': return <DescriptionIcon />;
      case 'document': return <AssignmentIcon />;
      default: return <DescriptionIcon />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Đang tải...</Typography>
      </Box>
    );
  }

  if (error || !caseDetails) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Không tìm thấy case'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/cases')}
            sx={{ mr: 2 }}
          >
            Quay lại
          </Button>
          <Typography variant="h4" component="h1">
            {caseDetails.case_number}
          </Typography>
        </Box>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Chỉnh sửa
          </Button>
          <Button
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={() => {
              setNewStatus(caseDetails.status === 'in_progress' ? 'completed' : 'in_progress');
              setStatusDialogOpen(true);
            }}
          >
            {caseDetails.status === 'in_progress' ? 'Hoàn thành' : 'Bắt đầu'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Case Overview */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                <Typography variant="h6">Thông tin Case</Typography>
                <Box>
                  <Chip
                    label={caseDetails.status}
                    color={getStatusColor(caseDetails.status) as any}
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={caseDetails.priority}
                    color={getPriorityColor(caseDetails.priority) as any}
                  />
                </Box>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Khách hàng</Typography>
                  <Typography variant="body1">{caseDetails.customer_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{caseDetails.customer_company}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Thiết bị</Typography>
                  <Typography variant="body1">{caseDetails.device_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{caseDetails.device_model} - {caseDetails.device_serial}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Loại dịch vụ</Typography>
                  <Typography variant="body1">{caseDetails.service_type}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Kỹ thuật viên</Typography>
                  {caseDetails.assigned_technician_id ? (
                    <Link 
                      to={`/technicians/${caseDetails.assigned_technician_id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Typography variant="body1" sx={{ color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                        {caseDetails.assigned_technician}
                      </Typography>
                    </Link>
                  ) : (
                    <Typography variant="body1">Chưa phân công</Typography>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Mô tả</Typography>
                  <Typography variant="body1">{caseDetails.description}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Hoạt động" />
              <Tab label="Tài liệu" />
              <Tab label="Linh kiện" />
            </Tabs>
            
            <CardContent>
              {tabValue === 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Lịch sử hoạt động</Typography>
                    <Button
                      startIcon={<AddIcon />}
                      onClick={() => setNoteDialogOpen(true)}
                    >
                      Thêm ghi chú
                    </Button>
                  </Box>
                  
                  <Box>
                    {activities.map((activity, index) => (
                      <Box key={activity.id} sx={{ display: 'flex', mb: 2, pb: 2, borderBottom: index < activities.length - 1 ? '1px solid #eee' : 'none' }}>
                        <Box sx={{ mr: 2, mt: 0.5 }}>
                          {getActivityIcon(activity.activity_type)}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1">{activity.description}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {activity.created_by} - {new Date(activity.created_at).toLocaleString('vi-VN')}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
              
              {tabValue === 1 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Tài liệu</Typography>
                    <Button
                      startIcon={<AddIcon />}
                      variant="contained"
                      onClick={() => setCreateDocDialogOpen(true)}
                    >
                      Tạo tài liệu
                    </Button>
                  </Box>

                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Mã tài liệu</TableCell>
                          <TableCell>Loại tài liệu</TableCell>
                          <TableCell>Trạng thái</TableCell>
                          <TableCell>Phiên bản</TableCell>
                          <TableCell>Ngày tạo</TableCell>
                          <TableCell>Thao tác</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {documents.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>{doc.document_number}</TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2">{doc.document_type_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {doc.document_category}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={doc.status}
                                size="small"
                                color={doc.status === 'draft' ? 'default' : doc.status === 'submitted' ? 'primary' : 'success'}
                              />
                            </TableCell>
                            <TableCell>v{doc.version}</TableCell>
                            <TableCell>{new Date(doc.created_at).toLocaleDateString('vi-VN')}</TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                onClick={() => navigate(`/documents/${doc.id}`)}
                              >
                                Xem
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {documents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              <Box sx={{ py: 3 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Chưa có tài liệu nào
                                </Typography>
                                <Button
                                  startIcon={<AddIcon />}
                                  onClick={() => setCreateDocDialogOpen(true)}
                                  sx={{ mt: 1 }}
                                >
                                  Tạo tài liệu đầu tiên
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {tabValue === 2 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Linh kiện sử dụng</Typography>
                    <Button
                      startIcon={<AddIcon />}
                      variant="contained"
                      onClick={() => setAddPartDialogOpen(true)}
                    >
                      Thêm linh kiện
                    </Button>
                  </Box>

                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Mã linh kiện</TableCell>
                          <TableCell>Tên linh kiện</TableCell>
                          <TableCell>Loại</TableCell>
                          <TableCell align="right">Số lượng</TableCell>
                          <TableCell align="right">Đơn giá</TableCell>
                          <TableCell align="right">Thành tiền</TableCell>
                          <TableCell>Serial cũ</TableCell>
                          <TableCell>Serial mới</TableCell>
                          <TableCell>Bảo hành</TableCell>
                          <TableCell>Ngày lắp</TableCell>
                          <TableCell>Thao tác</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {parts.map((part) => (
                          <TableRow key={part.id}>
                            <TableCell>{part.part_number || 'N/A'}</TableCell>
                            <TableCell>{part.part_name || 'N/A'}</TableCell>
                            <TableCell>{part.category || 'N/A'}</TableCell>
                            <TableCell align="right">{part.quantity_used}</TableCell>
                            <TableCell align="right">
                              {part.unit_cost?.toLocaleString('vi-VN')} đ
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight="bold">
                                {part.total_cost?.toLocaleString('vi-VN')} đ
                              </Typography>
                            </TableCell>
                            <TableCell>{part.old_part_serial || '-'}</TableCell>
                            <TableCell>{part.new_part_serial || '-'}</TableCell>
                            <TableCell>{part.warranty_months} tháng</TableCell>
                            <TableCell>
                              {part.installation_date
                                ? new Date(part.installation_date).toLocaleDateString('vi-VN')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => {
                                  setPartToDelete(part.id);
                                  setDeletePartDialogOpen(true);
                                }}
                              >
                                Xóa
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {parts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={11} align="center">
                              <Box sx={{ py: 3 }}>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                  Chưa có linh kiện nào được sử dụng
                                </Typography>
                                <Button
                                  startIcon={<AddIcon />}
                                  onClick={() => setAddPartDialogOpen(true)}
                                  sx={{ mt: 1 }}
                                >
                                  Thêm linh kiện đầu tiên
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {parts.length > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                      <Typography variant="h6">
                        Tổng chi phí linh kiện:{' '}
                        <Typography component="span" variant="h6" color="primary">
                          {parts.reduce((sum, p) => sum + (p.total_cost || 0), 0).toLocaleString('vi-VN')} đ
                        </Typography>
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Thời gian</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Ngày tạo</Typography>
                <Typography variant="body1">
                  {new Date(caseDetails.created_at).toLocaleString('vi-VN')}
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Lịch hẹn</Typography>
                <Typography variant="body1">
                  {caseDetails.scheduled_date ? 
                    new Date(caseDetails.scheduled_date).toLocaleString('vi-VN') : 
                    'Chưa lên lịch'
                  }
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Thời gian ước tính</Typography>
                <Typography variant="body1">{caseDetails.estimated_duration} giờ</Typography>
              </Box>
              {caseDetails.actual_start_time && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Thời gian bắt đầu</Typography>
                  <Typography variant="body1">
                    {new Date(caseDetails.actual_start_time).toLocaleString('vi-VN')}
                  </Typography>
                </Box>
              )}
              {caseDetails.actual_end_time && (
                <Box>
                  <Typography variant="body2" color="text.secondary">Thời gian kết thúc</Typography>
                  <Typography variant="body1">
                    {new Date(caseDetails.actual_end_time).toLocaleString('vi-VN')}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Chỉnh sửa Case</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Độ ưu tiên</InputLabel>
                <Select
                  value={editForm.priority || ''}
                  label="Độ ưu tiên"
                  onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <MenuItem value="low">Thấp</MenuItem>
                  <MenuItem value="medium">Trung bình</MenuItem>
                  <MenuItem value="high">Cao</MenuItem>
                  <MenuItem value="urgent">Khẩn cấp</MenuItem>
                  <MenuItem value="emergency">Khẩn cấp</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Lịch hẹn"
                value={editForm.scheduled_date || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Mô tả"
                value={editForm.description || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleUpdateCase} variant="contained">Lưu</Button>
        </DialogActions>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)}>
        <DialogTitle>Cập nhật trạng thái</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Trạng thái mới</InputLabel>
            <Select
              value={newStatus}
              label="Trạng thái mới"
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <MenuItem value="open">Mở</MenuItem>
              <MenuItem value="in_progress">Đang xử lý</MenuItem>
              <MenuItem value="completed">Hoàn thành</MenuItem>
              <MenuItem value="cancelled">Đã hủy</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Ghi chú"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Thêm ghi chú về việc thay đổi trạng thái..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleStatusChange} variant="contained">Cập nhật</Button>
        </DialogActions>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={noteDialogOpen} onClose={() => setNoteDialogOpen(false)}>
        <DialogTitle>Thêm ghi chú</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Ghi chú"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Nhập ghi chú..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialogOpen(false)}>Hủy</Button>
          <Button onClick={handleAddNote} variant="contained">Thêm</Button>
        </DialogActions>
      </Dialog>

      {/* Create Document Dialog */}
      <Dialog open={createDocDialogOpen} onClose={() => setCreateDocDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo tài liệu mới</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Tài liệu sẽ được tự động điền thông tin từ case này
            </Typography>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Loại tài liệu</InputLabel>
              <Select
                value={selectedDocumentTypeId}
                label="Loại tài liệu"
                onChange={(e) => setSelectedDocumentTypeId(e.target.value)}
              >
                {documentTypes.map((docType) => (
                  <MenuItem key={docType.id} value={docType.id}>
                    <Box>
                      <Typography variant="body2">{docType.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {docType.category}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedDocumentTypeId && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Tài liệu sẽ được tạo ở trạng thái "Nháp" và tự động điền các thông tin:
                khách hàng, thiết bị, kỹ thuật viên, thông tin case
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDocDialogOpen(false);
            setSelectedDocumentTypeId('');
          }}>
            Hủy
          </Button>
          <Button
            onClick={handleCreateDocument}
            variant="contained"
            disabled={!selectedDocumentTypeId}
          >
            Tạo tài liệu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Part Dialog */}
      <Dialog open={addPartDialogOpen} onClose={() => setAddPartDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Thêm linh kiện vào case</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 2 }}>
            Khi thêm linh kiện, hệ thống sẽ tự động xuất kho số lượng tương ứng
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Linh kiện</InputLabel>
                <Select
                  value={partForm.spare_part_id}
                  label="Linh kiện"
                  onChange={(e) => {
                    const selectedPart = spareParts.find(p => p.id === e.target.value);
                    setPartForm({
                      ...partForm,
                      spare_part_id: e.target.value,
                    });
                  }}
                >
                  {spareParts.map((part) => (
                    <MenuItem key={part.id} value={part.id}>
                      {part.part_number} - {part.part_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Kho xuất</InputLabel>
                <Select
                  value={partForm.warehouse_id}
                  label="Kho xuất"
                  onChange={(e) => setPartForm({ ...partForm, warehouse_id: e.target.value })}
                >
                  {warehouses.map((wh) => (
                    <MenuItem key={wh.id} value={wh.id}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                required
                type="number"
                label="Số lượng"
                value={partForm.quantity_used}
                onChange={(e) => setPartForm({ ...partForm, quantity_used: parseInt(e.target.value) })}
                inputProps={{ min: 1 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                required
                type="number"
                label="Đơn giá (VNĐ)"
                value={partForm.unit_cost}
                onChange={(e) => setPartForm({ ...partForm, unit_cost: parseFloat(e.target.value) })}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Bảo hành (tháng)"
                value={partForm.warranty_months}
                onChange={(e) => setPartForm({ ...partForm, warranty_months: parseInt(e.target.value) })}
                inputProps={{ min: 0 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Serial linh kiện cũ"
                value={partForm.old_part_serial}
                onChange={(e) => setPartForm({ ...partForm, old_part_serial: e.target.value })}
                placeholder="Serial của linh kiện bị hỏng"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Serial linh kiện mới"
                value={partForm.new_part_serial}
                onChange={(e) => setPartForm({ ...partForm, new_part_serial: e.target.value })}
                placeholder="Serial của linh kiện thay thế"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="date"
                label="Ngày lắp đặt"
                value={partForm.installation_date}
                onChange={(e) => setPartForm({ ...partForm, installation_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Trả lại linh kiện cũ?</InputLabel>
                <Select
                  value={partForm.return_old_part ? 'yes' : 'no'}
                  label="Trả lại linh kiện cũ?"
                  onChange={(e) => setPartForm({ ...partForm, return_old_part: e.target.value === 'yes' })}
                >
                  <MenuItem value="no">Không</MenuItem>
                  <MenuItem value="yes">Có</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {partForm.quantity_used > 0 && partForm.unit_cost > 0 && (
              <Grid item xs={12}>
                <Alert severity="success">
                  <Typography variant="body2">
                    <strong>Tổng chi phí:</strong>{' '}
                    {(partForm.quantity_used * partForm.unit_cost).toLocaleString('vi-VN')} VNĐ
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPartDialogOpen(false)}>Hủy</Button>
          <Button
            onClick={handleAddPart}
            variant="contained"
            disabled={!partForm.spare_part_id || !partForm.warehouse_id || partForm.quantity_used <= 0}
          >
            Thêm linh kiện
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Part Confirmation Dialog */}
      <Dialog open={deletePartDialogOpen} onClose={() => setDeletePartDialogOpen(false)}>
        <DialogTitle>Xác nhận xóa linh kiện</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Bạn có chắc muốn xóa linh kiện này khỏi case?
            <br />
            Số lượng sẽ được hoàn trả vào kho.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeletePartDialogOpen(false);
            setPartToDelete(null);
          }}>
            Hủy
          </Button>
          <Button onClick={handleRemovePart} variant="contained" color="error">
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CaseDetailsPage;