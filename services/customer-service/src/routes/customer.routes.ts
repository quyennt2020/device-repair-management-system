import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import { 
  createCustomerSchema, 
  updateCustomerSchema, 
  addContactSchema, 
  updateContactSchema,
  addAddressSchema,
  updateAddressSchema,
  updatePreferencesSchema,
  updateTierSchema
} from '../validation/customer.validation';

export function createCustomerRoutes(customerController: CustomerController): Router {
  const router = Router();

  // Customer CRUD
  router.post('/', 
    authMiddleware,
    validationMiddleware(createCustomerSchema),
    (req, res) => customerController.createCustomer(req, res)
  );

  router.get('/search', 
    authMiddleware,
    (req, res) => customerController.searchCustomers(req, res)
  );

  router.get('/code/:code', 
    authMiddleware,
    (req, res) => customerController.getCustomerByCode(req, res)
  );

  router.get('/:id', 
    authMiddleware,
    (req, res) => customerController.getCustomer(req, res)
  );

  router.put('/:id', 
    authMiddleware,
    validationMiddleware(updateCustomerSchema),
    (req, res) => customerController.updateCustomer(req, res)
  );

  // Customer History and Metrics
  router.get('/:id/history', 
    authMiddleware,
    (req, res) => customerController.getCustomerHistory(req, res)
  );

  router.get('/:id/metrics', 
    authMiddleware,
    (req, res) => customerController.getCustomerMetrics(req, res)
  );

  // Contact Management
  router.post('/:id/contacts', 
    authMiddleware,
    validationMiddleware(addContactSchema),
    (req, res) => customerController.addContact(req, res)
  );

  router.get('/:id/contacts', 
    authMiddleware,
    (req, res) => customerController.getContacts(req, res)
  );

  router.put('/contacts/:contactId', 
    authMiddleware,
    validationMiddleware(updateContactSchema),
    (req, res) => customerController.updateContact(req, res)
  );

  router.delete('/contacts/:contactId', 
    authMiddleware,
    (req, res) => customerController.deleteContact(req, res)
  );

  router.put('/:id/contacts/:contactId/primary', 
    authMiddleware,
    (req, res) => customerController.setPrimaryContact(req, res)
  );

  // Address Management
  router.post('/:id/addresses', 
    authMiddleware,
    validationMiddleware(addAddressSchema),
    (req, res) => customerController.addAddress(req, res)
  );

  router.get('/:id/addresses', 
    authMiddleware,
    (req, res) => customerController.getAddresses(req, res)
  );

  router.put('/addresses/:addressId', 
    authMiddleware,
    validationMiddleware(updateAddressSchema),
    (req, res) => customerController.updateAddress(req, res)
  );

  router.delete('/addresses/:addressId', 
    authMiddleware,
    (req, res) => customerController.deleteAddress(req, res)
  );

  router.put('/:id/addresses/:addressId/default', 
    authMiddleware,
    (req, res) => customerController.setDefaultAddress(req, res)
  );

  // Preferences Management
  router.get('/:id/preferences', 
    authMiddleware,
    (req, res) => customerController.getPreferences(req, res)
  );

  router.put('/:id/preferences', 
    authMiddleware,
    validationMiddleware(updatePreferencesSchema),
    (req, res) => customerController.updatePreferences(req, res)
  );

  // Tier Management
  router.put('/:id/tier', 
    authMiddleware,
    validationMiddleware(updateTierSchema),
    (req, res) => customerController.updateCustomerTier(req, res)
  );

  // Service Level Information
  router.get('/:id/service-level', 
    authMiddleware,
    (req, res) => customerController.getServiceLevel(req, res)
  );

  return router;
}