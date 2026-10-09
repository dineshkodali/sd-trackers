import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, isSupabaseConfigured, getSupabaseUrl, getSupabaseAnon } from '../supabase.js';
import { runDatabaseMigrations, loadSchemaSql } from '../migrate.js';
import { toDatabaseRow, fromDatabaseRow, TABLE_COLUMNS, DATA_TABLES, moduleLabelFor, resolveSiteId, resolveSiteName } from '../schemaAdapter.js';
import { requireRole } from '../middleware/requireAuth.js';
import { getLiveSchema, getLiveColumns, invalidateLiveSchema } from '../liveSchema.js';
import { seedReferenceData } from '../seed.js';
import { INITIAL_ROLE_PERMISSIONS } from '../../src/data/initialData.js';
import { masterDataStore } from '../masterDataStore.js';

const router = Router();

/**
 * Who may perform an operation on an entity:
 *   any        - any authenticated user
 *   admin      - Super Admin / Admin
 *   superadmin - Super Admin only
 *   append     - create only (any user); updates refused
 *   permission - governed by role_permissions.canDeleteRecords (deletes only)
 *   none       - not through this API
 */
type Policy = 'any' | 'admin' | 'superadmin' | 'append' | 'permission' | 'none';

interface EntityDef {
  page: string;
  table: string;
  read?: 'any' | 'admin';
  write?: Policy;
  remove?: Policy;
  /** Discriminator for entities sharing one table. */
  variant?: (record: any) => boolean;
  /** Alias kept for older clients; omitted from page coverage. */
  alias?: boolean;
}

const isPropertyLaundry = (r: any) => !!r.periodType || String(r.id || '').startsWith('prop-lau');
const isVendorBuffet = (r: any) => !!r.dailyCounts || String(r.id || '').startsWith('vendor-bf');

/**
 * Canonical entity registry: every page that stores data, the table that
 * holds it, and who may change it.
 */
export const ENTITY_REGISTRY: Record<string, EntityDef> = {
  referrals: { page: 'SG Referrals', table: 'referrals' },
  vulnerable: { page: 'Vulnerable SUs', table: 'vulnerable_residents' },
  challenging: { page: 'Challenging SUs', table: 'challenging_behavior' },
  maintenance: { page: 'Maintenance Tracker', table: 'maintenance_records' },
  spcd: { page: 'SPCD Tracker', table: 'spcd_records' },
  laundry: { page: 'Laundry Support - resident intake', table: 'laundry_logs', variant: r => !isPropertyLaundry(r) },
  property_laundry_logs: { page: 'Laundry Support - property logs', table: 'laundry_logs', variant: isPropertyLaundry },
  food: { page: 'Hot Meals Tracker - deliveries', table: 'hot_food_logs', variant: r => !isVendorBuffet(r) },
  food_vendor_buffet_logs: { page: 'Hot Meals Tracker - vendor buffet', table: 'hot_food_logs', variant: isVendorBuffet },
  escalations: { page: 'Escalations Log', table: 'escalations' },
  documents: { page: 'Proof Documents', table: 'documents' },
  publicTransport: { page: 'Public Transport Tracker', table: 'public_transport_records' },
  transportFeedback: { page: 'Transport Feedback', table: 'transport_feedback' },
  transport_feedback: { page: 'Transport Feedback', table: 'transport_feedback', alias: true },
  transportChallenges: { page: 'Transport Challenges', table: 'transport_challenges' },
  transport_challenges: { page: 'Transport Challenges', table: 'transport_challenges', alias: true },
  transportFundingRequests: { page: 'Transport Funding Requests', table: 'transport_funding_requests' },
  transport_funding_requests: { page: 'Transport Funding Requests', table: 'transport_funding_requests', alias: true },
  compliance: { page: 'SD-Compliance Tracker', table: 'compliance_records' },
  gpAppointments: { page: 'GP Appointments', table: 'gp_appointments' },
  rfaWelfare: { page: 'RFA Welfare Checks', table: 'rfa_welfare_checks' },
  dispersal: { page: 'Dispersal Sheet', table: 'dispersal_records' },
  booklets: { page: 'Booklets to be Collected', table: 'booklet_collections' },
  vcsAgencies: { page: 'SD VCS Directory', table: 'vcs_agencies' },
  requests: { page: 'Requests & Approvals', table: 'data_change_requests' },
  sites: { page: 'Properties Directory', table: 'sites', write: 'admin', remove: 'admin' },
  users: { page: 'Staff & User Accounts', table: 'profiles', write: 'admin', remove: 'none' },
  userGroups: { page: 'User Groups', table: 'user_groups', write: 'admin', remove: 'admin' },
  property_user_assignments: { page: 'Property Assignments', table: 'property_user_assignments', write: 'admin', remove: 'admin' },
  rolePermissions: { page: 'Roles & RBAC Matrix', table: 'role_permissions', write: 'admin', remove: 'admin' },
  fieldOptions: { page: 'Field Options & Setup', table: 'field_options', write: 'any', remove: 'any' },
  appSettings: { page: 'System Preferences', table: 'app_settings', write: 'admin', remove: 'none' },
  tableSchemas: { page: 'Custom Table Columns', table: 'table_schemas', write: 'admin', remove: 'admin' },
  audit_trails: { page: 'Audit Security Trail', table: 'audit_trails', write: 'append', remove: 'superadmin' },
  email_notification_rules: { page: 'Notifications - rules', table: 'email_notification_rules', write: 'none', remove: 'none' },
  email_notification_logs: { page: 'Notifications - delivery log', table: 'email_notification_logs', write: 'none', remove: 'none' },
  passwordAudit: { page: 'Password Audit Log', table: 'password_audit_logs', read: 'admin', write: 'none', remove: 'none' },
  financeBills: { page: 'Finance Bills & Invoices', table: 'finance_bills' },
  vendorInvoices: { page: 'Vendor Invoices', table: 'vendor_invoices' },
  creditCardBills: { page: 'Credit Card Bills', table: 'credit_card_bills' },
  deliveryNotes: { page: 'Delivery Notes', table: 'delivery_notes' },
  financeApprovals: { page: 'Finance Approvals', table: 'finance_approvals' },
  financeVendors: { page: 'Finance Vendors', table: 'finance_vendors' },
  financeBillItems: { page: 'Finance Bill Items', table: 'finance_bill_items' },
  financeBillAttachments: { page: 'Finance Bill Attachments', table: 'finance_bill_attachments' },
  irRecords: { page: 'IR Tracker', table: 'ir_records' },
  foodWastage: { page: 'Food Wastage Tracker', table: 'food_wastage_records' },
  dailyRegisterRooms: { page: 'Live Daily Registers - Room List', table: 'daily_register_rooms' },
  dailyRegisterRecords: { page: 'Live Daily Registers - Daily Register', table: 'daily_register_records' },
  newArrivals: { page: 'Live Daily Registers - New Arrivals', table: 'new_arrivals_records' },
  evictions: { page: 'Live Daily Registers - Evictions', table: 'eviction_records' },

  // HO Report Generator module (dedicated tables)
  hoReportTemplates: { page: 'HO Report Generator - Templates', table: 'ho_report_templates' },
  ho_report_templates: { page: 'HO Report Generator - Templates', table: 'ho_report_templates', alias: true },
  hoReportRecords: { page: 'HO Report Generator - Reports', table: 'ho_report_records' },
  ho_report_records: { page: 'HO Report Generator - Reports', table: 'ho_report_records', alias: true },
  hoReportAuditLogs: { page: 'HO Report Generator - Audit Trail', table: 'ho_report_audit_logs', write: 'append', remove: 'superadmin' },
  ho_report_audit_logs: { page: 'HO Report Generator - Audit Trail', table: 'ho_report_audit_logs', write: 'append', remove: 'superadmin', alias: true },

  // Document Builder module (legacy compatibility table)
  docBuilder: { page: 'HO Report Generator', table: 'doc_builder' },
  doc_builder: { page: 'HO Report Generator', table: 'doc_builder', alias: true },

  // Aliases used by existing clients
  audit: { page: 'Audit Security Trail', table: 'audit_trails', write: 'append', remove: 'superadmin', alias: true },
  laundry_logs: { page: 'Laundry Support - resident intake', table: 'laundry_logs', variant: r => !isPropertyLaundry(r), alias: true },
  hot_food_logs: { page: 'Hot Meals Tracker - deliveries', table: 'hot_food_logs', variant: r => !isVendorBuffet(r), alias: true },
  profiles: { page: 'Staff & User Accounts', table: 'profiles', write: 'admin', remove: 'none', alias: true },
  ir_records: { page: 'IR Tracker', table: 'ir_records', alias: true },
  food_wastage_records: { page: 'Food Wastage Tracker', table: 'food_wastage_records', alias: true },
  daily_register_rooms: { page: 'Live Daily Registers - Room List', table: 'daily_register_rooms', alias: true },
  daily_register_records: { page: 'Live Daily Registers - Daily Register', table: 'daily_register_records', alias: true },
  new_arrivals_records: { page: 'Live Daily Registers - New Arrivals', table: 'new_arrivals_records', alias: true },
  eviction_records: { page: 'Live Daily Registers - Evictions', table: 'eviction_records', alias: true },
  finance_bills: { page: 'Finance Bills & Invoices', table: 'finance_bills', alias: true },
  vendor_invoices: { page: 'Vendor Invoices', table: 'vendor_invoices', alias: true },
  credit_card_bills: { page: 'Credit Card Bills', table: 'credit_card_bills', alias: true },
  delivery_notes: { page: 'Delivery Notes', table: 'delivery_notes', alias: true },
  finance_approvals: { page: 'Finance Approvals', table: 'finance_approvals', alias: true },
  finance_bill_items: { page: 'Finance Bill Items', table: 'finance_bill_items', alias: true },
  finance_bill_attachments: { page: 'Finance Bill Attachments', table: 'finance_bill_attachments', alias: true },

  // Welfare Checks, Food Surveys & Room Checks
  welfareChecks: { page: 'Welfare Checks', table: 'welfare_checks' },
  welfare_checks: { page: 'Welfare Checks', table: 'welfare_checks', alias: true },
  foodSurveys: { page: 'Food Survey Checks', table: 'food_surveys' },
  food_surveys: { page: 'Food Survey Checks', table: 'food_surveys', alias: true },
  foodMealRatings: { page: 'Food Meal Ratings', table: 'food_meal_ratings' },
  food_meal_ratings: { page: 'Food Meal Ratings', table: 'food_meal_ratings', alias: true },
  roomChecks: { page: 'Room Checks', table: 'room_checks' },
  room_checks: { page: 'Room Checks', table: 'room_checks', alias: true },
  roomCheckItems: { page: 'Room Check Items', table: 'room_check_items' },
  room_check_items: { page: 'Room Check Items', table: 'room_check_items', alias: true },

  // Service User Master entities
  serviceUsers: { page: 'Service Users Master', table: 'service_users' },
  service_users: { page: 'Service Users Master', table: 'service_users', alias: true },
  suContacts: { page: 'Service Users - Contacts', table: 'service_user_contacts' },
  service_user_contacts: { page: 'Service Users - Contacts', table: 'service_user_contacts', alias: true },
  suHousehold: { page: 'Service Users - Household', table: 'service_user_household' },
  service_user_household: { page: 'Service Users - Household', table: 'service_user_household', alias: true },
  suSupport: { page: 'Service Users - Support', table: 'service_user_support' },
  service_user_support: { page: 'Service Users - Support', table: 'service_user_support', alias: true },
  suDocuments: { page: 'Service Users - Documents', table: 'service_user_documents' },
  service_user_documents: { page: 'Service Users - Documents', table: 'service_user_documents', alias: true },

  // Property Master entities
  properties: { page: 'Properties Master', table: 'properties' },
  propertyRooms: { page: 'Property Rooms', table: 'property_rooms' },
  property_rooms: { page: 'Property Rooms', table: 'property_rooms', alias: true },
  propertyFacilities: { page: 'Property Facilities', table: 'property_facilities' },
  property_facilities: { page: 'Property Facilities', table: 'property_facilities', alias: true },
  propertyAssets: { page: 'Property Assets', table: 'property_assets' },
  property_assets: { page: 'Property Assets', table: 'property_assets', alias: true },
  propertyCompliance: { page: 'Property Compliance', table: 'property_compliance' },
  property_compliance: { page: 'Property Compliance', table: 'property_compliance', alias: true },
  propertyDocuments: { page: 'Property Documents', table: 'property_documents' },
  property_documents: { page: 'Property Documents', table: 'property_documents', alias: true },
  propertyContacts: { page: 'Property Contacts', table: 'property_contacts' },
  property_contacts: { page: 'Property Contacts', table: 'property_contacts', alias: true },

  // Placements & Audit Logs
  placements: { page: 'Placements Master', table: 'placements' },
  auditLogs: { page: 'Master Audit Logs', table: 'audit_logs', read: 'admin', write: 'append', remove: 'superadmin' },
  audit_logs: { page: 'Master Audit Logs', table: 'audit_logs', read: 'admin', write: 'append', remove: 'superadmin', alias: true },
};

/** Retained for callers that imported the old name. */
export const PAGE_TABLE_REGISTRY = Object.fromEntries(
  Object.entries(ENTITY_REGISTRY).filter(([, d]) => !d.alias).map(([k, d]) => [k, { page: d.page, table: d.table }])
);

const ADMIN_ROLES = ['Super Admin', 'Admin'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isValidUuid = (val: any) => typeof val === 'string' && UUID_REGEX.test(val.trim());
const isMissingTableError = (error: any) => error?.code === '42P01' || error?.code === 'PGRST205';

function resolveEntity(req: Request, res: Response): EntityDef | null {
  const def = ENTITY_REGISTRY[req.params.entity];
  if (!def) {
    res.status(404).json({ success: false, error: `Unknown entity: ${req.params.entity}` });
    return null;
  }
  return def;
}

function requireDatabase(res: Response): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      success: false,
      error: 'Live database is not configured on the server (SUPABASE_URL / SUPABASE_SECRET_KEY). Changes cannot be saved.'
    });
    return null;
  }
  const client = getSupabaseAdmin();
  if (!client) {
    res.status(503).json({ success: false, error: 'Supabase client unavailable. Changes cannot be saved.' });
    return null;
  }
  return client;
}

function tableMissing(res: Response, table: string) {
  return res.status(503).json({
    success: false,
    tableMissing: true,
    table,
    error: `Database table "${table}" does not exist yet. An administrator must apply the database migration (Settings > Database > Run Migration).`
  });
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

let permissionCache: { at: number; canDelete: Map<string, boolean> } | null = null;

async function roleMayDelete(role: string): Promise<boolean> {
  if (role === 'Super Admin') return true;
  if (!permissionCache || Date.now() - permissionCache.at > 60_000) {
    const canDelete = new Map<string, boolean>();
    const client = getSupabaseAdmin();
    if (client) {
      const { data } = await client.from('role_permissions').select('id, can_delete_records');
      for (const row of data || []) canDelete.set(row.id, row.can_delete_records === true);
    }
    permissionCache = { at: Date.now(), canDelete };
  }
  if (permissionCache.canDelete.has(role)) return permissionCache.canDelete.get(role)!;
  return (INITIAL_ROLE_PERMISSIONS as Record<string, any>)[role]?.canDeleteRecords === true;
}

async function authorize(req: Request, res: Response, policy: Policy, operation: 'create' | 'update' | 'delete'): Promise<boolean> {
  const role = req.user?.role || '';
  let allowed = false;
  switch (policy) {
    case 'any': allowed = true; break;
    case 'admin': allowed = ADMIN_ROLES.includes(role); break;
    case 'superadmin': allowed = role === 'Super Admin'; break;
    case 'append': allowed = operation === 'create'; break;
    case 'permission': allowed = operation === 'delete' ? await roleMayDelete(role) : true; break;
    case 'none': allowed = false; break;
  }
  if (!allowed) {
    res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  }
  return allowed;
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS = new Set([
  'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE', 'SETTINGS_UPDATE', 'ROLE_CHANGE', 'BACKUP_EXPORT', 'DATA_RESTORE'
]);

interface ClientAuditContext {
  action?: string;
  module?: string;
  targetItem?: string;
  details?: string;
  site?: string;
}

/**
 * Descriptive audit text supplied by the client in the `x-audit-context`
 * header (base64 JSON). Only the description comes from the client: identity
 * always comes from the verified session.
 */
function readClientAuditContext(req: Request): ClientAuditContext | null {
  const raw = req.headers['x-audit-context'];
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 8192) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function callerIdentity(req: Request) {
  const u = req.user;
  return {
    validUuid: isValidUuid(u?.id) ? u.id : null,
    displayName: u?.name || u?.email || 'Authenticated Staff',
    role: u?.role || 'Staff',
    site: (req.headers['x-user-site'] as string) || u?.assignedSite || 'All Sites',
  };
}

async function recordAuditTrailEntry(req: Request, params: {
  defaultAction: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId?: string;
  site?: string;
  defaultDetails: string;
}) {
  if (params.entity === 'audit' || params.entity === 'audit_trails') return; // no self-auditing
  const client = getSupabaseAdmin();
  if (!client) return;

  try {
    const caller = callerIdentity(req);
    const ctx = readClientAuditContext(req) || {};
    const action = ctx.action && AUDIT_ACTIONS.has(ctx.action) ? ctx.action : params.defaultAction;
    const nowIso = new Date().toISOString();

    const row = toDatabaseRow('audit_trails', {
      id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: nowIso,
      user: caller.displayName,
      userId: caller.validUuid,
      role: caller.role,
      action,
      details: String(ctx.details || params.defaultDetails).slice(0, 4000),
      site: ctx.site || params.site || caller.site,
      module: ctx.module || moduleLabelFor(params.entity),
      entityType: params.entity,
      entityId: params.entityId,
      targetItem: ctx.targetItem ? String(ctx.targetItem).slice(0, 500) : params.entityId,
    }, caller.validUuid, await getLiveColumns('audit_trails'));

    const { error } = await client.from('audit_trails').insert(row);
    if (error) console.warn(`[Audit] audit_trails insert error: ${error.message}`);
  } catch (err: any) {
    console.warn('[Audit] error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * PostgREST (which Supabase sits on) caps a single response at 1000 rows and
 * gives no indication when it does so. Page through with `.range()` until the
 * table is exhausted or `limit` is reached (BUG-025). Paging needs a
 * deterministic order, so `id` is always the final sort key.
 */
const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000; // hard ceiling so one enormous table cannot exhaust memory

interface ListOptions {
  limit?: number;
  orderColumn?: string;
  ascending?: boolean;
  filters?: Array<[string, string]>;
}

const GLOBAL_SITE_ROLES = new Set(['Super Admin', 'Admin', 'Regional Manager']);

export function userCanAccessAllSites(user?: Express.Request['user']): boolean {
  if (!user) return false;
  if (GLOBAL_SITE_ROLES.has(user.role)) return true;
  const sites = Array.isArray(user.assignedSites) && user.assignedSites.length > 0
    ? user.assignedSites
    : (user.assignedSite ? [user.assignedSite] : []);
  return sites.includes('All Sites') || sites.includes('All');
}

export function getUserAssignedSites(user?: Express.Request['user']): string[] {
  if (!user) return [];
  const sites = Array.isArray(user.assignedSites) && user.assignedSites.length > 0
    ? user.assignedSites
    : (user.assignedSite ? [user.assignedSite] : []);
  return sites.map(s => String(s).trim()).filter(s => s && s !== 'Pending Assignment' && s !== 'All Sites' && s !== 'All');
}

export const TABLE_SITE_COLUMN: Record<string, string> = {
  referrals: 'site',
  vulnerable_residents: 'site',
  challenging_behavior: 'site',
  maintenance_records: 'site',
  spcd_records: 'site_name',
  laundry_logs: 'site',
  hot_food_logs: 'site',
  escalations: 'site',
  documents: 'site',
  public_transport_records: 'site_name',
  transport_feedback: 'site_name',
  transport_challenges: 'site_name',
  transport_funding_requests: 'site_name',
  transport_room_move_requests: 'site_name',
  compliance_records: 'site_name',
  gp_appointments: 'site_name',
  rfa_welfare_checks: 'site_name',
  dispersal_records: 'site_name',
  booklet_collections: 'hotel_name',
  vcs_agencies: 'hotel_name',
  data_change_requests: 'site',
  ir_records: 'site',
  food_wastage_records: 'site',
  daily_register_rooms: 'hotel',
  daily_register_records: 'hotel',
  new_arrivals_records: 'hotel',
  eviction_records: 'hotel',
  welfare_checks: 'site_name',
  food_surveys: 'site_name',
  room_checks: 'site_name',
  doc_builder: 'site',
  ho_report_records: 'site',
  ho_report_audit_logs: 'site',
  email_notification_logs: 'site',
  audit_trails: 'site',
  finance_bills: 'site_id',
  vendor_invoices: 'site_id',
  credit_card_bills: 'site_id',
  delivery_notes: 'site_id',
  finance_approvals: 'site_id',
  service_users: 'site_id',
  placements: 'site_id',
  properties: 'site_id',
  sites: 'name'
};

/** Match a row against user assigned sites supporting both site names and site IDs */
function rowMatchesUserSites(row: any, userAssignedSites: string[]): boolean {
  if (!row) return false;
  const allowedNames = new Set(userAssignedSites.map(s => s.toLowerCase().trim()));
  const allowedIds = new Set(userAssignedSites.map(s => (resolveSiteId(s) || s).toLowerCase().trim()));

  // Extract all possible site and property identifiers from row
  const rawSite = (
    row.site ||
    row.siteName ||
    row.site_name ||
    row.hotel ||
    row.hotelName ||
    row.hotel_name ||
    row.propertyName ||
    row.property_name ||
    row.name ||
    ''
  ).toLowerCase().trim();

  const rawSiteId = (row.siteId || row.site_id || '').toLowerCase().trim();

  // If row has a site name/text that directly matches
  if (rawSite && (allowedNames.has(rawSite) || allowedIds.has(rawSite))) {
    return true;
  }
  // If row has a site_id/siteId that directly matches
  if (rawSiteId && (allowedIds.has(rawSiteId) || allowedNames.has(rawSiteId))) {
    return true;
  }
  // If rawSite resolves to an ID that matches
  if (rawSite && allowedIds.has((resolveSiteId(rawSite) || '').toLowerCase().trim())) {
    return true;
  }
  // If rawSiteId resolves to a Name that matches
  if (rawSiteId && allowedNames.has((resolveSiteName(rawSiteId) || '').toLowerCase().trim())) {
    return true;
  }

  return false;
}

async function selectRows(
  client: SupabaseClient,
  tableName: string,
  opts: ListOptions = {},
  user?: Express.Request['user']
): Promise<{ data: any[] | null; error: any; truncated: boolean }> {
  const rows: any[] = [];
  const cap = Math.min(opts.limit ?? MAX_ROWS, MAX_ROWS);

  const isRestricted = user && !userCanAccessAllSites(user);
  const siteCol = TABLE_SITE_COLUMN[tableName];
  let allowedSites: string[] = [];

  if (isRestricted && siteCol) {
    allowedSites = getUserAssignedSites(user);
    // If a restricted staff member has no assigned properties, return 0 rows
    if (allowedSites.length === 0) {
      return { data: [], error: null, truncated: false };
    }
  }

  while (rows.length < cap) {
    const from = rows.length;
    const to = Math.min(from + PAGE_SIZE, cap) - 1;

    let query = client.from(tableName).select('*');

    // Enforce property-level scoping at database query layer
    if (isRestricted && siteCol && allowedSites.length > 0) {
      if (siteCol === 'site_id') {
        const siteIds = allowedSites.map(s => resolveSiteId(s) || s).filter(Boolean);
        if (siteIds.length === 1) {
          query = query.eq('site_id', siteIds[0]);
        } else {
          query = query.in('site_id', siteIds);
        }
      } else {
        const siteNames = allowedSites.map(s => resolveSiteName(s) || s).filter(Boolean);
        if (siteNames.length === 1) {
          query = query.eq(siteCol, siteNames[0]);
        } else {
          query = query.in(siteCol, siteNames);
        }
      }
    }

    for (const [column, value] of opts.filters || []) {
      query = query.eq(column, value);
    }
    if (opts.orderColumn && opts.orderColumn !== 'id') {
      query = query.order(opts.orderColumn, { ascending: opts.ascending ?? true, nullsFirst: false });
    }
    const { data, error } = await query.order('id', { ascending: true }).range(from, to);

    if (error) return { data: null, error, truncated: false };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < to - from + 1) break; // short page: table exhausted
  }

  return { data: rows, error: null, truncated: opts.limit === undefined && rows.length >= MAX_ROWS };
}

/** limit, order ("column.asc|desc") and equality filters, restricted to the table's known columns. */
function buildListOptions(src: { limit?: any; order?: any; eq?: Record<string, any> }, tableName: string): ListOptions {
  const opts: ListOptions = {};
  const known = TABLE_COLUMNS[tableName];
  const limit = Number(src.limit);
  if (Number.isFinite(limit) && limit > 0) opts.limit = Math.min(Math.trunc(limit), MAX_ROWS);

  const order = typeof src.order === 'string' ? src.order : '';
  const [column, direction] = order.split('.');
  if (column && known?.has(column)) {
    opts.orderColumn = column;
    opts.ascending = direction !== 'desc';
  }

  for (const [filterColumn, value] of Object.entries(src.eq || {})) {
    if (typeof value === 'string' && known?.has(filterColumn)) (opts.filters ||= []).push([filterColumn, value]);
  }
  return opts;
}

/** ?limit=N, ?order=column.asc|desc and equality filters ?eq.column=value. */
function parseListOptions(req: Request, tableName: string): ListOptions {
  const eq: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (key.startsWith('eq.') && typeof value === 'string') {
      const col = key.slice(3);
      if (col === 'site_id' || col === 'siteId') {
        eq['site_id'] = resolveSiteId(value) || value;
      } else if (col === 'site' || col === 'site_name' || col === 'hotel') {
        eq[col] = value.startsWith('site-') ? (resolveSiteName(value) || value) : value;
      } else {
        eq[col] = value;
      }
    }
  }
  return buildListOptions({ limit: req.query.limit, order: req.query.order, eq }, tableName);
}

/**
 * Child tables carry no site column of their own; they belong to a site through
 * their parent row. Without this map they were readable and writable across
 * every site by any signed-in user.
 */
export const TABLE_PARENT_SCOPE: Record<string, { linkColumn: string; linkField: string; parentTable: string }> = {
  service_user_contacts: { linkColumn: 'su_id', linkField: 'suId', parentTable: 'service_users' },
  service_user_household: { linkColumn: 'su_id', linkField: 'suId', parentTable: 'service_users' },
  service_user_support: { linkColumn: 'su_id', linkField: 'suId', parentTable: 'service_users' },
  service_user_documents: { linkColumn: 'su_id', linkField: 'suId', parentTable: 'service_users' },
  property_rooms: { linkColumn: 'property_id', linkField: 'propertyId', parentTable: 'properties' },
  property_facilities: { linkColumn: 'property_id', linkField: 'propertyId', parentTable: 'properties' },
  property_assets: { linkColumn: 'property_id', linkField: 'propertyId', parentTable: 'properties' },
  property_compliance: { linkColumn: 'property_id', linkField: 'propertyId', parentTable: 'properties' },
  property_documents: { linkColumn: 'property_id', linkField: 'propertyId', parentTable: 'properties' },
  property_contacts: { linkColumn: 'property_id', linkField: 'propertyId', parentTable: 'properties' },
  food_meal_ratings: { linkColumn: 'food_survey_id', linkField: 'foodSurveyId', parentTable: 'food_surveys' },
  room_check_items: { linkColumn: 'room_check_id', linkField: 'roomCheckId', parentTable: 'room_checks' },
  finance_bill_items: { linkColumn: 'bill_id', linkField: 'billId', parentTable: 'finance_bills' },
  finance_bill_attachments: { linkColumn: 'bill_id', linkField: 'billId', parentTable: 'finance_bills' },
};

/** Parent id a child row/record points at, whichever naming it uses; null when absent. */
function parentIdOf(record: any, scope: { linkColumn: string; linkField: string }): string | null {
  const value = record?.[scope.linkField] ?? record?.[scope.linkColumn];
  return value === undefined || value === null || value === '' ? null : String(value);
}

/** True when the caller's site scope must be applied through the parent row. */
function needsParentScope(table: string, user?: Express.Request['user']): boolean {
  return Boolean(user && !userCanAccessAllSites(user) && TABLE_PARENT_SCOPE[table]);
}

/** Ids of parent rows the caller may see (the parent read is itself site-scoped). */
async function allowedParentIds(client: SupabaseClient, table: string, user: Express.Request['user']): Promise<Set<string>> {
  const scope = TABLE_PARENT_SCOPE[table];
  const parentDef: EntityDef = { page: scope.parentTable, table: scope.parentTable };
  const result = await readEntityUnscopedChildren(client, parentDef, {}, user);
  return new Set((result.data || []).map((r: any) => String(r.id)));
}

async function readEntity(client: SupabaseClient, def: EntityDef, opts: ListOptions, user?: Express.Request['user']) {
  const result = await readEntityUnscopedChildren(client, def, opts, user);
  if (!result.success || !needsParentScope(def.table, user)) return result;
  const allowed = await allowedParentIds(client, def.table, user!);
  const scope = TABLE_PARENT_SCOPE[def.table];
  const data = (result.data || []).filter((r: any) => {
    const parentId = parentIdOf(r, scope);
    return parentId !== null && allowed.has(parentId);
  });
  return { ...result, data, total: data.length };
}

async function readEntityUnscopedChildren(client: SupabaseClient, def: EntityDef, opts: ListOptions, user?: Express.Request['user']) {
  if (masterDataStore.isMasterTable(def.table)) {
    const liveCols = await getLiveColumns(def.table);
    if (!liveCols || liveCols.size === 0) {
      let records = await masterDataStore.queryRecords(def.table, opts);
      if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {
        const assigned = getUserAssignedSites(user);
        records = records.filter((r: any) => rowMatchesUserSites(r, assigned));
      }
      return { success: true as const, data: records, total: records.length, truncated: false };
    }
  }
  const { data, error, truncated } = await selectRows(client, def.table, opts, user);
  if (error) {
    if (isMissingTableError(error) && masterDataStore.isMasterTable(def.table)) {
      let records = await masterDataStore.queryRecords(def.table, opts);
      if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {
        const assigned = getUserAssignedSites(user);
        records = records.filter((r: any) => rowMatchesUserSites(r, assigned));
      }
      return { success: true as const, data: records, total: records.length, truncated: false };
    }
    return { success: false as const, error: error.message, tableMissing: isMissingTableError(error), data: [] as any[] };
  }
  let rows = (data || []).map((row: any) => fromDatabaseRow(def.table, row));
  if (def.variant) rows = rows.filter(def.variant);

  // In-memory defense-in-depth scoping check for mapped rows
  if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {
    const assigned = getUserAssignedSites(user);
    rows = rows.filter((r: any) => rowMatchesUserSites(r, assigned));
  }

  if (rows.length === 0 && masterDataStore.isMasterTable(def.table)) {
    let records = await masterDataStore.queryRecords(def.table, opts);
    if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {
      const assigned = getUserAssignedSites(user);
      records = records.filter((r: any) => rowMatchesUserSites(r, assigned));
    }
    if (records.length > 0) {
      return { success: true as const, data: records, total: records.length, truncated: false };
    }
  }
  return { success: true as const, data: rows, total: rows.length, truncated };
}

// ---------------------------------------------------------------------------
// Static routes (declared before the parametric ones)
// ---------------------------------------------------------------------------

let cachedSchemaVersion: string | null = '2026-09-11.1';
let lastSchemaVersionCheck = 0;

function getSchemaVersionCached(client: SupabaseClient): string | null {
  if (Date.now() - lastSchemaVersionCheck > 60_000) {
    lastSchemaVersionCheck = Date.now();
    client.from('app_settings').select('value').eq('id', 'schema_version').maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'object' && (data.value as any).version) {
          cachedSchemaVersion = (data.value as any).version;
        }
      }, () => { });
  }
  return cachedSchemaVersion;
}

// GET /api/db/status — live connection, schema and per-page coverage
router.get('/status', async (_req: Request, res: Response) => {
  if (!isSupabaseConfigured()) {
    return res.json({
      connected: false,
      live: false,
      mode: 'unconfigured',
      message: 'Live database is not configured on the server. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.',
      tables: {},
      pages: []
    });
  }

  const client = getSupabaseAdmin() || getSupabaseAnon();
  const schema = await getLiveSchema(false);
  if (!client || !schema) {
    return res.json({
      connected: isSupabaseConfigured(),
      live: true,
      mode: 'supabase-cloud',
      message: 'Cloud database configured and active.',
      tables: {},
      pages: []
    });
  }

  const distinctTables = Array.from(new Set(Object.values(ENTITY_REGISTRY).map(d => d.table)));
  const tableInfo: Record<string, { exists: boolean; rows: number | null; missingColumns: string[]; error?: string }> = {};

  // Probe live row counts & existence from Supabase PostgREST with 15s caching
  await Promise.all(distinctTables.map(async (table) => {
    try {
      const { count, error } = await client.from(table).select('id', { count: 'exact' }).limit(1);
      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          tableInfo[table] = { exists: false, rows: null, missingColumns: [] };
        } else {
          tableInfo[table] = { exists: true, rows: count ?? 0, missingColumns: [], error: error.message };
        }
      } else {
        tableInfo[table] = { exists: true, rows: count ?? 0, missingColumns: [] };
      }
    } catch (e: any) {
      const live = schema.get(table);
      tableInfo[table] = { exists: Boolean(live), rows: null, missingColumns: [], error: e.message };
    }
  }));

  const pages = Object.entries(ENTITY_REGISTRY)
    .filter(([, d]) => !d.alias)
    .map(([entity, d]) => {
      const info = tableInfo[d.table];
      const status = !info.exists ? 'missing' : info.error ? 'error' : info.missingColumns.length > 0 ? 'outdated' : 'connected';
      return {
        entity,
        page: d.page,
        table: d.table,
        rows: info.rows,
        sharedTable: !!d.variant,
        missingColumns: info.missingColumns,
        connected: status === 'connected' || status === 'outdated',
        status
      };
    });

  // Per-entity row counts, for entities whose GET returns the whole table.
  const tables: Record<string, number | string> = {};
  for (const [entity, d] of Object.entries(ENTITY_REGISTRY)) {
    if (d.alias || d.variant) continue;
    const info = tableInfo[d.table];
    tables[entity] = !info.exists ? 'Error: table missing' : info.error ? `Error: ${info.error}` : (info.rows ?? 0);
  }

  const schemaVersion = getSchemaVersionCached(client);

  const missingTables = distinctTables.filter(t => !tableInfo[t].exists);
  const outdatedTables = distinctTables.filter(t => tableInfo[t].exists && tableInfo[t].missingColumns.length > 0);

  res.json({
    connected: true,
    live: true,
    mode: 'supabase-cloud',
    url: getSupabaseUrl(),
    schemaVersion,
    migrationRequired: missingTables.length > 0 || outdatedTables.length > 0,
    tables,
    pages,
    missingTables,
    outdatedTables,
    totalPages: pages.length,
    connectedPages: pages.filter(p => p.status === 'connected').length
  });
});

async function migrateAndSeed() {
  const migration = await runDatabaseMigrations();
  invalidateLiveSchema();
  const seed = await seedReferenceData();
  return { migration, seed };
}

router.post('/ensure', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
  const { migration, seed } = await migrateAndSeed();
  res.status(migration.success ? 200 : 500).json({ ...migration, seed });
});

// POST /api/db/migrate - apply db/schema.sql (non-destructive) and seed reference data
router.post('/migrate', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
  const { migration, seed } = await migrateAndSeed();
  res.status(migration.success ? 200 : 500).json({ ...migration, seed });
});

// GET /api/db/migration-sql - the migration script, for the Supabase SQL editor
// GET /api/db/finance-migration-sql - returns the complete finance module migration
router.get('/finance-migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const migPath = path.join(process.cwd(), 'db', 'migrations', '004_finance_module.sql');
  if (!fs.existsSync(migPath)) {
    return res.status(404).json({ success: false, error: 'Migration script db/migrations/004_finance_module.sql not found' });
  }
  const sql = fs.readFileSync(migPath, 'utf8');
  res.type('text/plain').send(sql);
});

// GET /api/db/registers-migration-sql - returns the 6 new tables migration script
router.get('/registers-migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const migPath = path.join(process.cwd(), 'db', 'migrations', '007_ir_food_and_registers.sql');
  if (!fs.existsSync(migPath)) {
    return res.status(404).json({ success: false, error: 'Migration script db/migrations/007_ir_food_and_registers.sql not found' });
  }
  const sql = fs.readFileSync(migPath, 'utf8');
  res.type('text/plain').send(sql);
});

// GET /api/db/ho-report-migration-sql - returns HO Report Generator migration script (009)
router.get('/ho-report-migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const migPath = path.join(process.cwd(), 'db', 'migrations', '009_ho_report_generator.sql');
  if (!fs.existsSync(migPath)) {
    return res.status(404).json({ success: false, error: 'Migration script db/migrations/009_ho_report_generator.sql not found' });
  }
  const sql = fs.readFileSync(migPath, 'utf8');
  res.type('text/plain').send(sql);
});

// GET /api/db/realtime-migration-sql - returns Supabase Realtime & REPLICA IDENTITY FULL script (010)
router.get('/realtime-migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const migPath = path.join(process.cwd(), 'db', 'migrations', '010_supabase_realtime.sql');
  if (!fs.existsSync(migPath)) {
    return res.status(404).json({ success: false, error: 'Migration script db/migrations/010_supabase_realtime.sql not found' });
  }
  const sql = fs.readFileSync(migPath, 'utf8');
  res.type('text/plain').send(sql);
});

// GET /api/db/checks-migration-sql - returns Welfare, Food & Room checks script (011)
router.get('/checks-migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const migPath = path.join(process.cwd(), 'db', 'migrations', '011_welfare_food_room_checks.sql');
  if (!fs.existsSync(migPath)) {
    return res.status(404).json({ success: false, error: 'Migration script db/migrations/011_welfare_food_room_checks.sql not found' });
  }
  const sql = fs.readFileSync(migPath, 'utf8');
  res.type('text/plain').send(sql);
});

// GET /api/db/transport-migration-sql - returns Public Transport enhancements migration script (014)
router.get('/transport-migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const migPath = path.join(process.cwd(), 'db', 'migrations', '014_public_transport_enhancements.sql');
  if (!fs.existsSync(migPath)) {
    return res.status(404).json({ success: false, error: 'Migration script db/migrations/014_public_transport_enhancements.sql not found' });
  }
  const sql = fs.readFileSync(migPath, 'utf8');
  res.type('text/plain').send(sql);
});

router.get('/migration-sql', requireRole(...ADMIN_ROLES), (_req: Request, res: Response) => {
  const sql = loadSchemaSql();
  if (!sql) return res.status(404).json({ success: false, error: 'db/schema.sql not found' });
  res.type('text/plain').send(sql);
});

/**
 * POST /api/db/batch-read  { requests: [{ key?, entity, limit?, order?, eq? }] }
 *
 * Loads several entities in one round trip - the application's periodic sync
 * reads every page's data, and one request per entity would be ~27 requests
 * every 45 seconds per open tab. Each entity succeeds or fails independently.
 */
router.post('/batch-read', async (req: Request, res: Response) => {
  const client = requireDatabase(res);
  if (!client) return;

  const requests = req.body?.requests;
  if (!Array.isArray(requests) || requests.length === 0 || requests.length > 60) {
    return res.status(400).json({ success: false, error: 'Body must be { requests: [...] } with 1-60 entries' });
  }

  const role = req.user?.role || '';
  const results: Record<string, any> = {};
  await Promise.all(requests.map(async (r: any) => {
    const key = String(r?.key || r?.entity || '');
    const def = ENTITY_REGISTRY[r?.entity];
    if (!def) {
      results[key] = { success: false, error: `Unknown entity: ${r?.entity}`, data: [] };
      return;
    }
    if (def.read === 'admin' && !ADMIN_ROLES.includes(role)) {
      results[key] = { success: false, error: 'Insufficient privileges for this operation', data: [] };
      return;
    }
    try {
      results[key] = await readEntity(client, def, buildListOptions(r, def.table), req.user);
    } catch (err: any) {
      results[key] = { success: false, error: err.message, data: [] };
    }
  }));

  res.json({ success: true, results });
});

// POST /api/db/seed - seed reference data into empty tables
router.post('/seed', requireRole(...ADMIN_ROLES), async (_req: Request, res: Response) => {
  const seed = await seedReferenceData();
  res.status(seed.errors.length ? 500 : 200).json({ success: seed.errors.length === 0, ...seed });
});

// ---------------------------------------------------------------------------
// Write helpers shared by single, bulk and sync routes
// ---------------------------------------------------------------------------

const UUID_PRIMARY_KEY_TABLES = new Set([
  'finance_bills',
  'finance_vendors',
  'finance_approvals',
  'finance_bill_items',
  'finance_bill_attachments',
  'organizations',
  'vendor_invoices',
  'credit_card_bills',
  'delivery_notes',
  'welfare_checks',
  'food_surveys',
  'food_meal_ratings',
  'room_checks',
  'room_check_items'
]);

const VIEW_WRITE_TARGETS: Record<string, { table: string; defaultBillType?: string }> = {
  vendor_invoices: { table: 'finance_bills', defaultBillType: 'vendor_invoice' },
  credit_card_bills: { table: 'finance_bills', defaultBillType: 'credit_card_expense' },
  delivery_notes: { table: 'finance_bills', defaultBillType: 'delivery_note' },
};


function ensureId(entityDef: EntityDef, record: any) {
  if (entityDef.table === 'profiles') return record;
  const isUuid = UUID_PRIMARY_KEY_TABLES.has(entityDef.table) ||
    (VIEW_WRITE_TARGETS[entityDef.table] && UUID_PRIMARY_KEY_TABLES.has(VIEW_WRITE_TARGETS[entityDef.table].table));
  if (isUuid) {
    if (!isValidUuid(record.id)) {
      return { ...record, id: crypto.randomUUID() };
    }
    return record;
  }
  if (record.id === undefined || record.id === null || String(record.id).trim() === '') {
    return { ...record, id: crypto.randomUUID() };
  }
  return record;
}

function getWriteTarget(entityDef: EntityDef, record?: any): { table: string; record: any } {
  const target = VIEW_WRITE_TARGETS[entityDef.table];
  if (!target) return { table: entityDef.table, record };
  const enriched = { ...record };
  if (target.defaultBillType && !enriched.bill_type && !enriched.billType) {
    enriched.bill_type = target.defaultBillType;
    enriched.billType = target.defaultBillType;
  }
  return { table: target.table, record: enriched };
}

/** Identity on client-submitted audit entries always comes from the session. */
function withVerifiedAuditIdentity(req: Request, entityDef: EntityDef, record: any) {
  if (entityDef.table !== 'audit_trails') return record;
  const caller = callerIdentity(req);
  return {
    ...record,
    user: caller.displayName,
    performedByUser: caller.displayName,
    userId: caller.validUuid,
    role: caller.role,
    performedByRole: caller.role,
    timestamp: record.timestamp || new Date().toISOString()
  };
}

async function bulkUpsert(
  client: SupabaseClient,
  req: Request,
  entityDef: EntityDef,
  records: any[],
  liveCols: Set<string>
): Promise<{ data: any[]; error: any }> {
  const caller = callerIdentity(req);
  const writeTarget = VIEW_WRITE_TARGETS[entityDef.table];
  const writeTable = writeTarget?.table || entityDef.table;
  const writeCols = writeTarget ? (await getLiveColumns(writeTable) || TABLE_COLUMNS[writeTable] || liveCols) : liveCols;

  const rows = records.map(r => {
    const withAudit = withVerifiedAuditIdentity(req, entityDef, ensureId(entityDef, r));
    const { record } = getWriteTarget(entityDef, withAudit);
    return toDatabaseRow(writeTable, record, caller.validUuid, writeCols);
  });
  const saved: any[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await client.from(writeTable).upsert(rows.slice(i, i + 500)).select();
    if (error) return { data: saved, error };
    saved.push(...(data || []));
  }
  return { data: saved, error: null };
}

// ---------------------------------------------------------------------------
// Write-side authorization (site scope, protected fields)
// ---------------------------------------------------------------------------

const FINANCE_STATUS_TABLES = new Set(['finance_bills', 'vendor_invoices', 'credit_card_bills', 'delivery_notes', 'finance_approvals']);
const FINANCE_PRIVILEGED_STATUSES = new Set(['approved', 'paid', 'under_review']);
const SITE_FIELDS = ['site', 'siteName', 'site_name', 'hotel', 'hotelName', 'hotel_name', 'propertyName', 'property_name', 'siteId', 'site_id'];

const SCOPE_UNVERIFIABLE = 'Unable to verify access to this record right now. Please retry.';

/**
 * Existing rows by id, from Supabase or (when the table is not migrated yet)
 * the file-backed master store. Returns null when rows could not be read, so
 * callers fail closed instead of treating "unknown" as "not found".
 */
async function loadExistingRows(client: SupabaseClient, table: string, ids: string[]): Promise<Map<string, any> | null> {
  const map = new Map<string, any>();
  const clean = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.length > 0)));
  if (clean.length === 0) return map;
  for (let i = 0; i < clean.length; i += 200) {
    const { data, error } = await client.from(table).select('*').in('id', clean.slice(i, i + 200));
    if (error) {
      if (isMissingTableError(error) && masterDataStore.isMasterTable(table)) {
        const wanted = new Set(clean);
        for (const row of await masterDataStore.queryRecords(table)) {
          if (wanted.has(String(row.id))) map.set(String(row.id), row);
        }
        return map;
      }
      return null;
    }
    for (const row of data || []) map.set(String(row.id), row);
  }
  if (map.size < clean.length && masterDataStore.isMasterTable(table)) {
    const wanted = new Set(clean.filter(id => !map.has(id)));
    for (const row of await masterDataStore.queryRecords(table)) {
      if (wanted.has(String(row.id))) map.set(String(row.id), row);
    }
  }
  return map;
}

/** Child-table check: both the stored and the submitted parent must be visible to the caller. */
async function parentScopeError(client: SupabaseClient, user: Express.Request['user'], table: string, records: any[], existing: Map<string, any>): Promise<string | null> {
  if (!needsParentScope(table, user)) return null;
  const scope = TABLE_PARENT_SCOPE[table];
  const allowed = await allowedParentIds(client, table, user!);
  for (const r of records) {
    const prev = existing.get(String(r?.id));
    const prevParent = prev ? parentIdOf(prev, scope) : null;
    if (prev && (prevParent === null || !allowed.has(prevParent))) return 'This record belongs to a site outside your assignment.';
    const nextParent = parentIdOf(r, scope);
    if (nextParent !== null ? !allowed.has(nextParent) : !prev) return 'Records can only be saved for your assigned sites.';
  }
  return null;
}

/**
 * Reads were site-scoped but writes were not, so a restricted user could update
 * or delete another site's records by id, approve finance bills by editing the
 * status column, or grant the Super Admin role. Returns an error or null.
 */
async function writeScopeError(client: SupabaseClient, req: Request, def: EntityDef, records: any[]): Promise<string | null> {
  const user = req.user;
  const role = user?.role || '';
  const writeTable = VIEW_WRITE_TARGETS[def.table]?.table || def.table;
  const existing = await loadExistingRows(client, writeTable, records.map(r => r?.id).filter(Boolean).map(String));
  if (!existing) return SCOPE_UNVERIFIABLE;

  if (def.table === 'profiles' && role !== 'Super Admin') {
    for (const r of records) {
      const prev = existing.get(String(r?.id));
      if (r?.role === 'Super Admin' || prev?.role === 'Super Admin') {
        return 'Only a Super Admin can grant or modify the Super Admin role.';
      }
    }
  }

  if (FINANCE_STATUS_TABLES.has(def.table) && !ADMIN_ROLES.includes(role)) {
    for (const r of records) {
      const prev = existing.get(String(r?.id));
      const nextStatus = String(r?.status ?? '').toLowerCase();
      if (nextStatus && nextStatus !== String(prev?.status ?? '').toLowerCase() && FINANCE_PRIVILEGED_STATUSES.has(nextStatus)) {
        return 'Approval status can only be changed through the Finance approval workflow.';
      }
      const nextApprover = r?.final_approved_by ?? r?.finalApprovedBy;
      if (nextApprover && String(nextApprover) !== String(prev?.final_approved_by ?? '')) {
        return 'Approval fields can only be changed through the Finance approval workflow.';
      }
    }
  }

  // Append-only entities always get a fresh server-generated id (they can never
  // overwrite another site's entry), so creation is not site-restricted.
  if (def.write === 'append') return null;

  if (user && !userCanAccessAllSites(user) && TABLE_SITE_COLUMN[def.table]) {
    const sites = getUserAssignedSites(user);
    for (const r of records) {
      const prev = existing.get(String(r?.id));
      if (prev && !rowMatchesUserSites(prev, sites)) return 'This record belongs to a site outside your assignment.';
      const setsSite = SITE_FIELDS.some(f => r?.[f] !== undefined && r?.[f] !== null && r?.[f] !== '');
      if (setsSite ? !rowMatchesUserSites(r, sites) : !prev) return 'Records can only be saved for your assigned sites.';
    }
  }

  // Verify that any specified property exists and is not decommissioned
  if (def.table !== 'properties' && def.table !== 'sites' && def.table !== 'audit_trails' && def.table !== 'app_settings') {
    for (const r of records) {
      const siteVal = (r?.site || r?.siteName || r?.site_name || r?.hotel || r?.hotelName || r?.hotel_name || r?.propertyName || r?.property_name || '').trim();
      const siteIdVal = (r?.siteId || r?.site_id || '').trim();
      if (siteVal || siteIdVal) {
        try {
          if (siteIdVal) {
            const { data: propById } = await client.from('properties').select('id, status').eq('id', siteIdVal).maybeSingle();
            if (propById && String(propById.status).toLowerCase() === 'decommissioned') {
              return `The property with ID "${siteIdVal}" has been decommissioned and cannot accept new records.`;
            }
          }
          if (siteVal) {
            const { data: propByName } = await client.from('properties').select('id, status').ilike('property_name', siteVal).maybeSingle();
            if (propByName && String(propByName.status).toLowerCase() === 'decommissioned') {
              return `The property "${siteVal}" has been decommissioned and cannot accept new records.`;
            }
            const { data: siteByName } = await client.from('sites').select('id, status').ilike('name', siteVal).maybeSingle();
            if (siteByName && String(siteByName.status).toLowerCase() === 'decommissioned') {
              return `The property "${siteVal}" has been decommissioned and cannot accept new records.`;
            }
          }
        } catch {
          // Fall back gracefully
        }
      }
    }
  }

  return parentScopeError(client, user, def.table, records, existing);
}

/** Cascade delete child property entities and matching site row */
async function cascadeDeleteProperty(client: SupabaseClient, propertyIds: string[]) {
  if (!propertyIds || propertyIds.length === 0) return;
  const childTables = [
    'property_rooms',
    'property_facilities',
    'property_assets',
    'property_compliance',
    'property_documents',
    'property_contacts'
  ];
  for (const childTable of childTables) {
    try {
      await client.from(childTable).delete().in('property_id', propertyIds);
    } catch (e) {
      console.warn(`[Cascade Delete] error on ${childTable}:`, e);
    }
  }

  // Also remove matching rows from sites table
  try {
    const { data: propRows } = await client.from('properties').select('id, property_name, property_reference').in('id', propertyIds);
    const names = (propRows || []).map(p => p.property_name).filter(Boolean);
    const refs = (propRows || []).map(p => p.property_reference).filter(Boolean);

    await client.from('sites').delete().in('id', propertyIds);
    if (names.length > 0) {
      await client.from('sites').delete().in('name', names);
    }
    if (refs.length > 0) {
      await client.from('sites').delete().in('site_code', refs);
    }
  } catch (e) {
    console.warn(`[Cascade Delete] error on sites:`, e);
  }
}

async function deleteScopeError(client: SupabaseClient, req: Request, def: EntityDef, ids: string[]): Promise<string | null> {
  const user = req.user;
  if (!user || userCanAccessAllSites(user)) return null;
  const siteScoped = Boolean(TABLE_SITE_COLUMN[def.table]);
  const parentScoped = needsParentScope(def.table, user);
  if (!siteScoped && !parentScoped) return null;

  const writeTable = VIEW_WRITE_TARGETS[def.table]?.table || def.table;
  const existing = await loadExistingRows(client, writeTable, ids);
  if (!existing) return SCOPE_UNVERIFIABLE;

  if (siteScoped) {
    const sites = getUserAssignedSites(user);
    for (const row of existing.values()) {
      if (!rowMatchesUserSites(row, sites)) return 'This record belongs to a site outside your assignment.';
    }
  }
  if (parentScoped) {
    const scope = TABLE_PARENT_SCOPE[def.table];
    const allowed = await allowedParentIds(client, def.table, user);
    for (const row of existing.values()) {
      const parentId = parentIdOf(row, scope);
      if (parentId === null || !allowed.has(parentId)) return 'This record belongs to a site outside your assignment.';
    }
  }
  return null;
}

/** Append-only entities always get a server-generated id, so an existing entry can never be overwritten. */
function freshIdIfAppendOnly(def: EntityDef, record: any) {
  return def.write === 'append' ? { ...record, id: undefined } : record;
}

// POST /api/db/sync/push - bulk upsert of several entities at once
router.post('/sync/push', async (req: Request, res: Response) => {
  const client = requireDatabase(res);
  if (!client) return;

  const results: Record<string, string> = {};
  for (const [entity, records] of Object.entries(req.body || {})) {
    const def = ENTITY_REGISTRY[entity];
    if (!def || !Array.isArray(records) || records.length === 0) continue;
    const policy = def.write || 'any';
    const role = req.user?.role || '';
    const permitted = policy === 'any' || (policy === 'admin' && ADMIN_ROLES.includes(role)) || (policy === 'superadmin' && role === 'Super Admin');
    if (!permitted) {
      results[entity] = 'Error: insufficient privileges';
      continue;
    }
    const scopeError = await writeScopeError(client, req, def, records);
    if (scopeError) {
      results[entity] = `Error: ${scopeError}`;
      continue;
    }
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) {
      results[entity] = `Error: table ${def.table} missing`;
      continue;
    }
    const { error } = await bulkUpsert(client, req, def, records, liveCols || TABLE_COLUMNS[def.table]);
    results[entity] = error ? `Error: ${error.message}` : `Synced ${records.length} items`;
  }

  const failed = Object.values(results).some(v => v.startsWith('Error'));
  res.status(failed ? 207 : 200).json({ success: !failed, message: failed ? 'Some entities failed to sync' : 'Cloud sync operation completed', results });
});

// ---------------------------------------------------------------------------
// Parametric routes (/:entity, /:entity/:id)
// ---------------------------------------------------------------------------

// GET /api/db/:entity  (optional ?limit=N&order=column.asc|desc)
router.get('/:entity', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (def.read === 'admin' && !ADMIN_ROLES.includes(req.user?.role || '')) {
    return res.status(403).json({ success: false, error: 'Insufficient privileges for this operation' });
  }
  const client = requireDatabase(res);
  if (!client) return;

  try {
    const result = await readEntity(client, def, parseListOptions(req, def.table), req.user);
    if (!result.success) {
      if (result.tableMissing) return tableMissing(res, def.table);
      return res.status(500).json({ success: false, error: result.error });
    }
    // `total` and `truncated` let a caller tell a complete result from a capped one.
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/db/:entity/bulk  { records: [...] }
router.post('/:entity/bulk', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.write || 'any', 'create'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const rawRecords = req.body?.records;
  if (!Array.isArray(rawRecords) || rawRecords.some(r => !r || typeof r !== 'object' || Array.isArray(r))) {
    return res.status(400).json({ success: false, error: 'Body must be { records: [ {...}, ... ] }' });
  }
  if (rawRecords.length > 5000) {
    return res.status(413).json({ success: false, error: 'At most 5000 records per bulk request' });
  }
  if (rawRecords.length === 0) return res.json({ success: true, count: 0, records: [] });
  const records = rawRecords.map(r => freshIdIfAppendOnly(def, r));
  const bulkScopeError = await writeScopeError(client, req, def, records);
  if (bulkScopeError) return res.status(403).json({ success: false, error: bulkScopeError });

  const liveCols = await getLiveColumns(def.table);
  if (liveCols && liveCols.size === 0) {
    if (masterDataStore.isMasterTable(def.table)) {
      const saved = await masterDataStore.bulkUpsert(def.table, records);
      return res.json({ success: true, count: saved.length, records: saved });
    }
    return tableMissing(res, def.table);
  }

  const { data, error } = await bulkUpsert(client, req, def, records, liveCols || TABLE_COLUMNS[def.table]);
  if (error) {
    if (isMissingTableError(error)) {
      if (masterDataStore.isMasterTable(def.table)) {
        const saved = await masterDataStore.bulkUpsert(def.table, records);
        return res.json({ success: true, count: saved.length, records: saved });
      }
      return tableMissing(res, def.table);
    }
    return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
  }

  if (def.table === 'role_permissions') permissionCache = null;
  recordAuditTrailEntry(req, {
    defaultAction: 'UPDATE',
    entity: req.params.entity,
    defaultDetails: `Bulk saved ${records.length} ${req.params.entity} record(s)`
  });

  res.json({ success: true, count: data.length, records: data.map(row => fromDatabaseRow(def.table, row)) });
});

// POST /api/db/:entity/bulk-delete  { ids: [...] }
router.post('/:entity/bulk-delete', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.remove || 'permission', 'delete'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || id.length === 0)) {
    return res.status(400).json({ success: false, error: 'Body must be { ids: [ "id", ... ] }' });
  }
  if (ids.length === 0) return res.json({ success: true, deleted: 0 });
  const bulkDeleteScopeError = await deleteScopeError(client, req, def, ids);
  if (bulkDeleteScopeError) return res.status(403).json({ success: false, error: bulkDeleteScopeError });

  const writeTable = VIEW_WRITE_TARGETS[def.table]?.table || def.table;
  if (def.table === 'properties') {
    await cascadeDeleteProperty(client, ids);
  }
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await client.from(writeTable).delete().in('id', ids.slice(i, i + 200)).select('id');
    if (error) {
      if (isMissingTableError(error)) return tableMissing(res, writeTable);
      return res.status(500).json({ success: false, error: error.message, deleted });
    }
    deleted += data?.length || 0;
  }

  if (def.table === 'role_permissions') permissionCache = null;
  if (deleted > 0) {
    recordAuditTrailEntry(req, {
      defaultAction: 'DELETE',
      entity: req.params.entity,
      defaultDetails: `Bulk deleted ${deleted} ${req.params.entity} record(s)`
    });
  }
  res.json({ success: true, deleted });
});

// POST /api/db/:entity — create (or replace) one record
router.post('/:entity', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.write || 'any', 'create'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'Body must be a JSON object' });
  }
  req.body = freshIdIfAppendOnly(def, req.body);
  const createScopeError = await writeScopeError(client, req, def, [req.body]);
  if (createScopeError) return res.status(403).json({ success: false, error: createScopeError });

  try {
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) {
      if (masterDataStore.isMasterTable(def.table)) {
        const caller = callerIdentity(req);
        const withAudit = withVerifiedAuditIdentity(req, def, ensureId(def, req.body));
        const saved = await masterDataStore.upsertRecord(def.table, withAudit);
        recordAuditTrailEntry(req, {
          defaultAction: 'CREATE',
          entity: req.params.entity,
          entityId: saved.id,
          site: req.body.site || req.body.siteName,
          defaultDetails: `Created ${req.params.entity} record [${saved.id}]`
        });
        return res.status(201).json({ success: true, record: saved, fullFidelity: true });
      }
      return tableMissing(res, def.table);
    }

    const caller = callerIdentity(req);
    const withAudit = withVerifiedAuditIdentity(req, def, ensureId(def, req.body));
    const { table: writeTable, record } = getWriteTarget(def, withAudit);
    const writeCols = await getLiveColumns(writeTable);
    const dbRow = toDatabaseRow(writeTable, record, caller.validUuid, writeCols || TABLE_COLUMNS[writeTable] || liveCols);

    const { data, error } = await client.from(writeTable).upsert(dbRow).select().single();
    if (error) {
      if (isMissingTableError(error)) {
        if (masterDataStore.isMasterTable(writeTable)) {
          const saved = await masterDataStore.upsertRecord(writeTable, record);
          recordAuditTrailEntry(req, {
            defaultAction: 'CREATE',
            entity: req.params.entity,
            entityId: saved.id,
            site: record.site || record.siteName,
            defaultDetails: `Created ${req.params.entity} record [${saved.id}]`
          });
          return res.status(201).json({ success: true, record: saved, fullFidelity: true });
        }
        return tableMissing(res, writeTable);
      }
      console.error(`[DB POST /api/db/${req.params.entity}] ${error.message}`);
      return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
    }

    const saved = fromDatabaseRow(def.table, data || dbRow);
    if (def.table === 'role_permissions') permissionCache = null;

    recordAuditTrailEntry(req, {
      defaultAction: 'CREATE',
      entity: req.params.entity,
      entityId: saved.id || dbRow.id,
      site: record.site || record.siteName,
      defaultDetails: `Created ${req.params.entity} record [${saved.id || dbRow.id}]`
    });

    res.status(201).json({ success: true, record: saved, fullFidelity: DATA_TABLES.has(def.table) ? (liveCols ? liveCols.has('data') : true) : true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/db/:entity/:id — merge an update onto the stored record
router.put('/:entity/:id', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.write || 'any', 'update'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const { id } = req.params;
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ success: false, error: 'Body must be a JSON object' });
  }
  const updateScopeError = await writeScopeError(client, req, def, [{ ...req.body, id }]);
  if (updateScopeError) return res.status(403).json({ success: false, error: updateScopeError });

  try {
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) {
      if (masterDataStore.isMasterTable(def.table)) {
        const saved = await masterDataStore.upsertRecord(def.table, { ...req.body, id });
        recordAuditTrailEntry(req, {
          defaultAction: 'UPDATE',
          entity: req.params.entity,
          entityId: id,
          site: req.body.site || req.body.siteName,
          defaultDetails: `Updated ${req.params.entity} record [${id}]`
        });
        return res.json({ success: true, record: saved });
      }
      return tableMissing(res, def.table);
    }
    const writeTarget = VIEW_WRITE_TARGETS[def.table];
    const writeTable = writeTarget?.table || def.table;
    const writeCols = writeTarget ? (await getLiveColumns(writeTable) || TABLE_COLUMNS[writeTable]) : null;
    const allowed = writeCols || liveCols || TABLE_COLUMNS[writeTable] || TABLE_COLUMNS[def.table];
    const caller = callerIdentity(req);

    // Read full existing record so untouched columns survive merging
    const { data: existingRow, error: readError } = await client.from(writeTable).select('*').eq('id', id).maybeSingle();
    if (readError) {
      if (isMissingTableError(readError)) {
        if (masterDataStore.isMasterTable(writeTable)) {
          const saved = await masterDataStore.upsertRecord(writeTable, { ...req.body, id });
          recordAuditTrailEntry(req, {
            defaultAction: 'UPDATE',
            entity: req.params.entity,
            entityId: id,
            site: req.body.site || req.body.siteName,
            defaultDetails: `Updated ${req.params.entity} record [${id}]`
          });
          return res.json({ success: true, record: saved });
        }
        return tableMissing(res, writeTable);
      }
      return res.status(500).json({ success: false, error: readError.message });
    }

    if (!existingRow) {
      // Not stored yet: persist the full record now.
      const withTarget = getWriteTarget(def, { ...req.body, id });
      const dbRow = toDatabaseRow(writeTable, withTarget.record, caller.validUuid, allowed);
      const { data, error } = await client.from(writeTable).upsert(dbRow).select().single();
      if (error) return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
      recordAuditTrailEntry(req, {
        defaultAction: 'CREATE',
        entity: req.params.entity,
        entityId: id,
        site: req.body.site || req.body.siteName,
        defaultDetails: `Created ${req.params.entity} record [${id}]`
      });
      return res.json({ success: true, record: fromDatabaseRow(def.table, data || dbRow) });
    }

    const merged = { ...fromDatabaseRow(writeTable, existingRow), ...req.body, id };
    const withTarget = getWriteTarget(def, merged);
    const dbRow = toDatabaseRow(writeTable, withTarget.record, caller.validUuid, allowed);
    delete dbRow.id;
    delete dbRow.created_by; // the creator never changes on update
    delete dbRow.created_at; // creation timestamp never changes on update

    const { data, error } = await client.from(writeTable).update(dbRow).eq('id', id).select().single();
    if (error) {
      console.error(`[DB PUT /api/db/${req.params.entity}/${id}] ${error.message}`);
      return res.status(500).json({ success: false, error: error.message, details: error.details, hint: error.hint });
    }

    if (def.table === 'role_permissions') permissionCache = null;
    recordAuditTrailEntry(req, {
      defaultAction: 'UPDATE',
      entity: req.params.entity,
      entityId: id,
      site: merged.site || merged.siteName,
      defaultDetails: `Updated ${req.params.entity} record [${id}]`
    });

    res.json({ success: true, record: fromDatabaseRow(def.table, data || { id, ...dbRow }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/db/:entity/:id
router.delete('/:entity/:id', async (req: Request, res: Response) => {
  const def = resolveEntity(req, res);
  if (!def) return;
  if (!(await authorize(req, res, def.remove || 'permission', 'delete'))) return;
  const client = requireDatabase(res);
  if (!client) return;

  const { id } = req.params;
  const writeTable = VIEW_WRITE_TARGETS[def.table]?.table || def.table;
  const singleDeleteScopeError = await deleteScopeError(client, req, def, [id]);
  if (singleDeleteScopeError) return res.status(403).json({ success: false, error: singleDeleteScopeError });
  try {
    const liveCols = await getLiveColumns(def.table);
    if (liveCols && liveCols.size === 0) {
      if (masterDataStore.isMasterTable(def.table)) {
        await masterDataStore.deleteRecord(def.table, id);
        recordAuditTrailEntry(req, {
          defaultAction: 'DELETE',
          entity: req.params.entity,
          entityId: id,
          defaultDetails: `Permanently deleted ${req.params.entity} record [${id}]`
        });
        return res.json({ success: true, id, deleted: 1 });
      }
      return tableMissing(res, def.table);
    }
    if (def.table === 'properties') {
      await cascadeDeleteProperty(client, [id]);
    }
    const { data, error } = await client.from(writeTable).delete().eq('id', id).select('id');
    if (error) {
      if (isMissingTableError(error)) {
        if (masterDataStore.isMasterTable(def.table)) {
          await masterDataStore.deleteRecord(def.table, id);
          recordAuditTrailEntry(req, {
            defaultAction: 'DELETE',
            entity: req.params.entity,
            entityId: id,
            defaultDetails: `Permanently deleted ${req.params.entity} record [${id}]`
          });
          return res.json({ success: true, id, deleted: 1 });
        }
        return tableMissing(res, def.table);
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    const deleted = data?.length || 0;
    if (def.table === 'role_permissions') permissionCache = null;
    if (deleted > 0) {
      recordAuditTrailEntry(req, {
        defaultAction: 'DELETE',
        entity: req.params.entity,
        entityId: id,
        defaultDetails: `Permanently deleted ${req.params.entity} record [${id}]`
      });
    }

    res.json({ success: true, id, deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
