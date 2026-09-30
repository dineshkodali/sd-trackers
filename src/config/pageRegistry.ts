export interface AppModulePage {
  id: string;
  title: string;
  category: 'Overview' | 'Safeguarding' | 'Facilities & Welfare' | 'Finance' | 'Compliance & Community' | 'Admin & Governance';
  description: string;
}

export const APP_PAGES_REGISTRY: AppModulePage[] = [
  // Overview
  {
    id: 'dashboard',
    title: 'Executive Dashboard',
    category: 'Overview',
    description: 'High-level operational metrics, risk distribution, and property occupancy overview.'
  },
  {
    id: 'dailyRegisters',
    title: 'Live Daily Registers',
    category: 'Overview',
    description: 'Real-time property room makeup, occupancy tracking, new arrivals, and evictions.'
  },

  // Safeguarding
  {
    id: 'referrals',
    title: 'SG Referrals Master',
    category: 'Safeguarding',
    description: 'Primary register for new resident arrivals, intake safeguarding, and property placements.'
  },
  {
    id: 'referralsArchive',
    title: 'Archived SG Referrals',
    category: 'Safeguarding',
    description: 'Historical archive of departed or completed resident referrals.'
  },
  {
    id: 'vulnerable',
    title: 'Vulnerable Residents',
    category: 'Safeguarding',
    description: 'High-dependency resident monitoring, medical conditions, and safeguarding plans.'
  },
  {
    id: 'vulnerableArchive',
    title: 'Archived Vulnerable SUs',
    category: 'Safeguarding',
    description: 'Historical records of formerly tracked vulnerable service users.'
  },
  {
    id: 'challenging',
    title: 'Challenging Behavior SUs',
    category: 'Safeguarding',
    description: 'Incident escalation register, behavioral risk warnings, and police involvement logs.'
  },
  {
    id: 'challengingArchive',
    title: 'Archived Challenging Incidents',
    category: 'Safeguarding',
    description: 'Historical archive of resolved behavioral incidents.'
  },
  {
    id: 'welfareChecks',
    title: 'Welfare Checks',
    category: 'Safeguarding',
    description: 'Safeguarding welfare declarations, health screening, and resident contact checks.'
  },
  {
    id: 'rfaWelfare',
    title: 'RFA Welfare Checks',
    category: 'Safeguarding',
    description: 'Room and flat welfare checks register with vulnerability categorizations.'
  },
  {
    id: 'gpAppointments',
    title: 'GP Appointments',
    category: 'Safeguarding',
    description: 'Medical appointment attendance tracking, scheduled bookings, and DNA logs.'
  },
  {
    id: 'documentBuilder',
    title: 'HO Report Generator',
    category: 'Safeguarding',
    description: 'Official Home Office Incident Report (IR) document builder and export engine.'
  },

  // Facilities & Welfare
  {
    id: 'maintenance',
    title: 'Maintenance Tracker',
    category: 'Facilities & Welfare',
    description: 'Property defect reports, emergency CAT 1 hazards, and contractor remediation.'
  },
  {
    id: 'spcd',
    title: 'SPCD Tracker',
    category: 'Facilities & Welfare',
    description: 'Special Pest Control & Decontamination logs and resolution statuses.'
  },
  {
    id: 'irTracker',
    title: 'IR Tracker (Incidents)',
    category: 'Facilities & Welfare',
    description: 'Comprehensive property incident logging, witness accounts, and police logs.'
  },
  {
    id: 'publicTransport',
    title: 'Public Transport Tracker',
    category: 'Facilities & Welfare',
    description: 'Service user travel tickets, bus passes, and exceptional circumstances.'
  },
  {
    id: 'dispersal',
    title: 'Dispersal Sheet',
    category: 'Facilities & Welfare',
    description: 'Notice issuance, departure schedules, exit briefings, and relocation tracking.'
  },
  {
    id: 'booklets',
    title: 'Booklet Inventory',
    category: 'Facilities & Welfare',
    description: 'Multi-lingual informational booklet collection and replenishment logs.'
  },
  {
    id: 'laundry',
    title: 'Commercial Laundry Support',
    category: 'Facilities & Welfare',
    description: 'Weekly laundry cycle weights, contractor invoices, and variance flags.'
  },
  {
    id: 'food',
    title: 'Hot Meals Tracker',
    category: 'Facilities & Welfare',
    description: 'Daily hot meal distribution, vendor buffet temperature logs, and quality scores.'
  },
  {
    id: 'foodSurveys',
    title: 'Food Survey Checks',
    category: 'Facilities & Welfare',
    description: 'Resident meal satisfaction survey, dietary requirements, and 21-rating matrices.'
  },
  {
    id: 'foodWastage',
    title: 'Food Wastage Tracker',
    category: 'Facilities & Welfare',
    description: 'Portion surplus tracking, meal wastage auditing, and disposal compliance.'
  },
  {
    id: 'roomChecks',
    title: 'Room Checks (30-Point Audit)',
    category: 'Facilities & Welfare',
    description: '30-point room condition and safety inspection matrix with automated grading.'
  },
  {
    id: 'escalations',
    title: 'Escalations Log',
    category: 'Facilities & Welfare',
    description: 'Cross-module critical incident alerts, SLA timers, and supervisor sign-offs.'
  },
  {
    id: 'documents',
    title: 'Proof Documents Repository',
    category: 'Facilities & Welfare',
    description: 'Secure digital proof storage for safeguarding compliance and certificates.'
  },

  // Finance
  {
    id: 'finance',
    title: 'Vendor Invoices',
    category: 'Finance',
    description: 'Commercial supplier invoices, line item reconciliation, and payment statuses.'
  },
  {
    id: 'financeCreditCards',
    title: 'Credit Card Bills',
    category: 'Finance',
    description: 'Operational credit card expenditure logs and department expense receipts.'
  },
  {
    id: 'financeDeliveryNotes',
    title: 'Delivery Notes',
    category: 'Finance',
    description: 'Site goods receipt notes, physical delivery verifications, and signed proofs.'
  },
  {
    id: 'financeApprovals',
    title: 'Finance Approvals',
    category: 'Finance',
    description: 'Multi-tier financial authorization workflow and payment release approvals.'
  },

  // Compliance & Community
  {
    id: 'compliance',
    title: 'SD-Compliance Tracker',
    category: 'Compliance & Community',
    description: 'Statutory property compliance certificates, fire safety, gas, and electrical tests.'
  },
  {
    id: 'vcsDirectory',
    title: 'SD VCS Directory',
    category: 'Compliance & Community',
    description: 'Voluntary & Community Sector agency partners, contact directories, and services.'
  },
  {
    id: 'reports',
    title: 'Reports & SharePoint Hub',
    category: 'Compliance & Community',
    description: 'Comprehensive operational reports, data exports, and live Excel workbook sync.'
  },
  {
    id: 'audit',
    title: 'Audit Security Trail',
    category: 'Compliance & Community',
    description: 'Immutable, tamper-evident cryptographic log of all system changes and writes.'
  },
  {
    id: 'requests',
    title: 'Data Change Requests',
    category: 'Compliance & Community',
    description: 'Formal user requests to alter locked records, require managerial sign-off.'
  },

  // Admin & Governance
  {
    id: 'properties',
    title: 'Properties Directory',
    category: 'Admin & Governance',
    description: 'Hotel and accommodation site profiles, rooms inventory, and property managers.'
  },
  {
    id: 'users',
    title: 'Staff & User Accounts',
    category: 'Admin & Governance',
    description: 'User access directory, account provisioning, assigned sites, and credentials.'
  },
  {
    id: 'roles',
    title: 'Roles & RBAC Matrix',
    category: 'Admin & Governance',
    description: 'Granular role permissions matrix, export permissions, and authority levels.'
  },
  {
    id: 'setupOptions',
    title: 'Field Options & Setup',
    category: 'Admin & Governance',
    description: 'System dropdown options, custom lookup lists, and category tags.'
  },
  {
    id: 'notifications',
    title: 'Email Notifications Management',
    category: 'Admin & Governance',
    description: 'Automated SMTP email triggers, recipient rules, and incident notification alerts.'
  }
];

export const PAGE_ID_TO_TITLE: Record<string, string> = Object.fromEntries(
  APP_PAGES_REGISTRY.map(p => [p.id, p.title])
);

export function getPageTitle(pageId: string): string {
  if (PAGE_ID_TO_TITLE[pageId]) return PAGE_ID_TO_TITLE[pageId];
  if (pageId === 'settings') return 'System Preferences';
  return pageId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}
