import React, { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiService } from '../../services/api';

interface TechnicianWorkload {
  name: string;
  activeCases: number;
  completedThisMonth: number;
  capacity: number;
}

const TechnicianWorkloadChart: React.FC = () => {
  const [data, setData] = useState<TechnicianWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTechnicianWorkloadData();
  }, []);

  const loadTechnicianWorkloadData = async () => {
    try {
      const response = await apiService.get<TechnicianWorkload[]>('/analytics/technicians/workload');
      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to load technician workload data:', error);
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1.5,
            boxShadow: 2,
          }}
        >
          <Box sx={{ fontWeight: 600, mb: 1 }}>{label}</Box>
          {payload.map((entry: any, index: number) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: 1,
                }}
              />
              <span>{entry.name}: {entry.value}</span>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="activeCases" 
            fill="#2196f3" 
            name="Active Cases"
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="completedThisMonth" 
            fill="#4caf50" 
            name="Completed This Month"
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="capacity" 
            fill="#ff9800" 
            name="Capacity"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default TechnicianWorkloadChart;