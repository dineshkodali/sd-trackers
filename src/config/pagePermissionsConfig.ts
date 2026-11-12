/**
 * Page Access Management - shared (browser + server) definitions.
 *
 * Model
 *  - A user with NO rows in user_page_permissions behaves exactly as before
 *    (role defaults only). Nothing changes for existing users.
 *  - A user with one or more rows is "restricted": a page absent from their rows
 *    is denied, and each action on a listed page needs its flag to be true.
 *  - Overrides only ever RESTRICT. Effective access = role allows AND override
 *    allows, so an override can never elevate a user above their role.
 */
import { APP_PAGES_REGISTRY } from './pageRegistry';

export type PageAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve';

export const ALL_PAGE_ACTIONS: PageAction[] = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

export const PAGE_ACTION_LABELS: Record<PageAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
  approve: 'Approve',
};

export type PagePermissionSet = Partial<Record<PageAction, boolean>>;
/** pageId -> granted actions. Presence of any key means the user is restricted. */
export type UserPagePermissions = Record<string, PagePermissionSet>;

const READ_ONLY_PAGES = new Set(['dashboard', 'operations']);
const NO_CREATE_PAGES = new Set(['reports', 'audit', 'dailyRegisters']);
const APPROVAL_PAGES = new Set(['financeApprovals', 'requests', 'finance', 'financeCreditCards', 'financeDeliveryNotes', 'suUsers', 'documentBuilder']);
const EXPORT_PAGES_EXCLUDED = new Set(['roles', 'setupOptions', 'notifications', 'pageAccess']);

/** Actions that are meaningful for a page (the UI shows only these). */
export function actionsForPage(pageId: string): PageAction[] {
  if (READ_ONLY_PAGES.has(pageId)) return ['view'];
  if (pageId === 'reports') return ['view', 'export'];
  if (pageId === 'audit') return ['view', 'export'];
  const actions: PageAction[] = ['view'];
  if (!NO_CREATE_PAGES.has(pageId)) actions.push('create');
  actions.push('edit', 'delete');
  if (!EXPORT_PAGES_EXCLUDED.has(pageId)) actions.push('export');
  if (APPROVAL_PAGES.has(pageId)) actions.push('approve');
  return actions;
}

/** Pages Super Admin may configure: every registered page. */
export const MANAGEABLE_PAGE_IDS: string[] = APP_PAGES_REGISTRY.map(p => p.id);
const MANAGEABLE_SET = new Set(MANAGEABLE_PAGE_IDS);

export function isManageablePage(pageId: string): boolean {
  return MANAGEABLE_SET.has(pageId);
}

/**
 * Data table -> page that owns it. Tables not listed here (profiles, sites, role/app
 * settings, audit, shared lookups such as service_users, properties, finance bills
 * that several pages share) are NOT page-restricted at the data layer; they keep
 * their existing role-based protection and the page is hidden in the UI.
 */
export const TABLE_PAGE_MAP: Record<string, string> = {
  referrals: 'referrals',
  vulnerable_residents: 'vulnerable',
  challenging_behavior: 'challenging',
  maintenance_records: 'maintenance',
  spcd_records: 'spcd',
  laundry_logs: 'laundry',
  daily_laundry_logs: 'laundry',
  hot_food_logs: 'food',
  escalations: 'escalations',
  documents: 'documents',
  public_transport_records: 'publicTransport',
  transport_feedback: 'publicTransport',
  transport_challenges: 'publicTransport',
  transport_funding_requests: 'publicTransport',
  oyster_cards: 'publicTransport',
  compliance_records: 'compliance',
  gp_appointments: 'gpAppointments',
  gp_registrations: 'gpAppointments',
  rfa_welfare_checks: 'rfaWelfare',
  dispersal_records: 'dispersal',
  booklet_collections: 'booklets',
  vcs_agencies: 'vcsDirectory',
  data_change_requests: 'requests',
  ir_records: 'irTracker',
  food_wastage_records: 'foodWastage',
  daily_register_rooms: 'dailyRegisters',
  daily_register_records: 'dailyRegisters',
  new_arrivals_records: 'dailyRegisters',
  eviction_records: 'dailyRegisters',
  welfare_checks: 'welfareChecks',
  food_surveys: 'foodSurveys',
  food_meal_ratings: 'foodSurveys',
  room_checks: 'roomChecks',
  room_check_items: 'roomChecks',
  peep_plans: 'peepTracker',
  peep_plan_history: 'peepTracker',
  su_attendance_records: 'suAttendance',
  absence_followups: 'suAttendance',
  mh_complaint_welfare_checks: 'mhComplaintWelfare',
  housekeeping_logs: 'housekeeping',
  housekeeping_room_logs: 'housekeeping',
  food_consumption_reports: 'foodConsumption',
  food_box_requests: 'foodConsumption',
  ho_report_templates: 'documentBuilder',
  ho_report_records: 'documentBuilder',
  doc_builder: 'documentBuilder',
};

export function pageForTable(table: string): string | undefined {
  return TABLE_PAGE_MAP[table];
}

export type PermissionVerdict = { allowed: boolean; restricted: boolean };

/**
 * Evaluate the override layer for one page/action.
 * `perms` null/empty (no rows) => not restricted => allowed (role rules decide).
 */
export function evaluateOverride(perms: UserPagePermissions | null | undefined, pageId: string, action: PageAction): PermissionVerdict {
  if (!perms || Object.keys(perms).length === 0) return { allowed: true, restricted: false };
  return { allowed: perms[pageId]?.[action] === true, restricted: true };
}

/** Strip unknown pages/actions and coerce to booleans (used on both server and client). */
export function sanitizePermissions(input: unknown): UserPagePermissions {
  const out: UserPagePermissions = {};
  if (!input || typeof input !== 'object') return out;
  for (const [pageId, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!isManageablePage(pageId) || !raw || typeof raw !== 'object') continue;
    const allowed = new Set(actionsForPage(pageId));
    const set: PagePermissionSet = {};
    for (const action of ALL_PAGE_ACTIONS) {
      set[action] = allowed.has(action) && (raw as Record<string, unknown>)[action] === true;
    }
    // Create/edit/delete/export/approve are meaningless without view.
    if (!set.view) for (const a of ALL_PAGE_ACTIONS) set[a] = false;
    out[pageId] = set;
  }
  return out;
}
