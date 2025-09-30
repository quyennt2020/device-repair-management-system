import Joi from 'joi';

export const createDeviceSchema = Joi.object({
  deviceCode: Joi.string().required().min(1).max(50),
  customerId: Joi.string().uuid().required(),
  deviceTypeId: Joi.string().uuid().required(),
  manufacturer: Joi.string().required().min(1).max(100),
  model: Joi.string().required().min(1).max(100),
  serialNumber: Joi.string().required().min(1).max(100),
  specifications: Joi.object().default({}),
  locationInfo: Joi.object({
    address: Joi.string(),
    building: Joi.string(),
    floor: Joi.string(),
    room: Joi.string(),
    coordinates: Joi.object({
      latitude: Joi.number(),
      longitude: Joi.number()
    })
  }).required(),
  warrantyInfo: Joi.object({
    hasWarranty: Joi.boolean().default(false),
    warrantyType: Joi.string().valid('manufacturer', 'extended', 'service_contract'),
    startDate: Joi.date(),
    endDate: Joi.date(),
    provider: Joi.string(),
    coverageTerms: Joi.array().items(Joi.string()),
    claimProcedure: Joi.string()
  }).optional()
});

export const updateDeviceSchema = Joi.object({
  manufacturer: Joi.string().min(1).max(100),
  model: Joi.string().min(1).max(100),
  specifications: Joi.object(),
  locationInfo: Joi.object({
    address: Joi.string(),
    building: Joi.string(),
    floor: Joi.string(),
    room: Joi.string(),
    coordinates: Joi.object({
      latitude: Joi.number(),
      longitude: Joi.number()
    })
  }),
  status: Joi.string().valid('active', 'repair', 'maintenance', 'retired', 'scrapped', 'lost', 'stolen'),
  warrantyInfo: Joi.object({
    hasWarranty: Joi.boolean(),
    warrantyType: Joi.string().valid('manufacturer', 'extended', 'service_contract'),
    startDate: Joi.date(),
    endDate: Joi.date(),
    provider: Joi.string(),
    coverageTerms: Joi.array().items(Joi.string()),
    claimProcedure: Joi.string()
  }),
  nextServiceDate: Joi.date()
}).min(1);

export const deviceSearchSchema = Joi.object({
  query: Joi.string().min(1),
  customerId: Joi.string().uuid(),
  deviceTypeId: Joi.string().uuid(),
  manufacturer: Joi.string().min(1),
  status: Joi.string().valid('active', 'repair', 'maintenance', 'retired', 'scrapped', 'lost', 'stolen'),
  warrantyStatus: Joi.string().valid('active', 'expired', 'expiring_soon'),
  lastServiceDateFrom: Joi.date(),
  lastServiceDateTo: Joi.date(),
  nextServiceDateFrom: Joi.date(),
  nextServiceDateTo: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const createDeviceHistorySchema = Joi.object({
  deviceId: Joi.string().uuid().required(),
  repairCaseId: Joi.string().uuid(),
  eventType: Joi.string().valid('service', 'repair', 'calibration', 'inspection', 'maintenance', 'installation', 'relocation', 'retirement').required(),
  eventDate: Joi.date().required(),
  description: Joi.string().required().min(1),
  performedBy: Joi.string().uuid(),
  nextActionDate: Joi.date(),
  cost: Joi.number().min(0),
  partsUsed: Joi.array().items(Joi.object({
    partId: Joi.string().uuid().required(),
    partName: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    serialNumbers: Joi.array().items(Joi.string())
  }))
});

export const createDeviceTypeSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  category: Joi.string().required().min(1).max(100),
  manufacturer: Joi.string().required().min(1).max(100),
  modelSeries: Joi.string().required().min(1).max(100),
  specifications: Joi.object().default({}),
  standardServiceHours: Joi.number().min(0.1).required(),
  requiredCertifications: Joi.array().items(Joi.string()).default([]),
  maintenanceChecklist: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'semi_annually', 'annually', 'as_needed').required(),
    estimatedDuration: Joi.number().min(0).required(),
    requiredTools: Joi.array().items(Joi.string()),
    safetyNotes: Joi.string()
  })).default([])
});

export const updateDeviceTypeSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  category: Joi.string().min(1).max(100),
  manufacturer: Joi.string().min(1).max(100),
  modelSeries: Joi.string().min(1).max(100),
  specifications: Joi.object(),
  standardServiceHours: Joi.number().min(0.1),
  requiredCertifications: Joi.array().items(Joi.string()),
  maintenanceChecklist: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    description: Joi.string().required(),
    category: Joi.string().required(),
    frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'semi_annually', 'annually', 'as_needed').required(),
    estimatedDuration: Joi.number().min(0).required(),
    requiredTools: Joi.array().items(Joi.string()),
    safetyNotes: Joi.string()
  }))
}).min(1);