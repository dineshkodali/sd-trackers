import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../server/supabase.js';
import { SEED_TEMPLATES } from '../server/routes/documentBuilderSeed.js';

const UNIFIED_FILE = path.join(process.cwd(), 'server', 'data', 'document_builder', 'doc_builder.json');

async function run() {
  console.log('[Seed] Updating doc_builder with official incident template and sample document...');

  const incidentSeed = SEED_TEMPLATES.find(t => t.template.id === 'tmpl-incident-report')!;

  const newDocId = 'doc-incident-rasul-741';
  const newDocNumber = 'DOC-2026-741001';
  const site = '741- Clacton Pier Avenue';
  const title = 'Incident Report — Removal of Soft Seating (Mohammed Kaw Rasul)';
  const authorName = 'Rishi Begari';
  const authorRole = 'Welfare Officer';
  const authorEmail = 'rishi.begari@sdcommercial.co.uk';
  const createdAt = '2026-07-07T09:30:00.000Z';
  const finalizedAt = '2026-07-07T10:15:00.000Z';

  const fieldValues = {
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
  };

  const storedRecord = {
    id: newDocId,
    templateId: 'tmpl-incident-report',
    templateVersionId: incidentSeed.version.id,
    site,
    title,
    documentNumber: newDocNumber,
    status: 'final',
    fieldValues,
    createdBy: authorEmail,
    createdByName: authorName,
    createdByRole: authorRole,
    createdByEmail: authorEmail,
    updatedBy: authorEmail,
    updatedByName: authorName,
    updatedByRole: authorRole,
    createdAt,
    updatedAt: finalizedAt,
    finalizedAt,
    finalizedBy: authorName,
  };

  const templateRow = {
    id: incidentSeed.template.id,
    record_type: 'template',
    template_id: incidentSeed.template.id,
    site: 'All Sites',
    title: incidentSeed.template.name,
    category: incidentSeed.template.category,
    status: 'active',
    data: {
      ...incidentSeed.template,
      currentVersion: incidentSeed.version,
    },
    created_by: 'system',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
  };

  const documentRow = {
    id: newDocId,
    record_type: 'document',
    template_id: 'tmpl-incident-report',
    site,
    title,
    document_number: newDocNumber,
    category: 'Operations',
    status: 'final',
    field_values: fieldValues,
    created_by: authorEmail,
    created_by_name: authorName,
    created_by_role: authorRole,
    created_by_email: authorEmail,
    updated_by: authorEmail,
    updated_by_name: authorName,
    updated_by_role: authorRole,
    finalized_at: finalizedAt,
    finalized_by: authorName,
    data: storedRecord,
    created_at: createdAt,
    updated_at: finalizedAt,
  };

  const auditRow1 = {
    id: `aud-${newDocId}-create`,
    record_type: 'audit',
    template_id: newDocId,
    site,
    title: 'DOCUMENT_CREATED',
    status: 'logged',
    data: {
      id: `aud-${newDocId}-create`,
      documentId: newDocId,
      templateId: 'tmpl-incident-report',
      action: 'DOCUMENT_CREATED',
      userId: authorEmail,
      userName: authorName,
      userRole: authorRole,
      userEmail: authorEmail,
      site,
      details: `Created document: "${title}" (${newDocNumber}) in doc_builder`,
      timestamp: createdAt,
    },
    created_by: authorEmail,
    created_by_name: authorName,
    created_by_role: authorRole,
    created_by_email: authorEmail,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const auditRow2 = {
    id: `aud-${newDocId}-final`,
    record_type: 'audit',
    template_id: newDocId,
    site,
    title: 'DOCUMENT_FINALIZED',
    status: 'logged',
    data: {
      id: `aud-${newDocId}-final`,
      documentId: newDocId,
      templateId: 'tmpl-incident-report',
      action: 'DOCUMENT_FINALIZED',
      userId: authorEmail,
      userName: authorName,
      userRole: authorRole,
      userEmail: authorEmail,
      site,
      details: `Finalized and signed document: "${title}" (${newDocNumber})`,
      timestamp: finalizedAt,
    },
    created_by: authorEmail,
    created_by_name: authorName,
    created_by_role: authorRole,
    created_by_email: authorEmail,
    created_at: finalizedAt,
    updated_at: finalizedAt,
  };

  // Read local file
  let localRows: any[] = [];
  if (fs.existsSync(UNIFIED_FILE)) {
    try {
      localRows = JSON.parse(fs.readFileSync(UNIFIED_FILE, 'utf8'));
    } catch (e) {
      localRows = [];
    }
  }

  // Update or insert template
  const tmplIdx = localRows.findIndex(r => r.id === incidentSeed.template.id && r.record_type === 'template');
  if (tmplIdx >= 0) {
    localRows[tmplIdx] = templateRow;
  } else {
    localRows.push(templateRow);
  }

  // Update or insert document
  const docIdx = localRows.findIndex(r => r.id === newDocId && r.record_type === 'document');
  if (docIdx >= 0) {
    localRows[docIdx] = documentRow;
  } else {
    localRows.unshift(documentRow); // top of list
  }

  // Add audit logs
  if (!localRows.some(r => r.id === auditRow1.id)) localRows.unshift(auditRow1);
  if (!localRows.some(r => r.id === auditRow2.id)) localRows.unshift(auditRow2);

  fs.writeFileSync(UNIFIED_FILE, JSON.stringify(localRows, null, 2), 'utf8');
  console.log(`[Seed] Successfully saved template, document (${newDocNumber}), and audit logs to ${UNIFIED_FILE}`);

  // Sync to Supabase
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      console.log('[Seed] Syncing to Supabase doc_builder table...');
      await supabase.from('doc_builder').upsert([templateRow, documentRow, auditRow1, auditRow2]);
      console.log('[Seed] Supabase sync completed.');
    } catch (dbErr) {
      console.warn('[Seed] Supabase sync skipped or failed (dual persistence preserved locally):', dbErr);
    }
  }

  console.log('[Seed] Done!');
}

run().catch(console.error);
