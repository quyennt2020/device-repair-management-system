import React from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface ErrorAlertProps {
  error: string | null;
  title?: string;
  onRetry?: () => void;
  severity?: 'error' | 'warning' | 'info';
}

const ErrorAlert: React.FC<ErrorAlertProps> = ({
  error,
  title = 'Error',
  onRetry,
  severity = 'error',
}) => {
  if (!error) return null;

  return (
    <Box sx={{ my: 2 }}>
      <Alert
        severity={severity}
        action={
          onRetry && (
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )
        }
      >
        <AlertTitle>{title}</AlertTitle>
        {error}
      </Alert>
    </Box>
  );
};

export default ErrorAlert;
