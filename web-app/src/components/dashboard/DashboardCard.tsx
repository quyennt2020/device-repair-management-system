import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
} from '@mui/icons-material';

interface DashboardCardProps {
  title: string;
  value: number | string;
  icon: React.ReactElement;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  trend?: number;
  trendLabel?: string;
  subtitle?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  color,
  trend,
  trendLabel,
  subtitle,
}) => {
  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'success';
    if (trend < 0) return 'error';
    return 'default';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendUpIcon fontSize="small" />;
    if (trend < 0) return <TrendDownIcon fontSize="small" />;
    return <TrendUpIcon fontSize="small" sx={{ opacity: 0 }} />; // Invisible icon for zero trend
  };

  return (
    <Card
      sx={{
        height: '100%',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.shadows[8],
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="div" color="text.secondary">
            {title}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: `${color}.light`,
              color: `${color}.main`,
            }}
          >
            {React.cloneElement(icon, { fontSize: 'medium' })}
          </Box>
        </Box>

        <Typography
          variant="h3"
          component="div"
          sx={{
            fontWeight: 700,
            color: `${color}.main`,
            mb: 1,
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {subtitle}
          </Typography>
        )}

        {trend !== undefined && trendLabel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={getTrendIcon(trend)}
              label={`${trend > 0 ? '+' : ''}${trend}%`}
              size="small"
              color={getTrendColor(trend)}
              variant="outlined"
            />
            <Typography variant="caption" color="text.secondary">
              {trendLabel}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardCard;