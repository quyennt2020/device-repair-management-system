import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface RecentCase {
  id: string;
  caseNumber: string;
  customerName: string;
  deviceType: string;
  status: string;
  priority: string;
  createdAt: string;
  assignedTechnician?: string;
}

interface RecentCasesTableProps {
  cases: RecentCase[];
}

const RecentCasesTable: React.FC<RecentCasesTableProps> = ({ cases }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in progress':
        return 'info';
      case 'pending approval':
        return 'warning';
      case 'cancelled':
        return 'error';
      case 'on hold':
        return 'default';
      default:
        return 'primary';
    }
  };

  const handleViewCase = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const handleEditCase = (caseId: string) => {
    navigate(`/cases/${caseId}/edit`);
  };

  if (cases.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No recent cases found
        </Typography>
      </Box>
    );
  }

  // Mobile view - simplified cards
  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {cases.map((case_) => (
          <Box
            key={case_.id}
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
              backgroundColor: 'background.paper',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {case_.caseNumber}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => handleViewCase(case_.id)}>
                  <ViewIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleEditCase(case_.id)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {case_.customerName} • {case_.deviceType}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Chip
                label={case_.status}
                size="small"
                color={getStatusColor(case_.status)}
                variant="outlined"
              />
              <Chip
                label={case_.priority}
                size="small"
                color={getPriorityColor(case_.priority)}
                variant="filled"
              />
            </Box>
            
            <Typography variant="caption" color="text.secondary">
              {case_.createdAt ? (
                <>Created {formatDistanceToNow(new Date(case_.createdAt), { addSuffix: true })}</>
              ) : (
                'No date'
              )}
              {case_.assignedTechnician && ` • Assigned to ${case_.assignedTechnician}`}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // Desktop view - table
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Case Number</TableCell>
            <TableCell>Customer</TableCell>
            <TableCell>Device Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Assigned To</TableCell>
            <TableCell>Created</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cases.map((case_) => (
            <TableRow key={case_.id} hover>
              <TableCell>
                <Typography variant="subtitle2" fontWeight={600}>
                  {case_.caseNumber}
                </Typography>
              </TableCell>
              <TableCell>{case_.customerName}</TableCell>
              <TableCell>{case_.deviceType}</TableCell>
              <TableCell>
                <Chip
                  label={case_.status}
                  size="small"
                  color={getStatusColor(case_.status)}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={case_.priority}
                  size="small"
                  color={getPriorityColor(case_.priority)}
                  variant="filled"
                />
              </TableCell>
              <TableCell>
                {case_.assignedTechnician || (
                  <Typography variant="body2" color="text.secondary">
                    Unassigned
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {case_.createdAt ? formatDistanceToNow(new Date(case_.createdAt), { addSuffix: true }) : 'No date'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => handleViewCase(case_.id)}>
                  <ViewIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleEditCase(case_.id)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default RecentCasesTable;