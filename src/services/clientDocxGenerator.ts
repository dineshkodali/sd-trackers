/**
 * Client-Side DOCX Generator
 *
 * Generates formatted Word documents directly in the browser when running in
 * Direct Supabase mode (e.g. AWS Amplify Hosting without a Node backend).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';

export async function generateClientDocx(liveData: {
  title: string;
  documentNumber?: string;
  site?: string;
  fieldValues?: Record<string, any>;
  fieldDefinitions?: any[];
  layoutConfig?: any;
}): Promise<Blob> {
  const title = liveData.title || 'Document Report';
  const site = liveData.site || 'All Sites';
  const docNum = liveData.documentNumber || `DOC-${new Date().getFullYear()}`;
  const fieldValues = liveData.fieldValues || {};
  const fieldDefs = liveData.fieldDefinitions || [];
  const sections = liveData.layoutConfig?.sections || [];

  const children: (Paragraph | Table)[] = [];

  // Header banner
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 32,
          color: '0D9488',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Site: ${site}  |  Doc #: ${docNum}  |  Date: ${new Date().toLocaleDateString('en-GB')}`,
          color: '64748B',
          size: 20,
        }),
      ],
    })
  );

  // Group fields by section
  const sectionMap = new Map<string, any[]>();
  for (const field of fieldDefs) {
    const secId = field.section || 'general';
    if (!sectionMap.has(secId)) sectionMap.set(secId, []);
    sectionMap.get(secId)!.push(field);
  }

  // Iterate sections
  const effectiveSections = sections.length > 0
    ? sections
    : Array.from(sectionMap.keys()).map(id => ({ id, title: id.charAt(0).toUpperCase() + id.slice(1) }));

  for (const sec of effectiveSections) {
    const fields = sectionMap.get(sec.id) || [];
    if (fields.length === 0) continue;

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({ text: sec.title || 'Section', bold: true, size: 24, color: '115E59' }),
        ],
      })
    );

    const rows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: 'Field', bold: true, size: 18 })] })],
          }),
          new TableCell({
            width: { size: 6000, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true, size: 18 })] })],
          }),
        ],
      }),
    ];

    for (const f of fields) {
      let val = fieldValues[f.name];
      if (val === undefined || val === null || val === '') val = '—';
      else if (typeof val === 'object') val = JSON.stringify(val);
      else val = String(val);

      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: f.label || f.name, bold: true, size: 18 })] })],
            }),
            new TableCell({
              width: { size: 6000, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: val, size: 18 })] })],
            }),
          ],
        })
      );
    }

    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows,
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });

  return await Packer.toBlob(doc);
}

