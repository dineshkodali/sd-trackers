/**
 * Document Builder — PDF Generation
 *
 * Generates professional PDF documents using pdfkit.
 * Produces multi-page PDFs with headers, footers, page numbers,
 * authentic Ready Homes / Clearsprings branding, and flow-based tables.
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

// SD Brand colors in RGB arrays
const BRAND_TEAL: [number, number, number] = [13, 148, 136];
const BRAND_DARK: [number, number, number] = [17, 94, 89];
const FLUENT_BLACK: [number, number, number] = [36, 36, 36];
const FLUENT_MUTED: [number, number, number] = [96, 94, 92];
const FLUENT_BORDER: [number, number, number] = [225, 223, 221];

function formatDate(dateStr?: string): string {
  if (!dateStr) return new Date().toLocaleDateString('en-GB');
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export async function generatePdf(data: DocData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const isIncident =
      data.templateName === 'Incident Report' ||
      data.title.toLowerCase().includes('incident') ||
      (data.fieldDefinitions || []).some((f: any) => f.name === 'propertyId');

    const margins = isIncident
      ? { top: 30, right: 36, bottom: 35, left: 36 }
      : (data.layoutConfig?.margins || { top: 25, right: 20, bottom: 25, left: 20 });

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
    // INCIDENT REPORT PDF RENDERING (Matching User Screenshot & Dynamic Flow)
    // =========================================================================
    if (isIncident) {
      const v = data.fieldValues || {};

      const parsePeople = (val: any) => {
        if (!val) return [];
        if (Array.isArray(val)) {
          return val.map((it: any) => typeof it === 'string' ? { name: it } : it).filter(it => it && it.name);
        }
        if (typeof val === 'string' && val.trim() && val !== 'N/A') {
          return val.split(/[\n,;]+/).map(s => ({ name: s.trim() })).filter(x => x.name.length > 0);
        }
        return [];
      };

      const offenders = parsePeople(v.offenders);
      const victims = parsePeople(v.victims);
      const witnesses = parsePeople(v.witnesses);

      const parseLines = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String).filter(s => s.trim().length > 0);
        const str = String(val).trim();
        if (!str || str === 'N/A') return [];
        return str.split('\n').map(l => l.trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean);
      };

      const descLines = parseLines(v.incidentDescription || v.description);
      const actionLines = parseLines(v.actionTaken || v.immediateAction);

      // Draw top header on first page
      function drawIncidentFirstHeader() {
        if (fs.existsSync(logo1Path)) {
          try {
            doc.image(logo1Path, pageWidth - pageRight - 110, margins.top, { width: 110 });
          } catch {
            // fallback text
          }
        }
        doc.y = margins.top + 46;

        // Title
        doc.font('Helvetica-Bold').fontSize(14).fillColor(FLUENT_BLACK);
        doc.text('Incident Report', pageLeft, doc.y, { width: contentWidth, align: 'center' });
        doc.moveDown(0.3);

        // Subtitle instructions
        doc.font('Helvetica').fontSize(8).fillColor(FLUENT_BLACK);
        doc.text(
          'Please complete with as much detail as possible, stating only facts.  Please email CST@Clearsprings.co.uk who will review and send it to UKVI where appropriate.',
          pageLeft,
          doc.y,
          { width: contentWidth, align: 'center' }
        );
        doc.moveDown(0.8);
      }

      // Draw continuation header on subsequent pages
      function drawIncidentRunningHeader(pageIdx: number, totalPages: number) {
        doc.save();
        doc.font('Helvetica-Bold').fontSize(8).fillColor(FLUENT_BLACK);
        doc.text('INCIDENT REPORT (Continuation)', pageLeft, margins.top, { continued: true });
        doc.font('Helvetica').fontSize(8).fillColor(FLUENT_MUTED);
        doc.text(`   |   Property ID: ${v.propertyId || data.site || '—'}   |   Page ${pageIdx + 1} of ${totalPages}`, { align: 'right' });

        const lineY = margins.top + 14;
        doc.moveTo(pageLeft, lineY).lineTo(pageWidth - pageRight, lineY).strokeColor(FLUENT_BLACK).lineWidth(0.5).stroke();
        doc.restore();
      }

      // Draw Clearsprings footer on every page
      function drawIncidentFooter(pageIdx: number, totalPages: number) {
        doc.save();
        const footerY = pageHeight - margins.bottom - 28;

        if (fs.existsSync(logo2Path)) {
          try {
            doc.image(logo2Path, pageLeft, footerY, { height: 26 });
          } catch {}
        }

        // Center page number
        doc.font('Helvetica').fontSize(7.5).fillColor(FLUENT_MUTED);
        doc.text(`Page ${pageIdx + 1} of ${totalPages}`, pageLeft, footerY + 8, { width: contentWidth, align: 'center' });

        // Right registered entity
        doc.font('Helvetica').fontSize(6).fillColor([75, 85, 99]);
        const rightText = 'A Clearsprings Group company\nReady Homes Limited\nRegistered office address: 26 Brook Road, Rayleigh SS6 7XJ\nRegistered in England and Wales 7921508';
        doc.text(rightText, pageWidth - pageRight - 180, footerY, { width: 180, align: 'right', lineGap: 1 });

        doc.restore();
      }

      // Table layout helper
      const col0W = contentWidth * 0.3502;
      const colRestW = contentWidth - col0W;

      function drawRow(label: string, content: string | string[], minH = 20) {
        const startY = doc.y;
        if (startY + minH > pageHeight - margins.bottom - 45) {
          doc.addPage();
          doc.y = margins.top + 25;
        }

        const y = doc.y;
        doc.save();

        // Left label cell
        doc.rect(pageLeft, y, col0W, minH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FLUENT_BLACK);
        doc.text(label, pageLeft + 4, y + 5, { width: col0W - 8, align: 'center' });

        // Right cell
        doc.rect(pageLeft + col0W, y, colRestW, minH).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor(FLUENT_BLACK);

        if (Array.isArray(content)) {
          let textY = y + 5;
          content.forEach(line => {
            doc.text(`• ${line}`, pageLeft + col0W + 8, textY, { width: colRestW - 16 });
            textY += 14;
          });
        } else {
          doc.text(content || '', pageLeft + col0W + 8, y + 5, { width: colRestW - 16 });
        }

        doc.restore();
        doc.y = y + minH;
      }

      // 1. First Page Header
      drawIncidentFirstHeader();

      // 2. Table Rows
      drawRow('Property ID', String(v.propertyId || data.site || ''));
      drawRow('Person Reporting', String(v.personReporting || ''));
      drawRow('Date of Incident', String(v.dateOfIncident || ''));

      // Offenders
      if (offenders.length === 0) {
        drawRow('Offenders (Name/Port)', '');
      } else {
        offenders.forEach((o: any, idx: number) => {
          const lbl = idx === 0 ? 'Offenders (Name/Port)' : `Offender (${idx + 1})`;
          const val = `${o.name || ''} ${o.portRef ? `(${o.portRef})` : ''}`.trim();
          drawRow(lbl, val);
        });
      }

      // Victims
      if (victims.length === 0) {
        drawRow('Victims (Name/Port)', '');
      } else {
        victims.forEach((vic: any, idx: number) => {
          const lbl = idx === 0 ? 'Victims (Name/Port)' : `Victim (${idx + 1})`;
          const val = `${vic.name || ''} ${vic.portRef ? `(${vic.portRef})` : ''}`.trim();
          drawRow(lbl, val);
        });
      }

      // Witnesses
      if (witnesses.length === 0) {
        drawRow('Witnesses (SUs) (Name/Port)', '');
      } else {
        witnesses.forEach((w: any, idx: number) => {
          const lbl = idx === 0 ? 'Witnesses (SUs) (Name/Port)' : `Witness (${idx + 1})`;
          const val = `${w.name || ''} ${w.portRef ? `(${w.portRef})` : ''}`.trim();
          drawRow(lbl, val);
        });
      }

      // Incident Description (Calculated height)
      const descH = Math.max(50, (descLines.length || 1) * 15 + 16);
      drawRow('Incident Description', descLines.length > 0 ? descLines : [''], descH);

      // Action Taken (Calculated height)
      const actH = Math.max(40, (actionLines.length || 1) * 15 + 16);
      drawRow('Action Taken', actionLines.length > 0 ? actionLines : [''], actH);

      // Warning Letter Row (4 columns)
      const warnY = doc.y;
      if (warnY + 120 > pageHeight - margins.bottom - 45) {
        doc.addPage();
        doc.y = margins.top + 25;
      }

      const wY = doc.y;
      const c1W = contentWidth * 0.2166;
      const c2W = contentWidth * 0.1729;
      const c3W = contentWidth * 0.2603;

      function draw4ColRow(label: string, v1: string, v2: string, v3: string) {
        const curY = doc.y;
        doc.save();
        // Col 0
        doc.rect(pageLeft, curY, col0W, 20).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FLUENT_BLACK);
        doc.text(label, pageLeft + 4, curY + 5, { width: col0W - 8, align: 'center' });

        // Col 1
        doc.rect(pageLeft + col0W, curY, c1W, 20).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor(FLUENT_BLACK);
        doc.text(v1 || '', pageLeft + col0W, curY + 5, { width: c1W, align: 'center' });

        // Col 2
        doc.rect(pageLeft + col0W + c1W, curY, c2W, 20).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.text(v2 || '', pageLeft + col0W + c1W, curY + 5, { width: c2W, align: 'center' });

        // Col 3
        doc.rect(pageLeft + col0W + c1W + c2W, curY, c3W, 20).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
        doc.text(v3 || '', pageLeft + col0W + c1W + c2W, curY + 5, { width: c3W, align: 'center' });

        doc.restore();
        doc.y = curY + 20;
      }

      draw4ColRow('Warning Letter Issued?', v.warningLetterIssued === 'N/A' ? '' : v.warningLetterIssued, v.warningLetterToWhom === 'N/A' ? '' : v.warningLetterToWhom, '');

      // Grey Divider Bar
      const divY = doc.y;
      doc.save();
      doc.rect(pageLeft, divY, contentWidth, 14).fillColor([191, 191, 191]).fill();
      doc.rect(pageLeft, divY, contentWidth, 14).lineWidth(0.75).strokeColor([0, 0, 0]).stroke();
      doc.restore();
      doc.y = divY + 14;

      // Authority Rows
      draw4ColRow('Safeguarding Informed?', v.safeguardingInformed === 'N/A' ? '' : v.safeguardingInformed, v.safeguardingWho === 'N/A' ? '' : v.safeguardingWho, '');
      draw4ColRow('Police Involved?', v.policeInvolved === 'N/A' ? '' : v.policeInvolved, v.policeCadRef === 'N/A' ? '' : v.policeCadRef, '');
      draw4ColRow('Ambulance Involved?', v.ambulanceInvolved === 'N/A' ? '' : v.ambulanceInvolved, v.ambulanceCadRef === 'N/A' ? '' : v.ambulanceCadRef, '');
      draw4ColRow('Fire Service Involved?', v.fireServiceInvolved === 'N/A' ? '' : v.fireServiceInvolved, v.fireCadRef === 'N/A' ? '' : v.fireCadRef, '');

      // Evidence Instruction Note
      doc.moveDown(0.6);
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(FLUENT_BLACK);
      doc.text('Please attach photos of any evidence where possible when submitting to CST.', pageLeft, doc.y, { width: contentWidth, align: 'center' });

      // Apply running headers and footers across all buffered pages
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        if (i > 0) {
          drawIncidentRunningHeader(i, totalPages);
        }
        drawIncidentFooter(i, totalPages);
      }

      doc.end();
      return;
    }

    // =========================================================================
    // STANDARD TEMPLATE PDF RENDERING
    // =========================================================================
    function drawHeader() {
      const hc = data.headerConfig || {};
      let y = margins.top;

      doc.save();
      if (hc.showCompanyName !== false) {
        doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_DARK);
        doc.text('SD COMMERCIAL', pageLeft, y, { continued: true });
        doc.font('Helvetica').fontSize(10).fillColor(BRAND_TEAL);
        doc.text('  Operations & Compliance', { continued: false });
        y += 20;
      }
      if (hc.subtitle) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor(FLUENT_MUTED);
        doc.text(hc.subtitle, pageLeft, y);
        y += 14;
      }
      y += 4;
      doc.moveTo(pageLeft, y).lineTo(pageWidth - pageRight, y).strokeColor(BRAND_TEAL).lineWidth(1.5).stroke();
      doc.restore();
    }

    function drawFooter(pageIndex: number, totalPages: number) {
      const fc = data.footerConfig || {};
      const footerY = doc.page.height - margins.bottom - 20;

      doc.save();
      doc.moveTo(pageLeft, footerY).lineTo(pageWidth - pageRight, footerY).strokeColor(FLUENT_BORDER).lineWidth(0.5).stroke();

      const textY = footerY + 8;
      if (fc.customText) {
        doc.font('Helvetica').fontSize(7).fillColor(FLUENT_MUTED);
        doc.text(fc.customText, pageLeft, textY, { width: contentWidth / 2 });
      }
      if (fc.showPageNumbers !== false) {
        doc.font('Helvetica').fontSize(7).fillColor(FLUENT_MUTED);
        doc.text(`Page ${pageIndex + 1} of ${totalPages}`, pageLeft, textY, { width: contentWidth, align: 'right' });
      }
      doc.restore();
    }

    function ensureSpace(needed: number) {
      const available = doc.page.height - doc.page.margins.bottom - doc.y;
      if (available < needed) {
        doc.addPage();
        drawHeader();
      }
    }

    drawHeader();
    doc.y = margins.top + 50;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(FLUENT_BLACK);
    doc.text(data.title, { align: 'left' });
    doc.moveDown(0.3);

    const metaItems: string[] = [];
    if (data.documentNumber) metaItems.push(`Document No: ${data.documentNumber}`);
    metaItems.push(`Site: ${data.site}`);
    metaItems.push(`Date: ${formatDate(data.createdAt)}`);
    if (data.createdByName) metaItems.push(`Created by: ${data.createdByName}`);

    doc.font('Helvetica').fontSize(8).fillColor(FLUENT_MUTED);
    doc.text(metaItems.join('   |   '));
    doc.moveDown(0.4);

    const sections = [...(data.layoutConfig?.sections || [])].sort((a: any, b: any) => a.order - b.order);
    const fields = data.fieldDefinitions || [];
    const values = data.fieldValues || {};

    for (const section of sections) {
      ensureSpace(60);
      doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_DARK);
      doc.text(section.title);
      doc.moveDown(0.1);

      const sectionLineY = doc.y;
      doc.moveTo(pageLeft, sectionLineY).lineTo(pageLeft + contentWidth * 0.4, sectionLineY).strokeColor(BRAND_TEAL).lineWidth(1).stroke();
      doc.y = sectionLineY + 6;
      doc.moveDown(0.3);

      const sectionFields = fields.filter((f: any) => f.section === section.id).sort((a: any, b: any) => a.order - b.order);

      for (const field of sectionFields) {
        const value = values[field.name];
        const displayValue = value !== undefined && value !== null && value !== '' ? String(value) : '—';
        ensureSpace(35);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(FLUENT_BLACK);
        doc.text(field.label);
        doc.font('Helvetica').fontSize(10).fillColor(FLUENT_BLACK);
        doc.text(displayValue);
        doc.moveDown(0.3);
      }
    }

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(i, totalPages);
    }

    doc.end();
  });
}
