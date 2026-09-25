/**
 * Document Builder — DOCX Generation
 *
 * Generates professional Word documents using the `docx` npm package.
 * Produces multi-page .docx files with tables, headers, footers,
 * authentic Ready Homes / Clearsprings branding, and flow-based layouts.
 */

import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  ImageRun,
} from 'docx';

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

const BRAND_TEAL = '0D9488';
const BRAND_DARK = '115E59';
const FLUENT_BLACK = '242424';
const FLUENT_MUTED = '605E5C';
const FLUENT_BORDER = 'E1DFDD';

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

function extractEvidencePhotos(fieldValues: Record<string, any>): { name: string; caption?: string; buffer?: Buffer }[] {
  const rawList =
    fieldValues.evidencePhotos ||
    fieldValues.attachments ||
    fieldValues.photos ||
    Object.values(fieldValues).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && ('url' in v[0] || 'dataUrl' in v[0])) ||
    [];

  if (!Array.isArray(rawList)) return [];

  const photos: { name: string; caption?: string; buffer?: Buffer }[] = [];
  rawList.forEach((item, idx) => {
    let urlOrData = typeof item === 'string' ? item : (item.dataUrl || item.url || '');
    let caption = typeof item === 'object' ? (item.caption || item.name || `Photo ${idx + 1}`) : `Photo ${idx + 1}`;
    let name = typeof item === 'object' ? (item.name || `Photo ${idx + 1}`) : `Photo ${idx + 1}`;

    let buf: Buffer | null = null;
    if (urlOrData.startsWith('data:image/')) {
      const base64 = urlOrData.split(',')[1];
      if (base64) {
        try { buf = Buffer.from(base64, 'base64'); } catch {}
      }
    } else if (urlOrData.startsWith('/templates/') || urlOrData.startsWith('templates/')) {
      const cleanPath = urlOrData.startsWith('/') ? urlOrData.slice(1) : urlOrData;
      const fullPath = path.join(process.cwd(), 'public', cleanPath);
      if (fs.existsSync(fullPath)) {
        try { buf = fs.readFileSync(fullPath); } catch {}
      }
    } else if (fs.existsSync(urlOrData)) {
      try { buf = fs.readFileSync(urlOrData); } catch {}
    }

    if (buf) {
      photos.push({ name, caption, buffer: buf });
    }
  });

  return photos;
}

// =============================================================================
// INCIDENT REPORT BUILDER
// =============================================================================
function buildIncidentDocxContent(data: DocData): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];
  const v = data.fieldValues || {};

  // Top Right Ready Homes Logo
  const logo1Path = path.join(process.cwd(), 'public', 'templates', 'incident', 'image1.png');
  if (fs.existsSync(logo1Path)) {
    try {
      const logoBuf = fs.readFileSync(logo1Path);
      content.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: logoBuf,
              transformation: { width: 110, height: 44 },
            }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 60 },
        })
      );
    } catch {}
  }

  // Title: "Incident Report"
  content.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Incident Report', bold: true, size: 30, color: '000000', font: 'Arial' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 80 },
    })
  );

  // Instructions
  content.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Please complete with as much detail as possible, stating only facts.  Please email ',
          size: 18, color: '000000', font: 'Arial',
        }),
        new TextRun({
          text: 'CST@Clearsprings.co.uk',
          size: 18, color: '0000EE', underline: {}, font: 'Arial',
        }),
        new TextRun({
          text: ' who will review and send it to UKVI where appropriate.',
          size: 18, color: '000000', font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Parse people
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

  // Table Grid widths: total ~9600 twips (A4 printable width)
  const COL_TOTAL = 9600;
  const COL_0 = Math.round(COL_TOTAL * 0.3502); // 3362
  const COL_REST = COL_TOTAL - COL_0; // 6238
  const COL_1 = Math.round(COL_TOTAL * 0.2166); // 2079
  const COL_2 = Math.round(COL_TOTAL * 0.1729); // 1660
  const COL_3 = COL_TOTAL - COL_0 - COL_1 - COL_2; // 2499

  const cellBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

  const tableRows: TableRow[] = [];

  function make2ColRow(label: string, value: string | string[], isBullet = false): TableRow {
    const rightParas: Paragraph[] = [];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        rightParas.push(new Paragraph({ children: [new TextRun({ text: isBullet ? '• ' : '', bold: isBullet, font: 'Arial', size: 18 })] }));
      } else {
        value.forEach(line => {
          rightParas.push(
            new Paragraph({
              children: [
                new TextRun({ text: isBullet ? '• ' : '', bold: isBullet, font: 'Arial', size: 18 }),
                new TextRun({ text: line, font: 'Arial', size: 18 }),
              ],
              spacing: { after: 40 },
            })
          );
        });
      }
    } else {
      rightParas.push(
        new Paragraph({
          children: [new TextRun({ text: value || '', font: 'Arial', size: 18 })],
        })
      );
    }

    return new TableRow({
      children: [
        new TableCell({
          width: { size: COL_0, type: WidthType.DXA },
          borders: allBorders,
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 18 })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          width: { size: COL_REST, type: WidthType.DXA },
          columnSpan: 3,
          borders: allBorders,
          children: rightParas,
        }),
      ],
    });
  }

  // Row 1-3: Metadata
  tableRows.push(make2ColRow('Property ID', String(v.propertyId || data.site || '')));
  tableRows.push(make2ColRow('Person Reporting', String(v.personReporting || '')));
  tableRows.push(make2ColRow('Date of Incident', String(v.dateOfIncident || '')));

  // Offenders
  if (offenders.length === 0) {
    tableRows.push(make2ColRow('Offenders (Name/Port)', ''));
  } else {
    offenders.forEach((o: any, idx: number) => {
      const lbl = idx === 0 ? 'Offenders (Name/Port)' : `Offender (${idx + 1})`;
      const val = `${o.name || ''} ${o.portRef ? `(${o.portRef})` : ''}`.trim();
      tableRows.push(make2ColRow(lbl, val));
    });
  }

  // Victims
  if (victims.length === 0) {
    tableRows.push(make2ColRow('Victims (Name/Port)', ''));
  } else {
    victims.forEach((vic: any, idx: number) => {
      const lbl = idx === 0 ? 'Victims (Name/Port)' : `Victim (${idx + 1})`;
      const val = `${vic.name || ''} ${vic.portRef ? `(${vic.portRef})` : ''}`.trim();
      tableRows.push(make2ColRow(lbl, val));
    });
  }

  // Witnesses
  if (witnesses.length === 0) {
    tableRows.push(make2ColRow('Witnesses (SUs) (Name/Port)', ''));
  } else {
    witnesses.forEach((w: any, idx: number) => {
      const lbl = idx === 0 ? 'Witnesses (SUs) (Name/Port)' : `Witness (${idx + 1})`;
      const val = `${w.name || ''} ${w.portRef ? `(${w.portRef})` : ''}`.trim();
      tableRows.push(make2ColRow(lbl, val));
    });
  }

  // Incident Description & Action Taken
  tableRows.push(make2ColRow('Incident Description', descLines, true));
  tableRows.push(make2ColRow('Action Taken', actionLines, true));

  // 4-Column Row Helper
  function make4ColRow(label: string, v1 = '', v2 = '', v3 = ''): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: COL_0, type: WidthType.DXA },
          borders: allBorders,
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, font: 'Arial', size: 18 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: COL_1, type: WidthType.DXA },
          borders: allBorders,
          children: [new Paragraph({ children: [new TextRun({ text: v1, font: 'Arial', size: 18 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: COL_2, type: WidthType.DXA },
          borders: allBorders,
          children: [new Paragraph({ children: [new TextRun({ text: v2, font: 'Arial', size: 18 })], alignment: AlignmentType.CENTER })],
        }),
        new TableCell({
          width: { size: COL_3, type: WidthType.DXA },
          borders: allBorders,
          children: [new Paragraph({ children: [new TextRun({ text: v3, font: 'Arial', size: 18 })], alignment: AlignmentType.CENTER })],
        }),
      ],
    });
  }

  // Warning Letter Row
  const cleanVal = (val: any) => (val && val !== 'N/A' && val !== 'n/a') ? String(val) : '';
  tableRows.push(make4ColRow('Warning Letter Issued?', cleanVal(v.warningLetterIssued), cleanVal(v.warningLetterToWhom), ''));

  // Grey Divider Bar
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          width: { size: COL_TOTAL, type: WidthType.DXA },
          columnSpan: 4,
          shading: { type: ShadingType.CLEAR, fill: 'BFBFBF' },
          borders: allBorders,
          children: [new Paragraph({ text: '', spacing: { before: 40, after: 40 } })],
        }),
      ],
    })
  );

  // Authority Rows
  tableRows.push(make4ColRow('Safeguarding Informed?', cleanVal(v.safeguardingInformed), cleanVal(v.safeguardingWho), ''));
  tableRows.push(make4ColRow('Police Involved?', cleanVal(v.policeInvolved), cleanVal(v.policeCadRef), ''));
  tableRows.push(make4ColRow('Ambulance Involved?', cleanVal(v.ambulanceInvolved), cleanVal(v.ambulanceCadRef), ''));
  tableRows.push(make4ColRow('Fire Service Involved?', cleanVal(v.fireServiceInvolved), cleanVal(v.fireCadRef), ''));

  content.push(
    new Table({
      width: { size: COL_TOTAL, type: WidthType.DXA },
      rows: tableRows,
    })
  );

  // Evidence footnote
  content.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Please attach photos of any evidence where possible when submitting to CST.',
          font: 'Arial', size: 17, italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 140, after: 120 },
    })
  );

  // Evidence Photographs Gallery (matches Preview exactly)
  const photos = extractEvidencePhotos(v);
  if (photos.length > 0) {
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'EVIDENCE PHOTOGRAPHS & ATTACHMENTS',
            bold: true,
            size: 20,
            font: 'Arial',
            color: '000000',
          }),
        ],
        spacing: { before: 240, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
      })
    );

    const cellW = Math.round(COL_TOTAL / 2);
    const photoRows: TableRow[] = [];

    for (let i = 0; i < photos.length; i += 2) {
      const p1 = photos[i];
      const p2 = photos[i + 1];

      const makeCell = (p?: { name: string; caption?: string; buffer?: Buffer }) => {
        if (!p || !p.buffer) {
          return new TableCell({
            width: { size: cellW, type: WidthType.DXA },
            borders: allBorders,
            children: [new Paragraph({ text: '' })],
          });
        }
        return new TableCell({
          width: { size: cellW, type: WidthType.DXA },
          borders: allBorders,
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: p.buffer,
                  transformation: { width: 220, height: 140 },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 60 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: p.caption || p.name,
                  font: 'Arial',
                  size: 16,
                  color: '333333',
                  bold: true,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
            }),
          ],
        });
      };

      photoRows.push(
        new TableRow({
          children: [makeCell(p1), makeCell(p2)],
        })
      );
    }

    content.push(
      new Table({
        width: { size: COL_TOTAL, type: WidthType.DXA },
        rows: photoRows,
      })
    );
  }

  return content;
}

// =============================================================================
// STANDARD TEMPLATE BUILDER
// =============================================================================
function createStandardHeader(data: DocData): Header {
  const children: Paragraph[] = [];
  const hc = data.headerConfig || {};

  if (hc.showCompanyName !== false) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'SD COMMERCIAL', bold: true, size: 28, color: BRAND_DARK, font: 'Calibri' }),
          new TextRun({ text: '  Operations & Compliance', size: 20, color: BRAND_TEAL, font: 'Calibri' }),
        ],
        spacing: { after: 40 },
      })
    );
  }

  if (hc.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: hc.subtitle, size: 18, color: FLUENT_MUTED, font: 'Calibri', italics: true })],
        spacing: { after: 80 },
      })
    );
  }

  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_TEAL } },
      spacing: { after: 120 },
    })
  );

  return new Header({ children });
}

function createStandardFooter(data: DocData): Footer {
  const fc = data.footerConfig || {};
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: FLUENT_BORDER } },
      spacing: { before: 80 },
    })
  );

  const footerRuns: TextRun[] = [];
  if (fc.customText) {
    footerRuns.push(new TextRun({ text: fc.customText, size: 14, color: FLUENT_MUTED, font: 'Calibri' }));
  }

  footerRuns.push(new TextRun({ text: '   |   Page ', size: 14, color: FLUENT_MUTED, font: 'Calibri' }));
  footerRuns.push(new TextRun({ children: [PageNumber.CURRENT], size: 14, color: FLUENT_MUTED, font: 'Calibri' }));
  footerRuns.push(new TextRun({ text: ' of ', size: 14, color: FLUENT_MUTED, font: 'Calibri' }));
  footerRuns.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: FLUENT_MUTED, font: 'Calibri' }));

  children.push(
    new Paragraph({
      children: footerRuns,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 40 },
    })
  );

  return new Footer({ children });
}

function createIncidentFooter(): Footer {
  const logo2Path = path.join(process.cwd(), 'public', 'templates', 'incident', 'image2.png');
  const leftRuns: (TextRun | ImageRun)[] = [];
  if (fs.existsSync(logo2Path)) {
    try {
      leftRuns.push(
        new ImageRun({
          data: fs.readFileSync(logo2Path),
          transformation: { width: 90, height: 26 },
        })
      );
    } catch {}
  }

  const colW = Math.round(9600 / 3);
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  return new Footer({
    children: [
      new Table({
        width: { size: 9600, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: colW, type: WidthType.DXA },
                borders: noBorders,
                children: [
                  new Paragraph({
                    children: leftRuns,
                    alignment: AlignmentType.LEFT,
                  }),
                ],
              }),
              new TableCell({
                width: { size: colW, type: WidthType.DXA },
                borders: noBorders,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Page ', size: 14, color: '666666', font: 'Arial' }),
                      new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '666666', font: 'Arial' }),
                      new TextRun({ text: ' of ', size: 14, color: '666666', font: 'Arial' }),
                      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '666666', font: 'Arial' }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
              new TableCell({
                width: { size: colW, type: WidthType.DXA },
                borders: noBorders,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'A Clearsprings Group company — Ready Homes Limited\nRegistered office: 26 Brook Road, Rayleigh SS6 7XJ | Reg in England & Wales 7921508',
                        size: 13,
                        color: '666666',
                        font: 'Arial',
                      }),
                    ],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function generateDocx(data: DocData): Promise<Buffer> {
  const isIncident =
    data.templateName === 'Incident Report' ||
    data.title.toLowerCase().includes('incident') ||
    (data.fieldDefinitions || []).some((f: any) => f.name === 'propertyId');

  const margins = isIncident
    ? { top: 20, right: 20, bottom: 20, left: 20 }
    : (data.layoutConfig?.margins || { top: 25, right: 20, bottom: 25, left: 20 });

  if (isIncident) {
    const doc = new Document({
      creator: 'Clearsprings Ready Homes',
      title: data.title,
      description: `${data.templateName} — ${data.documentNumber}`,
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(margins.top / 25.4),
              right: convertInchesToTwip(margins.right / 25.4),
              bottom: convertInchesToTwip(margins.bottom / 25.4),
              left: convertInchesToTwip(margins.left / 25.4),
            },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        footers: { default: createIncidentFooter() },
        children: buildIncidentDocxContent(data),
      }],
    });
    return Packer.toBuffer(doc);
  }

  // Standard Template DOCX
  const sections: any[] = data.layoutConfig?.sections || [];
  const fields = data.fieldDefinitions || [];
  const values = data.fieldValues || {};
  const standardContent: Paragraph[] = [];

  standardContent.push(
    new Paragraph({
      children: [new TextRun({ text: data.title, bold: true, size: 32, color: FLUENT_BLACK, font: 'Calibri' })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
    })
  );

  const metaItems = [
    data.documentNumber ? `Document No: ${data.documentNumber}` : '',
    `Site: ${data.site}`,
    `Date: ${formatDate(data.createdAt)}`,
  ].filter(Boolean);

  standardContent.push(
    new Paragraph({
      children: [new TextRun({ text: metaItems.join('   |   '), size: 16, color: FLUENT_MUTED, font: 'Calibri' })],
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: FLUENT_BORDER } },
    })
  );

  const sortedSections = [...sections].sort((a: any, b: any) => a.order - b.order);
  for (const sec of sortedSections) {
    standardContent.push(
      new Paragraph({
        children: [new TextRun({ text: sec.title.toUpperCase(), bold: true, size: 22, color: BRAND_DARK, font: 'Calibri' })],
        spacing: { before: 200, after: 60 },
      })
    );
    const secFields = fields.filter((f: any) => f.section === sec.id).sort((a: any, b: any) => a.order - b.order);
    for (const f of secFields) {
      const val = values[f.name];
      const disp = val !== undefined && val !== null && val !== '' ? (Array.isArray(val) ? `${val.length} entries` : String(val)) : '—';
      standardContent.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${f.label}: `, bold: true, size: 20, color: FLUENT_BLACK, font: 'Calibri' }),
            new TextRun({ text: disp, size: 20, color: disp === '—' ? 'A19F9D' : FLUENT_BLACK, font: 'Calibri' }),
          ],
          spacing: { after: 80 },
        })
      );
    }
  }

  const doc = new Document({
    creator: 'SD Commercial - SDTracker',
    title: data.title,
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(margins.top / 25.4),
            right: convertInchesToTwip(margins.right / 25.4),
            bottom: convertInchesToTwip(margins.bottom / 25.4),
            left: convertInchesToTwip(margins.left / 25.4),
          },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: createStandardHeader(data) },
      footers: { default: createStandardFooter(data) },
      children: standardContent,
    }],
  });

  return Packer.toBuffer(doc);
}
