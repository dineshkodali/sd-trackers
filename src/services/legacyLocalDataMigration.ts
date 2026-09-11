import { apiService, AuditDescriptor } from './apiService';
import { LEGACY_SCHEMA_STORAGE_PREFIX } from './tableSchemaService';
import {
  INITIAL_SITES,
  INITIAL_USER_GROUPS,
  INITIAL_PUBLIC_TRANSPORT_RECORDS,
  INITIAL_COMPLIANCE_RECORDS,
  INITIAL_GP_APPOINTMENT_RECORDS,
  INITIAL_RFA_WELFARE_RECORDS,
  INITIAL_DISPERSAL_RECORDS,
  INITIAL_BOOKLET_RECORDS,
  INITIAL_VCS_AGENCIES,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_SETTINGS
} from '../data/initialData';
import { DEFAULT_FIELD_OPTIONS } from '../data/defaultFieldOptions';

/**
 * One-time move of browser-held data into the live database.
 *
 * Before live mode, eleven modules existed only in each browser's
 * localStorage, and the database-backed modules fell back to it whenever the
 * API refused a request - which it did for every call made with the
 * browser-minted administrator token. Records created in that state were
 * never stored anywhere else. This uploads them once, then removes the
 * browser copy, so no entered data is lost and no safeguarding data lingers in
 * browser storage.
 *
 * Guards against resurrecting data:
 *   - bundled demo/default records are never uploaded unless they were edited;
 *   - records the audit trail shows were deleted from the database are skipped;
 *   - edits to a master record are applied only while the database still holds
 *     that record at its bundled default (nobody has changed it since).
 * A key is removed only after its upload succeeded, so failures retry next load.
 */

const PREFIX = 'sg_tracker_';

interface ModuleSpec {
  key: string;
  entity: string;
  seeds?: any[];
  adminOnly?: boolean;
  /** Table existed before live mode, so a record missing from it may have been deleted there. */
  checkDeletions?: boolean;
}

const MODULES: ModuleSpec[] = [
  { key: 'referrals', entity: 'referrals', checkDeletions: true },
  { key: 'vulnerable', entity: 'vulnerable', checkDeletions: true },
  { key: 'challenging', entity: 'challenging', checkDeletions: true },
  { key: 'laundry', entity: 'laundry', checkDeletions: true },
  { key: 'property_laundry_logs', entity: 'property_laundry_logs', checkDeletions: true },
  { key: 'food', entity: 'food', checkDeletions: true },
  { key: 'food_vendor_buffet_logs', entity: 'food_vendor_buffet_logs', checkDeletions: true },
  { key: 'escalations', entity: 'escalations', checkDeletions: true },
  { key: 'documents', entity: 'documents', checkDeletions: true },
  { key: 'maintenance', entity: 'maintenance', checkDeletions: true },
  { key: 'spcd', entity: 'spcd', checkDeletions: true },
  { key: 'sites', entity: 'sites', seeds: INITIAL_SITES, adminOnly: true, checkDeletions: true },
  { key: 'user_groups', entity: 'userGroups', seeds: INITIAL_USER_GROUPS, adminOnly: true, checkDeletions: true },
  { key: 'public_transport_records', entity: 'publicTransport', seeds: INITIAL_PUBLIC_TRANSPORT_RECORDS },
  { key: 'compliance_records', entity: 'compliance', seeds: INITIAL_COMPLIANCE_RECORDS },
  { key: 'gp_appointment_records', entity: 'gpAppointments', seeds: INITIAL_GP_APPOINTMENT_RECORDS },
  { key: 'rfa_welfare_records', entity: 'rfaWelfare', seeds: INITIAL_RFA_WELFARE_RECORDS },
  { key: 'dispersal_records', entity: 'dispersal', seeds: INITIAL_DISPERSAL_RECORDS },
  { key: 'booklet_records', entity: 'booklets', seeds: INITIAL_BOOKLET_RECORDS },
  { key: 'vcs_agencies', entity: 'vcsAgencies', seeds: INITIAL_VCS_AGENCIES },
  { key: 'data_change_requests', entity: 'requests' },
  { key: 'field_options', entity: 'fieldOptions', seeds: DEFAULT_FIELD_OPTIONS, adminOnly: true },
];

/** Superseded by server-held data; removed without upload. */
const DISCARD_KEYS = ['audit', 'users', 'notifications', 'notification_rules', 'email_notification_logs', 'data_version'];

/** Fields that change without the record's meaning changing. */
const VOLATILE_KEYS = new Set(['createdAt', 'updatedAt', 'lastUpdated', 'lastSharePointSync', 'createdBy']);

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key) || value[key] === undefined) continue;
      out[key] = canonical(value[key]);
    }
    return out;
  }
  return value;
}

const fingerprint = (value: any) => JSON.stringify(canonical(value));

/** True only when both timestamps parse and `a` is later than `b`. */
function isNewer(a: any, b: any): boolean {
  const ta = Date.parse(String(a || ''));
  const tb = Date.parse(String(b || ''));
  return Number.isFinite(ta) && Number.isFinite(tb) && ta > tb;
}

function readLocal(key: string): any {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function removeLocal(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

export interface LegacyMigrationReport {
  uploaded: string[];
  failed: string[];
  deferred: string[];
}

export interface LegacyMigrationContext {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** Records currently in the database, by entity, from the sync that just completed. */
  snapshot: Record<string, any[] | undefined>;
}

const AUDIT: AuditDescriptor = {
  action: 'DATA_RESTORE',
  module: 'Settings',
  targetItem: 'Browser-held records',
  details: 'Moved records previously held only in this browser into the live database.'
};

export function hasLegacyLocalData(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith(LEGACY_SCHEMA_STORAGE_PREFIX)) return true;
      if (!key.startsWith(PREFIX)) continue;
      const suffix = key.slice(PREFIX.length);
      if (MODULES.some(m => m.key === suffix) || DISCARD_KEYS.includes(suffix) || suffix === 'role_permissions' || suffix === 'settings') {
        return true;
      }
    }
  } catch {}
  return false;
}

export async function migrateLegacyLocalData(ctx: LegacyMigrationContext): Promise<LegacyMigrationReport> {
  const report: LegacyMigrationReport = { uploaded: [], failed: [], deferred: [] };
  if (!hasLegacyLocalData()) return report;

  // Ids deleted from the database, so a stale browser copy cannot bring them back.
  let deletedKeys: Set<string> | null = null;
  const loadDeletedKeys = async (): Promise<Set<string> | null> => {
    if (deletedKeys) return deletedKeys;
    const res = await apiService.fetchEntityRecords<any>('audit_trails', { eq: { action: 'DELETE' } });
    if (!res.success) return null;
    deletedKeys = new Set(res.data.map(a => `${a.entityType}:${a.entityId}`));
    return deletedKeys;
  };

  for (const spec of MODULES) {
    const local = readLocal(spec.key);
    if (local === undefined) continue;
    if (!Array.isArray(local) || local.length === 0) {
      removeLocal(spec.key);
      continue;
    }
    if (spec.adminOnly && !ctx.isAdmin) {
      report.deferred.push(spec.key);
      continue;
    }
    const dbRecords = ctx.snapshot[spec.entity];
    if (!dbRecords) {
      report.deferred.push(spec.key); // table unavailable this time; retry on a later load
      continue;
    }

    const deleted = spec.checkDeletions ? await loadDeletedKeys() : new Set<string>();
    if (!deleted) {
      report.deferred.push(spec.key);
      continue;
    }

    const dbById = new Map(dbRecords.map(r => [String(r.id), r]));
    const seedPrints = new Map((spec.seeds || []).map(s => [String(s.id), fingerprint(s)]));
    const toUpload: any[] = [];

    for (const rec of local) {
      if (!rec || typeof rec !== 'object' || !rec.id) continue;
      const id = String(rec.id);
      const print = fingerprint(rec);
      const seedPrint = seedPrints.get(id);
      const unmodifiedSeed = seedPrint !== undefined && seedPrint === print;
      const inDb = dbById.get(id);

      if (!inDb) {
        if (unmodifiedSeed) continue;
        if (deleted.has(`${spec.entity}:${id}`)) continue;
        toUpload.push(rec);
      } else if (seedPrint !== undefined && !unmodifiedSeed && fingerprint(inDb) === seedPrint) {
        toUpload.push(rec);
      } else if (isNewer(rec.updatedAt, inDb.updatedAt) && print !== fingerprint(inDb)) {
        // Edited in this browser after the database copy was last written -
        // typically while saves were being refused - so the edit is the latest.
        toUpload.push(rec);
      }
    }

    if (toUpload.length > 0) {
      const res = await apiService.bulkSaveEntityRecords(spec.entity, toUpload, AUDIT);
      if (!res.success) {
        report.failed.push(`${spec.key}: ${res.error}`);
        continue;
      }
      report.uploaded.push(`${spec.key} (${toUpload.length})`);
    }
    removeLocal(spec.key);
  }

  // RBAC matrix - only roles changed locally whose database row is still the default.
  const localPerms = readLocal('role_permissions');
  if (localPerms !== undefined) {
    if (!ctx.isAdmin) {
      report.deferred.push('role_permissions');
    } else if (ctx.snapshot.rolePermissions) {
      const dbById = new Map(ctx.snapshot.rolePermissions.map(r => [String(r.id), r]));
      const changed = Object.entries<any>(localPerms && typeof localPerms === 'object' ? localPerms : {})
        .filter(([role, perms]) => {
          const defaults = (INITIAL_ROLE_PERMISSIONS as Record<string, any>)[role];
          if (!defaults || !perms) return false;
          const localDiffers = fingerprint(perms) !== fingerprint(defaults);
          const db = dbById.get(role);
          const dbIsDefault = !db || fingerprint({ ...db, id: undefined, role: undefined }) === fingerprint(defaults);
          return localDiffers && dbIsDefault;
        })
        .map(([role, perms]) => ({ id: role, role, ...perms }));
      const res = changed.length ? await apiService.bulkSaveEntityRecords('rolePermissions', changed, AUDIT) : { success: true };
      if (res.success) {
        if (changed.length) report.uploaded.push(`role_permissions (${changed.length})`);
        removeLocal('role_permissions');
      } else {
        report.failed.push(`role_permissions: ${(res as any).error}`);
      }
    } else {
      report.deferred.push('role_permissions');
    }
  }

  // System preferences - only if changed locally and still at defaults in the database.
  const localSettings = readLocal('settings');
  if (localSettings !== undefined) {
    if (!ctx.isAdmin) {
      report.deferred.push('settings');
    } else if (ctx.snapshot.appSettings) {
      const dbGlobal = ctx.snapshot.appSettings.find(r => r.id === 'global')?.value;
      const localDiffers = localSettings && fingerprint({ ...INITIAL_SETTINGS, ...localSettings }) !== fingerprint(INITIAL_SETTINGS);
      const dbIsDefault = !dbGlobal || fingerprint({ ...INITIAL_SETTINGS, ...dbGlobal }) === fingerprint(INITIAL_SETTINGS);
      let ok = true;
      if (localDiffers && dbIsDefault) {
        const res = await apiService.saveEntityRecord('appSettings', { id: 'global', value: { ...INITIAL_SETTINGS, ...localSettings } }, AUDIT);
        ok = res.success;
        if (ok) report.uploaded.push('settings'); else report.failed.push(`settings: ${res.error}`);
      }
      if (ok) removeLocal('settings');
    } else {
      report.deferred.push('settings');
    }
  }

  // Custom table layouts (Super Admin feature).
  try {
    const schemaKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith(LEGACY_SCHEMA_STORAGE_PREFIX)) schemaKeys.push(key);
    }
    if (schemaKeys.length > 0) {
      if (!ctx.isSuperAdmin || !ctx.snapshot.tableSchemas) {
        report.deferred.push('table layouts');
      } else {
        const existing = new Set(ctx.snapshot.tableSchemas.map(s => String(s.id)));
        for (const key of schemaKeys) {
          const moduleKey = key.slice(LEGACY_SCHEMA_STORAGE_PREFIX.length);
          let columns: any = null;
          try { columns = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
          if (Array.isArray(columns) && columns.length > 0 && !existing.has(moduleKey)) {
            const res = await apiService.saveEntityRecord('tableSchemas', { id: moduleKey, moduleKey, columns }, AUDIT);
            if (!res.success) {
              report.failed.push(`table layout ${moduleKey}: ${res.error}`);
              continue;
            }
            report.uploaded.push(`table layout ${moduleKey}`);
          }
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}

  for (const key of DISCARD_KEYS) removeLocal(key);
  return report;
}

/**
 * Completely purges all legacy operational, draft, layout, and cached records
 * from browser localStorage, preserving only session authentication credentials.
 */
export function purgeAllLegacyLocalStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      // Retain active auth tokens and API config
      if (
        key === 'sg_tracker_token' ||
        key === 'sg_tracker_auth_user' ||
        key === 'token' ||
        key === 'sd_api_url'
      ) {
        continue;
      }
      if (
        key.startsWith(PREFIX) ||
        key.startsWith('sg_smart_cache_') ||
        key.startsWith('sg_cache_') ||
        key.startsWith(LEGACY_SCHEMA_STORAGE_PREFIX) ||
        key.startsWith('recent_searches_')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}
}
