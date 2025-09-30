import { Router } from 'express';
import { DocumentTypeController } from '../controllers/document-type.controller';

const router = Router();
const documentTypeController = new DocumentTypeController();

// Document Type Management
router.post('/', documentTypeController.createDocumentType);
router.get('/', documentTypeController.getAllDocumentTypes);
router.get('/category/:category', documentTypeController.getDocumentTypesByCategory);
router.get('/device/:deviceTypeId/category/:category', documentTypeController.getDocumentTypeForDevice);
router.get('/:id', documentTypeController.getDocumentType);
router.put('/:id', documentTypeController.updateDocumentType);
router.patch('/:id/deactivate', documentTypeController.deactivateDocumentType);
router.delete('/:id', documentTypeController.deleteDocumentType);

// Document Type Operations
router.post('/:id/clone', documentTypeController.cloneDocumentType);
router.post('/validate-configuration', documentTypeController.validateDocumentTypeConfiguration);
router.get('/:id/usage-stats', documentTypeController.getDocumentTypeUsageStats);

export { router as documentTypeRoutes };