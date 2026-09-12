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
  url?: string;
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
  loggedBy?: string;
  incidentType: string;
  wlIssued: 'Yes' | 'No' | 'Warning Letter Issued' | 'Notice to Quit' | 'N/A';
  reportedAuthorities: string;
  incidentNotes: string;
  actionTaken: string;
  status: 'Active' | 'Under Investigation' | 'Awaiting Multi-Agency Review' | 'Resolved';
  urgency?: RiskLevel;
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
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
  uploadDate?: string;
  uploadedDate?: string;
  notes?: string;
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  storagePath?: string;
  storage_path?: string;
  createdAt?: string;
  updatedAt?: string;
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
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
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
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
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

// 1. Public Transport Tracker Record
export interface PublicTransportRecord {
  id: string;
  approvalUrn: string; // Approval URN
  suNames: string; // Service User Name(s)
  portRefs: string; // Port Ref Number(s)
  accommodationAddress: string; // Accommodation Address
  appointmentDate: string; // Appointment Date
  appointmentTime: string; // Appointment Time
  appointmentLocation: string; // Appointment Location
  distanceMiles: number | string; // Distance (Miles)
  modeOfTransport: string; // Mode of Transport (e.g., Bus, Train, Tube, Taxi, Walking)
  exceptionalCircumstances: string; // Exceptional Circumstances
  status?: 'Approved' | 'Pending' | 'Completed' | 'Cancelled';
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  createdAt: string;
  updatedAt: string;
}

// 2. SD-Compliance Tracker Record
export interface SDComplianceRecord {
  id: string;
  srNo: number; // S NO.
  complianceType: string; // COMPLIANCE TYPE
  contractorName: string; // CONTRACTOR'S NAME
  contractorKeyContact: string; // CONTRACTOR KEY CONTACT
  contractorEmail: string; // CONTRACTOR E-MAIL ID
  issuedDate: string; // ISSUED DATE
  expiryDate: string; // EXPIRY DATE
  status: 'Compliant' | 'Expiring Soon' | 'Expired' | 'In Progress' | 'Overdue'; // STATUS
  actionTaken: string; // Action Taken
  previousContractor: string; // Previous Contractor
  siteName?: string; // Associated Hotel / Site
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  createdAt: string;
  updatedAt: string;
}

// 3. GP Appointments Record
export interface GPAppointmentRecord {
  id: string;
  roomNo: string; // Room No
  portReference: string; // Port Reference
  referralSentOn: string; // Referral sent on
  appointmentDate: string; // Appointment date
  timeOfGp: string; // Time of GP
  comments: string; // Comments
  status: 'Scheduled' | 'Attended' | 'Did Not Attend (DNA)' | 'Cancelled' | 'Rescheduled'; // Status
  siteName?: string;
  suName?: string;
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  createdAt: string;
  updatedAt: string;
}

// 4. RFA Welfare Checks Record
export interface RFAWelfareCheckRecord {
  id: string;
  date: string; // Date
  siteName: string; // Site Name
  roomOrFlatNo: string; // Room or Flat No
  name: string; // Name
  dob: string; // DOB
  group: string; // Group (Single Adult, Family, Pregnant Woman, Elderly, Young Adult, etc.)
  gender: string; // Gender
  portOrNassRef: string; // Port or Nass Ref
  vulnerability: string; // Vulnerability
  actionTaken: string; // Action Taken
  mhTicket: string; // MH ticket
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  createdAt: string;
  updatedAt: string;
}

// 5. Dispersal Sheet Record
export interface DispersalRecord {
  id: string;
  sno: number; // SNO
  siteName: string; // Site Name
  dateReceived: string; // Date Received(MM/DD/YYYY)
  suPortNassRef: string; // SU Port/Nass Reference
  reasonForDeparture: string; // Reason for the Departure
  flatRoomNumber: string; // Flat/Room Number
  dispersalDate: string; // Dispersal Date (MM/DD/YYYY)
  dateLetterHandedToSu: string; // Date Dispersal Letter handed to SU (MM/DD/YYYY)
  iaExitBriefingCompleted: 'Yes' | 'No'; // IA Exit Briefing completed and signed (Yes/No)
  hoDispersalLetterReceived: 'Yes' | 'No'; // Home Office Dispersal letter received by SU (Yes/No)
  travelled: 'Yes' | 'No'; // Travelled (Yes / No)
  dateLeftProperty: string; // Date left property (MM/DD/YYYY)
  incidentWarningCompleted: 'Yes' | 'No need' | 'No'; // Incident/Warning completed (Yes/No need)
  reasonFailedToTravel: string; // Reason for failed to travel
  // 2nd Dispersal Cycle
  secondDispersalDate: string; // 2nd Dispersal Date(MM/DD/YYYY)
  dateSecondLetterHanded: string; // Date Second Dispersal Letter handed to SU (MM/DD/YYYY)
  secondIaExitBriefingCompleted: 'Yes' | 'No'; // 2nd IA Exit Briefing completed and signed
  secondDispersalTravelled: 'Yes' | 'No'; // 2nd DispersalTravelled (Yes / No)
  secondDateLeftProperty: string; // 2nd Date left property (MM/DD/YYYY)
  secondIncidentWarningCompleted: 'Yes' | 'No need' | 'No'; // 2ndIncident/Warning completed (Yes /No need)
  reasonFailedToTravelSecond: string; // Reason for failed to travel 2nd Insistance
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  createdAt: string;
  updatedAt: string;
}

// 6. Booklets to be Collected Record
export interface BookletCollectionRecord {
  id: string;
  hotelName: string; // IA Hotel Name
  agentName: 'Ready Homes' | 'SD Commercial' | string;
  bookletType: 'Migrant Help booklets' | 'Right & Expectation booklets' | 'Living In IA' | string;
  language: string;
  numberForCollection: number; // Number of booklets for collection
  collectedBooklets: number; // Collected Booklets
  bookletsReceived: number; // Booklets received
  status?: 'Pending Collection' | 'Partially Collected' | 'Collected' | 'Received at Site';
  notes?: string;
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  lastUpdated: string;
}

// 7. SD VCS Support Agencies Record
export interface SDVCSAgency {
  id: string;
  hotelName: string; // Seven Kings, Parmiter St., Old St., etc.
  agencyName: string; // Organization Name
  category?: 'General Support' | 'Charity & Welfare' | 'Food & Nutrition' | 'ESOL & Education' | 'Family & Children' | 'Faith & Community' | 'Advocacy & Legal' | 'Statutory / Council';
  servicesProvided?: string;
  contactPerson?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  notes?: string;
  isVerified?: boolean;
  attachments?: RecordAttachment[];
  attachmentUrl?: string;
  attachment_url?: string;
  fileUrl?: string;
  file_url?: string;
  createdAt: string;
}

// 8. Centralized Email Notification Types & Rules
export type NotificationEventCode =
  | 'referral.created'
  | 'referral.urgent'
  | 'referral.status_changed'
  | 'vulnerable.created'
  | 'challenging.critical'
  | 'escalation.created'
  | 'escalation.critical'
  | 'compliance.created'
  | 'compliance.expiring_soon'
  | 'compliance.expired'
  | 'maintenance.created'
  | 'maintenance.cat1_emergency'
  | 'maintenance.completed'
  | 'transport.created'
  | 'transport.exceptional_circumstance'
  | 'gp.created'
  | 'gp.dna_missed'
  | 'welfare.created'
  | 'welfare.mental_health_ticket'
  | 'dispersal.created'
  | 'dispersal.failed_to_travel'
  | 'laundry.variance_flagged'
  | 'food.temp_breach'
  | 'change_request.created'
  | 'change_request.reviewed'
  | 'user.created'
  | 'user.role_changed';

export type NotificationModule =
  | 'Safeguarding'
  | 'Compliance'
  | 'Maintenance'
  | 'Transport'
  | 'Health & Welfare'
  | 'Operations'
  | 'Governance';

export type NotificationSeverityThreshold = 'All' | 'Low' | 'Medium' | 'High' | 'Critical';

export interface NotificationRule {
  id: string;
  eventCode: NotificationEventCode;
  module: NotificationModule;
  title: string;
  description: string;
  enabled: boolean;
  minSeverity: NotificationSeverityThreshold;
  recipientRoles: RoleType[];
  customRecipients: string[];
  customCc: string[];
  subjectTemplate: string;
  includeMetadata: boolean;
  lastDispatchedAt?: string | null;
  dispatchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotificationLog {
  id: string;
  ruleId?: string | null;
  eventCode: NotificationEventCode | string;
  module: NotificationModule | string;
  subject: string;
  recipients: string[];
  site?: string;
  status: 'delivered' | 'simulated' | 'failed';
  errorMessage?: string;
  dispatchedAt: string;
  entityId?: string;
  payloadSummary?: string;
}
