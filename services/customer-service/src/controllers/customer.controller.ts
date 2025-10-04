import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';
import { 
  CreateCustomerRequest, 
  UpdateCustomerRequest, 
  CustomerSearchCriteria,
  CustomerContact,
  CustomerAddress
} from '@drms/shared-types';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const request: CreateCustomerRequest = req.body;
      const customer = await this.customerService.createCustomer(request);
      
      res.status(201).json({
        success: true,
        data: customer,
        message: 'Customer created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer'
      });
    }
  }

  async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customer = await this.customerService.getCustomer(id);
      
      if (!customer) {
        res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
        return;
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer'
      });
    }
  }

  async getCustomerByCode(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const customer = await this.customerService.getCustomerByCode(code);
      
      if (!customer) {
        res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
        return;
      }

      res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer'
      });
    }
  }

  async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const request: UpdateCustomerRequest = req.body;
      const updatedBy = req.user?.id || id; // fallback to customer id if no user context
      
      const customer = await this.customerService.updateCustomer(id, request, updatedBy);
      
      res.json({
        success: true,
        data: customer,
        message: 'Customer updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update customer'
      });
    }
  }

  async searchCustomers(req: Request, res: Response): Promise<void> {
    try {
      const criteria: CustomerSearchCriteria = {
        query: req.query.query as string,
        customerType: req.query.customerType as any,
        customerTier: req.query.customerTier as any,
        status: req.query.status as any,
        industry: req.query.industry as string,
        accountManagerId: req.query.accountManagerId as string,
        createdDateFrom: req.query.createdDateFrom ? new Date(req.query.createdDateFrom as string) : undefined,
        createdDateTo: req.query.createdDateTo ? new Date(req.query.createdDateTo as string) : undefined
      };

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.customerService.searchCustomers(criteria, page, limit);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search customers'
      });
    }
  }

  async getCustomerHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const history = await this.customerService.getCustomerHistory(id);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer history'
      });
    }
  }

  async getCustomerMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const metrics = await this.customerService.getCustomerMetrics(id);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer metrics'
      });
    }
  }

  // Contact Management
  async addContact(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const contactData: Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'> = req.body;
      
      const contact = await this.customerService.addContact(id, contactData);
      
      res.status(201).json({
        success: true,
        data: contact,
        message: 'Contact added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add contact'
      });
    }
  }

  async getContacts(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const contacts = await this.customerService.getContacts(id);
      
      res.json({
        success: true,
        data: contacts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get contacts'
      });
    }
  }

  async updateContact(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      const updates = req.body;
      
      const contact = await this.customerService.updateContact(contactId, updates);
      
      res.json({
        success: true,
        data: contact,
        message: 'Contact updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update contact'
      });
    }
  }

  async deleteContact(req: Request, res: Response): Promise<void> {
    try {
      const { contactId } = req.params;
      
      await this.customerService.deleteContact(contactId);
      
      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete contact'
      });
    }
  }

  async setPrimaryContact(req: Request, res: Response): Promise<void> {
    try {
      const { id, contactId } = req.params;
      
      await this.customerService.setPrimaryContact(id, contactId);
      
      res.json({
        success: true,
        message: 'Primary contact updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set primary contact'
      });
    }
  }

  // Address Management
  async addAddress(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const addressData: Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt' | 'updatedAt'> = req.body;
      
      const address = await this.customerService.addAddress(id, addressData);
      
      res.status(201).json({
        success: true,
        data: address,
        message: 'Address added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add address'
      });
    }
  }

  async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const addresses = await this.customerService.getAddresses(id);
      
      res.json({
        success: true,
        data: addresses
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get addresses'
      });
    }
  }

  async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const { addressId } = req.params;
      const updates = req.body;
      
      const address = await this.customerService.updateAddress(addressId, updates);
      
      res.json({
        success: true,
        data: address,
        message: 'Address updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update address'
      });
    }
  }

  async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const { addressId } = req.params;
      
      await this.customerService.deleteAddress(addressId);
      
      res.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete address'
      });
    }
  }

  async setDefaultAddress(req: Request, res: Response): Promise<void> {
    try {
      const { id, addressId } = req.params;
      
      await this.customerService.setDefaultAddress(id, addressId);
      
      res.json({
        success: true,
        message: 'Default address updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set default address'
      });
    }
  }

  // Preferences Management
  async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const preferences = await this.customerService.getPreferences(id);
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get preferences'
      });
    }
  }

  async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const preferences = req.body;
      
      const updatedPreferences = await this.customerService.updatePreferences(id, preferences);
      
      res.json({
        success: true,
        data: updatedPreferences,
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update preferences'
      });
    }
  }

  // Tier Management
  async updateCustomerTier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tier } = req.body;
      const updatedBy = req.user?.id || id;
      
      const customer = await this.customerService.updateCustomerTier(id, tier, updatedBy);
      
      res.json({
        success: true,
        data: customer,
        message: 'Customer tier updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update customer tier'
      });
    }
  }

  // Service Level Information
  async getServiceLevel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const serviceLevel = await this.customerService.getCustomerServiceLevel(id);
      
      res.json({
        success: true,
        data: serviceLevel
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get service level'
      });
    }
  }
}