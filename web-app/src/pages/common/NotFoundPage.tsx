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
  SearchOff as NotFoundIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
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
                  backgroundColor: 'warning.light',
                  color: 'warning.main',
                }}
              >
                <NotFoundIcon sx={{ fontSize: 40 }} />
              </Box>
            </Box>

            <Typography variant="h4" component="h1" gutterBottom color="warning.main">
              Page Not Found
            </Typography>

            <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
              404 - Not Found
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              The page you're looking for doesn't exist or has been moved. Please check the URL or navigate back to the dashboard.
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

export default NotFoundPage;