/**
 * Document Flow & Pagination Engine
 *
 * Implements flow-based pagination for SDTracker A4 documents.
 * Never clips, never truncates, never overlaps content.
 * Dynamically computes pages based on text length, repeating groups,
 * and attachment items.
 */

export interface FlowPerson {
  id: string;
  name: string;
  portRef?: string;
  role?: string;
}

export interface FlowAttachment {
  id: string;
  name: string;
  url?: string;
  dataUrl?: string;
  caption?: string;
  date?: string;
}

export interface IncidentDocData {
  propertyId: string;
  personReporting: string;
  dateOfIncident: string;
  offenders: FlowPerson[];
  victims: FlowPerson[];
  witnesses: FlowPerson[];
  incidentDescription: string[];
  actionTaken: string[];
  warningLetterIssued: string;
  warningLetterToWhom: string;
  warningLetterNotes?: string;
  safeguardingInformed: string;
  safeguardingWho: string;
  safeguardingNotes?: string;
  policeInvolved: string;
  policeCadRef: string;
  policeNotes?: string;
  ambulanceInvolved: string;
  ambulanceCadRef: string;
  ambulanceNotes?: string;
  fireServiceInvolved: string;
  fireCadRef: string;
  fireNotes?: string;
  evidencePhotos: FlowAttachment[];
  customSections?: CustomSectionData[];
}

export interface CustomFieldItem {
  id: string;
  name: string;
  label: string;
  type: string;
  value: any;
  displayValue: string;
  width?: 'full' | 'half';
}

export interface CustomSectionData {
  id: string;
  title: string;
  columns?: 1 | 2;
  fields: CustomFieldItem[];
}

export type PageBlockType =
  | 'metadata_table'
  | 'offenders_rows'
  | 'victims_rows'
  | 'witnesses_rows'
  | 'incident_description'
  | 'action_taken'
  | 'authorities_table'
  | 'custom_section'
  | 'evidence_gallery'
  | 'evidence_instruction';

export interface PageBlock {
  type: PageBlockType;
  title?: string;
  isContinued?: boolean;
  data: any;
  estimatedHeight: number;
}

export interface ComputedPage {
  pageNumber: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  blocks: PageBlock[];
}

// Pixel dimensions on A4 at standard preview scale (595px x 842px)
const A4_HEIGHT = 842;
const TOP_PADDING_FIRST = 32;
const TOP_PADDING_OTHER = 24;
const BOTTOM_PADDING = 30;
const HEADER_HEIGHT_FIRST = 110; // Ready Homes logo + title + instructions + spacing
const RUNNING_HEADER_HEIGHT = 32; // Page 2+ running header
const FOOTER_HEIGHT = 65; // Clearsprings logo + registered address + safety padding

// Real usable table space:
// Page 1: 842 - 32 - 30 - 110 - 65 = 605px; with safety padding for aesthetic breathing room = 510px
const USABLE_HEIGHT_PAGE_1 = 510;
// Page 2+: 842 - 24 - 30 - 32 - 65 = 691px; with safety padding = 660px
const USABLE_HEIGHT_PAGE_N = 660;

/**
 * Normalizes field values into a structured IncidentDocData object
 */
export function normalizeIncidentData(
  fieldValues: Record<string, any>,
  site?: string,
  fieldDefinitions?: any[],
  layoutConfig?: any
): IncidentDocData {
  const parsePeople = (val: any): FlowPerson[] => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val
        .filter(item => item && (item.name || item.portRef || typeof item === 'string'))
        .map((item, idx) => {
          if (typeof item === 'string') {
            const parts = item.split(/[/(]/);
            return {
              id: `p-${idx}`,
              name: parts[0]?.trim() || item,
              portRef: parts[1]?.replace(/[)\]]/g, '').trim() || '',
            };
          }
          return {
            id: item.id || `p-${idx}`,
            name: item.name || '',
            portRef: item.portRef || '',
            role: item.role,
          };
        });
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === 'N/A' || trimmed === 'n/a') return [];
      const lines = trimmed.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      return lines.map((line, idx) => {
        const parts = line.split(/[/(]/);
        return {
          id: `p-${idx}`,
          name: parts[0]?.trim() || line,
          portRef: parts[1]?.replace(/[)\]]/g, '').trim() || '',
        };
      });
    }
    return [];
  };

  const parseLines = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).filter(s => s.trim().length > 0);
    const str = String(val).trim();
    if (!str || str === 'N/A') return [];
    return str
      .split('\n')
      .map(line => line.trim().replace(/^[•\-\*]\s*/, ''))
      .filter(line => line.length > 0);
  };

  const parseAttachments = (val: any): FlowAttachment[] => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `att-${idx}`, name: `Photo ${idx + 1}`, url: item };
        }
        return {
          id: item.id || `att-${idx}`,
          name: item.name || `Photo ${idx + 1}`,
          url: item.url,
          dataUrl: item.dataUrl,
          caption: item.caption,
          date: item.date,
        };
      });
    }
    return [];
  };

  const standardFieldNames = new Set([
    'propertyId',
    'locationDetail',
    'personReporting',
    'reportedBy',
    'dateOfIncident',
    'incidentDate',
    'offenders',
    'victims',
    'witnesses',
    'incidentDescription',
    'description',
    'actionTaken',
    'immediateAction',
    'warningLetterIssued',
    'warningLetterToWhom',
    'warningLetterNotes',
    'safeguardingInformed',
    'safeguardingWho',
    'safeguardingNotes',
    'policeInvolved',
    'policeCadRef',
    'policeNotes',
    'ambulanceInvolved',
    'ambulanceCadRef',
    'ambulanceNotes',
    'fireServiceInvolved',
    'fireCadRef',
    'fireNotes',
    'evidencePhotos',
    'attachments',
    'photos',
  ]);

  const customSections: CustomSectionData[] = [];
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

  const layoutSections = layoutConfig?.sections || [];
  const customSectionDefs = layoutSections.filter(s => !standardSectionIds.has(s.id));
  const customFields = (fieldDefinitions || []).filter(f => !standardFieldNames.has(f.name));

  const secFieldMap = new Map<string, CustomFieldItem[]>();
  customFields.forEach(f => {
    const val = fieldValues[f.name];
    const hasVal = val !== undefined && val !== null && val !== '';
    const displayValue = hasVal ? (Array.isArray(val) ? `${val.length} items` : String(val)) : '—';
    const item: CustomFieldItem = {
      id: f.id,
      name: f.name,
      label: f.label || f.name,
      type: f.type || 'text',
      value: val,
      displayValue,
      width: f.width,
    };

    const secId = f.section || 'custom';
    if (!secFieldMap.has(secId)) {
      secFieldMap.set(secId, []);
    }
    secFieldMap.get(secId)!.push(item);
  });

  const processedSecIds = new Set<string>();

  // 1. Add all explicitly created user sections (even if empty!)
  customSectionDefs.forEach(s => {
    processedSecIds.add(s.id);
    const fields = secFieldMap.get(s.id) || [];
    customSections.push({
      id: s.id,
      title: s.title || 'Section',
      columns: s.columns || 2,
      fields,
    });
  });

  // 2. Add any custom fields assigned to existing or orphan sections
  secFieldMap.forEach((fields, secId) => {
    if (!processedSecIds.has(secId)) {
      const existingSec = layoutSections.find((s: any) => s.id === secId);
      customSections.push({
        id: secId,
        title: existingSec?.title ? `${existingSec.title} (Additional Fields)` : 'Additional Information',
        columns: existingSec?.columns || 2,
        fields,
      });
    }
  });

  return {
    propertyId: String(fieldValues.propertyId || fieldValues.locationDetail || site || ''),
    personReporting: String(fieldValues.personReporting || fieldValues.reportedBy || ''),
    dateOfIncident: String(fieldValues.dateOfIncident || fieldValues.incidentDate || ''),
    offenders: parsePeople(fieldValues.offenders),
    victims: parsePeople(fieldValues.victims),
    witnesses: parsePeople(fieldValues.witnesses),
    incidentDescription: parseLines(fieldValues.incidentDescription || fieldValues.description),
    actionTaken: parseLines(fieldValues.actionTaken || fieldValues.immediateAction),
    warningLetterIssued: String(fieldValues.warningLetterIssued || ''),
    warningLetterToWhom: String(fieldValues.warningLetterToWhom || ''),
    warningLetterNotes: fieldValues.warningLetterNotes ? String(fieldValues.warningLetterNotes) : undefined,
    safeguardingInformed: String(fieldValues.safeguardingInformed || ''),
    safeguardingWho: String(fieldValues.safeguardingWho || ''),
    safeguardingNotes: fieldValues.safeguardingNotes ? String(fieldValues.safeguardingNotes) : undefined,
    policeInvolved: String(fieldValues.policeInvolved || ''),
    policeCadRef: String(fieldValues.policeCadRef || ''),
    policeNotes: fieldValues.policeNotes ? String(fieldValues.policeNotes) : undefined,
    ambulanceInvolved: String(fieldValues.ambulanceInvolved || ''),
    ambulanceCadRef: String(fieldValues.ambulanceCadRef || ''),
    ambulanceNotes: fieldValues.ambulanceNotes ? String(fieldValues.ambulanceNotes) : undefined,
    fireServiceInvolved: String(fieldValues.fireServiceInvolved || ''),
    fireCadRef: String(fieldValues.fireCadRef || ''),
    fireNotes: fieldValues.fireNotes ? String(fieldValues.fireNotes) : undefined,
    evidencePhotos: parseAttachments(
      fieldValues.evidencePhotos ||
      fieldValues.attachments ||
      fieldValues.photos ||
      Object.values(fieldValues).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && ('url' in v[0] || 'dataUrl' in v[0]))
    ),
    customSections,
  };
}

/**
 * Calculates line height estimation for text blocks
 */
function estimateTextLinesHeight(lines: string[], minHeight = 44): number {
  if (!lines || lines.length === 0) return minHeight;
  let totalLines = 0;
  for (const line of lines) {
    // approx 60 characters per line in table column width
    const wrapped = Math.max(1, Math.ceil(line.length / 58));
    totalLines += wrapped;
  }
  return Math.max(minHeight, totalLines * 16 + 12);
}

/**
 * Core flow calculation: distributes all document components across A4 pages
 */
export function computeIncidentPages(data: IncidentDocData): ComputedPage[] {
  const pages: ComputedPage[] = [];

  let currentPageBlocks: PageBlock[] = [];
  let currentRemainingHeight = USABLE_HEIGHT_PAGE_1;
  let pageIdx = 1;

  const pushCurrentPage = () => {
    pages.push({
      pageNumber: pageIdx,
      isFirstPage: pageIdx === 1,
      isLastPage: false,
      blocks: currentPageBlocks,
    });
    pageIdx++;
    currentPageBlocks = [];
    currentRemainingHeight = USABLE_HEIGHT_PAGE_N;
  };

  // 1. Initial Metadata Table (Property ID, Person Reporting, Date of Incident)
  const metaHeight = 3 * 22; // 66px
  currentPageBlocks.push({
    type: 'metadata_table',
    data: {
      propertyId: data.propertyId,
      personReporting: data.personReporting,
      dateOfIncident: data.dateOfIncident,
    },
    estimatedHeight: metaHeight,
  });
  currentRemainingHeight -= metaHeight;

  // 2. Helper for Repeating People Groups (Offenders, Victims, Witnesses)
  const addPeopleGroup = (
    type: 'offenders_rows' | 'victims_rows' | 'witnesses_rows',
    title: string,
    people: FlowPerson[]
  ) => {
    const rowHeight = 22;
    const items = people.length > 0 ? people : [{ id: 'empty-1', name: '', portRef: '' }];

    let currentIndex = 0;
    while (currentIndex < items.length) {
      const remainingRows = items.slice(currentIndex);
      const neededHeight = remainingRows.length * rowHeight;

      if (neededHeight <= currentRemainingHeight || currentRemainingHeight >= rowHeight * 2) {
        // Fits either completely or partially
        const maxRowsCanFit = Math.max(1, Math.floor(currentRemainingHeight / rowHeight));
        const rowsToTake = Math.min(remainingRows.length, maxRowsCanFit);
        const batch = remainingRows.slice(0, rowsToTake);

        currentPageBlocks.push({
          type,
          title,
          isContinued: currentIndex > 0,
          data: { people: batch, totalInGroup: items.length, startIndex: currentIndex },
          estimatedHeight: batch.length * rowHeight,
        });

        currentRemainingHeight -= batch.length * rowHeight;
        currentIndex += rowsToTake;

        if (currentIndex < items.length) {
          pushCurrentPage();
        }
      } else {
        // Not enough room for at least 2 rows on this page, push to next
        pushCurrentPage();
      }
    }
  };

  addPeopleGroup('offenders_rows', 'Offenders (Name/Port)', data.offenders);
  addPeopleGroup('victims_rows', 'Victims (Name/Port)', data.victims);
  addPeopleGroup('witnesses_rows', 'Witnesses (SUs) (Name/Port)', data.witnesses);

  // 3. Helper for Flowing Text Blocks (Incident Description, Action Taken)
  const addTextBlock = (
    type: 'incident_description' | 'action_taken',
    title: string,
    lines: string[],
    defaultMinHeight: number
  ) => {
    if (lines.length === 0) {
      if (currentRemainingHeight < defaultMinHeight) pushCurrentPage();
      currentPageBlocks.push({
        type,
        title,
        data: { lines: [] },
        estimatedHeight: defaultMinHeight,
      });
      currentRemainingHeight -= defaultMinHeight;
      return;
    }

    let lineIndex = 0;
    while (lineIndex < lines.length) {
      // Find how many lines can fit in currentRemainingHeight
      let batch: string[] = [];
      let batchHeight = 0;

      while (lineIndex < lines.length) {
        const nextLine = lines[lineIndex];
        const nextLineHeight = Math.max(1, Math.ceil(nextLine.length / 58)) * 16 + 6;

        if (batchHeight + nextLineHeight <= currentRemainingHeight || batch.length === 0) {
          batch.push(nextLine);
          batchHeight += nextLineHeight;
          lineIndex++;
        } else {
          break;
        }
      }

      batchHeight = Math.max(batchHeight, defaultMinHeight);

      if (batch.length > 0) {
        currentPageBlocks.push({
          type,
          title,
          isContinued: lineIndex > batch.length,
          data: { lines: batch },
          estimatedHeight: batchHeight,
        });
        currentRemainingHeight -= batchHeight;

        if (lineIndex < lines.length) {
          pushCurrentPage();
        }
      } else {
        pushCurrentPage();
      }
    }
  };

  addTextBlock('incident_description', 'Incident Description', data.incidentDescription, 58);
  addTextBlock('action_taken', 'Action Taken', data.actionTaken, 48);

  // 4. Authorities Table & Divider Bar
  const authoritiesHeight = 22 * 5 + 14; // Warning letter + grey bar + 4 authority rows = 124px
  if (currentRemainingHeight < authoritiesHeight) {
    pushCurrentPage();
  }

  currentPageBlocks.push({
    type: 'authorities_table',
    data: {
      warningLetterIssued: data.warningLetterIssued,
      warningLetterToWhom: data.warningLetterToWhom,
      warningLetterNotes: data.warningLetterNotes,
      safeguardingInformed: data.safeguardingInformed,
      safeguardingWho: data.safeguardingWho,
      safeguardingNotes: data.safeguardingNotes,
      policeInvolved: data.policeInvolved,
      policeCadRef: data.policeCadRef,
      policeNotes: data.policeNotes,
      ambulanceInvolved: data.ambulanceInvolved,
      ambulanceCadRef: data.ambulanceCadRef,
      ambulanceNotes: data.ambulanceNotes,
      fireServiceInvolved: data.fireServiceInvolved,
      fireCadRef: data.fireCadRef,
      fireNotes: data.fireNotes,
    },
    estimatedHeight: authoritiesHeight,
  });
  currentRemainingHeight -= authoritiesHeight;

  // 5. Custom Sections & Fields (Added in Customize Mode)
  if (data.customSections && data.customSections.length > 0) {
    data.customSections.forEach(sec => {
      const fieldCount = sec.fields.length;
      const sectionHeight = 24 + Math.max(1, fieldCount) * 22;

      if (currentRemainingHeight < Math.min(sectionHeight, 60)) {
        pushCurrentPage();
      }

      currentPageBlocks.push({
        type: 'custom_section',
        title: sec.title,
        data: sec,
        estimatedHeight: sectionHeight,
      });
      currentRemainingHeight -= sectionHeight;
    });
  }

  // 6. Evidence Instruction Note
  const noteHeight = 24;
  currentPageBlocks.push({
    type: 'evidence_instruction',
    data: {},
    estimatedHeight: noteHeight,
  });
  currentRemainingHeight -= noteHeight;

  // 6. Evidence Photos (if user attached photos)
  if (data.evidencePhotos && data.evidencePhotos.length > 0) {
    const photoRowHeight = 120;
    const neededForPhotos = Math.ceil(data.evidencePhotos.length / 2) * photoRowHeight + 35;

    if (currentRemainingHeight < 140) {
      pushCurrentPage();
    }

    currentPageBlocks.push({
      type: 'evidence_gallery',
      title: 'Evidence & Photographs',
      data: { photos: data.evidencePhotos },
      estimatedHeight: Math.min(neededForPhotos, currentRemainingHeight),
    });
    currentRemainingHeight -= neededForPhotos;
  }

  // Push the final page
  if (currentPageBlocks.length > 0) {
    pages.push({
      pageNumber: pageIdx,
      isFirstPage: pageIdx === 1,
      isLastPage: true,
      blocks: currentPageBlocks,
    });
  }

  // Mark isLastPage on the true last page
  if (pages.length > 0) {
    pages[pages.length - 1].isLastPage = true;
  }

  return pages;
}
