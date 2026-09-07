/**
 * Environment constants and the module map.
 *
 * The app has no URL routing — `activePage` lives in React state — so every
 * module is reached by clicking a sidebar button. Labels carry a live badge
 * count ("SG Referrals 0"), hence prefix matching. The three archive toggles
 * are icon-only buttons with no text, so they are addressed by index.
 */

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
export const API = `${BASE_URL}/api`;

/** Built-in Super Admin. Works with the database offline; see DEF-02. */
export const MASTER = {
  email: 'stackmaster@sdcommercial.co.uk',
  password: 'Focusmode123!',
  name: 'Stack Master',
  id: 'ce98b46b-4a6a-4a66-a70a-72e6c56d7691',
  role: 'Super Admin',
};

export const STORAGE_KEYS = {
  token: 'sg_tracker_token',
  user: 'sg_tracker_auth_user',
  role: 'sg_tracker_role',
  permissions: 'sg_tracker_role_permissions',
  settings: 'sg_tracker_settings',
};

export type ModuleKey =
  | 'dashboard' | 'referrals' | 'referralsArchive' | 'vulnerable' | 'vulnerableArchive'
  | 'challenging' | 'challengingArchive' | 'maintenance' | 'spcd' | 'laundry' | 'food'
  | 'escalations' | 'documents' | 'reports' | 'audit' | 'requests' | 'properties'
  | 'users' | 'roles' | 'fieldOptions' | 'settings';

export interface ModuleDef {
  /** Sidebar label prefix. Absent for icon-only archive toggles. */
  label?: RegExp;
  /** Position in `nav button`, used for archive toggles and as a fallback. */
  index: number;
  /** Human name for test titles. */
  title: string;
  /** Button that opens the create form, where one exists. */
  createButton?: RegExp;
  /** Heading of the create modal. */
  createModalTitle?: RegExp;
  /** Button that submits the create form. */
  submitButton?: RegExp;
  /** API entity for seeding and teardown. */
  entity?: string;
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  dashboard: { label: /^Dashboard/, index: 0, title: 'Dashboard' },

  referrals: {
    label: /^SG Referrals/, index: 1, title: 'SG Referrals', entity: 'referrals',
    createButton: /^\+ New Record$/, createModalTitle: /New SG Referral Submission/,
    submitButton: /Submit & Confirm/,
  },
  referralsArchive: { index: 2, title: 'SG Referrals (Archive)' },

  vulnerable: {
    label: /^Vulnerable SUs/, index: 3, title: 'Vulnerable SUs', entity: 'vulnerable',
    createButton: /Log Vulnerable SU/, createModalTitle: /Log Vulnerable \/ Safeguarding Service User/,
    submitButton: /Save|Confirm|Log/,
  },
  vulnerableArchive: { index: 4, title: 'Vulnerable SUs (Archive)' },

  challenging: {
    label: /^Challenging SUs/, index: 5, title: 'Challenging SUs', entity: 'challenging',
    createButton: /^\+ Log Incident$/, createModalTitle: /Log Challenging SU Behavior/,
    submitButton: /Confirm & Save Incident/,
  },
  challengingArchive: { index: 6, title: 'Challenging SUs (Archive)' },

  maintenance: {
    label: /^Maintenance Tracker/, index: 7, title: 'Maintenance Tracker', entity: 'maintenance',
    createButton: /Log Maintenance Defect/, createModalTitle: /Log New Property Maintenance Defect/,
    submitButton: /Save & Log Ticket/,
  },
  spcd: {
    label: /^SPCD Tracker/, index: 8, title: 'SPCD Tracker', entity: 'spcd',
    createButton: /Add SPCD Case Entry/, createModalTitle: /Add SPCD Case Entry/,
    submitButton: /Save Entry/,
  },
  laundry: {
    label: /^Laundry Support/, index: 9, title: 'Laundry Support', entity: 'laundry',
    createButton: /Log Laundry Batch/, createModalTitle: /Add Property Laundry Log/,
    submitButton: /Add Log Record/,
  },
  food: {
    label: /^Hot Meals Tracker/, index: 10, title: 'Hot Meals Tracker', entity: 'food',
    createButton: /Add Vendor Buffet Log/, createModalTitle: /Add Hot Food Vendor Buffet Log/,
    submitButton: /Add Buffet Matrix/,
  },
  escalations: {
    label: /^Escalations Log/, index: 11, title: 'Escalations Log', entity: 'escalations',
    createButton: /Log Urgent Escalation/, createModalTitle: /Submit Safeguarding Escalation/,
    submitButton: /Submit Escalation/,
  },
  documents: {
    label: /^Proof Documents/, index: 12, title: 'Proof Documents', entity: 'documents',
    createButton: /Upload Document/, createModalTitle: /Upload Compliance Document/,
    submitButton: /Confirm & Upload/,
  },
  reports: { label: /^Reports & SharePoint/, index: 13, title: 'Reports & SharePoint' },
  audit: { label: /^Audit Security Trail/, index: 14, title: 'Audit Security Trail', entity: 'audit' },
  requests: { label: /^Requests & Approvals/, index: 15, title: 'Requests & Approvals', entity: 'requests' },
  properties: {
    label: /^Properties Directory/, index: 16, title: 'Properties Directory', entity: 'sites',
    createButton: /^Add Property$/, createModalTitle: /Add New Property/, submitButton: /^Add Property$/,
  },
  users: {
    label: /^Staff & User Accounts/, index: 17, title: 'Staff & User Accounts', entity: 'users',
    createButton: /^Add User$/, createModalTitle: /Add New Supabase User/, submitButton: /Create User/,
  },
  roles: { label: /^Roles & RBAC Matrix/, index: 18, title: 'Roles & RBAC Matrix' },
  fieldOptions: { label: /^Field Options & Setup/, index: 19, title: 'Field Options & Setup' },
  settings: { label: /^System Preferences/, index: 20, title: 'System Preferences' },
};

/**
 * Only these three share the common FilterBar (`#filter-site` / `#filter-month`
 * / `#filter-status`). Every other module rolls its own filter UI — verified by
 * probing the running app, so do not assume the shared IDs elsewhere.
 */
export const FILTERBAR_MODULES: ModuleKey[] = ['referrals', 'vulnerable', 'challenging'];

/** Modules that render the shared `#select-page-size` pager. */
export const PAGER_MODULES: ModuleKey[] = [
  'referrals', 'vulnerable', 'challenging', 'spcd',
  'escalations', 'documents', 'audit', 'properties',
];

/** Row action buttons are icon-only and identified solely by `title`. */
export const ROW_ACTION = {
  view: 'View Record Details',
  edit: 'Edit Record',
  archive: 'Archive',
  delete: 'Delete',
} as const;

/** Every created record carries this prefix so residue is greppable and teardown is exact. */
export const QA_PREFIX = 'QA-TEST';
export const runTag = (suite: string) =>
  `${QA_PREFIX}-${suite}-${Date.now().toString().slice(-7)}`;
