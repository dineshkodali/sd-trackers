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

import { authHeaders } from './apiService';

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
    const res = await fetch(`/api/document-builder${path}`, {
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

import { CLIENT_SEED_TEMPLATES } from '../data/seedTemplates';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function fetchTemplates(): Promise<DocumentBuilderApiResponse<TemplateWithVersion[]>> {
  const res = await apiFetch<TemplateWithVersion[]>('/templates');
  if (res.success && res.data && res.data.length > 0) {
    return res;
  }
  // Resilient fallback: return client seed templates so UI is never empty
  return { success: true, data: CLIENT_SEED_TEMPLATES };
}

export async function fetchTemplateFields(
  templateId: string
): Promise<DocumentBuilderApiResponse<TemplateVersion>> {
  return apiFetch<TemplateVersion>(`/templates/${templateId}/fields`);
}

export async function createTemplate(
  template: Partial<DocumentTemplate>,
  version: Partial<TemplateVersion>
): Promise<DocumentBuilderApiResponse<DocumentTemplate>> {
  return apiFetch<DocumentTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify({ template, version }),
  });
}

export async function updateTemplate(
  id: string,
  template: Partial<DocumentTemplate>,
  version?: Partial<TemplateVersion>
): Promise<DocumentBuilderApiResponse<DocumentTemplate>> {
  return apiFetch<DocumentTemplate>(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ template, version }),
  });
}

export async function deleteTemplate(
  id: string
): Promise<DocumentBuilderApiResponse<{ success: boolean }>> {
  return apiFetch<{ success: boolean }>(`/templates/${id}`, {
    method: 'DELETE',
  });
}

export async function importDocumentTemplate(
  payload: any
): Promise<DocumentBuilderApiResponse<TemplateWithVersion>> {
  return apiFetch<TemplateWithVersion>('/templates/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Document Records
// ---------------------------------------------------------------------------

export async function fetchDocumentRecords(): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord[]>> {
  const res = await apiFetch<DocumentBuilderRecord[]>('/records');
  if (res.success && res.data) {
    return res;
  }
  return { success: true, data: [] };
}

export async function fetchDocumentRecord(id: string): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord>> {
  return apiFetch<DocumentBuilderRecord>(`/records/${id}`);
}

export async function saveDocumentDraft(
  record: Partial<DocumentBuilderRecord>
): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord>> {
  return apiFetch<DocumentBuilderRecord>('/records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export async function updateDocumentDraft(
  id: string,
  record: Partial<DocumentBuilderRecord>
): Promise<DocumentBuilderApiResponse<DocumentBuilderRecord>> {
  return apiFetch<DocumentBuilderRecord>(`/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(record),
  });
}

export async function deleteDocumentRecord(
  id: string
): Promise<DocumentBuilderApiResponse<{ success: boolean }>> {
  return apiFetch<{ success: boolean }>(`/records/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchDocumentAuditTrail(
  recordId: string
): Promise<DocumentBuilderApiResponse<any[]>> {
  return apiFetch<any[]>(`/records/${recordId}/audit`);
}


// ---------------------------------------------------------------------------
// Document Generation & Download
// ---------------------------------------------------------------------------

export async function generateDocument(
  recordId: string,
  format: 'docx' | 'pdf',
  liveData?: Record<string, any>
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const endpoint = recordId && recordId !== 'direct'
      ? `/api/document-builder/records/${recordId}/generate/${format}`
      : `/api/document-builder/generate/${format}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(liveData ? { 'Content-Type': 'application/json' } : {}),
      },
      body: liveData ? JSON.stringify(liveData) : undefined,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = filenameMatch?.[1] || `document.${format}`;

    return { success: true, blob, filename };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
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
