import { Router } from 'express';
import { DocumentTemplateController } from '../controllers/document-template.controller';

const router = Router();
const documentTemplateController = new DocumentTemplateController();

// Dynamic Form Generation
router.get('/form/:deviceTypeId/:category', documentTemplateController.generateDynamicForm);
router.get('/preview/:documentTypeId', documentTemplateController.getFormPreview);

// Field Suggestions
router.get('/suggestions/:category', documentTemplateController.getFieldSuggestions);

// Document Content Validation
router.post('/validate/:documentTypeId', documentTemplateController.validateDocumentContent);

export { router as documentTemplateRoutes };