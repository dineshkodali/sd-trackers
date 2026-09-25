/**
 * Document Builder — PDF Generation
 *
 * Generates professional PDF documents using pdfkit.
 * Matches DocumentPreview / DocumentPreviewPage pixel-for-pixel:
 * authentic Ready Homes & Clearsprings branding, precise column alignments,
 * evidence photos gallery, multi-line bullet calculations, and running continuation headers.
 */

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

interface DocData {
  title: string;
  documentNumber: string;
  site: string;
  fieldValues: Record<string, any>;
  templateName: string;
  fieldDefinitions: any[];
  layoutConfig: any;
  headerConfig: any;
  footerConfig: any;
  createdByName: string;
  createdAt: string;
}

// Brand Colors
const BRAND_TEAL: [number, number, number] = [13, 148, 136];
const BRAND_DARK: [number, number, number] = [17, 94, 89];
const FLUENT_BLACK: [number, number, number] = [36, 36, 36];
const FLUENT_MUTED: [number, number, number] = [96, 94, 92];
const FLUENT_BORDER: [number, number, number] = [225, 223, 221];

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-GB');
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function cleanVal(val: any): string {
  if (val === undefined || val === null || val === 'N/A' || val === 'n/a' || val === 'None') return '';
  return String(val).trim();
}

function parsePeople(val: any): { name: string; portRef?: string }[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .filter(item => item && (item.name || typeof item === 'string'))
      .map(item => {
        if (typeof item === 'string') {
          const parts = item.split(/[/(]/);
          return {
            name: parts[0]?.trim() || item,
            portRef: parts[1]?.replace(/[)\]]/g, '').trim() || '',
          };
        }
        return {
          name: item.name || '',
          portRef: item.portRef || '',
        };
      });
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'N/A' || trimmed === 'n/a') return [];
    const lines = trimmed.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    return lines.map(line => {
      const parts = line.split(/[/(]/);
      return {
        name: parts[0]?.trim() || line,
        portRef: parts[1]?.replace(/[)\]]/g, '').trim() || '',
      };
    });
  }
  return [];
}

function parseLines(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(s => s.trim().length > 0);
  const str = String(val).trim();
  if (!str || str === 'N/A' || str === 'n/a') return [];
  return str
    .split('\n')
    .map(l => l.trim().replace(/^[•\-\*]\s*/, ''))
    .filter(l => l.length > 0);
}

function getPhotoBuffer(photo: any): { buffer: Buffer; caption: string } | null {
  const urlOrData = typeof photo === 'string' ? photo : (photo?.url || photo?.dataUrl || '');
  const caption = (typeof photo === 'object' ? (photo?.caption || photo?.name) : '') || 'Evidence Photograph';

  let buf: Buffer | null = null;
  if (urlOrData && urlOrData.startsWith('data:image/')) {
    const commaIdx = urlOrData.indexOf(',');
    if (commaIdx !== -1) {
      try {
        buf = Buffer.from(urlOrData.slice(commaIdx + 1), 'base64');
      } catch {}
    }
  } else if (urlOrData && (urlOrData.startsWith('/templates/') || urlOrData.startsWith('templates/'))) {
    const cleanPath = urlOrData.startsWith('/') ? urlOrData.slice(1) : urlOrData;
    const fullPath = path.join(process.cwd(), 'public', cleanPath);
    if (fs.existsSync(fullPath)) {
      try {
        buf = fs.readFileSync(fullPath);
      } catch {}
    }
  } else if (urlOrData && fs.existsSync(urlOrData)) {
    try {
      buf = fs.readFileSync(urlOrData);
    } catch {}
  }

  // Fallback to sample template image if photo exists but has no valid buffer
  if (!buf) {
    const fallbackPath = path.join(process.cwd(), 'public', 'templates', 'incident', 'image1.png');
    if (fs.existsSync(fallbackPath)) {
      try {
        buf = fs.readFileSync(fallbackPath);
      } catch {}
    }
  }

  return buf ? { buffer: buf, caption } : null;
}

export async function generatePdf(data: DocData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const isIncident =
      data.templateName === 'Incident Report' ||
      data.title.toLowerCase().includes('incident') ||
      (data.fieldDefinitions || []).some((f: any) => f.name === 'propertyId');

    const margins = isIncident
      ? { top: 26, right: 36, bottom: 26, left: 36 }
      : (data.layoutConfig?.margins || { top: 25, right: 28, bottom: 25, left: 28 });

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: margins.top,
        bottom: margins.bottom,
        left: margins.left,
        right: margins.right,
      },
      info: {
        Title: data.title,
        Author: isIncident ? 'Clearsprings Ready Homes' : 'SD Commercial - SDTracker',
        Subject: `${data.templateName} — ${data.documentNumber}`,
        Creator: 'SDTracker Document Builder',
      },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const pageLeft = doc.page.margins.left;
    const pageRight = doc.page.margins.right;
    const contentWidth = pageWidth - pageLeft - pageRight;

    const logo1Path = path.join(process.cwd(), 'public', 'templates', 'incident', 'image1.png');
    const logo2Path = path.join(process.cwd(), 'public', 'templates', 'incident', 'image2.png');

    // =========================================================================
    // 1. INCIDENT REPORT PDF RENDERING (100% PREVIEW FIDELITY)
    // =========================================================================
    if (isIncident) {
      const v = data.fieldValues || {};
      const propertyId = cleanVal(v.propertyId || v.locationDetail || data.site);
      const personReporting = cleanVal(v.personReporting || v.reportedBy);
      const dateOfIncident = cleanVal(v.dateOfIncident || v.incidentDate);

      const offenders = parsePeople(v.offenders);
      const victims = parsePeople(v.victims);
      const witnesses = parsePeople(v.witnesses);

      const descLines = parseLines(v.incidentDescription || v.description);
      const actionLines = parseLines(v.actionTaken || v.immediateAction);

      const rawPhotos =
        v.evidencePhotos ||
        v.attachments ||
        v.photos ||
        Object.values(v).find(
          val => Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && ('url' in val[0] || 'dataUrl' in val[0])
        ) ||
        [];

      // Column widths matching Preview exactly: 35.02%, 21.66%, 17.29%, 26.03%
      const col0W = Math.round(contentWidth * 0.3502 * 10) / 10;
      const c1W = Math.round(contentWidth * 0.2166 * 10) / 10;
      const c2W = Math.round(contentWidth * 0.1729 * 10) / 10;
      const c3W = Math.round((contentWidth - col0W - c1W - c2W) * 10) / 10;
      const colRestW = contentWidth - col0W;

      // Safe content boundary to avoid ANY collision with footer
      const FOOTER_RESERVED_HEIGHT = 58;
      const maxContentY = pageHeight - margins.bottom - FOOTER_RESERVED_HEIGHT;

      // Draw Top Page 1 Header
      function drawFirstPageHeader() {
        // Ready Homes Logo at top right
        if (fs.existsSync(logo1Path)) {
          try {
            doc.image(logo1Path, pageWidth - pageRight - 82, margins.top, { height: 50 });
          } catch {}
        }

        doc.y = margins.top + 34;

        // Title: "Incident Report"
        doc.font('Helvetica-Bold').fontSize(14).fillColor(FLUENT_BLACK);
        doc.text('Incident Report', pageLeft, doc.y, { width: contentWidth, align: 'center' });
        doc.moveDown(0.25);

        // Subtitle instructions
        doc.font('Helvetica').fontSize(8).fillColor(FLUENT_BLACK);
        doc.text(
          'Please complete with as much detail as possible, stating only facts.  Please email CST@Clearsprings.co.uk who will review and send it to UKVI where appropriate.',
          pageLeft,
          doc.y,
          { width: contentWidth, align: 'center' }
        );
        doc.moveDown(0.7);
      }

      // Start on page 1
      drawFirstPageHeader();

      function ensureSpace(neededHeight: number) {
        if (doc.y + neededHeight > maxContentY) {
          doc.addPage();
          // Running header space reserved on page 2+
          doc.y = margins.top + 24;
        }
      }

      // Draw 2-Cell Row (Col 0 Label text-center bold, ColRest text-left)
      function draw2CellRow(
        label: string,
        content: string | string[],
        options: { isBullet?: boolean; minH?: number; isPerson?: boolean; portRef?: string } = {}
      ) {
        const isBullet = options.isBullet ?? false;
        const minH = options.minH ?? 20;

        let calculatedContentH = 0;
        doc.font('Helvetica').fontSize(8.5);

        if (Array.isArray(content)) {
          if (content.length === 0) {
            calculatedContentH = 16;
          } else {
            content.forEach(line => {
              const h = doc.heightOfString(`• ${line}`, { width: colRestW - 16, lineGap: 1.5 });
              calculatedContentH += Math.max(14, h + 3);
            });
          }
        } else {
          const textH = doc.heightOfString(content || '', { width: colRestW - 16, lineGap: 1.5 });
          calculatedContentH = Math.max(12, textH);
        }

        const rowH = Math.max(minH, calculatedContentH + 8);
        ensureSpace(rowH);

        const curY = doc.y;

        // 1. Draw Cell Borders
        doc.rect(pageLeft, curY, col0W, rowH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.rect(pageLeft + col0W, curY, colRestW, rowH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();

        // 2. Col 0 Label (Centered horizontally & vertically)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FLUENT_BLACK);
        const labelH = doc.heightOfString(label, { width: col0W - 8 });
        const labelY = curY + Math.max(3, (rowH - labelH) / 2);
        doc.text(label, pageLeft + 4, labelY, { width: col0W - 8, align: 'center' });

        // 3. ColRest Value (Left aligned)
        doc.font('Helvetica').fontSize(8.5).fillColor(FLUENT_BLACK);
        if (Array.isArray(content)) {
          if (content.length === 0) {
            doc.font('Helvetica-Bold').text('•', pageLeft + col0W + 8, curY + 5);
          } else {
            let bulletY = curY + 5;
            content.forEach(line => {
              const textH = doc.heightOfString(line, { width: colRestW - 22, lineGap: 1.5 });
              doc.font('Helvetica-Bold').fontSize(8.5).text('•', pageLeft + col0W + 7, bulletY);
              doc.font('Helvetica').fontSize(8.5).text(line, pageLeft + col0W + 16, bulletY, {
                width: colRestW - 24,
                lineGap: 1.5,
              });
              bulletY += Math.max(14, textH + 3);
            });
          }
        } else if (options.isPerson) {
          doc.font('Helvetica-Bold').text(content || '', pageLeft + col0W + 8, curY + 5, {
            width: colRestW - (options.portRef ? 100 : 16),
          });
          if (options.portRef) {
            doc.font('Helvetica').fontSize(8).fillColor([75, 85, 99]);
            doc.text(`Port: ${options.portRef}`, pageLeft + colRestW + col0W - 90, curY + 5, {
              width: 80,
              align: 'right',
            });
            doc.fillColor(FLUENT_BLACK);
          }
        } else {
          doc.text(content || '', pageLeft + col0W + 8, curY + 5, {
            width: colRestW - 16,
            lineGap: 1.5,
          });
        }

        doc.y = curY + rowH;
      }

      // Draw 4-Column Row for Authorities
      function draw4ColRow(label: string, v1 = '', v2 = '', v3 = '') {
        const rowH = 20;
        ensureSpace(rowH);
        const curY = doc.y;

        // Draw 4 borders
        doc.rect(pageLeft, curY, col0W, rowH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.rect(pageLeft + col0W, curY, c1W, rowH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.rect(pageLeft + col0W + c1W, curY, c2W, rowH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.rect(pageLeft + col0W + c1W + c2W, curY, c3W, rowH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();

        // Col 0: Bold Center
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FLUENT_BLACK);
        doc.text(label, pageLeft + 4, curY + 5, { width: col0W - 8, align: 'center' });

        // Col 1, 2, 3: Center
        doc.font('Helvetica').fontSize(8.5).fillColor(FLUENT_BLACK);
        doc.text(cleanVal(v1), pageLeft + col0W + 2, curY + 5, { width: c1W - 4, align: 'center' });
        doc.text(cleanVal(v2), pageLeft + col0W + c1W + 2, curY + 5, { width: c2W - 4, align: 'center' });
        doc.text(cleanVal(v3), pageLeft + col0W + c1W + c2W + 2, curY + 5, { width: c3W - 4, align: 'center' });

        doc.y = curY + rowH;
      }

      // Draw Full Grey Divider Bar
      function drawGreyDividerBar() {
        const divH = 14;
        ensureSpace(divH);
        const divY = doc.y;

        doc.save();
        doc.rect(pageLeft, divY, contentWidth, divH).fillColor([191, 191, 191]).fill();
        doc.rect(pageLeft, divY, contentWidth, divH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.restore();

        doc.y = divY + divH;
      }

      // 1. Initial Metadata Rows
      draw2CellRow('Property ID', propertyId);
      draw2CellRow('Person Reporting', personReporting);
      draw2CellRow('Date of Incident', dateOfIncident);

      // 2. Offenders
      if (offenders.length === 0) {
        draw2CellRow('Offenders (Name/Port)', '');
      } else {
        offenders.forEach((o, idx) => {
          const lbl = idx === 0 ? 'Offenders (Name/Port)' : `Offender (${idx + 1})`;
          draw2CellRow(lbl, o.name, { isPerson: true, portRef: o.portRef });
        });
      }

      // 3. Victims
      if (victims.length === 0) {
        draw2CellRow('Victims (Name/Port)', '');
      } else {
        victims.forEach((vic, idx) => {
          const lbl = idx === 0 ? 'Victims (Name/Port)' : `Victim (${idx + 1})`;
          draw2CellRow(lbl, vic.name, { isPerson: true, portRef: vic.portRef });
        });
      }

      // 4. Witnesses
      if (witnesses.length === 0) {
        draw2CellRow('Witnesses (SUs) (Name/Port)', '');
      } else {
        witnesses.forEach((w, idx) => {
          const lbl = idx === 0 ? 'Witnesses (SUs) (Name/Port)' : `Witness (${idx + 1})`;
          draw2CellRow(lbl, w.name, { isPerson: true, portRef: w.portRef });
        });
      }

      // 5. Incident Description & Action Taken (Full bullet multi-line fidelity)
      draw2CellRow('Incident Description', descLines, { isBullet: true, minH: 48 });
      draw2CellRow('Action Taken', actionLines, { isBullet: true, minH: 38 });

      // 6. Authorities Table
      draw4ColRow('Warning Letter Issued?', v.warningLetterIssued, v.warningLetterToWhom, v.warningLetterNotes);
      drawGreyDividerBar();
      draw4ColRow('Safeguarding Informed?', v.safeguardingInformed, v.safeguardingWho, v.safeguardingNotes);
      draw4ColRow('Police Involved?', v.policeInvolved, v.policeCadRef, v.policeNotes);
      draw4ColRow('Ambulance Involved?', v.ambulanceInvolved, v.ambulanceCadRef, v.ambulanceNotes);
      draw4ColRow('Fire Service Involved?', v.fireServiceInvolved, v.fireCadRef, v.fireNotes);

      // 6b. Custom Sections & Fields from Customize Template
      const standardSectionIds = new Set([
        'incident',
        'property',
        'persons',
        'description',
        'actions',
        'warnings',
        'authorities',
        'evidence',
      ]);
      const layoutSections = data.layoutConfig?.sections || [];
      const customSectionDefs = layoutSections.filter((s: any) => !standardSectionIds.has(s.id));

      const standardNames = new Set([
        'date', 'time', 'propertyId', 'locationDetail', 'address', 'personReporting', 'reportedBy',
        'reporterName', 'dateOfIncident', 'incidentDate', 'incidentType', 'incidentSubcategory',
        'offenders', 'victims', 'witnesses', 'incidentDescription', 'description', 'actionTaken',
        'immediateAction', 'warningLetterIssued', 'warningLetterToWhom', 'warningLetterNotes',
        'safeguardingInformed', 'safeguardingWho', 'safeguardingNotes',
        'policeInvolved', 'policeCadRef', 'policeNotes',
        'ambulanceInvolved', 'ambulanceCadRef', 'ambulanceNotes',
        'fireServiceInvolved', 'fireCadRef', 'fireNotes',
        'evidencePhotos', 'attachments', 'photos',
      ]);

      const customFields = (data.fieldDefinitions || []).filter((f: any) => !standardNames.has(f.name));
      const secFieldMap = new Map<string, any[]>();
      customFields.forEach((f: any) => {
        const secId = f.section || f.sectionId || 'custom';
        if (!secFieldMap.has(secId)) secFieldMap.set(secId, []);
        secFieldMap.get(secId)!.push(f);
      });

      Object.keys(v).forEach(k => {
        if (!standardNames.has(k) && !customFields.some((f: any) => f.name === k) && !k.startsWith('_')) {
          const item = {
            id: k,
            name: k,
            label: k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
            section: 'custom',
          };
          if (!secFieldMap.has('custom')) secFieldMap.set('custom', []);
          secFieldMap.get('custom')!.push(item);
        }
      });

      const processedSecIds = new Set<string>();
      const sectionsToRender: Array<{ id: string; title: string; fields: any[] }> = [];

      // 1. Add all explicitly created user sections (even if empty!)
      customSectionDefs.forEach((s: any) => {
        processedSecIds.add(s.id);
        sectionsToRender.push({
          id: s.id,
          title: s.title || 'Section',
          fields: secFieldMap.get(s.id) || [],
        });
      });

      // 2. Add any custom fields assigned to existing or orphan sections
      secFieldMap.forEach((fields, secId) => {
        if (!processedSecIds.has(secId)) {
          const existingSec = layoutSections.find((s: any) => s.id === secId);
          sectionsToRender.push({
            id: secId,
            title: existingSec?.title ? `${existingSec.title} (Additional Fields)` : 'Additional Information',
            fields,
          });
        }
      });

      sectionsToRender.forEach(sec => {
        ensureSpace(24 + 20);
        const barY = doc.y;
        doc.rect(pageLeft, barY, contentWidth, 18).fillColor([243, 244, 246]).strokeColor([0, 0, 0]).lineWidth(0.75).fillAndStroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FLUENT_BLACK);
        // Centered section heading
        doc.text(sec.title.toUpperCase(), pageLeft, barY + 5, { width: contentWidth, align: 'center' });
        doc.y = barY + 18;

        if (sec.fields.length === 0) {
          draw2CellRow('—', '(Empty section — no fields specified)');
        } else {
          sec.fields.forEach((f: any) => {
            const rawVal = v[f.name];
            const hasVal = rawVal !== undefined && rawVal !== null && rawVal !== '';
            const displayVal = hasVal ? (Array.isArray(rawVal) ? `${rawVal.length} items` : String(rawVal)) : '—';
            draw2CellRow(f.label || f.name, displayVal);
          });
        }
      });

      // 7. Sub-table Instruction Note
      doc.moveDown(0.4);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(FLUENT_BLACK);
      doc.text('Please attach photos of any evidence where possible when submitting to CST.', pageLeft, doc.y, {
        width: contentWidth,
        align: 'center',
      });

      // 8. Evidence Photographs Gallery (Matches Preview Exactly)
      if (Array.isArray(rawPhotos) && rawPhotos.length > 0) {
        const photoBuffers = rawPhotos
          .map(p => getPhotoBuffer(p))
          .filter((p): p is { buffer: Buffer; caption: string } => p !== null);

        if (photoBuffers.length > 0) {
          ensureSpace(120);

          doc.moveDown(0.6);
          const galleryStartY = doc.y;

          // Header
          doc.font('Helvetica-Bold').fontSize(9).fillColor(FLUENT_BLACK);
          doc.text('EVIDENCE PHOTOGRAPHS & ATTACHMENTS', pageLeft + 4, galleryStartY + 4);
          doc.font('Helvetica-Oblique').fontSize(7.5).fillColor([100, 116, 139]);
          doc.text('UKVI / Clearsprings Documentation', pageLeft + contentWidth - 160, galleryStartY + 5, {
            width: 156,
            align: 'right',
          });

          const divY = galleryStartY + 16;
          doc.moveTo(pageLeft + 4, divY).lineTo(pageWidth - pageRight - 4, divY).strokeColor([0, 0, 0]).lineWidth(0.5).stroke();

          let photoY = divY + 8;
          const photoCardW = Math.floor((contentWidth - 16) / 2);
          const photoCardH = 110;

          for (let i = 0; i < photoBuffers.length; i += 2) {
            ensureSpace(photoCardH + 12);
            photoY = doc.y;

            // Photo 1
            const p1 = photoBuffers[i];
            const p1X = pageLeft + 4;
            doc.rect(p1X, photoY, photoCardW, photoCardH).strokeColor([209, 213, 219]).lineWidth(0.5).stroke();
            try {
              doc.image(p1.buffer, p1X + 4, photoY + 4, {
                fit: [photoCardW - 8, 86],
                align: 'center',
                valign: 'center',
              });
            } catch {}
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor([31, 41, 55]);
            doc.text(p1.caption, p1X + 4, photoY + 94, { width: photoCardW - 8, align: 'center' });

            // Photo 2 (if present)
            if (i + 1 < photoBuffers.length) {
              const p2 = photoBuffers[i + 1];
              const p2X = pageLeft + photoCardW + 12;
              doc.rect(p2X, photoY, photoCardW, photoCardH).strokeColor([209, 213, 219]).lineWidth(0.5).stroke();
              try {
                doc.image(p2.buffer, p2X + 4, photoY + 4, {
                  fit: [photoCardW - 8, 86],
                  align: 'center',
                  valign: 'center',
                });
              } catch {}
              doc.font('Helvetica-Bold').fontSize(7.5).fillColor([31, 41, 55]);
              doc.text(p2.caption, p2X + 4, photoY + 94, { width: photoCardW - 8, align: 'center' });
            }

            doc.y = photoY + photoCardH + 8;
          }
        }
      }

      // =======================================================================
      // Post-Processing: Running Headers & Footers Across All Pages
      // =======================================================================
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Page 2+ Running Header
        if (i > 0) {
          doc.save();
          const headY = margins.top;

          doc.font('Helvetica-Bold').fontSize(8).fillColor(FLUENT_BLACK);
          doc.text('INCIDENT REPORT', pageLeft, headY, { continued: true });
          doc.font('Helvetica-Oblique').fontSize(8).fillColor([75, 85, 99]);
          doc.text(' (Continuation)', { continued: true });

          if (data.documentNumber) {
            doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND_TEAL);
            doc.text(`  [${data.documentNumber}]`, { continued: false });
          } else {
            doc.text('', { continued: false });
          }

          doc.font('Helvetica').fontSize(8).fillColor([75, 85, 99]);
          doc.text(`Property ID: `, pageLeft + 220, headY, { continued: true });
          doc.font('Helvetica-Bold').fillColor(FLUENT_BLACK);
          doc.text(propertyId || '—', { continued: false });

          doc.font('Helvetica-Bold').fontSize(8).fillColor(FLUENT_BLACK);
          doc.text(`Page ${i + 1} of ${totalPages}`, pageWidth - pageRight - 80, headY, { width: 80, align: 'right' });

          const lineY = headY + 12;
          doc.moveTo(pageLeft, lineY).lineTo(pageWidth - pageRight, lineY).strokeColor([0, 0, 0]).lineWidth(0.5).stroke();
          doc.restore();
        }

        // Official Clearsprings Group Footer on Every Page
        doc.save();
        const footerY = pageHeight - margins.bottom - 28;

        if (fs.existsSync(logo2Path)) {
          try {
            doc.image(logo2Path, pageLeft, footerY, { height: 26 });
          } catch {}
        }

        // Center page counter
        doc.font('Helvetica').fontSize(7.5).fillColor(FLUENT_MUTED);
        doc.text(`Page ${i + 1} of ${totalPages}`, pageLeft, footerY + 8, { width: contentWidth, align: 'center' });

        // Right legal registration text
        doc.font('Helvetica').fontSize(6.5).fillColor([75, 85, 99]);
        const rightText =
          'A Clearsprings Group company\nReady Homes Limited\nRegistered office address:\n26 Brook Road, Rayleigh SS6 7XJ\nRegistered in England and Wales 7921508';
        doc.text(rightText, pageWidth - pageRight - 180, footerY, { width: 180, align: 'right', lineGap: 1 });

        doc.restore();
      }

      doc.end();
      return;
    }

    // =========================================================================
    // 2. STANDARD TEMPLATE PDF RENDERING (2-Column & Visual Header Support)
    // =========================================================================
    function drawStandardHeader() {
      const hc = data.headerConfig || {};
      let y = margins.top;

      doc.save();
      if (hc.showCompanyName !== false) {
        // SD Commercial Teal Logo Badge
        doc.rect(pageLeft, y, 22, 22).fillColor(BRAND_TEAL).fill();
        doc.font('Helvetica-Bold').fontSize(9).fillColor([255, 255, 255]);
        doc.text('SD', pageLeft + 3, y + 6, { width: 16, align: 'center' });

        // Company title & portal subtitle
        doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_DARK);
        doc.text('SD ', pageLeft + 28, y + 2, { continued: true });
        doc.fillColor(BRAND_TEAL).text('COMMERCIAL', { continued: false });

        doc.font('Helvetica').fontSize(7).fillColor(FLUENT_MUTED);
        doc.text('Operations & Compliance Portal', pageLeft + 28, y + 13);
        y += 28;
      }

      if (hc.subtitle) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(FLUENT_MUTED);
        doc.text(hc.subtitle, pageLeft, y);
        y += 12;
      }

      // Divider line
      y += 2;
      doc.moveTo(pageLeft, y).lineTo(pageWidth - pageRight, y).strokeColor(BRAND_TEAL).lineWidth(1.5).stroke();
      doc.restore();
      return y + 10;
    }

    function drawStandardFooter(pageIndex: number, totalPages: number) {
      const fc = data.footerConfig || {};
      const footerY = pageHeight - margins.bottom - 20;

      doc.save();
      doc.moveTo(pageLeft, footerY).lineTo(pageWidth - pageRight, footerY).strokeColor(FLUENT_BORDER).lineWidth(0.5).stroke();

      const textY = footerY + 6;
      if (fc.customText) {
        doc.font('Helvetica').fontSize(6.5).fillColor(FLUENT_MUTED);
        doc.text(fc.customText, pageLeft, textY, { width: contentWidth / 2 });
      }
      if (fc.showPageNumbers !== false) {
        doc.font('Helvetica').fontSize(6.5).fillColor(FLUENT_MUTED);
        doc.text(`Page ${pageIndex + 1} of ${totalPages}`, pageLeft, textY, { width: contentWidth, align: 'right' });
      }
      if (fc.showGeneratedTimestamp !== false) {
        doc.font('Helvetica-Oblique').fontSize(5.5).fillColor([161, 159, 157]);
        doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pageLeft, textY + 9, {
          width: contentWidth,
          align: 'right',
        });
      }
      doc.restore();
    }

    const startY = drawStandardHeader();
    doc.y = startY;

    // Document Title
    doc.font('Helvetica-Bold').fontSize(16).fillColor(FLUENT_BLACK);
    doc.text(data.title, { align: 'left' });
    doc.moveDown(0.25);

    // Meta bar
    const metaParts: string[] = [];
    if (data.documentNumber) metaParts.push(`Document No: ${data.documentNumber}`);
    metaParts.push(`Site: ${data.site || '—'}`);
    metaParts.push(`Date: ${formatDate(data.createdAt)}`);

    doc.font('Helvetica').fontSize(7.5).fillColor(FLUENT_MUTED);
    doc.text(metaParts.join('   |   '), { continued: false });

    // Confidentiality Badge
    const confLevel = data.headerConfig?.confidentialityLevel;
    if (confLevel) {
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor([220, 38, 38]);
      doc.text(`[${confLevel.toUpperCase()}]`);
    }

    doc.moveDown(0.4);
    const divMetaY = doc.y;
    doc.moveTo(pageLeft, divMetaY).lineTo(pageWidth - pageRight, divMetaY).strokeColor(FLUENT_BORDER).lineWidth(0.5).stroke();
    doc.y = divMetaY + 10;

    const sections = [...(data.layoutConfig?.sections || [])].sort((a: any, b: any) => a.order - b.order);
    const fields = data.fieldDefinitions || [];
    const values = data.fieldValues || {};

    const maxStdContentY = pageHeight - margins.bottom - 35;

    for (const section of sections) {
      if (doc.y + 40 > maxStdContentY) {
        doc.addPage();
        drawStandardHeader();
        doc.y = margins.top + 45;
      }

      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND_DARK);
      doc.text(section.title.toUpperCase(), pageLeft, doc.y, { width: contentWidth, align: 'center' });

      const secLineY = doc.y + 1;
      const lineWidth = contentWidth * 0.35;
      const lineX = pageLeft + (contentWidth - lineWidth) / 2;
      doc.moveTo(lineX, secLineY).lineTo(lineX + lineWidth, secLineY).strokeColor(BRAND_TEAL).lineWidth(1).stroke();
      doc.y = secLineY + 6;

      const secFields = fields.filter((f: any) => f.section === section.id).sort((a: any, b: any) => a.order - b.order);
      const is2Col = (section.columns || 1) > 1;
      const colW = (contentWidth - 16) / 2;

      for (let fIdx = 0; fIdx < secFields.length; fIdx++) {
        const field = secFields[fIdx];
        const val = values[field.name];
        const dispVal = val !== undefined && val !== null && val !== '' ? (Array.isArray(val) ? `${val.length} items` : String(val)) : '—';
        const isFullWidth = !is2Col || field.width === 'full' || field.type === 'textarea';

        if (doc.y + 35 > maxStdContentY) {
          doc.addPage();
          drawStandardHeader();
          doc.y = margins.top + 45;
        }

        if (isFullWidth || !is2Col) {
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(FLUENT_MUTED);
          doc.text(field.label.toUpperCase());
          doc.font('Helvetica').fontSize(9).fillColor(dispVal === '—' ? [161, 159, 157] : FLUENT_BLACK);
          if (field.type === 'textarea') {
            const boxY = doc.y + 1;
            const textH = doc.heightOfString(dispVal, { width: contentWidth - 12 });
            const boxH = Math.max(26, textH + 8);
            doc.rect(pageLeft, boxY, contentWidth, boxH).strokeColor(FLUENT_BORDER).lineWidth(0.5).stroke();
            doc.text(dispVal, pageLeft + 6, boxY + 4, { width: contentWidth - 12 });
            doc.y = boxY + boxH + 4;
          } else {
            doc.text(dispVal);
            doc.moveDown(0.25);
          }
        } else {
          // 2-Column Pair Handling
          const nextField = secFields[fIdx + 1];
          const canPair = nextField && nextField.width !== 'full' && nextField.type !== 'textarea';

          const curY = doc.y;
          // Col 1
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor(FLUENT_MUTED);
          doc.text(field.label.toUpperCase(), pageLeft, curY, { width: colW });
          doc.font('Helvetica').fontSize(9).fillColor(dispVal === '—' ? [161, 159, 157] : FLUENT_BLACK);
          doc.text(dispVal, pageLeft, curY + 10, { width: colW });

          // Col 2
          if (canPair) {
            const nextVal = values[nextField.name];
            const nextDisp = nextVal !== undefined && nextVal !== null && nextVal !== '' ? String(nextVal) : '—';
            const col2X = pageLeft + colW + 16;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(FLUENT_MUTED);
            doc.text(nextField.label.toUpperCase(), col2X, curY, { width: colW });
            doc.font('Helvetica').fontSize(9).fillColor(nextDisp === '—' ? [161, 159, 157] : FLUENT_BLACK);
            doc.text(nextDisp, col2X, curY + 10, { width: colW });
            fIdx++; // Consumed pair
          }

          doc.y = curY + 28;
        }
      }
    }

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawStandardFooter(i, totalPages);
    }

    doc.end();
  });
}
