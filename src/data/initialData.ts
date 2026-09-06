import { 
  SiteInfo, 
  SGReferral, 
  VulnerableSU, 
  ChallengingSU, 
  LaundryRecord, 
  FoodRecord, 
  EscalationRecord, 
  DocumentRecord, 
  AuditLog, 
  UserAccount, 
  AppSettings, 
  RoleType, 
  RolePermissions, 
  MaintenanceRecord, 
  SPCDRecord, 
  DataChangeRequest,
  UserGroup
} from '../types';

export const INITIAL_SITES: SiteInfo[] = [
  { id: 'site-519', pid: '519', name: 'Brit Hotel', city: 'London', capacity: 110, activeResidents: 0, council: 'Barnet Council', leadOfficer: 'Michael Thorne', contactNumber: '+44 20 8200 5190', status: 'Active' },
  { id: 'site-712', pid: '712', name: 'Leigham Court Hotel', city: 'Streatham, London', capacity: 85, activeResidents: 0, council: 'Lambeth Council', leadOfficer: 'Sarah Jenkins', contactNumber: '+44 20 8677 0712', status: 'Active' },
  { id: 'site-483', pid: '483', name: 'Maida Vale Aparthotel', city: 'Maida Vale, London', capacity: 95, activeResidents: 0, council: 'Westminster Council', leadOfficer: 'David Miller', contactNumber: '+44 20 7289 0483', status: 'Active' },
  { id: 'site-640', pid: '640', name: 'Clapham South Dudley Hotel', city: 'Clapham, London', capacity: 100, activeResidents: 0, council: 'Wandsworth Council', leadOfficer: 'Amina Begum', contactNumber: '+44 20 8673 0640', status: 'Active' },
  { id: 'site-443', pid: '443', name: 'Holiday Inn Lambeth', city: 'Lambeth, London', capacity: 140, activeResidents: 0, council: 'Lambeth Council', leadOfficer: 'Rachel O\'Connor', contactNumber: '+44 20 7735 0443', status: 'Active' },
  { id: 'site-632', pid: '632', name: 'Stansted Hotel (Ibis Budget Bisop Stortford)', city: 'Bishop\'s Stortford / Stansted', capacity: 120, activeResidents: 0, council: 'East Herts Council', leadOfficer: 'James Wilson', contactNumber: '+44 1279 632000', status: 'Active' },
  { id: 'site-449', pid: '449', name: 'Holiday Inn Old Street', city: 'Islington, London', capacity: 130, activeResidents: 0, council: 'Islington Council', leadOfficer: 'Priya Sharma', contactNumber: '+44 20 7250 0449', status: 'Active' },
  { id: 'site-546', pid: '546', name: 'Holiday Inn Swiss Cottage', city: 'Camden, London', capacity: 150, activeResidents: 0, council: 'Camden Council', leadOfficer: 'Robert Clarke', contactNumber: '+44 20 7722 0546', status: 'Active' },
  { id: 'site-715', pid: '715', name: 'Ibis Cardiff City Centre', city: 'Cardiff', capacity: 105, activeResidents: 0, council: 'Cardiff Council', leadOfficer: 'Gareth Edwards', contactNumber: '+44 29 2064 0715', status: 'Active' },
  { id: 'site-665', pid: '665', name: 'Hilton Hampton - Ealing', city: 'Ealing, London', capacity: 135, activeResidents: 0, council: 'Ealing Council', leadOfficer: 'Chloe Taylor', contactNumber: '+44 20 8567 0665', status: 'Active' },
  { id: 'site-562', pid: '562', name: 'Ibis Styles - Seven Kings', city: 'Seven Kings, Redbridge', capacity: 150, activeResidents: 0, council: 'Redbridge Council', leadOfficer: 'Sarah Jenkins', contactNumber: '+44 20 8599 0100', status: 'Active' },
  { id: 'site-741', pid: '741', name: 'Clacton Pier Avenue', city: 'Clacton-on-Sea', capacity: 75, activeResidents: 0, council: 'Tendring District Council', leadOfficer: 'Thomas Evans', contactNumber: '+44 1255 741000', status: 'Active' },
  { id: 'site-776', pid: '776', name: 'Lea Halls', city: 'Birmingham', capacity: 160, activeResidents: 0, council: 'Birmingham City Council', leadOfficer: 'Hannah Foster', contactNumber: '+44 121 776 0000', status: 'Active' },
  { id: 'site-820', pid: '820', name: 'Mercure Heathrow Hotel', city: 'Heathrow, Hillingdon', capacity: 180, activeResidents: 0, council: 'Hillingdon Council', leadOfficer: 'Liam Davis', contactNumber: '+44 20 8820 0000', status: 'Active' },
  { id: 'site-545', pid: '545', name: 'Parmiter PDA', city: 'London', capacity: 90, activeResidents: 0, council: 'Tower Hamlets Council', leadOfficer: 'Arjun Patel', contactNumber: '+44 20 7545 0000', status: 'Active' },
  { id: 'site-burrows', pid: '—', name: 'Burrows Court', city: 'Nottingham', capacity: 70, activeResidents: 0, council: 'Nottingham City Council', leadOfficer: 'Sophie Green', contactNumber: '+44 115 900 0101', status: 'Active' }
];

export const INITIAL_REFERRALS: SGReferral[] = [];

export const INITIAL_VULNERABLE: VulnerableSU[] = [];

export const INITIAL_CHALLENGING: ChallengingSU[] = [];

export const INITIAL_LAUNDRY: LaundryRecord[] = [];

export const INITIAL_FOOD: FoodRecord[] = [];

export const INITIAL_ESCALATIONS: EscalationRecord[] = [];

export const INITIAL_DOCUMENTS: DocumentRecord[] = [];

export const INITIAL_MAINTENANCE_RECORDS: MaintenanceRecord[] = [];

export const INITIAL_SPCD_RECORDS: SPCDRecord[] = [];

export const INITIAL_CHANGE_REQUESTS: DataChangeRequest[] = [];

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'ce98b46b-4a6a-4a66-a70a-72e6c56d7691',
    name: 'Stack Master',
    email: 'stackmaster@sdcommercial.co.uk',
    role: 'Super Admin',
    assignedSites: ['All Sites'],
    status: 'Active',
    lastActive: 'Recently'
  },
  {
    id: '1c6508c5-ee2a-498c-a265-b324b03f0a1b',
    name: 'Dinesh Kodali',
    email: 'dineshkodali16@gmail.com',
    role: 'Super Admin',
    assignedSites: ['All Sites'],
    status: 'Active',
    lastActive: 'Recently'
  },
  {
    id: '40a6fef4-6ad6-4ab4-b7cc-9821b646e0da',
    name: 'IT Support',
    email: 'itsupport@sdcommercial.co.uk',
    role: 'Admin',
    assignedSites: ['All Sites'],
    status: 'Active',
    lastActive: 'Recently'
  },
  {
    id: '1038e785-7dc0-4827-975d-3278a09b3742',
    name: 'dd',
    email: 'dineshkodali7@gmail.com',
    role: 'Employee',
    assignedSites: ['Brit Hotel', 'Ibis Styles - Seven Kings'],
    status: 'Active',
    lastActive: 'Recently'
  },
  {
    id: 'b43eb3af-766a-4b7b-becc-fa7131f40605',
    name: 'Dinesh Kodali (UK)',
    email: 'dineshkodali.uk@gmail.com',
    role: 'Regional Manager',
    assignedSites: ['All Sites'],
    status: 'Active',
    lastActive: 'Recently'
  }
];

export const INITIAL_USER_GROUPS: UserGroup[] = [
  {
    id: 'grp-1',
    name: 'Brit Hotel Team',
    description: 'Operations group for Brit Hotel',
    assignedProperty: 'Brit Hotel',
    assignedProperties: ['Brit Hotel'],
    userIds: ['usr-emp-1', 'usr-emp-2']
  },
  {
    id: 'grp-2',
    name: 'Leigham Court Hotel Team',
    description: 'Operations group for Leigham Court Hotel',
    assignedProperty: 'Leigham Court Hotel',
    assignedProperties: ['Leigham Court Hotel'],
    userIds: ['usr-emp-3']
  },
  {
    id: 'grp-3',
    name: 'Maida Vale Aparthotel Team',
    description: 'Operations group for Maida Vale Aparthotel',
    assignedProperty: 'Maida Vale Aparthotel',
    assignedProperties: ['Maida Vale Aparthotel'],
    userIds: []
  },
  {
    id: 'grp-4',
    name: 'Clapham South Dudley Hotel Team',
    description: 'Operations group for Clapham South Dudley Hotel',
    assignedProperty: 'Clapham South Dudley Hotel',
    assignedProperties: ['Clapham South Dudley Hotel'],
    userIds: []
  },
  {
    id: 'grp-5',
    name: 'Holiday Inn Lambeth Team',
    description: 'Operations group for Holiday Inn Lambeth',
    assignedProperty: 'Holiday Inn Lambeth',
    assignedProperties: ['Holiday Inn Lambeth'],
    userIds: []
  },
  {
    id: 'grp-6',
    name: 'Stansted Hotel Team',
    description: 'Operations group for Stansted Hotel (Ibis Budget Bisop Stortford)',
    assignedProperty: 'Stansted Hotel (Ibis Budget Bisop Stortford)',
    assignedProperties: ['Stansted Hotel (Ibis Budget Bisop Stortford)'],
    userIds: []
  },
  {
    id: 'grp-7',
    name: 'Holiday Inn Old Street Team',
    description: 'Operations group for Holiday Inn Old Street',
    assignedProperty: 'Holiday Inn Old Street',
    assignedProperties: ['Holiday Inn Old Street'],
    userIds: []
  },
  {
    id: 'grp-8',
    name: 'Holiday Inn Swiss Cottage Team',
    description: 'Operations group for Holiday Inn Swiss Cottage',
    assignedProperty: 'Holiday Inn Swiss Cottage',
    assignedProperties: ['Holiday Inn Swiss Cottage'],
    userIds: []
  },
  {
    id: 'grp-9',
    name: 'Ibis Cardiff City Centre Team',
    description: 'Operations group for Ibis Cardiff City Centre',
    assignedProperty: 'Ibis Cardiff City Centre',
    assignedProperties: ['Ibis Cardiff City Centre'],
    userIds: []
  },
  {
    id: 'grp-10',
    name: 'Hilton Hampton - Ealing Team',
    description: 'Operations group for Hilton Hampton - Ealing',
    assignedProperty: 'Hilton Hampton - Ealing',
    assignedProperties: ['Hilton Hampton - Ealing'],
    userIds: []
  },
  {
    id: 'grp-11',
    name: 'Ibis Styles - Seven Kings Team',
    description: 'Operations group for Ibis Styles - Seven Kings',
    assignedProperty: 'Ibis Styles - Seven Kings',
    assignedProperties: ['Ibis Styles - Seven Kings'],
    userIds: []
  },
  {
    id: 'grp-12',
    name: 'Clacton Pier Avenue Team',
    description: 'Operations group for Clacton Pier Avenue',
    assignedProperty: 'Clacton Pier Avenue',
    assignedProperties: ['Clacton Pier Avenue'],
    userIds: []
  },
  {
    id: 'grp-13',
    name: 'Lea Halls Team',
    description: 'Operations group for Lea Halls',
    assignedProperty: 'Lea Halls',
    assignedProperties: ['Lea Halls'],
    userIds: []
  },
  {
    id: 'grp-14',
    name: 'Mercure Heathrow Hotel Team',
    description: 'Operations group for Mercure Heathrow Hotel',
    assignedProperty: 'Mercure Heathrow Hotel',
    assignedProperties: ['Mercure Heathrow Hotel'],
    userIds: []
  },
  {
    id: 'grp-15',
    name: 'Parmiter PDA Team',
    description: 'Operations group for Parmiter PDA',
    assignedProperty: 'Parmiter PDA',
    assignedProperties: ['Parmiter PDA'],
    userIds: []
  },
  {
    id: 'grp-16',
    name: 'Burrows Court Team',
    description: 'Operations group for Burrows Court',
    assignedProperty: 'Burrows Court',
    assignedProperties: ['Burrows Court'],
    userIds: []
  }
];

export const INITIAL_AUDIT: AuditLog[] = [
  {
    id: 'aud-sys-init',
    timestamp: new Date().toISOString(),
    action: 'SETTINGS_UPDATE',
    module: 'Settings',
    targetItem: 'Clean Production Database Initialized',
    performedByRole: 'Super Admin',
    performedByUser: 'System',
    site: 'All Sites',
    details: 'System initialized in clean state ready for live operational data input across all 16 accommodation properties.'
  }
];

export const INITIAL_SETTINGS: AppSettings = {
  pageSize: 10,
  enableFastCache: true,
  compactView: false,
  reduceAnimations: false,
  autoSaveDrafts: true,
  enableColumnPinning: true,
  autoLogoutMinutes: 15,
  strictSiteIsolation: true,
  requireConfirmForEdits: true,
  requireConfirmForDeletes: true,
  requireConfirmForCreates: true,
  requireConfirmForArchives: true,
  sharePointSyncIntervalMinutes: 15,
  lastSharePointSync: 'Never',
  autoArchiveDaysCompleted: 30,
  sharePointWorkbookUrl: 'https://commercialtrackers.sharepoint.com/:x:/r/sites/SD-Operations/Shared%20Documents/SD_Commercial_Trackers_Master.xlsx',
  sharePointWorkbookName: 'SD_Commercial_Trackers_Master.xlsx',
  sharePointTargetFolder: 'sites/SD-Operations/Shared Documents/Master Workbooks',
  sharePointDefaultSheet: 'Referrals_Master',
  sharePointAutoSyncEnabled: true
};

export const INITIAL_ROLE_PERMISSIONS: Record<RoleType, RolePermissions> = {
  'Super Admin': {
    canViewAllProperties: true,
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canArchiveRestore: true,
    canExportData: true,
    canManageProperties: true,
    canManageFiles: true,
    canManageUsers: true,
    canManageSettings: true
  },
  'Admin': {
    canViewAllProperties: true,
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canArchiveRestore: true,
    canExportData: true,
    canManageProperties: true,
    canManageFiles: true,
    canManageUsers: true,
    canManageSettings: true
  },
  'Regional Manager': {
    canViewAllProperties: true,
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canArchiveRestore: true,
    canExportData: true,
    canManageProperties: false,
    canManageFiles: true,
    canManageUsers: false,
    canManageSettings: false
  },
  'General Manager': {
    canViewAllProperties: false,
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canArchiveRestore: true,
    canExportData: true,
    canManageProperties: false,
    canManageFiles: false,
    canManageUsers: false,
    canManageSettings: false
  },
  'Employee': {
    canViewAllProperties: false,
    canCreateRecords: true,
    canEditRecords: false,
    canDeleteRecords: false,
    canArchiveRestore: false,
    canExportData: false,
    canManageProperties: false,
    canManageFiles: false,
    canManageUsers: false,
    canManageSettings: false
  },
  'Site Manager': {
    canViewAllProperties: false,
    canCreateRecords: true,
    canEditRecords: true,
    canDeleteRecords: false,
    canArchiveRestore: true,
    canExportData: true,
    canManageProperties: false,
    canManageFiles: false,
    canManageUsers: false,
    canManageSettings: false
  },
  'Staff': {
    canViewAllProperties: false,
    canCreateRecords: true,
    canEditRecords: false,
    canDeleteRecords: false,
    canArchiveRestore: false,
    canExportData: false,
    canManageProperties: false,
    canManageFiles: false,
    canManageUsers: false,
    canManageSettings: false
  }
};
