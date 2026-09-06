/**
 * SG Accommodation Support Tracker - Secure Client-Side PDF Export Engine
 * Replacement implementation: zero external dependencies, 100% compliant PDF 1.4 generator.
 * Eliminates bundler/constructor conflicts while preserving visual fidelity, metadata bars,
 * zebra striping, multi-page pagination, and security classifications.
 */

export interface PdfMetadataItem {
  label: string;
  value: string | number;
}

export interface PdfTableExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  metadata?: PdfMetadataItem[];
  orientation?: 'portrait' | 'landscape';
  themeColor?: [number, number, number];
  columnStyles?: Record<number, { cellWidth?: number | 'auto' | 'wrap'; halign?: 'left' | 'center' | 'right' }>;
  isCompact?: boolean;
}

export interface DashboardReportData {
  siteFilter: string;
  monthFilter: string;
  statusFilter: string;
  searchQuery: string;
  stats: {
    totalCases: number;
    openCount: number;
    inProgressCount: number;
    completedCount: number;
    highRiskCount: number;
    sitesWithData: number;
  };
  referrals: Array<{
    site: string;
    suName: string;
    portRef: string;
    referralType: string;
    status: string;
    dateReferred: string;
    council: string;
    notes: string;
  }>;
  vulnerableSUs: Array<{
    site: string;
    room: string;
    suName: string;
    group: string;
    riskLevel: string;
    vulnerability: string;
    reviewDate: string;
    worker: string;
  }>;
  escalations: Array<{
    site: string;
    resident: string;
    type: string;
    urgency: string;
    status: string;
    date: string;
    authorities: string;
    action: string;
  }>;
}

// --------------------------------------------------------------------------
// Pure PDF 1.4 Vector Document Generator
// --------------------------------------------------------------------------

function escapePdf(text: string): string {
  // Replace non-ASCII and parenthesis/backslash for WinAnsi PDF encoding
  const sanitized = String(text || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return sanitized;
}

class PdfDoc {
  private pages: string[][] = [];
  private currentPageIdx: number = 0;
  public readonly width: number;
  public readonly height: number;

  constructor(orientation: 'portrait' | 'landscape' = 'landscape') {
    if (orientation === 'portrait') {
      this.width = 595.28;
      this.height = 841.89;
    } else {
      this.width = 841.89;
      this.height = 595.28;
    }
    this.pages.push([]);
    this.currentPageIdx = 0;
  }

  public get pageCount(): number {
    return this.pages.length;
  }

  public addPage(): void {
    this.pages.push([]);
    this.currentPageIdx = this.pages.length - 1;
  }

  public setPage(index: number): void {
    if (index >= 0 && index < this.pages.length) {
      this.currentPageIdx = index;
    }
  }

  private op(instruction: string): void {
    this.pages[this.currentPageIdx].push(instruction);
  }

  public setFillColor(r: number, g: number, b: number): void {
    const rf = (Math.max(0, Math.min(255, r)) / 255).toFixed(3);
    const gf = (Math.max(0, Math.min(255, g)) / 255).toFixed(3);
    const bf = (Math.max(0, Math.min(255, b)) / 255).toFixed(3);
    this.op(`${rf} ${gf} ${bf} rg`);
  }

  public setStrokeColor(r: number, g: number, b: number): void {
    const rf = (Math.max(0, Math.min(255, r)) / 255).toFixed(3);
    const gf = (Math.max(0, Math.min(255, g)) / 255).toFixed(3);
    const bf = (Math.max(0, Math.min(255, b)) / 255).toFixed(3);
    this.op(`${rf} ${gf} ${bf} RG`);
  }

  public setLineWidth(width: number): void {
    this.op(`${width.toFixed(2)} w`);
  }

  public rect(x: number, y: number, w: number, h: number, fill = true, stroke = false): void {
    // In PDF coordinates, origin (0,0) is at bottom-left
    const pdfY = this.height - y - h;
    const command = fill && stroke ? 'B' : fill ? 'f' : 'S';
    this.op(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${command}`);
  }

  public line(x1: number, y1: number, x2: number, y2: number): void {
    const py1 = this.height - y1;
    const py2 = this.height - y2;
    this.op(`${x1.toFixed(2)} ${py1.toFixed(2)} m ${x2.toFixed(2)} ${py2.toFixed(2)} l S`);
  }

  public text(
    str: string,
    x: number,
    y: number,
    font: 'F1' | 'F2' = 'F1',
    size: number = 10,
    align: 'left' | 'center' | 'right' = 'left',
    maxWidth?: number
  ): void {
    let clean = String(str ?? '').trim();
    if (maxWidth && maxWidth > 0) {
      // Estimate approximate width in pt: ~0.55 * size per character for Helvetica
      const approxCharWidth = size * 0.55;
      const maxChars = Math.floor(maxWidth / approxCharWidth);
      if (clean.length > maxChars && maxChars > 3) {
        clean = clean.slice(0, maxChars - 3) + '...';
      }
    }

    let drawX = x;
    const estimatedWidth = clean.length * size * 0.55;
    if (align === 'right') {
      drawX = x - estimatedWidth;
    } else if (align === 'center') {
      drawX = x - estimatedWidth / 2;
    }

    const py = this.height - y;
    const safeText = escapePdf(clean);
    this.op(`BT /${font} ${size.toFixed(1)} Tf ${drawX.toFixed(2)} ${py.toFixed(2)} Td (${safeText}) Tj ET`);
  }

  public buildBlob(): Blob {
    const numPages = this.pages.length;
    // Objects layout:
    // 1: Catalog
    // 2: Pages
    // 3 .. (2 + numPages): Page objects
    // (3 + numPages) .. (2 + 2 * numPages): Content streams
    // Font F1 (Helvetica)
    // Font F2 (Helvetica-Bold)
    const f1Idx = 3 + 2 * numPages;
    const f2Idx = f1Idx + 1;
    const totalObjs = f2Idx;

    const kidRefs = [];
    for (let i = 0; i < numPages; i++) {
      kidRefs.push(`${3 + i} 0 R`);
    }

    const objects: string[] = [];
    objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[2] = `<< /Type /Pages /Kids [${kidRefs.join(' ')}] /Count ${numPages} >>`;

    for (let i = 0; i < numPages; i++) {
      const pageObjNum = 3 + i;
      const streamObjNum = 3 + numPages + i;
      objects[pageObjNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 ${f1Idx} 0 R /F2 ${f2Idx} 0 R >> >> >>`;

      const streamContent = this.pages[i].join('\n');
      const streamLen = new TextEncoder().encode(streamContent).length;
      objects[streamObjNum] = `<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`;
    }

    objects[f1Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    objects[f2Idx] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

    let header = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
    let body = '';
    const byteOffsets: number[] = [];

    const encoder = new TextEncoder();
    let currentPos = encoder.encode(header).length;

    for (let i = 1; i <= totalObjs; i++) {
      byteOffsets[i] = currentPos;
      const objText = `${i} 0 obj\n${objects[i]}\nendobj\n`;
      body += objText;
      currentPos += encoder.encode(objText).length;
    }

    const startxref = currentPos;
    let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= totalObjs; i++) {
      xref += String(byteOffsets[i]).padStart(10, '0') + ` 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

    return new Blob([header, body, xref, trailer], { type: 'application/pdf' });
  }

  public download(filename: string): void {
    try {
      const blob = this.buildBlob();
      const finalName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

      if (typeof window !== 'undefined') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalName;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } catch {}
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to trigger PDF download:', err);
    }
  }
}

// --------------------------------------------------------------------------
// Public Export API
// --------------------------------------------------------------------------

export function exportTableToPdf(options: PdfTableExportOptions): void {
  const {
    title,
    subtitle,
    filename,
    headers,
    rows,
    metadata = [],
    orientation = 'landscape',
    themeColor = [0, 103, 184], // Microsoft SG Blue
    isCompact = false
  } = options;

  const doc = new PdfDoc(orientation);
  const pageWidth = doc.width;
  const pageHeight = doc.height;
  const margin = isCompact ? 24 : 36;
  const printableWidth = pageWidth - margin * 2;

  // Header Draw helper
  const drawPageHeader = (isFirstPage: boolean) => {
    // Top brand line
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(0, 0, pageWidth, isCompact ? 4 : 5, true, false);

    // Portal Brand
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text('SG SAFEGUARDING & COMPLIANCE PORTAL', margin, isCompact ? 18 : 24, 'F2', isCompact ? 8.5 : 9.5);

    // Classification Badge
    doc.setFillColor(180, 40, 40);
    doc.text('OFFICIAL - SENSITIVE (SAFEGUARDING)', pageWidth - margin - 200, isCompact ? 18 : 24, 'F2', isCompact ? 7.5 : 8);

    if (isFirstPage) {
      // Document Title
      doc.setFillColor(36, 36, 36);
      doc.text(title, margin, isCompact ? 36 : 46, 'F2', isCompact ? 13 : 15);

      let currentY = isCompact ? 46 : 58;
      if (subtitle) {
        doc.setFillColor(96, 94, 92);
        doc.text(subtitle, margin, currentY, 'F1', isCompact ? 7.5 : 8.5);
        currentY += isCompact ? 10 : 13;
      }

      // Divider Line
      doc.setStrokeColor(225, 223, 221);
      doc.setLineWidth(0.75);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += isCompact ? 6 : 10;

      // Metadata Banner
      if (metadata.length > 0) {
        doc.setFillColor(248, 249, 250);
        const metaHeight = isCompact ? 16 : 22;
        doc.rect(margin, currentY, printableWidth, metaHeight, true, false);

        let metaX = margin + 8;
        const metaY = currentY + (isCompact ? 11 : 14);

        metadata.forEach(item => {
          doc.setFillColor(96, 94, 92);
          doc.text(`${item.label}:`, metaX, metaY, 'F2', isCompact ? 6.5 : 7.5);
          metaX += (item.label.length + 2) * 5;

          doc.setFillColor(36, 36, 36);
          const valStr = `${item.value}   |   `;
          doc.text(valStr, metaX, metaY, 'F1', isCompact ? 6.5 : 7.5);
          metaX += valStr.length * 4.8;
        });

        currentY += metaHeight + (isCompact ? 8 : 12);
      }

      return currentY;
    } else {
      // Continuation Header
      doc.setFillColor(96, 94, 92);
      doc.text(`${title} (Continued)`, margin, isCompact ? 30 : 38, 'F2', isCompact ? 9 : 10.5);
      return isCompact ? 38 : 46;
    }
  };

  const drawPageFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - (isCompact ? 12 : 16);
    doc.setStrokeColor(235, 235, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

    doc.setFillColor(120, 120, 120);
    const timestamp = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB');
    doc.text(
      `Generated: ${timestamp} • Strict Home Office & GDPR Safeguarding Compliance${isCompact ? ' (Compact)' : ''}`,
      margin,
      footerY,
      'F1',
      isCompact ? 6.5 : 7.5
    );

    const pageStr = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageStr, pageWidth - margin - 60, footerY, 'F1', isCompact ? 6.5 : 7.5);
  };

  // Calculate column widths
  const numCols = Math.max(1, headers.length);
  const baseColWidth = printableWidth / numCols;
  const colWidths: number[] = headers.map((_, idx) => {
    const custom = options.columnStyles?.[idx]?.cellWidth;
    if (typeof custom === 'number') return custom;
    return baseColWidth;
  });

  const rowHeight = isCompact ? 14 : 18;
  const headerHeight = isCompact ? 16 : 20;

  let currentY = drawPageHeader(true);

  // Helper to draw Table Header
  const drawTableHeader = (startY: number) => {
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(margin, startY, printableWidth, headerHeight, true, false);

    let curX = margin;
    headers.forEach((hdr, idx) => {
      const colW = colWidths[idx];
      doc.setFillColor(255, 255, 255);
      doc.text(
        hdr,
        curX + 4,
        startY + (isCompact ? 11 : 14),
        'F2',
        isCompact ? 7 : 8,
        'left',
        colW - 8
      );
      curX += colW;
    });

    return startY + headerHeight;
  };

  currentY = drawTableHeader(currentY);

  const bottomThreshold = pageHeight - (isCompact ? 32 : 44);

  // Draw rows
  rows.forEach((row, rowIndex) => {
    if (currentY + rowHeight > bottomThreshold) {
      doc.addPage();
      currentY = drawPageHeader(false);
      currentY = drawTableHeader(currentY);
    }

    // Alternating zebra fill
    if (rowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, printableWidth, rowHeight, true, false);
    }

    // Row border line
    doc.setStrokeColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY + rowHeight, margin + printableWidth, currentY + rowHeight);

    let curX = margin;
    row.forEach((cellVal, colIdx) => {
      const colW = colWidths[colIdx] || baseColWidth;
      const textVal = String(cellVal ?? '');

      doc.setFillColor(36, 36, 36);
      doc.text(
        textVal,
        curX + 4,
        currentY + (isCompact ? 10 : 12.5),
        'F1',
        isCompact ? 6.5 : 7.5,
        'left',
        colW - 8
      );
      curX += colW;
    });

    currentY += rowHeight;
  });

  // Stamp footers on all generated pages
  const totalPages = doc.pageCount;
  for (let p = 0; p < totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(p + 1, totalPages);
  }

  doc.download(filename);
}

export function exportDashboardSummaryPdf(data: DashboardReportData): void {
  const doc = new PdfDoc('landscape');
  const pageWidth = doc.width;
  const pageHeight = doc.height;
  const margin = 32;
  const printableWidth = pageWidth - margin * 2;
  const themeColor: [number, number, number] = [0, 103, 184];

  // Header banner
  doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.rect(0, 0, pageWidth, 5, true, false);

  doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
  doc.text('SG SAFEGUARDING & COMPLIANCE PORTAL', margin, 24, 'F2', 9.5);

  doc.setFillColor(180, 40, 40);
  doc.text('OFFICIAL - SENSITIVE (SAFEGUARDING)', pageWidth - margin - 200, 24, 'F2', 8);

  doc.setFillColor(36, 36, 36);
  doc.text('Executive Safeguarding & Operations Briefing', margin, 46, 'F2', 15);

  doc.setFillColor(96, 94, 92);
  doc.text('Multi-facility incident trends, active vulnerable caseloads, and site oversight metrics.', margin, 58, 'F1', 8.5);

  doc.setStrokeColor(225, 223, 221);
  doc.setLineWidth(0.75);
  doc.line(margin, 64, pageWidth - margin, 64);

  // Metadata ribbon
  doc.setFillColor(248, 249, 250);
  doc.rect(margin, 70, printableWidth, 20, true, false);

  let metaX = margin + 8;
  const metaY = 83;
  const metaItems = [
    { label: 'Facility Filter', value: data.siteFilter === 'all' ? 'All Accommodation Sites' : data.siteFilter },
    { label: 'Incident Status', value: data.statusFilter },
    { label: 'Month Scope', value: data.monthFilter },
    { label: 'Reporting Date', value: new Date().toLocaleDateString('en-GB') }
  ];

  metaItems.forEach(item => {
    doc.setFillColor(96, 94, 92);
    doc.text(`${item.label}:`, metaX, metaY, 'F2', 7.5);
    metaX += (item.label.length + 2) * 5;

    doc.setFillColor(36, 36, 36);
    const valStr = `${item.value}   |   `;
    doc.text(valStr, metaX, metaY, 'F1', 7.5);
    metaX += valStr.length * 4.8;
  });

  // KPI Metric Cards
  const kpis = [
    { label: 'Total Referrals', val: data.stats.totalCases, color: [0, 103, 184] },
    { label: 'Open Incidents', val: data.stats.openCount, color: [216, 59, 1] },
    { label: 'In Progress', val: data.stats.inProgressCount, color: [180, 83, 9] },
    { label: 'High Risk Escalations', val: data.stats.highRiskCount, color: [164, 38, 44] },
    { label: 'Active Facilities', val: data.stats.sitesWithData, color: [16, 124, 65] }
  ];

  const cardGap = 8;
  const cardWidth = (printableWidth - cardGap * (kpis.length - 1)) / kpis.length;
  const cardY = 98;
  const cardHeight = 36;

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.rect(cx, cardY, cardWidth, cardHeight, true, false);

    // Accent strip
    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.rect(cx, cardY, 3, cardHeight, true, false);

    doc.setFillColor(96, 94, 92);
    doc.text(kpi.label, cx + 8, cardY + 14, 'F1', 7);

    doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(String(kpi.val), cx + 8, cardY + 29, 'F2', 13);
  });

  let currentY = 146;

  // Section 1: High Priority Escalations Table
  doc.setFillColor(36, 36, 36);
  doc.text('1. Critical Incident Escalations (Top Records)', margin, currentY, 'F2', 10);
  currentY += 8;

  const escHeaders = ['Date', 'Facility', 'Service User', 'Type', 'Urgency', 'Status', 'Authorities Notified', 'Action Taken'];
  const escColWidths = [60, 85, 95, 110, 60, 65, 120, printableWidth - 595];

  const drawMiniHeader = (hdrs: string[], widths: number[], y: number) => {
    doc.setFillColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.rect(margin, y, printableWidth, 16, true, false);

    let x = margin;
    hdrs.forEach((hdr, i) => {
      const w = widths[i];
      doc.setFillColor(255, 255, 255);
      doc.text(hdr, x + 4, y + 11, 'F2', 7.5, 'left', w - 8);
      x += w;
    });
    return y + 16;
  };

  currentY = drawMiniHeader(escHeaders, escColWidths, currentY);

  const escRows = data.escalations.slice(0, 5);
  if (escRows.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, printableWidth, 18, true, false);
    doc.setFillColor(120, 120, 120);
    doc.text('No active urgent escalations recorded for the selected scope.', margin + 8, currentY + 12, 'F1', 8);
    currentY += 18;
  } else {
    escRows.forEach((esc, rIdx) => {
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, 16, true, false);
      }
      doc.setStrokeColor(230, 230, 230);
      doc.setLineWidth(0.3);
      doc.line(margin, currentY + 16, margin + printableWidth, currentY + 16);

      const rowVals = [esc.date, esc.site, esc.resident, esc.type, esc.urgency, esc.status, esc.authorities, esc.action];
      let x = margin;
      rowVals.forEach((val, cIdx) => {
        const w = escColWidths[cIdx];
        doc.setFillColor(36, 36, 36);
        doc.text(String(val || ''), x + 4, currentY + 11, 'F1', 7, 'left', w - 8);
        x += w;
      });
      currentY += 16;
    });
  }

  currentY += 14;

  // Section 2: Active Vulnerable SUs Table
  doc.setFillColor(36, 36, 36);
  doc.text('2. Vulnerable Service User Register Overview', margin, currentY, 'F2', 10);
  currentY += 8;

  const vulHeaders = ['Facility', 'Room', 'Service User', 'Cohort Category', 'Risk Level', 'Key Vulnerability', 'Review Date', 'Assigned Worker'];
  const vulColWidths = [85, 45, 95, 105, 65, 150, 70, printableWidth - 615];

  currentY = drawMiniHeader(vulHeaders, vulColWidths, currentY);

  const vulRows = data.vulnerableSUs.slice(0, 6);
  if (vulRows.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, printableWidth, 18, true, false);
    doc.setFillColor(120, 120, 120);
    doc.text('No active vulnerable records recorded for the selected scope.', margin + 8, currentY + 12, 'F1', 8);
    currentY += 18;
  } else {
    vulRows.forEach((vul, rIdx) => {
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, printableWidth, 16, true, false);
      }
      doc.setStrokeColor(230, 230, 230);
      doc.setLineWidth(0.3);
      doc.line(margin, currentY + 16, margin + printableWidth, currentY + 16);

      const rowVals = [vul.site, vul.room, vul.suName, vul.group, vul.riskLevel, vul.vulnerability, vul.reviewDate, vul.worker];
      let x = margin;
      rowVals.forEach((val, cIdx) => {
        const w = vulColWidths[cIdx];
        doc.setFillColor(36, 36, 36);
        doc.text(String(val || ''), x + 4, currentY + 11, 'F1', 7, 'left', w - 8);
        x += w;
      });
      currentY += 16;
    });
  }

  // Footer
  const footerY = pageHeight - 16;
  doc.setStrokeColor(235, 235, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFillColor(120, 120, 120);
  const timestamp = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString('en-GB');
  doc.text(
    `Official Briefing • Generated: ${timestamp} • Strict Home Office & GDPR Safeguarding Compliance`,
    margin,
    footerY,
    'F1',
    7.5
  );

  doc.text('Page 1 of 1', pageWidth - margin - 50, footerY, 'F1', 7.5);

  const filename = `Safeguarding-Executive-Briefing-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.download(filename);
}
