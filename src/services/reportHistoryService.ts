/**
 * Service User Report History Service
 *
 * Client API for automatic report history tracking, file downloads,
 * and Super Admin archive management.
 */

import { authHeaders, getApiUrl } from './apiService';
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
      if (!res.ok || !body.success) {
        return { success: false, error: body.error || `HTTP ${res.status}` };
      }
      return { success: true, data: body.data };
    } catch (err: any) {
      console.error('[ReportHistoryService] trackReport error:', err);
      return { success: false, error: err.message || 'Failed to record report history' };
    }
  },

  /**
   * Fetch all report history for a specific Service User
   */
  async fetchSUReports(suId: string, options?: { includeArchived?: boolean }): Promise<{ success: boolean; data: ServiceUserReportRecord[]; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (options?.includeArchived) params.set('includeArchived', 'true');

      const res = await fetch(getApiUrl(`/api/report-history/su/${encodeURIComponent(suId)}${params.toString() ? `?${params.toString()}` : ''}`), {
        headers
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        return { success: false, data: [], error: body.error || `HTTP ${res.status}` };
      }
      return { success: true, data: body.data || [] };
    } catch (err: any) {
      console.error('[ReportHistoryService] fetchSUReports error:', err);
      return { success: false, data: [], error: err.message || 'Network error' };
    }
  },

  /**
   * Download a report file and update download metrics
   */
  async downloadReport(record: ServiceUserReportRecord): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(record.id)}/download`), {
        headers
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body.error || `Download failed (HTTP ${res.status})` };
      }

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
    } catch (err: any) {
      console.error('[ReportHistoryService] downloadReport error:', err);
      return { success: false, error: err.message || 'Download error' };
    }
  },

  /**
   * Update report metadata (Super Admin only)
   */
  async updateMetadata(
    id: string,
    updates: { reportName?: string; reportCategory?: string; status?: string; notes?: string }
  ): Promise<{ success: boolean; data?: ServiceUserReportRecord; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        return { success: false, error: body.error || `HTTP ${res.status}` };
      }
      return { success: true, data: body.data };
    } catch (err: any) {
      console.error('[ReportHistoryService] updateMetadata error:', err);
      return { success: false, error: err.message || 'Failed to update metadata' };
    }
  },

  /**
   * Archive or restore a report (Super Admin only)
   */
  async archiveReport(
    id: string,
    archive: boolean
  ): Promise<{ success: boolean; data?: ServiceUserReportRecord; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}/archive`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ archive })
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        return { success: false, error: body.error || `HTTP ${res.status}` };
      }
      return { success: true, data: body.data };
    } catch (err: any) {
      console.error('[ReportHistoryService] archiveReport error:', err);
      return { success: false, error: err.message || 'Failed to archive report' };
    }
  },

  /**
   * Permanently delete report history record and file (Super Admin only)
   */
  async deletePermanently(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        return { success: false, error: body.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: any) {
      console.error('[ReportHistoryService] deletePermanently error:', err);
      return { success: false, error: err.message || 'Failed to delete report' };
    }
  },

  /**
   * Fetch audit trail for a report
   */
  async fetchAuditTrail(id: string): Promise<{ success: boolean; data: any[]; error?: string }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(getApiUrl(`/api/report-history/${encodeURIComponent(id)}/audit`), {
        headers
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        return { success: false, data: [], error: body.error || `HTTP ${res.status}` };
      }
      return { success: true, data: body.data || [] };
    } catch (err: any) {
      return { success: false, data: [], error: err.message || 'Audit trail error' };
    }
  }
};

