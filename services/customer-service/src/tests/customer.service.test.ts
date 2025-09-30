import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerService } from '../services/customer.service';
import { CustomerRepository } from '../repositories/customer.repository';
import { CustomerContactRepository } from '../repositories/customer-contact.repository';
import { CustomerAddressRepository } from '../repositories/customer-address.repository';
import { CustomerPreferencesRepository } from '../repositories/customer-preferences.repository';
import { CreateCustomerRequest, Customer } from '../../../shared/types/src/customer';

// Mock repositories
const mockCustomerRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  update: vi.fn(),
  search: vi.fn(),
  getHistory: vi.fn(),
  getMetrics: vi.fn()
} as any;

const mockContactRepository = {
  create: vi.fn(),
  findByCustomerId: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  setPrimary: vi.fn()
} as any;

const mockAddressRepository = {
  create: vi.fn(),
  findByCustomerId: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  setDefault: vi.fn()
} as any;

const mockPreferencesRepository = {
  create: vi.fn(),
  findByCustomerId: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn()
} as any;

describe('CustomerService', () => {
  let customerService: CustomerService;

  beforeEach(() => {
    vi.clearAllMocks();
    customerService = new CustomerService(
      mockCustomerRepository,
      mockContactRepository,
      mockAddressRepository,
      mockPreferencesRepository
    );
  });

  describe('createCustomer', () => {
    it('should create a customer successfully', async () => {
      const request: CreateCustomerRequest = {
        customerCode: 'CUST-001',
        customerType: 'company',
        companyName: 'Test Company',
        contactInfo: {
          name: 'John Doe',
          email: 'john@test.com',
          phone: '+84-123-456-789'
        },
        addressInfo: [{
          addressType: 'headquarters',
          addressName: 'Head Office',
          streetAddress: '123 Test Street',
          city: 'Ho Chi Minh City',
          country: 'Vietnam',
          isDefault: true
        }],
        customerTier: 'gold'
      };

      const mockCustomer: Customer = {
        id: 'customer-001',
        customerCode: 'CUST-001',
        customerType: 'company',
        companyName: 'Test Company',
        contactInfo: request.contactInfo,
        addressInfo: request.addressInfo,
        customerTier: 'gold',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'customer-001',
        updatedBy: 'customer-001'
      };

      mockCustomerRepository.findByCode.mockResolvedValue(null);
      mockCustomerRepository.create.mockResolvedValue(mockCustomer);
      mockContactRepository.create.mockResolvedValue({});
      mockAddressRepository.create.mockResolvedValue({});

      const result = await customerService.createCustomer(request);

      expect(mockCustomerRepository.findByCode).toHaveBeenCalledWith('CUST-001');
      expect(mockCustomerRepository.create).toHaveBeenCalledWith(request);
      expect(mockContactRepository.create).toHaveBeenCalled();
      expect(mockAddressRepository.create).toHaveBeenCalled();
      expect(result).toEqual(mockCustomer);
    });

    it('should throw error if customer code already exists', async () => {
      const request: CreateCustomerRequest = {
        customerCode: 'CUST-001',
        customerType: 'company',
        contactInfo: { name: 'John Doe' },
        addressInfo: []
      };

      const existingCustomer = { id: 'existing-customer' };
      mockCustomerRepository.findByCode.mockResolvedValue(existingCustomer);

      await expect(customerService.createCustomer(request)).rejects.toThrow(
        'Customer with code CUST-001 already exists'
      );
    });
  });

  describe('getCustomerServiceLevel', () => {
    it('should return correct service level for gold tier customer', async () => {
      const customerId = 'customer-001';
      const mockCustomer: Customer = {
        id: customerId,
        customerCode: 'CUST-001',
        customerType: 'company',
        customerTier: 'gold',
        status: 'active',
        contactInfo: { name: 'Test' },
        addressInfo: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: customerId,
        updatedBy: customerId
      };

      const mockPreferences = {
        customerId,
        preferredTechnicians: ['tech-001', 'tech-002'],
        preferredServiceTimes: [],
        communicationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: customerId,
        updatedBy: customerId
      };

      mockCustomerRepository.findById.mockResolvedValue(mockCustomer);
      mockPreferencesRepository.findByCustomerId.mockResolvedValue(mockPreferences);

      const result = await customerService.getCustomerServiceLevel(customerId);

      expect(result).toEqual({
        tier: 'gold',
        slaHours: 8,
        priority: 'high',
        preferredTechnicians: ['tech-001', 'tech-002']
      });
    });

    it('should return default service level for bronze tier customer', async () => {
      const customerId = 'customer-001';
      const mockCustomer: Customer = {
        id: customerId,
        customerCode: 'CUST-001',
        customerType: 'company',
        customerTier: 'bronze',
        status: 'active',
        contactInfo: { name: 'Test' },
        addressInfo: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: customerId,
        updatedBy: customerId
      };

      mockCustomerRepository.findById.mockResolvedValue(mockCustomer);
      mockPreferencesRepository.findByCustomerId.mockResolvedValue(null);

      const result = await customerService.getCustomerServiceLevel(customerId);

      expect(result).toEqual({
        tier: 'bronze',
        slaHours: 48,
        priority: 'low',
        preferredTechnicians: []
      });
    });
  });

  describe('updateCustomerTier', () => {
    it('should update customer tier successfully', async () => {
      const customerId = 'customer-001';
      const newTier = 'platinum';
      const updatedBy = 'user-001';

      const mockCustomer: Customer = {
        id: customerId,
        customerCode: 'CUST-001',
        customerType: 'company',
        customerTier: 'gold',
        status: 'active',
        contactInfo: { name: 'Test' },
        addressInfo: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: customerId,
        updatedBy: customerId
      };

      const updatedCustomer = { ...mockCustomer, customerTier: 'platinum' as any };

      mockCustomerRepository.findById.mockResolvedValue(mockCustomer);
      mockCustomerRepository.update.mockResolvedValue(updatedCustomer);

      const result = await customerService.updateCustomerTier(customerId, newTier, updatedBy);

      expect(mockCustomerRepository.update).toHaveBeenCalledWith(
        customerId,
        { customerTier: newTier },
        updatedBy
      );
      expect(result.customerTier).toBe('platinum');
    });
  });
});