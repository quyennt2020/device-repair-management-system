import { 
  Customer, 
  CreateCustomerRequest, 
  UpdateCustomerRequest, 
  CustomerSearchCriteria, 
  CustomerSearchResult,
  CustomerHistory,
  CustomerMetrics,
  CustomerPreferences,
  CustomerContact,
  CustomerAddress,
  UUID
} from '../../../shared/types/src/customer';
import { CustomerRepository } from '../repositories/customer.repository';
import { CustomerContactRepository } from '../repositories/customer-contact.repository';
import { CustomerAddressRepository } from '../repositories/customer-address.repository';
import { CustomerPreferencesRepository } from '../repositories/customer-preferences.repository';

export class CustomerService {
  constructor(
    private customerRepository: CustomerRepository,
    private contactRepository: CustomerContactRepository,
    private addressRepository: CustomerAddressRepository,
    private preferencesRepository: CustomerPreferencesRepository
  ) {}

  async createCustomer(request: CreateCustomerRequest): Promise<Customer> {
    // Validate customer code uniqueness
    const existingCustomer = await this.customerRepository.findByCode(request.customerCode);
    if (existingCustomer) {
      throw new Error(`Customer with code ${request.customerCode} already exists`);
    }

    // Create customer
    const customer = await this.customerRepository.create(request);

    // Create contacts if provided
    if (request.contactInfo) {
      const contactData = {
        customerId: customer.id,
        name: request.contactInfo.name || 'Primary Contact',
        email: request.contactInfo.email,
        phone: request.contactInfo.phone,
        mobile: request.contactInfo.mobile,
        isPrimary: true,
        role: 'management' as const,
        createdBy: customer.createdBy,
        updatedBy: customer.createdBy
      };
      await this.contactRepository.create(contactData);
    }

    // Create addresses if provided
    if (request.addressInfo && request.addressInfo.length > 0) {
      for (let i = 0; i < request.addressInfo.length; i++) {
        const addressData = {
          ...request.addressInfo[i],
          customerId: customer.id,
          isDefault: i === 0, // First address is default
          createdBy: customer.createdBy,
          updatedBy: customer.createdBy
        };
        await this.addressRepository.create(addressData);
      }
    }

    return customer;
  }

  async getCustomer(id: UUID): Promise<Customer | null> {
    return this.customerRepository.findById(id);
  }

  async getCustomerByCode(customerCode: string): Promise<Customer | null> {
    return this.customerRepository.findByCode(customerCode);
  }

  async updateCustomer(id: UUID, request: UpdateCustomerRequest, updatedBy: UUID): Promise<Customer> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.customerRepository.update(id, request, updatedBy);
  }

  async searchCustomers(criteria: CustomerSearchCriteria, page: number = 1, limit: number = 20): Promise<CustomerSearchResult> {
    return this.customerRepository.search(criteria, page, limit);
  }

  async getCustomerHistory(customerId: UUID): Promise<CustomerHistory[]> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.customerRepository.getHistory(customerId);
  }

  async getCustomerMetrics(customerId: UUID): Promise<CustomerMetrics> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.customerRepository.getMetrics(customerId);
  }

  // Contact Management
  async addContact(customerId: UUID, contact: Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>): Promise<CustomerContact> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.contactRepository.create({
      ...contact,
      customerId
    });
  }

  async getContacts(customerId: UUID): Promise<CustomerContact[]> {
    return this.contactRepository.findByCustomerId(customerId);
  }

  async updateContact(contactId: UUID, updates: Partial<Omit<CustomerContact, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<CustomerContact> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    return this.contactRepository.update(contactId, updates);
  }

  async deleteContact(contactId: UUID): Promise<void> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    await this.contactRepository.delete(contactId);
  }

  async setPrimaryContact(customerId: UUID, contactId: UUID): Promise<void> {
    const contact = await this.contactRepository.findById(contactId);
    if (!contact || contact.customerId !== customerId) {
      throw new Error('Contact not found or does not belong to customer');
    }

    await this.contactRepository.setPrimary(customerId, contactId);
  }

  // Address Management
  async addAddress(customerId: UUID, address: Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>): Promise<CustomerAddress> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.addressRepository.create({
      ...address,
      customerId
    });
  }

  async getAddresses(customerId: UUID): Promise<CustomerAddress[]> {
    return this.addressRepository.findByCustomerId(customerId);
  }

  async updateAddress(addressId: UUID, updates: Partial<Omit<CustomerAddress, 'id' | 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<CustomerAddress> {
    const address = await this.addressRepository.findById(addressId);
    if (!address) {
      throw new Error('Address not found');
    }

    return this.addressRepository.update(addressId, updates);
  }

  async deleteAddress(addressId: UUID): Promise<void> {
    const address = await this.addressRepository.findById(addressId);
    if (!address) {
      throw new Error('Address not found');
    }

    await this.addressRepository.delete(addressId);
  }

  async setDefaultAddress(customerId: UUID, addressId: UUID): Promise<void> {
    const address = await this.addressRepository.findById(addressId);
    if (!address || address.customerId !== customerId) {
      throw new Error('Address not found or does not belong to customer');
    }

    await this.addressRepository.setDefault(customerId, addressId);
  }

  // Preferences Management
  async getPreferences(customerId: UUID): Promise<CustomerPreferences | null> {
    return this.preferencesRepository.findByCustomerId(customerId);
  }

  async updatePreferences(customerId: UUID, preferences: Partial<Omit<CustomerPreferences, 'customerId' | 'createdAt' | 'updatedAt'>>): Promise<CustomerPreferences> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.preferencesRepository.upsert({
      customerId,
      preferredTechnicians: preferences.preferredTechnicians || [],
      preferredServiceTimes: preferences.preferredServiceTimes || [],
      communicationPreferences: preferences.communicationPreferences || {
        email: true,
        sms: false,
        phone: false,
        preferredLanguage: 'vi',
        notificationTypes: ['case_created', 'case_completed']
      },
      specialInstructions: preferences.specialInstructions,
      createdBy: customerId,
      updatedBy: customerId
    });
  }

  // Tier Management
  async updateCustomerTier(customerId: UUID, newTier: string, updatedBy: UUID): Promise<Customer> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    return this.customerRepository.update(customerId, { 
      customerTier: newTier as any 
    }, updatedBy);
  }

  // Service Level Methods (for integration with other services)
  async getCustomerServiceLevel(customerId: UUID): Promise<{
    tier: string;
    slaHours: number;
    priority: string;
    preferredTechnicians: UUID[];
  }> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const preferences = await this.preferencesRepository.findByCustomerId(customerId);

    // Define service levels based on tier
    const serviceLevels = {
      platinum: { slaHours: 4, priority: 'critical' },
      gold: { slaHours: 8, priority: 'high' },
      silver: { slaHours: 24, priority: 'medium' },
      bronze: { slaHours: 48, priority: 'low' }
    };

    const serviceLevel = serviceLevels[customer.customerTier] || serviceLevels.bronze;

    return {
      tier: customer.customerTier,
      slaHours: serviceLevel.slaHours,
      priority: serviceLevel.priority,
      preferredTechnicians: preferences?.preferredTechnicians || []
    };
  }

  async getCustomersForAccountManager(accountManagerId: UUID): Promise<Customer[]> {
    const result = await this.customerRepository.search({ accountManagerId }, 1, 1000);
    return result.customers;
  }
}