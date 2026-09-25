/**
 * Document Builder API Routes
 *
 * Template management, drag-and-drop block building, DOCX/PDF import,
 * document drafts CRUD, DOCX/PDF export, strict RBAC, and audit trails.
 * Mounted at /api/document-builder in server/index.ts.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireRole } from '../middleware/requireAuth.js';
import { generateDocx } from './documentBuilderDocx.js';
import { generatePdf } from './documentBuilderPdf.js';
import {
  getTemplates,
  getTemplateById,
  saveTemplate,
  deleteTemplate,
  getRecords,
  getRecordById,
  saveRecord,
  deleteRecord,
  recordAudit,
  getAuditLogs,
} from './documentBuilderStorage.js';

const router = Router();

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
    site: (req.headers['x-user-site'] as string) || u?.assignedSite || 'All Sites',
  };
}

const ADMIN_ROLES = new Set(['Super Admin', 'Admin', 'Regional Manager', 'Operations Manager']);

function isManagerOrAdmin(role: string): boolean {
  return ADMIN_ROLES.has(role);
}

// ---------------------------------------------------------------------------
// GET /templates — list active templates with current version
// ---------------------------------------------------------------------------

router.get('/templates', async (_req: Request, res: Response) => {
  try {
    const templates = await getTemplates();
    res.json({ success: true, data: templates });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET /templates error:', err.message);
    // Never fail: return storage templates
    const fallback = await getTemplates();
    res.json({ success: true, data: fallback });
  }
});

// ---------------------------------------------------------------------------
// GET /templates/:id — get single template with version
// ---------------------------------------------------------------------------

router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data: template });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET /templates/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load template' });
  }
});

// ---------------------------------------------------------------------------
// GET /templates/:id/fields — get field definitions for template
// ---------------------------------------------------------------------------

router.get('/templates/:id/fields', async (req: Request, res: Response) => {
  try {
    const template = await getTemplateById(req.params.id);
    if (!template || !template.currentVersion) {
      return res.status(404).json({ success: false, error: 'Template version not found' });
    }
    res.json({ success: true, data: template.currentVersion });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET /templates/:id/fields error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load template fields' });
  }
});

// ---------------------------------------------------------------------------
// POST /templates — create new template (RBAC: Admin / Manager)
// ---------------------------------------------------------------------------

router.post('/templates', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  if (!isManagerOrAdmin(author.role)) {
    return res.status(403).json({ success: false, error: 'Only Administrators and Managers can create document templates' });
  }

  const { template, version } = req.body;
  if (!template?.name) {
    return res.status(400).json({ success: false, error: 'Template name is required' });
  }

  try {
    const saved = await saveTemplate(template, version, author);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    console.error('[DocumentBuilder] POST /templates error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
});

// ---------------------------------------------------------------------------
// PUT /templates/:id — update template & version (RBAC: Admin / Manager)
// ---------------------------------------------------------------------------

router.put('/templates/:id', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  if (!isManagerOrAdmin(author.role)) {
    return res.status(403).json({ success: false, error: 'Only Administrators and Managers can edit document templates' });
  }

  const { template, version } = req.body;
  try {
    const existing = await getTemplateById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const templateData = template || req.body.templateData || req.body;
    const versionData = version || req.body.versionData || req.body.currentVersion || existing.currentVersion;

    const updated = await saveTemplate(
      { ...existing, ...templateData, id: req.params.id },
      versionData,
      author
    );
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[DocumentBuilder] PUT /templates/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /templates/:id — deactivate template (RBAC: Admin only)
// ---------------------------------------------------------------------------

router.delete('/templates/:id', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  if (!isManagerOrAdmin(author.role)) {
    return res.status(403).json({ success: false, error: 'Only Administrators can delete document templates' });
  }

  try {
    const success = await deleteTemplate(req.params.id, author);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DocumentBuilder] DELETE /templates/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
});

// ---------------------------------------------------------------------------
// POST /templates/import — import parsed template from DOCX or PDF
// ---------------------------------------------------------------------------

router.post('/templates/import', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  if (!isManagerOrAdmin(author.role)) {
    return res.status(403).json({ success: false, error: 'Only Administrators and Managers can import document templates' });
  }

  const { name, category, description, fieldDefinitions, layoutConfig, headerConfig, footerConfig } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Template name is required' });
  }

  try {
    const saved = await saveTemplate(
      {
        name,
        category: category || 'General',
        description: description || 'Imported document template',
        isActive: true,
      },
      {
        fieldDefinitions: fieldDefinitions || [],
        layoutConfig: layoutConfig || { sections: [{ id: 'sec-main', title: 'Main Section', order: 1, columns: 1 }] },
        headerConfig: headerConfig || { showLogo: true, showCompanyName: true, showDate: true },
        footerConfig: footerConfig || { showPageNumbers: true, showGeneratedTimestamp: true },
      },
      author
    );

    await recordAudit({
      templateId: saved.id,
      action: 'TEMPLATE_IMPORTED',
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      userEmail: author.email,
      details: `Imported template: "${saved.name}" with ${fieldDefinitions?.length || 0} fields`,
    });

    res.json({ success: true, data: saved });
  } catch (err: any) {
    console.error('[DocumentBuilder] POST /templates/import error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to import template' });
  }
});

// ---------------------------------------------------------------------------
// GET /records — list document records with RBAC site filtering
// ---------------------------------------------------------------------------

router.get('/records', async (req: Request, res: Response) => {
  const user = getUserIdentity(req);

  try {
    let siteFilter: string | undefined = undefined;
    if (!isManagerOrAdmin(user.role)) {
      if (user.site && user.site !== 'All Sites') {
        siteFilter = user.site;
      }
    }

    const records = await getRecords(siteFilter);
    res.json({ success: true, data: records });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET /records error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load records' });
  }
});

// ---------------------------------------------------------------------------
// GET /records/:id — get single document record
// ---------------------------------------------------------------------------

router.get('/records/:id', async (req: Request, res: Response) => {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Document record not found' });
    }
    res.json({ success: true, data: record });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET /records/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load document' });
  }
});

// ---------------------------------------------------------------------------
// POST /records — save a new document draft (Any authenticated role)
// ---------------------------------------------------------------------------

router.post('/records', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  const { templateId, templateVersionId, site, title, fieldValues, status } = req.body;

  if (!templateId || !site || !title) {
    return res.status(400).json({ success: false, error: 'templateId, site, and title are required' });
  }

  try {
    const saved = await saveRecord({
      templateId,
      templateVersionId,
      site,
      title,
      fieldValues: fieldValues || {},
      status: status || 'draft',
    }, author);

    res.json({ success: true, data: saved });
  } catch (err: any) {
    console.error('[DocumentBuilder] POST /records error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save document' });
  }
});

// ---------------------------------------------------------------------------
// PUT /records/:id — update an existing draft (Strict RBAC: owner or admin)
// ---------------------------------------------------------------------------

router.put('/records/:id', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);

  try {
    const existing = await getRecordById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // RBAC: Non-admin can only edit their own draft, or records for their assigned site
    if (!isManagerOrAdmin(author.role)) {
      if (existing.createdBy && existing.createdBy !== author.id && existing.createdBy !== author.email) {
        if (author.site && author.site !== 'All Sites' && existing.site !== author.site) {
          return res.status(403).json({ success: false, error: 'You do not have permission to edit this document' });
        }
      }
    }

    const updated = await saveRecord({
      ...existing,
      ...req.body,
      id: req.params.id,
    }, author);

    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[DocumentBuilder] PUT /records/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update record' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /records/:id — delete document (Strict RBAC)
// ---------------------------------------------------------------------------

router.delete('/records/:id', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);

  try {
    const existing = await getRecordById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Strict RBAC: finalized records can only be deleted by Admin/Super Admin
    if (existing.status === 'final' && !isManagerOrAdmin(author.role)) {
      return res.status(403).json({ success: false, error: 'Only Administrators can delete finalized documents' });
    }

    // Non-admin can only delete their own draft
    if (!isManagerOrAdmin(author.role)) {
      if (existing.createdBy && existing.createdBy !== author.id && existing.createdBy !== author.email) {
        return res.status(403).json({ success: false, error: 'You can only delete your own draft documents' });
      }
    }

    const success = await deleteRecord(req.params.id, author);
    res.json({ success });
  } catch (err: any) {
    console.error('[DocumentBuilder] DELETE /records/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

// ---------------------------------------------------------------------------
// GET /records/:id/audit — get document audit trail
// ---------------------------------------------------------------------------

router.get('/records/:id/audit', async (req: Request, res: Response) => {
  try {
    const logs = await getAuditLogs(req.params.id);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET audit logs error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load audit logs' });
  }
});

// ---------------------------------------------------------------------------
// GET /audit-logs — get all audit logs (Admin/Manager only)
// ---------------------------------------------------------------------------

router.get('/audit-logs', async (req: Request, res: Response) => {
  const author = getUserIdentity(req);
  if (!isManagerOrAdmin(author.role)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  try {
    const logs = await getAuditLogs();
    res.json({ success: true, data: logs });
  } catch (err: any) {
    console.error('[DocumentBuilder] GET global audit logs error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load audit logs' });
  }
});

// ---------------------------------------------------------------------------
// POST /records/:id/generate/:format — generate DOCX or PDF
// ---------------------------------------------------------------------------

router.post('/records/:id/generate/:format', async (req: Request, res: Response) => {
  const { id, format } = req.params;
  const author = getUserIdentity(req);

  if (format !== 'docx' && format !== 'pdf') {
    return res.status(400).json({ success: false, error: 'Format must be docx or pdf' });
  }

  const record = await getRecordById(id);
  if (!record) {
    return res.status(404).json({ success: false, error: 'Document record not found' });
  }

  // Load template version
  const template = await getTemplateById(record.templateId);
  const templateVersion = template?.currentVersion;

  if (!templateVersion) {
    return res.status(404).json({ success: false, error: 'Template version not found for document' });
  }

  try {
    const docData = {
      title: record.title,
      documentNumber: record.documentNumber || '',
      site: record.site,
      fieldValues: record.fieldValues || {},
      templateName: template?.name || 'Document',
      fieldDefinitions: templateVersion.fieldDefinitions || [],
      layoutConfig: templateVersion.layoutConfig || {},
      headerConfig: templateVersion.headerConfig || {},
      footerConfig: templateVersion.footerConfig || {},
      createdByName: record.createdByName || author.name,
      createdAt: record.createdAt,
    };

    // Log the download action in audit trail
    await recordAudit({
      documentId: record.id,
      templateId: record.templateId,
      action: format === 'docx' ? 'DOCX_EXPORTED' : 'PDF_EXPORTED',
      userId: author.id,
      userName: author.name,
      userRole: author.role,
      userEmail: author.email,
      site: record.site,
      details: `Generated and exported ${format.toUpperCase()} for "${record.title}" (${record.documentNumber})`,
    });

    if (format === 'docx') {
      const buffer = await generateDocx(docData);
      const filename = `${record.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } else {
      const buffer = await generatePdf(docData);
      const filename = `${record.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    }
  } catch (err: any) {
    console.error(`[DocumentBuilder] Generate ${format} error:`, err.message);
    res.status(500).json({ success: false, error: `Failed to generate ${format.toUpperCase()}` });
  }
});

export default router;
