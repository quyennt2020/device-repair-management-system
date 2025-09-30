import Joi from 'joi';

export const createCustomerSchema = Joi.object({
  customerCode: Joi.string().required().min(3).max(50),
  customerType: Joi.string().valid('individual', 'company').required(),
  companyName: Joi.string().when('customerType', {
    is: 'company',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  taxCode: Joi.string().optional(),
  industry: Joi.string().optional(),
  contactInfo: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    mobile: Joi.string().optional()
  }).required(),
  addressInfo: Joi.array().items(
    Joi.object({
      addressType: Joi.string().valid('billing', 'shipping', 'service', 'headquarters').required(),
      addressName: Joi.string().required(),
      streetAddress: Joi.string().required(),
      city: Joi.string().required(),
      stateProvince: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      country: Joi.string().required(),
      contactPerson: Joi.string().optional(),
      phone: Joi.string().optional(),
      isDefault: Joi.boolean().optional()
    })
  ).min(1).required(),
  creditLimit: Joi.number().positive().optional(),
  paymentTerms: Joi.number().integer().min(0).optional(),
  customerTier: Joi.string().valid('platinum', 'gold', 'silver', 'bronze').optional(),
  accountManagerId: Joi.string().uuid().optional()
});

export const updateCustomerSchema = Joi.object({
  companyName: Joi.string().optional(),
  taxCode: Joi.string().optional(),
  industry: Joi.string().optional(),
  contactInfo: Joi.object({
    name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().optional(),
    mobile: Joi.string().optional()
  }).optional(),
  creditLimit: Joi.number().positive().optional(),
  paymentTerms: Joi.number().integer().min(0).optional(),
  customerTier: Joi.string().valid('platinum', 'gold', 'silver', 'bronze').optional(),
  status: Joi.string().valid('active', 'inactive', 'blocked', 'suspended').optional(),
  accountManagerId: Joi.string().uuid().optional()
});

export const addContactSchema = Joi.object({
  name: Joi.string().required(),
  title: Joi.string().optional(),
  department: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  mobile: Joi.string().optional(),
  isPrimary: Joi.boolean().optional(),
  role: Joi.string().valid('technical', 'purchasing', 'management', 'finance', 'operations').required()
});

export const updateContactSchema = Joi.object({
  name: Joi.string().optional(),
  title: Joi.string().optional(),
  department: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  mobile: Joi.string().optional(),
  isPrimary: Joi.boolean().optional(),
  role: Joi.string().valid('technical', 'purchasing', 'management', 'finance', 'operations').optional()
});

export const addAddressSchema = Joi.object({
  addressType: Joi.string().valid('billing', 'shipping', 'service', 'headquarters').required(),
  addressName: Joi.string().required(),
  streetAddress: Joi.string().required(),
  city: Joi.string().required(),
  stateProvince: Joi.string().optional(),
  postalCode: Joi.string().optional(),
  country: Joi.string().required(),
  contactPerson: Joi.string().optional(),
  phone: Joi.string().optional(),
  isDefault: Joi.boolean().optional()
});

export const updateAddressSchema = Joi.object({
  addressType: Joi.string().valid('billing', 'shipping', 'service', 'headquarters').optional(),
  addressName: Joi.string().optional(),
  streetAddress: Joi.string().optional(),
  city: Joi.string().optional(),
  stateProvince: Joi.string().optional(),
  postalCode: Joi.string().optional(),
  country: Joi.string().optional(),
  contactPerson: Joi.string().optional(),
  phone: Joi.string().optional(),
  isDefault: Joi.boolean().optional()
});

export const updatePreferencesSchema = Joi.object({
  preferredTechnicians: Joi.array().items(Joi.string().uuid()).optional(),
  preferredServiceTimes: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    })
  ).optional(),
  communicationPreferences: Joi.object({
    email: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
    phone: Joi.boolean().optional(),
    preferredLanguage: Joi.string().optional(),
    notificationTypes: Joi.array().items(
      Joi.string().valid(
        'case_created', 'case_assigned', 'case_completed', 
        'quotation_ready', 'approval_required', 'service_reminder', 
        'contract_expiry'
      )
    ).optional()
  }).optional(),
  specialInstructions: Joi.string().optional()
});

export const updateTierSchema = Joi.object({
  tier: Joi.string().valid('platinum', 'gold', 'silver', 'bronze').required()
});