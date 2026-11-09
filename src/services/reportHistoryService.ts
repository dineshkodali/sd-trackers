/**
 * Service User Report History Service
 *
 * Client API for automatic report history tracking, file downloads,
 * and Super Admin archive management.
 */

import { authHeaders, getApiUrl, isDirectSupabaseActive } from './apiService';
import { getBrowserSupabaseClient } from '../lib/supabaseClient';
import type { ServiceUserReportRecord, TrackReportInput } from '../types/reportHistory';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...authHeaders() };

  if (headers['Authorization']) return headers;

  const supabase = getBrowserSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
      return headers;
    }
  }

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

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const reportHistoryService = {
  /**
   * Track report generation, saving, or download
   */
  async trackReport(input: TrackReportInput): Promise<{ success: boolean; data?: ServiceUserReportRecord; error?: string }> {
    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        let fileBase64 = input.fileBase64;

        if (!fileBase64 && input.fileBlob) {
          fileBase64 = await blobToBase64(input.fileBlob);
        }

        const res = await fetch(getApiUrl('/api/report-history/track'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...input,
            fileBase64,
            fileBlob: undefined // don't send blob in json
          })
        });

        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          return { success: true, data: body.data };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API trackReport failed, falling back to direct Supabase:', err);
      }
    }

    // Direct Supabase mode (AWS Amplify / static hosting)
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { success: false, error: 'Database unavailable' };

    try {
      const now = new Date().toISOString();
      const id = input.reportId && input.reportId !== 'direct' && !input.reportId.startsWith('new-')
        ? `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        : `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      let fileStorageRef = input.fileStorageRef || null;
      if (!fileStorageRef && input.fileBase64) {
        fileStorageRef = `data:application/octet-stream;base64,${input.fileBase64}`;
      } else if (!fileStorageRef && input.fileBlob) {
        const b64 = await blobToBase64(input.fileBlob);
        fileStorageRef = `data:application/octet-stream;base64,${b64}`;
      }

      const row = {
        id,
        report_name: input.reportName,
        report_category: input.reportCategory || 'Operations',
        report_type: input.reportType || 'HO Report',
        su_id: input.suId,
        su_name: input.suName,
        su_reference: input.suReference || null,
        site: input.site || 'All Sites',
        generated_by_id: input.generatedById || (typeof window !== 'undefined' ? localStorage.getItem('userId') || 'system' : 'system'),
        generated_by_name: input.generatedByName || (typeof window !== 'undefined' ? localStorage.getItem('currentUserName') || 'Staff' : 'Staff'),
        generated_by_role: input.generatedByRole || (typeof window !== 'undefined' ? localStorage.getItem('role') || 'Staff' : 'Staff'),
        file_format: input.fileFormat || 'docx',
        file_name: input.fileName,
        file_storage_ref: fileStorageRef,
        file_size_bytes: input.fileSizeBytes || (input.fileBlob ? input.fileBlob.size : null),
        status: input.status || 'Generated',
        download_count: input.status === 'Downloaded' ? 1 : 0,
        last_downloaded_at: input.status === 'Downloaded' ? now : null,
        metadata: input.metadata || {},
        is_archived: false,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase.from('service_user_report_history').insert(row).select().single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: data as any };
    } catch (err: any) {
      console.error('[ReportHistoryService] direct trackReport error:', err);
      return { success: false, error: err.message || 'Failed to record report history' };
    }
  },

  /**
   * Fetch all report history for a specific Service User
   */
  async fetchSUReports(suId: string, options?: { includeArchived?: boolean }): Promise<{ success: boolean; data: ServiceUserReportRecord[]; error?: string }> {
    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        const params = new URLSearchParams();
        if (options?.includeArchived) params.set('includeArchived', 'true');

        const res = await fetch(getApiUrl(`/api/report-history/su/${encodeURIComponent(suId)}${params.toString() ? `?${params.toString()}` : ''}`), {
          headers
        });

        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          return { success: true, data: body.data || [] };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API fetchSUReports failed, falling back to direct Supabase:', err);
      }
    }

    // Direct Supabase mode
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { success: true, data: [] };

    try {
      let query = supabase.from('service_user_report_history').select('*').eq('su_id', suId);
      if (!options?.includeArchived) query = query.eq('is_archived', false);
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error || !data) return { success: true, data: [] };

      const mapped: ServiceUserReportRecord[] = data.map((r: any) => ({
        id: r.id,
        reportName: r.report_name,
        reportCategory: r.report_category,
        reportType: r.report_type,
        suId: r.su_id,
        suName: r.su_name,
        suReference: r.su_reference,
        site: r.site,
        generatedById: r.generated_by_id,
        generatedByName: r.generated_by_name,
        generatedByRole: r.generated_by_role,
        generatedAt: r.created_at,
        lastDownloadedAt: r.last_downloaded_at,
        downloadCount: Number(r.download_count) || 0,
        fileFormat: r.file_format,
        fileName: r.file_name,
        fileStorageRef: r.file_storage_ref,
        fileSizeBytes: r.file_size_bytes,
        status: r.status,
        isArchived: r.is_archived ?? false,
        archivedAt: r.archived_at,
        metadata: r.metadata,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      return { success: true, data: mapped };
    } catch (err: any) {
      console.error('[ReportHistoryService] direct fetchSUReports error:', err);
      return { success: false, data: [], error: err.message || 'Database error' };
    }
  },

  /**
   * Download a report file and update download metrics
   */
  async downloadReport(record: ServiceUserReportRecord): Promise<{ success: boolean; error?: string }> {
    // If it's a data URL or in direct mode
    if (record.fileStorageRef && record.fileStorageRef.startsWith('data:')) {
      try {
        const res = await fetch(record.fileStorageRef);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = record.fileName || `${record.reportName.replace(/[^a-zA-Z0-9]/g, '_')}.${record.fileFormat || 'docx'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        const supabase = getBrowserSupabaseClient();
        if (supabase) {
          await supabase.from('service_user_report_history').update({
            download_count: (record.downloadCount || 0) + 1,
            last_downloaded_at: new Date().toISOString(),
          }).eq('id', record.id);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Download error' };
      }
    }

    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(record.id)}/download`), {
          headers
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = record.fileName || `${record.reportName.replace(/[^a-zA-Z0-9]/g, '_')}.${record.fileFormat || 'docx'}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API downloadReport failed:', err);
      }
    }

    return { success: false, error: 'File content not found' };
  },

  /**
   * Update report metadata (Super Admin only)
   */
  async updateMetadata(
    id: string,
    updates: { reportName?: string; reportCategory?: string; status?: string; notes?: string }
  ): Promise<{ success: boolean; data?: ServiceUserReportRecord; error?: string }> {
    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}`), {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updates)
        });

        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          return { success: true, data: body.data };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API updateMetadata failed:', err);
      }
    }

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { success: false, error: 'Database unavailable' };

    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.reportName) dbUpdates.report_name = updates.reportName;
    if (updates.reportCategory) dbUpdates.report_category = updates.reportCategory;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.notes) dbUpdates.notes = updates.notes;

    const { data, error } = await supabase.from('service_user_report_history').update(dbUpdates).eq('id', id).select().single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as any };
  },

  /**
   * Archive or restore a report (Super Admin only)
   */
  async archiveReport(
    id: string,
    archive: boolean
  ): Promise<{ success: boolean; data?: ServiceUserReportRecord; error?: string }> {
    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}/archive`), {
          method: 'POST',
          headers,
          body: JSON.stringify({ archive })
        });

        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          return { success: true, data: body.data };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API archiveReport failed:', err);
      }
    }

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { success: false, error: 'Database unavailable' };

    const { data, error } = await supabase.from('service_user_report_history').update({
      is_archived: archive,
      status: archive ? 'Archived' : 'Active',
      archived_at: archive ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as any };
  },

  /**
   * Permanently delete report history record and file (Super Admin only)
   */
  async deletePermanently(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers
        });

        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          return { success: true };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API deletePermanently failed:', err);
      }
    }

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { success: false, error: 'Database unavailable' };

    const { error } = await supabase.from('service_user_report_history').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Fetch audit trail for a report
   */
  async fetchAuditTrail(id: string): Promise<{ success: boolean; data: any[]; error?: string }> {
    if (!isDirectSupabaseActive()) {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}/audit`), {
          headers
        });

        const body = await res.json().catch(() => ({}));
        if (res.ok && body.success) {
          return { success: true, data: body.data || [] };
        }
      } catch (err: any) {
        console.warn('[ReportHistoryService] API fetchAuditTrail failed:', err);
      }
    }

    const supabase = getBrowserSupabaseClient();
    if (!supabase) return { success: true, data: [] };

    const { data, error } = await supabase
      .from('audit_trails')
      .select('*')
      .eq('entity_id', id)
      .order('timestamp', { ascending: false });

    if (error || !data) return { success: true, data: [] };
    return { success: true, data };
  }
};

