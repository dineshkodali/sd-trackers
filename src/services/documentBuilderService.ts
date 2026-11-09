/**
 * Document Builder API Client
 *
 * Wraps all fetch calls to /api/document-builder/* endpoints.
 * Follows existing apiService.ts patterns for auth header injection.
 */

import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import type {
  DocumentTemplate,
  TemplateVersion,
  DocumentBuilderRecord,
  TemplateWithVersion,
  DocumentBuilderApiResponse,
} from '../types/documentBuilder';

import { authHeaders, getApiUrl, isDirectSupabaseActive } from './apiService';
import { generateClientDocx } from './clientDocxGenerator';
import { CLIENT_SEED_TEMPLATES } from '../data/seedTemplates';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...authHeaders() };

  if (headers['Authorization']) return headers;

  // Try Supabase session token
  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
      return headers;
    }
  }

  // Check localStorage and sessionStorage keys
  const token =
    localStorage.getItem('sg_tracker_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('auth_token') ||
    sessionStorage.getItem('sd_admin_session');

  if (token) {
    try {
      const parsed = token.startsWith('{') || token.startsWith('"') ? JSON.parse(token) : token;
      const actualToken = typeof parsed === 'object' ? (parsed.token || parsed.access_token) : parsed;
      if (actualToken) {
        headers['Authorization'] = `Bearer ${actualToken}`;
      }
    } catch {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (typeof window !== 'undefined') {
    const role = localStorage.getItem('role');
    const site = localStorage.getItem('assignedSite');
    const userStr = localStorage.getItem('user');
    let userName = localStorage.getItem('currentUserName') || '';
    let userEmail = '';
    let userId = '';

    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.name && !userName) userName = u.name;
        if (u.email) userEmail = u.email;
        if (u.id) userId = u.id;
      } catch {}
    }

    if (role) headers['x-user-role'] = role.replace(/['"]+/g, '');
    if (site) headers['x-user-site'] = site.replace(/['"]+/g, '');
    if (userName) headers['x-user-name'] = userName;
    if (userEmail) headers['x-user-email'] = userEmail;
    if (userId) headers['x-user-id'] = userId;
  }

  return headers;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<DocumentBuilderApiResponse<T>> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/document-builder${path}`), {
      ...options,
      headers: { ...authHeaders, ...(options.headers || {}) },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    // For blob responses (file downloads), handle separately
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await res.json();
      return { success: true, data: body.data ?? body };
    }

    return { success: true, data: (await res.json()) as T };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function fetchTemplates(): Promise<DocumentBuilderApiResponse<TemplateWithVersion[]>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<TemplateWithVersion[]>('/templates');
      if (res.success && res.data && res.data.length > 0) {
        const filtered = res.data.filter(t => t.id === 'tmpl-incident-report' || t.name.toLowerCase().includes('incident'));
        if (filtered.length > 0) return { success: true, data: filtered };
      }
    } catch {
      // Fall through to direct Supabase
    }
  }

  // Direct Supabase mode (AWS Amplify / static hosting)
  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ho_report_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error && data && data.length > 0) {
        const mapped: TemplateWithVersion[] = data.map((r: any) => {
          if (r.data && r.data.name) return r.data as TemplateWithVersion;
          return {
            id: r.id,
            name: r.name,
            description: r.description || '',
            category: r.category || 'Operations',
            isActive: r.is_active ?? true,
            createdBy: r.created_by || 'system',
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            currentVersion: {
              id: `tver-${r.id}`,
              templateId: r.id,
              version: r.current_version || 1,
              isCurrent: true,
              fieldDefinitions: r.field_definitions || [],
              layoutConfig: r.layout_config || {},
              headerConfig: r.header_config || {},
              footerConfig: r.footer_config || {},
              createdBy: r.created_by || 'system',
              createdAt: r.created_at,
            },
          };
        });

        const filtered = mapped.filter(t => t.id === 'tmpl-incident-report' || t.name.toLowerCase().includes('incident'));
        if (filtered.length > 0) {
          return { success: true, data: filtered };
        }
      }
    } catch (err) {
      console.warn('[DocumentBuilder] Direct Supabase templates error, using client seed fallback:', err);
    }
  }

  // Resilient fallback: return client seed templates so UI is never empty
  return { success: true, data: CLIENT_SEED_TEMPLATES };
}

export async function fetchTemplateFields(
  templateId: string
): Promise<DocumentBuilderApiResponse<TemplateVersion>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<TemplateVersion>(`/templates/${templateId}/fields`);
      if (res.success && res.data) return res;
    } catch {}
  }

  // Check client seed templates first
  const seed = CLIENT_SEED_TEMPLATES.find(t => t.id === templateId);
  if (seed?.currentVersion) {
    return { success: true, data: seed.currentVersion };
  }

  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('ho_report_templates')
        .select('*')
        .eq('id', templateId)
        .maybeSingle();

      if (!error && data) {
        const v: TemplateVersion = {
          id: `tver-${data.id}`,
          templateId: data.id,
          version: data.current_version || 1,
          isCurrent: true,
          fieldDefinitions: data.field_definitions || [],
          layoutConfig: data.layout_config || {},
          headerConfig: data.header_config || {},
          footerConfig: data.footer_config || {},
          createdBy: data.created_by || 'system',
          createdAt: data.created_at,
        };
        return { success: true, data: v };
      }
    } catch {}
  }

  return { success: false, error: 'Template not found' };
}

export async function createTemplate(
  template: Partial<DocumentTemplate>,
  version: Partial<TemplateVersion>
): Promise<DocumentBuilderApiResponse<DocumentTemplate>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<DocumentTemplate>('/templates', {
        method: 'POST',
        body: JSON.stringify({ template, version }),
      });
      if (res.success && res.data) return res;
    } catch {}
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Database unavailable' };

  const id = template.id || `tmpl-custom-${Date.now()}`;
  const now = new Date().toISOString();
  const row = {
    id,
    name: template.name || 'Custom Report Template',
    description: template.description || '',
    category: template.category || 'Operations',
    is_active: template.isActive ?? true,
    current_version: version.version || 1,
    field_definitions: version.fieldDefinitions || [],
    layout_config: version.layoutConfig || {},
    header_config: version.headerConfig || {},
    footer_config: version.footerConfig || {},
    created_by: template.createdBy || 'system',
    data: { ...template, id, currentVersion: { ...version, templateId: id } },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('ho_report_templates').upsert(row).select().single();
  if (error) return { success: false, error: error.message };
  return {
    success: true,
    data: {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function updateTemplate(
  id: string,
  template: Partial<DocumentTemplate>,
  version?: Partial<TemplateVersion>
): Promise<DocumentBuilderApiResponse<DocumentTemplate>> {
  return createTemplate({ ...template, id }, version || {});
}

export async function deleteTemplate(
  id: string
): Promise<DocumentBuilderApiResponse<{ success: boolean }>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<{ success: boolean }>(`/templates/${id}`, {
        method: 'DELETE',
      });
      if (res.success) return res;
    } catch {}
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: false, error: 'Database unavailable' };

  const { error } = await supabase.from('ho_report_templates').update({ is_active: false }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: { success: true } };
}

export async function importDocumentTemplate(
  payload: any
): Promise<DocumentBuilderApiResponse<TemplateWithVersion>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<TemplateWithVersion>('/templates/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success && res.data) return res;
    } catch {}
  }

  // Direct Supabase import
  const tmpl = payload.template || payload;
  const ver = payload.version || tmpl.currentVersion || {};
  const saveRes = await createTemplate(tmpl, ver);
  if (!saveRes.success || !saveRes.data) return { success: false, error: saveRes.error };

  return {
    success: true,
    data: {
      ...saveRes.data,
      currentVersion: {
        id: `tver-${saveRes.data.id}`,
        templateId: saveRes.data.id,
        version: ver.version || 1,
        isCurrent: true,
        fieldDefinitions: ver.fieldDefinitions || [],
        layoutConfig: ver.layoutConfig || {},
        headerConfig: ver.headerConfig || {},
        footerConfig: ver.footerConfig || {},
        createdBy: saveRes.data.createdBy,
        createdAt: saveRes.data.createdAt,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Document Records
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_RECORDS_KEY = 'sd_ho_report_records';

function readCachedLocalRecords(): DocumentBuilderRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedLocalRecord(rec: DocumentBuilderRecord): void {
  if (typeof window === 'undefined') return [];
  try {
    const list = readCachedLocalRecords();
    const idx = list.findIndex(r => r.id === rec.id);
    if (idx >= 0) list[idx] = rec;
    else list.unshift(rec);
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(list));
  } catch {}
}

function deleteCachedLocalRecord(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = readCachedLocalRecords().filter(r => r.id !== id);
    localStorage.setItem(LOCAL_STORAGE_RECORDS_KEY, JSON.stringify(list));
  } catch {}
}

export async function fetchDocumentRecords(): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord[]>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<DocumentBuilderRecord[]>('/records');
      if (res.success && res.data) return res;
    } catch {}
  }

  const localRecords = readCachedLocalRecords();
  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: true, data: localRecords };

  try {
    const { data, error } = await supabase
      .from('ho_report_records')
      .select('*')
      .order('updated_at', { ascending: false });

    const cleanRecords: DocumentBuilderRecord[] = (!error && data ? data : [])
      .filter((r: any) => !r.id?.includes('rasul') && !r.id?.includes('741001'))
      .map((r: any) => {
        if (r.data && r.data.title) return r.data as DocumentBuilderRecord;
        return {
          id: r.id,
          templateId: r.template_id || '',
          templateVersionId: r.template_version_id || undefined,
          site: r.site || 'All Sites',
          title: r.title || 'Untitled Report',
          documentNumber: r.document_number || '',
          status: (r.status as DocumentStatus) || 'draft',
          fieldValues: r.field_values || {},
          fieldDefinitions: r.field_definitions || [],
          layoutConfig: r.layout_config || {},
          headerConfig: r.header_config || {},
          footerConfig: r.footer_config || {},
          createdBy: r.created_by || '',
          createdByName: r.created_by_name || 'Staff',
          createdByRole: r.created_by_role || 'Staff',
          createdByEmail: r.created_by_email || '',
          updatedBy: r.updated_by || '',
          updatedByName: r.updated_by_name,
          updatedByRole: r.updated_by_role,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          finalizedAt: r.finalized_at,
          finalizedBy: r.finalized_by,
        };
      });

    // Merge Supabase records with local device cache (de-duped by ID)
    const recordMap = new Map<string, DocumentBuilderRecord>();
    for (const r of cleanRecords) recordMap.set(r.id, r);
    for (const r of localRecords) {
      if (!recordMap.has(r.id)) recordMap.set(r.id, r);
    }

    return { success: true, data: Array.from(recordMap.values()) };
  } catch (err) {
    return { success: true, data: localRecords };
  }
}

export async function fetchDocumentRecord(id: string): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<DocumentBuilderRecord>(`/records/${id}`);
      if (res.success && res.data) return res;
    } catch {}
  }

  const local = readCachedLocalRecords().find(r => r.id === id);

  const supabase = getBrowserSupabaseClient();
  if (!supabase) {
    if (local) return { success: true, data: local };
    return { success: false, error: 'Database unavailable' };
  }

  try {
    const { data, error } = await supabase
      .from('ho_report_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (local) return { success: true, data: local };
      return { success: false, error: error?.message || 'Record not found' };
    }

    if (data.data && data.data.title) return { success: true, data: data.data };
    return {
      success: true,
      data: {
        id: data.id,
        templateId: data.template_id || '',
        site: data.site || 'All Sites',
        title: data.title || 'Untitled Report',
        documentNumber: data.document_number || '',
        status: data.status || 'draft',
        fieldValues: data.field_values || {},
        fieldDefinitions: data.field_definitions || [],
        layoutConfig: data.layout_config || {},
        headerConfig: data.header_config || {},
        footerConfig: data.footer_config || {},
        createdBy: data.created_by || '',
        createdByName: data.created_by_name || 'Staff',
        createdByRole: data.created_by_role,
        createdByEmail: data.created_by_email,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        finalizedAt: data.finalized_at,
        finalizedBy: data.finalized_by,
      },
    };
  } catch (err) {
    if (local) return { success: true, data: local };
    return { success: false, error: 'Failed to load record' };
  }
}

export async function saveDocumentDraft(
  record: Partial<DocumentBuilderRecord>
): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<DocumentBuilderRecord>('/records', {
        method: 'POST',
        body: JSON.stringify(record),
      });
      if (res.success && res.data) return res;
    } catch {}
  }

  const now = new Date().toISOString();
  const id = record.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const docNumber = record.documentNumber || `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  const fullRecord: DocumentBuilderRecord = {
    id,
    templateId: record.templateId || 'tmpl-incident-report',
    templateVersionId: record.templateVersionId,
    site: record.site || 'All Sites',
    title: record.title || 'Untitled Report',
    documentNumber: docNumber,
    status: (record.status as DocumentStatus) || 'draft',
    fieldValues: record.fieldValues || {},
    fieldDefinitions: record.fieldDefinitions,
    layoutConfig: record.layoutConfig,
    headerConfig: record.headerConfig,
    footerConfig: record.footerConfig,
    createdBy: record.createdBy || 'system',
    createdByName: record.createdByName || 'Staff',
    createdByRole: record.createdByRole || 'Staff',
    createdByEmail: record.createdByEmail,
    updatedBy: record.updatedBy,
    updatedByName: record.updatedByName,
    updatedByRole: record.updatedByRole,
    createdAt: record.createdAt || now,
    updatedAt: now,
    finalizedAt: record.finalizedAt,
    finalizedBy: record.finalizedBy,
  };

  // Always persist to local cache first so work is never lost
  saveCachedLocalRecord(fullRecord);

  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    const row = {
      id: fullRecord.id,
      template_id: fullRecord.templateId,
      site: fullRecord.site,
      title: fullRecord.title,
      document_number: fullRecord.documentNumber,
      status: fullRecord.status,
      field_values: fullRecord.fieldValues,
      field_definitions: fullRecord.fieldDefinitions || [],
      layout_config: fullRecord.layoutConfig || {},
      header_config: fullRecord.headerConfig || {},
      footer_config: fullRecord.footerConfig || {},
      created_by: fullRecord.createdBy,
      created_by_name: fullRecord.createdByName,
      created_by_role: fullRecord.createdByRole,
      created_by_email: fullRecord.createdByEmail,
      updated_by: fullRecord.updatedBy,
      updated_by_name: fullRecord.updatedByName,
      updated_by_role: fullRecord.updatedByRole,
      finalized_at: fullRecord.finalizedAt,
      finalized_by: fullRecord.finalizedBy,
      data: fullRecord,
      created_at: fullRecord.createdAt,
      updated_at: fullRecord.updatedAt,
    };

    try {
      const { error } = await supabase.from('ho_report_records').upsert(row);
      if (error) {
        // If upsert failed due to RLS, try insert or warn
        if (error.code === '42501' || String(error.message).includes('row-level security')) {
          console.warn('[DocumentBuilder] ho_report_records RLS policy requires db/migrations/032_ho_reports_direct_rls.sql. Document saved to local cache.');
          const { error: insErr } = await supabase.from('ho_report_records').insert(row);
          if (insErr) {
            console.warn('[DocumentBuilder] Direct insert also blocked by RLS. Preserved locally in browser cache.');
          }
        } else {
          console.warn('[DocumentBuilder] Cloud save warning:', error.message);
        }
      }
    } catch (e: any) {
      console.warn('[DocumentBuilder] Supabase write exception:', e?.message || e);
    }
  }

  return { success: true, data: fullRecord };
}

export async function updateDocumentDraft(
  id: string,
  record: Partial<DocumentBuilderRecord>
): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord>> {
  return saveDocumentDraft({ ...record, id });
}

export async function deleteDocumentRecord(
  id: string
): Promise<DocumentBuilderApiResponse<{ success: boolean }>> {
  deleteCachedLocalRecord(id);

  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<{ success: boolean }>(`/records/${id}`, {
        method: 'DELETE',
      });
      if (res.success) return res;
    } catch {}
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: true, data: { success: true } };

  try {
    const { error } = await supabase.from('ho_report_records').delete().eq('id', id);
    if (error && error.code !== '42501' && !error.message.includes('row-level security')) {
      return { success: false, error: error.message };
    }
  } catch {}

  return { success: true, data: { success: true } };
}

export async function fetchDocumentAuditTrail(
  recordId: string
): Promise<DocumentBuilderApiResponse<any[]>> {
  if (!isDirectSupabaseActive()) {
    try {
      const res = await apiFetch<any[]>(`/records/${recordId}/audit`);
      if (res.success && res.data) return res;
    } catch {}
  }

  const supabase = getBrowserSupabaseClient();
  if (!supabase) return { success: true, data: [] };

  const { data, error } = await supabase
    .from('ho_report_audit_logs')
    .select('*')
    .eq('document_id', recordId)
    .order('created_at', { ascending: false });

  if (error || !data) return { success: true, data: [] };
  return { success: true, data };
}


// ---------------------------------------------------------------------------
// Document Generation & Download
// ---------------------------------------------------------------------------

export async function generateDocument(
  recordId: string,
  format: 'docx' | 'pdf',
  liveData?: Record<string, any>
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  // If Express API is available, try server-side generation
  if (!isDirectSupabaseActive()) {
    try {
      const authHeaders = await getAuthHeaders();
      const endpoint = recordId && recordId !== 'direct'
        ? `/api/document-builder/records/${recordId}/generate/${format}`
        : `/api/document-builder/generate/${format}`;

      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          ...authHeaders,
          ...(liveData ? { 'Content-Type': 'application/json' } : {}),
        },
        body: liveData ? JSON.stringify(liveData) : undefined,
      });

      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get('content-disposition') || '';
        const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
        const filename = filenameMatch?.[1] || `document.${format}`;
        return { success: true, blob, filename };
      }
    } catch {}
  }

  // Direct client-side DOCX generation fallback (for AWS Amplify / static hosts)
  if (format === 'docx' && liveData) {
    try {
      const blob = await generateClientDocx(liveData as any);
      const cleanTitle = (liveData.title || 'document').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
      const filename = `${cleanTitle}.${format}`;
      return { success: true, blob, filename };
    } catch (err: any) {
      console.error('[DocumentBuilder] Client DOCX generation error:', err);
      return { success: false, error: err.message || 'Failed to generate document' };
    }
  }

  return { success: false, error: `Generation of ${format.toUpperCase()} requires backend server` };
}

/** Trigger browser download from a blob */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
