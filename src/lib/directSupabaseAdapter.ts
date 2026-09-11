import { getBrowserSupabaseClient } from './supabaseClient';
import { toDatabaseRow, fromDatabaseRow } from '../../server/schemaAdapter.ts';
import type { AuditDescriptor, AuditUserContext, DbEntityName, WriteResult } from '../services/apiService';

const isPropertyLaundry = (r: any) => Boolean(r && (r.periodType || String(r.id || '').startsWith('prop-lau')));
const isVendorBuffet = (r: any) => Boolean(r && (r.dailyCounts || String(r.id || '').startsWith('vendor-bf')));

export interface EntityMapping {
  table: string;
  variant?: (record: any) => boolean;
}

export const ENTITY_TABLE_MAP: Record<string, EntityMapping> = {
  referrals: { table: 'referrals' },
  vulnerable: { table: 'vulnerable_residents' },
  challenging: { table: 'challenging_behavior' },
  maintenance: { table: 'maintenance_records' },
  spcd: { table: 'spcd_records' },
  laundry: { table: 'laundry_logs', variant: (r: any) => !isPropertyLaundry(r) },
  property_laundry_logs: { table: 'laundry_logs', variant: isPropertyLaundry },
  food: { table: 'hot_food_logs', variant: (r: any) => !isVendorBuffet(r) },
  food_vendor_buffet_logs: { table: 'hot_food_logs', variant: isVendorBuffet },
  escalations: { table: 'escalations' },
  documents: { table: 'documents' },
  publicTransport: { table: 'public_transport_records' },
  compliance: { table: 'compliance_records' },
  gpAppointments: { table: 'gp_appointments' },
  rfaWelfare: { table: 'rfa_welfare_checks' },
  dispersal: { table: 'dispersal_records' },
  booklets: { table: 'booklet_collections' },
  vcsAgencies: { table: 'vcs_agencies' },
  requests: { table: 'data_change_requests' },
  sites: { table: 'sites' },
  users: { table: 'profiles' },
  profiles: { table: 'profiles' },
  userGroups: { table: 'user_groups' },
  property_user_assignments: { table: 'property_user_assignments' },
  rolePermissions: { table: 'role_permissions' },
  fieldOptions: { table: 'field_options' },
  appSettings: { table: 'app_settings' },
  tableSchemas: { table: 'table_schemas' },
  audit: { table: 'audit_trails' },
  audit_trails: { table: 'audit_trails' },
  laundry_logs: { table: 'laundry_logs', variant: (r: any) => !isPropertyLaundry(r) },
  hot_food_logs: { table: 'hot_food_logs', variant: (r: any) => !isVendorBuffet(r) },
  passwordAudit: { table: 'password_audit_logs' }
};

function ensureId(entity: string, record: any): any {
  if (!record || typeof record !== 'object') return record;
  if (!record.id) {
    const prefix = entity.slice(0, 4).toLowerCase();
    return { ...record, id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  }
  return record;
}

export async function directBatchFetchEntities(
  requests: Array<{ key: string; entity: DbEntityName; limit?: number; order?: string; eq?: Record<string, string> }>
): Promise<{ success: boolean; results: Record<string, { success: boolean; data: any[]; error?: string; tableMissing?: boolean }> }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return { success: false, results: {} };
  }

  const results: Record<string, { success: boolean; data: any[]; error?: string; tableMissing?: boolean }> = {};

  await Promise.all(
    requests.map(async req => {
      const mapping = ENTITY_TABLE_MAP[req.entity];
      if (!mapping) {
        results[req.key] = { success: false, data: [], error: `Unknown entity: ${req.entity}` };
        return;
      }

      try {
        let query = supabase.from(mapping.table).select('*');

        if (req.eq) {
          for (const [col, val] of Object.entries(req.eq)) {
            query = query.eq(col, val);
          }
        }

        if (req.order) {
          const [col, dir] = req.order.split('.');
          query = query.order(col, { ascending: dir !== 'desc' });
        }

        const limit = req.limit && req.limit > 0 ? req.limit : 1000;
        query = query.limit(limit);

        const { data, error } = await query;

        if (error) {
          results[req.key] = {
            success: false,
            data: [],
            error: error.message,
            tableMissing: error.code === '42P01' || error.code === 'PGRST205'
          };
          return;
        }

        let rows = Array.isArray(data) ? data : [];
        if (mapping.variant) {
          rows = rows.filter(mapping.variant);
        }

        const mappedData = rows.map(r => fromDatabaseRow(mapping.table, r));
        results[req.key] = { success: true, data: mappedData };
      } catch (err: any) {
        results[req.key] = { success: false, data: [], error: err?.message || String(err) };
      }
    })
  );

  return { success: true, results };
}

export async function directFetchEntityRecords<T = any>(
  entity: DbEntityName,
  options: { limit?: number; order?: string; eq?: Record<string, string> } = {}
): Promise<{ success: boolean; data: T[]; error?: string; status?: number; tableMissing?: boolean }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return { success: false, data: [], error: 'Supabase client not initialized' };
  }

  const mapping = ENTITY_TABLE_MAP[entity];
  if (!mapping) {
    return { success: false, data: [], error: `Unknown entity: ${entity}` };
  }

  try {
    let query = supabase.from(mapping.table).select('*');

    if (options.eq) {
      for (const [col, val] of Object.entries(options.eq)) {
        query = query.eq(col, val);
      }
    }

    if (options.order) {
      const [col, dir] = options.order.split('.');
      query = query.order(col, { ascending: dir !== 'desc' });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error, status } = await query;

    if (error) {
      return {
        success: false,
        data: [],
        error: error.message,
        status,
        tableMissing: error.code === '42P01' || error.code === 'PGRST205'
      };
    }

    let rows = Array.isArray(data) ? data : [];
    if (mapping.variant) {
      rows = rows.filter(mapping.variant);
    }

    const mapped = rows.map(r => fromDatabaseRow(mapping.table, r) as T);
    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, data: [], error: err?.message || String(err) };
  }
}

export async function directSaveEntityRecord<T = any>(
  entity: DbEntityName,
  record: T,
  audit?: AuditDescriptor,
  activeUser?: AuditUserContext | null
): Promise<WriteResult<T>> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client not initialized' };

  const mapping = ENTITY_TABLE_MAP[entity];
  if (!mapping) return { success: false, error: `Unknown entity: ${entity}` };

  try {
    const recordWithId = ensureId(entity, record);
    const dbRow = toDatabaseRow(mapping.table, recordWithId, activeUser?.userId);

    const { data, error, status } = await supabase
      .from(mapping.table)
      .upsert(dbRow, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message, status, tableMissing: error.code === '42P01' || error.code === 'PGRST205' };
    }

    const saved = fromDatabaseRow(mapping.table, data) as T;

    // Direct audit recording
    await recordDirectAudit('CREATE', entity, recordWithId, audit, activeUser);

    return { success: true, record: saved };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function directUpdateEntityRecord<T = any>(
  entity: DbEntityName,
  id: string,
  record: Partial<T>,
  audit?: AuditDescriptor,
  activeUser?: AuditUserContext | null
): Promise<WriteResult<T>> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client not initialized' };

  const mapping = ENTITY_TABLE_MAP[entity];
  if (!mapping) return { success: false, error: `Unknown entity: ${entity}` };

  try {
    // Read existing record to safely merge
    const { data: existing } = await supabase.from(mapping.table).select('*').eq('id', id).maybeSingle();
    const existingMapped = existing ? fromDatabaseRow(mapping.table, existing) : {};
    const merged = { ...existingMapped, ...record, id };

    const dbRow = toDatabaseRow(mapping.table, merged, activeUser?.userId);

    const { data, error, status } = await supabase
      .from(mapping.table)
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message, status };
    }

    const updated = fromDatabaseRow(mapping.table, data) as T;
    await recordDirectAudit('UPDATE', entity, { id, ...record }, audit, activeUser);

    return { success: true, record: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function directDeleteEntityRecord(
  entity: DbEntityName,
  id: string,
  audit?: AuditDescriptor,
  activeUser?: AuditUserContext | null
): Promise<WriteResult> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client not initialized' };

  const mapping = ENTITY_TABLE_MAP[entity];
  if (!mapping) return { success: false, error: `Unknown entity: ${entity}` };

  try {
    const { error, status } = await supabase.from(mapping.table).delete().eq('id', id);
    if (error) return { success: false, error: error.message, status };

    await recordDirectAudit('DELETE', entity, { id }, audit, activeUser);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function directBulkSaveEntityRecords<T = any>(
  entity: DbEntityName,
  records: T[],
  audit?: AuditDescriptor,
  activeUser?: AuditUserContext | null
): Promise<{ success: boolean; count?: number; error?: string; status?: number; tableMissing?: boolean }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client not initialized' };

  const mapping = ENTITY_TABLE_MAP[entity];
  if (!mapping) return { success: false, error: `Unknown entity: ${entity}` };

  try {
    const rows = records.map(r => {
      const withId = ensureId(entity, r);
      return toDatabaseRow(mapping.table, withId, activeUser?.userId);
    });

    const { data, error, status } = await supabase
      .from(mapping.table)
      .upsert(rows, { onConflict: 'id' })
      .select('id');

    if (error) {
      return { success: false, error: error.message, status, tableMissing: error.code === '42P01' || error.code === 'PGRST205' };
    }

    await recordDirectAudit('UPDATE', entity, { count: rows.length }, audit, activeUser);
    return { success: true, count: Array.isArray(data) ? data.length : rows.length };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function directBulkDeleteEntityRecords(
  entity: DbEntityName,
  ids: string[],
  audit?: AuditDescriptor,
  activeUser?: AuditUserContext | null
): Promise<{ success: boolean; deleted?: number; error?: string; status?: number }> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client not initialized' };

  const mapping = ENTITY_TABLE_MAP[entity];
  if (!mapping) return { success: false, error: `Unknown entity: ${entity}` };

  try {
    const { error, status } = await supabase.from(mapping.table).delete().in('id', ids);
    if (error) return { success: false, error: error.message, status };

    await recordDirectAudit('DELETE', entity, { count: ids.length, ids }, audit, activeUser);
    return { success: true, deleted: ids.length };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function directGetDbStatus(): Promise<{
  connected: boolean;
  live: boolean;
  mode: 'supabase-cloud' | 'offline';
  message?: string;
  url?: string;
  totalPages?: number;
  connectedPages?: number;
  error?: string;
}> {
  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    return { connected: false, live: false, mode: 'offline', error: 'Supabase client is not initialized' };
  }

  try {
    const { count, error } = await supabase.from('sites').select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return {
          connected: true,
          live: true,
          mode: 'supabase-cloud',
          message: 'Connected to Supabase Cloud, but tables need to be created. Please run db/schema.sql and db/enable-direct-supabase-rls.sql in the Supabase SQL Editor.'
        };
      }
      return { connected: false, live: false, mode: 'offline', error: error.message };
    }

    return {
      connected: true,
      live: true,
      mode: 'supabase-cloud',
      message: `Connected directly to Supabase Cloud (${count ?? 0} sites verified).`
    };
  } catch (err: any) {
    return { connected: false, live: false, mode: 'offline', error: err?.message || String(err) };
  }
}

async function recordDirectAudit(
  defaultAction: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  record: any,
  audit?: AuditDescriptor,
  activeUser?: AuditUserContext | null
): Promise<void> {
  if (entity === 'audit' || entity === 'audit_trails') return;
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return;

  try {
    const action = audit?.action || defaultAction;
    const details = audit?.details || `${action} ${entity} ${record?.id ? `[${record.id}]` : ''}`.trim();
    const auditRow = toDatabaseRow('audit_trails', {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      user: activeUser?.userName || activeUser?.userEmail || 'Staff',
      userId: activeUser?.userId || null,
      role: activeUser?.role || 'Staff',
      action,
      details,
      site: audit?.site || activeUser?.site || 'All Sites',
      module: audit?.module || entity,
      entityType: entity,
      entityId: record?.id ? String(record.id) : undefined,
      targetItem: audit?.targetItem || (record?.id ? String(record.id) : undefined)
    });

    await supabase.from('audit_trails').insert(auditRow);
  } catch {
    // Non-blocking audit failure
  }
}
