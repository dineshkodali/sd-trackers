import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  RoleType, 
  SiteInfo, 
  PropertyInfo,
  RolePermissions,
  SGReferral, 
  VulnerableSU, 
  ChallengingSU, 
  LaundryRecord, 
  PropertyLaundryLog,
  PropertyFoodVendorBuffetLog,
  FoodVendorName,
  FoodRecord, 
  EscalationRecord, 
  DocumentRecord, 
  AuditLog, 
  UserAccount, 
  UserGroup,
  AppSettings,
  MaintenanceRecord,
  SPCDRecord,
  DataChangeRequest,
  CustomFieldOption,
  FieldOptionCategory,
  AuthUser,
  PublicTransportRecord,
  SDComplianceRecord,
  GPAppointmentRecord,
  RFAWelfareCheckRecord,
  DispersalRecord,
  BookletCollectionRecord,
  SDVCSAgency,
  NotificationEventCode,
  NotificationRule,
  EmailNotificationLog
} from '../types';
import { 
  INITIAL_SITES, 
  INITIAL_REFERRALS, 
  INITIAL_VULNERABLE, 
  INITIAL_CHALLENGING, 
  INITIAL_LAUNDRY, 
  INITIAL_FOOD, 
  INITIAL_ESCALATIONS, 
  INITIAL_DOCUMENTS, 
  INITIAL_USERS, 
  INITIAL_AUDIT, 
  INITIAL_SETTINGS,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_MAINTENANCE_RECORDS,
  INITIAL_SPCD_RECORDS,
  INITIAL_CHANGE_REQUESTS,
  INITIAL_USER_GROUPS,
  INITIAL_PUBLIC_TRANSPORT_RECORDS,
  INITIAL_COMPLIANCE_RECORDS,
  INITIAL_GP_APPOINTMENT_RECORDS,
  INITIAL_RFA_WELFARE_RECORDS,
  INITIAL_DISPERSAL_RECORDS,
  INITIAL_BOOKLET_RECORDS,
  INITIAL_VCS_AGENCIES
} from '../data/initialData';
import { 
  INITIAL_PROPERTY_LAUNDRY_LOGS, 
  INITIAL_FOOD_VENDOR_BUFFET_LOGS, 
  FOOD_VENDORS 
} from '../data/commercialCateringLaundryData';
import { DEFAULT_FIELD_OPTIONS } from '../data/defaultFieldOptions';
import { DEFAULT_NOTIFICATION_RULES } from '../data/defaultNotificationRules';
import { emailNotificationService } from '../services/emailNotificationService';
import { smartCache, fastIndices, SmartCacheStats } from '../utils/smartCache';
import { apiService } from '../services/apiService';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { diagnosticLogger, parseJwtPayload } from '../utils/diagnosticLogger';
import { AuthBlockedInfo } from '../components/auth/AuthenticationBlockedView';

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  itemDetails?: { label: string; value: string }[];
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'urgent' | 'info' | 'sync' | 'success';
  read: boolean;
  linkPage?: string;
}

export interface BatchRetentionModuleStat {
  id: string;
  name: string;
  dateFieldLabel: string;
  totalOlder: number;
  activeOlder: number;
  archivedOlder: number;
  supportsArchive: boolean;
}

export interface BatchRetentionExecutionResult {
  totalAffected: number;
  action: 'archive' | 'delete';
  cutoffDate: string;
  moduleCounts: Record<string, number>;
}

interface AppContextType {
  // Authentication & Tokenized Session
  sessionToken: string | null;
  authProfile: AuthUser | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  authLoading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isPasswordRecoveryMode: boolean;
  setIsPasswordRecoveryMode: (open: boolean) => void;
  recoveryAccessToken: string | null;
  recoveryEmail: string | null;

  // Auth Blocked & Diagnostic Inspector State
  authBlockedState: AuthBlockedInfo | null;
  clearAuthBlockedState: () => void;
  diagnosticModalOpen: boolean;
  setDiagnosticModalOpen: (open: boolean) => void;

  // Active User / Role State
  currentUserRole: RoleType;
  setCurrentUserRole: (role: RoleType) => void;
  currentUserName: string;
  assignedSite: string; // for Site Manager and Staff
  setAssignedSite: (site: string) => void;
  
  // Selected Filter Site
  selectedSite: string;
  setSelectedSite: (site: string) => void;
  allowedSites: string[];

  // App Settings
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // Active View Navigation
  activePage: string;
  setActivePage: (page: string) => void;
  globalSearchFilter: string;
  setGlobalSearchFilter: (query: string) => void;
  navigateToPageWithSearch: (page: string, searchFilter?: string) => void;

  // Confirmation Modal
  confirmModal: ConfirmationRequest | null;
  requestConfirmation: (req: ConfirmationRequest) => void;
  closeConfirmation: () => void;

  // Notifications
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Fast Loading State
  isFastCacheActive: boolean;
  lastOperationDurationMs: number;

  // Data Collections
  sites: SiteInfo[];
  referrals: SGReferral[];
  vulnerableSUs: VulnerableSU[];
  challengingSUs: ChallengingSU[];
  laundryRecords: LaundryRecord[];
  foodRecords: FoodRecord[];
  escalations: EscalationRecord[];
  documents: DocumentRecord[];
  users: UserAccount[];
  userGroups: UserGroup[];
  addUserGroup: (group: Omit<UserGroup, 'id'>) => void;
  updateUserGroup: (id: string, updates: Partial<UserGroup>) => void;
  deleteUserGroup: (id: string) => void;
  auditLogs: AuditLog[];
  dataChangeRequests: DataChangeRequest[];
  addDataChangeRequest: (req: Omit<DataChangeRequest, 'id' | 'createdAt' | 'status'>) => void;
  reviewDataChangeRequest: (id: string, decision: 'Approved' | 'Rejected', reviewNotes: string) => void;

  // RBAC Role Permissions
  rolePermissions: Record<RoleType, RolePermissions>;
  updateRolePermissions: (role: RoleType, perms: Partial<RolePermissions>) => void;
  resetRolePermissions: () => void;

  // Permissions helper
  canDeleteRecord: () => boolean;
  canEditRecord: (recordSite?: string) => boolean;
  canCreateRecord: () => boolean;
  canManageSettings: () => boolean;
  canManageRoles: () => boolean;
  canAccessAllSites: () => boolean;
  canManageFiles: () => boolean;
  canManageProperties: () => boolean;
  canManageUsers: () => boolean;

  // CRUD for Referrals
  addReferral: (referral: Omit<SGReferral, 'id' | 'srNo' | 'createdAt' | 'updatedAt' | 'lastUpdatedBy'>) => void;
  updateReferral: (id: string, updates: Partial<SGReferral>) => void;
  archiveReferral: (id: string) => void;
  restoreReferral: (id: string) => void;
  deleteReferral: (id: string) => void;

  // CRUD for Vulnerable SUs
  addVulnerableSU: (su: Omit<VulnerableSU, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateVulnerableSU: (id: string, updates: Partial<VulnerableSU>) => void;
  archiveVulnerableSU: (id: string) => void;
  restoreVulnerableSU: (id: string) => void;
  deleteVulnerableSU: (id: string) => void;

  // CRUD for Challenging SUs
  addChallengingSU: (su: Omit<ChallengingSU, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateChallengingSU: (id: string, updates: Partial<ChallengingSU>) => void;
  archiveChallengingSU: (id: string) => void;
  restoreChallengingSU: (id: string) => void;
  deleteChallengingSU: (id: string) => void;

  // CRUD for Laundry
  propertyLaundryLogs: PropertyLaundryLog[];
  addLaundryRecord: (record: Omit<LaundryRecord, 'id' | 'createdAt'>) => void;
  updateLaundryRecord: (id: string, updates: Partial<LaundryRecord>) => void;
  deleteLaundryRecord: (id: string) => void;
  addPropertyLaundryLog: (log: Omit<PropertyLaundryLog, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePropertyLaundryLog: (id: string, updates: Partial<PropertyLaundryLog>) => void;
  deletePropertyLaundryLog: (id: string) => void;

  // CRUD for Hot Food & Food Vendors
  foodVendorBuffetLogs: PropertyFoodVendorBuffetLog[];
  foodVendorsList: FoodVendorName[];
  addFoodRecord: (record: Omit<FoodRecord, 'id' | 'createdAt'>) => void;
  updateFoodRecord: (id: string, updates: Partial<FoodRecord>) => void;
  deleteFoodRecord: (id: string) => void;
  addFoodVendorBuffetLog: (log: Omit<PropertyFoodVendorBuffetLog, 'id' | 'updatedAt'>) => void;
  updateFoodVendorBuffetLog: (id: string, updates: Partial<PropertyFoodVendorBuffetLog>) => void;
  deleteFoodVendorBuffetLog: (id: string) => void;

  // CRUD for Escalations
  addEscalation: (rec: Omit<EscalationRecord, 'id' | 'createdAt'>) => void;
  updateEscalation: (id: string, updates: Partial<EscalationRecord>) => void;
  deleteEscalation: (id: string) => void;

  // CRUD for Documents
  addDocument: (doc: Omit<DocumentRecord, 'id'>) => void;
  deleteDocument: (id: string) => void;

  // CRUD for Maintenance Tracker
  maintenanceRecords: MaintenanceRecord[];
  addMaintenanceRecord: (record: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => void;
  updateMaintenanceRecord: (id: string, updates: Partial<MaintenanceRecord>) => void;
  deleteMaintenanceRecord: (id: string) => void;

  // CRUD for SPCD Tracker
  spcdRecords: SPCDRecord[];
  addSPCDRecord: (record: Omit<SPCDRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSPCDRecord: (id: string, updates: Partial<SPCDRecord>) => void;
  archiveSPCDRecord: (id: string, dateLeft?: string, reason?: string) => void;
  restoreSPCDRecord: (id: string) => void;
  deleteSPCDRecord: (id: string) => void;

  // 1. CRUD for Public Transport Tracker
  publicTransportRecords: PublicTransportRecord[];
  addPublicTransportRecord: (record: Omit<PublicTransportRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePublicTransportRecord: (id: string, updates: Partial<PublicTransportRecord>) => void;
  deletePublicTransportRecord: (id: string) => void;

  // 2. CRUD for SD-Compliance Tracker
  complianceRecords: SDComplianceRecord[];
  addComplianceRecord: (record: Omit<SDComplianceRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateComplianceRecord: (id: string, updates: Partial<SDComplianceRecord>) => void;
  deleteComplianceRecord: (id: string) => void;

  // 3. CRUD for GP Appointments
  gpAppointmentRecords: GPAppointmentRecord[];
  addGPAppointmentRecord: (record: Omit<GPAppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGPAppointmentRecord: (id: string, updates: Partial<GPAppointmentRecord>) => void;
  deleteGPAppointmentRecord: (id: string) => void;

  // 4. CRUD for RFA Welfare Checks
  rfaWelfareRecords: RFAWelfareCheckRecord[];
  addRFAWelfareRecord: (record: Omit<RFAWelfareCheckRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRFAWelfareRecord: (id: string, updates: Partial<RFAWelfareCheckRecord>) => void;
  deleteRFAWelfareRecord: (id: string) => void;

  // 5. CRUD for Dispersal Sheet
  dispersalRecords: DispersalRecord[];
  addDispersalRecord: (record: Omit<DispersalRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDispersalRecord: (id: string, updates: Partial<DispersalRecord>) => void;
  deleteDispersalRecord: (id: string) => void;

  // 6. CRUD for Booklets to be Collected
  bookletRecords: BookletCollectionRecord[];
  addBookletRecord: (record: Omit<BookletCollectionRecord, 'id'>) => void;
  updateBookletRecord: (id: string, updates: Partial<BookletCollectionRecord>) => void;
  deleteBookletRecord: (id: string) => void;
  resetBookletsToDefault: () => void;

  // 7. CRUD for SD VCS Support Agencies
  vcsAgencies: SDVCSAgency[];
  addVCSAgency: (agency: Omit<SDVCSAgency, 'id' | 'createdAt'>) => void;
  updateVCSAgency: (id: string, updates: Partial<SDVCSAgency>) => void;
  deleteVCSAgency: (id: string) => void;
  resetVCSToDefault: () => void;

  // CRUD for Properties (Sites) & Users
  properties: PropertyInfo[];
  addProperty: (prop: Omit<PropertyInfo, 'id'>) => void;
  updateProperty: (id: string, updates: Partial<PropertyInfo>) => void;
  deleteProperty: (id: string) => void;
  addSite: (site: Omit<SiteInfo, 'id'>) => void;
  updateSite: (id: string, updates: Partial<SiteInfo>) => void;
  deleteSite: (id: string) => void;
  addUser: (user: Omit<UserAccount, 'id' | 'lastActive'>) => void;
  updateUser: (id: string, updates: Partial<UserAccount>) => void;
  deleteUser: (id: string) => void;

  // Dynamic Master Setup & Field Options Manager
  fieldOptions: CustomFieldOption[];
  getFieldOptions: (category: FieldOptionCategory, includeInactive?: boolean) => CustomFieldOption[];
  addFieldOption: (option: Omit<CustomFieldOption, 'id' | 'order'>) => CustomFieldOption;
  updateFieldOption: (id: string, updates: Partial<CustomFieldOption>) => void;
  deleteFieldOption: (id: string) => void;
  toggleFieldOptionStatus: (id: string) => void;
  reorderFieldOption: (id: string, direction: 'up' | 'down') => void;
  resetFieldOptionsCategory: (category?: FieldOptionCategory) => void;

  // System actions
  syncSharePointNow: () => void;
  resetAllData: () => void;
  resetPropertiesToDefault: () => void;
  restoreBackup: (jsonData: string) => boolean;

  // Smart Cache Layer & Fast Lookup Indices
  cacheStats: SmartCacheStats;
  triggerBackgroundDeltaSync: () => Promise<void>;
  lookupPropertyById: (id: string) => PropertyInfo | undefined;
  lookupPropertyByName: (name: string) => PropertyInfo | undefined;
  lookupUserById: (id: string) => UserAccount | undefined;
  lookupUserByEmail: (email: string) => UserAccount | undefined;
  lookupUsersByRole: (role: RoleType) => UserAccount[];

  // Live Database Synchronization Engine
  syncFromDatabase: () => Promise<void>;

  // Data Retention & Batch Performance Maintenance
  getBatchRetentionStats: (cutoffDate: string) => BatchRetentionModuleStat[];
  batchArchiveRecordsOlderThan: (targetModule: string, cutoffDate: string) => BatchRetentionExecutionResult;
  batchDeleteRecordsOlderThan: (targetModule: string, cutoffDate: string, onlyArchived?: boolean) => BatchRetentionExecutionResult;

  // Session Lock & Auto-Logout
  isSessionLocked: boolean;
  sessionLockReason: string;
  lockSession: (reason?: string) => void;
  unlockSession: () => void;
  remainingInactivitySeconds: number;
  resetInactivityTimer: () => void;

  // 8. Centralized Email Notifications Management
  notificationRules: NotificationRule[];
  emailNotificationLogs: EmailNotificationLog[];
  updateNotificationRule: (id: string, updates: Partial<NotificationRule>) => Promise<void>;
  toggleNotificationRule: (id: string) => Promise<void>;
  resetNotificationRules: () => Promise<void>;
  triggerEmailNotification: (
    eventCode: NotificationEventCode | string,
    payload: Record<string, any>,
    options?: {
      site?: string;
      severity?: 'Low' | 'Medium' | 'High' | 'Critical';
      entityId?: string;
      targetRecipients?: string[];
    }
  ) => Promise<void>;
  refreshNotificationData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'sg_tracker_';
const FRESH_DATA_VERSION = 'v2_clean_fresh_production';

function checkAndInitializeCleanState() {
  try {
    const currentVer = localStorage.getItem(STORAGE_KEY_PREFIX + 'data_version');
    if (currentVer !== FRESH_DATA_VERSION) {
      const mockKeys = [
        'referrals',
        'vulnerable',
        'challenging',
        'laundry',
        'food',
        'escalations',
        'documents',
        'maintenance',
        'spcd',
        'data_change_requests',
        'audit',
        'notifications'
      ];
      mockKeys.forEach(k => localStorage.removeItem(STORAGE_KEY_PREFIX + k));
      localStorage.setItem(STORAGE_KEY_PREFIX + 'data_version', FRESH_DATA_VERSION);
    }
  } catch {
    // ignore
  }
}

checkAndInitializeCleanState();

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

const LEGACY_HOTEL_MAP: Record<string, string> = {
  'Hotel A': 'Brit Hotel',
  'Hotel B': 'Leigham Court Hotel',
  'Hotel C': 'Maida Vale Aparthotel',
  'Hotel D': 'Clapham South Dudley Hotel'
};

function deduplicateSites(rawSites: SiteInfo[]): SiteInfo[] {
  if (!Array.isArray(rawSites) || rawSites.length === 0) return INITIAL_SITES;
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const result: SiteInfo[] = [];

  for (const site of rawSites) {
    if (!site || !site.name) continue;
    const normName = String(site.name).toLowerCase().trim();
    const normId = site.id ? String(site.id).toLowerCase().trim() : '';
    if (seenNames.has(normName) || (normId && seenIds.has(normId))) {
      continue;
    }
    seenNames.add(normName);
    if (normId) seenIds.add(normId);
    result.push(site);
  }
  return result.length > 0 ? result : INITIAL_SITES;
}

function migrateLegacySites(): SiteInfo[] {
  const stored = loadStorage<SiteInfo[] | null>('sites', null);
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    saveStorage('sites', INITIAL_SITES);
    return INITIAL_SITES;
  }
  const hasLegacyName = stored.some(s => s && (s.name === 'Hotel A' || s.name === 'Hotel B' || s.name === 'Hotel C' || s.name === 'Hotel D'));
  const hasBritHotel = stored.some(s => s && s.name === 'Brit Hotel');
  const hasMissingPids = stored.some(s => s && (!s.pid || s.pid === '') && s.name !== 'Burrows Court');
  
  if (hasLegacyName || !hasBritHotel || hasMissingPids || stored.length < 16) {
    // Merge custom properties while ensuring all 16 official hotels are present
    const customSites = stored.filter(s => 
      s && s.name &&
      !s.name.startsWith('Hotel ') && 
      !INITIAL_SITES.some(init => init && init.name && init.name.toLowerCase() === s.name.toLowerCase())
    );
    const updated = deduplicateSites([...INITIAL_SITES, ...customSites]);
    saveStorage('sites', updated);
    return updated;
  }
  return deduplicateSites(stored);
}

function getInitialAssignedSite(): string {
  const stored: string = String(loadStorage('assigned_site', 'Brit Hotel' as string));
  if (stored === 'Hotel A' || stored === 'Hotel B' || stored === 'Hotel C' || stored === 'Hotel D') {
    saveStorage('assigned_site', 'Brit Hotel');
    return 'Brit Hotel';
  }
  return stored;
}

function migrateEntitySites<T extends { site?: string; siteName?: string; assignedSites?: string[] }>(key: string, fallback: T[]): T[] {
  const raw = loadStorage<T[]>(key, fallback);
  if (!Array.isArray(raw)) return fallback;
  let changed = false;
  const migrated = raw.map(item => {
    let newItem = { ...item };
    if (newItem.site && LEGACY_HOTEL_MAP[newItem.site]) {
      newItem.site = LEGACY_HOTEL_MAP[newItem.site];
      changed = true;
    }
    if (newItem.siteName && LEGACY_HOTEL_MAP[newItem.siteName]) {
      newItem.siteName = LEGACY_HOTEL_MAP[newItem.siteName];
      changed = true;
    }
    if (newItem.assignedSites && Array.isArray(newItem.assignedSites)) {
      const newAssigned = newItem.assignedSites.map(s => LEGACY_HOTEL_MAP[s] || s);
      if (JSON.stringify(newAssigned) !== JSON.stringify(newItem.assignedSites)) {
        newItem.assignedSites = newAssigned;
        changed = true;
      }
    }
    return newItem;
  });
  if (changed) {
    saveStorage(key, migrated);
  }
  return migrated;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication & Tokenized Session State
  const [sessionToken, setSessionTokenState] = useState<string | null>(() => loadStorage<string | null>('token', null));
  const [authProfile, setAuthProfileState] = useState<AuthUser | null>(() => loadStorage<AuthUser | null>('auth_user', null));
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => !!sessionToken);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBlockedState, setAuthBlockedState] = useState<AuthBlockedInfo | null>(null);
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState<boolean>(false);
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState<boolean>(false);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);

  const clearAuthBlockedState = useCallback(() => {
    setAuthBlockedState(null);
  }, []);

  const [currentUserRole, setCurrentUserRoleState] = useState<RoleType>(() => {
    const savedUser = loadStorage<AuthUser | null>('auth_user', null);
    if (savedUser?.role) return savedUser.role;
    return loadStorage('role', 'Super Admin');
  });
  const [assignedSite, setAssignedSiteState] = useState<string>(() => {
    const savedUser = loadStorage<AuthUser | null>('auth_user', null);
    if (savedUser?.assignedSite && savedUser.assignedSite !== 'All Sites') {
      return savedUser.assignedSite;
    }
    return getInitialAssignedSite();
  });
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [globalSearchFilter, setGlobalSearchFilter] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [settings, setSettings] = useState<AppSettings>(() => loadStorage('settings', INITIAL_SETTINGS));
  const [lastOperationDurationMs, setLastOperationDurationMs] = useState<number>(8);
  const [confirmModal, setConfirmModal] = useState<ConfirmationRequest | null>(null);

  // Entities
  const [sites, setSites] = useState<SiteInfo[]>(() => {
    const cached = smartCache.getPropertiesInstant();
    const list = cached.data && cached.data.length > 0 ? cached.data : migrateLegacySites();
    return deduplicateSites(list);
  });
  const [referrals, setReferrals] = useState<SGReferral[]>(() => migrateEntitySites('referrals', INITIAL_REFERRALS));
  const [vulnerableSUs, setVulnerableSUs] = useState<VulnerableSU[]>(() => migrateEntitySites('vulnerable', INITIAL_VULNERABLE));
  const [challengingSUs, setChallengingSUs] = useState<ChallengingSU[]>(() => migrateEntitySites('challenging', INITIAL_CHALLENGING));
  const [laundryRecords, setLaundryRecords] = useState<LaundryRecord[]>(() => migrateEntitySites('laundry', INITIAL_LAUNDRY));
  const [propertyLaundryLogs, setPropertyLaundryLogs] = useState<PropertyLaundryLog[]>(() => 
    migrateEntitySites('property_laundry_logs', INITIAL_PROPERTY_LAUNDRY_LOGS)
  );
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>(() => migrateEntitySites('food', INITIAL_FOOD));
  const [foodVendorBuffetLogs, setFoodVendorBuffetLogs] = useState<PropertyFoodVendorBuffetLog[]>(() => 
    migrateEntitySites('food_vendor_buffet_logs', INITIAL_FOOD_VENDOR_BUFFET_LOGS)
  );
  const foodVendorsList = FOOD_VENDORS;
  const [escalations, setEscalations] = useState<EscalationRecord[]>(() => migrateEntitySites('escalations', INITIAL_ESCALATIONS));
  const [documents, setDocuments] = useState<DocumentRecord[]>(() => migrateEntitySites('documents', INITIAL_DOCUMENTS));
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() => 
    migrateEntitySites('maintenance', INITIAL_MAINTENANCE_RECORDS)
  );
  const [spcdRecords, setSpcdRecords] = useState<SPCDRecord[]>(() => 
    migrateEntitySites('spcd', INITIAL_SPCD_RECORDS)
  );
  const [publicTransportRecords, setPublicTransportRecords] = useState<PublicTransportRecord[]>(() => 
    loadStorage('public_transport_records', INITIAL_PUBLIC_TRANSPORT_RECORDS)
  );
  const [complianceRecords, setComplianceRecords] = useState<SDComplianceRecord[]>(() => 
    loadStorage('compliance_records', INITIAL_COMPLIANCE_RECORDS)
  );
  const [gpAppointmentRecords, setGpAppointmentRecords] = useState<GPAppointmentRecord[]>(() => 
    loadStorage('gp_appointment_records', INITIAL_GP_APPOINTMENT_RECORDS)
  );
  const [rfaWelfareRecords, setRfaWelfareRecords] = useState<RFAWelfareCheckRecord[]>(() => 
    loadStorage('rfa_welfare_records', INITIAL_RFA_WELFARE_RECORDS)
  );
  const [dispersalRecords, setDispersalRecords] = useState<DispersalRecord[]>(() => 
    loadStorage('dispersal_records', INITIAL_DISPERSAL_RECORDS)
  );
  const [bookletRecords, setBookletRecords] = useState<BookletCollectionRecord[]>(() => 
    loadStorage('booklet_records', INITIAL_BOOKLET_RECORDS)
  );
  const [vcsAgencies, setVcsAgencies] = useState<SDVCSAgency[]>(() => 
    loadStorage('vcs_agencies', INITIAL_VCS_AGENCIES)
  );
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>(() => 
    loadStorage('notification_rules', DEFAULT_NOTIFICATION_RULES)
  );
  const [emailNotificationLogs, setEmailNotificationLogs] = useState<EmailNotificationLog[]>(() => 
    loadStorage('email_notification_logs', [])
  );
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const cached = smartCache.getUsersInstant();
    if (cached.data && cached.data.length > 0) {
      return cached.data;
    }
    return migrateEntitySites('users', INITIAL_USERS);
  });
  const [userGroups, setUserGroups] = useState<UserGroup[]>(() => 
    loadStorage('user_groups', INITIAL_USER_GROUPS)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => migrateEntitySites('audit', INITIAL_AUDIT));
  const [dataChangeRequests, setDataChangeRequests] = useState<DataChangeRequest[]>(() => 
    loadStorage('data_change_requests', INITIAL_CHANGE_REQUESTS)
  );

  const [rolePermissions, setRolePermissions] = useState<Record<RoleType, RolePermissions>>(() => 
    loadStorage('role_permissions', INITIAL_ROLE_PERMISSIONS)
  );

  const [fieldOptions, setFieldOptions] = useState<CustomFieldOption[]>(() => {
    const stored = loadStorage<CustomFieldOption[]>('field_options', DEFAULT_FIELD_OPTIONS);
    if (!Array.isArray(stored)) return DEFAULT_FIELD_OPTIONS;
    const storedCategories = new Set(stored.map(o => o.category));
    const missingDefaults = DEFAULT_FIELD_OPTIONS.filter(o => !storedCategories.has(o.category));
    if (missingDefaults.length > 0) {
      const merged = [...stored, ...missingDefaults];
      saveStorage('field_options', merged);
      return merged;
    }
    return stored;
  });

  const [cacheStats, setCacheStats] = useState<SmartCacheStats>(() => smartCache.getStats());

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 'notif-1', title: 'System Initialized', description: 'Fresh operational database initialized. Ready for live data entry.', time: 'Just now', type: 'info', read: false, linkPage: 'dashboard' }
  ]);

  const currentUserName = useMemo(() => {
    if (authProfile?.name && authProfile.name.trim() !== '') return authProfile.name;
    if (authProfile?.email) return authProfile.email.split('@')[0];
    const userEmail = (authProfile?.email || '').toLowerCase();
    const found = userEmail ? users.find(u => u && u.email && typeof u.email === 'string' && u.email.toLowerCase() === userEmail) : null;
    if (found) return found.name;
    return 'Staff Member';
  }, [authProfile, users]);

  // Synchronize active user context with centralized audit middleware
  useEffect(() => {
    apiService.setAuditUserContext({
      userId: authProfile?.id,
      userEmail: authProfile?.email,
      userName: authProfile?.name || authProfile?.email,
      role: currentUserRole || authProfile?.role || 'Staff',
      site: assignedSite || authProfile?.assignedSite || 'All Sites',
      token: sessionToken
    });
  }, [authProfile, currentUserRole, assignedSite, sessionToken]);

  // Logger helper: dispatches to client state and centralized audit_trails database table
  const addAuditEntry = useCallback((
    action: AuditLog['action'], 
    module: AuditLog['module'], 
    targetItem: string, 
    site: string, 
    details: string,
    performedByOverride?: string
  ) => {
    const start = performance.now();
    const performedUserName = performedByOverride || (authProfile?.name || authProfile?.email || currentUserName || 'Authenticated Staff');
    const newEntry: AuditLog = {
      id: 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      action,
      module,
      targetItem,
      performedByRole: currentUserRole,
      performedByUser: performedUserName,
      site,
      details
    };
    setAuditLogs(prev => [newEntry, ...prev.slice(0, 499)]);

    // Persist into both audit logs and audit_trails with caller UID
    apiService.saveEntityRecord('audit', newEntry).catch(err => console.warn('Audit DB save notice:', err));
    apiService.recordAuditTrail({
      id: newEntry.id,
      timestamp: newEntry.timestamp,
      user: performedUserName,
      userId: authProfile?.id,
      role: currentUserRole,
      action: action as any,
      details,
      site,
      entityType: module,
      entityId: targetItem,
      createdBy: authProfile?.id
    }).catch(err => console.warn('Centralized audit_trails persist notice:', err));

    const duration = Math.max(1, Math.round(performance.now() - start));
    setLastOperationDurationMs(duration);
  }, [currentUserRole, users, authProfile, currentUserName]);

  // --- Centralized Email Notifications Engine ---
  const updateNotificationRule = useCallback(async (id: string, updates: Partial<NotificationRule>) => {
    setNotificationRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
      saveStorage('notification_rules', next);
      return next;
    });
    await emailNotificationService.updateRule(id, updates);
    addAuditEntry('SETTINGS_UPDATE', 'Settings', `Notification Rule #${id}`, 'All Sites', `Updated email notification configuration for ${id}.`);
  }, [addAuditEntry]);

  const toggleNotificationRule = useCallback(async (id: string) => {
    const current = notificationRules.find(r => r.id === id);
    if (current) {
      await updateNotificationRule(id, { enabled: !current.enabled });
    }
  }, [notificationRules, updateNotificationRule]);

  const resetNotificationRules = useCallback(async () => {
    setNotificationRules(DEFAULT_NOTIFICATION_RULES);
    saveStorage('notification_rules', DEFAULT_NOTIFICATION_RULES);
    await emailNotificationService.resetRules();
    addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Reset Notification Rules', 'All Sites', 'Reset all notification rules to system defaults.');
  }, [addAuditEntry]);

  const triggerEmailNotification = useCallback(async (
    eventCode: NotificationEventCode | string,
    payload: Record<string, any>,
    options?: {
      site?: string;
      severity?: 'Low' | 'Medium' | 'High' | 'Critical';
      entityId?: string;
      targetRecipients?: string[];
    }
  ) => {
    try {
      const res = await emailNotificationService.triggerNotification(eventCode, payload, options);
      if (res.success && res.delivered) {
        console.log(`[Email Notification Dispatched] Event: ${eventCode}, Recipients:`, res.recipients);
      } else if (res.simulated) {
        console.log(`[Email Notification Simulated] Event: ${eventCode}, Recipients:`, res.recipients);
      }
      const updatedLogs = await emailNotificationService.getLogs();
      if (updatedLogs && updatedLogs.length > 0) {
        setEmailNotificationLogs(updatedLogs);
        saveStorage('email_notification_logs', updatedLogs);
      }
    } catch (err) {
      console.warn('Failed to trigger email notification:', err);
    }
  }, []);

  const refreshNotificationData = useCallback(async () => {
    try {
      const rules = await emailNotificationService.getRules();
      const logs = await emailNotificationService.getLogs();
      if (rules && rules.length > 0) {
        setNotificationRules(rules);
        saveStorage('notification_rules', rules);
      }
      if (logs) {
        setEmailNotificationLogs(logs);
        saveStorage('email_notification_logs', logs);
      }
    } catch (err) {
      console.warn('Could not refresh notification data:', err);
    }
  }, []);

  useEffect(() => {
    refreshNotificationData();
  }, [refreshNotificationData]);

  // Session verification on mount or token update with diagnostic logging & blocked state detection
  useEffect(() => {
    if (sessionToken) {
      setIsAuthChecking(true);
      diagnosticLogger.logSessionStatus('checking', 'Verifying Supabase cryptographic session and inspecting token claims...');

      // 1. Proactive Token Inspection
      const tokenInfo = parseJwtPayload(sessionToken);
      diagnosticLogger.logTokenExpiration(sessionToken, 'AppProvider Mount Check');

      if (tokenInfo.isExpired) {
        diagnosticLogger.logSessionStatus('expired', `Session token is expired: ${tokenInfo.statusDescription}`);
        setAuthBlockedState({
          isBlocked: true,
          reason: 'session_invalidated',
          title: 'Cryptographic Session Expired',
          message: 'Your Supabase authentication token has exceeded its validity window. For Home Office data protection compliance, your active session was suspended.',
          details: tokenInfo.statusDescription,
          userEmail: authProfile?.email,
          userId: authProfile?.id,
          userRole: currentUserRole,
          timestamp: new Date().toISOString(),
          actionRequired: 'Please return to the sign-in screen to authenticate and generate a fresh session token.'
        });
        setSessionTokenState(null);
        setAuthProfileState(null);
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'token');
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth_user');
        setIsAuthChecking(false);
        return;
      }

      // 2. Query Supabase session status & retrieve database profile
      apiService.verifySession(sessionToken).then(res => {
        if (res.success && res.user) {
          const profileStatus = (res.user as any).status || 'Active';

          // Validate operational clearance
          if (profileStatus === 'Inactive' || profileStatus === 'Suspended') {
            diagnosticLogger.logPermissionCheck({
              role: res.user.role,
              status: profileStatus,
              passed: false,
              reason: `Account status is ${profileStatus}`
            });
            setAuthBlockedState({
              isBlocked: true,
              reason: 'missing_permissions',
              title: 'Access Clearance Blocked',
              message: `Your staff account (${res.user.email}) is currently designated as "${profileStatus}" in the Supabase database.`,
              details: 'Account profile status must be Active to access accommodation and safeguarding modules.',
              userEmail: res.user.email,
              userId: res.user.id,
              userRole: res.user.role,
              timestamp: new Date().toISOString(),
              actionRequired: 'Contact a Super Admin or Regional Director to activate your staff profile and assign property clearance.'
            });
            setSessionTokenState(null);
            setAuthProfileState(null);
            localStorage.removeItem(STORAGE_KEY_PREFIX + 'token');
            localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth_user');
            return;
          }

          diagnosticLogger.logPermissionCheck({
            role: res.user.role,
            status: profileStatus,
            passed: true
          });

          const authUser: AuthUser = {
            id: res.user.id,
            email: res.user.email,
            name: res.user.name,
            role: res.user.role as RoleType,
            assignedSite: res.user.assignedSite || 'All Sites'
          };
          setAuthBlockedState(null);
          setAuthProfileState(authUser);
          setCurrentUserRoleState(authUser.role);
          if (authUser.assignedSite && authUser.assignedSite !== 'All Sites') {
            setAssignedSiteState(authUser.assignedSite);
          }
        } else if (res.error) {
          console.warn('Session verification error, setting blocked state:', res.error);
          const errStr = String(res.error || '').toLowerCase();
          const isInvalidated = errStr.includes('expired') || errStr.includes('invalid');
          setAuthBlockedState({
            isBlocked: true,
            reason: isInvalidated ? 'session_invalidated' : 'missing_permissions',
            title: isInvalidated ? 'Session Invalidation Detected' : 'Authentication Verification Failed',
            message: res.error,
            details: 'Supabase authorization token rejected or session revoked.',
            userEmail: authProfile?.email,
            userId: authProfile?.id,
            userRole: currentUserRole,
            timestamp: new Date().toISOString(),
            actionRequired: 'Please re-authenticate with your credentials to establish a secure session.'
          });
          setSessionTokenState(null);
          setAuthProfileState(null);
          localStorage.removeItem(STORAGE_KEY_PREFIX + 'token');
          localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth_user');
        }
      }).catch(err => {
        console.warn('Session verification network error:', err);
      }).finally(() => {
        setIsAuthChecking(false);
      });
    } else {
      setIsAuthChecking(false);
    }
  }, [sessionToken]);

  // Periodic Token Expiration Watcher (checks every 25 seconds)
  useEffect(() => {
    if (!sessionToken) return;

    const intervalId = setInterval(() => {
      const parsed = parseJwtPayload(sessionToken);
      if (parsed.isExpired) {
        diagnosticLogger.logSessionStatus('expired', `Token expired during background monitoring: ${parsed.statusDescription}`);
        setAuthBlockedState({
          isBlocked: true,
          reason: 'session_invalidated',
          title: 'Session Invalidation: Token Expired',
          message: 'Your cryptographic session token has lapsed while using the application.',
          details: parsed.statusDescription,
          userEmail: authProfile?.email,
          userId: authProfile?.id,
          userRole: currentUserRole,
          timestamp: new Date().toISOString(),
          actionRequired: 'Please sign in again to renew your session.'
        });
        setSessionTokenState(null);
        setAuthProfileState(null);
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'token');
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth_user');
      }
    }, 25000);

    return () => clearInterval(intervalId);
  }, [sessionToken, authProfile, currentUserRole]);

  // Supabase Authentication & Password Recovery Handler
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supabase = getBrowserSupabaseClient();
    if (supabase) {
      // 1. Listen for Supabase Auth state changes (including PASSWORD_RECOVERY)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecoveryMode(true);
          if (session?.access_token) {
            setRecoveryAccessToken(session.access_token);
          }
          if (session?.user?.email) {
            setRecoveryEmail(session.user.email);
          }
          // Clean callback URL in browser address bar
          if (window.location.pathname === '/auth/callback') {
            window.history.replaceState(null, '', '/');
          }
        }
      });

      // 2. Direct inspection of URL fragment & query parameters
      const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
      const search = window.location.search.startsWith('?') ? window.location.search.substring(1) : '';
      const hashParams = new URLSearchParams(hash);
      const searchParams = new URLSearchParams(search);

      const type = hashParams.get('type') || searchParams.get('type');
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

      // If user landed with recovery token (e.g. from password reset email link)
      if (type === 'recovery' && accessToken) {
        setIsPasswordRecoveryMode(true);
        setRecoveryAccessToken(accessToken);

        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        }).then(({ data: { session } }) => {
          if (session?.user?.email) {
            setRecoveryEmail(session.user.email);
          }
        }).catch(err => console.warn('Supabase recovery setSession error:', err));

        // Clean callback URL in address bar
        if (window.location.pathname === '/auth/callback') {
          window.history.replaceState(null, '', '/');
        }
      } else if (window.location.pathname === '/auth/callback') {
        // If landed on /auth/callback without recovery params, clean URL to root
        window.history.replaceState(null, '', '/');
      }

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, []);

  const login = useCallback(async (email: string, pass: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      const res = await apiService.login(email, pass);
      if (res.error) {
        // A client-side fallback used to run here: if the server login failed and
        // the typed credentials matched a hardcoded pair, the browser granted
        // itself a Super Admin session with a self-minted token. That was a
        // privilege grant decided entirely in the frontend — anyone reading the
        // bundle could reproduce it — and the token it created is no longer
        // accepted now that the server verifies signatures (BUG-002).
        //
        // Authentication is server-side only. A failed login is a failed login,
        // including for the built-in administrator, whose session must be issued
        // by POST /api/auth/login.
        setAuthError(res.error);
        const errStr = String(res.error || '').toLowerCase();
        if (errStr.includes('inactive') || errStr.includes('suspended') || errStr.includes('permission')) {
          setAuthBlockedState({
            isBlocked: true,
            reason: 'missing_permissions',
            title: 'Account Clearance Suspended',
            message: res.error,
            details: 'Active staff standing is required to access SD Operations.',
            userEmail: email,
            timestamp: new Date().toISOString(),
            actionRequired: 'Please contact your administrator to activate your account.'
          });
        }
        return false;
      }
      if (res.user && (res.token || res.session?.accessToken)) {
        const token = res.token || res.session!.accessToken;
        const authUser: AuthUser = {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name,
          role: res.user.role as RoleType,
          assignedSite: res.user.assignedSite || 'All Sites'
        };
        setAuthBlockedState(null);
        setSessionTokenState(token);
        setAuthProfileState(authUser);
        saveStorage('token', token);
        saveStorage('auth_user', authUser);
        saveStorage('role', authUser.role);
        setCurrentUserRoleState(authUser.role);
        if (authUser.assignedSite && authUser.assignedSite !== 'All Sites') {
          setAssignedSiteState(authUser.assignedSite);
          saveStorage('assigned_site', authUser.assignedSite);
        }
        addAuditEntry('SETTINGS_UPDATE', 'Settings', `User Login: ${authUser.email}`, authUser.assignedSite, `Authenticated session token created for role: ${authUser.role}.`);
        return true;
      }
      setAuthError('Authentication failed: missing session response');
      return false;
    } catch (err: any) {
      setAuthError(err.message || 'Login failed. Please verify credentials.');
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, [addAuditEntry]);


  const logout = useCallback(async () => {
    const prevUser = authProfile?.email || currentUserRole;
    const token = sessionToken;
    try {
      if (token) {
        await apiService.logout(token);
      }
    } catch {
      // ignore
    }
    setSessionTokenState(null);
    setAuthProfileState(null);
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'token');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth_user');
    addAuditEntry('SETTINGS_UPDATE', 'Settings', `User Logout: ${prevUser}`, assignedSite, 'Session token revoked.');
  }, [authProfile, currentUserRole, sessionToken, assignedSite, addAuditEntry]);

  const addDataChangeRequest = useCallback((req: Omit<DataChangeRequest, 'id' | 'createdAt' | 'status'>) => {
    const newReq: DataChangeRequest = {
      ...req,
      id: 'req-' + Date.now(),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    setDataChangeRequests(prev => [newReq, ...prev]);
    addAuditEntry('CREATE', 'Settings', `Change Request: ${newReq.recordTitle}`, newReq.site, `Submitted data change request (${newReq.requestType}) for review.`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('change_request.created', newReq, {
      site: newReq.site,
      severity: 'Medium',
      entityId: newReq.id
    });
  }, [addAuditEntry, triggerEmailNotification]);

  const reviewDataChangeRequest = useCallback((id: string, decision: 'Approved' | 'Rejected', reviewNotes: string) => {
    const foundUser = users.find(u => u.role === currentUserRole);
    const reviewerName = foundUser ? foundUser.name : currentUserRole;
    const targetReq = dataChangeRequests.find(r => r.id === id);

    setDataChangeRequests(prev => prev.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: decision,
          reviewedBy: reviewerName,
          reviewedAt: new Date().toISOString(),
          reviewNotes
        };
      }
      return r;
    }));
    addAuditEntry('UPDATE', 'Settings', `Change Request #${id}`, 'System', `Data change request ${decision}: ${reviewNotes}`);

    // Automated configurable email notification dispatch
    if (targetReq) {
      triggerEmailNotification('change_request.reviewed', { ...targetReq, decision, reviewNotes, requestId: id }, {
        site: targetReq.site,
        severity: 'Low',
        entityId: id
      });
    }
  }, [currentUserRole, users, dataChangeRequests, addAuditEntry, triggerEmailNotification]);

  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(false);
  const [sessionLockReason, setSessionLockReason] = useState<string>('Inactivity timeout');
  const [lastActivityTimestamp, setLastActivityTimestamp] = useState<number>(() => Date.now());
  const [remainingInactivitySeconds, setRemainingInactivitySeconds] = useState<number>(() => (settings.autoLogoutMinutes || 15) * 60);

  const resetInactivityTimer = useCallback(() => {
    setLastActivityTimestamp(Date.now());
    if (settings.autoLogoutMinutes > 0) {
      setRemainingInactivitySeconds(settings.autoLogoutMinutes * 60);
    }
  }, [settings.autoLogoutMinutes]);

  const lockSession = useCallback((reason: string = 'User requested security lock') => {
    setIsSessionLocked(true);
    setSessionLockReason(reason);
    addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Session Lock', 'System', `User session locked (${reason})`);
  }, [addAuditEntry]);

  const unlockSession = useCallback(() => {
    setIsSessionLocked(false);
    resetInactivityTimer();
    addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Session Unlock', 'System', `User session unlocked and resumed`);
  }, [resetInactivityTimer, addAuditEntry]);

  useEffect(() => {
    const handleActivity = () => {
      if (!isSessionLocked) {
        setLastActivityTimestamp(Date.now());
      }
    };
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [isSessionLocked]);

  useEffect(() => {
    if (!settings.autoLogoutMinutes || settings.autoLogoutMinutes <= 0 || isSessionLocked) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - lastActivityTimestamp) / 1000);
      const limitSeconds = settings.autoLogoutMinutes * 60;
      const remaining = Math.max(0, limitSeconds - elapsed);
      setRemainingInactivitySeconds(remaining);

      if (remaining <= 0 && !isSessionLocked) {
        setIsSessionLocked(true);
        setSessionLockReason(`Inactivity timeout (${settings.autoLogoutMinutes} minutes)`);
        addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Auto-Logout Triggered', 'System', `Session locked automatically due to ${settings.autoLogoutMinutes} minutes of inactivity.`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings.autoLogoutMinutes, lastActivityTimestamp, isSessionLocked, addAuditEntry]);

  // Synchronize with local storage & Smart Cache Layer
  useEffect(() => { saveStorage('role', currentUserRole); }, [currentUserRole]);
  useEffect(() => { saveStorage('assigned_site', assignedSite); }, [assignedSite]);
  useEffect(() => { saveStorage('settings', settings); }, [settings]);
  useEffect(() => { saveStorage('maintenance', maintenanceRecords); }, [maintenanceRecords]);
  useEffect(() => { saveStorage('spcd', spcdRecords); }, [spcdRecords]);
  useEffect(() => { saveStorage('data_change_requests', dataChangeRequests); }, [dataChangeRequests]);
  
  useEffect(() => { 
    saveStorage('sites', sites); 
    const meta = smartCache.getPropertiesInstant().metadata;
    smartCache.savePropertiesCache({
      data: sites,
      metadata: {
        ...meta,
        lastSyncTimestamp: Date.now(),
        itemCount: sites.length,
        hitCount: (meta.hitCount || 0) + 1
      }
    });
  }, [sites]);

  useEffect(() => { 
    saveStorage('users', users); 
    const meta = smartCache.getUsersInstant().metadata;
    smartCache.saveUsersCache({
      data: users,
      metadata: {
        ...meta,
        lastSyncTimestamp: Date.now(),
        itemCount: users.length,
        hitCount: (meta.hitCount || 0) + 1
      }
    });
  }, [users]);

  useEffect(() => { saveStorage('referrals', referrals); }, [referrals]);
  useEffect(() => { saveStorage('vulnerable', vulnerableSUs); }, [vulnerableSUs]);
  useEffect(() => { saveStorage('challenging', challengingSUs); }, [challengingSUs]);
  useEffect(() => { saveStorage('laundry', laundryRecords); }, [laundryRecords]);
  useEffect(() => { saveStorage('food', foodRecords); }, [foodRecords]);
  useEffect(() => { saveStorage('escalations', escalations); }, [escalations]);
  useEffect(() => { saveStorage('documents', documents); }, [documents]);
  useEffect(() => { saveStorage('audit', auditLogs); }, [auditLogs]);
  useEffect(() => { saveStorage('role_permissions', rolePermissions); }, [rolePermissions]);
  useEffect(() => { saveStorage('public_transport_records', publicTransportRecords); }, [publicTransportRecords]);
  useEffect(() => { saveStorage('compliance_records', complianceRecords); }, [complianceRecords]);
  useEffect(() => { saveStorage('gp_appointment_records', gpAppointmentRecords); }, [gpAppointmentRecords]);
  useEffect(() => { saveStorage('rfa_welfare_records', rfaWelfareRecords); }, [rfaWelfareRecords]);
  useEffect(() => { saveStorage('dispersal_records', dispersalRecords); }, [dispersalRecords]);
  useEffect(() => { saveStorage('booklet_records', bookletRecords); }, [bookletRecords]);
  useEffect(() => { saveStorage('vcs_agencies', vcsAgencies); }, [vcsAgencies]);

  // Live Database Sync Engine (Webapp <-> Supabase PostgreSQL)
  const syncFromDatabase = useCallback(async () => {
    try {
      const [
        refRes, vulRes, chalRes, maintRes, spcdRes, siteRes, 
        lauRes, propLauRes, foodRes, vendorFoodRes, escRes, docRes, usrRes, supaUsersRes
      ] = await Promise.all([
        apiService.fetchEntityRecords<SGReferral>('referrals'),
        apiService.fetchEntityRecords<VulnerableSU>('vulnerable'),
        apiService.fetchEntityRecords<ChallengingSU>('challenging'),
        apiService.fetchEntityRecords<MaintenanceRecord>('maintenance'),
        apiService.fetchEntityRecords<SPCDRecord>('spcd'),
        apiService.fetchEntityRecords<SiteInfo>('sites'),
        apiService.fetchEntityRecords<LaundryRecord>('laundry'),
        apiService.fetchEntityRecords<PropertyLaundryLog>('property_laundry_logs'),
        apiService.fetchEntityRecords<FoodRecord>('food'),
        apiService.fetchEntityRecords<PropertyFoodVendorBuffetLog>('food_vendor_buffet_logs'),
        apiService.fetchEntityRecords<EscalationRecord>('escalations'),
        apiService.fetchEntityRecords<DocumentRecord>('documents'),
        apiService.fetchEntityRecords<UserAccount>('users'),
        apiService.fetchSupabaseUsers()
      ]);

      if (refRes.success && Array.isArray(refRes.data) && refRes.data.length > 0) setReferrals(refRes.data);
      if (vulRes.success && Array.isArray(vulRes.data) && vulRes.data.length > 0) setVulnerableSUs(vulRes.data);
      if (chalRes.success && Array.isArray(chalRes.data) && chalRes.data.length > 0) setChallengingSUs(chalRes.data);
      if (maintRes.success && Array.isArray(maintRes.data) && maintRes.data.length > 0) setMaintenanceRecords(maintRes.data);
      if (spcdRes.success && Array.isArray(spcdRes.data) && spcdRes.data.length > 0) setSpcdRecords(spcdRes.data);
      if (siteRes.success && Array.isArray(siteRes.data) && siteRes.data.length > 0) setSites(deduplicateSites(siteRes.data));
      if (lauRes.success && Array.isArray(lauRes.data) && lauRes.data.length > 0) setLaundryRecords(lauRes.data);
      if (propLauRes.success && Array.isArray(propLauRes.data) && propLauRes.data.length > 0) setPropertyLaundryLogs(propLauRes.data);
      if (foodRes.success && Array.isArray(foodRes.data) && foodRes.data.length > 0) setFoodRecords(foodRes.data);
      if (vendorFoodRes.success && Array.isArray(vendorFoodRes.data) && vendorFoodRes.data.length > 0) setFoodVendorBuffetLogs(vendorFoodRes.data);
      if (escRes.success && Array.isArray(escRes.data) && escRes.data.length > 0) setEscalations(escRes.data);
      if (docRes.success && Array.isArray(docRes.data) && docRes.data.length > 0) setDocuments(docRes.data);

      const supaUsers = (supaUsersRes?.success && Array.isArray(supaUsersRes.users) && supaUsersRes.users.length > 0)
        ? supaUsersRes.users
        : (usrRes?.success && Array.isArray(usrRes.data) && usrRes.data.length > 0 ? usrRes.data : null);

      if (supaUsers && supaUsers.length > 0) {
        const mappedUsers: UserAccount[] = supaUsers.map((u: any) => ({
          id: u.id || `usr-${Date.now()}`,
          name: u.name || u.email?.split('@')[0] || 'User',
          email: u.email || '',
          role: u.role || 'Staff',
          assignedSites: Array.isArray(u.assignedSites) && u.assignedSites.length > 0
            ? u.assignedSites
            : (u.assignedSite ? [u.assignedSite] : ['All Sites']),
          status: u.status === 'Inactive' ? 'Inactive' : 'Active',
          lastActive: u.lastActive || u.updatedAt || 'Recently'
        }));
        setUsers(mappedUsers);
      }
    } catch (err) {
      console.warn('Live DB sync error:', err);
    }
  }, []);

  // Background Delta Sync Engine for smart cache & database
  const triggerBackgroundDeltaSync = useCallback(async () => {
    try {
      await syncFromDatabase();
      const propResult = await smartCache.syncPropertiesDelta(sites, INITIAL_SITES);
      if (propResult.deltaCount > 0) {
        setSites(deduplicateSites(propResult.updatedData));
      }

      const userResult = await smartCache.syncUsersDelta(users, INITIAL_USERS);
      if (userResult.deltaCount > 0) {
        setUsers(userResult.updatedData);
      }
    } catch (err) {
      console.warn('SmartCache background sync notice:', err);
    }
  }, [syncFromDatabase, sites, users]);

  /**
   * Latest sync function, held in a ref so the scheduling effect below can call
   * it without depending on its identity.
   *
   * `triggerBackgroundDeltaSync` depends on `sites` and `users`, and the sync it
   * performs calls `setSites`/`setUsers` with freshly-built arrays. Its identity
   * therefore changed on every run. With that identity in the effect's dependency
   * array the effect tore down and re-ran each time, re-arming its 1500ms initial
   * timer — so the 45s interval was never reached and a full sync fired roughly
   * every 2.4 seconds, unauthenticated, even on the login screen (~505k requests
   * per day per idle tab). The ref breaks that feedback loop.
   */
  const backgroundSyncRef = useRef(triggerBackgroundDeltaSync);
  useEffect(() => {
    backgroundSyncRef.current = triggerBackgroundDeltaSync;
  }, [triggerBackgroundDeltaSync]);

  useEffect(() => {
    const unsubscribe = smartCache.subscribeStats(stats => {
      setCacheStats(stats);
    });

    // Run non-blocking background sync after initial render
    const initialSyncTimer = setTimeout(() => {
      backgroundSyncRef.current();
    }, 1500);

    // Periodic sync check every 45 seconds
    const interval = setInterval(() => {
      backgroundSyncRef.current();
    }, 45000);

    return () => {
      unsubscribe();
      clearTimeout(initialSyncTimer);
      clearInterval(interval);
    };
    // Mount-only: the timers must be created exactly once. The ref above keeps
    // them calling the current sync implementation.
  }, []);

  // Fast Indexed Lookups (0ms O(1)) with null guards
  const lookupPropertyById = useCallback((id?: string) => id ? fastIndices.getPropertyById(id) : undefined, []);
  const lookupPropertyByName = useCallback((name?: string) => name ? fastIndices.getPropertyByName(name) : undefined, []);
  const lookupUserById = useCallback((id?: string) => id ? fastIndices.getUserById(id) : undefined, []);
  const lookupUserByEmail = useCallback((email?: string) => email ? fastIndices.getUserByEmail(email) : undefined, []);
  const lookupUsersByRole = useCallback((role?: RoleType) => role ? fastIndices.getUsersByRole(role) : [], []);

  // Derive allowed sites based on role and settings
  const canAccessAllSites = useCallback(() => {
    if (!settings.strictSiteIsolation) return true;
    return ['Regional Manager', 'Super Admin', 'Admin'].includes(currentUserRole);
  }, [currentUserRole, settings.strictSiteIsolation]);

  const allowedSites = useMemo(() => {
    if (canAccessAllSites()) {
      const names = (sites || [])
        .map(s => (typeof s === 'string' ? s : s?.name))
        .filter((name): name is string => Boolean(name && typeof name === 'string' && name.trim() !== ''));
      return Array.from(new Set(names));
    }
    return [assignedSite || 'Brit Hotel'];
  }, [canAccessAllSites, sites, assignedSite]);

  // When role changes, if restricted, force selectedSite to assignedSite
  useEffect(() => {
    if (!canAccessAllSites()) {
      setSelectedSite(assignedSite);
    }
  }, [canAccessAllSites, assignedSite]);

  // Dynamic RBAC Permission Checks
  const updateRolePermissions = useCallback((role: RoleType, perms: Partial<RolePermissions>) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], ...perms }
    }));
  }, []);

  const resetRolePermissions = useCallback(() => {
    setRolePermissions(INITIAL_ROLE_PERMISSIONS);
  }, []);

  const canDeleteRecord = useCallback(() => {
    if (rolePermissions[currentUserRole]?.canDeleteRecords !== undefined) {
      return rolePermissions[currentUserRole].canDeleteRecords;
    }
    return ['Super Admin', 'Admin'].includes(currentUserRole);
  }, [currentUserRole, rolePermissions]);

  const canEditRecord = useCallback((recordSite?: string) => {
    const perm = rolePermissions[currentUserRole]?.canEditRecords ?? true;
    if (!perm) return false;
    if (currentUserRole === 'Super Admin' || currentUserRole === 'Regional Manager' || currentUserRole === 'Admin') {
      return true;
    }
    if (currentUserRole === 'Site Manager' || currentUserRole === 'General Manager') {
      return !recordSite || recordSite === assignedSite;
    }
    if (currentUserRole === 'Staff' || currentUserRole === 'Employee') {
      return !recordSite || recordSite === assignedSite;
    }
    return false;
  }, [currentUserRole, assignedSite, rolePermissions]);

  const canCreateRecord = useCallback(() => {
    return rolePermissions[currentUserRole]?.canCreateRecords ?? true;
  }, [currentUserRole, rolePermissions]);

  const canManageSettings = useCallback(() => {
    const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
    if (!isAdmin) return false;
    return rolePermissions[currentUserRole]?.canManageSettings ?? true;
  }, [currentUserRole, rolePermissions]);

  const canManageRoles = useCallback(() => {
    const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
    if (!isAdmin) return false;
    return rolePermissions[currentUserRole]?.canManageUsers ?? true;
  }, [currentUserRole, rolePermissions]);

  const canManageFiles = useCallback(() => {
    return rolePermissions[currentUserRole]?.canManageFiles ?? ['Super Admin', 'Admin', 'Regional Manager'].includes(currentUserRole);
  }, [currentUserRole, rolePermissions]);

  const canManageProperties = useCallback(() => {
    const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
    if (!isAdmin) return false;
    return rolePermissions[currentUserRole]?.canManageProperties ?? true;
  }, [currentUserRole, rolePermissions]);

  const canManageUsers = useCallback(() => {
    const isAdmin = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';
    if (!isAdmin) return false;
    return rolePermissions[currentUserRole]?.canManageUsers ?? true;
  }, [currentUserRole, rolePermissions]);

  // Confirmation Request helper
  const requestConfirmation = useCallback((req: ConfirmationRequest) => {
    setConfirmModal(req);
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmModal(null);
  }, []);

  // Role Switcher with Confirmation
  const setCurrentUserRole = useCallback((newRole: RoleType) => {
    if (newRole === currentUserRole) return;
    requestConfirmation({
      title: `Switch Active Role to ${newRole}`,
      message: `You are changing your active session to "${newRole}". Permissions and site access will be updated in real time.`,
      confirmLabel: `Switch to ${newRole}`,
      onConfirm: () => {
        setCurrentUserRoleState(newRole);
        addAuditEntry('ROLE_CHANGE', 'Roles', `Switched active role to ${newRole}`, assignedSite, `Session switched from ${currentUserRole} to ${newRole}.`);
        closeConfirmation();
      }
    });
  }, [currentUserRole, requestConfirmation, addAuditEntry, assignedSite, closeConfirmation]);

  const setAssignedSite = useCallback((newSite: string) => {
    setAssignedSiteState(newSite);
    if (!canAccessAllSites()) {
      setSelectedSite(newSite);
    }
  }, [canAccessAllSites]);

  // Settings updater
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Application Configuration', 'System', `Settings updated: ${Object.keys(newSettings).join(', ')}.`);
      return updated;
    });
  }, [addAuditEntry]);

  // Notifications
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // --- CRUD: Referrals ---
  const addReferral = useCallback((data: Omit<SGReferral, 'id' | 'srNo' | 'createdAt' | 'updatedAt' | 'lastUpdatedBy'>) => {
    const execute = () => {
      const newRef: SGReferral = {
        ...data,
        id: 'ref-' + Date.now(),
        srNo: referrals.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastUpdatedBy: currentUserName
      };
      setReferrals(prev => [newRef, ...prev]);
      apiService.saveEntityRecord('referrals', newRef).catch(err => console.error('Referral DB save error:', err));
      addAuditEntry('CREATE', 'Referrals', `${newRef.suName} (${newRef.portRef})`, newRef.site, `Created SG referral for ${newRef.referralCouncil}.`);
      
      // Automated configurable email notification dispatch
      triggerEmailNotification('referral.created', newRef, {
        site: newRef.site,
        severity: newRef.urgency === 'Critical' ? 'Critical' : newRef.urgency === 'High' ? 'High' : 'Medium',
        entityId: newRef.portRef
      });
      if (newRef.urgency === 'Critical' || newRef.urgency === 'High') {
        triggerEmailNotification('referral.urgent', newRef, {
          site: newRef.site,
          severity: newRef.urgency === 'Critical' ? 'Critical' : 'High',
          entityId: newRef.portRef
        });
      }

      // Automated SMTP email dispatch for High/Critical safeguarding referrals
      if (newRef.urgency === 'Critical' || newRef.urgency === 'High') {
        apiService.sendAlert({
          title: `High-Risk Safeguarding Referral: ${newRef.suName} (${newRef.referralType})`,
          message: `Urgency: ${newRef.urgency}. Leading Officer: ${newRef.officerLeadingHotel}. Council: ${newRef.referralCouncil}. Notes: ${newRef.notesActionTaken || 'None'}`,
          alertType: 'Safeguarding Referral Alert',
          severity: newRef.urgency as any,
          site: newRef.site,
          entityId: newRef.id,
          metadata: {
            'Service User': newRef.suName,
            'Port Ref': newRef.portRef,
            'Mosaic ID': newRef.mosaicId || 'N/A',
            'Council': newRef.referralCouncil,
            'Urgency Level': newRef.urgency
          }
        }).catch(err => console.error('Automated referral alert error:', err));
      }

      closeConfirmation();
    };

    if (settings.requireConfirmForCreates) {
      requestConfirmation({
        title: 'Confirm New SG Referral',
        message: `Are you sure you want to register a new safeguarding referral for ${data.suName} at ${data.site}?`,
        confirmLabel: 'Create Referral',
        itemDetails: [
          { label: 'Resident', value: data.suName },
          { label: 'Site', value: data.site },
          { label: 'Council', value: data.referralCouncil },
          { label: 'Referral Type', value: data.referralType },
          { label: 'Urgency', value: data.urgency }
        ],
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [referrals.length, currentUserName, addAuditEntry, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateReferral = useCallback((id: string, updates: Partial<SGReferral>) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    const execute = () => {
      const updatedAt = new Date().toISOString();
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt, lastUpdatedBy: currentUserName } : r));
      apiService.updateEntityRecord('referrals', id, { ...updates, updatedAt, lastUpdatedBy: currentUserName }).catch(err => console.error('Referral DB update error:', err));
      addAuditEntry('UPDATE', 'Referrals', `${current.suName} (${current.portRef})`, current.site, `Updated fields: ${Object.keys(updates).join(', ')}.`);
      closeConfirmation();
    };

    if (settings.requireConfirmForEdits) {
      requestConfirmation({
        title: 'Confirm Referral Changes',
        message: `Save changes for referral "${current.suName}" (${current.portRef})?`,
        confirmLabel: 'Save Changes',
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [referrals, currentUserName, addAuditEntry, settings.requireConfirmForEdits, requestConfirmation, closeConfirmation]);

  const archiveReferral = useCallback((id: string) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    const execute = () => {
      const updatedAt = new Date().toISOString();
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, status: 'Archived', updatedAt } : r));
      apiService.updateEntityRecord('referrals', id, { status: 'Archived', updatedAt }).catch(err => console.error('Referral DB archive error:', err));
      addAuditEntry('ARCHIVE', 'Referrals', `${current.suName} (${current.portRef})`, current.site, 'Moved referral to Archive.');
      closeConfirmation();
    };

    if (settings.requireConfirmForArchives) {
      requestConfirmation({
        title: 'Archive Referral',
        message: `Are you sure you want to archive referral for "${current.suName}"? The record will remain in the Archived SG Referrals workspace.`,
        confirmLabel: 'Archive Record',
        isDanger: false,
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [referrals, addAuditEntry, settings.requireConfirmForArchives, requestConfirmation, closeConfirmation]);

  const restoreReferral = useCallback((id: string) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    const execute = () => {
      const updatedAt = new Date().toISOString();
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, status: 'Open', updatedAt } : r));
      apiService.updateEntityRecord('referrals', id, { status: 'Open', updatedAt }).catch(err => console.error('Referral DB restore error:', err));
      addAuditEntry('RESTORE', 'Referrals', `${current.suName} (${current.portRef})`, current.site, 'Restored referral to active status.');
      closeConfirmation();
    };

    requestConfirmation({
      title: 'Restore Referral',
      message: `Restore "${current.suName}" to active Open status?`,
      confirmLabel: 'Restore Record',
      onConfirm: execute
    });
  }, [referrals, addAuditEntry, requestConfirmation, closeConfirmation]);

  const deleteReferral = useCallback((id: string) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Permanently Delete Referral',
      message: `CRITICAL ACTION: Are you sure you want to permanently delete the referral record for "${current.suName}" (${current.portRef})? This action cannot be undone and is recorded in the immutable audit log.`,
      confirmLabel: 'Permanently Delete',
      isDanger: true,
      onConfirm: () => {
        setReferrals(prev => prev.filter(r => r.id !== id));
        apiService.deleteEntityRecord('referrals', id).catch(err => console.error('Referral DB delete error:', err));
        addAuditEntry('DELETE', 'Referrals', `${current.suName} (${current.portRef})`, current.site, 'Permanent deletion of referral record.');
        closeConfirmation();
      }
    });
  }, [referrals, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Vulnerable SUs ---
  const addVulnerableSU = useCallback((data: Omit<VulnerableSU, 'id' | 'createdAt' | 'updatedAt'>) => {
    const execute = () => {
      const newSU: VulnerableSU = {
        ...data,
        id: 'vul-' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setVulnerableSUs(prev => [newSU, ...prev]);
      apiService.saveEntityRecord('vulnerable', newSU).catch(err => console.error('Vulnerable SU DB save error:', err));
      // Automated configurable email notification dispatch
      triggerEmailNotification('vulnerable.created', newSU, {
        site: newSU.site,
        severity: newSU.riskLevel === 'Critical' ? 'Critical' : newSU.riskLevel === 'High' ? 'High' : 'Medium',
        entityId: newSU.id
      });

      // Automated SMTP email dispatch for High/Critical Vulnerable SUs
      if (newSU.riskLevel === 'Critical' || newSU.riskLevel === 'High') {
        apiService.sendAlert({
          title: `Vulnerable Service User Alert: ${newSU.suName} (${newSU.riskLevel})`,
          message: `Group: ${newSU.group}. Vulnerability: ${newSU.vulnerability}. Allocated Worker: ${newSU.allocatedWorker}. Action Taken: ${newSU.notesActionTaken || 'None'}.`,
          alertType: 'Safeguarding Risk Alert',
          severity: newSU.riskLevel as any,
          site: newSU.site,
          entityId: newSU.id,
          metadata: {
            'Service User': newSU.suName,
            'Room / Flat': newSU.roomOrFlatNo,
            'Group': newSU.group,
            'Risk Level': newSU.riskLevel,
            'Allocated Worker': newSU.allocatedWorker
          }
        }).catch(err => console.error('Automated vulnerable SU alert error:', err));
      }

      closeConfirmation();
    };

    if (settings.requireConfirmForCreates) {
      requestConfirmation({
        title: 'Confirm Vulnerable Resident Registration',
        message: `Add ${data.suName} to the Vulnerable / Safeguarding SU list for ${data.site}?`,
        confirmLabel: 'Register Resident',
        itemDetails: [
          { label: 'Resident', value: data.suName },
          { label: 'Room', value: data.roomOrFlatNo },
          { label: 'Site', value: data.site },
          { label: 'Risk Level', value: data.riskLevel }
        ],
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [addAuditEntry, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateVulnerableSU = useCallback((id: string, updates: Partial<VulnerableSU>) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    const execute = () => {
      const updatedAt = new Date().toISOString();
      setVulnerableSUs(prev => prev.map(s => s.id === id ? { ...s, ...updates, updatedAt } : s));
      apiService.updateEntityRecord('vulnerable', id, { ...updates, updatedAt }).catch(err => console.error('Vulnerable SU DB update error:', err));
      addAuditEntry('UPDATE', 'Vulnerable SUs', `${current.suName} (${current.roomOrFlatNo})`, current.site, `Updated vulnerable record fields.`);
      closeConfirmation();
    };

    if (settings.requireConfirmForEdits) {
      requestConfirmation({
        title: 'Confirm Vulnerable SU Update',
        message: `Update safeguarding details for ${current.suName}?`,
        confirmLabel: 'Save Updates',
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [vulnerableSUs, addAuditEntry, settings.requireConfirmForEdits, requestConfirmation, closeConfirmation]);

  const archiveVulnerableSU = useCallback((id: string) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Archive Vulnerable Resident Record',
      message: `Move safeguarding record for ${current.suName} to Archive?`,
      confirmLabel: 'Archive Record',
      onConfirm: () => {
        const updatedAt = new Date().toISOString();
        setVulnerableSUs(prev => prev.map(s => s.id === id ? { ...s, status: 'Archived', updatedAt } : s));
        apiService.updateEntityRecord('vulnerable', id, { status: 'Archived', updatedAt }).catch(err => console.error('Vulnerable SU DB archive error:', err));
        addAuditEntry('ARCHIVE', 'Vulnerable SUs', `${current.suName}`, current.site, 'Archived safeguarding SU record.');
        closeConfirmation();
      }
    });
  }, [vulnerableSUs, addAuditEntry, requestConfirmation, closeConfirmation]);

  const restoreVulnerableSU = useCallback((id: string) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Restore Vulnerable Resident Record',
      message: `Restore ${current.suName} to active safeguarding register?`,
      confirmLabel: 'Restore Record',
      onConfirm: () => {
        const updatedAt = new Date().toISOString();
        setVulnerableSUs(prev => prev.map(s => s.id === id ? { ...s, status: 'Open', updatedAt } : s));
        apiService.updateEntityRecord('vulnerable', id, { status: 'Open', updatedAt }).catch(err => console.error('Vulnerable SU DB restore error:', err));
        addAuditEntry('RESTORE', 'Vulnerable SUs', `${current.suName}`, current.site, 'Restored vulnerable resident to active status.');
        closeConfirmation();
      }
    });
  }, [vulnerableSUs, addAuditEntry, requestConfirmation, closeConfirmation]);

  const deleteVulnerableSU = useCallback((id: string) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Safeguarding Record',
      message: `Are you certain you want to permanently delete safeguarding file for "${current.suName}"? This record cannot be recovered.`,
      confirmLabel: 'Permanently Delete',
      isDanger: true,
      onConfirm: () => {
        setVulnerableSUs(prev => prev.filter(s => s.id !== id));
        apiService.deleteEntityRecord('vulnerable', id).catch(err => console.error('Vulnerable SU DB delete error:', err));
        addAuditEntry('DELETE', 'Vulnerable SUs', `${current.suName}`, current.site, 'Permanently deleted vulnerable SU record.');
        closeConfirmation();
      }
    });
  }, [vulnerableSUs, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Challenging SUs ---
  const addChallengingSU = useCallback((data: Omit<ChallengingSU, 'id' | 'createdAt' | 'updatedAt'>) => {
    const execute = () => {
      const newRec: ChallengingSU = {
        ...data,
        id: 'chal-' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setChallengingSUs(prev => [newRec, ...prev]);
      apiService.saveEntityRecord('challenging', newRec).catch(err => console.error('Challenging SU DB save error:', err));
      // Automated configurable email notification dispatch for critical incidents
      if (newRec.riskFactor === 'High' || newRec.riskFactor === 'Critical') {
        triggerEmailNotification('challenging.critical', newRec, {
          site: newRec.site,
          severity: newRec.riskFactor === 'Critical' ? 'Critical' : 'High',
          entityId: newRec.id
        });
      }

      // Automated SMTP email alert for High/Critical incidents
      if (newRec.riskFactor === 'High' || newRec.riskFactor === 'Critical') {
        apiService.sendAlert({
          title: `Challenging Behaviour Incident: ${newRec.name} (${newRec.riskFactor})`,
          message: `Issue Type: ${newRec.typeOfIssue}. Description: ${newRec.incidentDescription || 'N/A'}. Action Taken: ${newRec.actionTaken || 'N/A'}. Follow Up: ${newRec.followUpNotes || 'N/A'}`,
          alertType: 'High-Priority Incident Alert',
          severity: newRec.riskFactor as any,
          site: newRec.site,
          entityId: newRec.id,
          metadata: {
            'Service User': newRec.name,
            'Port Ref': newRec.portRef,
            'Risk Factor': newRec.riskFactor,
            'Issue Type': newRec.typeOfIssue,
            'Follow Up Required': newRec.followUpRequired
          }
        }).catch(err => console.error('Automated incident alert error:', err));
      }

      closeConfirmation();
    };

    if (settings.requireConfirmForCreates) {
      requestConfirmation({
        title: 'Confirm Incident / Challenging SU Log',
        message: `Log challenging incident for ${data.name} at ${data.site}?`,
        confirmLabel: 'Log Incident',
        itemDetails: [
          { label: 'Resident', value: data.name },
          { label: 'Site', value: data.site },
          { label: 'Issue Type', value: data.typeOfIssue },
          { label: 'Risk Factor', value: data.riskFactor }
        ],
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [addAuditEntry, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateChallengingSU = useCallback((id: string, updates: Partial<ChallengingSU>) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    const execute = () => {
      const updatedAt = new Date().toISOString();
      setChallengingSUs(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt } : c));
      apiService.updateEntityRecord('challenging', id, { ...updates, updatedAt }).catch(err => console.error('Challenging SU DB update error:', err));
      addAuditEntry('UPDATE', 'Challenging SUs', `${current.name}`, current.site, `Updated incident log for ${current.name}.`);
      closeConfirmation();
    };

    if (settings.requireConfirmForEdits) {
      requestConfirmation({
        title: 'Confirm Incident Updates',
        message: `Update incident record for ${current.name}?`,
        confirmLabel: 'Save Updates',
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [challengingSUs, addAuditEntry, settings.requireConfirmForEdits, requestConfirmation, closeConfirmation]);

  const archiveChallengingSU = useCallback((id: string) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Archive Challenging Incident File',
      message: `Move incident record for ${current.name} to Archive?`,
      confirmLabel: 'Archive Record',
      onConfirm: () => {
        const updatedAt = new Date().toISOString();
        setChallengingSUs(prev => prev.map(c => c.id === id ? { ...c, status: 'Archived', updatedAt } : c));
        apiService.updateEntityRecord('challenging', id, { status: 'Archived', updatedAt }).catch(err => console.error('Challenging SU DB archive error:', err));
        addAuditEntry('ARCHIVE', 'Challenging SUs', `${current.name}`, current.site, 'Archived challenging incident record.');
        closeConfirmation();
      }
    });
  }, [challengingSUs, addAuditEntry, requestConfirmation, closeConfirmation]);

  const restoreChallengingSU = useCallback((id: string) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Restore Challenging SU Record',
      message: `Restore incident file for ${current.name} to active list?`,
      confirmLabel: 'Restore Record',
      onConfirm: () => {
        const updatedAt = new Date().toISOString();
        setChallengingSUs(prev => prev.map(c => c.id === id ? { ...c, status: 'In progress', updatedAt } : c));
        apiService.updateEntityRecord('challenging', id, { status: 'In progress', updatedAt }).catch(err => console.error('Challenging SU DB restore error:', err));
        addAuditEntry('RESTORE', 'Challenging SUs', `${current.name}`, current.site, 'Restored challenging SU record.');
        closeConfirmation();
      }
    });
  }, [challengingSUs, addAuditEntry, requestConfirmation, closeConfirmation]);

  const deleteChallengingSU = useCallback((id: string) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Incident Record',
      message: `Permanently delete incident file for "${current.name}"?`,
      confirmLabel: 'Permanently Delete',
      isDanger: true,
      onConfirm: () => {
        setChallengingSUs(prev => prev.filter(c => c.id !== id));
        apiService.deleteEntityRecord('challenging', id).catch(err => console.error('Challenging SU DB delete error:', err));
        addAuditEntry('DELETE', 'Challenging SUs', `${current.name}`, current.site, 'Permanently deleted challenging SU record.');
        closeConfirmation();
      }
    });
  }, [challengingSUs, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Laundry ---
  const addLaundryRecord = useCallback((data: Omit<LaundryRecord, 'id' | 'createdAt'>) => {
    const execute = () => {
      const rec: LaundryRecord = {
        ...data,
        id: 'lau-' + Date.now(),
        createdAt: new Date().toISOString()
      };
      setLaundryRecords(prev => [rec, ...prev]);
      apiService.saveEntityRecord('laundry', rec).catch(err => console.error('Laundry DB save error:', err));
      addAuditEntry('CREATE', 'Laundry', `${rec.residentName} (${rec.roomNo})`, rec.site, `Issued ${rec.tokensIssued} tokens for laundry.`);
      closeConfirmation();
    };

    if (settings.requireConfirmForCreates) {
      requestConfirmation({
        title: 'Confirm Laundry Intake',
        message: `Issue ${data.tokensIssued} token(s) for ${data.residentName} in ${data.roomNo} at ${data.site}?`,
        confirmLabel: 'Log Laundry',
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [addAuditEntry, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateLaundryRecord = useCallback((id: string, updates: Partial<LaundryRecord>) => {
    setLaundryRecords(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    apiService.updateEntityRecord('laundry', id, updates).catch(err => console.error('Laundry DB update error:', err));
    addAuditEntry('UPDATE', 'Laundry', `Laundry #${id}`, 'Site', `Updated status to ${updates.status || 'modified'}.`);
  }, [addAuditEntry]);

  const deleteLaundryRecord = useCallback((id: string) => {
    const current = laundryRecords.find(l => l.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Laundry Log',
      message: `Remove laundry record for ${current.residentName} (${current.roomNo})?`,
      confirmLabel: 'Delete Entry',
      isDanger: true,
      onConfirm: () => {
        setLaundryRecords(prev => prev.filter(l => l.id !== id));
        apiService.deleteEntityRecord('laundry', id).catch(err => console.error('Laundry DB delete error:', err));
        addAuditEntry('DELETE', 'Laundry', `Laundry #${id}`, current.site, 'Deleted laundry intake record.');
        closeConfirmation();
      }
    });
  }, [laundryRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Property Laundry Logs (Weekly / Monthly per Property) ---
  const addPropertyLaundryLog = useCallback((data: Omit<PropertyLaundryLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    const rec: PropertyLaundryLog = {
      ...data,
      id: 'prop-lau-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPropertyLaundryLogs(prev => [rec, ...prev]);
    saveStorage('property_laundry_logs', [rec, ...propertyLaundryLogs]);
    apiService.saveEntityRecord('property_laundry_logs', rec).catch(err => console.error('Property laundry log DB save error:', err));
    addAuditEntry(
      'CREATE', 
      'Laundry', 
      `${data.periodType} Log (${data.periodLabel})`, 
      data.site, 
      `Logged ${data.dirtyLaundrySent} sent / ${data.cleanLaundryReturned} returned. Audited by: ${data.loggedBy}.`,
      data.loggedBy
    );
  }, [addAuditEntry, propertyLaundryLogs]);

  const updatePropertyLaundryLog = useCallback((id: string, updates: Partial<PropertyLaundryLog>) => {
    let updater = '';
    let siteName = '';
    let periodInfo = '';
    let updatedObj: PropertyLaundryLog | undefined;
    setPropertyLaundryLogs(prev => {
      const next = prev.map(p => {
        if (p.id === id) {
          const u = { ...p, ...updates, updatedAt: new Date().toISOString() };
          updater = u.loggedBy;
          siteName = u.site;
          periodInfo = u.periodLabel;
          updatedObj = u;
          return u;
        }
        return p;
      });
      saveStorage('property_laundry_logs', next);
      return next;
    });
    if (updatedObj) {
      apiService.updateEntityRecord('property_laundry_logs', id, updatedObj).catch(err => console.error('Property laundry log DB update error:', err));
    }
    addAuditEntry(
      'UPDATE', 
      'Laundry', 
      `Property Log: ${periodInfo || `#${id}`}`, 
      siteName || 'Site', 
      `Updated property laundry counts and remarks. Audited by ${updater || 'User'}.`,
      updater
    );
  }, [addAuditEntry]);

  const deletePropertyLaundryLog = useCallback((id: string) => {
    const current = propertyLaundryLogs.find(p => p.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Property Laundry Log',
      message: `Permanently remove ${current.periodType} laundry log for "${current.site}" (${current.periodLabel})?`,
      confirmLabel: 'Delete Log',
      isDanger: true,
      onConfirm: () => {
        setPropertyLaundryLogs(prev => {
          const next = prev.filter(p => p.id !== id);
          saveStorage('property_laundry_logs', next);
          return next;
        });
        apiService.deleteEntityRecord('property_laundry_logs', id).catch(err => console.error('Property laundry log DB delete error:', err));
        addAuditEntry('DELETE', 'Laundry', `Log #${id}`, current.site, 'Deleted property laundry log record.');
        closeConfirmation();
      }
    });
  }, [propertyLaundryLogs, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Hot Food ---
  const addFoodRecord = useCallback((data: Omit<FoodRecord, 'id' | 'createdAt'>) => {
    const execute = () => {
      const rec: FoodRecord = {
        ...data,
        id: 'food-' + Date.now(),
        createdAt: new Date().toISOString()
      };
      setFoodRecords(prev => [rec, ...prev]);
      apiService.saveEntityRecord('food', rec).catch(err => console.error('Food DB save error:', err));
      addAuditEntry('CREATE', 'Hot Food', `${rec.residentName} (${rec.roomNo})`, rec.site, `Logged ${rec.mealType} (${rec.tempCheckedCelsius}°C).`);
      closeConfirmation();
    };

    if (settings.requireConfirmForCreates) {
      requestConfirmation({
        title: 'Confirm Meal Delivery Log',
        message: `Record ${data.mealType} delivery for ${data.residentName} (${data.dietaryRequirement}) at ${data.site}?`,
        confirmLabel: 'Log Delivery',
        onConfirm: execute
      });
    } else {
      execute();
    }
  }, [addAuditEntry, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateFoodRecord = useCallback((id: string, updates: Partial<FoodRecord>) => {
    setFoodRecords(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    apiService.updateEntityRecord('food', id, updates).catch(err => console.error('Food DB update error:', err));
    addAuditEntry('UPDATE', 'Hot Food', `Food Log #${id}`, 'Site', `Updated meal status.`);
  }, [addAuditEntry]);

  const deleteFoodRecord = useCallback((id: string) => {
    const current = foodRecords.find(f => f.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Food Log Entry',
      message: `Delete hot food record for ${current.residentName}?`,
      confirmLabel: 'Delete Entry',
      isDanger: true,
      onConfirm: () => {
        setFoodRecords(prev => prev.filter(f => f.id !== id));
        apiService.deleteEntityRecord('food', id).catch(err => console.error('Food DB delete error:', err));
        addAuditEntry('DELETE', 'Hot Food', `Food #${id}`, current.site, 'Deleted food distribution record.');
        closeConfirmation();
      }
    });
  }, [foodRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Food Vendor Buffet Logs (A&M, Freshbite, 9 cusines, sands) ---
  const addFoodVendorBuffetLog = useCallback((data: Omit<PropertyFoodVendorBuffetLog, 'id' | 'updatedAt'>) => {
    const rec: PropertyFoodVendorBuffetLog = {
      ...data,
      id: 'vendor-bf-' + Date.now(),
      updatedAt: new Date().toISOString()
    };
    setFoodVendorBuffetLogs(prev => [rec, ...prev]);
    saveStorage('food_vendor_buffet_logs', [rec, ...foodVendorBuffetLogs]);
    apiService.saveEntityRecord('food_vendor_buffet_logs', rec).catch(err => console.error('Food vendor buffet log DB save error:', err));
    addAuditEntry(
      'CREATE', 
      'Hot Food', 
      `Vendor: ${data.vendor} (${data.weekRange})`, 
      data.site, 
      `Created weekly buffet catering schedule. Audited by: ${data.lastUpdatedBy}.`,
      data.lastUpdatedBy
    );
  }, [addAuditEntry, foodVendorBuffetLogs]);

  const updateFoodVendorBuffetLog = useCallback((id: string, updates: Partial<PropertyFoodVendorBuffetLog>) => {
    let updatedVendor = '';
    let updatedSite = '';
    let updater = '';
    let updatedObj: PropertyFoodVendorBuffetLog | undefined;
    setFoodVendorBuffetLogs(prev => {
      const next = prev.map(v => {
        if (v.id === id) {
          const u = { ...v, ...updates, updatedAt: new Date().toISOString() };
          updatedVendor = u.vendor;
          updatedSite = u.site;
          updater = u.lastUpdatedBy;
          updatedObj = u;
          return u;
        }
        return v;
      });
      saveStorage('food_vendor_buffet_logs', next);
      return next;
    });
    if (updatedObj) {
      apiService.updateEntityRecord('food_vendor_buffet_logs', id, updatedObj).catch(err => console.error('Food vendor buffet log DB update error:', err));
    }
    addAuditEntry(
      'UPDATE', 
      'Hot Food', 
      `Vendor: ${updatedVendor || 'Buffet Matrix'} (#${id})`, 
      updatedSite || 'Site', 
      `Updated weekly buffet counts for ${updatedVendor} (${updates.weekRange || 'Week Matrix'}). Audited by ${updater || 'User'}.`,
      updater
    );
  }, [addAuditEntry]);

  const deleteFoodVendorBuffetLog = useCallback((id: string) => {
    const current = foodVendorBuffetLogs.find(v => v.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Food Vendor Buffet Log',
      message: `Permanently remove buffet log for "${current.vendor}" at "${current.site}" (${current.weekRange})?`,
      confirmLabel: 'Delete Schedule',
      isDanger: true,
      onConfirm: () => {
        setFoodVendorBuffetLogs(prev => {
          const next = prev.filter(v => v.id !== id);
          saveStorage('food_vendor_buffet_logs', next);
          return next;
        });
        apiService.deleteEntityRecord('food_vendor_buffet_logs', id).catch(err => console.error('Food vendor buffet log DB delete error:', err));
        addAuditEntry('DELETE', 'Hot Food', `Vendor Log #${id}`, current.site, 'Deleted food vendor buffet log.');
        closeConfirmation();
      }
    });
  }, [foodVendorBuffetLogs, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Escalations ---
  const addEscalation = useCallback((data: Omit<EscalationRecord, 'id' | 'createdAt'>) => {
    const execute = () => {
      const rec: EscalationRecord = {
        ...data,
        id: 'esc-' + Date.now(),
        createdAt: new Date().toISOString()
      };
      setEscalations(prev => [rec, ...prev]);
      apiService.saveEntityRecord('escalations', rec).catch(err => console.error('Escalation DB save error:', err));
      // Automated configurable email notification dispatch
      triggerEmailNotification('escalation.created', rec, {
        site: rec.site,
        severity: rec.urgency === 'Critical' ? 'Critical' : 'High',
        entityId: rec.id
      });
      if (rec.urgency === 'Critical') {
        triggerEmailNotification('escalation.critical', rec, {
          site: rec.site,
          severity: 'Critical',
          entityId: rec.id
        });
      }

      // Automated SMTP Email Dispatch for Escalations
      apiService.sendEscalationAlert({
        suName: rec.suName,
        site: rec.site,
        incidentTitle: rec.incidentTitle || rec.incidentType || 'Safeguarding Escalation',
        urgency: rec.urgency || 'High',
        escalatedTo: rec.escalatedTo || rec.reportedAuthorities || 'Management',
        reason: rec.incidentNotes || 'Safeguarding incident requiring higher authority intervention.',
        actionRequired: rec.actionTaken || 'Immediate review & multi-agency response.',
        reportedBy: rec.reportedBy || rec.personReporting || currentUserName
      }).then(res => {
        if (res.success) {
          console.log('Automated escalation email notification dispatched via SMTP:', res.messageId || 'Success');
        }
      }).catch(err => console.error('Failed to dispatch automated escalation email alert:', err));

      // Push real-time urgent notification to notification drawer
      setNotifications(prev => [
        {
          id: 'notif-' + Date.now(),
          title: `Escalation Notice: ${rec.suName}`,
          description: `Urgent escalation to ${rec.escalatedTo} at ${rec.site}. Priority: ${rec.urgency}`,
          time: 'Just now',
          type: 'urgent',
          read: false,
          linkPage: 'escalations'
        },
        ...prev
      ]);

      closeConfirmation();
    };

    requestConfirmation({
      title: 'Submit Formal Escalation',
      message: `Are you sure you want to escalate this incident to "${data.escalatedTo}" with ${data.urgency} priority? Automated email alerts will be dispatched immediately.`,
      confirmLabel: 'Confirm Escalation',
      isDanger: data.urgency === 'Critical',
      itemDetails: [
        { label: 'Resident', value: data.suName },
        { label: 'Site', value: data.site },
        { label: 'Priority', value: data.urgency },
        { label: 'Escalated To', value: data.escalatedTo }
      ],
      onConfirm: execute
    });
  }, [currentUserName, addAuditEntry, requestConfirmation, closeConfirmation]);

  const updateEscalation = useCallback((id: string, updates: Partial<EscalationRecord>) => {
    setEscalations(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      const merged = next.find(e => e.id === id);
      if (merged) {
        apiService.updateEntityRecord('escalations', id, merged).catch(err => console.error('Escalation DB update error:', err));
      }
      return next;
    });
    addAuditEntry('UPDATE', 'Escalations', `Escalation #${id}`, 'Site', `Updated escalation details.`);
  }, [addAuditEntry]);

  const deleteEscalation = useCallback((id: string) => {
    const current = escalations.find(e => e.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Escalation Record',
      message: `Delete escalation case "${current.incidentTitle}"?`,
      confirmLabel: 'Delete Case',
      isDanger: true,
      onConfirm: () => {
        setEscalations(prev => prev.filter(e => e.id !== id));
        apiService.deleteEntityRecord('escalations', id).catch(err => console.error('Escalation DB delete error:', err));
        addAuditEntry('DELETE', 'Escalations', `Escalation #${id}`, current.site, 'Deleted escalation case.');
        closeConfirmation();
      }
    });
  }, [escalations, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Documents ---
  const addDocument = useCallback((data: Omit<DocumentRecord, 'id'>) => {
    const execute = () => {
      const rec: DocumentRecord = {
        ...data,
        id: 'doc-' + Date.now()
      };
      setDocuments(prev => [rec, ...prev]);
      apiService.saveEntityRecord('documents', rec).catch(err => console.error('Document DB save error:', err));
      addAuditEntry('CREATE', 'Documents', `${rec.documentTitle}`, rec.site, `Uploaded document (${rec.category}) with confidentiality: ${rec.confidentiality}.`);
      closeConfirmation();
    };

    requestConfirmation({
      title: 'Confirm Document Attachment',
      message: `Upload and index document "${data.documentTitle}" for ${data.suName}?`,
      confirmLabel: 'Upload Document',
      onConfirm: execute
    });
  }, [addAuditEntry, requestConfirmation, closeConfirmation]);

  const deleteDocument = useCallback((id: string) => {
    const current = documents.find(d => d.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Document',
      message: `Permanently remove compliance document "${current.documentTitle}"?`,
      confirmLabel: 'Delete Document',
      isDanger: true,
      onConfirm: () => {
        setDocuments(prev => prev.filter(d => d.id !== id));
        apiService.deleteEntityRecord('documents', id).catch(err => console.error('Document DB delete error:', err));
        addAuditEntry('DELETE', 'Documents', `${current.documentTitle}`, current.site, 'Deleted document from system.');
        closeConfirmation();
      }
    });
  }, [documents, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: Maintenance Tracker ---
  const addMaintenanceRecord = useCallback((data: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => {
    const newRecord: MaintenanceRecord = {
      ...data,
      id: 'maint-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    setMaintenanceRecords(prev => [newRecord, ...prev]);
    apiService.saveEntityRecord('maintenance', newRecord).catch(err => console.error('Maintenance DB save error:', err));
    addAuditEntry('CREATE', 'Settings', `${newRecord.priority}: ${newRecord.description.substring(0, 30)}`, newRecord.site, `Logged maintenance defect (${newRecord.priorityTimeScale}).`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('maintenance.created', newRecord, {
      site: newRecord.site,
      severity: newRecord.priority === 'CAT 1' ? 'Critical' : 'Medium',
      entityId: newRecord.id
    });
    if (newRecord.priority === 'CAT 1') {
      triggerEmailNotification('maintenance.cat1_emergency', newRecord, {
        site: newRecord.site,
        severity: 'Critical',
        entityId: newRecord.id
      });
    }
  }, [addAuditEntry, triggerEmailNotification]);

  const updateMaintenanceRecord = useCallback((id: string, updates: Partial<MaintenanceRecord>) => {
    setMaintenanceRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates } : rec));
    apiService.updateEntityRecord('maintenance', id, updates).catch(err => console.error('Maintenance DB update error:', err));
    addAuditEntry('UPDATE', 'Settings', `Defect #${id}`, 'Site', 'Updated maintenance ticket progress/status.');
  }, [addAuditEntry]);

  const deleteMaintenanceRecord = useCallback((id: string) => {
    const current = maintenanceRecords.find(m => m.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Maintenance Record',
      message: `Are you sure you want to delete maintenance defect "${current.description}" at ${current.location}?`,
      confirmLabel: 'Delete Ticket',
      isDanger: true,
      onConfirm: () => {
        setMaintenanceRecords(prev => prev.filter(m => m.id !== id));
        apiService.deleteEntityRecord('maintenance', id).catch(err => console.error('Maintenance DB delete error:', err));
        addAuditEntry('DELETE', 'Settings', `Maintenance #${id}`, current.site, 'Deleted maintenance record.');
        closeConfirmation();
      }
    });
  }, [maintenanceRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- CRUD: SPCD Tracker ---
  const addSPCDRecord = useCallback((data: Omit<SPCDRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: SPCDRecord = {
      ...data,
      id: 'spcd-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setSpcdRecords(prev => [newRecord, ...prev]);
    apiService.saveEntityRecord('spcd', newRecord).catch(err => console.error('SPCD DB save error:', err));
    addAuditEntry('CREATE', 'Vulnerable SUs', `SPCD: ${newRecord.suName}`, newRecord.siteName, `Added SPCD record for ${newRecord.suName} (${newRecord.suPortReference}).`);
  }, [addAuditEntry]);

  const updateSPCDRecord = useCallback((id: string, updates: Partial<SPCDRecord>) => {
    const now = new Date().toISOString();
    setSpcdRecords(prev => {
      const next = prev.map(rec => rec.id === id ? { ...rec, ...updates, updatedAt: now } : rec);
      const merged = next.find(rec => rec.id === id);
      if (merged) {
        apiService.updateEntityRecord('spcd', id, merged).catch(err => console.error('SPCD DB update error:', err));
      }
      return next;
    });
    addAuditEntry('UPDATE', 'Vulnerable SUs', `SPCD #${id}`, 'Site', 'Updated SPCD follow-up notes & status.');
  }, [addAuditEntry]);

  const archiveSPCDRecord = useCallback((id: string, dateLeft?: string, reason?: string) => {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    const updatePayload = {
      isArchived: true,
      dateLeft: dateLeft || today,
      reasonForLeaving: reason || 'Departed / Accommodation Closed',
      updatedAt: now
    };
    setSpcdRecords(prev => {
      const next = prev.map(rec => rec.id === id ? { ...rec, ...updatePayload } : rec);
      const merged = next.find(rec => rec.id === id);
      if (merged) {
        apiService.updateEntityRecord('spcd', id, merged).catch(err => console.error('SPCD DB archive error:', err));
      }
      return next;
    });
    addAuditEntry('ARCHIVE', 'Vulnerable SUs', `SPCD #${id}`, 'Site', `Marked Service User as departed (Archived). Reason: ${reason || 'Departed'}`);
  }, [addAuditEntry]);

  const restoreSPCDRecord = useCallback((id: string) => {
    const now = new Date().toISOString();
    const updatePayload = {
      isArchived: false,
      updatedAt: now
    };
    setSpcdRecords(prev => {
      const next = prev.map(rec => rec.id === id ? { ...rec, ...updatePayload } : rec);
      const merged = next.find(rec => rec.id === id);
      if (merged) {
        apiService.updateEntityRecord('spcd', id, merged).catch(err => console.error('SPCD DB restore error:', err));
      }
      return next;
    });
    addAuditEntry('RESTORE', 'Vulnerable SUs', `SPCD #${id}`, 'Site', 'Restored Service User to Active SPCD list.');
  }, [addAuditEntry]);

  const deleteSPCDRecord = useCallback((id: string) => {
    const current = spcdRecords.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete SPCD Record',
      message: `Permanently delete SPCD case log for ${current.suName} (${current.suPortReference})?`,
      confirmLabel: 'Delete Case',
      isDanger: true,
      onConfirm: () => {
        setSpcdRecords(prev => prev.filter(s => s.id !== id));
        apiService.deleteEntityRecord('spcd', id).catch(err => console.error('SPCD DB delete error:', err));
        addAuditEntry('DELETE', 'Vulnerable SUs', `SPCD: ${current.suName}`, current.siteName, 'Deleted SPCD entry.');
        closeConfirmation();
      }
    });
  }, [spcdRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- 1. CRUD: Public Transport Tracker ---
  const addPublicTransportRecord = useCallback((data: Omit<PublicTransportRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: PublicTransportRecord = {
      ...data,
      id: 'pt-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setPublicTransportRecords(prev => [newRecord, ...prev]);
    addAuditEntry('CREATE', 'Settings', `Transport: ${newRecord.approvalUrn}`, 'Site', `Created transport approval ${newRecord.approvalUrn} for ${newRecord.suNames}.`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('transport.created', newRecord, {
      site: newRecord.siteName || newRecord.accommodationAddress,
      severity: 'Low',
      entityId: newRecord.approvalUrn
    });
    if (newRecord.exceptionalCircumstances && newRecord.exceptionalCircumstances.trim() !== '') {
      triggerEmailNotification('transport.exceptional_circumstance', newRecord, {
        site: newRecord.siteName || newRecord.accommodationAddress,
        severity: 'High',
        entityId: newRecord.approvalUrn
      });
    }
  }, [addAuditEntry, triggerEmailNotification]);

  const updatePublicTransportRecord = useCallback((id: string, updates: Partial<PublicTransportRecord>) => {
    const now = new Date().toISOString();
    setPublicTransportRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates, updatedAt: now } : rec));
    addAuditEntry('UPDATE', 'Settings', `Transport #${id}`, 'Site', 'Updated public transport approval record.');
  }, [addAuditEntry]);

  const deletePublicTransportRecord = useCallback((id: string) => {
    const current = publicTransportRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Transport Approval',
      message: `Are you sure you want to remove transport approval for ${current.suNames} (URN: ${current.approvalUrn})?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: () => {
        setPublicTransportRecords(prev => prev.filter(r => r.id !== id));
        addAuditEntry('DELETE', 'Settings', `Transport: ${current.approvalUrn}`, 'Site', 'Deleted transport approval record.');
        closeConfirmation();
      }
    });
  }, [publicTransportRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- 2. CRUD: SD-Compliance Tracker ---
  const addComplianceRecord = useCallback((data: Omit<SDComplianceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: SDComplianceRecord = {
      ...data,
      id: 'comp-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setComplianceRecords(prev => [newRecord, ...prev]);
    addAuditEntry('CREATE', 'Settings', `Compliance: ${newRecord.complianceType}`, newRecord.siteName || 'All Sites', `Logged compliance asset ${newRecord.complianceType} by ${newRecord.contractorName}.`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('compliance.created', newRecord, {
      site: newRecord.siteName || 'All Sites',
      severity: 'Medium',
      entityId: newRecord.complianceType
    });
  }, [addAuditEntry, triggerEmailNotification]);

  const updateComplianceRecord = useCallback((id: string, updates: Partial<SDComplianceRecord>) => {
    const now = new Date().toISOString();
    setComplianceRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates, updatedAt: now } : rec));
    addAuditEntry('UPDATE', 'Settings', `Compliance #${id}`, 'Site', 'Updated compliance certificate status.');
  }, [addAuditEntry]);

  const deleteComplianceRecord = useCallback((id: string) => {
    const current = complianceRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Compliance Asset',
      message: `Permanently delete compliance record for "${current.complianceType}" (${current.contractorName})?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: () => {
        setComplianceRecords(prev => prev.filter(r => r.id !== id));
        addAuditEntry('DELETE', 'Settings', `Compliance: ${current.complianceType}`, current.siteName || 'All Sites', 'Deleted compliance asset record.');
        closeConfirmation();
      }
    });
  }, [complianceRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- 3. CRUD: GP Appointments ---
  const addGPAppointmentRecord = useCallback((data: Omit<GPAppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: GPAppointmentRecord = {
      ...data,
      id: 'gp-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setGpAppointmentRecords(prev => [newRecord, ...prev]);
    addAuditEntry('CREATE', 'Referrals', `GP: ${newRecord.portReference}`, newRecord.siteName || 'Site', `Booked GP appointment for Room ${newRecord.roomNo} (${newRecord.portReference}).`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('gp.created', newRecord, {
      site: newRecord.siteName || 'All Sites',
      severity: 'Low',
      entityId: newRecord.portReference
    });
  }, [addAuditEntry, triggerEmailNotification]);

  const updateGPAppointmentRecord = useCallback((id: string, updates: Partial<GPAppointmentRecord>) => {
    const now = new Date().toISOString();
    setGpAppointmentRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates, updatedAt: now } : rec));
    addAuditEntry('UPDATE', 'Referrals', `GP #${id}`, 'Site', 'Updated GP appointment record.');
    
    if (updates.status === 'Cancelled') {
      triggerEmailNotification('gp.dna_missed', { id, ...updates }, {
        severity: 'Medium',
        entityId: id
      });
    }
  }, [addAuditEntry, triggerEmailNotification]);

  const deleteGPAppointmentRecord = useCallback((id: string) => {
    const current = gpAppointmentRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete GP Appointment',
      message: `Delete GP appointment record for Room ${current.roomNo} (Port Ref: ${current.portReference})?`,
      confirmLabel: 'Delete Appointment',
      isDanger: true,
      onConfirm: () => {
        setGpAppointmentRecords(prev => prev.filter(r => r.id !== id));
        addAuditEntry('DELETE', 'Referrals', `GP: ${current.portReference}`, current.siteName || 'Site', 'Deleted GP appointment record.');
        closeConfirmation();
      }
    });
  }, [gpAppointmentRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- 4. CRUD: RFA Welfare Checks ---
  const addRFAWelfareRecord = useCallback((data: Omit<RFAWelfareCheckRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: RFAWelfareCheckRecord = {
      ...data,
      id: 'rfa-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setRfaWelfareRecords(prev => [newRecord, ...prev]);
    addAuditEntry('CREATE', 'Vulnerable SUs', `RFA Welfare: ${newRecord.name}`, newRecord.siteName, `Conducted RFA welfare check for ${newRecord.name} (Room ${newRecord.roomOrFlatNo}).`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('welfare.created', newRecord, {
      site: newRecord.siteName,
      severity: 'Low',
      entityId: newRecord.portOrNassRef
    });
    if (newRecord.mhTicket && newRecord.mhTicket.trim() !== '') {
      triggerEmailNotification('welfare.mental_health_ticket', newRecord, {
        site: newRecord.siteName,
        severity: 'High',
        entityId: newRecord.portOrNassRef
      });
    }
  }, [addAuditEntry, triggerEmailNotification]);

  const updateRFAWelfareRecord = useCallback((id: string, updates: Partial<RFAWelfareCheckRecord>) => {
    const now = new Date().toISOString();
    setRfaWelfareRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates, updatedAt: now } : rec));
    addAuditEntry('UPDATE', 'Vulnerable SUs', `RFA #${id}`, 'Site', 'Updated RFA welfare check note.');
  }, [addAuditEntry]);

  const deleteRFAWelfareRecord = useCallback((id: string) => {
    const current = rfaWelfareRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Welfare Check',
      message: `Permanently delete RFA welfare check record for ${current.name} at ${current.siteName}?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: () => {
        setRfaWelfareRecords(prev => prev.filter(r => r.id !== id));
        addAuditEntry('DELETE', 'Vulnerable SUs', `RFA: ${current.name}`, current.siteName, 'Deleted RFA welfare entry.');
        closeConfirmation();
      }
    });
  }, [rfaWelfareRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- 5. CRUD: Dispersal Sheet ---
  const addDispersalRecord = useCallback((data: Omit<DispersalRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: DispersalRecord = {
      ...data,
      id: 'disp-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setDispersalRecords(prev => [newRecord, ...prev]);
    addAuditEntry('CREATE', 'Referrals', `Dispersal: ${newRecord.suPortNassRef}`, newRecord.siteName, `Recorded dispersal entry for SU ${newRecord.suPortNassRef} (Flat ${newRecord.flatRoomNumber}).`);
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('dispersal.created', newRecord, {
      site: newRecord.siteName,
      severity: 'Low',
      entityId: newRecord.suPortNassRef
    });
    if (newRecord.travelled === 'No' || (newRecord.reasonFailedToTravel && newRecord.reasonFailedToTravel.trim() !== '')) {
      triggerEmailNotification('dispersal.failed_to_travel', newRecord, {
        site: newRecord.siteName,
        severity: 'High',
        entityId: newRecord.suPortNassRef
      });
    }
  }, [addAuditEntry, triggerEmailNotification]);

  const updateDispersalRecord = useCallback((id: string, updates: Partial<DispersalRecord>) => {
    const now = new Date().toISOString();
    setDispersalRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates, updatedAt: now } : rec));
    addAuditEntry('UPDATE', 'Referrals', `Dispersal #${id}`, 'Site', 'Updated dispersal departure log.');
  }, [addAuditEntry]);

  const deleteDispersalRecord = useCallback((id: string) => {
    const current = dispersalRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Dispersal Entry',
      message: `Delete dispersal record for ${current.suPortNassRef} (Flat/Room ${current.flatRoomNumber})?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: () => {
        setDispersalRecords(prev => prev.filter(r => r.id !== id));
        addAuditEntry('DELETE', 'Referrals', `Dispersal: ${current.suPortNassRef}`, current.siteName, 'Deleted dispersal record.');
        closeConfirmation();
      }
    });
  }, [dispersalRecords, addAuditEntry, requestConfirmation, closeConfirmation]);

  // --- 6. CRUD: Booklets to be Collected ---
  const addBookletRecord = useCallback((data: Omit<BookletCollectionRecord, 'id'>) => {
    const newRecord: BookletCollectionRecord = {
      ...data,
      id: 'bkl-' + Date.now()
    };
    setBookletRecords(prev => [...prev, newRecord]);
    addAuditEntry('CREATE', 'Settings', `Booklet: ${newRecord.bookletType} (${newRecord.language})`, newRecord.hotelName, `Added booklet allocation record.`);
  }, [addAuditEntry]);

  const updateBookletRecord = useCallback((id: string, updates: Partial<BookletCollectionRecord>) => {
    const today = new Date().toISOString().split('T')[0];
    setBookletRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates, lastUpdated: today } : rec));
  }, []);

  const deleteBookletRecord = useCallback((id: string) => {
    setBookletRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const resetBookletsToDefault = useCallback(() => {
    setBookletRecords(INITIAL_BOOKLET_RECORDS);
    saveStorage('booklet_records', INITIAL_BOOKLET_RECORDS);
    addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Reset Booklets', 'All Sites', 'Reset booklet inventory to factory master default.');
  }, [addAuditEntry]);

  // --- 7. CRUD: SD VCS Support Agencies ---
  const addVCSAgency = useCallback((data: Omit<SDVCSAgency, 'id' | 'createdAt'>) => {
    const newRecord: SDVCSAgency = {
      ...data,
      id: 'vcs-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    setVcsAgencies(prev => [...prev, newRecord]);
    addAuditEntry('CREATE', 'Settings', `VCS Agency: ${newRecord.agencyName}`, newRecord.hotelName, `Registered partner support agency for ${newRecord.hotelName}.`);
  }, [addAuditEntry]);

  const updateVCSAgency = useCallback((id: string, updates: Partial<SDVCSAgency>) => {
    setVcsAgencies(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    addAuditEntry('UPDATE', 'Settings', `VCS Agency #${id}`, 'Site', 'Updated partner support agency details.');
  }, [addAuditEntry]);

  const deleteVCSAgency = useCallback((id: string) => {
    const current = vcsAgencies.find(a => a.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Remove VCS Partner Agency',
      message: `Are you sure you want to remove "${current.agencyName}" from ${current.hotelName}?`,
      confirmLabel: 'Remove Agency',
      isDanger: true,
      onConfirm: () => {
        setVcsAgencies(prev => prev.filter(a => a.id !== id));
        addAuditEntry('DELETE', 'Settings', `VCS: ${current.agencyName}`, current.hotelName, 'Removed support agency.');
        closeConfirmation();
      }
    });
  }, [vcsAgencies, addAuditEntry, requestConfirmation, closeConfirmation]);

  const resetVCSToDefault = useCallback(() => {
    setVcsAgencies(INITIAL_VCS_AGENCIES);
    saveStorage('vcs_agencies', INITIAL_VCS_AGENCIES);
    addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Reset VCS Agencies', 'All Sites', 'Reset voluntary and community sector agencies to master dataset.');
  }, [addAuditEntry]);

  // --- CRUD: Sites & Properties & Users ---
  const addSite = useCallback((data: Omit<SiteInfo, 'id'>) => {
    const newSite: SiteInfo = {
      ...data,
      id: 'site-' + Date.now()
    };
    setSites(prev => [...prev, newSite]);
    apiService.saveEntityRecord('sites', newSite).catch(err => console.error('Site DB save error:', err));
    addAuditEntry(
      'CREATE', 
      'Properties', 
      `Property: ${newSite.name}${newSite.pid ? ` (${newSite.pid})` : ''}`, 
      newSite.name, 
      `Created accommodation property record: ${newSite.name} in ${newSite.city} (Capacity: ${newSite.capacity} residents, Status: ${newSite.status}${newSite.leadOfficer ? `, Lead Officer: ${newSite.leadOfficer}` : ''}${newSite.contactNumber ? `, Contact: ${newSite.contactNumber}` : ''}).`
    );
  }, [addAuditEntry]);

  const updateSite = useCallback((id: string, updates: Partial<SiteInfo>) => {
    const current = sites.find(s => s.id === id);
    setSites(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    apiService.updateEntityRecord('sites', id, updates).catch(err => console.error('Site DB update error:', err));

    // Construct detailed audit trail diff for internal accountability
    const changes: string[] = [];
    if (updates.name && current && updates.name !== current.name) {
      changes.push(`Name changed: "${current.name}" → "${updates.name}"`);
    }
    if (updates.pid && current && updates.pid !== current.pid) {
      changes.push(`PID changed: "${current.pid || 'None'}" → "${updates.pid}"`);
    }
    if (updates.city && current && updates.city !== current.city) {
      changes.push(`City: "${current.city}" → "${updates.city}"`);
    }
    if (updates.capacity !== undefined && current && updates.capacity !== current.capacity) {
      changes.push(`Capacity: ${current.capacity} → ${updates.capacity} residents`);
    }
    if (updates.status && current && updates.status !== current.status) {
      changes.push(`Status: "${current.status}" → "${updates.status}"`);
    }
    if (updates.leadOfficer !== undefined && current && updates.leadOfficer !== current.leadOfficer) {
      changes.push(`Lead Officer: "${current.leadOfficer || 'Unassigned'}" → "${updates.leadOfficer || 'Unassigned'}"`);
    }
    if (updates.contactNumber !== undefined && current && updates.contactNumber !== current.contactNumber) {
      changes.push(`Phone: "${current.contactNumber || 'None'}" → "${updates.contactNumber}"`);
    }

    const propName = updates.name || current?.name || `Property #${id}`;
    const desc = changes.length > 0 ? changes.join('; ') : 'Updated property operational parameters';

    addAuditEntry(
      'UPDATE', 
      'Properties', 
      `Property: ${propName}${updates.pid || current?.pid ? ` (${updates.pid || current?.pid})` : ''}`, 
      propName, 
      `Updated property record for ${propName}: ${desc}.`
    );
  }, [sites, addAuditEntry]);

  const deleteSite = useCallback((id: string) => {
    const current = sites.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Decommission Facility Site',
      message: `Are you sure you want to delete ${current.name}? All associate records must be transferred.`,
      confirmLabel: 'Decommission Site',
      isDanger: true,
      onConfirm: () => {
        setSites(prev => prev.filter(s => s.id !== id));
        apiService.deleteEntityRecord('sites', id).catch(err => console.error('Site DB delete error:', err));
        addAuditEntry(
          'DELETE', 
          'Properties', 
          `Property: ${current.name}${current.pid ? ` (${current.pid})` : ''}`, 
          current.name, 
          `Decommissioned/deleted accommodation property: ${current.name} in ${current.city} (Capacity: ${current.capacity}, Lead: ${current.leadOfficer || 'Unassigned'}).`
        );
        closeConfirmation();
      }
    });
  }, [sites, addAuditEntry, requestConfirmation, closeConfirmation]);

  const updateUser = useCallback((id: string, updates: Partial<UserAccount>) => {
    const current = users.find(u => u.id === id);
    setUsers(prev => {
      const next = prev.map(u => u.id === id ? { ...u, ...updates } : u);
      saveStorage('users', next);
      return next;
    });
    apiService.updateUserAssignment(id, updates).catch(err => console.error('User Supabase assignment error:', err));
    apiService.updateEntityRecord('users', id, updates).catch(err => console.error('User DB update error:', err));

    // Construct detailed audit trail diff for internal accountability
    const changes: string[] = [];
    if (updates.name && current && updates.name !== current.name) {
      changes.push(`Name: "${current.name}" → "${updates.name}"`);
    }
    if (updates.email && current && updates.email !== current.email) {
      changes.push(`Email: "${current.email}" → "${updates.email}"`);
    }
    if (updates.role && current && updates.role !== current.role) {
      changes.push(`Role changed: "${current.role}" → "${updates.role}"`);
      triggerEmailNotification('user.role_changed', { ...current, newRole: updates.role, targetEmail: current.email }, {
        site: (current.assignedSites && current.assignedSites[0]) || 'All Sites',
        severity: 'High',
        entityId: current.email
      });
    }
    if (updates.status && current && updates.status !== current.status) {
      changes.push(`Status: "${current.status}" → "${updates.status}"`);
    }
    if (updates.assignedSites && current && JSON.stringify(updates.assignedSites) !== JSON.stringify(current.assignedSites)) {
      const currentSites = Array.isArray(current.assignedSites) ? current.assignedSites.join(', ') : ((current as any).assignedSite || 'All');
      const newSites = Array.isArray(updates.assignedSites) ? updates.assignedSites.join(', ') : 'All';
      changes.push(`Assigned Sites: [${currentSites}] → [${newSites}]`);
    }

    const userName = updates.name || current?.name || `User #${id}`;
    const userEmail = updates.email || current?.email || '';
    const desc = changes.length > 0 ? changes.join('; ') : 'Updated account profile & permissions';

    addAuditEntry(
      'UPDATE', 
      'Users', 
      `User: ${userName}${userEmail ? ` (${userEmail})` : ''}`, 
      (updates.assignedSites && updates.assignedSites[0]) || (current?.assignedSites && current.assignedSites[0]) || (current as any)?.assignedSite || 'All', 
      `Updated user record for ${userName}: ${desc}.`
    );
  }, [users, addAuditEntry, triggerEmailNotification]);

  const addUser = useCallback((userData: Omit<UserAccount, 'id' | 'lastActive'>) => {
    const safeAssignedSites = Array.isArray(userData.assignedSites) && userData.assignedSites.length > 0
      ? userData.assignedSites
      : [(userData as any).assignedSite || 'All Sites'];
    const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newUser: UserAccount = {
      ...userData,
      assignedSites: safeAssignedSites,
      id: generatedId,
      lastActive: 'Just now'
    };
    setUsers(prev => [...prev, newUser]);
    apiService.saveEntityRecord('users', newUser).catch(err => console.error('User DB save error:', err));
    
    // Automated configurable email notification dispatch
    triggerEmailNotification('user.created', newUser, {
      site: safeAssignedSites[0] || 'All Sites',
      severity: 'Medium',
      entityId: newUser.email
    });

    const assigned = safeAssignedSites.join(', ') || 'All Sites';
    addAuditEntry(
      'CREATE', 
      'Users', 
      `User: ${newUser.name} (${newUser.email})`, 
      safeAssignedSites[0] || 'All', 
      `Created user account for ${newUser.name} (Role: ${newUser.role}, Status: ${newUser.status}, Assigned: ${assigned}).`
    );
  }, [addAuditEntry, triggerEmailNotification]);

  const deleteUser = useCallback((id: string) => {
    const current = users.find(u => u.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete User Account',
      message: `Permanently delete user account for ${current.name} (${current.role})?`,
      confirmLabel: 'Delete User',
      isDanger: true,
      onConfirm: () => {
        setUsers(prev => prev.filter(u => u.id !== id));
        apiService.deleteEntityRecord('users', id).catch(err => console.error('User DB delete error:', err));
        const currentSite = (current.assignedSites && current.assignedSites[0]) || (current as any).assignedSite || 'All';
        addAuditEntry(
          'DELETE', 
          'Users', 
          `User: ${current.name} (${current.email})`, 
          currentSite, 
          `Permanently deleted user account for ${current.name} (Role: ${current.role}, Email: ${current.email}).`
        );
        closeConfirmation();
      }
    });
  }, [users, addAuditEntry, requestConfirmation, closeConfirmation]);

  const addUserGroup = useCallback((groupData: Omit<UserGroup, 'id'>) => {
    const newGroup: UserGroup = {
      ...groupData,
      id: `grp-${Date.now()}`
    };
    setUserGroups(prev => {
      const updated = [newGroup, ...prev];
      saveStorage('user_groups', updated);
      return updated;
    });
    addAuditEntry('CREATE', 'Users', newGroup.name, 'Group Creation', `Created user group "${newGroup.name}" with ${newGroup.userIds.length} users and ${newGroup.assignedProperties.length} properties.`);
  }, [addAuditEntry]);

  const updateUserGroup = useCallback((id: string, updates: Partial<UserGroup>) => {
    setUserGroups(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, ...updates } : g);
      saveStorage('user_groups', updated);
      return updated;
    });
    addAuditEntry('UPDATE', 'Users', id, 'Group Update', `Updated user group ${id}`);
  }, [addAuditEntry]);

  const deleteUserGroup = useCallback((id: string) => {
    setUserGroups(prev => {
      const updated = prev.filter(g => g.id !== id);
      saveStorage('user_groups', updated);
      return updated;
    });
    addAuditEntry('DELETE', 'Users', id, 'Group Deletion', `Deleted user group ${id}`);
  }, [addAuditEntry]);

  // Property CRUD aliases for Sites
  const addProperty = addSite;
  const updateProperty = updateSite;
  const deleteProperty = deleteSite;
  const properties = sites;

  // Sync with SharePoint simulator
  const syncSharePointNow = useCallback(() => {
    const start = performance.now();
    setTimeout(() => {
      const now = new Date().toISOString();
      setSettings(prev => ({ ...prev, lastSharePointSync: now }));
      addAuditEntry('SETTINGS_UPDATE', 'Settings', 'SharePoint Sync', 'All Sites', 'Synchronized active resident safeguarding files with Microsoft 365 SharePoint repository.');
      setNotifications(prev => [
        {
          id: 'notif-' + Date.now(),
          title: 'Manual SharePoint Sync Completed',
          description: `All records synced to Microsoft 365 in ${Math.round(performance.now() - start)}ms.`,
          time: 'Just now',
          type: 'sync',
          read: false,
          linkPage: 'reports'
        },
        ...prev
      ]);
    }, 400);
  }, [addAuditEntry]);

  // Reset Data to Clean Baseline
  const resetAllData = useCallback(() => {
    requestConfirmation({
      title: 'Reset Entire Application Database',
      message: 'CRITICAL SYSTEM OVERRIDE: This will restore the database to the clean initial demo dataset. All user created records and test entries will be replaced.',
      confirmLabel: 'Yes, Reset All Data',
      isDanger: true,
      onConfirm: () => {
        setSites(INITIAL_SITES);
        setReferrals(INITIAL_REFERRALS);
        setVulnerableSUs(INITIAL_VULNERABLE);
        setChallengingSUs(INITIAL_CHALLENGING);
        setLaundryRecords(INITIAL_LAUNDRY);
        setFoodRecords(INITIAL_FOOD);
        setEscalations(INITIAL_ESCALATIONS);
        setDocuments(INITIAL_DOCUMENTS);
        setUsers(INITIAL_USERS);
        setAuditLogs(INITIAL_AUDIT);
        setSettings(INITIAL_SETTINGS);
        setMaintenanceRecords(INITIAL_MAINTENANCE_RECORDS);
        setSpcdRecords(INITIAL_SPCD_RECORDS);
        addAuditEntry('DATA_RESTORE', 'Settings', 'Full System Database', 'System', 'Reverted database to baseline demonstration state.');
        closeConfirmation();
      }
    });
  }, [requestConfirmation, addAuditEntry, closeConfirmation]);

  // Reset Properties to official master list
  const resetPropertiesToDefault = useCallback(() => {
    setSites(INITIAL_SITES);
    saveStorage('sites', INITIAL_SITES);
    addAuditEntry('UPDATE', 'Properties', 'Hotel Directory (16 Properties)', 'All', 'Synchronized and reloaded official master hotel directory.');
    setNotifications(prev => [
      {
        id: 'notif-' + Date.now(),
        title: 'Properties List Synchronized',
        description: 'Successfully updated accommodation properties to the master list of 16 hotels with official PIDs.',
        time: 'Just now',
        type: 'success',
        read: false,
        linkPage: 'properties'
      },
      ...prev
    ]);
  }, [addAuditEntry]);

  // Restore from JSON Backup
  const restoreBackup = useCallback((jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.sites && parsed.referrals) {
        setSites(parsed.sites);
        setReferrals(parsed.referrals);
        if (parsed.vulnerableSUs) setVulnerableSUs(parsed.vulnerableSUs);
        if (parsed.challengingSUs) setChallengingSUs(parsed.challengingSUs);
        if (parsed.laundryRecords) setLaundryRecords(parsed.laundryRecords);
        if (parsed.foodRecords) setFoodRecords(parsed.foodRecords);
        if (parsed.escalations) setEscalations(parsed.escalations);
        if (parsed.documents) setDocuments(parsed.documents);
        addAuditEntry('DATA_RESTORE', 'Settings', 'JSON Backup Restore', 'System', 'Imported external JSON backup archive.');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [addAuditEntry]);

  // Data Retention & Batch Performance Maintenance
  const getBatchRetentionStats = useCallback((cutoffDate: string): BatchRetentionModuleStat[] => {
    if (!cutoffDate) return [];

    // Referrals
    const refOlder = referrals.filter(r => (r.dateReferred || r.createdAt.slice(0, 10)) <= cutoffDate);
    const refActive = refOlder.filter(r => r.status !== 'Archived');
    const refArchived = refOlder.filter(r => r.status === 'Archived');

    // Vulnerable SUs
    const vulOlder = vulnerableSUs.filter(v => (v.reviewDate || v.createdAt.slice(0, 10)) <= cutoffDate);
    const vulActive = vulOlder.filter(v => v.status !== 'Archived');
    const vulArchived = vulOlder.filter(v => v.status === 'Archived');

    // Challenging SUs
    const chalOlder = challengingSUs.filter(c => (c.dateOfIncident || c.date || c.createdAt.slice(0, 10)) <= cutoffDate);
    const chalActive = chalOlder.filter(c => c.status !== 'Archived');
    const chalArchived = chalOlder.filter(c => c.status === 'Archived');

    // SPCD Records
    const spcdOlder = spcdRecords.filter(s => (s.date || s.createdAt.slice(0, 10)) <= cutoffDate);
    const spcdActive = spcdOlder.filter(s => !s.isArchived);
    const spcdArchived = spcdOlder.filter(s => s.isArchived);

    // Maintenance Records
    const maintOlder = maintenanceRecords.filter(m => (m.date || m.createdAt.slice(0, 10)) <= cutoffDate);
    const maintActive = maintOlder.filter(m => m.defectStatus !== 'Completed' && m.action !== 'Closed');
    const maintArchived = maintOlder.filter(m => m.defectStatus === 'Completed' || m.action === 'Closed');

    // Escalations
    const escOlder = escalations.filter(e => (e.dateOfIncident || e.createdAt.slice(0, 10)) <= cutoffDate);
    const escActive = escOlder.filter(e => e.status !== 'Resolved');
    const escArchived = escOlder.filter(e => e.status === 'Resolved');

    // Food Records
    const foodOlder = foodRecords.filter(f => f.createdAt.slice(0, 10) <= cutoffDate);

    // Laundry Records
    const laundryOlder = laundryRecords.filter(l => (l.date || l.createdAt.slice(0, 10)) <= cutoffDate);

    // Documents
    const docOlder = documents.filter(d => d.uploadDate <= cutoffDate);

    // Audit Logs
    const auditOlder = auditLogs.filter(a => a.timestamp.slice(0, 10) <= cutoffDate);

    return [
      {
        id: 'referrals',
        name: 'Safeguarding Referrals',
        dateFieldLabel: 'Date of Referral',
        totalOlder: refOlder.length,
        activeOlder: refActive.length,
        archivedOlder: refArchived.length,
        supportsArchive: true
      },
      {
        id: 'vulnerable',
        name: 'Vulnerable Service Users',
        dateFieldLabel: 'Review Date / Created',
        totalOlder: vulOlder.length,
        activeOlder: vulActive.length,
        archivedOlder: vulArchived.length,
        supportsArchive: true
      },
      {
        id: 'challenging',
        name: 'Challenging Behaviour Logs',
        dateFieldLabel: 'Incident Date',
        totalOlder: chalOlder.length,
        activeOlder: chalActive.length,
        archivedOlder: chalArchived.length,
        supportsArchive: true
      },
      {
        id: 'spcd',
        name: 'SPCD Move-On Tracker',
        dateFieldLabel: 'Allocation Date',
        totalOlder: spcdOlder.length,
        activeOlder: spcdActive.length,
        archivedOlder: spcdArchived.length,
        supportsArchive: true
      },
      {
        id: 'maintenance',
        name: 'Maintenance Tracker',
        dateFieldLabel: 'Reported Date',
        totalOlder: maintOlder.length,
        activeOlder: maintActive.length,
        archivedOlder: maintArchived.length,
        supportsArchive: true
      },
      {
        id: 'escalations',
        name: 'Escalations & Incidents',
        dateFieldLabel: 'Incident Date',
        totalOlder: escOlder.length,
        activeOlder: escActive.length,
        archivedOlder: escArchived.length,
        supportsArchive: true
      },
      {
        id: 'food',
        name: 'Food Distribution Logs',
        dateFieldLabel: 'Meal Date',
        totalOlder: foodOlder.length,
        activeOlder: foodOlder.length,
        archivedOlder: 0,
        supportsArchive: false
      },
      {
        id: 'laundry',
        name: 'Laundry Usage Logs',
        dateFieldLabel: 'Token Issue Date',
        totalOlder: laundryOlder.length,
        activeOlder: laundryOlder.length,
        archivedOlder: 0,
        supportsArchive: false
      },
      {
        id: 'documents',
        name: 'Compliance Documents',
        dateFieldLabel: 'Upload Date',
        totalOlder: docOlder.length,
        activeOlder: docOlder.length,
        archivedOlder: 0,
        supportsArchive: false
      },
      {
        id: 'audit',
        name: 'Audit Trail Activity Logs',
        dateFieldLabel: 'Timestamp',
        totalOlder: auditOlder.length,
        activeOlder: auditOlder.length,
        archivedOlder: 0,
        supportsArchive: false
      }
    ];
  }, [referrals, vulnerableSUs, challengingSUs, spcdRecords, maintenanceRecords, escalations, foodRecords, laundryRecords, documents, auditLogs]);

  const batchArchiveRecordsOlderThan = useCallback((targetModule: string, cutoffDate: string): BatchRetentionExecutionResult => {
    let totalAffected = 0;
    const moduleCounts: Record<string, number> = {};

    if (targetModule === 'all' || targetModule === 'referrals') {
      let count = 0;
      setReferrals(prev => prev.map(r => {
        const d = r.dateReferred || r.createdAt.slice(0, 10);
        if (d <= cutoffDate && r.status !== 'Archived') {
          count++;
          return { ...r, status: 'Archived', updatedAt: new Date().toISOString() };
        }
        return r;
      }));
      if (count > 0) {
        moduleCounts['Safeguarding Referrals'] = count;
        totalAffected += count;
      }
    }

    if (targetModule === 'all' || targetModule === 'vulnerable') {
      let count = 0;
      setVulnerableSUs(prev => prev.map(v => {
        const d = v.reviewDate || v.createdAt.slice(0, 10);
        if (d <= cutoffDate && v.status !== 'Archived') {
          count++;
          return { ...v, status: 'Archived', updatedAt: new Date().toISOString() };
        }
        return v;
      }));
      if (count > 0) {
        moduleCounts['Vulnerable SUs'] = count;
        totalAffected += count;
      }
    }

    if (targetModule === 'all' || targetModule === 'challenging') {
      let count = 0;
      setChallengingSUs(prev => prev.map(c => {
        const d = c.dateOfIncident || c.date || c.createdAt.slice(0, 10);
        if (d <= cutoffDate && c.status !== 'Archived') {
          count++;
          return { ...c, status: 'Archived', updatedAt: new Date().toISOString() };
        }
        return c;
      }));
      if (count > 0) {
        moduleCounts['Challenging Behaviour'] = count;
        totalAffected += count;
      }
    }

    if (targetModule === 'all' || targetModule === 'spcd') {
      let count = 0;
      setSpcdRecords(prev => prev.map(s => {
        const d = s.date || s.createdAt.slice(0, 10);
        if (d <= cutoffDate && !s.isArchived) {
          count++;
          return {
            ...s,
            isArchived: true,
            dateLeft: s.dateLeft || cutoffDate,
            reasonForLeaving: s.reasonForLeaving || 'Batch retention maintenance archive',
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      }));
      if (count > 0) {
        moduleCounts['SPCD Move-On Tracker'] = count;
        totalAffected += count;
      }
    }

    if (targetModule === 'all' || targetModule === 'maintenance') {
      let count = 0;
      setMaintenanceRecords(prev => prev.map(m => {
        const d = m.date || m.createdAt.slice(0, 10);
        if (d <= cutoffDate && m.defectStatus !== 'Completed' && m.action !== 'Closed') {
          count++;
          return { ...m, status: 'Resolved' };
        }
        return m;
      }));
      if (count > 0) {
        moduleCounts['Maintenance Tracker'] = count;
        totalAffected += count;
      }
    }

    if (targetModule === 'all' || targetModule === 'escalations') {
      let count = 0;
      setEscalations(prev => prev.map(e => {
        const d = e.dateOfIncident || e.createdAt.slice(0, 10);
        if (d <= cutoffDate && e.status !== 'Resolved') {
          count++;
          return { ...e, status: 'Resolved' };
        }
        return e;
      }));
      if (count > 0) {
        moduleCounts['Escalations & Incidents'] = count;
        totalAffected += count;
      }
    }

    addAuditEntry(
      'ARCHIVE',
      'Settings',
      `Batch Retention Archive (${totalAffected} records)`,
      'All Sites',
      `Batch archived ${totalAffected} records older than ${cutoffDate}. Modules: ${Object.entries(moduleCounts).map(([k, v]) => `${k} (${v})`).join(', ') || 'None'}.`
    );

    return {
      totalAffected,
      action: 'archive',
      cutoffDate,
      moduleCounts
    };
  }, [addAuditEntry]);

  const batchDeleteRecordsOlderThan = useCallback((targetModule: string, cutoffDate: string, onlyArchived: boolean = false): BatchRetentionExecutionResult => {
    let totalAffected = 0;
    const moduleCounts: Record<string, number> = {};

    if (targetModule === 'all' || targetModule === 'referrals') {
      const removed = referrals.filter(r => {
        const d = r.dateReferred || r.createdAt.slice(0, 10);
        return d <= cutoffDate && (!onlyArchived || r.status === 'Archived');
      }).length;

      setReferrals(prev => prev.filter(r => {
        const d = r.dateReferred || r.createdAt.slice(0, 10);
        const matchesDate = d <= cutoffDate;
        if (!matchesDate) return true;
        if (onlyArchived) return r.status !== 'Archived';
        return false;
      }));

      if (removed > 0) {
        moduleCounts['Safeguarding Referrals'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'vulnerable') {
      const removed = vulnerableSUs.filter(v => {
        const d = v.reviewDate || v.createdAt.slice(0, 10);
        return d <= cutoffDate && (!onlyArchived || v.status === 'Archived');
      }).length;

      setVulnerableSUs(prev => prev.filter(v => {
        const d = v.reviewDate || v.createdAt.slice(0, 10);
        const matchesDate = d <= cutoffDate;
        if (!matchesDate) return true;
        if (onlyArchived) return v.status !== 'Archived';
        return false;
      }));

      if (removed > 0) {
        moduleCounts['Vulnerable SUs'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'challenging') {
      const removed = challengingSUs.filter(c => {
        const d = c.dateOfIncident || c.date || c.createdAt.slice(0, 10);
        return d <= cutoffDate && (!onlyArchived || c.status === 'Archived');
      }).length;

      setChallengingSUs(prev => prev.filter(c => {
        const d = c.dateOfIncident || c.date || c.createdAt.slice(0, 10);
        const matchesDate = d <= cutoffDate;
        if (!matchesDate) return true;
        if (onlyArchived) return c.status !== 'Archived';
        return false;
      }));

      if (removed > 0) {
        moduleCounts['Challenging Behaviour'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'spcd') {
      const removed = spcdRecords.filter(s => {
        const d = s.date || s.createdAt.slice(0, 10);
        return d <= cutoffDate && (!onlyArchived || s.isArchived);
      }).length;

      setSpcdRecords(prev => prev.filter(s => {
        const d = s.date || s.createdAt.slice(0, 10);
        const matchesDate = d <= cutoffDate;
        if (!matchesDate) return true;
        if (onlyArchived) return !s.isArchived;
        return false;
      }));

      if (removed > 0) {
        moduleCounts['SPCD Move-On Tracker'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'maintenance') {
      const removed = maintenanceRecords.filter(m => {
        const d = m.date || m.createdAt.slice(0, 10);
        return d <= cutoffDate && (!onlyArchived || m.defectStatus === 'Completed' || m.action === 'Closed');
      }).length;

      setMaintenanceRecords(prev => prev.filter(m => {
        const d = m.date || m.createdAt.slice(0, 10);
        const matchesDate = d <= cutoffDate;
        if (!matchesDate) return true;
        if (onlyArchived) return m.defectStatus !== 'Completed' && m.action !== 'Closed';
        return false;
      }));

      if (removed > 0) {
        moduleCounts['Maintenance Tracker'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'escalations') {
      const removed = escalations.filter(e => {
        const d = e.dateOfIncident || e.createdAt.slice(0, 10);
        return d <= cutoffDate && (!onlyArchived || e.status === 'Resolved');
      }).length;

      setEscalations(prev => prev.filter(e => {
        const d = e.dateOfIncident || e.createdAt.slice(0, 10);
        const matchesDate = d <= cutoffDate;
        if (!matchesDate) return true;
        if (onlyArchived) return e.status !== 'Resolved';
        return false;
      }));

      if (removed > 0) {
        moduleCounts['Escalations & Incidents'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'food') {
      const removed = foodRecords.filter(f => f.createdAt.slice(0, 10) <= cutoffDate).length;
      setFoodRecords(prev => prev.filter(f => f.createdAt.slice(0, 10) > cutoffDate));
      if (removed > 0) {
        moduleCounts['Food Distribution Logs'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'laundry') {
      const removed = laundryRecords.filter(l => (l.date || l.createdAt.slice(0, 10)) <= cutoffDate).length;
      setLaundryRecords(prev => prev.filter(l => (l.date || l.createdAt.slice(0, 10)) > cutoffDate));
      if (removed > 0) {
        moduleCounts['Laundry Usage Logs'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'documents') {
      const removed = documents.filter(d => d.uploadDate <= cutoffDate).length;
      setDocuments(prev => prev.filter(d => d.uploadDate > cutoffDate));
      if (removed > 0) {
        moduleCounts['Compliance Documents'] = removed;
        totalAffected += removed;
      }
    }

    if (targetModule === 'all' || targetModule === 'audit') {
      const removed = auditLogs.filter(a => a.timestamp.slice(0, 10) <= cutoffDate).length;
      setAuditLogs(prev => prev.filter(a => a.timestamp.slice(0, 10) > cutoffDate));
      if (removed > 0) {
        moduleCounts['Audit Trail Logs'] = removed;
        totalAffected += removed;
      }
    }

    addAuditEntry(
      'DELETE',
      'Settings',
      `Batch Retention Purge (${totalAffected} records)`,
      'All Sites',
      `Permanently purged ${totalAffected} records older than ${cutoffDate}${onlyArchived ? ' (archived only)' : ''}. Modules: ${Object.entries(moduleCounts).map(([k, v]) => `${k} (${v})`).join(', ') || 'None'}.`
    );

    return {
      totalAffected,
      action: 'delete',
      cutoffDate,
      moduleCounts
    };
  }, [referrals, vulnerableSUs, challengingSUs, spcdRecords, maintenanceRecords, escalations, foodRecords, laundryRecords, documents, auditLogs, addAuditEntry]);

  // Master Setup & Field Options Manager Handlers
  const getFieldOptions = useCallback((category: FieldOptionCategory, includeInactive = false): CustomFieldOption[] => {
    return fieldOptions
      .filter(opt => opt.category === category && (includeInactive || opt.isActive))
      .sort((a, b) => a.order - b.order);
  }, [fieldOptions]);

  const addFieldOption = useCallback((option: Omit<CustomFieldOption, 'id' | 'order'>): CustomFieldOption => {
    const catOptions = fieldOptions.filter(o => o.category === option.category);
    const nextOrder = catOptions.length > 0 ? Math.max(...catOptions.map(o => o.order)) + 1 : 1;
    const newOption: CustomFieldOption = {
      ...option,
      id: 'opt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      order: nextOrder
    };
    const updated = [...fieldOptions, newOption];
    setFieldOptions(updated);
    saveStorage('field_options', updated);
    addAuditEntry('CREATE', 'Settings', `Field Option: ${option.label}`, 'All Sites', `Added new option "${option.label}" to category "${option.category}".`);
    return newOption;
  }, [fieldOptions, addAuditEntry]);

  const updateFieldOption = useCallback((id: string, updates: Partial<CustomFieldOption>) => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    const updated = fieldOptions.map(o => o.id === id ? { ...o, ...updates } : o);
    setFieldOptions(updated);
    saveStorage('field_options', updated);
    addAuditEntry('UPDATE', 'Settings', `Field Option: ${target.label}`, 'All Sites', `Updated option "${target.label}" in category "${target.category}".`);
  }, [fieldOptions, addAuditEntry]);

  const deleteFieldOption = useCallback((id: string) => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    const updated = fieldOptions.filter(o => o.id !== id);
    setFieldOptions(updated);
    saveStorage('field_options', updated);
    addAuditEntry('DELETE', 'Settings', `Field Option: ${target.label}`, 'All Sites', `Deleted option "${target.label}" from category "${target.category}".`);
  }, [fieldOptions, addAuditEntry]);

  const toggleFieldOptionStatus = useCallback((id: string) => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    const updated = fieldOptions.map(o => o.id === id ? { ...o, isActive: !o.isActive } : o);
    setFieldOptions(updated);
    saveStorage('field_options', updated);
    addAuditEntry('UPDATE', 'Settings', `Field Option Status: ${target.label}`, 'All Sites', `Changed active status of "${target.label}" to ${!target.isActive}.`);
  }, [fieldOptions, addAuditEntry]);

  const reorderFieldOption = useCallback((id: string, direction: 'up' | 'down') => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    const catOptions = fieldOptions.filter(o => o.category === target.category).sort((a, b) => a.order - b.order);
    const index = catOptions.findIndex(o => o.id === id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === catOptions.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const other = catOptions[swapIndex];
    if (!other) return;

    const updated = fieldOptions.map(o => {
      if (o.id === target.id) return { ...o, order: other.order };
      if (o.id === other.id) return { ...o, order: target.order };
      return o;
    });

    setFieldOptions(updated);
    saveStorage('field_options', updated);
  }, [fieldOptions]);

  const resetFieldOptionsCategory = useCallback((category?: FieldOptionCategory) => {
    let updated: CustomFieldOption[];
    if (category) {
      const standardForCat = DEFAULT_FIELD_OPTIONS.filter(o => o.category === category);
      updated = [...fieldOptions.filter(o => o.category !== category), ...standardForCat];
    } else {
      updated = DEFAULT_FIELD_OPTIONS;
    }
    setFieldOptions(updated);
    saveStorage('field_options', updated);
    addAuditEntry('UPDATE', 'Settings', 'Reset Field Options', 'All Sites', `Reset field options to system defaults${category ? ` for category "${category}"` : ''}.`);
  }, [fieldOptions, addAuditEntry]);

  return (
    <AppContext.Provider value={{
      currentUserRole,
      setCurrentUserRole,
      currentUserName,
      assignedSite,
      setAssignedSite,
      selectedSite,
      setSelectedSite,
      allowedSites,
      settings,
      updateSettings,
      activePage,
      setActivePage,
      globalSearchFilter,
      setGlobalSearchFilter,
      navigateToPageWithSearch: (page: string, searchFilter?: string) => {
        setActivePage(page);
        if (searchFilter !== undefined) {
          setGlobalSearchFilter(searchFilter);
        }
      },
      confirmModal,
      requestConfirmation,
      closeConfirmation,
      notifications,
      unreadNotificationCount,
      markNotificationAsRead,
      clearAllNotifications,
      isFastCacheActive: settings.enableFastCache,
      lastOperationDurationMs,
      sites,
      referrals,
      vulnerableSUs,
      challengingSUs,
      laundryRecords,
      propertyLaundryLogs,
      foodRecords,
      foodVendorBuffetLogs,
      foodVendorsList,
      escalations,
      documents,
      maintenanceRecords,
      addMaintenanceRecord,
      updateMaintenanceRecord,
      deleteMaintenanceRecord,
      spcdRecords,
      addSPCDRecord,
      updateSPCDRecord,
      archiveSPCDRecord,
      restoreSPCDRecord,
      deleteSPCDRecord,
      publicTransportRecords,
      addPublicTransportRecord,
      updatePublicTransportRecord,
      deletePublicTransportRecord,
      complianceRecords,
      addComplianceRecord,
      updateComplianceRecord,
      deleteComplianceRecord,
      gpAppointmentRecords,
      addGPAppointmentRecord,
      updateGPAppointmentRecord,
      deleteGPAppointmentRecord,
      rfaWelfareRecords,
      addRFAWelfareRecord,
      updateRFAWelfareRecord,
      deleteRFAWelfareRecord,
      dispersalRecords,
      addDispersalRecord,
      updateDispersalRecord,
      deleteDispersalRecord,
      bookletRecords,
      addBookletRecord,
      updateBookletRecord,
      deleteBookletRecord,
      resetBookletsToDefault,
      vcsAgencies,
      addVCSAgency,
      updateVCSAgency,
      deleteVCSAgency,
      resetVCSToDefault,
      properties,
      addProperty,
      updateProperty,
      deleteProperty,
      addSite,
      updateSite,
      deleteSite,
      addUser,
      updateUser,
      deleteUser,
      fieldOptions,
      getFieldOptions,
      addFieldOption,
      updateFieldOption,
      deleteFieldOption,
      toggleFieldOptionStatus,
      reorderFieldOption,
      resetFieldOptionsCategory,
      users,
      userGroups,
      addUserGroup,
      updateUserGroup,
      deleteUserGroup,
      auditLogs,
      dataChangeRequests,
      addDataChangeRequest,
      reviewDataChangeRequest,
      rolePermissions,
      updateRolePermissions,
      resetRolePermissions,
      canDeleteRecord,
      canEditRecord,
      canCreateRecord,
      canManageSettings,
      canManageRoles,
      canAccessAllSites,
      canManageFiles,
      canManageProperties,
      canManageUsers,
      addReferral,
      updateReferral,
      archiveReferral,
      restoreReferral,
      deleteReferral,
      addVulnerableSU,
      updateVulnerableSU,
      archiveVulnerableSU,
      restoreVulnerableSU,
      deleteVulnerableSU,
      addChallengingSU,
      updateChallengingSU,
      archiveChallengingSU,
      restoreChallengingSU,
      deleteChallengingSU,
      addLaundryRecord,
      updateLaundryRecord,
      deleteLaundryRecord,
      addPropertyLaundryLog,
      updatePropertyLaundryLog,
      deletePropertyLaundryLog,
      addFoodRecord,
      updateFoodRecord,
      deleteFoodRecord,
      addFoodVendorBuffetLog,
      updateFoodVendorBuffetLog,
      deleteFoodVendorBuffetLog,
      addEscalation,
      updateEscalation,
      deleteEscalation,
      addDocument,
      deleteDocument,
      syncSharePointNow,
      resetAllData,
      resetPropertiesToDefault,
      restoreBackup,
      cacheStats,
      syncFromDatabase,
      triggerBackgroundDeltaSync,
      lookupPropertyById,
      lookupPropertyByName,
      lookupUserById,
      lookupUserByEmail,
      lookupUsersByRole,
      getBatchRetentionStats,
      batchArchiveRecordsOlderThan,
      batchDeleteRecordsOlderThan,
      isSessionLocked,
      sessionLockReason,
      lockSession,
      unlockSession,
      remainingInactivitySeconds,
      resetInactivityTimer,
      sessionToken,
      authProfile,
      isAuthenticated: !!sessionToken,
      isAuthChecking,
      authLoading,
      authError,
      authBlockedState,
      clearAuthBlockedState,
      diagnosticModalOpen,
      setDiagnosticModalOpen,
      login,
      logout,
      isPasswordRecoveryMode,
      setIsPasswordRecoveryMode,
      recoveryAccessToken,
      recoveryEmail,
      notificationRules,
      emailNotificationLogs,
      updateNotificationRule,
      toggleNotificationRule,
      resetNotificationRules,
      triggerEmailNotification,
      refreshNotificationData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
