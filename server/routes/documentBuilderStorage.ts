/**
 * Document Builder — Unified Storage Layer (Single Table: doc_builder)
 *
 * Saves ALL document builder data in ONE single table: `doc_builder`.
 * - record_type = 'template' -> Document Templates & versions
 * - record_type = 'document' -> Document Drafts & Finalized Records
 * - record_type = 'audit'    -> Compliance & RBAC Audit Event Logs
 *
 * Provides resilient dual-persistence:
 * 1. Supabase `doc_builder` table
 * 2. Local JSON store fallback in server/data/document_builder/
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdmin } from '../supabase.js';
import { SEED_TEMPLATES } from './documentBuilderSeed.js';

const DATA_DIR = path.join(process.cwd(), 'server', 'data', 'document_builder');
const UNIFIED_FILE = path.join(DATA_DIR, 'doc_builder.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalData(): StoredDocBuilderRow[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(UNIFIED_FILE)) {
      const defaults = getDefaultRows();
      fs.writeFileSync(UNIFIED_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
      return defaults;
    }
    const content = fs.readFileSync(UNIFIED_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultRows();
  } catch (err) {
    console.warn('[DocBuilderStorage] Error reading local doc_builder.json:', err);
    return getDefaultRows();
  }
}

function writeLocalData(data: StoredDocBuilderRow[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(UNIFIED_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DocBuilderStorage] Error writing local doc_builder.json:', err);
  }
}

export interface StoredDocBuilderRow {
  id: string;
  record_type: 'template' | 'document' | 'audit';
  template_id?: string;
  site: string;
  title: string;
  document_number?: string;
  category?: string;
  status: string;
  field_values?: Record<string, any>;
  created_by?: string;
  created_by_name?: string;
  created_by_role?: string;
  created_by_email?: string;
  updated_by?: string;
  updated_by_name?: string;
  updated_by_role?: string;
  finalized_at?: string;
  finalized_by?: string;
  data: any;
  created_at: string;
  updated_at: string;
}

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
  status: 'draft' | 'final' | 'archived';
  fieldValues: Record<string, any>;
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

function getDefaultRows(): StoredDocBuilderRow[] {
  const templateRows: StoredDocBuilderRow[] = SEED_TEMPLATES.map(s => {
    const tmpl: StoredTemplate = {
      ...s.template,
      currentVersion: s.version,
    };
    return {
      id: tmpl.id,
      record_type: 'template',
      template_id: tmpl.id,
      site: 'All Sites',
      title: tmpl.name,
      category: tmpl.category,
      status: 'active',
      data: tmpl,
      created_by: tmpl.createdBy,
      created_at: tmpl.createdAt,
      updated_at: tmpl.updatedAt,
    };
  });

  const incidentDoc: StoredDocBuilderRow = {
    id: 'doc-incident-rasul-741',
    record_type: 'document',
    template_id: 'tmpl-incident-report',
    site: '741- Clacton Pier Avenue',
    title: 'Incident Report — Removal of Soft Seating (Mohammed Kaw Rasul)',
    document_number: 'DOC-2026-741001',
    category: 'Operations',
    status: 'final',
    field_values: {
      propertyId: '741- Clacton Pier Avenue',
      personReporting: 'Rishi Begari',
      dateOfIncident: '2026-07-07',
      offenders: 'N/A',
      victims: 'Mohammed Kaw Rasul (MST/9157022)',
      witnesses: 'Welfare officer (Emeka Opara)',
      incidentDescription: "Removal of Soft Seating Following an OT Assessment.\n\nOn 07/07/2026, SU Mohammed Kaw Rasul (MST/9157022) had an Occupational Therapy (OT) appointment, during which an assessment was completed.\nFollowing the assessment, the OT recommended removing the soft chair from the SU's room to create additional space and support safe mobility.\nThe SU is a wheelchair user and has a profiling bed in his room.\nThe SU stated that he requires sufficient space to move around safely and uses either his wheelchair or profiling bed for seating.\nThe SU declined the soft chair, as it was not required and reduced the available space within the room.\nStaff removed the soft chair in line with the OT recommendation and the SU’s preference.\nThe SU was informed that soft seating can be provided again at any time should his needs or preferences change.",
      actionTaken: 'Staff informed the SU that the soft seating can be provided for him at any time if he requires it in future.',
      warningLetterIssued: 'N/A',
      warningLetterToWhom: 'N/A',
      safeguardingInformed: 'N/A',
      safeguardingWho: 'N/A',
      policeInvolved: 'N/A',
      policeCadRef: 'N/A',
      ambulanceInvolved: 'N/A',
      ambulanceCadRef: 'N/A',
      fireServiceInvolved: 'N/A',
      fireCadRef: 'N/A',
    },
    created_by: 'rishi.begari@sdcommercial.co.uk',
    created_by_name: 'Rishi Begari',
    created_by_role: 'Welfare Officer',
    created_by_email: 'rishi.begari@sdcommercial.co.uk',
    updated_by: 'rishi.begari@sdcommercial.co.uk',
    updated_by_name: 'Rishi Begari',
    updated_by_role: 'Welfare Officer',
    finalized_at: '2026-07-07T10:15:00.000Z',
    finalized_by: 'Rishi Begari',
    data: {
      id: 'doc-incident-rasul-741',
      templateId: 'tmpl-incident-report',
      site: '741- Clacton Pier Avenue',
      title: 'Incident Report — Removal of Soft Seating (Mohammed Kaw Rasul)',
      documentNumber: 'DOC-2026-741001',
      status: 'final',
      fieldValues: {
        propertyId: '741- Clacton Pier Avenue',
        personReporting: 'Rishi Begari',
        dateOfIncident: '2026-07-07',
        offenders: 'N/A',
        victims: 'Mohammed Kaw Rasul (MST/9157022)',
        witnesses: 'Welfare officer (Emeka Opara)',
        incidentDescription: "Removal of Soft Seating Following an OT Assessment.\n\nOn 07/07/2026, SU Mohammed Kaw Rasul (MST/9157022) had an Occupational Therapy (OT) appointment, during which an assessment was completed.\nFollowing the assessment, the OT recommended removing the soft chair from the SU's room to create additional space and support safe mobility.\nThe SU is a wheelchair user and has a profiling bed in his room.\nThe SU stated that he requires sufficient space to move around safely and uses either his wheelchair or profiling bed for seating.\nThe SU declined the soft chair, as it was not required and reduced the available space within the room.\nStaff removed the soft chair in line with the OT recommendation and the SU’s preference.\nThe SU was informed that soft seating can be provided again at any time should his needs or preferences change.",
        actionTaken: 'Staff informed the SU that the soft seating can be provided for him at any time if he requires it in future.',
        warningLetterIssued: 'N/A',
        warningLetterToWhom: 'N/A',
        safeguardingInformed: 'N/A',
        safeguardingWho: 'N/A',
        policeInvolved: 'N/A',
        policeCadRef: 'N/A',
        ambulanceInvolved: 'N/A',
        ambulanceCadRef: 'N/A',
        fireServiceInvolved: 'N/A',
        fireCadRef: 'N/A',
      },
      createdBy: 'rishi.begari@sdcommercial.co.uk',
      createdByName: 'Rishi Begari',
      createdByRole: 'Welfare Officer',
      createdByEmail: 'rishi.begari@sdcommercial.co.uk',
      updatedBy: 'rishi.begari@sdcommercial.co.uk',
      updatedByName: 'Rishi Begari',
      updatedByRole: 'Welfare Officer',
      createdAt: '2026-07-07T09:30:00.000Z',
      updatedAt: '2026-07-07T10:15:00.000Z',
      finalizedAt: '2026-07-07T10:15:00.000Z',
      finalizedBy: 'Rishi Begari',
    },
    created_at: '2026-07-07T09:30:00.000Z',
    updated_at: '2026-07-07T10:15:00.000Z',
  };

  return [...templateRows, incidentDoc];
}

// ============================================================================
// TEMPLATES (stored in doc_builder with record_type = 'template')
// ============================================================================

export async function getTemplates(): Promise<StoredTemplate[]> {
  const seedIncident = SEED_TEMPLATES.find(s => s.template.id === 'tmpl-incident-report');
  const localRows = readLocalData();
  let localTemplates: StoredTemplate[] = localRows
    .filter(r => r.record_type === 'template' && r.status !== 'inactive')
    .map(r => r.data as StoredTemplate);

  // Verify local template has official 19 fields
  const localIncident = localTemplates.find(t => t.id === 'tmpl-incident-report');
  if (localIncident && seedIncident && !localIncident.currentVersion?.fieldDefinitions?.some(f => f.name === 'personReporting')) {
    localIncident.currentVersion = seedIncident.version;
    localIncident.description = seedIncident.template.description;
    const rowIdx = localRows.findIndex(r => r.id === 'tmpl-incident-report' && r.record_type === 'template');
    if (rowIdx >= 0) {
      localRows[rowIdx].data = localIncident;
      writeLocalData(localRows);
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return localTemplates;

  try {
    const { data: dbRows, error } = await supabase
      .from('doc_builder')
      .select('*')
      .eq('record_type', 'template')
      .neq('status', 'inactive')
      .order('title');

    if (error || !dbRows || dbRows.length === 0) {
      return localTemplates;
    }

    const templates: StoredTemplate[] = dbRows.map((r: any) => {
      let t: StoredTemplate;
      if (r.data && r.data.name) {
        t = r.data as StoredTemplate;
      } else {
        t = {
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
      }

      // Ensure tmpl-incident-report always uses the official 19 UKVI/Clearsprings fields
      if (t.id === 'tmpl-incident-report' && seedIncident) {
        const hasOfficialFields = t.currentVersion?.fieldDefinitions?.some((f: any) => f.name === 'personReporting');
        if (!hasOfficialFields) {
          t = {
            ...seedIncident.template,
            currentVersion: seedIncident.version,
          };
          // Persist upgraded official fields back to Supabase
          (async () => {
            try {
              await supabase.from('doc_builder').upsert({
                id: t.id,
                record_type: 'template',
                template_id: t.id,
                site: 'All Sites',
                title: t.name,
                category: t.category,
                status: 'active',
                data: t,
                created_by: t.createdBy,
                created_at: t.createdAt,
                updated_at: new Date().toISOString(),
              });
              console.log('[DocBuilderStorage] Upgraded tmpl-incident-report to official 19 fields in Supabase');
            } catch (err) {
              console.warn('[DocBuilderStorage] Supabase incident report upgrade notice:', err);
            }
          })();
        }
      }

      return t;
    });

    // If incident report template wasn't in dbRows, add it from seed
    if (!templates.some(t => t.id === 'tmpl-incident-report') && seedIncident) {
      const officialIncident: StoredTemplate = {
        ...seedIncident.template,
        currentVersion: seedIncident.version,
      };
      templates.push(officialIncident);
      (async () => {
        try {
          await supabase.from('doc_builder').upsert({
            id: officialIncident.id,
            record_type: 'template',
            template_id: officialIncident.id,
            site: 'All Sites',
            title: officialIncident.name,
            category: officialIncident.category,
            status: 'active',
            data: officialIncident,
            created_by: officialIncident.createdBy,
            created_at: officialIncident.createdAt,
            updated_at: officialIncident.updatedAt,
          });
        } catch (err) {
          console.warn('[DocBuilderStorage] Supabase insert missing incident template notice:', err);
        }
      })();
    }

    return templates;
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
  const localRows = readLocalData();
  const now = new Date().toISOString();

  let templateId = templateData.id;
  const isNew = !templateId || !localRows.some(r => r.id === templateId && r.record_type === 'template');

  if (isNew) {
    templateId = templateId || `tmpl-${crypto.randomUUID().slice(0, 8)}`;
  }

  const existingRow = localRows.find(r => r.id === templateId && r.record_type === 'template');
  const existingVersion = existingRow?.data?.currentVersion?.version || 0;

  const newVersion = {
    id: `tver-${crypto.randomUUID().slice(0, 8)}`,
    templateId: templateId!,
    version: isNew ? 1 : existingVersion + 1,
    isCurrent: true,
    fieldDefinitions: versionData?.fieldDefinitions || [],
    layoutConfig: versionData?.layoutConfig || { sections: [] },
    headerConfig: versionData?.headerConfig || {},
    footerConfig: versionData?.footerConfig || {},
    createdBy: author.email || author.name || 'system',
    createdAt: now,
  };

  const storedItem: StoredTemplate = {
    id: templateId!,
    name: templateData.name || 'Untitled Template',
    description: templateData.description || '',
    category: templateData.category || 'General',
    isActive: templateData.isActive !== false,
    createdBy: isNew ? (author.email || author.name || 'system') : (existingRow?.created_by || 'system'),
    createdAt: isNew ? now : (existingRow?.created_at || now),
    updatedAt: now,
    currentVersion: newVersion,
  };

  const docBuilderRow: StoredDocBuilderRow = {
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
  };

  // Update local store
  const idx = localRows.findIndex(r => r.id === templateId && r.record_type === 'template');
  if (idx >= 0) {
    localRows[idx] = docBuilderRow;
  } else {
    localRows.push(docBuilderRow);
  }
  writeLocalData(localRows);

  // Sync to Supabase `doc_builder` table
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('doc_builder').upsert({
        id: docBuilderRow.id,
        record_type: docBuilderRow.record_type,
        template_id: docBuilderRow.template_id,
        site: docBuilderRow.site,
        title: docBuilderRow.title,
        category: docBuilderRow.category,
        status: docBuilderRow.status,
        data: docBuilderRow.data,
        created_by: docBuilderRow.created_by,
        created_at: docBuilderRow.created_at,
        updated_at: docBuilderRow.updated_at,
      });
    } catch (err) {
      console.warn('[DocBuilderStorage] Supabase saveTemplate sync warning:', err);
    }
  }

  // Audit
  await recordAudit({
    templateId: storedItem.id,
    action: isNew ? 'TEMPLATE_CREATED' : 'TEMPLATE_UPDATED',
    userId: author.id || 'system',
    userName: author.name || 'Admin',
    userRole: author.role || 'Admin',
    userEmail: author.email,
    details: `${isNew ? 'Created' : 'Updated'} template: "${storedItem.name}" in doc_builder`,
  });

  return storedItem;
}

export async function deleteTemplate(
  templateId: string,
  author: { id?: string; name?: string; role?: string; email?: string }
): Promise<boolean> {
  const localRows = readLocalData();
  const target = localRows.find(r => r.id === templateId && r.record_type === 'template');
  if (!target) return false;

  target.status = 'inactive';
  target.updated_at = new Date().toISOString();
  if (target.data) target.data.isActive = false;
  writeLocalData(localRows);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('doc_builder').update({ status: 'inactive' }).eq('id', templateId);
    } catch (err) {
      console.warn('[DocBuilderStorage] Supabase deleteTemplate warning:', err);
    }
  }

  await recordAudit({
    templateId,
    action: 'TEMPLATE_DELETED',
    userId: author.id || 'system',
    userName: author.name || 'Admin',
    userRole: author.role || 'Admin',
    userEmail: author.email,
    details: `Deactivated template: "${target.title}" in doc_builder`,
  });

  return true;
}

// ============================================================================
// DOCUMENTS / DRAFTS (stored in doc_builder with record_type = 'document')
// ============================================================================

export async function getRecords(siteFilter?: string): Promise<StoredRecord[]> {
  const localRows = readLocalData();
  const localRecords: StoredRecord[] = localRows
    .filter(r => r.record_type === 'document')
    .map(r => (r.data as StoredRecord) || {
      id: r.id,
      templateId: r.template_id || '',
      site: r.site,
      title: r.title,
      documentNumber: r.document_number || '',
      status: (r.status as any) || 'draft',
      fieldValues: r.field_values || {},
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
    });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!siteFilter || siteFilter === 'All Sites') return localRecords;
    return localRecords.filter(r => r.site === siteFilter);
  }

  try {
    let query = supabase
      .from('doc_builder')
      .select('*')
      .eq('record_type', 'document')
      .order('updated_at', { ascending: false });

    if (siteFilter && siteFilter !== 'All Sites') {
      query = query.eq('site', siteFilter);
    }

    const { data: dbRows, error } = await query;
    if (error || !dbRows || dbRows.length === 0) {
      if (!siteFilter || siteFilter === 'All Sites') return localRecords;
      return localRecords.filter(r => r.site === siteFilter);
    }

    return dbRows.map((r: any) => {
      if (r.data && r.data.title) return r.data as StoredRecord;
      return {
        id: r.id,
        templateId: r.template_id || '',
        site: r.site,
        title: r.title,
        documentNumber: r.document_number || '',
        status: r.status || 'draft',
        fieldValues: r.field_values || {},
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
  const localRows = readLocalData();
  const now = new Date().toISOString();

  let id = data.id;
  const isNew = !id || !localRows.some(r => r.id === id && r.record_type === 'document');

  if (isNew) {
    id = `dbr-${crypto.randomUUID().slice(0, 8)}`;
  }

  const existingRow = localRows.find(r => r.id === id && r.record_type === 'document');
  const existingRecord: StoredRecord | undefined = existingRow?.data;

  const stored: StoredRecord = {
    id: id!,
    templateId: data.templateId || existingRecord?.templateId || '',
    templateVersionId: data.templateVersionId || existingRecord?.templateVersionId,
    site: data.site || existingRecord?.site || 'Site A',
    title: data.title || existingRecord?.title || 'Untitled Document',
    documentNumber: data.documentNumber || existingRecord?.documentNumber || `DOC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    status: data.status || existingRecord?.status || 'draft',
    fieldValues: data.fieldValues || existingRecord?.fieldValues || {},
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

  const docBuilderRow: StoredDocBuilderRow = {
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
  };

  const idx = localRows.findIndex(r => r.id === id && r.record_type === 'document');
  if (idx >= 0) {
    localRows[idx] = docBuilderRow;
  } else {
    localRows.unshift(docBuilderRow);
  }
  writeLocalData(localRows);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('doc_builder').upsert({
        id: docBuilderRow.id,
        record_type: docBuilderRow.record_type,
        template_id: docBuilderRow.template_id,
        site: docBuilderRow.site,
        title: docBuilderRow.title,
        document_number: docBuilderRow.document_number,
        status: docBuilderRow.status,
        field_values: docBuilderRow.field_values,
        created_by: docBuilderRow.created_by,
        created_by_name: docBuilderRow.created_by_name,
        created_by_role: docBuilderRow.created_by_role,
        created_by_email: docBuilderRow.created_by_email,
        updated_by: docBuilderRow.updated_by,
        updated_by_name: docBuilderRow.updated_by_name,
        updated_by_role: docBuilderRow.updated_by_role,
        finalized_at: docBuilderRow.finalized_at,
        finalized_by: docBuilderRow.finalized_by,
        data: docBuilderRow.data,
        created_at: docBuilderRow.created_at,
        updated_at: docBuilderRow.updated_at,
      });
    } catch (err) {
      console.warn('[DocBuilderStorage] Supabase saveRecord warning:', err);
    }
  }

  // Audit
  await recordAudit({
    documentId: stored.id,
    templateId: stored.templateId,
    action: isNew ? 'DOCUMENT_CREATED' : (data.status === 'final' ? 'DOCUMENT_FINALIZED' : 'DOCUMENT_UPDATED'),
    userId: author.id || 'system',
    userName: author.name || 'Staff',
    userRole: author.role || 'Staff',
    userEmail: author.email,
    site: stored.site,
    details: `${isNew ? 'Created document' : 'Updated document'}: "${stored.title}" (${stored.documentNumber}) in doc_builder`,
  });

  return stored;
}

export async function deleteRecord(
  id: string,
  author: { id?: string; name?: string; role?: string; email?: string }
): Promise<boolean> {
  const localRows = readLocalData();
  const idx = localRows.findIndex(r => r.id === id && r.record_type === 'document');
  if (idx === -1) return false;

  const target = localRows[idx];
  localRows.splice(idx, 1);
  writeLocalData(localRows);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('doc_builder').delete().eq('id', id);
    } catch (err) {
      console.warn('[DocBuilderStorage] Supabase deleteRecord warning:', err);
    }
  }

  await recordAudit({
    documentId: id,
    templateId: target.template_id,
    action: 'DOCUMENT_DELETED',
    userId: author.id || 'system',
    userName: author.name || 'Staff',
    userRole: author.role || 'Staff',
    userEmail: author.email,
    site: target.site,
    details: `Deleted document: "${target.title}" from doc_builder`,
  });

  return true;
}

// ============================================================================
// AUDIT LOGS (stored in doc_builder with record_type = 'audit')
// ============================================================================

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
  const localRows = readLocalData();
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

  const auditRow: StoredDocBuilderRow = {
    id: logId,
    record_type: 'audit',
    template_id: params.documentId || params.templateId,
    site: params.site || 'All Sites',
    title: params.action,
    status: 'logged',
    data: logEntry,
    created_by: params.userId,
    created_by_name: params.userName,
    created_by_role: params.userRole,
    created_by_email: params.userEmail,
    created_at: now,
    updated_at: now,
  };

  localRows.unshift(auditRow);
  if (localRows.length > 5000) localRows.length = 5000;
  writeLocalData(localRows);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      await supabase.from('doc_builder').insert({
        id: auditRow.id,
        record_type: auditRow.record_type,
        template_id: auditRow.template_id,
        site: auditRow.site,
        title: auditRow.title,
        status: auditRow.status,
        data: auditRow.data,
        created_by: auditRow.created_by,
        created_by_name: auditRow.created_by_name,
        created_by_role: auditRow.created_by_role,
        created_by_email: auditRow.created_by_email,
        created_at: auditRow.created_at,
        updated_at: auditRow.updated_at,
      });
    } catch (err) {
      // Non-blocking
    }
  }
}

export async function getAuditLogs(documentId?: string): Promise<StoredAuditLog[]> {
  const localRows = readLocalData();
  const logs: StoredAuditLog[] = localRows
    .filter(r => r.record_type === 'audit')
    .map(r => r.data as StoredAuditLog);

  if (documentId) {
    return logs.filter(l => l.documentId === documentId || l.templateId === documentId);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return logs;

  try {
    let query = supabase.from('doc_builder').select('*').eq('record_type', 'audit').order('created_at', { ascending: false });
    if (documentId) {
      query = query.eq('template_id', documentId);
    }
    const { data: dbRows } = await query;
    if (dbRows && dbRows.length > 0) {
      return dbRows.map((r: any) => r.data as StoredAuditLog);
    }
  } catch (err) {
    // fallback
  }

  return logs;
}
