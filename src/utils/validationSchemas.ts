import { z } from 'zod';

// ==========================================
// 1. User & Account Management Schemas
// ==========================================
export const userAccountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format'),
  role: z.enum(['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Employee', 'Site Manager', 'Staff']),
  assignedSites: z.array(z.string()).min(1, 'At least one site must be assigned'),
  status: z.enum(['Active', 'Inactive', 'Suspended'])
});

export const userGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters'),
  description: z.string().optional(),
  assignedProperty: z.string().min(1, 'Assigned property is required'),
  assignedProperties: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional()
});

export const propertySchema = z.object({
  name: z.string().min(2, 'Property name is required'),
  city: z.string().min(1, 'City is required'),
  capacity: z.coerce.number().int().positive('Capacity must be a positive number'),
  council: z.string().optional(),
  leadOfficer: z.string().optional(),
  contactNumber: z.string().optional(),
  status: z.enum(['Active', 'Under Maintenance'])
});

// ==========================================
// 2. Shared Laundry Log Zod Schema
// ==========================================
export const laundryLogSchema = z.object({
  site: z.string().min(1, 'Site / Property is mandatory'),
  roomNo: z.string().optional(),
  residentName: z.string().optional(),
  ref: z.string().optional(),
  date: z.string().min(1, 'Date is mandatory'),
  startDate: z.string().min(1, 'Start date is required for log period'),
  endDate: z.string().min(1, 'End date is required for log period'),
  tokensIssued: z.coerce.number().int().min(0, 'Tokens issued must be 0 or greater').default(0),
  bagCount: z.coerce.number().int().min(0, 'Bag count must be 0 or greater').default(0),
  dirtyLaundrySent: z.coerce.number().int().min(0, 'Dirty laundry count must be a non-negative number').default(0),
  cleanLaundryReturned: z.coerce.number().int().min(0, 'Clean laundry count must be a non-negative number').default(0),
  discrepanciesCount: z.coerce.number().int().min(0, 'Discrepancy count must be non-negative').default(0),
  hasDiscrepancy: z.boolean().default(false),
  discrepancyDetails: z.string().optional(),
  remarksActionsTaken: z.string().optional(),
  status: z.enum(['Queued', 'Washing', 'Drying', 'Ready for Collection', 'Collected', 'Verified', 'Flagged']).default('Queued'),
  // Readonly / Audit Fields
  loggedBy: z.string().min(1, 'Audited By / Logged By field is required and readonly'),
  auditedBy: z.string().optional(),
  staffInitials: z.string().optional(),
  notes: z.string().optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate']
});

export const laundryRecordSchema = laundryLogSchema;

// ==========================================
// 3. Shared Food Log Zod Schema
// ==========================================
export const foodLogSchema = z.object({
  site: z.string().min(1, 'Site / Property is mandatory'),
  date: z.string().min(1, 'Date is mandatory'),
  startDate: z.string().min(1, 'Start date is required for log period'),
  endDate: z.string().min(1, 'End date is required for log period'),
  mealType: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Special Dietary', 'Snacks', 'Buffet Delivery']).default('Buffet Delivery'),
  vendorName: z.string().min(1, 'Vendor name is mandatory'),
  supplierName: z.string().optional(),
  mealsDelivered: z.coerce.number().int().min(0, 'Meals delivered must be a positive number or 0').default(0),
  temperatureCheck: z.coerce.number().min(-50, 'Temperature check must be valid').max(150, 'Temperature check must be valid').optional(),
  qualityCheck: z.enum(['Satisfactory', 'Pass', 'Minor Issues', 'Rejected', 'Needs Review']).default('Pass'),
  weeklyTotal: z.coerce.number().int().min(0, 'Weekly total must be a valid number').default(0),
  // Readonly / Audit Fields
  lastUpdatedBy: z.string().min(1, 'Audited By field is mandatory and readonly'),
  auditedBy: z.string().optional(),
  staffSignoff: z.string().optional(),
  notes: z.string().optional()
}).refine(data => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'End date must be on or after start date',
  path: ['endDate']
});

export const foodRecordSchema = foodLogSchema;

// ==========================================
// 4. Safeguarding Referral Schema
// ==========================================
export const sgReferralSchema = z.object({
  site: z.string().min(1, 'Site is required'),
  referralCouncil: z.string().min(1, 'Referral council is required'),
  suName: z.string().min(1, 'Service user name is required'),
  mosaicId: z.string().min(1, 'Mosaic ID is required'),
  portRef: z.string().min(1, 'Port reference is required'),
  dob: z.string().min(1, 'Date of birth is required'),
  officerLeadingHotel: z.string().min(1, 'Officer leading hotel is required'),
  referralType: z.enum(['Safeguarding Adult', 'Safeguarding Child', 'Mental Health', 'Domestic Abuse', 'Social Care', 'Emergency Medical']),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
  status: z.enum(['Open', 'In progress', 'Completed', 'Pending', 'Archived']),
  methodOfReferral: z.enum(['Mosaic Portal', 'Encrypted Email', 'Phone / Portal Follow-up', 'LA Direct Case Management']),
  notesActionTaken: z.string().min(1, 'Notes and actions taken are required')
});

// ==========================================
// 5. Types & Helper Validator Functions
// ==========================================
export type ValidatedUserAccount = z.infer<typeof userAccountSchema>;
export type ValidatedUserGroup = z.infer<typeof userGroupSchema>;
export type ValidatedProperty = z.infer<typeof propertySchema>;
export type LaundryLog = z.infer<typeof laundryLogSchema>;
export type FoodLog = z.infer<typeof foodLogSchema>;
export type ValidatedLaundryRecord = LaundryLog;
export type ValidatedFoodRecord = FoodLog;
export type ValidatedSGReferral = z.infer<typeof sgReferralSchema>;

/**
 * Validate a LaundryLog payload with Zod
 */
export function validateLaundryLog(payload: unknown): { success: true; data: LaundryLog } | { success: false; errors: Record<string, string> } {
  const result = laundryLogSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach(issue => {
    const field = issue.path.join('.') || 'form';
    errors[field] = issue.message;
  });
  return { success: false, errors };
}

/**
 * Validate a FoodLog payload with Zod
 */
export function validateFoodLog(payload: unknown): { success: true; data: FoodLog } | { success: false; errors: Record<string, string> } {
  const result = foodLogSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  result.error.issues.forEach(issue => {
    const field = issue.path.join('.') || 'form';
    errors[field] = issue.message;
  });
  return { success: false, errors };
}
