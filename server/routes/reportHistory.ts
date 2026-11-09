/**
 * Service User Report History & Super Admin Archive Management Router
 *
 * Implements:
 * - Automatic tracking for reports generated/saved/downloaded in HO Report Generator & modules
 * - Permanent file storage (Supabase Storage bucket + local disk fallback)
 * - Service User Profile report history retrieval & download tracking
 * - Strict deletion & modification protection (Super Admin only)
 * - Complete compliance & audit trail
 *
 * Mounted at /api/report-history in server/index.ts.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../supabase.js';
import { recordAudit } from './documentBuilderStorage.js';

const router = Router();

// Storage paths
const REPORTS_DATA_DIR = path.join(process.cwd(), 'server', 'data', 'ho_reports');
const REPORTS_FILE = path.join(REPORTS_DATA_DIR, 'service_user_report_history.json');
const REPORTS_STORAGE_DIR = path.join(process.cwd(), 'server', 'data', 'reports', 'files');
const BUCKET_NAME = 'report-files';

function ensureStorageDirs() {
  if (!fs.existsSync(REPORTS_DATA_DIR)) {
    fs.mkdirSync(REPORTS_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPORTS_STORAGE_DIR)) {
    fs.mkdirSync(REPORTS_STORAGE_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserIdentity(req: Request) {
  const u = req.user;
  return {
    id: u?.id || 'usr-anonymous',
    name: u?.name || 'Staff Member',
    role: u?.role || 'Staff',
    email: u?.email || 'staff@sdcdms.co.uk',
    site: u?.assignedSite || 'Pending Assignment',
    sites: (u?.assignedSites && u.assignedSites.length > 0) ? u.assignedSites : [u?.assignedSite || 'Pending Assignment'],
  };
}

const ADMIN_ROLES = new Set(['Super Admin', 'Admin', 'Regional Manager', 'Operations Manager']);

function isSuperAdmin(role: string): boolean {
  return role === 'Super Admin';
}

function canAccessSite(author: ReturnType<typeof getUserIdentity>, site?: string): boolean {
  if (ADMIN_ROLES.has(author.role)) return true;
  if (author.sites.includes('All Sites') || author.sites.includes('All')) return true;
  const target = String(site || '').trim().toLowerCase();
  return author.sites.some(s => String(s).trim().toLowerCase() === target);
}

// ---------------------------------------------------------------------------
// Local JSON Storage fallback
// ---------------------------------------------------------------------------

function readLocalReportHistory(): any[] {
  try {
    ensureStorageDirs();
    if (!fs.existsSync(REPORTS_FILE)) {
      fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(REPORTS_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err: any) {
    console.warn('[ReportHistory] Error reading local report history JSON:', err.message);
    return [];
  }
}

function writeLocalReportHistory(records: any[]): void {
  try {
    ensureStorageDirs();
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err: any) {
    console.error('[ReportHistory] Error writing local report history JSON:', err.message);
  }
}

// ---------------------------------------------------------------------------
// File Saving Helper (Disk + Supabase Storage)
// ---------------------------------------------------------------------------

export async function saveReportFile(params: {
  id: string;
  suId: string;
  format: string;
  fileName: string;
  buffer: Buffer;
}): Promise<{ storagePath: string; localPath: string }> {
  ensureStorageDirs();
  const safeSuDir = path.join(REPORTS_STORAGE_DIR, params.suId || 'general');
  if (!fs.existsSync(safeSuDir)) {
    fs.mkdirSync(safeSuDir, { recursive: true });
  }

  const safeFileName = `${params.id}_${params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const localFilePath = path.join(safeSuDir, safeFileName);
  fs.writeFileSync(localFilePath, params.buffer);

  const storagePath = `service_users/${params.suId || 'general'}/reports/${safeFileName}`;

  // Attempt Supabase storage upload if available
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      let contentType = 'application/octet-stream';
      if (params.format === 'pdf') contentType = 'application/pdf';
      else if (params.format === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (params.format === 'csv') contentType = 'text/csv';
      else if (params.format === 'xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, params.buffer, { contentType, upsert: true });

      if (error && error.message.includes('not found')) {
        // Attempt creating bucket if missing
        await supabase.storage.createBucket(BUCKET_NAME, { public: false });
        await supabase.storage.from(BUCKET_NAME).upload(storagePath, params.buffer, { contentType, upsert: true });
      }
    } catch (err: any) {
      console.warn('[ReportHistory] Supabase storage upload notice (using local file storage):', err.message);
    }
  }

  return { storagePath, localPath: localFilePath };
}

// ---------------------------------------------------------------------------
// Direct Server-side Tracker
// ---------------------------------------------------------------------------

export async function trackReportHistoryDirect(params: {
  reportId?: string;
  suId: string;
  suName: string;
  suReference?: string;
  site?: string;
  reportName: string;
  reportType?: string;
  reportCategory?: string;
  fileFormat: string;
  fileName: string;
  buffer?: Buffer | null;
  status?: string;
  author: { id: string; name: string; role?: string; email?: string };
  metadata?: any;
}): Promise<any> {
  const {
    reportId,
    suId,
    suName,
    suReference,
    site,
    reportName,
    reportType = 'HO Report',
    reportCategory = 'Operations',
    fileFormat,
    fileName,
    buffer,
    status = 'Generated',
    author,
    metadata = {}
  } = params;

  const format = (fileFormat || 'docx').toLowerCase();
  const reportSite = site || 'All Sites';
  const historyId = crypto.randomUUID();
  const finalFileName = fileName || `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;
  let finalFileSize = buffer ? buffer.length : 0;
  let storagePath = '';

  if (buffer) {
    const saved = await saveReportFile({
      id: historyId,
      suId,
      format,
      fileName: finalFileName,
      buffer,
    });
    storagePath = saved.storagePath;
  }

  const nowIso = new Date().toISOString();
  const record = {
    id: historyId,
    report_id: reportId || null,
    su_id: suId,
    su_name: suName,
    su_reference: suReference || null,
    site: reportSite,
    report_name: reportName,
    report_type: reportType,
    report_category: reportCategory,
    file_format: format,
    file_name: finalFileName,
    file_size: finalFileSize,
    file_url: `/api/report-history/${historyId}/download`,
    storage_bucket: BUCKET_NAME,
    storage_path: storagePath || null,
    status,
    generated_by_id: author.id,
    generated_by_name: author.name,
    generated_by_role: author.role || 'Staff',
    generated_at: nowIso,
    saved_at: status === 'Saved' ? nowIso : null,
    downloaded_at: status === 'Downloaded' ? nowIso : null,
    last_downloaded_at: status === 'Downloaded' ? nowIso : null,
    download_count: status === 'Downloaded' ? 1 : 0,
    download_history: status === 'Downloaded' ? [{
      userId: author.id,
      userName: author.name,
      userRole: author.role || 'Staff',
      timestamp: nowIso
    }] : [],
    is_archived: false,
    metadata,
    data: metadata,
    created_at: nowIso,
    updated_at: nowIso
  };

  const all = readLocalReportHistory();
  const existingIdx = reportId ? all.findIndex((r: any) => r.report_id === reportId && r.file_format === format) : -1;
  let savedRecord = record;

  if (existingIdx >= 0) {
    savedRecord = {
      ...all[existingIdx],
      ...record,
      id: all[existingIdx].id,
      download_count: (all[existingIdx].download_count || 0) + (status === 'Downloaded' ? 1 : 0),
      download_history: [
        ...(all[existingIdx].download_history || []),
        ...(status === 'Downloaded' ? [{ userId: author.id, userName: author.name, userRole: author.role || 'Staff', timestamp: nowIso }] : [])
      ],
      updated_at: nowIso
    };
    all[existingIdx] = savedRecord;
  } else {
    all.unshift(record);
  }
  writeLocalReportHistory(all);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('service_user_report_history').upsert(savedRecord);
    } catch (err: any) {
      console.warn('[ReportHistory] Supabase sync notice:', err.message);
    }
  }

  await recordAudit({
    documentId: savedRecord.id,
    templateId: reportId || undefined,
    action: status === 'Downloaded' ? 'REPORT_DOWNLOADED' : (status === 'Saved' ? 'REPORT_SAVED' : 'REPORT_GENERATED'),
    userId: author.id,
    userName: author.name,
    userRole: author.role || 'Staff',
    userEmail: author.email,
    site: reportSite,
    details: `${status} report "${reportName}" (${format.toUpperCase()}) for Service User ${suName} (${suReference || suId})`,
  });

  return savedRecord;
}

// ---------------------------------------------------------------------------
// POST /api/report-history/track — Auto-track report generation/save/download
// ---------------------------------------------------------------------------

router.post('/track', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const {
    reportId,
    suId,
    suName,
    suReference,
    site,
    reportName,
    reportType,
    reportCategory,
    fileFormat,
    fileName,
    fileBase64,
    fileDataUrl,
    fileSize,
    status = 'Generated',
    notes,
    metadata = {}
  } = req.body || {};

  if (!suId || !suName || !reportName) {
    return res.status(400).json({ success: false, error: 'suId, suName, and reportName are required' });
  }

  try {
    let buffer: Buffer | null = null;
    if (fileBase64) {
      buffer = Buffer.from(fileBase64, 'base64');
    } else if (fileDataUrl && fileDataUrl.includes(',')) {
      const parts = fileDataUrl.split(',');
      buffer = Buffer.from(parts[1], 'base64');
    }

    const saved = await trackReportHistoryDirect({
      reportId,
      suId,
      suName,
      suReference,
      site: site || author.site,
      reportName,
      reportType,
      reportCategory,
      fileFormat,
      fileName,
      buffer,
      status,
      author,
      metadata: { ...metadata, notes: notes || '' }
    });

    res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    console.error('[ReportHistory] POST /track error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to record report history' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/report-history/su/:suId — List reports for a Service User
// ---------------------------------------------------------------------------

router.get('/su/:suId', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { suId } = req.params;
  const includeArchived = req.query.includeArchived === 'true' || isSuperAdmin(author.role);

  try {
    let records: any[] = [];
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        let q = supabase
          .from('service_user_report_history')
          .select('*')
          .eq('su_id', suId)
          .order('generated_at', { ascending: false });

        if (!includeArchived) {
          q = q.eq('is_archived', false);
        }

        const { data, error } = await q;
        if (!error && data) {
          records = data;
        }
      } catch (err: any) {
        console.warn('[ReportHistory] Supabase fetch error, falling back to local storage:', err.message);
      }
    }

    if (records.length === 0) {
      const local = readLocalReportHistory();
      records = local.filter((r: any) => r.su_id === suId && (includeArchived || !r.is_archived));
    }

    // Filter by site access
    const accessible = records.filter((r: any) => canAccessSite(author, r.site));
    res.json({ success: true, data: accessible });
  } catch (err: any) {
    console.error('[ReportHistory] GET /su/:suId error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch report history' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/report-history/:id/download — Download report & track download
// ---------------------------------------------------------------------------

router.get('/:id/download', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { id } = req.params;

  try {
    // 1. Find the record
    let record: any = null;
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data } = await supabase.from('service_user_report_history').select('*').eq('id', id).maybeSingle();
        if (data) record = data;
      } catch {}
    }

    if (!record) {
      const local = readLocalReportHistory();
      record = local.find((r: any) => r.id === id);
    }

    if (!record) {
      return res.status(404).json({ success: false, error: 'Report history record not found' });
    }

    if (!canAccessSite(author, record.site)) {
      return res.status(403).json({ success: false, error: 'Access denied: You cannot view records for this site' });
    }

    // 2. Track download event
    const nowIso = new Date().toISOString();
    const downloadEvent = {
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      timestamp: nowIso
    };

    const newDownloadCount = (record.download_count || 0) + 1;
    const updatedHistory = [...(record.download_history || []), downloadEvent];

    // Update in local JSON
    const local = readLocalReportHistory();
    const lIdx = local.findIndex((r: any) => r.id === id);
    if (lIdx >= 0) {
      local[lIdx].download_count = newDownloadCount;
      local[lIdx].last_downloaded_at = nowIso;
      local[lIdx].downloaded_at = local[lIdx].downloaded_at || nowIso;
      local[lIdx].download_history = updatedHistory;
      local[lIdx].updated_at = nowIso;
      writeLocalReportHistory(local);
    }

    // Update in Supabase
    if (supabase) {
      try {
        await supabase.from('service_user_report_history').update({
          download_count: newDownloadCount,
          last_downloaded_at: nowIso,
          download_history: updatedHistory,
          updated_at: nowIso
        }).eq('id', id);
      } catch (err: any) {
        console.warn('[ReportHistory] Error updating download metrics in Supabase:', err.message);
      }
    }

    // Audit download
    await recordAudit({
      documentId: record.id,
      templateId: record.report_id || undefined,
      action: 'REPORT_DOWNLOADED',
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      userEmail: author.email,
      site: record.site,
      details: `Downloaded report "${record.report_name}" (${record.file_format?.toUpperCase()}) for Service User ${record.su_name}`,
    });

    // 3. Find file on disk or Supabase storage
    const suFolder = record.su_id || 'general';
    const safeSuDir = path.join(REPORTS_STORAGE_DIR, suFolder);
    const candidateFiles = fs.existsSync(safeSuDir) ? fs.readdirSync(safeSuDir) : [];
    const matchedFile = candidateFiles.find(f => f.startsWith(record.id));

    let fileBuffer: Buffer | null = null;
    if (matchedFile) {
      fileBuffer = fs.readFileSync(path.join(safeSuDir, matchedFile));
    } else if (supabase && record.storage_path) {
      try {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(record.storage_path);
        if (!error && data) {
          const arr = await data.arrayBuffer();
          fileBuffer = Buffer.from(arr);
        }
      } catch (err: any) {
        console.warn('[ReportHistory] Supabase file download attempt failed:', err.message);
      }
    }

    const filename = record.file_name || `Report_${record.id}.${record.file_format || 'docx'}`;

    if (!fileBuffer) {
      // If no stored file is present (e.g. metadata-only legacy entry), inform caller
      return res.status(404).json({
        success: false,
        error: 'Report file is not available in storage. It may have been generated prior to automated file capture.'
      });
    }

    let contentType = 'application/octet-stream';
    if (record.file_format === 'pdf') contentType = 'application/pdf';
    else if (record.file_format === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (record.file_format === 'csv') contentType = 'text/csv';
    else if (record.file_format === 'xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fileBuffer);
  } catch (err: any) {
    console.error('[ReportHistory] GET /:id/download error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to process file download' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/report-history/:id — Update Report Metadata (Super Admin only)
// ---------------------------------------------------------------------------

router.patch('/:id', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { id } = req.params;

  if (!isSuperAdmin(author.role)) {
    return res.status(403).json({
      success: false,
      error: 'Permission Denied: Only Super Admin has permission to modify report metadata.'
    });
  }

  const { reportName, reportCategory, status, notes } = req.body || {};

  try {
    const nowIso = new Date().toISOString();
    const local = readLocalReportHistory();
    const idx = local.findIndex((r: any) => r.id === id);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const updated = {
      ...local[idx],
      report_name: reportName || local[idx].report_name,
      report_category: reportCategory || local[idx].report_category,
      status: status || local[idx].status,
      metadata: { ...(local[idx].metadata || {}), notes: notes !== undefined ? notes : (local[idx].metadata?.notes || '') },
      updated_at: nowIso
    };

    local[idx] = updated;
    writeLocalReportHistory(local);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from('service_user_report_history').update({
          report_name: updated.report_name,
          report_category: updated.report_category,
          status: updated.status,
          metadata: updated.metadata,
          updated_at: nowIso
        }).eq('id', id);
      } catch (err: any) {
        console.warn('[ReportHistory] Supabase update metadata notice:', err.message);
      }
    }

    await recordAudit({
      documentId: id,
      action: 'REPORT_METADATA_UPDATED',
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      userEmail: author.email,
      site: updated.site,
      details: `Super Admin updated metadata for report "${updated.report_name}" (Category: ${updated.report_category})`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[ReportHistory] PATCH /:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update report metadata' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/report-history/:id/archive — Archive or Restore Report (Super Admin only)
// ---------------------------------------------------------------------------

router.post('/:id/archive', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { id } = req.params;

  if (!isSuperAdmin(author.role)) {
    return res.status(403).json({
      success: false,
      error: 'Permission Denied: Only Super Admin has permission to archive or restore reports.'
    });
  }

  const { archive = true } = req.body || {};

  try {
    const nowIso = new Date().toISOString();
    const local = readLocalReportHistory();
    const idx = local.findIndex((r: any) => r.id === id);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const updated = {
      ...local[idx],
      is_archived: !!archive,
      status: archive ? 'Archived' : (local[idx].saved_at ? 'Saved' : 'Generated'),
      archived_at: archive ? nowIso : null,
      archived_by: archive ? author.name : null,
      updated_at: nowIso
    };

    local[idx] = updated;
    writeLocalReportHistory(local);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        await supabase.from('service_user_report_history').update({
          is_archived: updated.is_archived,
          status: updated.status,
          archived_at: updated.archived_at,
          archived_by: updated.archived_by,
          updated_at: nowIso
        }).eq('id', id);
      } catch (err: any) {
        console.warn('[ReportHistory] Supabase archive notice:', err.message);
      }
    }

    await recordAudit({
      documentId: id,
      action: archive ? 'REPORT_ARCHIVED' : 'REPORT_RESTORED',
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      userEmail: author.email,
      site: updated.site,
      details: `Super Admin ${archive ? 'archived' : 'restored'} report "${updated.report_name}" for Service User ${updated.su_name}`,
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[ReportHistory] POST /:id/archive error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update archive status' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/report-history/:id — Permanent Deletion (Super Admin only)
// ---------------------------------------------------------------------------

router.delete('/:id', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { id } = req.params;

  if (!isSuperAdmin(author.role)) {
    return res.status(403).json({
      success: false,
      error: 'Permission Denied: Only Super Admin can permanently delete report history records and files. Deletion is strictly audited and protected.'
    });
  }

  try {
    const local = readLocalReportHistory();
    const idx = local.findIndex((r: any) => r.id === id);
    const existing = idx >= 0 ? local[idx] : null;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    // 1. Permanently delete file from disk storage
    const suFolder = existing.su_id || 'general';
    const safeSuDir = path.join(REPORTS_STORAGE_DIR, suFolder);
    if (fs.existsSync(safeSuDir)) {
      const files = fs.readdirSync(safeSuDir);
      files.filter(f => f.startsWith(id)).forEach(f => {
        try {
          fs.unlinkSync(path.join(safeSuDir, f));
        } catch (uErr: any) {
          console.warn('[ReportHistory] Error unlinking file on disk:', uErr.message);
        }
      });
    }

    // 2. Permanently delete from Supabase storage
    const supabase = getSupabaseAdmin();
    if (supabase && existing.storage_path) {
      try {
        await supabase.storage.from(BUCKET_NAME).remove([existing.storage_path]);
      } catch (sErr: any) {
        console.warn('[ReportHistory] Supabase storage removal error:', sErr.message);
      }
    }

    // 3. Remove record from local JSON storage
    local.splice(idx, 1);
    writeLocalReportHistory(local);

    // 4. Remove record from Supabase PostgreSQL table
    if (supabase) {
      try {
        await supabase.from('service_user_report_history').delete().eq('id', id);
      } catch (dbErr: any) {
        console.warn('[ReportHistory] Supabase delete error:', dbErr.message);
      }
    }

    // 5. Compliance Audit Entry
    await recordAudit({
      documentId: id,
      action: 'REPORT_DELETED',
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      userEmail: author.email,
      site: existing.site,
      details: `Super Admin permanently deleted report record "${existing.report_name}" (${existing.file_name}) and associated file from storage.`,
    });

    res.json({
      success: true,
      message: 'Report history record and associated storage file permanently deleted by Super Admin.'
    });
  } catch (err: any) {
    console.error('[ReportHistory] DELETE /:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete report record' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/report-history/:id/audit — Fetch audit trail for a report
// ---------------------------------------------------------------------------

router.get('/:id/audit', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { id } = req.params;

  try {
    const supabase = getSupabaseAdmin();
    let logs: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase
          .from('ho_report_audit_logs')
          .select('*')
          .eq('record_id', id)
          .order('created_at', { ascending: false });
        if (data) logs = data;
      } catch {}
    }

    res.json({ success: true, data: logs });
  } catch (err: any) {
    console.error('[ReportHistory] GET /:id/audit error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch audit trail' });
  }
});

export default router;
