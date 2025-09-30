import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { apiService } from '../../services/api';

interface CaseStatusData {
  name: string;
  value: number;
  color: string;
}

const COLORS = {
  'New': '#2196f3',
  'In Progress': '#ff9800',
  'Pending Approval': '#9c27b0',
  'Completed': '#4caf50',
  'Cancelled': '#f44336',
  'On Hold': '#607d8b',
};

const CaseStatusChart: React.FC = () => {
  const [data, setData] = useState<CaseStatusData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaseStatusData();
  }, []);

  const loadCaseStatusData = async () => {
    try {
      const response = await apiService.get<Record<string, number>>('/analytics/cases/status-distribution');
      if (response.success && response.data) {
        const chartData = Object.entries(response.data).map(([status, count]) => ({
          name: status,
          value: count,
          color: COLORS[status as keyof typeof COLORS] || '#757575',
        }));
        setData(chartData);
      }
    } catch (error) {
      console.error('Failed to load case status data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
            boxShadow: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                backgroundColor: data.payload.color,
                borderRadius: '50%',
              }}
            />
            <span>{data.name}: {data.value}</span>
          </Box>
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default CaseStatusChart;