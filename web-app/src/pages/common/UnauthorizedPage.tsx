import React from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
} from '@mui/material';
import {
  Lock as LockIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 3,
        }}
      >
        <Card sx={{ width: '100%', textAlign: 'center' }}>
          <CardContent sx={{ p: 4 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'error.light',
                  color: 'error.main',
                }}
              >
                <LockIcon sx={{ fontSize: 40 }} />
              </Box>
            </Box>

            <Typography variant="h4" component="h1" gutterBottom color="error.main">
              Access Denied
            </Typography>

            <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
              403 - Unauthorized
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              You don't have permission to access this resource. Please contact your administrator if you believe this is an error.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<HomeIcon />}
                onClick={handleGoHome}
              >
                Go to Dashboard
              </Button>
              <Button
                variant="outlined"
                onClick={handleGoBack}
              >
                Go Back
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default UnauthorizedPage;