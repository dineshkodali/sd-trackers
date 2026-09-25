/**
 * HO Report Generator — Separate Tables Storage Layer
 *
 * Dedicated Tables:
 * 1. `ho_report_templates`  — Master report templates & versioned field schemas
 * 2. `ho_report_records`    — Generated report records (drafts & finalized) prepared in DOCX/PDF
 * 3. `ho_report_audit_logs` — Compliance & RBAC audit trail (segregated from forms/data)
 *
 * Provides resilient two-way synchronization:
 * - Supabase PostgreSQL dedicated tables (with graceful fallback to doc_builder)
 * - Atomic dedicated local JSON storage in server/data/ho_reports/
 * - ZERO mock data
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../supabase.js';
import { SEED_TEMPLATES } from './documentBuilderSeed.js';

// Table names in Supabase PostgreSQL
export const TABLE_HO_TEMPLATES = 'ho_report_templates';
export const TABLE_HO_RECORDS = 'ho_report_records';
export const TABLE_HO_AUDIT = 'ho_report_audit_logs';
export const TABLE_LEGACY_DOC_BUILDER = 'doc_builder';

// Dedicated local JSON files
const DATA_DIR = path.join(process.cwd(), 'server', 'data', 'ho_reports');
const TEMPLATES_FILE = path.join(DATA_DIR, 'ho_report_templates.json');
const RECORDS_FILE = path.join(DATA_DIR, 'ho_report_records.json');
const AUDIT_FILE = path.join(DATA_DIR, 'ho_report_audit_logs.json');

// Legacy unified file for backward compatibility
const LEGACY_DIR = path.join(process.cwd(), 'server', 'data', 'document_builder');
const LEGACY_FILE = path.join(LEGACY_DIR, 'doc_builder.json');

function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEGACY_DIR)) {
    fs.mkdirSync(LEGACY_DIR, { recursive: true });
  }
}

// ----------------------------------------------------------------------------
// Interfaces
// ----------------------------------------------------------------------------

export interface StoredTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: {
    id: string;
    templateId: string;
    version: number;
    isCurrent: boolean;
    fieldDefinitions: any[];
    layoutConfig: any;
    headerConfig: any;
    footerConfig: any;
    createdBy: string;
    createdAt: string;
  };
}

export interface StoredRecord {
  id: string;
  templateId: string;
  templateVersionId?: string;
  site: string;
  title: string;
  documentNumber: string;
  category?: string;
  status: 'draft' | 'final' | 'archived';
  preparedFormat?: 'docx' | 'pdf' | 'both' | null;
  docxUrl?: string | null;
  pdfUrl?: string | null;
  fieldValues: Record<string, any>;
  fieldDefinitions?: any[];
  layoutConfig?: any;
  headerConfig?: any;
  footerConfig?: any;
  createdBy: string;
  createdByName: string;
  createdByRole?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByRole?: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

export interface StoredAuditLog {
  id: string;
  documentId?: string;
  templateId?: string;
  action: string;
  userId: string;
  userName: string;
  userRole: string;
  userEmail?: string;
  site?: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Local Storage Helpers (Atomic & Dedicated)
// ----------------------------------------------------------------------------

function readLocalTemplates(): StoredTemplate[] {
  try {
    ensureDataDirs();
    if (!fs.existsSync(TEMPLATES_FILE)) {
      const initial = getDefaultTemplates().filter(t => t.id === 'tmpl-incident-report' || t.name.toLowerCase().includes('incident'));
      writeLocalTemplates(initial);
      return initial;
    }
    const content = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    const list = Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultTemplates();
    return list.filter(t => t.id === 'tmpl-incident-report' || t.name.toLowerCase().includes('incident'));
  } catch (err) {
    console.warn('[HOReporterStorage] Error reading ho_report_templates.json:', err);
    return getDefaultTemplates().filter(t => t.id === 'tmpl-incident-report' || t.name.toLowerCase().includes('incident'));
  }
}

function writeLocalTemplates(templates: StoredTemplate[]): void {
  try {
    ensureDataDirs();
    fs.writeFileSync(TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf-8');
    syncToLegacyDocBuilder();
  } catch (err) {
    console.error('[HOReporterStorage] Error writing ho_report_templates.json:', err);
  }
}

function readLocalRecords(): StoredRecord[] {
  try {
    ensureDataDirs();
    if (!fs.existsSync(RECORDS_FILE)) {
      fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(RECORDS_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    // Strict: Filter out any mock record IDs
    return Array.isArray(parsed) ? parsed.filter(r => !r.id?.includes('rasul') && !r.id?.includes('741001')) : [];
  } catch (err) {
    console.warn('[HOReporterStorage] Error reading ho_report_records.json:', err);
    return [];
  }
}

function writeLocalRecords(records: StoredRecord[]): void {
  try {
    ensureDataDirs();
    // Strict: never save mock documents
    const cleanRecords = records.filter(r => !r.id?.includes('rasul') && !r.id?.includes('741001'));
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(cleanRecords, null, 2), 'utf-8');
    syncToLegacyDocBuilder();
  } catch (err) {
    console.error('[HOReporterStorage] Error writing ho_report_records.json:', err);
  }
}

function readLocalAuditLogs(): StoredAuditLog[] {
  try {
    ensureDataDirs();
    if (!fs.existsSync(AUDIT_FILE)) {
      fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.filter(l => !l.id?.includes('rasul')) : [];
  } catch (err) {
    return [];
  }
}

function writeLocalAuditLogs(logs: StoredAuditLog[]): void {
  try {
    ensureDataDirs();
    const cleanLogs = logs.filter(l => !l.id?.includes('rasul')).slice(0, 5000);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(cleanLogs, null, 2), 'utf-8');
    syncToLegacyDocBuilder();
  } catch (err) {
    console.error('[HOReporterStorage] Error writing ho_report_audit_logs.json:', err);
  }
}

function getDefaultTemplates(): StoredTemplate[] {
  return SEED_TEMPLATES.map(s => ({
    ...s.template,
    currentVersion: s.version,
  }));
}

/**
 * Backward compatibility: Keep server/data/document_builder/doc_builder.json in sync
 * without corrupting or inserting any mock data.
 */
function syncToLegacyDocBuilder() {
  try {
    const templates = readLocalTemplates();
    const records = readLocalRecords();
    const audits = readLocalAuditLogs();

    const legacyRows = [
      ...templates.map(t => ({
        id: t.id,
        record_type: 'template',
        template_id: t.id,
        site: 'All Sites',
        title: t.name,
        category: t.category,
        status: t.isActive ? 'active' : 'inactive',
        data: t,
        created_by: t.createdBy,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
      ...records.map(r => ({
        id: r.id,
        record_type: 'document',
        template_id: r.templateId,
        site: r.site,
        title: r.title,
        document_number: r.documentNumber,
        category: r.category || 'General',
        status: r.status,
        field_values: r.fieldValues,
        created_by: r.createdBy,
        created_by_name: r.createdByName,
        created_by_role: r.createdByRole,
        created_by_email: r.createdByEmail,
        updated_by: r.updatedBy,
        updated_by_name: r.updatedByName,
        updated_by_role: r.updatedByRole,
        finalized_at: r.finalizedAt,
        finalized_by: r.finalizedBy,
        data: r,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),
      ...audits.map(a => ({
        id: a.id,
        record_type: 'audit',
        template_id: a.documentId || a.templateId,
        site: a.site || 'All Sites',
        title: a.action,
        status: 'logged',
        data: a,
        created_by: a.userId,
        created_by_name: a.userName,
        created_by_role: a.userRole,
        created_by_email: a.userEmail,
        created_at: a.timestamp,
        updated_at: a.timestamp,
      })),
    ];

    fs.writeFileSync(LEGACY_FILE, JSON.stringify(legacyRows, null, 2), 'utf-8');
  } catch (_) {}
}

// ----------------------------------------------------------------------------
// 1. TEMPLATES (ho_report_templates)
// ----------------------------------------------------------------------------

export async function getTemplates(): Promise<StoredTemplate[]> {
  const localTemplates = readLocalTemplates();
  const seedIncident = SEED_TEMPLATES.find(s => s.template.id === 'tmpl-incident-report');

  const supabase = getSupabaseAdmin();
  if (!supabase) return localTemplates;

  try {
    // 1. First attempt to query dedicated `ho_report_templates` table
    const { data: dbTemplates, error: dedicatedErr } = await supabase
      .from(TABLE_HO_TEMPLATES)
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!dedicatedErr && dbTemplates && dbTemplates.length > 0) {
      const mapped: StoredTemplate[] = dbTemplates.map((r: any) => {
        if (r.data && r.data.name) return r.data as StoredTemplate;
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
        writeLocalTemplates(filtered);
        return filtered;
      }
      return localTemplates;
    }

    // 2. Fallback to `doc_builder` where record_type = 'template'
    const { data: legacyRows, error: legacyErr } = await supabase
      .from(TABLE_LEGACY_DOC_BUILDER)
      .select('*')
      .eq('record_type', 'template')
      .neq('status', 'inactive')
      .order('title');

    if (!legacyErr && legacyRows && legacyRows.length > 0) {
      const mapped: StoredTemplate[] = legacyRows.map((r: any) => {
        if (r.data && r.data.name) return r.data as StoredTemplate;
        return {
          id: r.id,
          name: r.title,
          description: r.data?.description || '',
          category: r.category || 'General',
          isActive: r.status === 'active',
          createdBy: r.created_by || 'system',
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          currentVersion: r.data?.currentVersion || {
            id: `tver-${r.id}`,
            templateId: r.id,
            version: 1,
            isCurrent: true,
            fieldDefinitions: [],
            layoutConfig: {},
            headerConfig: {},
            footerConfig: {},
            createdBy: 'system',
            createdAt: r.created_at,
          },
        };
      });

      const filtered = mapped.filter(t => t.id === 'tmpl-incident-report' || t.name.toLowerCase().includes('incident'));
      if (filtered.length > 0) {
        writeLocalTemplates(filtered);
        return filtered;
      }
      return localTemplates;
    }

    return localTemplates;
  } catch (err) {
    return localTemplates;
  }
}

export async function getTemplateById(id: string): Promise<StoredTemplate | null> {
  const templates = await getTemplates();
  return templates.find(t => t.id === id) || null;
}

export async function saveTemplate(
  templateData: Partial<StoredTemplate>,
  versionData: any,
  author: { id?: string; name?: string; role?: string; email?: string }
): Promise<StoredTemplate> {
  const localTemplates = readLocalTemplates();
  const now = new Date().toISOString();
  const isNew = !templateData.id;
  const id = templateData.id || `tmpl-${crypto.randomUUID().slice(0, 8)}`;

  const existing = localTemplates.find(t => t.id === id);

  const storedItem: StoredTemplate = {
    id,
    name: templateData.name || existing?.name || 'Custom Report Template',
    description: templateData.description !== undefined ? templateData.description : (existing?.description || ''),
    category: templateData.category || existing?.category || 'Operations',
    isActive: templateData.isActive !== undefined ? templateData.isActive : (existing?.isActive ?? true),
    createdBy: isNew ? (author.id || author.name || 'system') : (existing?.createdBy || 'system'),
    createdAt: isNew ? now : (existing?.createdAt || now),
    updatedAt: now,
    currentVersion: {
      id: versionData?.id || existing?.currentVersion?.id || `tver-${id}-${Date.now()}`,
      templateId: id,
      version: (existing?.currentVersion?.version || 0) + 1,
      isCurrent: true,
      fieldDefinitions: versionData?.fieldDefinitions || existing?.currentVersion?.fieldDefinitions || [],
      layoutConfig: versionData?.layoutConfig || existing?.currentVersion?.layoutConfig || { sections: [] },
      headerConfig: versionData?.headerConfig || existing?.currentVersion?.headerConfig || {},
      footerConfig: versionData?.footerConfig || existing?.currentVersion?.footerConfig || {},
      createdBy: author.id || author.name || 'system',
      createdAt: now,
    },
  };

  const idx = localTemplates.findIndex(t => t.id === id);
  if (idx >= 0) {
    localTemplates[idx] = storedItem;
  } else {
    localTemplates.unshift(storedItem);
  }
  writeLocalTemplates(localTemplates);

  // Sync to Supabase PostgreSQL (both dedicated ho_report_templates and legacy doc_builder)
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      // 1. Save to dedicated `ho_report_templates` table
      await supabase.from(TABLE_HO_TEMPLATES).upsert({
        id: storedItem.id,
        name: storedItem.name,
        description: storedItem.description,
        category: storedItem.category,
        is_active: storedItem.isActive,
        current_version: storedItem.currentVersion.version,
        field_definitions: storedItem.currentVersion.fieldDefinitions,
        layout_config: storedItem.currentVersion.layoutConfig,
        header_config: storedItem.currentVersion.headerConfig,
        footer_config: storedItem.currentVersion.footerConfig,
        created_by: storedItem.createdBy,
        data: storedItem,
        created_at: storedItem.createdAt,
        updated_at: storedItem.updatedAt,
      });
    } catch (_) {}

    try {
      // 2. Also save to `doc_builder` for dual-persistence fallback
      await supabase.from(TABLE_LEGACY_DOC_BUILDER).upsert({
        id: storedItem.id,
        record_type: 'template',
        template_id: storedItem.id,
        site: 'All Sites',
        title: storedItem.name,
        category: storedItem.category,
        status: storedItem.isActive ? 'active' : 'inactive',
        data: storedItem,
        created_by: storedItem.createdBy,
        created_at: storedItem.createdAt,
        updated_at: storedItem.updatedAt,
      });
    } catch (_) {}
  }

  await recordAudit({
    templateId: id,
    action: isNew ? 'TEMPLATE_CREATED' : 'TEMPLATE_UPDATED',
    userId: author.id || 'system',
    userName: author.name || 'Admin',
    userRole: author.role || 'Admin',
    userEmail: author.email,
    details: `${isNew ? 'Created' : 'Updated'} master HO template: "${storedItem.name}"`,
  });

  return storedItem;
}

export async function deleteTemplate(
  templateId: string,
  author: { id?: string; name?: string; role?: string; email?: string }
): Promise<boolean> {
  const localTemplates = readLocalTemplates();
  const target = localTemplates.find(t => t.id === templateId);
  if (!target) return false;

  target.isActive = false;
  target.updatedAt = new Date().toISOString();
  writeLocalTemplates(localTemplates);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from(TABLE_HO_TEMPLATES).update({ is_active: false }).eq('id', templateId);
    } catch (_) {}
    try {
      await supabase.from(TABLE_LEGACY_DOC_BUILDER).update({ status: 'inactive' }).eq('id', templateId);
    } catch (_) {}
  }

  await recordAudit({
    templateId,
    action: 'TEMPLATE_DELETED',
    userId: author.id || 'system',
    userName: author.name || 'Admin',
    userRole: author.role || 'Admin',
    userEmail: author.email,
    details: `Deactivated HO template: "${target.name}"`,
  });

  return true;
}

// ----------------------------------------------------------------------------
// 2. GENERATED RECORDS (ho_report_records)
// ----------------------------------------------------------------------------

export async function getRecords(siteFilter?: string): Promise<StoredRecord[]> {
  const localRecords = readLocalRecords();

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!siteFilter || siteFilter === 'All Sites') return localRecords;
    return localRecords.filter(r => r.site === siteFilter);
  }

  try {
    // 1. First attempt to query dedicated `ho_report_records` table
    let query = supabase
      .from(TABLE_HO_RECORDS)
      .select('*')
      .order('updated_at', { ascending: false });

    if (siteFilter && siteFilter !== 'All Sites') {
      query = query.eq('site', siteFilter);
    }

    const { data: dbRecords, error: dedicatedErr } = await query;

    if (!dedicatedErr && dbRecords && dbRecords.length > 0) {
      const cleanRecords: StoredRecord[] = dbRecords
        .filter((r: any) => !r.id?.includes('rasul') && !r.id?.includes('741001'))
        .map((r: any) => {
          if (r.data && r.data.title) return r.data as StoredRecord;
          return {
            id: r.id,
            templateId: r.template_id || '',
            site: r.site,
            title: r.title,
            documentNumber: r.document_number || '',
            category: r.category || 'General',
            status: r.status || 'draft',
            preparedFormat: r.prepared_format || null,
            docxUrl: r.docx_url || null,
            pdfUrl: r.pdf_url || null,
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

      writeLocalRecords(cleanRecords);
      return cleanRecords;
    }

    // 2. Fallback to `doc_builder` where record_type = 'document'
    let legacyQuery = supabase
      .from(TABLE_LEGACY_DOC_BUILDER)
      .select('*')
      .eq('record_type', 'document')
      .neq('id', 'doc-incident-rasul-741')
      .order('updated_at', { ascending: false });

    if (siteFilter && siteFilter !== 'All Sites') {
      legacyQuery = legacyQuery.eq('site', siteFilter);
    }

    const { data: legacyRows, error: legacyErr } = await legacyQuery;

    if (!legacyErr && legacyRows && legacyRows.length > 0) {
      const cleanRecords: StoredRecord[] = legacyRows
        .filter((r: any) => !r.id?.includes('rasul') && !r.id?.includes('741001'))
        .map((r: any) => {
          if (r.data && r.data.title) return r.data as StoredRecord;
          return {
            id: r.id,
            templateId: r.template_id || '',
            site: r.site,
            title: r.title,
            documentNumber: r.document_number || '',
            status: r.status || 'draft',
            fieldValues: r.field_values || {},
            fieldDefinitions: r.data?.fieldDefinitions,
            layoutConfig: r.data?.layoutConfig,
            headerConfig: r.data?.headerConfig,
            footerConfig: r.data?.footerConfig,
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

      writeLocalRecords(cleanRecords);
      return cleanRecords;
    }

    if (!siteFilter || siteFilter === 'All Sites') return localRecords;
    return localRecords.filter(r => r.site === siteFilter);
  } catch (err) {
    if (!siteFilter || siteFilter === 'All Sites') return localRecords;
    return localRecords.filter(r => r.site === siteFilter);
  }
}

export async function getRecordById(id: string): Promise<StoredRecord | null> {
  const records = await getRecords();
  return records.find(r => r.id === id) || null;
}

export async function saveRecord(
  data: Partial<StoredRecord>,
  author: { id?: string; name?: string; role?: string; email?: string }
): Promise<StoredRecord> {
  const localRecords = readLocalRecords();
  const now = new Date().toISOString();

  let id = data.id;
  const isNew = !id || !localRecords.some(r => r.id === id);

  if (isNew) {
    id = `dbr-${crypto.randomUUID().slice(0, 8)}`;
  }

  const existingRecord = localRecords.find(r => r.id === id);

  const stored: StoredRecord = {
    id: id!,
    templateId: data.templateId || existingRecord?.templateId || '',
    templateVersionId: data.templateVersionId || existingRecord?.templateVersionId,
    site: data.site || existingRecord?.site || 'Site A',
    title: data.title || existingRecord?.title || 'Untitled Document',
    documentNumber: data.documentNumber || existingRecord?.documentNumber || `DOC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    category: data.category || existingRecord?.category || 'General',
    status: data.status || existingRecord?.status || 'draft',
    preparedFormat: data.preparedFormat || existingRecord?.preparedFormat || null,
    docxUrl: data.docxUrl || existingRecord?.docxUrl || null,
    pdfUrl: data.pdfUrl || existingRecord?.pdfUrl || null,
    fieldValues: data.fieldValues || existingRecord?.fieldValues || {},
    fieldDefinitions: data.fieldDefinitions || existingRecord?.fieldDefinitions,
    layoutConfig: data.layoutConfig || existingRecord?.layoutConfig,
    headerConfig: data.headerConfig || existingRecord?.headerConfig,
    footerConfig: data.footerConfig || existingRecord?.footerConfig,
    createdBy: isNew ? (author.id || author.email || '') : (existingRecord?.createdBy || ''),
    createdByName: isNew ? (author.name || 'Staff') : (existingRecord?.createdByName || 'Staff'),
    createdByRole: isNew ? (author.role || 'Staff') : (existingRecord?.createdByRole || 'Staff'),
    createdByEmail: isNew ? (author.email || '') : (existingRecord?.createdByEmail || ''),
    updatedBy: author.id || author.email || '',
    updatedByName: author.name || 'Staff',
    updatedByRole: author.role || 'Staff',
    createdAt: isNew ? now : (existingRecord?.createdAt || now),
    updatedAt: now,
    finalizedAt: data.status === 'final' ? now : existingRecord?.finalizedAt,
    finalizedBy: data.status === 'final' ? (author.name || author.email) : existingRecord?.finalizedBy,
  };

  const idx = localRecords.findIndex(r => r.id === id);
  if (idx >= 0) {
    localRecords[idx] = stored;
  } else {
    localRecords.unshift(stored);
  }
  writeLocalRecords(localRecords);

  // Sync to Supabase PostgreSQL (both dedicated ho_report_records and legacy doc_builder)
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      // 1. Dedicated `ho_report_records` table
      await supabase.from(TABLE_HO_RECORDS).upsert({
        id: stored.id,
        template_id: stored.templateId,
        site: stored.site,
        title: stored.title,
        document_number: stored.documentNumber,
        category: stored.category || 'General',
        status: stored.status,
        prepared_format: stored.preparedFormat,
        docx_url: stored.docxUrl,
        pdf_url: stored.pdfUrl,
        field_values: stored.fieldValues,
        field_definitions: stored.fieldDefinitions || [],
        layout_config: stored.layoutConfig || {},
        header_config: stored.headerConfig || {},
        footer_config: stored.footerConfig || {},
        created_by: stored.createdBy,
        created_by_name: stored.createdByName,
        created_by_role: stored.createdByRole,
        created_by_email: stored.createdByEmail,
        updated_by: stored.updatedBy,
        updated_by_name: stored.updatedByName,
        updated_by_role: stored.updatedByRole,
        finalized_at: stored.finalizedAt,
        finalized_by: stored.finalizedBy,
        data: stored,
        created_at: stored.createdAt,
        updated_at: stored.updatedAt,
      });
    } catch (_) {}

    try {
      // 2. Legacy `doc_builder` table for dual-persistence fallback
      await supabase.from(TABLE_LEGACY_DOC_BUILDER).upsert({
        id: stored.id,
        record_type: 'document',
        template_id: stored.templateId,
        site: stored.site,
        title: stored.title,
        document_number: stored.documentNumber,
        status: stored.status,
        field_values: stored.fieldValues,
        created_by: stored.createdBy,
        created_by_name: stored.createdByName,
        created_by_role: stored.createdByRole,
        created_by_email: stored.createdByEmail,
        updated_by: stored.updatedBy,
        updated_by_name: stored.updatedByName,
        updated_by_role: stored.updatedByRole,
        finalized_at: stored.finalizedAt,
        finalized_by: stored.finalizedBy,
        data: stored,
        created_at: stored.createdAt,
        updated_at: stored.updatedAt,
      });
    } catch (_) {}
  }

  await recordAudit({
    documentId: stored.id,
    templateId: stored.templateId,
    action: isNew ? 'DOCUMENT_CREATED' : (data.status === 'final' ? 'DOCUMENT_FINALIZED' : 'DOCUMENT_UPDATED'),
    userId: author.id || 'system',
    userName: author.name || 'Staff',
    userRole: author.role || 'Staff',
    userEmail: author.email,
    site: stored.site,
    details: `${isNew ? 'Created' : 'Updated'} report: "${stored.title}" (${stored.documentNumber})`,
  });

  return stored;
}

export async function updateRecordPreparedFormat(
  id: string,
  format: 'docx' | 'pdf'
): Promise<void> {
  const localRecords = readLocalRecords();
  const target = localRecords.find(r => r.id === id);
  if (!target) return;

  const current = target.preparedFormat;
  let nextFormat: 'docx' | 'pdf' | 'both' = format;
  if (current && current !== format) {
    nextFormat = 'both';
  }

  target.preparedFormat = nextFormat;
  target.updatedAt = new Date().toISOString();
  writeLocalRecords(localRecords);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from(TABLE_HO_RECORDS).update({
        prepared_format: nextFormat,
        updated_at: target.updatedAt,
      }).eq('id', id);
    } catch (_) {}

    try {
      await supabase.from(TABLE_LEGACY_DOC_BUILDER).update({
        updated_at: target.updatedAt,
      }).eq('id', id);
    } catch (_) {}
  }
}

export async function deleteRecord(
  id: string,
  author: { id?: string; name?: string; role?: string; email?: string }
): Promise<boolean> {
  const localRecords = readLocalRecords();
  const target = localRecords.find(r => r.id === id);
  if (!target) return false;

  const updatedRecords = localRecords.filter(r => r.id !== id);
  writeLocalRecords(updatedRecords);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from(TABLE_HO_RECORDS).delete().eq('id', id);
    } catch (_) {}
    try {
      await supabase.from(TABLE_LEGACY_DOC_BUILDER).delete().eq('id', id);
    } catch (_) {}
  }

  await recordAudit({
    documentId: id,
    templateId: target.templateId,
    action: 'DOCUMENT_DELETED',
    userId: author.id || 'system',
    userName: author.name || 'Staff',
    userRole: author.role || 'Staff',
    userEmail: author.email,
    site: target.site,
    details: `Deleted report: "${target.title}"`,
  });

  return true;
}

// ----------------------------------------------------------------------------
// 3. AUDIT LOGS (ho_report_audit_logs — Segregated Table)
// ----------------------------------------------------------------------------

export async function recordAudit(params: {
  documentId?: string;
  templateId?: string;
  action: string;
  userId: string;
  userName: string;
  userRole: string;
  userEmail?: string;
  site?: string;
  details: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const localAudits = readLocalAuditLogs();
  const now = new Date().toISOString();
  const logId = `aud-${crypto.randomUUID().slice(0, 10)}`;

  const logEntry: StoredAuditLog = {
    id: logId,
    documentId: params.documentId,
    templateId: params.templateId,
    action: params.action,
    userId: params.userId,
    userName: params.userName,
    userRole: params.userRole,
    userEmail: params.userEmail,
    site: params.site,
    details: params.details,
    metadata: params.metadata,
    timestamp: now,
  };

  localAudits.unshift(logEntry);
  writeLocalAuditLogs(localAudits);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      // 1. Insert into dedicated `ho_report_audit_logs` table
      await supabase.from(TABLE_HO_AUDIT).insert({
        id: logEntry.id,
        record_id: logEntry.documentId || null,
        template_id: logEntry.templateId || null,
        action: logEntry.action,
        user_id: logEntry.userId,
        user_name: logEntry.userName,
        user_role: logEntry.userRole,
        user_email: logEntry.userEmail,
        site: logEntry.site || 'All Sites',
        details: logEntry.details,
        created_at: now,
      });
    } catch (_) {}

    try {
      // 2. Also insert into `doc_builder` for dual persistence
      await supabase.from(TABLE_LEGACY_DOC_BUILDER).insert({
        id: logEntry.id,
        record_type: 'audit',
        template_id: logEntry.documentId || logEntry.templateId,
        site: logEntry.site || 'All Sites',
        title: logEntry.action,
        status: 'logged',
        data: logEntry,
        created_by: logEntry.userId,
        created_by_name: logEntry.userName,
        created_by_role: logEntry.userRole,
        created_by_email: logEntry.userEmail,
        created_at: now,
        updated_at: now,
      });
    } catch (_) {}
  }
}

export async function getAuditLogs(documentId?: string): Promise<StoredAuditLog[]> {
  const localAudits = readLocalAuditLogs();

  if (documentId) {
    const filtered = localAudits.filter(l => l.documentId === documentId || l.templateId === documentId);
    if (filtered.length > 0) return filtered;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return documentId ? localAudits.filter(l => l.documentId === documentId || l.templateId === documentId) : localAudits;
  }

  try {
    // 1. Try querying dedicated `ho_report_audit_logs` table
    let query = supabase.from(TABLE_HO_AUDIT).select('*').order('created_at', { ascending: false });
    if (documentId) {
      query = query.or(`record_id.eq.${documentId},template_id.eq.${documentId}`);
    }
    const { data: dbAudits, error } = await query;
    if (!error && dbAudits && dbAudits.length > 0) {
      return dbAudits.map((r: any) => ({
        id: r.id,
        documentId: r.record_id,
        templateId: r.template_id,
        action: r.action,
        userId: r.user_id,
        userName: r.user_name,
        userRole: r.user_role,
        userEmail: r.user_email,
        site: r.site,
        details: r.details,
        timestamp: r.created_at,
      }));
    }

    // 2. Fallback to `doc_builder` where record_type = 'audit'
    let legacyQuery = supabase.from(TABLE_LEGACY_DOC_BUILDER).select('*').eq('record_type', 'audit').order('created_at', { ascending: false });
    if (documentId) {
      legacyQuery = legacyQuery.eq('template_id', documentId);
    }
    const { data: legacyAudits } = await legacyQuery;
    if (legacyAudits && legacyAudits.length > 0) {
      return legacyAudits.map((r: any) => r.data as StoredAuditLog);
    }
  } catch (_) {}

  return documentId ? localAudits.filter(l => l.documentId === documentId || l.templateId === documentId) : localAudits;
}
