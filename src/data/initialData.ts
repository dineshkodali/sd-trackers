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
  UserGroup,
  PublicTransportRecord,
  SDComplianceRecord,
  GPAppointmentRecord,
  RFAWelfareCheckRecord,
  DispersalRecord,
  BookletCollectionRecord,
  SDVCSAgency
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

// 1. Initial Public Transport Records
export const INITIAL_PUBLIC_TRANSPORT_RECORDS: PublicTransportRecord[] = [
  {
    id: 'pt-001',
    approvalUrn: 'URN-2026-0814',
    suNames: 'Ahmad Zahir',
    portRefs: 'CR0-928411',
    accommodationAddress: 'Brit Hotel, 519 High Rd, London N12 0QA',
    appointmentDate: '2026-09-15',
    appointmentTime: '10:30',
    appointmentLocation: 'Lunar House, 40 Wellesley Rd, Croydon CR9 2BY',
    distanceMiles: 18.5,
    modeOfTransport: 'Public Train / Tube',
    exceptionalCircumstances: 'Medical mobility consideration & family escort requirement',
    status: 'Approved',
    createdAt: '2026-09-08T09:00:00Z',
    updatedAt: '2026-09-08T09:00:00Z'
  },
  {
    id: 'pt-002',
    approvalUrn: 'URN-2026-0815',
    suNames: 'Fatima Al-Hassan',
    portRefs: 'LHR-839210',
    accommodationAddress: 'Holiday Inn Lambeth, London SE1 7TJ',
    appointmentDate: '2026-09-18',
    appointmentTime: '14:00',
    appointmentLocation: 'St Thomas Hospital Specialist Clinic, Westminster Bridge Rd',
    distanceMiles: 1.8,
    modeOfTransport: 'Bus',
    exceptionalCircumstances: 'Pregnancy third trimester - bus pass authorized',
    status: 'Approved',
    createdAt: '2026-09-09T11:20:00Z',
    updatedAt: '2026-09-09T11:20:00Z'
  }
];

// 2. Initial SD-Compliance Records
export const INITIAL_COMPLIANCE_RECORDS: SDComplianceRecord[] = [
  {
    id: 'comp-001',
    srNo: 1,
    complianceType: 'Fire Risk Assessment (FRA)',
    contractorName: 'Shield Fire Safety Ltd',
    contractorKeyContact: 'Marcus Vance',
    contractorEmail: 'm.vance@shieldfiresafety.co.uk',
    issuedDate: '2025-10-12',
    expiryDate: '2026-10-11',
    status: 'Compliant',
    actionTaken: 'Annual audit completed, smoke baffles certified on all stairwells',
    previousContractor: 'Apex Fire Compliance',
    siteName: 'Brit Hotel',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'comp-002',
    srNo: 2,
    complianceType: 'Gas Safety Certificate (CP12)',
    contractorName: 'Express Gas Services UK',
    contractorKeyContact: 'Trevor Higgins',
    contractorEmail: 'compliance@expressgas.co.uk',
    issuedDate: '2025-09-20',
    expiryDate: '2026-09-19',
    status: 'Expiring Soon',
    actionTaken: 'Booking re-inspection for secondary boiler house scheduled next Tuesday',
    previousContractor: 'Metro Heat & Gas',
    siteName: 'Holiday Inn Lambeth',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'comp-003',
    srNo: 3,
    complianceType: 'Legionella Water Risk Assessment',
    contractorName: 'AquaPure Hygiene Environmental',
    contractorKeyContact: 'Claire Bennett',
    contractorEmail: 'reports@aquapurehygiene.co.uk',
    issuedDate: '2025-04-05',
    expiryDate: '2027-04-04',
    status: 'Compliant',
    actionTaken: 'Bi-annual temperature logging ongoing; zero bacterial count detected',
    previousContractor: 'PureWater Solutions',
    siteName: 'Ibis Styles - Seven Kings',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 'comp-004',
    srNo: 4,
    complianceType: 'Fixed Wire Testing (EICR)',
    contractorName: 'Apex Electrical Systems',
    contractorKeyContact: 'Derek O\'Neill',
    contractorEmail: 'support@apexelectrical.co.uk',
    issuedDate: '2021-08-15',
    expiryDate: '2026-08-14',
    status: 'Expired',
    actionTaken: 'Urgent re-inspection booked with contractor for immediate certification',
    previousContractor: 'Direct Electrical UK',
    siteName: 'Parmiter PDA',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }
];

// 3. Initial GP Appointment Records
export const INITIAL_GP_APPOINTMENT_RECORDS: GPAppointmentRecord[] = [
  {
    id: 'gp-001',
    roomNo: '104',
    portReference: 'CR0-918234',
    referralSentOn: '2026-09-02',
    appointmentDate: '2026-09-12',
    timeOfGp: '11:15',
    comments: 'Routine medical intake and asthma inhaler prescription review',
    status: 'Scheduled',
    siteName: 'Brit Hotel',
    suName: 'Karamjit Singh',
    createdAt: '2026-09-02T10:00:00Z',
    updatedAt: '2026-09-02T10:00:00Z'
  },
  {
    id: 'gp-002',
    roomNo: '215',
    portReference: 'LHR-772910',
    referralSentOn: '2026-08-28',
    appointmentDate: '2026-09-04',
    timeOfGp: '09:45',
    comments: 'Follow-up consultation completed, dental referral issued',
    status: 'Attended',
    siteName: 'Holiday Inn Lambeth',
    suName: 'Zainab Qasim',
    createdAt: '2026-08-28T14:30:00Z',
    updatedAt: '2026-09-04T10:30:00Z'
  }
];

// 4. Initial RFA Welfare Check Records
export const INITIAL_RFA_WELFARE_RECORDS: RFAWelfareCheckRecord[] = [
  {
    id: 'rfa-001',
    date: '2026-09-09',
    siteName: 'Brit Hotel',
    roomOrFlatNo: '204',
    name: 'Tariq Mansoor',
    dob: '1988-05-14',
    group: 'Single Adult',
    gender: 'Male',
    portOrNassRef: 'CR0-948102',
    vulnerability: 'Post-Traumatic Stress & Insomnia symptoms reported',
    actionTaken: 'Welfare check conducted by Duty Lead; GP appointment scheduled and translated helpline info handed',
    mhTicket: 'MH-83921',
    createdAt: '2026-09-09T10:00:00Z',
    updatedAt: '2026-09-09T10:00:00Z'
  },
  {
    id: 'rfa-002',
    date: '2026-09-08',
    siteName: 'Holiday Inn Lambeth',
    roomOrFlatNo: '312',
    name: 'Nadia Tesfay',
    dob: '1995-11-20',
    group: 'Pregnant Woman',
    gender: 'Female',
    portOrNassRef: 'LHR-882194',
    vulnerability: 'Antenatal care monitoring, isolated without family',
    actionTaken: 'Weekly welfare visit completed. Connected with Happy Baby Community and local health visitor',
    mhTicket: 'MH-83740',
    createdAt: '2026-09-08T15:30:00Z',
    updatedAt: '2026-09-08T15:30:00Z'
  }
];

// 5. Initial Dispersal Sheet Records
export const INITIAL_DISPERSAL_RECORDS: DispersalRecord[] = [
  {
    id: 'disp-001',
    sno: 1,
    siteName: 'Ibis Styles - Seven Kings',
    dateReceived: '08/20/2026',
    suPortNassRef: 'CR0-882711',
    reasonForDeparture: 'Dispersal to Long-Term NASS accommodation in Manchester',
    flatRoomNumber: '118',
    dispersalDate: '09/01/2026',
    dateLetterHandedToSu: '08/25/2026',
    iaExitBriefingCompleted: 'Yes',
    hoDispersalLetterReceived: 'Yes',
    travelled: 'Yes',
    dateLeftProperty: '09/01/2026',
    incidentWarningCompleted: 'No need',
    reasonFailedToTravel: '',
    secondDispersalDate: '',
    dateSecondLetterHanded: '',
    secondIaExitBriefingCompleted: 'No',
    secondDispersalTravelled: 'No',
    secondDateLeftProperty: '',
    secondIncidentWarningCompleted: 'No need',
    reasonFailedToTravelSecond: '',
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-09-01T12:00:00Z'
  },
  {
    id: 'disp-002',
    sno: 2,
    siteName: 'Brit Hotel',
    dateReceived: '08/22/2026',
    suPortNassRef: 'CR0-910245',
    reasonForDeparture: 'Move to Section 95 dispersal flat in Leeds',
    flatRoomNumber: '305',
    dispersalDate: '09/03/2026',
    dateLetterHandedToSu: '08/26/2026',
    iaExitBriefingCompleted: 'Yes',
    hoDispersalLetterReceived: 'Yes',
    travelled: 'No',
    dateLeftProperty: '',
    incidentWarningCompleted: 'Yes',
    reasonFailedToTravel: 'SU reported acute illness on travel morning; medical certificate provided',
    secondDispersalDate: '09/16/2026',
    dateSecondLetterHanded: '09/08/2026',
    secondIaExitBriefingCompleted: 'Yes',
    secondDispersalTravelled: 'Yes',
    secondDateLeftProperty: '09/16/2026',
    secondIncidentWarningCompleted: 'No need',
    reasonFailedToTravelSecond: '',
    createdAt: '2026-08-22T11:00:00Z',
    updatedAt: '2026-09-08T16:00:00Z'
  }
];

// IA Hotel Names for Booklet Tracker
export const IA_HOTEL_NAMES: string[] = [
  'IBIS Seven kings',
  'Leigham Court',
  'HI Lambeth',
  'Mercure Heathrow',
  'Brit castle Hotel',
  'Lea Halls',
  'BW Atlantic Hotel',
  'Pier Avenue',
  'IBIS Bishop Stortford Stansted',
  'HI Old Street',
  'Maida Vale Apt Hotel',
  'IBIS Cardiff',
  'HI Swiss Cottage',
  'Clapham South Dudley',
  'Parmiter - Seth Court',
  'Hilton By Hampton'
];

// Initial Booklet Collection Data across all requested booklets & languages
export const INITIAL_BOOKLET_RECORDS: BookletCollectionRecord[] = [
  // Migrant Help booklets
  { id: 'bkl-mh-alb', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Albanian', numberForCollection: 85, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-amh', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Amharic', numberForCollection: 145, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-ara', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Arabic', numberForCollection: 280, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-chi', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Chinese', numberForCollection: 65, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-eng', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'English', numberForCollection: 415, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-far', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Farsi', numberForCollection: 245, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-spa1', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Spanish', numberForCollection: 190, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-pas', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Pashto', numberForCollection: 240, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-pun', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Punjabi', numberForCollection: 100, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-spa2', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Spanish (Latin Am)', numberForCollection: 95, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-tig', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Tigrinya', numberForCollection: 140, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-urd', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Urdu', numberForCollection: 70, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-tur', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Turkish', numberForCollection: 75, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-mh-dar', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Migrant Help booklets', language: 'Dari', numberForCollection: 0, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },

  // Right & Expectation booklets
  { id: 'bkl-re-ara', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Arabic', numberForCollection: 230, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-eng', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'English', numberForCollection: 395, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-alb', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Albanian', numberForCollection: 80, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-amh', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Amharic', numberForCollection: 125, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-chi', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Chinese', numberForCollection: 45, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-far', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Farsi', numberForCollection: 220, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-kur', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Kurdish', numberForCollection: 170, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-pas', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Pashto', numberForCollection: 270, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-pun', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Punjabi', numberForCollection: 70, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-spa', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Spanish', numberForCollection: 100, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-tig', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Tigrinya', numberForCollection: 75, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-urd', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Urdu', numberForCollection: 45, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-re-dar', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Right & Expectation booklets', language: 'Dari', numberForCollection: 0, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },

  // Living In IA
  { id: 'bkl-ia-alb', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Albanian', numberForCollection: 80, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-amh', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Amharic', numberForCollection: 125, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-ara', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Arabic', numberForCollection: 230, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-chi', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Chinese', numberForCollection: 50, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-eng', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'English', numberForCollection: 390, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-far', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Farsi', numberForCollection: 230, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-kur', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Kurdish', numberForCollection: 180, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-pas', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Pashto', numberForCollection: 230, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-pun', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Punjabi', numberForCollection: 100, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-spa', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Spanish', numberForCollection: 105, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-tig', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Tigrinya', numberForCollection: 135, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-urd', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Urdu', numberForCollection: 50, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-fre', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'French', numberForCollection: 70, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-vie', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Vietnamese', numberForCollection: 80, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-som', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Somali', numberForCollection: 125, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' },
  { id: 'bkl-ia-dar', hotelName: 'IBIS Seven kings', agentName: 'Ready Homes', bookletType: 'Living In IA', language: 'Dari', numberForCollection: 105, collectedBooklets: 0, bookletsReceived: 0, status: 'Pending Collection', notes: 'IA stock batch', lastUpdated: '2026-09-10' }
];

// SD VCS Hotel Names
export const SD_VCS_HOTEL_NAMES: string[] = [
  'Seven Kings',
  'Parmiter St.',
  'Old St.',
  'Brit Hotel',
  'Swiss Cottage',
  'Maida Vale',
  'Leigham Court',
  'Lambeth',
  'Clapham',
  'Mercure Heathrow',
  'Clacton Pier',
  'Stanstead',
  'Lea Halls',
  'BW Atlantic',
  'Ibis Cardiff',
  'Hampton Hilton'
];

// Initial SD VCS Support Agencies (Organized by Hotel)
export const INITIAL_VCS_AGENCIES: SDVCSAgency[] = [
  // Seven Kings
  { id: 'vcs-sk-1', hotelName: 'Seven Kings', agencyName: 'All support provided by Redbridge council', category: 'Statutory / Council', servicesProvided: 'Local authority asylum resettlement & social care support', contactPerson: 'Redbridge Council Team', isVerified: true, createdAt: '2026-01-01' },

  // Parmiter St.
  { id: 'vcs-par-1', hotelName: 'Parmiter St.', agencyName: 'Care4Calais Charity', category: 'Charity & Welfare', servicesProvided: 'Clothing, hygiene packs, social integration', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-2', hotelName: 'Parmiter St.', agencyName: 'GCP Charity', category: 'Charity & Welfare', servicesProvided: 'Community outreach and essentials', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-3', hotelName: 'Parmiter St.', agencyName: 'Barnardos', category: 'Family & Children', servicesProvided: 'Child safeguarding and family welfare support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-4', hotelName: 'Parmiter St.', agencyName: 'Happy Baby Charity', category: 'Family & Children', servicesProvided: 'Perinatal, maternity and baby supply support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-5', hotelName: 'Parmiter St.', agencyName: 'CECOS - ESOL', category: 'ESOL & Education', servicesProvided: 'English language classes and conversational training', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-6', hotelName: 'Parmiter St.', agencyName: 'Local Church (East End Church)', category: 'Faith & Community', servicesProvided: 'Pastoral care, warm hub, and community meal vouchers', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-7', hotelName: 'Parmiter St.', agencyName: 'Tower Hamlets Council resettlement team', category: 'Statutory / Council', servicesProvided: 'Housing resettlement, translation, and local authority liaison', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-8', hotelName: 'Parmiter St.', agencyName: 'Hear Me Out Charity', category: 'Advocacy & Legal', servicesProvided: 'Music, creative arts workshops, and resident wellbeing', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-par-9', hotelName: 'Parmiter St.', agencyName: 'Family Action Charity', category: 'Family & Children', servicesProvided: 'Practical family support, emotional health, and parenting guidance', isVerified: true, createdAt: '2026-01-01' },

  // Old St.
  { id: 'vcs-old-1', hotelName: 'Old St.', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Clothing donations, emergency toiletries, and language support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-old-2', hotelName: 'Old St.', agencyName: 'Migrant Organise', category: 'Advocacy & Legal', servicesProvided: 'Community organising, mental health support, and mentoring', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-old-3', hotelName: 'Old St.', agencyName: 'Community Kitchen', category: 'Food & Nutrition', servicesProvided: 'Freshly cooked hot meals and food distribution', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-old-4', hotelName: 'Old St.', agencyName: 'Refugee Council', category: 'Advocacy & Legal', servicesProvided: 'Legal advice, therapeutic care, and integration pathways', isVerified: true, createdAt: '2026-01-01' },

  // Brit Hotel
  { id: 'vcs-brit-1', hotelName: 'Brit Hotel', agencyName: 'Castle canteen - Freshly cooked food', category: 'Food & Nutrition', servicesProvided: 'Nutritious hot meals, catering support, and cultural dietary options', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-brit-2', hotelName: 'Brit Hotel', agencyName: 'Happy Baby community', category: 'Family & Children', servicesProvided: 'Support for mothers and young children with specialist aid', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-brit-3', hotelName: 'Brit Hotel', agencyName: 'Refugee Community Forum', category: 'Advocacy & Legal', servicesProvided: 'Peer-to-peer mentoring and casework advocacy', isVerified: true, createdAt: '2026-01-01' },

  // Swiss Cottage
  { id: 'vcs-sc-1', hotelName: 'Swiss Cottage', agencyName: 'Light House Church - Indoor games', category: 'Faith & Community', servicesProvided: 'Community recreation, indoor games, and social gathering hub', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-sc-2', hotelName: 'Swiss Cottage', agencyName: 'Happy Baby Community', category: 'Family & Children', servicesProvided: 'Perinatal care, baby bundles, and maternal health support', isVerified: true, createdAt: '2026-01-01' },

  // Maida Vale
  { id: 'vcs-mv-1', hotelName: 'Maida Vale', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Seasonal clothing, hygiene supplies, and local activities', isVerified: true, createdAt: '2026-01-01' },

  // Leigham Court
  { id: 'vcs-lc-1', hotelName: 'Leigham Court', agencyName: 'High Trees', category: 'ESOL & Education', servicesProvided: 'Community education, training, and youth development', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lc-2', hotelName: 'Leigham Court', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Weekly essential clothing and care packages', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lc-3', hotelName: 'Leigham Court', agencyName: 'Learning Unlimited', category: 'ESOL & Education', servicesProvided: 'Adult literacy, language training, and educational access', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lc-4', hotelName: 'Leigham Court', agencyName: 'Happy Baby Community', category: 'Family & Children', servicesProvided: 'Support for pregnant women and mothers seeking asylum', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lc-5', hotelName: 'Leigham Court', agencyName: 'South London Refugee Association (SLRA)', category: 'Advocacy & Legal', servicesProvided: 'Casework advice, counseling, and community groups', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lc-6', hotelName: 'Leigham Court', agencyName: 'Better Start Lambeth', category: 'Family & Children', servicesProvided: 'Early years children centre services and family clinics', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lc-7', hotelName: 'Leigham Court', agencyName: 'Just Shelter', category: 'Charity & Welfare', servicesProvided: 'Emergency housing advice and relief supplies', isVerified: true, createdAt: '2026-01-01' },

  // Lambeth
  { id: 'vcs-lam-1', hotelName: 'Lambeth', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Essentials, clothing distribution, and volunteer support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lam-2', hotelName: 'Lambeth', agencyName: 'Better Start Lambeth', category: 'Family & Children', servicesProvided: 'Early childhood support and playgroups', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lam-3', hotelName: 'Lambeth', agencyName: 'Black Prince Trust', category: 'Faith & Community', servicesProvided: 'Sports, community wellness programs, and youth activities', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lam-4', hotelName: 'Lambeth', agencyName: 'Happy Baby Community', category: 'Family & Children', servicesProvided: 'Baby clothing, buggy loans, and maternal health support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lam-5', hotelName: 'Lambeth', agencyName: 'St John\'s Waterloo', category: 'Faith & Community', servicesProvided: 'Community cafe, music, arts, and pastoral wellbeing', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lam-6', hotelName: 'Lambeth', agencyName: 'Brown and Beige Simple English', category: 'ESOL & Education', servicesProvided: 'Foundational ESOL and conversational English practice', isVerified: true, createdAt: '2026-01-01' },

  // Clapham
  { id: 'vcs-clp-1', hotelName: 'Clapham', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Distribution of shoes, coats, and toiletries', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clp-2', hotelName: 'Clapham', agencyName: 'Better Start', category: 'Family & Children', servicesProvided: 'Early intervention and family wellbeing hub', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clp-3', hotelName: 'Clapham', agencyName: 'South London Refugee Association (SLRA)', category: 'Advocacy & Legal', servicesProvided: 'Asylum casework, therapy, and social clubs', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clp-4', hotelName: 'Clapham', agencyName: 'Happy Baby Community', category: 'Family & Children', servicesProvided: 'Specialist care for pregnant mothers and toddlers', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clp-5', hotelName: 'Clapham', agencyName: 'High Trees', category: 'ESOL & Education', servicesProvided: 'Community education, digital skills, and employment training', isVerified: true, createdAt: '2026-01-01' },

  // Mercure Heathrow
  { id: 'vcs-mer-1', hotelName: 'Mercure Heathrow', agencyName: 'Tzu Chi UK', category: 'Charity & Welfare', servicesProvided: 'Humanitarian relief, comfort packs, and spiritual support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-mer-2', hotelName: 'Mercure Heathrow', agencyName: 'Bell Farm Christian Centre', category: 'Faith & Community', servicesProvided: 'Food distribution, day centre, and community drop-in', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-mer-3', hotelName: 'Mercure Heathrow', agencyName: 'Refugees in Effective & Active Partnership (REAP)', category: 'Advocacy & Legal', servicesProvided: 'Empowerment, refugee health access, and rights advocacy', isVerified: true, createdAt: '2026-01-01' },

  // Clacton Pier
  { id: 'vcs-clc-1', hotelName: 'Clacton Pier', agencyName: 'RAMA', category: 'Advocacy & Legal', servicesProvided: 'Refugee and asylum seeker legal & pastoral support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clc-2', hotelName: 'Clacton Pier', agencyName: 'CVST Tendring', category: 'Charity & Welfare', servicesProvided: 'Community voluntary services, befriending, and food support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clc-3', hotelName: 'Clacton Pier', agencyName: 'RAM (Refugee, Asylum, Migrant)', category: 'Charity & Welfare', servicesProvided: 'Grassroots essentials and community network', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-clc-4', hotelName: 'Clacton Pier', agencyName: 'Essex Integration - Project of DNA Networks', category: 'Advocacy & Legal', servicesProvided: 'Integration support, resettlement guidance, and education', isVerified: true, createdAt: '2026-01-01' },

  // Stanstead
  { id: 'vcs-stn-1', hotelName: 'Stanstead', agencyName: 'RAMA', category: 'Advocacy & Legal', servicesProvided: 'Refugee Action - Colchester & Uttlesford support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-stn-2', hotelName: 'Stanstead', agencyName: 'Touchpoint & Integration Service', category: 'Charity & Welfare', servicesProvided: 'Community hub, emergency food parcels, and mental health aid', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-stn-3', hotelName: 'Stanstead', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Clothing and toiletry provision', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-stn-4', hotelName: 'Stanstead', agencyName: 'Local Church', category: 'Faith & Community', servicesProvided: 'Welcome meetings, tea and coffee mornings, and fellowship', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-stn-5', hotelName: 'Stanstead', agencyName: 'Uttlesford Citizens Advice', category: 'Advocacy & Legal', servicesProvided: 'Debt, welfare, legal rights, and entitlement advice', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-stn-6', hotelName: 'Stanstead', agencyName: 'Dig It Community - Outdoor activities', category: 'Faith & Community', servicesProvided: 'Community gardening, outdoor wellbeing, and green spaces', isVerified: true, createdAt: '2026-01-01' },

  // Lea Halls
  { id: 'vcs-lea-1', hotelName: 'Lea Halls', agencyName: 'Noah', category: 'Charity & Welfare', servicesProvided: 'Welfare support, training, and emergency provisions', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lea-2', hotelName: 'Lea Halls', agencyName: 'Get Set UK', category: 'ESOL & Education', servicesProvided: 'Employability training, job coach matching, and skill builder', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lea-3', hotelName: 'Lea Halls', agencyName: 'Courtney Foundation', category: 'Family & Children', servicesProvided: 'Mentoring for young people and families', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lea-4', hotelName: 'Lea Halls', agencyName: 'Local Food Banks', category: 'Food & Nutrition', servicesProvided: 'Trussell Trust emergency food parcels and hygiene goods', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-lea-5', hotelName: 'Lea Halls', agencyName: 'Discovery Islam', category: 'Faith & Community', servicesProvided: 'Cultural integration, multifaith dialogue, and community outreach', isVerified: true, createdAt: '2026-01-01' },

  // BW Atlantic
  { id: 'vcs-bwa-1', hotelName: 'BW Atlantic', agencyName: 'The Art Place by Ideas Hub Chelmsford', category: 'Faith & Community', servicesProvided: 'Creative expression, art therapy, and community exhibition', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-bwa-2', hotelName: 'BW Atlantic', agencyName: 'Mid Essex Recovery College, Chelmsford', category: 'Charity & Welfare', servicesProvided: 'Mental health recovery and wellbeing courses', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-bwa-3', hotelName: 'BW Atlantic', agencyName: 'GrowBaby, Chelmsford', category: 'Family & Children', servicesProvided: 'Free baby clothes, equipment, and parenting support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-bwa-4', hotelName: 'BW Atlantic', agencyName: 'The Salvation Army, Chelmsford', category: 'Charity & Welfare', servicesProvided: 'Hot meals, clothing, and compassionate pastoral support', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-bwa-5', hotelName: 'BW Atlantic', agencyName: 'English for Women – By Englishforwomen.org', category: 'ESOL & Education', servicesProvided: 'Dedicated female English classes and conversation circles', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-bwa-6', hotelName: 'BW Atlantic', agencyName: 'RAMA', category: 'Advocacy & Legal', servicesProvided: 'Refugee advocacy, casework, and integration liaison', isVerified: true, createdAt: '2026-01-01' },

  // Ibis Cardiff
  { id: 'vcs-cdf-1', hotelName: 'Ibis Cardiff', agencyName: 'DPIA - Displaced People In Action', category: 'Advocacy & Legal', servicesProvided: 'Welsh refugee integration, advocacy, and community navigation', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-cdf-2', hotelName: 'Ibis Cardiff', agencyName: 'Oasis Cardiff', category: 'Charity & Welfare', servicesProvided: 'Drop-in centre, free hot lunches, and creative workshops', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-cdf-3', hotelName: 'Ibis Cardiff', agencyName: 'Space4U', category: 'Charity & Welfare', servicesProvided: 'Safe meeting space, ESOL conversation, and friendship circles', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-cdf-4', hotelName: 'Ibis Cardiff', agencyName: 'Migrant Help', category: 'Statutory / Council', servicesProvided: 'National asylum support helpline & Advice Issue reporting', isVerified: true, createdAt: '2026-01-01' },

  // Hampton Hilton
  { id: 'vcs-ham-1', hotelName: 'Hampton Hilton', agencyName: 'Local Church (Redeemer Church Ealing)', category: 'Faith & Community', servicesProvided: 'Community welcome, volunteer befriending, and food hampers', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-ham-2', hotelName: 'Hampton Hilton', agencyName: 'Care4Calais', category: 'Charity & Welfare', servicesProvided: 'Clothing donations, emergency coats, and digital connectivity', isVerified: true, createdAt: '2026-01-01' },
  { id: 'vcs-ham-3', hotelName: 'Hampton Hilton', agencyName: 'Local Food Banks', category: 'Food & Nutrition', servicesProvided: 'Emergency dry and fresh food parcels for residents', isVerified: true, createdAt: '2026-01-01' }
];

