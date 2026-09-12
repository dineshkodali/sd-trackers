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
import { apiService, AuditDescriptor } from '../services/apiService';
import { tableSchemaService } from '../services/tableSchemaService';
import { migrateLegacyLocalData, hasLegacyLocalData, purgeAllLegacyLocalStorage } from '../services/legacyLocalDataMigration';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import { diagnosticLogger, parseJwtPayload } from '../utils/diagnosticLogger';
import { AuthBlockedInfo } from '../components/auth/AuthenticationBlockedView';

/**
 * Live-database connection state shown in the header and on Settings.
 * There is no local fallback: when the database cannot be reached, changes
 * are refused and the user is told, rather than being kept in browser storage.
 */
export interface LiveDataStatus {
  state: 'idle' | 'loading' | 'live' | 'degraded' | 'offline';
  lastSyncAt: string | null;
  message: string | null;
  /** Modules whose data could not be loaded on the last sync. */
  unavailable: string[];
  /** Tables the database does not have yet (migration pending). */
  missingTables: string[];
}

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
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileCompactView: boolean;
  setIsMobileCompactView: React.Dispatch<React.SetStateAction<boolean>>;

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
  updateDocument: (id: string, updates: Partial<DocumentRecord>) => void;
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
  buildBackupSnapshot: () => Record<string, any>;

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
  liveDataStatus: LiveDataStatus;

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

/**
 * Browser storage now holds only the session (token, signed-in user, active
 * role and site). Every record lives in the live database; legacy copies left
 * by earlier versions are moved there once by legacyLocalDataMigration.
 */
const STORAGE_KEY_PREFIX = 'sg_tracker_';

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

function getInitialAssignedSite(): string {
  return String(loadStorage('assigned_site', 'Brit Hotel' as string));
}

/** Role permissions rows from the database, keyed by role, over the built-in defaults. */
function rolePermissionsFromRows(rows: any[]): Record<RoleType, RolePermissions> {
  const merged: Record<string, RolePermissions> = { ...INITIAL_ROLE_PERMISSIONS };
  for (const row of rows) {
    const role = row?.role || row?.id;
    if (!role) continue;
    const base = (INITIAL_ROLE_PERMISSIONS as Record<string, RolePermissions>)[role] || INITIAL_ROLE_PERMISSIONS.Staff;
    const perms = { ...base };
    for (const key of Object.keys(base) as (keyof RolePermissions)[]) {
      if (typeof row[key] === 'boolean') perms[key] = row[key];
    }
    merged[role] = perms;
  }
  return merged as Record<RoleType, RolePermissions>;
}

type RecordSetter<T> = React.Dispatch<React.SetStateAction<T[]>>;

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
  const [activePage, setActivePageRaw] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileCompactView, setIsMobileCompactView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const setActivePage = useCallback((page: string) => {
    setActivePageRaw(page);
    setIsMobileSidebarOpen(false); // Automatically close mobile drawer when navigating
  }, []);

  const [globalSearchFilter, setGlobalSearchFilter] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('all');
  // Configuration starts at the built-in defaults and is replaced by the live
  // database values on the first sync. Operational records start empty.
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [lastOperationDurationMs, setLastOperationDurationMs] = useState<number>(8);
  const [confirmModal, setConfirmModal] = useState<ConfirmationRequest | null>(null);

  // Proactively purge any residual localStorage operational data on startup
  useEffect(() => {
    purgeAllLegacyLocalStorage();
  }, []);

  // Entities — loaded strictly from the live database by syncFromDatabase
  const [sites, setSites] = useState<SiteInfo[]>(() => deduplicateSites(INITIAL_SITES));
  const [referrals, setReferrals] = useState<SGReferral[]>(INITIAL_REFERRALS);
  const [vulnerableSUs, setVulnerableSUs] = useState<VulnerableSU[]>(INITIAL_VULNERABLE);
  const [challengingSUs, setChallengingSUs] = useState<ChallengingSU[]>(INITIAL_CHALLENGING);
  const [laundryRecords, setLaundryRecords] = useState<LaundryRecord[]>(INITIAL_LAUNDRY);
  const [propertyLaundryLogs, setPropertyLaundryLogs] = useState<PropertyLaundryLog[]>(INITIAL_PROPERTY_LAUNDRY_LOGS);
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>(INITIAL_FOOD);
  const [foodVendorBuffetLogs, setFoodVendorBuffetLogs] = useState<PropertyFoodVendorBuffetLog[]>(INITIAL_FOOD_VENDOR_BUFFET_LOGS);
  const foodVendorsList = FOOD_VENDORS;
  const [escalations, setEscalations] = useState<EscalationRecord[]>(INITIAL_ESCALATIONS);
  const [documents, setDocuments] = useState<DocumentRecord[]>(INITIAL_DOCUMENTS);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(INITIAL_MAINTENANCE_RECORDS);
  const [spcdRecords, setSpcdRecords] = useState<SPCDRecord[]>(INITIAL_SPCD_RECORDS);
  const [publicTransportRecords, setPublicTransportRecords] = useState<PublicTransportRecord[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<SDComplianceRecord[]>([]);
  const [gpAppointmentRecords, setGpAppointmentRecords] = useState<GPAppointmentRecord[]>([]);
  const [rfaWelfareRecords, setRfaWelfareRecords] = useState<RFAWelfareCheckRecord[]>([]);
  const [dispersalRecords, setDispersalRecords] = useState<DispersalRecord[]>([]);
  const [bookletRecords, setBookletRecords] = useState<BookletCollectionRecord[]>([]);
  const [vcsAgencies, setVcsAgencies] = useState<SDVCSAgency[]>([]);
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>(DEFAULT_NOTIFICATION_RULES);
  const [emailNotificationLogs, setEmailNotificationLogs] = useState<EmailNotificationLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>(() => INITIAL_USERS);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT);
  const [dataChangeRequests, setDataChangeRequests] = useState<DataChangeRequest[]>(INITIAL_CHANGE_REQUESTS);

  const [rolePermissions, setRolePermissions] = useState<Record<RoleType, RolePermissions>>(INITIAL_ROLE_PERMISSIONS);

  const [fieldOptions, setFieldOptions] = useState<CustomFieldOption[]>(DEFAULT_FIELD_OPTIONS);

  const [cacheStats, setCacheStats] = useState<SmartCacheStats>(() => smartCache.getStats());

  const [liveDataStatus, setLiveDataStatus] = useState<LiveDataStatus>({
    state: 'idle',
    lastSyncAt: null,
    message: null,
    unavailable: [],
    missingTables: []
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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

  /** Show an audit entry in the Audit view immediately; the row itself was written by the server. */
  const appendLocalAudit = useCallback((audit: AuditDescriptor, fallbackTarget?: string) => {
    const entry: AuditLog = {
      id: 'aud-local-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      action: (audit.action || 'UPDATE') as AuditLog['action'],
      module: (audit.module || 'Settings') as AuditLog['module'],
      targetItem: audit.targetItem || fallbackTarget || '',
      performedByRole: currentUserRole,
      performedByUser: authProfile?.name || authProfile?.email || currentUserName || 'Authenticated Staff',
      site: audit.site || 'All Sites',
      details: audit.details || ''
    };
    setAuditLogs(prev => [entry, ...prev.slice(0, 499)]);
  }, [currentUserRole, authProfile, currentUserName]);

  /**
   * Audit an action that is not itself a data write (sign-in, role switch,
   * session lock). One row, attributed server-side to the verified session.
   * Data writes are audited by the server as part of the write (see persist*),
   * which removes the duplicate and unlinked rows of BUG-026.
   */
  const addAuditEntry = useCallback((
    action: AuditLog['action'],
    module: AuditLog['module'],
    targetItem: string,
    site: string,
    details: string,
    _performedByOverride?: string
  ) => {
    const start = performance.now();
    const descriptor: AuditDescriptor = { action: action as AuditDescriptor['action'], module, targetItem, site, details };
    appendLocalAudit(descriptor);
    apiService.recordAuditTrail({
      action: action as any,
      details,
      site,
      module,
      entityType: module,
      entityId: targetItem,
      targetItem
    }).then(res => {
      if (!res.success) console.warn('Audit entry not persisted:', res.error);
    });
    setLastOperationDurationMs(Math.max(1, Math.round(performance.now() - start)));
  }, [appendLocalAudit]);

  /** A write the database refused: tell the user plainly; callers roll their optimistic change back. */
  const reportPersistFailure = useCallback((label: string, error?: string) => {
    const message = error || 'The live database did not accept the change';
    console.error(`[Live DB] ${label} failed: ${message}`);
    setNotifications(prev => [
      {
        id: 'notif-err-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: `${label} was NOT saved`,
        description: `${message}. Your change has been reverted - please try again.`,
        time: 'Just now',
        type: 'urgent',
        read: false
      },
      ...prev
    ]);
  }, []);

  useEffect(() => {
    tableSchemaService.setFailureReporter(message => reportPersistFailure('Table layout', message));
    return () => tableSchemaService.setFailureReporter(null);
  }, [reportPersistFailure]);

  /**
   * Persist helpers. The screen updates optimistically; if the database
   * refuses the write the change is rolled back and the user is told. Before
   * live mode these failures were swallowed: the API returned
   * `{ success: false }` rather than throwing, so every `.catch()` was dead code
   * and a refused save looked exactly like a successful one.
   */
  const persistCreate = useCallback(async <T extends { id: string }>(
    entity: string, label: string, setter: RecordSetter<T>, record: T, audit?: AuditDescriptor
  ): Promise<boolean> => {
    const res = await apiService.saveEntityRecord(entity, record, audit);
    if (!res.success) {
      setter(prev => prev.filter(r => r.id !== record.id));
      reportPersistFailure(label, res.error);
      return false;
    }
    if ((res as any).record) {
      setter(prev => prev.map(r => r.id === record.id ? { ...record, ...(res as any).record } : r));
    }
    if (audit) appendLocalAudit(audit, record.id);
    return true;
  }, [reportPersistFailure, appendLocalAudit]);

  const persistUpdate = useCallback(async <T extends { id: string }>(
    entity: string, label: string, setter: RecordSetter<T>, previous: T, changes: Partial<T>, audit?: AuditDescriptor
  ): Promise<boolean> => {
    const res = await apiService.updateEntityRecord(entity, previous.id, changes, audit);
    if (!res.success) {
      setter(prev => prev.map(r => (r.id === previous.id ? previous : r)));
      reportPersistFailure(label, res.error);
      return false;
    }
    if ((res as any).record) {
      setter(prev => prev.map(r => r.id === previous.id ? { ...r, ...(res as any).record } : r));
    }
    if (audit) appendLocalAudit(audit, previous.id);
    return true;
  }, [reportPersistFailure, appendLocalAudit]);

  const persistDelete = useCallback(async <T extends { id: string }>(
    entity: string, label: string, setter: RecordSetter<T>, previous: T, audit?: AuditDescriptor
  ): Promise<boolean> => {
    const res = await apiService.deleteEntityRecord(entity, previous.id, audit);
    if (!res.success) {
      setter(prev => (prev.some(r => r.id === previous.id) ? prev : [previous, ...prev]));
      reportPersistFailure(label, res.error);
      return false;
    }
    if (audit) appendLocalAudit(audit, previous.id);
    return true;
  }, [reportPersistFailure, appendLocalAudit]);

  // --- Centralized Email Notifications Engine ---
  const updateNotificationRule = useCallback(async (id: string, updates: Partial<NotificationRule>) => {
    const previous = notificationRules.find(r => r.id === id);
    setNotificationRules(prev => prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
    const res = await emailNotificationService.updateRule(id, updates);
    if (!res.success) {
      if (previous) setNotificationRules(prev => prev.map(r => (r.id === id ? previous : r)));
      reportPersistFailure('Notification rule change', res.error);
      return;
    }
    addAuditEntry('SETTINGS_UPDATE', 'Settings', `Notification Rule #${id}`, 'All Sites', `Updated email notification configuration for ${id}.`);
  }, [notificationRules, addAuditEntry, reportPersistFailure]);

  const toggleNotificationRule = useCallback(async (id: string) => {
    const current = notificationRules.find(r => r.id === id);
    if (current) {
      await updateNotificationRule(id, { enabled: !current.enabled });
    }
  }, [notificationRules, updateNotificationRule]);

  const resetNotificationRules = useCallback(async () => {
    const previous = notificationRules;
    setNotificationRules(DEFAULT_NOTIFICATION_RULES);
    const res = await emailNotificationService.resetRules();
    if (!res.success) {
      setNotificationRules(previous);
      reportPersistFailure('Notification rules reset', res.message);
      return;
    }
    if (Array.isArray(res.rules)) setNotificationRules(res.rules);
    addAuditEntry('SETTINGS_UPDATE', 'Settings', 'Reset Notification Rules', 'All Sites', 'Reset all notification rules to system defaults.');
  }, [notificationRules, addAuditEntry, reportPersistFailure]);

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
        console.log(`[Production Email Dispatched] Event: ${eventCode}, Recipients:`, res.recipients);
      } else if (!res.success) {
        console.warn(`[Production Email Failed] Event: ${eventCode}:`, res.error || (res as any).message);
      }
      const updatedLogs = await emailNotificationService.getLogs();
      if (updatedLogs && updatedLogs.length > 0) {
        setEmailNotificationLogs(updatedLogs);
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
      }
      if (logs) {
        setEmailNotificationLogs(logs);
      }
    } catch (err) {
      console.warn('Could not refresh notification data:', err);
    }
  }, []);

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
        } else if (res.transient) {
          // Server outage, not a rejected session: keep the user signed in; the
          // live-data banner reports the outage and sync retries on its own.
          console.warn('Session could not be verified right now; keeping the session:', res.error);
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
    addAuditEntry('SETTINGS_UPDATE', 'Settings', `User Logout: ${prevUser}`, assignedSite, 'Session token revoked.');
    setSessionTokenState(null);
    setAuthProfileState(null);
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'token');
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'auth_user');
    // Records are held only in memory now; drop them so the next person to use
    // this browser sees nothing until they sign in and load their own view.
    setReferrals([]);
    setVulnerableSUs([]);
    setChallengingSUs([]);
    setLaundryRecords([]);
    setPropertyLaundryLogs([]);
    setFoodRecords([]);
    setFoodVendorBuffetLogs([]);
    setEscalations([]);
    setDocuments([]);
    setMaintenanceRecords([]);
    setSpcdRecords([]);
    setPublicTransportRecords([]);
    setComplianceRecords([]);
    setGpAppointmentRecords([]);
    setRfaWelfareRecords([]);
    setDispersalRecords([]);
    setDataChangeRequests([]);
    setAuditLogs([]);
    setEmailNotificationLogs([]);
    setLiveDataStatus({ state: 'idle', lastSyncAt: null, message: null, unavailable: [], missingTables: [] });
  }, [authProfile, currentUserRole, sessionToken, assignedSite, addAuditEntry]);

  const addDataChangeRequest = useCallback((req: Omit<DataChangeRequest, 'id' | 'createdAt' | 'status'>) => {
    const newReq: DataChangeRequest = {
      ...req,
      id: 'req-' + Date.now(),
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    setDataChangeRequests(prev => [newReq, ...prev]);
    persistCreate('requests', 'Change request', setDataChangeRequests, newReq, {
      action: 'CREATE', module: 'Settings', targetItem: `Change Request: ${newReq.recordTitle}`, site: newReq.site,
      details: `Submitted data change request (${newReq.requestType}) for review.`
    }).then(saved => {
      if (!saved) return;
      // Automated configurable email notification dispatch
      triggerEmailNotification('change_request.created', newReq, {
        site: newReq.site,
        severity: 'Medium',
        entityId: newReq.id
      });
    });
  }, [persistCreate, triggerEmailNotification]);

  const reviewDataChangeRequest = useCallback((id: string, decision: 'Approved' | 'Rejected', reviewNotes: string) => {
    const reviewerName = authProfile?.name || authProfile?.email || currentUserName || currentUserRole;
    const targetReq = dataChangeRequests.find(r => r.id === id);
    if (!targetReq) return;

    const changes: Partial<DataChangeRequest> = {
      status: decision,
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      reviewNotes
    };
    setDataChangeRequests(prev => prev.map(r => (r.id === id ? { ...r, ...changes } : r)));
    persistUpdate('requests', 'Change request review', setDataChangeRequests, targetReq, changes, {
      action: 'UPDATE', module: 'Settings', targetItem: `Change Request #${id}`, site: targetReq.site,
      details: `Data change request ${decision}: ${reviewNotes}`
    }).then(saved => {
      if (!saved) return;
      // Automated configurable email notification dispatch
      triggerEmailNotification('change_request.reviewed', { ...targetReq, decision, reviewNotes, requestId: id }, {
        site: targetReq.site,
        severity: 'Low',
        entityId: id
      });
    });
  }, [authProfile, currentUserName, currentUserRole, dataChangeRequests, persistUpdate, triggerEmailNotification]);

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

  // Session preferences are the only thing kept in browser storage.
  useEffect(() => { saveStorage('role', currentUserRole); }, [currentUserRole]);
  useEffect(() => { saveStorage('assigned_site', assignedSite); }, [assignedSite]);

  // Read-through cache of the property and staff directories (fast lookups and
  // first paint only - always replaced by the live database on sync).
  useEffect(() => {
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

  // Live Database Sync Engine (Webapp <-> Supabase PostgreSQL).
  // Every page's records are read from the database in one batched request.
  const legacyMigrationAttemptedRef = useRef(false);
  const hasSyncedOnceRef = useRef(false);

  const syncFromDatabase = useCallback(async () => {
    const plan: Array<{ key: string; entity: string; label: string; limit?: number; order?: string }> = [
      { key: 'referrals', entity: 'referrals', label: 'SG Referrals' },
      { key: 'vulnerable', entity: 'vulnerable', label: 'Vulnerable SUs' },
      { key: 'challenging', entity: 'challenging', label: 'Challenging SUs' },
      { key: 'maintenance', entity: 'maintenance', label: 'Maintenance Tracker' },
      { key: 'spcd', entity: 'spcd', label: 'SPCD Tracker' },
      { key: 'sites', entity: 'sites', label: 'Properties' },
      { key: 'laundry', entity: 'laundry', label: 'Laundry (resident)' },
      { key: 'property_laundry_logs', entity: 'property_laundry_logs', label: 'Laundry (property logs)' },
      { key: 'food', entity: 'food', label: 'Hot Meals' },
      { key: 'food_vendor_buffet_logs', entity: 'food_vendor_buffet_logs', label: 'Hot Meals (vendor buffet)' },
      { key: 'escalations', entity: 'escalations', label: 'Escalations' },
      { key: 'documents', entity: 'documents', label: 'Proof Documents' },
      { key: 'userGroups', entity: 'userGroups', label: 'User Groups' },
      { key: 'users', entity: 'users', label: 'User Profiles' },
      { key: 'publicTransport', entity: 'publicTransport', label: 'Public Transport' },
      { key: 'compliance', entity: 'compliance', label: 'SD-Compliance' },
      { key: 'gpAppointments', entity: 'gpAppointments', label: 'GP Appointments' },
      { key: 'rfaWelfare', entity: 'rfaWelfare', label: 'RFA Welfare Checks' },
      { key: 'dispersal', entity: 'dispersal', label: 'Dispersal Sheet' },
      { key: 'booklets', entity: 'booklets', label: 'Booklets' },
      { key: 'vcsAgencies', entity: 'vcsAgencies', label: 'SD VCS Directory' },
      { key: 'requests', entity: 'requests', label: 'Requests & Approvals' },
      { key: 'fieldOptions', entity: 'fieldOptions', label: 'Field Options' },
      { key: 'rolePermissions', entity: 'rolePermissions', label: 'Roles & RBAC' },
      { key: 'appSettings', entity: 'appSettings', label: 'System Preferences' },
      { key: 'tableSchemas', entity: 'tableSchemas', label: 'Table Layouts' },
      { key: 'audit', entity: 'audit_trails', label: 'Audit Trail', limit: 500, order: 'timestamp.desc' }
    ];

    if (!hasSyncedOnceRef.current) {
      setLiveDataStatus(prev => ({ ...prev, state: 'loading', message: 'Loading live data...' }));
    }

    try {
      const [batch, supaUsersRes] = await Promise.all([
        apiService.batchFetchEntities(plan.map(({ key, entity, limit, order }) => ({ key, entity, limit, order }))),
        apiService.fetchSupabaseUsers()
      ]);

      if (!batch.success) {
        const message = batch.status === 401
          ? 'Your session is not accepted by the server. Sign out and sign in again.'
          : `Live database unreachable (${batch.error}). Changes cannot be saved until it reconnects.`;
        setLiveDataStatus(prev => ({ ...prev, state: 'offline', message }));
        return;
      }

      const r = batch.results;
      const got = <T,>(key: string): T[] | undefined => (r[key]?.success && Array.isArray(r[key].data) ? r[key].data as T[] : undefined);
      const apply = <T,>(key: string, setter: (rows: T[]) => void) => {
        const rows = got<T>(key);
        if (rows) setter(rows);
      };

      // Empty results are applied too: a record deleted elsewhere must disappear here (BUG-021).
      apply<SGReferral>('referrals', setReferrals);
      apply<VulnerableSU>('vulnerable', setVulnerableSUs);
      apply<ChallengingSU>('challenging', setChallengingSUs);
      apply<MaintenanceRecord>('maintenance', setMaintenanceRecords);
      apply<SPCDRecord>('spcd', setSpcdRecords);
      apply<SiteInfo>('sites', rows => setSites(deduplicateSites(rows)));
      apply<LaundryRecord>('laundry', setLaundryRecords);
      apply<PropertyLaundryLog>('property_laundry_logs', setPropertyLaundryLogs);
      apply<FoodRecord>('food', setFoodRecords);
      apply<PropertyFoodVendorBuffetLog>('food_vendor_buffet_logs', setFoodVendorBuffetLogs);
      apply<EscalationRecord>('escalations', setEscalations);
      apply<DocumentRecord>('documents', setDocuments);
      apply<UserGroup>('userGroups', setUserGroups);
      apply<PublicTransportRecord>('publicTransport', setPublicTransportRecords);
      apply<SDComplianceRecord>('compliance', setComplianceRecords);
      apply<GPAppointmentRecord>('gpAppointments', setGpAppointmentRecords);
      apply<RFAWelfareCheckRecord>('rfaWelfare', setRfaWelfareRecords);
      apply<DispersalRecord>('dispersal', setDispersalRecords);
      apply<BookletCollectionRecord>('booklets', setBookletRecords);
      apply<SDVCSAgency>('vcsAgencies', setVcsAgencies);
      apply<DataChangeRequest>('requests', rows =>
        setDataChangeRequests([...rows].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))))
      );
      apply<AuditLog>('audit', setAuditLogs);
      apply<CustomFieldOption>('fieldOptions', rows => {
        // Categories with no stored options (never seeded) fall back to the built-in vocabulary.
        const stored = new Set(rows.map(o => o.category));
        setFieldOptions([...rows, ...DEFAULT_FIELD_OPTIONS.filter(o => !stored.has(o.category))]);
      });
      apply<any>('rolePermissions', rows => setRolePermissions(rolePermissionsFromRows(rows)));
      apply<any>('appSettings', rows => {
        const global = rows.find(row => row.id === 'global');
        if (global?.value && typeof global.value === 'object') setSettings({ ...INITIAL_SETTINGS, ...global.value });
      });
      apply<any>('tableSchemas', rows => {
        tableSchemaService.hydrate(Object.fromEntries(rows.filter(s => Array.isArray(s.columns)).map(s => [s.id, s.columns])));
      });

      const supaUsers = (supaUsersRes?.success && Array.isArray(supaUsersRes.users) && supaUsersRes.users.length > 0)
        ? supaUsersRes.users
        : got<any>('users');
      if (supaUsers && supaUsers.length > 0) {
        setUsers(supaUsers.map((u: any) => ({
          id: u.id || `usr-${Date.now()}`,
          name: u.name || u.email?.split('@')[0] || 'User',
          email: u.email || '',
          role: u.role || 'Staff',
          assignedSites: Array.isArray(u.assignedSites) && u.assignedSites.length > 0
            ? u.assignedSites
            : (u.assignedSite ? [u.assignedSite] : ['All Sites']),
          status: u.status === 'Inactive' ? 'Inactive' : 'Active',
          lastActive: u.lastActive || u.updatedAt || 'Recently'
        })));
      }

      refreshNotificationData();

      const failed = plan.filter(p => !r[p.key]?.success);
      const missingTables = failed.filter(p => r[p.key]?.tableMissing).map(p => p.label);
      hasSyncedOnceRef.current = true;
      setLiveDataStatus({
        state: failed.length === 0 ? 'live' : 'degraded',
        lastSyncAt: new Date().toISOString(),
        message: failed.length === 0
          ? null
          : missingTables.length === failed.length
            ? `${missingTables.length} module(s) have no database table yet - an administrator must run the database migration. Those modules cannot save.`
            : `${failed.length} module(s) could not be loaded from the live database.`,
        unavailable: failed.map(p => p.label),
        missingTables
      });

      // One-time move of records earlier versions kept only in this browser.
      if (!legacyMigrationAttemptedRef.current && hasLegacyLocalData()) {
        legacyMigrationAttemptedRef.current = true;
        const verifiedRole = authProfile?.role;
        const report = await migrateLegacyLocalData({
          isAdmin: verifiedRole === 'Super Admin' || verifiedRole === 'Admin',
          isSuperAdmin: verifiedRole === 'Super Admin',
          snapshot: Object.fromEntries(plan.map(p => [p.entity === 'audit_trails' ? 'audit' : p.entity, got<any>(p.key)]))
        });
        purgeAllLegacyLocalStorage();
        if (report.uploaded.length > 0 || report.failed.length > 0) {
          setNotifications(prev => [
            {
              id: 'notif-migrate-' + Date.now(),
              title: report.failed.length ? 'Some browser-held records could not be saved' : 'Browser-held records saved to the database',
              description: [
                report.uploaded.length ? `Saved: ${report.uploaded.join(', ')}.` : '',
                report.failed.length ? `Not saved (will retry next sign-in): ${report.failed.join('; ')}.` : ''
              ].filter(Boolean).join(' '),
              time: 'Just now',
              type: report.failed.length ? 'urgent' : 'success',
              read: false
            },
            ...prev
          ]);
          if (report.uploaded.length > 0) setTimeout(() => backgroundSyncRef.current(), 500);
        }
      }
    } catch (err: any) {
      console.warn('Live DB sync error:', err);
      setLiveDataStatus(prev => ({ ...prev, state: 'offline', message: `Live database sync failed: ${err?.message || err}` }));
    }
  }, [authProfile, refreshNotificationData]);

  // Background Delta Sync Engine for smart cache & database
  const triggerBackgroundDeltaSync = useCallback(async () => {
    try {
      await syncFromDatabase();
    } catch (err) {
      console.warn('SmartCache background sync notice:', err);
    }
  }, [syncFromDatabase]);

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
    return () => unsubscribe();
  }, []);

  // Sync only while a verified session exists: the data API rejects anonymous
  // calls, so polling from the login screen was pure noise. Timers are keyed on
  // the session, not on the sync function's identity (BUG-011); the ref keeps
  // them calling the current implementation.
  const hasVerifiedSession = !!sessionToken && !!authProfile && !isAuthChecking;
  useEffect(() => {
    if (!hasVerifiedSession) return;
    hasSyncedOnceRef.current = false;
    backgroundSyncRef.current();
    const interval = setInterval(() => {
      backgroundSyncRef.current();
    }, 45000);
    return () => clearInterval(interval);
  }, [hasVerifiedSession, sessionToken]);

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

  // Dynamic RBAC Permission Checks — the matrix lives in role_permissions (one row per role)
  const rolePermissionsRef = useRef(rolePermissions);
  rolePermissionsRef.current = rolePermissions;

  const updateRolePermissions = useCallback((role: RoleType, perms: Partial<RolePermissions>) => {
    const previous = rolePermissionsRef.current[role];
    const next = { ...previous, ...perms };
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    setRolePermissions(prev => ({ ...prev, [role]: next }));
    apiService.saveEntityRecord('rolePermissions', { id: role, role, ...next }, {
      action: 'ROLE_CHANGE', module: 'Roles', targetItem: `Role: ${role}`, site: 'All Sites',
      details: `Updated permission matrix for ${role}.`
    }).then(res => {
      if (!res.success) {
        setRolePermissions(prev => ({ ...prev, [role]: previous }));
        reportPersistFailure(`Permissions for ${role}`, res.error);
      }
    });
  }, [reportPersistFailure]);

  const resetRolePermissions = useCallback(() => {
    const previous = rolePermissionsRef.current;
    setRolePermissions(INITIAL_ROLE_PERMISSIONS);
    const rows = Object.entries(INITIAL_ROLE_PERMISSIONS).map(([role, perms]) => ({ id: role, role, ...perms }));
    apiService.bulkSaveEntityRecords('rolePermissions', rows, {
      action: 'ROLE_CHANGE', module: 'Roles', targetItem: 'RBAC Matrix', site: 'All Sites',
      details: 'Restored the role permission matrix to system defaults.'
    }).then(res => {
      if (!res.success) {
        setRolePermissions(previous);
        reportPersistFailure('Role permission reset', res.error);
      }
    });
  }, [reportPersistFailure]);

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

  // Role Switcher with Confirmation (Super Admin Only)
  const setCurrentUserRole = useCallback((newRole: RoleType) => {
    if (newRole === currentUserRole) return;
    const isRealSuperAdmin = authProfile?.role === 'Super Admin' || (!authProfile && currentUserRole === 'Super Admin');
    if (!isRealSuperAdmin) {
      console.warn('[Security] Unauthorized role escalation attempt prevented.');
      return;
    }
    requestConfirmation({
      title: `Switch Active Role Preview to ${newRole}`,
      message: `You are changing your active session preview to "${newRole}". Permissions and site access will be updated in real time.`,
      confirmLabel: `Switch to ${newRole}`,
      onConfirm: () => {
        setCurrentUserRoleState(newRole);
        addAuditEntry('ROLE_CHANGE', 'Roles', `Switched active role preview to ${newRole}`, assignedSite, `Session preview switched from ${currentUserRole} to ${newRole}.`);
        closeConfirmation();
      }
    });
  }, [currentUserRole, authProfile, requestConfirmation, addAuditEntry, assignedSite, closeConfirmation]);

  const setAssignedSite = useCallback((newSite: string) => {
    if (!canAccessAllSites()) {
      console.warn('[RBAC] Property switching is restricted to Administrators and multi-site managers.');
      return;
    }
    setAssignedSiteState(newSite);
  }, [canAccessAllSites]);

  // Settings updater — system preferences are one row (id 'global') in app_settings
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    const previous = settingsRef.current;
    const updated = { ...previous, ...newSettings };
    setSettings(updated);
    apiService.saveEntityRecord('appSettings', { id: 'global', value: updated }, {
      action: 'SETTINGS_UPDATE', module: 'Settings', targetItem: 'Application Configuration', site: 'System',
      details: `Settings updated: ${Object.keys(newSettings).join(', ')}.`
    }).then(res => {
      if (!res.success) {
        setSettings(previous);
        reportPersistFailure('System preferences', res.error);
      } else {
        appendLocalAudit({ action: 'SETTINGS_UPDATE', module: 'Settings', targetItem: 'Application Configuration', site: 'System', details: `Settings updated: ${Object.keys(newSettings).join(', ')}.` });
      }
    });
  }, [reportPersistFailure, appendLocalAudit]);

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
      closeConfirmation();
      persistCreate('referrals', 'Referral', setReferrals, newRef, {
        action: 'CREATE', module: 'Referrals', targetItem: `${newRef.suName} (${newRef.portRef})`, site: newRef.site,
        details: `Created SG referral for ${newRef.referralCouncil}.`
      }).then(saved => {
        // Alerts describe a stored record, so they wait for the database to accept it.
        if (!saved) return;

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

          // Automated SMTP email dispatch for High/Critical safeguarding referrals
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
      });
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
  }, [referrals.length, currentUserName, persistCreate, triggerEmailNotification, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateReferral = useCallback((id: string, updates: Partial<SGReferral>) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    const execute = () => {
      const changes: Partial<SGReferral> = { ...updates, updatedAt: new Date().toISOString(), lastUpdatedBy: currentUserName };
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
      persistUpdate('referrals', 'Referral changes', setReferrals, current, changes, {
        action: 'UPDATE', module: 'Referrals', targetItem: `${current.suName} (${current.portRef})`, site: current.site,
        details: `Updated fields: ${Object.keys(updates).join(', ')}.`
      });
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
  }, [referrals, currentUserName, persistUpdate, settings.requireConfirmForEdits, requestConfirmation, closeConfirmation]);

  const archiveReferral = useCallback((id: string) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    const execute = () => {
      const changes: Partial<SGReferral> = { status: 'Archived', updatedAt: new Date().toISOString() };
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
      persistUpdate('referrals', 'Referral archive', setReferrals, current, changes, {
        action: 'ARCHIVE', module: 'Referrals', targetItem: `${current.suName} (${current.portRef})`, site: current.site,
        details: 'Moved referral to Archive.'
      });
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
  }, [referrals, persistUpdate, settings.requireConfirmForArchives, requestConfirmation, closeConfirmation]);

  const restoreReferral = useCallback((id: string) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    const execute = () => {
      const changes: Partial<SGReferral> = { status: 'Open', updatedAt: new Date().toISOString() };
      setReferrals(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
      persistUpdate('referrals', 'Referral restore', setReferrals, current, changes, {
        action: 'RESTORE', module: 'Referrals', targetItem: `${current.suName} (${current.portRef})`, site: current.site,
        details: 'Restored referral to active status.'
      });
      closeConfirmation();
    };

    requestConfirmation({
      title: 'Restore Referral',
      message: `Restore "${current.suName}" to active Open status?`,
      confirmLabel: 'Restore Record',
      onConfirm: execute
    });
  }, [referrals, persistUpdate, requestConfirmation, closeConfirmation]);

  const deleteReferral = useCallback((id: string) => {
    const current = referrals.find(r => r.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Permanently Delete Referral',
      message: `CRITICAL ACTION: Are you sure you want to permanently delete the referral record for "${current.suName}" (${current.portRef})? This action cannot be undone and is recorded in the immutable audit log.`,
      confirmLabel: 'Permanently Delete',
      isDanger: true,
      onConfirm: async () => {
        setReferrals(prev => prev.filter(r => r.id !== id));
        closeConfirmation();
        await persistDelete('referrals', 'Referral deletion', setReferrals, current, {
          action: 'DELETE', module: 'Referrals', targetItem: `${current.suName} (${current.portRef})`, site: current.site,
          details: 'Permanent deletion of referral record.'
        });
      }
    });
  }, [referrals, persistDelete, requestConfirmation, closeConfirmation]);

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
      closeConfirmation();
      persistCreate('vulnerable', 'Vulnerable SU record', setVulnerableSUs, newSU, {
        action: 'CREATE', module: 'Vulnerable SUs', targetItem: `${newSU.suName} (${newSU.roomOrFlatNo})`, site: newSU.site,
        details: `Registered vulnerable resident (${newSU.riskLevel} risk).`
      }).then(saved => {
        if (!saved) return;
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
      });
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
  }, [persistCreate, triggerEmailNotification, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateVulnerableSU = useCallback((id: string, updates: Partial<VulnerableSU>) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    const execute = () => {
      const changes: Partial<VulnerableSU> = { ...updates, updatedAt: new Date().toISOString() };
      setVulnerableSUs(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
      persistUpdate('vulnerable', 'Vulnerable SU changes', setVulnerableSUs, current, changes, {
        action: 'UPDATE', module: 'Vulnerable SUs', targetItem: `${current.suName} (${current.roomOrFlatNo})`, site: current.site,
        details: `Updated vulnerable record fields: ${Object.keys(updates).join(', ')}.`
      });
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
  }, [vulnerableSUs, persistUpdate, settings.requireConfirmForEdits, requestConfirmation, closeConfirmation]);

  const archiveVulnerableSU = useCallback((id: string) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Archive Vulnerable Resident Record',
      message: `Move safeguarding record for ${current.suName} to Archive?`,
      confirmLabel: 'Archive Record',
      onConfirm: () => {
        const changes: Partial<VulnerableSU> = { status: 'Archived', updatedAt: new Date().toISOString() };
        setVulnerableSUs(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
        persistUpdate('vulnerable', 'Vulnerable SU archive', setVulnerableSUs, current, changes, {
          action: 'ARCHIVE', module: 'Vulnerable SUs', targetItem: `${current.suName}`, site: current.site,
          details: 'Archived safeguarding SU record.'
        });
        closeConfirmation();
      }
    });
  }, [vulnerableSUs, persistUpdate, requestConfirmation, closeConfirmation]);

  const restoreVulnerableSU = useCallback((id: string) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Restore Vulnerable Resident Record',
      message: `Restore ${current.suName} to active safeguarding register?`,
      confirmLabel: 'Restore Record',
      onConfirm: () => {
        const changes: Partial<VulnerableSU> = { status: 'Open', updatedAt: new Date().toISOString() };
        setVulnerableSUs(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
        persistUpdate('vulnerable', 'Vulnerable SU restore', setVulnerableSUs, current, changes, {
          action: 'RESTORE', module: 'Vulnerable SUs', targetItem: `${current.suName}`, site: current.site,
          details: 'Restored vulnerable resident to active status.'
        });
        closeConfirmation();
      }
    });
  }, [vulnerableSUs, persistUpdate, requestConfirmation, closeConfirmation]);

  const deleteVulnerableSU = useCallback((id: string) => {
    const current = vulnerableSUs.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Safeguarding Record',
      message: `Are you certain you want to permanently delete safeguarding file for "${current.suName}"? This record cannot be recovered.`,
      confirmLabel: 'Permanently Delete',
      isDanger: true,
      onConfirm: async () => {
        setVulnerableSUs(prev => prev.filter(s => s.id !== id));
        closeConfirmation();
        await persistDelete('vulnerable', 'Vulnerable SU deletion', setVulnerableSUs, current, {
          action: 'DELETE', module: 'Vulnerable SUs', targetItem: `${current.suName}`, site: current.site,
          details: 'Permanently deleted vulnerable SU record.'
        });
      }
    });
  }, [vulnerableSUs, persistDelete, requestConfirmation, closeConfirmation]);

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
      closeConfirmation();
      persistCreate('challenging', 'Challenging SU incident', setChallengingSUs, newRec, {
        action: 'CREATE', module: 'Challenging SUs', targetItem: `${newRec.name}`, site: newRec.site,
        details: `Logged challenging incident (${newRec.typeOfIssue}, ${newRec.riskFactor} risk).`
      }).then(saved => {
        if (!saved) return;
        if (newRec.riskFactor === 'High' || newRec.riskFactor === 'Critical') {
          // Automated configurable email notification dispatch for critical incidents
          triggerEmailNotification('challenging.critical', newRec, {
            site: newRec.site,
            severity: newRec.riskFactor === 'Critical' ? 'Critical' : 'High',
            entityId: newRec.id
          });

          // Automated SMTP email alert for High/Critical incidents
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
      });
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
  }, [persistCreate, triggerEmailNotification, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateChallengingSU = useCallback((id: string, updates: Partial<ChallengingSU>) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    const execute = () => {
      const changes: Partial<ChallengingSU> = { ...updates, updatedAt: new Date().toISOString() };
      setChallengingSUs(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
      persistUpdate('challenging', 'Challenging SU changes', setChallengingSUs, current, changes, {
        action: 'UPDATE', module: 'Challenging SUs', targetItem: `${current.name}`, site: current.site,
        details: `Updated incident log for ${current.name}.`
      });
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
  }, [challengingSUs, persistUpdate, settings.requireConfirmForEdits, requestConfirmation, closeConfirmation]);

  const archiveChallengingSU = useCallback((id: string) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Archive Challenging Incident File',
      message: `Move incident record for ${current.name} to Archive?`,
      confirmLabel: 'Archive Record',
      onConfirm: () => {
        const changes: Partial<ChallengingSU> = { status: 'Archived', updatedAt: new Date().toISOString() };
        setChallengingSUs(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
        persistUpdate('challenging', 'Challenging SU archive', setChallengingSUs, current, changes, {
          action: 'ARCHIVE', module: 'Challenging SUs', targetItem: `${current.name}`, site: current.site,
          details: 'Archived challenging incident record.'
        });
        closeConfirmation();
      }
    });
  }, [challengingSUs, persistUpdate, requestConfirmation, closeConfirmation]);

  const restoreChallengingSU = useCallback((id: string) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Restore Challenging SU Record',
      message: `Restore incident file for ${current.name} to active list?`,
      confirmLabel: 'Restore Record',
      onConfirm: () => {
        const changes: Partial<ChallengingSU> = { status: 'In progress', updatedAt: new Date().toISOString() };
        setChallengingSUs(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
        persistUpdate('challenging', 'Challenging SU restore', setChallengingSUs, current, changes, {
          action: 'RESTORE', module: 'Challenging SUs', targetItem: `${current.name}`, site: current.site,
          details: 'Restored challenging SU record.'
        });
        closeConfirmation();
      }
    });
  }, [challengingSUs, persistUpdate, requestConfirmation, closeConfirmation]);

  const deleteChallengingSU = useCallback((id: string) => {
    const current = challengingSUs.find(c => c.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Incident Record',
      message: `Permanently delete incident file for "${current.name}"?`,
      confirmLabel: 'Permanently Delete',
      isDanger: true,
      onConfirm: async () => {
        setChallengingSUs(prev => prev.filter(c => c.id !== id));
        closeConfirmation();
        await persistDelete('challenging', 'Challenging SU deletion', setChallengingSUs, current, {
          action: 'DELETE', module: 'Challenging SUs', targetItem: `${current.name}`, site: current.site,
          details: 'Permanently deleted challenging SU record.'
        });
      }
    });
  }, [challengingSUs, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Laundry ---
  const addLaundryRecord = useCallback((data: Omit<LaundryRecord, 'id' | 'createdAt'>) => {
    const execute = () => {
      const rec: LaundryRecord = {
        ...data,
        id: 'lau-' + Date.now(),
        createdAt: new Date().toISOString()
      };
      setLaundryRecords(prev => [rec, ...prev]);
      closeConfirmation();
      persistCreate('laundry', 'Laundry intake', setLaundryRecords, rec, {
        action: 'CREATE', module: 'Laundry', targetItem: `${rec.residentName} (${rec.roomNo})`, site: rec.site,
        details: `Issued ${rec.tokensIssued} tokens for laundry.`
      });
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
  }, [persistCreate, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateLaundryRecord = useCallback((id: string, updates: Partial<LaundryRecord>) => {
    const current = laundryRecords.find(l => l.id === id);
    if (!current) return;
    setLaundryRecords(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    persistUpdate('laundry', 'Laundry update', setLaundryRecords, current, updates, {
      action: 'UPDATE', module: 'Laundry', targetItem: `${current.residentName} (${current.roomNo})`, site: current.site,
      details: `Updated status to ${updates.status || 'modified'}.`
    });
  }, [laundryRecords, persistUpdate]);

  const deleteLaundryRecord = useCallback((id: string) => {
    const current = laundryRecords.find(l => l.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Laundry Log',
      message: `Remove laundry record for ${current.residentName} (${current.roomNo})?`,
      confirmLabel: 'Delete Entry',
      isDanger: true,
      onConfirm: async () => {
        setLaundryRecords(prev => prev.filter(l => l.id !== id));
        closeConfirmation();
        await persistDelete('laundry', 'Laundry deletion', setLaundryRecords, current, {
          action: 'DELETE', module: 'Laundry', targetItem: `Laundry #${id}`, site: current.site,
          details: 'Deleted laundry intake record.'
        });
      }
    });
  }, [laundryRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Property Laundry Logs (Weekly / Monthly per Property) ---
  const addPropertyLaundryLog = useCallback((data: Omit<PropertyLaundryLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    const rec: PropertyLaundryLog = {
      ...data,
      id: 'prop-lau-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setPropertyLaundryLogs(prev => [rec, ...prev]);
    persistCreate('property_laundry_logs', 'Property laundry log', setPropertyLaundryLogs, rec, {
      action: 'CREATE', module: 'Laundry', targetItem: `${data.periodType} Log (${data.periodLabel})`, site: data.site,
      details: `Logged ${data.dirtyLaundrySent} sent / ${data.cleanLaundryReturned} returned. Audited by: ${data.loggedBy}.`
    });
  }, [persistCreate]);

  const updatePropertyLaundryLog = useCallback((id: string, updates: Partial<PropertyLaundryLog>) => {
    // Read the current record from state rather than out of a setState updater:
    // React may run updaters later (or twice), so the value captured there was
    // sometimes still undefined and the database update was silently skipped.
    const current = propertyLaundryLogs.find(p => p.id === id);
    if (!current) return;
    const changes: Partial<PropertyLaundryLog> = { ...updates, updatedAt: new Date().toISOString() };
    const merged = { ...current, ...changes };
    setPropertyLaundryLogs(prev => prev.map(p => (p.id === id ? { ...p, ...changes } : p)));
    persistUpdate('property_laundry_logs', 'Property laundry log changes', setPropertyLaundryLogs, current, changes, {
      action: 'UPDATE', module: 'Laundry', targetItem: `Property Log: ${merged.periodLabel || `#${id}`}`, site: merged.site || 'Site',
      details: `Updated property laundry counts and remarks. Audited by ${merged.loggedBy || 'User'}.`
    });
  }, [propertyLaundryLogs, persistUpdate]);

  const deletePropertyLaundryLog = useCallback((id: string) => {
    const current = propertyLaundryLogs.find(p => p.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Property Laundry Log',
      message: `Permanently remove ${current.periodType} laundry log for "${current.site}" (${current.periodLabel})?`,
      confirmLabel: 'Delete Log',
      isDanger: true,
      onConfirm: async () => {
        setPropertyLaundryLogs(prev => prev.filter(p => p.id !== id));
        closeConfirmation();
        await persistDelete('property_laundry_logs', 'Property laundry log deletion', setPropertyLaundryLogs, current, {
          action: 'DELETE', module: 'Laundry', targetItem: `Log #${id}`, site: current.site,
          details: 'Deleted property laundry log record.'
        });
      }
    });
  }, [propertyLaundryLogs, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Hot Food ---
  const addFoodRecord = useCallback((data: Omit<FoodRecord, 'id' | 'createdAt'>) => {
    const execute = () => {
      const rec: FoodRecord = {
        ...data,
        id: 'food-' + Date.now(),
        createdAt: new Date().toISOString()
      };
      setFoodRecords(prev => [rec, ...prev]);
      closeConfirmation();
      persistCreate('food', 'Meal delivery log', setFoodRecords, rec, {
        action: 'CREATE', module: 'Hot Food', targetItem: `${rec.residentName} (${rec.roomNo})`, site: rec.site,
        details: `Logged ${rec.mealType} (${rec.tempCheckedCelsius}°C).`
      });
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
  }, [persistCreate, settings.requireConfirmForCreates, requestConfirmation, closeConfirmation]);

  const updateFoodRecord = useCallback((id: string, updates: Partial<FoodRecord>) => {
    const current = foodRecords.find(f => f.id === id);
    if (!current) return;
    setFoodRecords(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    persistUpdate('food', 'Meal delivery update', setFoodRecords, current, updates, {
      action: 'UPDATE', module: 'Hot Food', targetItem: `Food Log #${id}`, site: current.site,
      details: 'Updated meal status.'
    });
  }, [foodRecords, persistUpdate]);

  const deleteFoodRecord = useCallback((id: string) => {
    const current = foodRecords.find(f => f.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Food Log Entry',
      message: `Delete hot food record for ${current.residentName}?`,
      confirmLabel: 'Delete Entry',
      isDanger: true,
      onConfirm: async () => {
        setFoodRecords(prev => prev.filter(f => f.id !== id));
        closeConfirmation();
        await persistDelete('food', 'Meal delivery deletion', setFoodRecords, current, {
          action: 'DELETE', module: 'Hot Food', targetItem: `Food #${id}`, site: current.site,
          details: 'Deleted food distribution record.'
        });
      }
    });
  }, [foodRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Food Vendor Buffet Logs (A&M, Freshbite, 9 cusines, sands) ---
  const addFoodVendorBuffetLog = useCallback((data: Omit<PropertyFoodVendorBuffetLog, 'id' | 'updatedAt'>) => {
    const rec: PropertyFoodVendorBuffetLog = {
      ...data,
      id: 'vendor-bf-' + Date.now(),
      updatedAt: new Date().toISOString()
    };
    setFoodVendorBuffetLogs(prev => [rec, ...prev]);
    persistCreate('food_vendor_buffet_logs', 'Vendor buffet log', setFoodVendorBuffetLogs, rec, {
      action: 'CREATE', module: 'Hot Food', targetItem: `Vendor: ${data.vendor} (${data.weekRange})`, site: data.site,
      details: `Created weekly buffet catering schedule. Audited by: ${data.lastUpdatedBy}.`
    });
  }, [persistCreate]);

  const updateFoodVendorBuffetLog = useCallback((id: string, updates: Partial<PropertyFoodVendorBuffetLog>) => {
    const current = foodVendorBuffetLogs.find(v => v.id === id);
    if (!current) return;
    const changes: Partial<PropertyFoodVendorBuffetLog> = { ...updates, updatedAt: new Date().toISOString() };
    const merged = { ...current, ...changes };
    setFoodVendorBuffetLogs(prev => prev.map(v => (v.id === id ? { ...v, ...changes } : v)));
    persistUpdate('food_vendor_buffet_logs', 'Vendor buffet log changes', setFoodVendorBuffetLogs, current, changes, {
      action: 'UPDATE', module: 'Hot Food', targetItem: `Vendor: ${merged.vendor || 'Buffet Matrix'} (#${id})`, site: merged.site || 'Site',
      details: `Updated weekly buffet counts for ${merged.vendor} (${merged.weekRange || 'Week Matrix'}). Audited by ${merged.lastUpdatedBy || 'User'}.`
    });
  }, [foodVendorBuffetLogs, persistUpdate]);

  const deleteFoodVendorBuffetLog = useCallback((id: string) => {
    const current = foodVendorBuffetLogs.find(v => v.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Food Vendor Buffet Log',
      message: `Permanently remove buffet log for "${current.vendor}" at "${current.site}" (${current.weekRange})?`,
      confirmLabel: 'Delete Schedule',
      isDanger: true,
      onConfirm: async () => {
        setFoodVendorBuffetLogs(prev => prev.filter(v => v.id !== id));
        closeConfirmation();
        await persistDelete('food_vendor_buffet_logs', 'Vendor buffet log deletion', setFoodVendorBuffetLogs, current, {
          action: 'DELETE', module: 'Hot Food', targetItem: `Vendor Log #${id}`, site: current.site,
          details: 'Deleted food vendor buffet log.'
        });
      }
    });
  }, [foodVendorBuffetLogs, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Escalations ---
  const addEscalation = useCallback((data: Omit<EscalationRecord, 'id' | 'createdAt'>) => {
    const execute = () => {
      const rec: EscalationRecord = {
        ...data,
        id: 'esc-' + Date.now(),
        createdAt: new Date().toISOString()
      };
      setEscalations(prev => [rec, ...prev]);
      closeConfirmation();
      persistCreate('escalations', 'Escalation', setEscalations, rec, {
        action: 'CREATE', module: 'Escalations', targetItem: `${rec.suName} - ${rec.incidentType || rec.incidentTitle || 'Escalation'}`, site: rec.site,
        details: `Escalated to ${rec.escalatedTo || rec.reportedAuthorities || 'Management'} with ${rec.urgency || 'High'} priority.`
      }).then(saved => {
        if (!saved) return;
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
      });
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
  }, [currentUserName, persistCreate, triggerEmailNotification, requestConfirmation, closeConfirmation]);

  const updateEscalation = useCallback((id: string, updates: Partial<EscalationRecord>) => {
    const current = escalations.find(e => e.id === id);
    if (!current) return;
    setEscalations(prev => prev.map(e => (e.id === id ? { ...e, ...updates } : e)));
    persistUpdate('escalations', 'Escalation changes', setEscalations, current, updates, {
      action: 'UPDATE', module: 'Escalations', targetItem: `Escalation #${id}`, site: current.site,
      details: `Updated escalation details: ${Object.keys(updates).join(', ')}.`
    });
  }, [escalations, persistUpdate]);

  const deleteEscalation = useCallback((id: string) => {
    const current = escalations.find(e => e.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Escalation Record',
      message: `Delete escalation case "${current.incidentTitle}"?`,
      confirmLabel: 'Delete Case',
      isDanger: true,
      onConfirm: async () => {
        setEscalations(prev => prev.filter(e => e.id !== id));
        closeConfirmation();
        await persistDelete('escalations', 'Escalation deletion', setEscalations, current, {
          action: 'DELETE', module: 'Escalations', targetItem: `Escalation #${id}`, site: current.site,
          details: 'Deleted escalation case.'
        });
      }
    });
  }, [escalations, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Documents ---
  const addDocument = useCallback((data: Omit<DocumentRecord, 'id'>) => {
    const execute = () => {
      const rec: DocumentRecord = {
        ...data,
        id: 'doc-' + Date.now()
      };
      setDocuments(prev => [rec, ...prev]);
      closeConfirmation();
      persistCreate('documents', 'Document', setDocuments, rec, {
        action: 'CREATE', module: 'Documents', targetItem: `${rec.documentTitle}`, site: rec.site,
        details: `Uploaded document (${rec.category}) with confidentiality: ${rec.confidentiality}.`
      });
    };

    requestConfirmation({
      title: 'Confirm Document Attachment',
      message: `Upload and index document "${data.documentTitle}" for ${data.suName}?`,
      confirmLabel: 'Upload Document',
      onConfirm: execute
    });
  }, [persistCreate, requestConfirmation, closeConfirmation]);

  const updateDocument = useCallback((id: string, updates: Partial<DocumentRecord>) => {
    const current = documents.find(d => d.id === id);
    if (!current) return;
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    persistUpdate('documents', 'Document changes', setDocuments, current, updates, {
      action: 'UPDATE', module: 'Documents', targetItem: `${updates.documentTitle || current.documentTitle}`, site: current.site,
      details: 'Updated compliance document details.'
    });
  }, [documents, persistUpdate]);

  const deleteDocument = useCallback((id: string) => {
    const current = documents.find(d => d.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Document',
      message: `Permanently remove compliance document "${current.documentTitle}"?`,
      confirmLabel: 'Delete Document',
      isDanger: true,
      onConfirm: async () => {
        setDocuments(prev => prev.filter(d => d.id !== id));
        closeConfirmation();
        await persistDelete('documents', 'Document deletion', setDocuments, current, {
          action: 'DELETE', module: 'Documents', targetItem: `${current.documentTitle}`, site: current.site,
          details: 'Deleted document from system.'
        });
      }
    });
  }, [documents, persistDelete, requestConfirmation, closeConfirmation]);

  // --- CRUD: Maintenance Tracker ---
  const addMaintenanceRecord = useCallback((data: Omit<MaintenanceRecord, 'id' | 'createdAt'>) => {
    const newRecord: MaintenanceRecord = {
      ...data,
      id: 'maint-' + Date.now(),
      createdAt: new Date().toISOString()
    };
    setMaintenanceRecords(prev => [newRecord, ...prev]);
    persistCreate('maintenance', 'Maintenance defect', setMaintenanceRecords, newRecord, {
      action: 'CREATE', module: 'Settings', targetItem: `${newRecord.priority}: ${newRecord.description.substring(0, 30)}`, site: newRecord.site,
      details: `Logged maintenance defect (${newRecord.priorityTimeScale}).`
    }).then(saved => {
      if (!saved) return;
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
    });
  }, [persistCreate, triggerEmailNotification]);

  const updateMaintenanceRecord = useCallback((id: string, updates: Partial<MaintenanceRecord>) => {
    const current = maintenanceRecords.find(m => m.id === id);
    if (!current) return;
    setMaintenanceRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...updates } : rec));
    persistUpdate('maintenance', 'Maintenance ticket changes', setMaintenanceRecords, current, updates, {
      action: 'UPDATE', module: 'Settings', targetItem: `Defect #${id}`, site: current.site,
      details: 'Updated maintenance ticket progress/status.'
    });
  }, [maintenanceRecords, persistUpdate]);

  const deleteMaintenanceRecord = useCallback((id: string) => {
    const current = maintenanceRecords.find(m => m.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete Maintenance Record',
      message: `Are you sure you want to delete maintenance defect "${current.description}" at ${current.location}?`,
      confirmLabel: 'Delete Ticket',
      isDanger: true,
      onConfirm: async () => {
        setMaintenanceRecords(prev => prev.filter(m => m.id !== id));
        closeConfirmation();
        await persistDelete('maintenance', 'Maintenance deletion', setMaintenanceRecords, current, {
          action: 'DELETE', module: 'Settings', targetItem: `Maintenance #${id}`, site: current.site,
          details: 'Deleted maintenance record.'
        });
      }
    });
  }, [maintenanceRecords, persistDelete, requestConfirmation, closeConfirmation]);

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
    persistCreate('spcd', 'SPCD case', setSpcdRecords, newRecord, {
      action: 'CREATE', module: 'Vulnerable SUs', targetItem: `SPCD: ${newRecord.suName}`, site: newRecord.siteName,
      details: `Added SPCD record for ${newRecord.suName} (${newRecord.suPortReference}).`
    });
  }, [persistCreate]);

  const updateSPCDRecord = useCallback((id: string, updates: Partial<SPCDRecord>) => {
    const current = spcdRecords.find(rec => rec.id === id);
    if (!current) return;
    const changes: Partial<SPCDRecord> = { ...updates, updatedAt: new Date().toISOString() };
    setSpcdRecords(prev => prev.map(rec => (rec.id === id ? { ...rec, ...changes } : rec)));
    persistUpdate('spcd', 'SPCD case changes', setSpcdRecords, current, changes, {
      action: 'UPDATE', module: 'Vulnerable SUs', targetItem: `SPCD: ${current.suName}`, site: current.siteName,
      details: 'Updated SPCD follow-up notes & status.'
    });
  }, [spcdRecords, persistUpdate]);

  const archiveSPCDRecord = useCallback((id: string, dateLeft?: string, reason?: string) => {
    const current = spcdRecords.find(rec => rec.id === id);
    if (!current) return;
    const changes: Partial<SPCDRecord> = {
      isArchived: true,
      dateLeft: dateLeft || new Date().toISOString().split('T')[0],
      reasonForLeaving: reason || 'Departed / Accommodation Closed',
      updatedAt: new Date().toISOString()
    };
    setSpcdRecords(prev => prev.map(rec => (rec.id === id ? { ...rec, ...changes } : rec)));
    persistUpdate('spcd', 'SPCD archive', setSpcdRecords, current, changes, {
      action: 'ARCHIVE', module: 'Vulnerable SUs', targetItem: `SPCD: ${current.suName}`, site: current.siteName,
      details: `Marked Service User as departed (Archived). Reason: ${reason || 'Departed'}`
    });
  }, [spcdRecords, persistUpdate]);

  const restoreSPCDRecord = useCallback((id: string) => {
    const current = spcdRecords.find(rec => rec.id === id);
    if (!current) return;
    const changes: Partial<SPCDRecord> = { isArchived: false, updatedAt: new Date().toISOString() };
    setSpcdRecords(prev => prev.map(rec => (rec.id === id ? { ...rec, ...changes } : rec)));
    persistUpdate('spcd', 'SPCD restore', setSpcdRecords, current, changes, {
      action: 'RESTORE', module: 'Vulnerable SUs', targetItem: `SPCD: ${current.suName}`, site: current.siteName,
      details: 'Restored Service User to Active SPCD list.'
    });
  }, [spcdRecords, persistUpdate]);

  const deleteSPCDRecord = useCallback((id: string) => {
    const current = spcdRecords.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete SPCD Record',
      message: `Permanently delete SPCD case log for ${current.suName} (${current.suPortReference})?`,
      confirmLabel: 'Delete Case',
      isDanger: true,
      onConfirm: async () => {
        setSpcdRecords(prev => prev.filter(s => s.id !== id));
        closeConfirmation();
        await persistDelete('spcd', 'SPCD deletion', setSpcdRecords, current, {
          action: 'DELETE', module: 'Vulnerable SUs', targetItem: `SPCD: ${current.suName}`, site: current.siteName,
          details: 'Deleted SPCD entry.'
        });
      }
    });
  }, [spcdRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- 1. CRUD: Public Transport Tracker (public_transport_records) ---
  const addPublicTransportRecord = useCallback((data: Omit<PublicTransportRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: PublicTransportRecord = {
      ...data,
      id: 'pt-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    const site = (newRecord as any).siteName || newRecord.accommodationAddress;
    setPublicTransportRecords(prev => [newRecord, ...prev]);
    persistCreate('publicTransport', 'Transport approval', setPublicTransportRecords, newRecord, {
      action: 'CREATE', module: 'Settings', targetItem: `Transport: ${newRecord.approvalUrn}`, site: site || 'Site',
      details: `Created transport approval ${newRecord.approvalUrn} for ${newRecord.suNames}.`
    }).then(saved => {
      if (!saved) return;
      // Automated configurable email notification dispatch
      triggerEmailNotification('transport.created', newRecord, {
        site,
        severity: 'Low',
        entityId: newRecord.approvalUrn
      });
      if (newRecord.exceptionalCircumstances && newRecord.exceptionalCircumstances.trim() !== '') {
        triggerEmailNotification('transport.exceptional_circumstance', newRecord, {
          site,
          severity: 'High',
          entityId: newRecord.approvalUrn
        });
      }
    });
  }, [persistCreate, triggerEmailNotification]);

  const updatePublicTransportRecord = useCallback((id: string, updates: Partial<PublicTransportRecord>) => {
    const current = publicTransportRecords.find(r => r.id === id);
    if (!current) return;
    const changes: Partial<PublicTransportRecord> = { ...updates, updatedAt: new Date().toISOString() };
    setPublicTransportRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...changes } : rec));
    persistUpdate('publicTransport', 'Transport approval changes', setPublicTransportRecords, current, changes, {
      action: 'UPDATE', module: 'Settings', targetItem: `Transport: ${current.approvalUrn}`, site: (current as any).siteName || 'Site',
      details: 'Updated public transport approval record.'
    });
  }, [publicTransportRecords, persistUpdate]);

  const deletePublicTransportRecord = useCallback((id: string) => {
    const current = publicTransportRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Transport Approval',
      message: `Are you sure you want to remove transport approval for ${current.suNames} (URN: ${current.approvalUrn})?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: async () => {
        setPublicTransportRecords(prev => prev.filter(r => r.id !== id));
        closeConfirmation();
        await persistDelete('publicTransport', 'Transport approval deletion', setPublicTransportRecords, current, {
          action: 'DELETE', module: 'Settings', targetItem: `Transport: ${current.approvalUrn}`, site: (current as any).siteName || 'Site',
          details: 'Deleted transport approval record.'
        });
      }
    });
  }, [publicTransportRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- 2. CRUD: SD-Compliance Tracker (compliance_records) ---
  const addComplianceRecord = useCallback((data: Omit<SDComplianceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: SDComplianceRecord = {
      ...data,
      id: 'comp-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setComplianceRecords(prev => [newRecord, ...prev]);
    persistCreate('compliance', 'Compliance record', setComplianceRecords, newRecord, {
      action: 'CREATE', module: 'Settings', targetItem: `Compliance: ${newRecord.complianceType}`, site: newRecord.siteName || 'All Sites',
      details: `Logged compliance asset ${newRecord.complianceType} by ${newRecord.contractorName}.`
    }).then(saved => {
      if (!saved) return;
      // Automated configurable email notification dispatch
      triggerEmailNotification('compliance.created', newRecord, {
        site: newRecord.siteName || 'All Sites',
        severity: 'Medium',
        entityId: newRecord.complianceType
      });
    });
  }, [persistCreate, triggerEmailNotification]);

  const updateComplianceRecord = useCallback((id: string, updates: Partial<SDComplianceRecord>) => {
    const current = complianceRecords.find(r => r.id === id);
    if (!current) return;
    const changes: Partial<SDComplianceRecord> = { ...updates, updatedAt: new Date().toISOString() };
    setComplianceRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...changes } : rec));
    persistUpdate('compliance', 'Compliance record changes', setComplianceRecords, current, changes, {
      action: 'UPDATE', module: 'Settings', targetItem: `Compliance: ${current.complianceType}`, site: current.siteName || 'All Sites',
      details: 'Updated compliance certificate status.'
    });
  }, [complianceRecords, persistUpdate]);

  const deleteComplianceRecord = useCallback((id: string) => {
    const current = complianceRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Compliance Asset',
      message: `Permanently delete compliance record for "${current.complianceType}" (${current.contractorName})?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: async () => {
        setComplianceRecords(prev => prev.filter(r => r.id !== id));
        closeConfirmation();
        await persistDelete('compliance', 'Compliance record deletion', setComplianceRecords, current, {
          action: 'DELETE', module: 'Settings', targetItem: `Compliance: ${current.complianceType}`, site: current.siteName || 'All Sites',
          details: 'Deleted compliance asset record.'
        });
      }
    });
  }, [complianceRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- 3. CRUD: GP Appointments (gp_appointments) ---
  const addGPAppointmentRecord = useCallback((data: Omit<GPAppointmentRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: GPAppointmentRecord = {
      ...data,
      id: 'gp-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setGpAppointmentRecords(prev => [newRecord, ...prev]);
    persistCreate('gpAppointments', 'GP appointment', setGpAppointmentRecords, newRecord, {
      action: 'CREATE', module: 'Referrals', targetItem: `GP: ${newRecord.portReference}`, site: newRecord.siteName || 'Site',
      details: `Booked GP appointment for Room ${newRecord.roomNo} (${newRecord.portReference}).`
    }).then(saved => {
      if (!saved) return;
      // Automated configurable email notification dispatch
      triggerEmailNotification('gp.created', newRecord, {
        site: newRecord.siteName || 'All Sites',
        severity: 'Low',
        entityId: newRecord.portReference
      });
    });
  }, [persistCreate, triggerEmailNotification]);

  const updateGPAppointmentRecord = useCallback((id: string, updates: Partial<GPAppointmentRecord>) => {
    const current = gpAppointmentRecords.find(r => r.id === id);
    if (!current) return;
    const changes: Partial<GPAppointmentRecord> = { ...updates, updatedAt: new Date().toISOString() };
    setGpAppointmentRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...changes } : rec));
    persistUpdate('gpAppointments', 'GP appointment changes', setGpAppointmentRecords, current, changes, {
      action: 'UPDATE', module: 'Referrals', targetItem: `GP: ${current.portReference}`, site: current.siteName || 'Site',
      details: 'Updated GP appointment record.'
    }).then(saved => {
      if (saved && updates.status === 'Cancelled') {
        triggerEmailNotification('gp.dna_missed', { id, ...updates }, {
          severity: 'Medium',
          entityId: id
        });
      }
    });
  }, [gpAppointmentRecords, persistUpdate, triggerEmailNotification]);

  const deleteGPAppointmentRecord = useCallback((id: string) => {
    const current = gpAppointmentRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete GP Appointment',
      message: `Delete GP appointment record for Room ${current.roomNo} (Port Ref: ${current.portReference})?`,
      confirmLabel: 'Delete Appointment',
      isDanger: true,
      onConfirm: async () => {
        setGpAppointmentRecords(prev => prev.filter(r => r.id !== id));
        closeConfirmation();
        await persistDelete('gpAppointments', 'GP appointment deletion', setGpAppointmentRecords, current, {
          action: 'DELETE', module: 'Referrals', targetItem: `GP: ${current.portReference}`, site: current.siteName || 'Site',
          details: 'Deleted GP appointment record.'
        });
      }
    });
  }, [gpAppointmentRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- 4. CRUD: RFA Welfare Checks (rfa_welfare_checks) ---
  const addRFAWelfareRecord = useCallback((data: Omit<RFAWelfareCheckRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: RFAWelfareCheckRecord = {
      ...data,
      id: 'rfa-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setRfaWelfareRecords(prev => [newRecord, ...prev]);
    persistCreate('rfaWelfare', 'RFA welfare check', setRfaWelfareRecords, newRecord, {
      action: 'CREATE', module: 'Vulnerable SUs', targetItem: `RFA Welfare: ${newRecord.name}`, site: newRecord.siteName,
      details: `Conducted RFA welfare check for ${newRecord.name} (Room ${newRecord.roomOrFlatNo}).`
    }).then(saved => {
      if (!saved) return;
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
    });
  }, [persistCreate, triggerEmailNotification]);

  const updateRFAWelfareRecord = useCallback((id: string, updates: Partial<RFAWelfareCheckRecord>) => {
    const current = rfaWelfareRecords.find(r => r.id === id);
    if (!current) return;
    const changes: Partial<RFAWelfareCheckRecord> = { ...updates, updatedAt: new Date().toISOString() };
    setRfaWelfareRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...changes } : rec));
    persistUpdate('rfaWelfare', 'RFA welfare check changes', setRfaWelfareRecords, current, changes, {
      action: 'UPDATE', module: 'Vulnerable SUs', targetItem: `RFA: ${current.name}`, site: current.siteName,
      details: 'Updated RFA welfare check note.'
    });
  }, [rfaWelfareRecords, persistUpdate]);

  const deleteRFAWelfareRecord = useCallback((id: string) => {
    const current = rfaWelfareRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Welfare Check',
      message: `Permanently delete RFA welfare check record for ${current.name} at ${current.siteName}?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: async () => {
        setRfaWelfareRecords(prev => prev.filter(r => r.id !== id));
        closeConfirmation();
        await persistDelete('rfaWelfare', 'RFA welfare check deletion', setRfaWelfareRecords, current, {
          action: 'DELETE', module: 'Vulnerable SUs', targetItem: `RFA: ${current.name}`, site: current.siteName,
          details: 'Deleted RFA welfare entry.'
        });
      }
    });
  }, [rfaWelfareRecords, persistDelete, requestConfirmation, closeConfirmation]);

  // --- 5. CRUD: Dispersal Sheet (dispersal_records) ---
  const addDispersalRecord = useCallback((data: Omit<DispersalRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newRecord: DispersalRecord = {
      ...data,
      id: 'disp-' + Date.now(),
      createdAt: now,
      updatedAt: now
    };
    setDispersalRecords(prev => [newRecord, ...prev]);
    persistCreate('dispersal', 'Dispersal entry', setDispersalRecords, newRecord, {
      action: 'CREATE', module: 'Referrals', targetItem: `Dispersal: ${newRecord.suPortNassRef}`, site: newRecord.siteName,
      details: `Recorded dispersal entry for SU ${newRecord.suPortNassRef} (Flat ${newRecord.flatRoomNumber}).`
    }).then(saved => {
      if (!saved) return;
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
    });
  }, [persistCreate, triggerEmailNotification]);

  const updateDispersalRecord = useCallback((id: string, updates: Partial<DispersalRecord>) => {
    const current = dispersalRecords.find(r => r.id === id);
    if (!current) return;
    const changes: Partial<DispersalRecord> = { ...updates, updatedAt: new Date().toISOString() };
    setDispersalRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...changes } : rec));
    persistUpdate('dispersal', 'Dispersal entry changes', setDispersalRecords, current, changes, {
      action: 'UPDATE', module: 'Referrals', targetItem: `Dispersal: ${current.suPortNassRef}`, site: current.siteName,
      details: 'Updated dispersal departure log.'
    });
  }, [dispersalRecords, persistUpdate]);

  const deleteDispersalRecord = useCallback((id: string) => {
    const current = dispersalRecords.find(r => r.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Delete Dispersal Entry',
      message: `Delete dispersal record for ${current.suPortNassRef} (Flat/Room ${current.flatRoomNumber})?`,
      confirmLabel: 'Delete Record',
      isDanger: true,
      onConfirm: async () => {
        setDispersalRecords(prev => prev.filter(r => r.id !== id));
        closeConfirmation();
        await persistDelete('dispersal', 'Dispersal entry deletion', setDispersalRecords, current, {
          action: 'DELETE', module: 'Referrals', targetItem: `Dispersal: ${current.suPortNassRef}`, site: current.siteName,
          details: 'Deleted dispersal record.'
        });
      }
    });
  }, [dispersalRecords, persistDelete, requestConfirmation, closeConfirmation]);

  /**
   * Replace a whole module with its bundled master dataset: records not in the
   * dataset are deleted, the dataset is upserted. On failure the live data is
   * reloaded so the screen shows what the database actually holds.
   */
  const replaceWithMasterDataset = useCallback(async <T extends { id: string }>(
    entity: string, label: string, setter: RecordSetter<T>, current: T[], dataset: T[], audit: AuditDescriptor
  ) => {
    setter(dataset);
    const keep = new Set(dataset.map(r => r.id));
    const removeIds = current.filter(r => !keep.has(r.id)).map(r => r.id);
    const removed = await apiService.bulkDeleteEntityRecords(entity, removeIds);
    const saved = removed.success ? await apiService.bulkSaveEntityRecords(entity, dataset, audit) : removed;
    if (!saved.success) {
      reportPersistFailure(label, saved.error);
      backgroundSyncRef.current();
      return;
    }
    appendLocalAudit(audit);
  }, [reportPersistFailure, appendLocalAudit]);

  // --- 6. CRUD: Booklets to be Collected (booklet_collections) ---
  const addBookletRecord = useCallback((data: Omit<BookletCollectionRecord, 'id'>) => {
    const newRecord: BookletCollectionRecord = {
      ...data,
      id: 'bkl-' + Date.now()
    };
    setBookletRecords(prev => [...prev, newRecord]);
    persistCreate('booklets', 'Booklet allocation', setBookletRecords, newRecord, {
      action: 'CREATE', module: 'Settings', targetItem: `Booklet: ${newRecord.bookletType} (${newRecord.language})`, site: newRecord.hotelName,
      details: 'Added booklet allocation record.'
    });
  }, [persistCreate]);

  const updateBookletRecord = useCallback((id: string, updates: Partial<BookletCollectionRecord>) => {
    const current = bookletRecords.find(r => r.id === id);
    if (!current) return;
    const changes: Partial<BookletCollectionRecord> = { ...updates, lastUpdated: new Date().toISOString().split('T')[0] };
    setBookletRecords(prev => prev.map(rec => rec.id === id ? { ...rec, ...changes } : rec));
    persistUpdate('booklets', 'Booklet allocation changes', setBookletRecords, current, changes, {
      action: 'UPDATE', module: 'Settings', targetItem: `Booklet: ${current.bookletType} (${current.language})`, site: current.hotelName,
      details: `Updated booklet counts: ${Object.keys(updates).join(', ')}.`
    });
  }, [bookletRecords, persistUpdate]);

  const deleteBookletRecord = useCallback((id: string) => {
    const current = bookletRecords.find(r => r.id === id);
    if (!current) return;
    setBookletRecords(prev => prev.filter(r => r.id !== id));
    persistDelete('booklets', 'Booklet allocation deletion', setBookletRecords, current, {
      action: 'DELETE', module: 'Settings', targetItem: `Booklet: ${current.bookletType} (${current.language})`, site: current.hotelName,
      details: 'Removed booklet allocation record.'
    });
  }, [bookletRecords, persistDelete]);

  const resetBookletsToDefault = useCallback(() => {
    replaceWithMasterDataset('booklets', 'Booklet inventory reset', setBookletRecords, bookletRecords, INITIAL_BOOKLET_RECORDS, {
      action: 'SETTINGS_UPDATE', module: 'Settings', targetItem: 'Reset Booklets', site: 'All Sites',
      details: 'Reset booklet inventory to factory master default.'
    });
  }, [bookletRecords, replaceWithMasterDataset]);

  // --- 7. CRUD: SD VCS Support Agencies (vcs_agencies) ---
  const addVCSAgency = useCallback((data: Omit<SDVCSAgency, 'id' | 'createdAt'>) => {
    const newRecord: SDVCSAgency = {
      ...data,
      id: 'vcs-' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    setVcsAgencies(prev => [...prev, newRecord]);
    persistCreate('vcsAgencies', 'VCS agency', setVcsAgencies, newRecord, {
      action: 'CREATE', module: 'Settings', targetItem: `VCS Agency: ${newRecord.agencyName}`, site: newRecord.hotelName,
      details: `Registered partner support agency for ${newRecord.hotelName}.`
    });
  }, [persistCreate]);

  const updateVCSAgency = useCallback((id: string, updates: Partial<SDVCSAgency>) => {
    const current = vcsAgencies.find(a => a.id === id);
    if (!current) return;
    setVcsAgencies(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    persistUpdate('vcsAgencies', 'VCS agency changes', setVcsAgencies, current, updates, {
      action: 'UPDATE', module: 'Settings', targetItem: `VCS Agency: ${current.agencyName}`, site: current.hotelName,
      details: 'Updated partner support agency details.'
    });
  }, [vcsAgencies, persistUpdate]);

  const deleteVCSAgency = useCallback((id: string) => {
    const current = vcsAgencies.find(a => a.id === id);
    if (!current) return;
    requestConfirmation({
      title: 'Remove VCS Partner Agency',
      message: `Are you sure you want to remove "${current.agencyName}" from ${current.hotelName}?`,
      confirmLabel: 'Remove Agency',
      isDanger: true,
      onConfirm: async () => {
        setVcsAgencies(prev => prev.filter(a => a.id !== id));
        closeConfirmation();
        await persistDelete('vcsAgencies', 'VCS agency removal', setVcsAgencies, current, {
          action: 'DELETE', module: 'Settings', targetItem: `VCS: ${current.agencyName}`, site: current.hotelName,
          details: 'Removed support agency.'
        });
      }
    });
  }, [vcsAgencies, persistDelete, requestConfirmation, closeConfirmation]);

  const resetVCSToDefault = useCallback(() => {
    replaceWithMasterDataset('vcsAgencies', 'VCS directory reset', setVcsAgencies, vcsAgencies, INITIAL_VCS_AGENCIES, {
      action: 'SETTINGS_UPDATE', module: 'Settings', targetItem: 'Reset VCS Agencies', site: 'All Sites',
      details: 'Reset voluntary and community sector agencies to master dataset.'
    });
  }, [vcsAgencies, replaceWithMasterDataset]);

  // --- CRUD: Sites & Properties & Users ---
  const addSite = useCallback((data: Omit<SiteInfo, 'id'>) => {
    const newSite: SiteInfo = {
      ...data,
      id: 'site-' + Date.now()
    };
    setSites(prev => [...prev, newSite]);
    persistCreate('sites', 'Property', setSites, newSite, {
      action: 'CREATE', module: 'Properties', targetItem: `Property: ${newSite.name}${newSite.pid ? ` (${newSite.pid})` : ''}`, site: newSite.name,
      details: `Created accommodation property record: ${newSite.name} in ${newSite.city} (Capacity: ${newSite.capacity} residents, Status: ${newSite.status}${newSite.leadOfficer ? `, Lead Officer: ${newSite.leadOfficer}` : ''}${newSite.contactNumber ? `, Contact: ${newSite.contactNumber}` : ''}).`
    });
  }, [persistCreate]);

  const updateSite = useCallback((id: string, updates: Partial<SiteInfo>) => {
    const current = sites.find(s => s.id === id);
    if (!current) return;
    setSites(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    // Construct detailed audit trail diff for internal accountability
    const changes: string[] = [];
    if (updates.name && updates.name !== current.name) {
      changes.push(`Name changed: "${current.name}" → "${updates.name}"`);
    }
    if (updates.pid && updates.pid !== current.pid) {
      changes.push(`PID changed: "${current.pid || 'None'}" → "${updates.pid}"`);
    }
    if (updates.city && updates.city !== current.city) {
      changes.push(`City: "${current.city}" → "${updates.city}"`);
    }
    if (updates.capacity !== undefined && updates.capacity !== current.capacity) {
      changes.push(`Capacity: ${current.capacity} → ${updates.capacity} residents`);
    }
    if (updates.status && updates.status !== current.status) {
      changes.push(`Status: "${current.status}" → "${updates.status}"`);
    }
    if (updates.leadOfficer !== undefined && updates.leadOfficer !== current.leadOfficer) {
      changes.push(`Lead Officer: "${current.leadOfficer || 'Unassigned'}" → "${updates.leadOfficer || 'Unassigned'}"`);
    }
    if (updates.contactNumber !== undefined && updates.contactNumber !== current.contactNumber) {
      changes.push(`Phone: "${current.contactNumber || 'None'}" → "${updates.contactNumber}"`);
    }

    const propName = updates.name || current.name || `Property #${id}`;
    const desc = changes.length > 0 ? changes.join('; ') : 'Updated property operational parameters';

    persistUpdate('sites', 'Property changes', setSites, current, updates, {
      action: 'UPDATE', module: 'Properties', targetItem: `Property: ${propName}${updates.pid || current.pid ? ` (${updates.pid || current.pid})` : ''}`, site: propName,
      details: `Updated property record for ${propName}: ${desc}.`
    });
  }, [sites, persistUpdate]);

  const deleteSite = useCallback((id: string) => {
    const current = sites.find(s => s.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Decommission Facility Site',
      message: `Are you sure you want to delete ${current.name}? All associate records must be transferred.`,
      confirmLabel: 'Decommission Site',
      isDanger: true,
      onConfirm: async () => {
        setSites(prev => prev.filter(s => s.id !== id));
        closeConfirmation();
        await persistDelete('sites', 'Property deletion', setSites, current, {
          action: 'DELETE', module: 'Properties', targetItem: `Property: ${current.name}${current.pid ? ` (${current.pid})` : ''}`, site: current.name,
          details: `Decommissioned/deleted accommodation property: ${current.name} in ${current.city} (Capacity: ${current.capacity}, Lead: ${current.leadOfficer || 'Unassigned'}).`
        });
      }
    });
  }, [sites, persistDelete, requestConfirmation, closeConfirmation]);

  /**
   * Accounts live in Supabase Auth with a `profiles` row. Role, sites and status
   * change through the administrator endpoint, which updates both; the data
   * API's profile route is not used for this because it bypassed Auth metadata.
   */
  const updateUser = useCallback(async (id: string, updates: Partial<UserAccount>) => {
    const current = users.find(u => u.id === id);
    if (!current) return;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));

    const res = await apiService.updateUserAssignment(id, updates);
    if (!res.success) {
      setUsers(prev => prev.map(u => (u.id === id ? current : u)));
      reportPersistFailure(`Account changes for ${current.name}`, res.error);
      return;
    }

    // Construct detailed audit trail diff for internal accountability
    const changes: string[] = [];
    if (updates.name && updates.name !== current.name) {
      changes.push(`Name: "${current.name}" → "${updates.name}"`);
    }
    if (updates.email && updates.email !== current.email) {
      changes.push(`Email: "${current.email}" → "${updates.email}"`);
    }
    if (updates.role && updates.role !== current.role) {
      changes.push(`Role changed: "${current.role}" → "${updates.role}"`);
      triggerEmailNotification('user.role_changed', { ...current, newRole: updates.role, targetEmail: current.email }, {
        site: (current.assignedSites && current.assignedSites[0]) || 'All Sites',
        severity: 'High',
        entityId: current.email
      });
    }
    if (updates.status && updates.status !== current.status) {
      changes.push(`Status: "${current.status}" → "${updates.status}"`);
    }
    if (updates.assignedSites && JSON.stringify(updates.assignedSites) !== JSON.stringify(current.assignedSites)) {
      const currentSites = Array.isArray(current.assignedSites) ? current.assignedSites.join(', ') : ((current as any).assignedSite || 'All');
      const newSites = Array.isArray(updates.assignedSites) ? updates.assignedSites.join(', ') : 'All';
      changes.push(`Assigned Sites: [${currentSites}] → [${newSites}]`);
    }

    const userName = updates.name || current.name || `User #${id}`;
    const userEmail = updates.email || current.email || '';
    const desc = changes.length > 0 ? changes.join('; ') : 'Updated account profile & permissions';

    addAuditEntry(
      'UPDATE',
      'Users',
      `User: ${userName}${userEmail ? ` (${userEmail})` : ''}`,
      (updates.assignedSites && updates.assignedSites[0]) || (current.assignedSites && current.assignedSites[0]) || (current as any).assignedSite || 'All',
      `Updated user record for ${userName}: ${desc}.`
    );
  }, [users, addAuditEntry, reportPersistFailure, triggerEmailNotification]);

  /**
   * Accounts need a password and must exist in Supabase Auth, so they are
   * created through the Staff & User Accounts page (POST /api/auth/signup).
   */
  const addUser = useCallback((userData: Omit<UserAccount, 'id' | 'lastActive'>) => {
    reportPersistFailure(
      `Account for ${userData.name || userData.email}`,
      'Accounts are created from Staff & User Accounts > Add User, which sets the password and the login'
    );
  }, [reportPersistFailure]);

  const deleteUser = useCallback((id: string) => {
    const current = users.find(u => u.id === id);
    if (!current) return;

    requestConfirmation({
      title: 'Delete User Account',
      message: `Permanently delete user account for ${current.name} (${current.role})? Their sign-in is removed immediately.`,
      confirmLabel: 'Delete User',
      isDanger: true,
      onConfirm: async () => {
        setUsers(prev => prev.filter(u => u.id !== id));
        closeConfirmation();
        // Deletes the Supabase Auth account; deleting only the profile row (as
        // before) left the person able to sign in.
        const res = await apiService.deleteUserAccount(id);
        if (!res.success) {
          setUsers(prev => (prev.some(u => u.id === id) ? prev : [...prev, current]));
          reportPersistFailure(`Deletion of ${current.name}`, res.error);
          return;
        }
        const currentSite = (current.assignedSites && current.assignedSites[0]) || (current as any).assignedSite || 'All';
        addAuditEntry(
          'DELETE',
          'Users',
          `User: ${current.name} (${current.email})`,
          currentSite,
          `Permanently deleted user account for ${current.name} (Role: ${current.role}, Email: ${current.email}).`
        );
      }
    });
  }, [users, addAuditEntry, reportPersistFailure, requestConfirmation, closeConfirmation]);

  const addUserGroup = useCallback((groupData: Omit<UserGroup, 'id'>) => {
    const newGroup: UserGroup = {
      ...groupData,
      id: `grp-${Date.now()}`
    };
    setUserGroups(prev => [newGroup, ...prev]);
    persistCreate('userGroups', 'User group', setUserGroups, newGroup, {
      action: 'CREATE', module: 'Users', targetItem: newGroup.name, site: 'Group Creation',
      details: `Created user group "${newGroup.name}" with ${newGroup.userIds.length} users and ${newGroup.assignedProperties.length} properties.`
    });
  }, [persistCreate]);

  const updateUserGroup = useCallback((id: string, updates: Partial<UserGroup>) => {
    const current = userGroups.find(g => g.id === id);
    if (!current) return;
    setUserGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    persistUpdate('userGroups', 'User group changes', setUserGroups, current, updates, {
      action: 'UPDATE', module: 'Users', targetItem: current.name, site: 'Group Update',
      details: `Updated user group ${current.name}.`
    });
  }, [userGroups, persistUpdate]);

  const deleteUserGroup = useCallback((id: string) => {
    const current = userGroups.find(g => g.id === id);
    if (!current) return;
    setUserGroups(prev => prev.filter(g => g.id !== id));
    persistDelete('userGroups', 'User group deletion', setUserGroups, current, {
      action: 'DELETE', module: 'Users', targetItem: current.name, site: 'Group Deletion',
      details: `Deleted user group ${current.name}.`
    });
  }, [userGroups, persistDelete]);

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
      // The sync stamp is a system preference; only administrators may write those.
      if (authProfile?.role === 'Super Admin' || authProfile?.role === 'Admin') {
        apiService.saveEntityRecord('appSettings', { id: 'global', value: { ...settingsRef.current, lastSharePointSync: now } });
      }
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
  }, [addAuditEntry, authProfile]);

  /**
   * Formerly "reset to demo data", which only ever changed this browser's copy
   * (the next sync put the real data back). Against a live database that would
   * mean erasing production records, so it now discards anything on screen and
   * reloads every module from the database.
   */
  const resetAllData = useCallback(() => {
    requestConfirmation({
      title: 'Reload All Data From Live Database',
      message: 'Discard what is currently displayed and reload every module from the live Supabase database. No records are deleted.',
      confirmLabel: 'Reload From Database',
      onConfirm: async () => {
        closeConfirmation();
        await syncFromDatabase();
        setNotifications(prev => [
          { id: 'notif-' + Date.now(), title: 'Live data reloaded', description: 'All modules were reloaded from the live database.', time: 'Just now', type: 'sync', read: false },
          ...prev
        ]);
      }
    });
  }, [requestConfirmation, closeConfirmation, syncFromDatabase]);

  // Reset Properties to official master list (upserts the 16 official hotels; other properties are kept)
  const resetPropertiesToDefault = useCallback(async () => {
    const previous = sites;
    setSites(deduplicateSites([...INITIAL_SITES, ...sites]));
    const audit: AuditDescriptor = {
      action: 'UPDATE', module: 'Properties', targetItem: 'Hotel Directory (16 Properties)', site: 'All',
      details: 'Synchronized and reloaded official master hotel directory.'
    };
    const res = await apiService.bulkSaveEntityRecords('sites', INITIAL_SITES, audit);
    if (!res.success) {
      setSites(previous);
      reportPersistFailure('Property directory reset', res.error);
      return;
    }
    appendLocalAudit(audit);
    backgroundSyncRef.current();
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
  }, [sites, reportPersistFailure, appendLocalAudit]);

  /** Every module's live data, for the JSON backup download. */
  const buildBackupSnapshot = useCallback(() => ({
    format: 'sd-operations-backup/v2',
    exportedAt: new Date().toISOString(),
    exportedBy: authProfile?.email || currentUserName,
    entities: {
      sites, referrals, vulnerable: vulnerableSUs, challenging: challengingSUs,
      laundry: laundryRecords, property_laundry_logs: propertyLaundryLogs,
      food: foodRecords, food_vendor_buffet_logs: foodVendorBuffetLogs,
      escalations, documents, maintenance: maintenanceRecords, spcd: spcdRecords,
      publicTransport: publicTransportRecords, compliance: complianceRecords,
      gpAppointments: gpAppointmentRecords, rfaWelfare: rfaWelfareRecords,
      dispersal: dispersalRecords, booklets: bookletRecords, vcsAgencies,
      requests: dataChangeRequests, userGroups, fieldOptions,
      rolePermissions: Object.entries(rolePermissions).map(([role, perms]) => ({ id: role, role, ...perms })),
      appSettings: [{ id: 'global', value: settings }]
    }
  }), [
    authProfile, currentUserName, sites, referrals, vulnerableSUs, challengingSUs, laundryRecords, propertyLaundryLogs,
    foodRecords, foodVendorBuffetLogs, escalations, documents, maintenanceRecords, spcdRecords, publicTransportRecords,
    complianceRecords, gpAppointmentRecords, rfaWelfareRecords, dispersalRecords, bookletRecords, vcsAgencies,
    dataChangeRequests, userGroups, fieldOptions, rolePermissions, settings
  ]);

  /**
   * Restore from a JSON backup into the live database. Records in the file are
   * upserted by id (overwriting the stored copy); records not in the file are
   * left alone. Accepts the v2 format and the older browser-storage format.
   */
  const restoreBackup = useCallback((jsonData: string): boolean => {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonData);
    } catch {
      return false;
    }
    const source = parsed?.format === 'sd-operations-backup/v2' && parsed.entities ? parsed.entities : parsed;
    const legacyKeys: Record<string, string> = {
      vulnerableSUs: 'vulnerable', challengingSUs: 'challenging', laundryRecords: 'laundry', foodRecords: 'food'
    };
    const known = new Set([
      'sites', 'referrals', 'vulnerable', 'challenging', 'laundry', 'property_laundry_logs', 'food', 'food_vendor_buffet_logs',
      'escalations', 'documents', 'maintenance', 'spcd', 'publicTransport', 'compliance', 'gpAppointments', 'rfaWelfare',
      'dispersal', 'booklets', 'vcsAgencies', 'requests', 'userGroups', 'fieldOptions', 'rolePermissions', 'appSettings'
    ]);
    const batches: Array<[string, any[]]> = [];
    for (const [key, value] of Object.entries<any>(source || {})) {
      const entity = legacyKeys[key] || key;
      if (known.has(entity) && Array.isArray(value) && value.length > 0) {
        batches.push([entity, value.filter(r => r && typeof r === 'object' && r.id)]);
      }
    }
    if (batches.length === 0) return false;

    (async () => {
      const audit: AuditDescriptor = { action: 'DATA_RESTORE', module: 'Settings', targetItem: 'JSON Backup Restore', site: 'System', details: 'Imported external JSON backup archive.' };
      const failures: string[] = [];
      let restored = 0;
      for (const [entity, records] of batches) {
        const res = await apiService.bulkSaveEntityRecords(entity, records, { ...audit, details: `Restored ${records.length} ${entity} record(s) from a JSON backup.` });
        if (res.success) restored += records.length; else failures.push(`${entity}: ${res.error}`);
      }
      if (failures.length) reportPersistFailure('Backup restore (partial)', failures.join('; '));
      appendLocalAudit({ ...audit, details: `Restored ${restored} record(s) from a JSON backup.` });
      setNotifications(prev => [
        { id: 'notif-' + Date.now(), title: 'Backup restored to live database', description: `${restored} record(s) written across ${batches.length - failures.length} module(s).`, time: 'Just now', type: failures.length ? 'urgent' : 'success', read: false },
        ...prev
      ]);
      await syncFromDatabase();
    })();
    return true;
  }, [reportPersistFailure, appendLocalAudit, syncFromDatabase]);

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

  /** Persist a batch retention run; on any refusal the live data is reloaded so the screen stays truthful. */
  const persistRetentionBatch = useCallback(async (
    kind: 'archive' | 'delete',
    batches: Array<{ entity: string; records?: any[]; ids?: string[] }>,
    audit: AuditDescriptor
  ) => {
    const failures: string[] = [];
    for (const batch of batches) {
      const res = kind === 'archive'
        ? await apiService.bulkSaveEntityRecords(batch.entity, batch.records || [], audit)
        : await apiService.bulkDeleteEntityRecords(batch.entity, batch.ids || [], audit);
      if (!res.success) failures.push(`${batch.entity}: ${res.error}`);
    }
    if (failures.length) {
      reportPersistFailure(kind === 'archive' ? 'Batch archive' : 'Batch purge', failures.join('; '));
      backgroundSyncRef.current();
      return;
    }
    appendLocalAudit(audit);
  }, [reportPersistFailure, appendLocalAudit]);

  const batchArchiveRecordsOlderThan = useCallback((targetModule: string, cutoffDate: string): BatchRetentionExecutionResult => {
    const now = new Date().toISOString();
    const moduleCounts: Record<string, number> = {};
    const batches: Array<{ entity: string; records: any[] }> = [];
    const wants = (m: string) => targetModule === 'all' || targetModule === m;

    const archive = <T extends { id: string }>(
      m: string, label: string, entity: string, list: T[], setter: RecordSetter<T>,
      isEligible: (r: T) => boolean, apply: (r: T) => T
    ) => {
      if (!wants(m)) return;
      const changed = list.filter(isEligible).map(apply);
      if (changed.length === 0) return;
      const byId = new Map(changed.map(r => [r.id, r]));
      setter(prev => prev.map(r => byId.get(r.id) || r));
      batches.push({ entity, records: changed });
      moduleCounts[label] = changed.length;
    };

    archive('referrals', 'Safeguarding Referrals', 'referrals', referrals, setReferrals,
      r => (r.dateReferred || r.createdAt.slice(0, 10)) <= cutoffDate && r.status !== 'Archived',
      r => ({ ...r, status: 'Archived' as const, updatedAt: now }));
    archive('vulnerable', 'Vulnerable SUs', 'vulnerable', vulnerableSUs, setVulnerableSUs,
      v => (v.reviewDate || v.createdAt.slice(0, 10)) <= cutoffDate && v.status !== 'Archived',
      v => ({ ...v, status: 'Archived' as const, updatedAt: now }));
    archive('challenging', 'Challenging Behaviour', 'challenging', challengingSUs, setChallengingSUs,
      c => (c.dateOfIncident || c.date || c.createdAt.slice(0, 10)) <= cutoffDate && c.status !== 'Archived',
      c => ({ ...c, status: 'Archived' as const, updatedAt: now }));
    archive('spcd', 'SPCD Move-On Tracker', 'spcd', spcdRecords, setSpcdRecords,
      s => (s.date || s.createdAt.slice(0, 10)) <= cutoffDate && !s.isArchived,
      s => ({ ...s, isArchived: true, dateLeft: s.dateLeft || cutoffDate, reasonForLeaving: s.reasonForLeaving || 'Batch retention maintenance archive', updatedAt: now }));
    // Maintenance "archive" means closing the ticket: the module reads defectStatus/action, not status.
    archive('maintenance', 'Maintenance Tracker', 'maintenance', maintenanceRecords, setMaintenanceRecords,
      m => (m.date || m.createdAt.slice(0, 10)) <= cutoffDate && m.defectStatus !== 'Completed' && m.action !== 'Closed',
      m => ({ ...m, defectStatus: 'Completed' as const, action: 'Closed' as const, actualClosedDate: m.actualClosedDate || cutoffDate }));
    archive('escalations', 'Escalations & Incidents', 'escalations', escalations, setEscalations,
      e => (e.dateOfIncident || e.createdAt.slice(0, 10)) <= cutoffDate && e.status !== 'Resolved',
      e => ({ ...e, status: 'Resolved' as const }));

    const totalAffected = Object.values(moduleCounts).reduce((a, b) => a + b, 0);
    const summary = Object.entries(moduleCounts).map(([k, v]) => `${k} (${v})`).join(', ') || 'None';
    if (totalAffected > 0) {
      persistRetentionBatch('archive', batches, {
        action: 'ARCHIVE', module: 'Settings', targetItem: `Batch Retention Archive (${totalAffected} records)`, site: 'All Sites',
        details: `Batch archived ${totalAffected} records older than ${cutoffDate}. Modules: ${summary}.`
      });
    }

    return { totalAffected, action: 'archive', cutoffDate, moduleCounts };
  }, [referrals, vulnerableSUs, challengingSUs, spcdRecords, maintenanceRecords, escalations, persistRetentionBatch]);

  const batchDeleteRecordsOlderThan = useCallback((targetModule: string, cutoffDate: string, onlyArchived: boolean = false): BatchRetentionExecutionResult => {
    const moduleCounts: Record<string, number> = {};
    const batches: Array<{ entity: string; ids: string[] }> = [];
    const wants = (m: string) => targetModule === 'all' || targetModule === m;

    const purge = <T extends { id: string }>(
      m: string, label: string, entity: string, list: T[], setter: RecordSetter<T>, matches: (r: T) => boolean
    ) => {
      if (!wants(m)) return;
      const ids = list.filter(matches).map(r => r.id);
      if (ids.length === 0) return;
      const doomed = new Set(ids);
      setter(prev => prev.filter(r => !doomed.has(r.id)));
      batches.push({ entity, ids });
      moduleCounts[label] = ids.length;
    };

    purge('referrals', 'Safeguarding Referrals', 'referrals', referrals, setReferrals,
      r => (r.dateReferred || r.createdAt.slice(0, 10)) <= cutoffDate && (!onlyArchived || r.status === 'Archived'));
    purge('vulnerable', 'Vulnerable SUs', 'vulnerable', vulnerableSUs, setVulnerableSUs,
      v => (v.reviewDate || v.createdAt.slice(0, 10)) <= cutoffDate && (!onlyArchived || v.status === 'Archived'));
    purge('challenging', 'Challenging Behaviour', 'challenging', challengingSUs, setChallengingSUs,
      c => (c.dateOfIncident || c.date || c.createdAt.slice(0, 10)) <= cutoffDate && (!onlyArchived || c.status === 'Archived'));
    purge('spcd', 'SPCD Move-On Tracker', 'spcd', spcdRecords, setSpcdRecords,
      s => (s.date || s.createdAt.slice(0, 10)) <= cutoffDate && (!onlyArchived || s.isArchived));
    purge('maintenance', 'Maintenance Tracker', 'maintenance', maintenanceRecords, setMaintenanceRecords,
      m => (m.date || m.createdAt.slice(0, 10)) <= cutoffDate && (!onlyArchived || m.defectStatus === 'Completed' || m.action === 'Closed'));
    purge('escalations', 'Escalations & Incidents', 'escalations', escalations, setEscalations,
      e => (e.dateOfIncident || e.createdAt.slice(0, 10)) <= cutoffDate && (!onlyArchived || e.status === 'Resolved'));
    purge('food', 'Food Distribution Logs', 'food', foodRecords, setFoodRecords,
      f => f.createdAt.slice(0, 10) <= cutoffDate);
    purge('laundry', 'Laundry Usage Logs', 'laundry', laundryRecords, setLaundryRecords,
      l => (l.date || l.createdAt.slice(0, 10)) <= cutoffDate);
    purge('documents', 'Compliance Documents', 'documents', documents, setDocuments,
      d => d.uploadDate <= cutoffDate);
    // The audit trail is evidence; only a Super Admin may purge it (enforced by the server too).
    if (authProfile?.role === 'Super Admin') {
      purge('audit', 'Audit Trail Logs', 'audit_trails', auditLogs, setAuditLogs,
        a => a.timestamp.slice(0, 10) <= cutoffDate && !String(a.id).startsWith('aud-local-'));
    }

    const totalAffected = Object.values(moduleCounts).reduce((a, b) => a + b, 0);
    const summary = Object.entries(moduleCounts).map(([k, v]) => `${k} (${v})`).join(', ') || 'None';
    if (totalAffected > 0) {
      persistRetentionBatch('delete', batches, {
        action: 'DELETE', module: 'Settings', targetItem: `Batch Retention Purge (${totalAffected} records)`, site: 'All Sites',
        details: `Permanently purged ${totalAffected} records older than ${cutoffDate}${onlyArchived ? ' (archived only)' : ''}. Modules: ${summary}.`
      });
    }

    return { totalAffected, action: 'delete', cutoffDate, moduleCounts };
  }, [referrals, vulnerableSUs, challengingSUs, spcdRecords, maintenanceRecords, escalations, foodRecords, laundryRecords, documents, auditLogs, authProfile, persistRetentionBatch]);

  // Master Setup & Field Options Manager Handlers — one row per option in field_options
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
    setFieldOptions(prev => [...prev, newOption]);
    persistCreate('fieldOptions', 'Field option', setFieldOptions, newOption, {
      action: 'CREATE', module: 'Settings', targetItem: `Field Option: ${option.label}`, site: 'All Sites',
      details: `Added new option "${option.label}" to category "${option.category}".`
    });
    return newOption;
  }, [fieldOptions, persistCreate]);

  const updateFieldOption = useCallback((id: string, updates: Partial<CustomFieldOption>) => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    setFieldOptions(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    // Upsert the whole option: built-in defaults may not have a database row yet.
    apiService.saveEntityRecord('fieldOptions', { ...target, ...updates }, {
      action: 'UPDATE', module: 'Settings', targetItem: `Field Option: ${target.label}`, site: 'All Sites',
      details: `Updated option "${target.label}" in category "${target.category}".`
    }).then(res => {
      if (!res.success) {
        setFieldOptions(prev => prev.map(o => (o.id === id ? target : o)));
        reportPersistFailure(`Field option "${target.label}"`, res.error);
      }
    });
  }, [fieldOptions, reportPersistFailure]);

  const deleteFieldOption = useCallback((id: string) => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    setFieldOptions(prev => prev.filter(o => o.id !== id));
    persistDelete('fieldOptions', `Field option "${target.label}" deletion`, setFieldOptions, target, {
      action: 'DELETE', module: 'Settings', targetItem: `Field Option: ${target.label}`, site: 'All Sites',
      details: `Deleted option "${target.label}" from category "${target.category}".`
    });
  }, [fieldOptions, persistDelete]);

  const toggleFieldOptionStatus = useCallback((id: string) => {
    const target = fieldOptions.find(o => o.id === id);
    if (!target) return;
    updateFieldOption(id, { isActive: !target.isActive });
  }, [fieldOptions, updateFieldOption]);

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

    const previous = fieldOptions;
    const swapped = [{ ...target, order: other.order }, { ...other, order: target.order }];
    setFieldOptions(prev => prev.map(o => (o.id === target.id ? swapped[0] : o.id === other.id ? swapped[1] : o)));
    apiService.bulkSaveEntityRecords('fieldOptions', swapped).then(res => {
      if (!res.success) {
        setFieldOptions(previous);
        reportPersistFailure('Field option order', res.error);
      }
    });
  }, [fieldOptions, reportPersistFailure]);

  const resetFieldOptionsCategory = useCallback((category?: FieldOptionCategory) => {
    const previous = fieldOptions;
    const defaults = category ? DEFAULT_FIELD_OPTIONS.filter(o => o.category === category) : DEFAULT_FIELD_OPTIONS;
    const defaultIds = new Set(defaults.map(o => o.id));
    const removeIds = fieldOptions
      .filter(o => (!category || o.category === category) && !defaultIds.has(o.id))
      .map(o => o.id);
    const updated = category ? [...fieldOptions.filter(o => o.category !== category), ...defaults] : DEFAULT_FIELD_OPTIONS;
    setFieldOptions(updated);

    const audit: AuditDescriptor = {
      action: 'UPDATE', module: 'Settings', targetItem: 'Reset Field Options', site: 'All Sites',
      details: `Reset field options to system defaults${category ? ` for category "${category}"` : ''}.`
    };
    (async () => {
      const removed = await apiService.bulkDeleteEntityRecords('fieldOptions', removeIds);
      const saved = removed.success ? await apiService.bulkSaveEntityRecords('fieldOptions', defaults, audit) : removed;
      if (!saved.success) {
        setFieldOptions(previous);
        reportPersistFailure('Field options reset', saved.error);
        return;
      }
      appendLocalAudit(audit);
    })();
  }, [fieldOptions, reportPersistFailure, appendLocalAudit]);

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
      isMobileSidebarOpen,
      setIsMobileSidebarOpen,
      isMobileCompactView,
      setIsMobileCompactView,
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
      updateDocument,
      deleteDocument,
      syncSharePointNow,
      resetAllData,
      resetPropertiesToDefault,
      restoreBackup,
      buildBackupSnapshot,
      cacheStats,
      syncFromDatabase,
      liveDataStatus,
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
