export type RoleType = 
  | 'Super Admin'
  | 'Admin'
  | 'Regional Manager'
  | 'General Manager'
  | 'Employee'
  | 'Site Manager'
  | 'Staff';

export type StatusType = 'Open' | 'In progress' | 'Completed' | 'Pending' | 'Archived';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface RecordAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface PropertyInfo {
  id: string;
  pid?: string;
  name: string;
  city: string;
  capacity: number;
  activeResidents?: number;
  council?: string;
  leadOfficer?: string;
  contactNumber?: string;
  status: 'Active' | 'Under Maintenance';
}

export type SiteInfo = PropertyInfo;

export interface RolePermissions {
  canViewAllProperties: boolean;
  canCreateRecords: boolean;
  canEditRecords: boolean;
  canDeleteRecords: boolean;
  canArchiveRestore: boolean;
  canExportData: boolean;
  canManageProperties: boolean;
  canManageFiles: boolean; // Full CRUD for files (upload & delete)
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export interface SGReferral {
  id: string;
  srNo: number;
  site: string;
  referralCouncil: string;
  suName: string;
  mosaicId: string;
  portRef: string;
  dob: string;
  officerLeadingHotel: string;
  raisedBy?: string;
  referralType: 'Safeguarding Adult' | 'Safeguarding Child' | 'Mental Health' | 'Domestic Abuse' | 'Social Care' | 'Emergency Medical';
  status: StatusType;
  dateReferred: string;
  methodOfReferral: 'Mosaic Portal' | 'Encrypted Email' | 'Phone / Portal Follow-up' | 'LA Direct Case Management';
  acknowledgementReceived: 'Yes' | 'No' | 'Pending';
  responseReceivedFromLA: 'Yes' | 'No' | 'Awaiting Allocation';
  laOfficerLeading: string;
  notesActionTaken: string;
  sgReview: string;
  urgency: RiskLevel;
  attachments?: RecordAttachment[];
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: string;
}

export interface VulnerableSU {
  id: string;
  site: string;
  roomOrFlatNo: string;
  suName: string;
  dob: string;
  group: 'Single Adult' | 'Family' | 'Pregnant Woman' | 'Elderly' | 'Young Adult (18-21)' | 'Medical Need';
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  portOrNassRef: string;
  vulnerability: string;
  notesActionTaken: string;
  sgTeamUpdate: string;
  riskLevel: RiskLevel;
  status: StatusType;
  reviewDate: string;
  allocatedWorker: string;
  raisedBy?: string;
  attachments?: RecordAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ChallengingSU {
  id: string;
  date: string;
  site: string;
  name: string;
  portRef: string;
  dob: string;
  group: string;
  gender: 'Male' | 'Female' | 'Other';
  typeOfIssue: 'Verbal Aggression' | 'Curfew Non-compliance' | 'Room Damage' | 'Substance Misuse' | 'Dispute with Resident' | 'Other';
  incidentDescription: string;
  dateOfIncident: string;
  actionTaken: string;
  adviceGivenBySGTeam: string;
  followUpRequired: 'Yes' | 'No';
  riskFactor: RiskLevel;
  followUpNotes: string;
  comments: string;
  reviewBySGTeam: string;
  status: StatusType;
  raisedBy?: string;
  loggedBy?: string;
  attachments?: RecordAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface LaundryRecord {
  id: string;
  site: string;
  roomNo: string;
  residentName: string;
  ref: string;
  date: string;
  tokensIssued: number;
  bagCount: number;
  dirtyLaundrySent?: number;
  cleanLaundryReturned?: number;
  discrepancies?: boolean | string;
  discrepancyCount?: number;
  remarksActionsTaken?: string;
  status: 'Queued' | 'Washing' | 'Drying' | 'Ready for Collection' | 'Collected';
  collectionTime?: string;
  staffInitials: string;
  notes?: string;
  createdAt: string;
}

export interface PropertyLaundryLog {
  id: string;
  site: string;
  periodType: 'Weekly' | 'Monthly';
  periodLabel: string; // e.g. "Week 27 (06th to 12th of July 26)", "July 2026"
  startDate: string;
  endDate: string;
  dirtyLaundrySent: number;
  cleanLaundryReturned: number;
  discrepanciesCount: number;
  hasDiscrepancy: boolean;
  discrepancyDetails?: string;
  remarksActionsTaken: string;
  loggedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type FoodVendorName = 'A&M' | 'Freshbite' | '9 cusines' | 'sands' | '9 Cuisines' | 'Sands';

export interface FoodBuffetItemBreakdown {
  lunch: number;
  dinner: number;
  todlrLunch?: number; // Todlr(Lunch) or Chld / Todlr(Lunch)
  todlrDinner?: number; // Todlr(Dinner) or Chld / Todlr(Dinner)
  specialLunch?: number; // Special-Lunch
  specialDinner?: number; // Special-Dinner
  schoolMealLunch?: number; // School Meal/Child Lunch or School Meal(Included in Child meals-Lunch)
  childDinner?: number; // Child Dinner
  total?: number;
}

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface PropertyFoodVendorBuffetLog {
  id: string;
  vendor: FoodVendorName;
  site: string; // e.g., 'Holiday Inn Lambeth', 'Leigham Court Hotel'
  weekRange: string; // e.g., '06th to 12th of July 26'
  startDate: string;
  endDate: string;
  // Day-by-day buffet line items
  dailyCounts: {
    [day in DayOfWeek]?: FoodBuffetItemBreakdown;
  };
  weeklyTotal?: FoodBuffetItemBreakdown;
  notes?: string;
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface FoodRecord {
  id: string;
  site: string;
  roomNo: string;
  residentName: string;
  vendor?: FoodVendorName | string;
  dietaryRequirement: 'Standard Halal' | 'Vegetarian' | 'Diabetic' | 'Soft Diet' | 'Child / Infant' | 'Strict Allergy';
  mealType: 'Breakfast' | 'Lunch' | 'Dinner' | 'Late Intake Pack';
  servings: number;
  tempCheckedCelsius: number;
  deliveredBy: string;
  timeDelivered: string;
  residentSigned: boolean;
  status: 'Delivered' | 'Special Request' | 'Refused' | 'Pending';
  notes?: string;
  createdAt: string;
}

export interface EscalationRecord {
  id: string;
  dateOfIncident: string;
  suPortNassRef: string;
  suName: string;
  siteName: string;
  site: string; // for site isolation and filtering
  personReporting: string;
  submittedBy?: string;
  incidentType: string;
  wlIssued: 'Yes' | 'No' | 'Warning Letter Issued' | 'Notice to Quit' | 'N/A';
  reportedAuthorities: string;
  incidentNotes: string;
  actionTaken: string;
  status: 'Active' | 'Under Investigation' | 'Awaiting Multi-Agency Review' | 'Resolved';
  urgency?: RiskLevel;
  attachments?: RecordAttachment[];
  createdAt: string;
  // Backward compatibility fields
  incidentTitle?: string;
  refNumber?: string;
  reportedBy?: string;
  dateTime?: string;
  incidentSummary?: string;
  immediateAction?: string;
  escalatedTo?: string;
  resolutionSummary?: string;
}

export interface DocumentRecord {
  id: string;
  site: string;
  suName: string;
  refNumber: string;
  documentTitle: string;
  category: 'Safeguarding Plan' | 'Medical Assessment' | 'Incident Report' | 'Proof of Support' | 'Consent Form' | 'Risk Assessment';
  fileFormat: 'PDF' | 'DOCX' | 'XLSX' | 'SCAN';
  fileSizeKb: number;
  confidentiality: 'Restricted' | 'Confidential' | 'Official';
  uploadedBy: string;
  uploadDate: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'RESTORE' | 'ROLE_CHANGE' | 'SETTINGS_UPDATE' | 'BACKUP_EXPORT' | 'DATA_RESTORE';
  module: 'Referrals' | 'Vulnerable SUs' | 'Challenging SUs' | 'Laundry' | 'Hot Food' | 'Escalations' | 'Documents' | 'Roles' | 'Settings' | 'Properties' | 'Users';
  targetItem: string;
  performedByRole: RoleType;
  performedByUser: string;
  site: string;
  details: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  assignedProperty?: string;
  assignedProperties: string[];
  userIds: string[];
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  assignedSites: string[]; // ['Hotel A'] or ['All']
  status: 'Active' | 'Inactive';
  lastActive: string;
}

export type MaintenancePriority = 'CAT 1' | 'CAT 2 - Interim' | 'CAT 2' | 'CAT 3';
export type DefectStatus = 'In Process' | 'Completed';
export type MaintenanceAction = 'Open' | 'Closed';

export interface MaintenanceRecord {
  id: string;
  date: string;
  priority: MaintenancePriority;
  priorityTimeScale: string; // e.g. "0 (4 Hours)", "1 (24 Hours - Interim)", "5 Working Days", "21 Working Days"
  location: string;
  site: string;
  room?: string;
  description: string;
  criteriaCode?: string;
  raisedBy: string;
  closeDueDate: string;
  defectStatus: DefectStatus;
  action: MaintenanceAction;
  progress: string;
  actualClosedDate?: string;
  notes?: string;
  createdAt: string;
}

export interface SPCDRecord {
  id: string;
  date: string;
  siteName: string; // Atlantic BW / Site Name
  site?: string;
  roomNumber: string;
  staffReporting: string;
  raisedBy?: string;
  suName: string;
  suPortReference: string;
  suDob: string;
  briefDescriptionActionTaken: string;
  followUpNotes: string;
  updates: string;
  sgReview: string;
  isArchived: boolean;
  dateLeft?: string;
  reasonForLeaving?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataChangeRequest {
  id: string;
  requestedBy: string;
  requestedByRole: RoleType;
  site: string;
  module: 'Referrals' | 'Vulnerable SUs' | 'Challenging SUs' | 'Maintenance' | 'SPCD' | 'Hot Food' | 'Laundry' | 'Escalations';
  recordId?: string;
  recordTitle: string;
  requestType: 'Edit Correction' | 'Deletion Request' | 'New Record Approval' | 'General Correction';
  reason: string;
  proposedChanges?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface AppSettings {
  // Performance & Fast Loading
  pageSize: number; // 10, 25, 50, 100
  enableFastCache: boolean;
  compactView: boolean;
  reduceAnimations: boolean;
  autoSaveDrafts: boolean;
  enableColumnPinning: boolean; // User preference to toggle sticky/pinned action columns on tables
  
  // Security & Governance
  autoLogoutMinutes: number; // Inactivity auto-logout timeout in minutes (0 = Disabled, 5, 10, 15, 30, 60)
  strictSiteIsolation: boolean;
  requireConfirmForEdits: boolean;
  requireConfirmForDeletes: boolean;
  requireConfirmForCreates: boolean;
  requireConfirmForArchives: boolean;

  // Sync & Backup
  sharePointSyncIntervalMinutes: number;
  lastSharePointSync: string;
  autoArchiveDaysCompleted: number;

  // SharePoint & Excel Online Workbook Configuration
  sharePointWorkbookUrl?: string;
  sharePointWorkbookName?: string;
  sharePointTargetFolder?: string;
  sharePointDefaultSheet?: string;
  sharePointAutoSyncEnabled?: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  assignedSite: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt?: number;
}

export type FieldOptionCategory = 
  | 'referralTypes'
  | 'referralMethods'
  | 'referralStatuses'
  | 'vulnerabilities'
  | 'vulnerableStatuses'
  | 'incidentTypes'
  | 'incidentRiskFactors'
  // Urgency / risk grading matching the RiskLevel union. Distinct from
  // 'incidentRiskFactors', which grades incident severity on a different
  // vocabulary (Minor / Moderate / High / Critical).
  | 'riskLevels'
  | 'challengingStatuses'
  | 'escalationAuthorities'
  | 'escalationStatuses'
  | 'maintenancePriorities'
  | 'maintenanceTimeScales'
  | 'maintenanceStatuses'
  | 'mealTypes'
  | 'dietaryTypes'
  | 'foodStatuses'
  | 'laundryStages'
  | 'councils';

export interface CustomFieldOption {
  id: string;
  category: FieldOptionCategory;
  label: string;
  value: string;
  color?: string; // e.g., 'blue', 'green', 'amber', 'red', 'purple', 'teal', 'slate'
  description?: string;
  isActive: boolean;
  isSystem?: boolean;
  order: number;
}
