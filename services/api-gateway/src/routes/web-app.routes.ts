import express from 'express';
import path from 'path';

const router = express.Router();

// Serve static files from the React app build directory
const buildPath = path.join(__dirname, '../../../../web-app/build');

// Serve static assets
router.use('/static', express.static(path.join(buildPath, 'static')));

// Serve manifest and other root files
router.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(buildPath, 'manifest.json'));
});

router.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(buildPath, 'favicon.ico'));
});

// Serve the React app for all other routes (SPA routing)
router.get('*', (req, res) => {
  // Don't serve the React app for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(buildPath, 'index.html'));
});

export default router;