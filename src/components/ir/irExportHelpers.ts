import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { IRRecord } from '../../types';

export const irExportColumns: ExportColumnOption[] = [
  { id: 'site', label: 'SITE' },
  { id: 'date', label: 'DATE' },
  { id: 'suName', label: 'SU NAME' },
  { id: 'portRef', label: 'Port Ref' },
  { id: 'incidentTime', label: 'Incident Time' },
  { id: 'irSummary', label: 'IR SUMMARY' },
  { id: 'inFor1stReview', label: 'IN for 1st review' },
  { id: 'ct1stReview', label: 'CT 1ST Review' },
  { id: 'inFor2ndReview', label: 'In for 2nd review' },
  { id: 'ct2ndReview', label: 'CT 2nd review' },
  { id: 'submittedToCrh', label: 'Submitted to CRH' }
];

export const getIRExportDataForScope = (
  scope: ExportScope,
  accessibleRecords: IRRecord[],
  sortedRecords: IRRecord[],
  startDate?: string,
  endDate?: string
) => {
  let sourceData = accessibleRecords;
  if (scope === 'filtered') sourceData = sortedRecords;
  else if (scope === 'custom' && startDate && endDate) {
    sourceData = accessibleRecords.filter(r => {
      const d = r.date || '';
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    });
  }
  return sourceData;
};

export const calculateIRDateRangeCount = (
  accessibleRecords: IRRecord[],
  startDate: string,
  endDate: string
): number => {
  return accessibleRecords.filter(r => {
    const d = r.date || '';
    return (!startDate || d >= startDate) && (!endDate || d <= endDate);
  }).length;
};

export const getIRExportPreviewData = ({
  scope,
  startDate,
  endDate,
  selectedColumns,
  accessibleRecords,
  sortedRecords
}: {
  scope: ExportScope;
  startDate?: string;
  endDate?: string;
  selectedColumns?: string[];
  accessibleRecords: IRRecord[];
  sortedRecords: IRRecord[];
}) => {
  const raw = getIRExportDataForScope(scope, accessibleRecords, sortedRecords, startDate, endDate).slice(0, 5);
  const cols = selectedColumns && selectedColumns.length > 0
    ? irExportColumns.filter(c => selectedColumns.includes(c.id))
    : irExportColumns;
  const headers = cols.map(c => c.label);
  const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));
  return { headers, rows };
};

export const performIRExport = ({
  format,
  scope,
  orientation = 'landscape',
  startDate,
  endDate,
  selectedColumns,
  accessibleRecords,
  sortedRecords
}: {
  format: ExportFormat;
  scope: ExportScope;
  orientation: ExportOrientation;
  startDate?: string;
  endDate?: string;
  selectedColumns?: string[];
  accessibleRecords: IRRecord[];
  sortedRecords: IRRecord[];
}) => {
  const raw = getIRExportDataForScope(scope, accessibleRecords, sortedRecords, startDate, endDate);
  const cols = selectedColumns && selectedColumns.length > 0
    ? irExportColumns.filter(c => selectedColumns.includes(c.id))
    : irExportColumns;
  const headers = cols.map(c => c.label);
  const rows = raw.map(row => cols.map(c => String((row as any)[c.id] ?? '')));

  if (format === 'csv') {
    exportTableToCsv({ filename: 'IR_Tracker_Incident_Reports.csv', headers, rows });
  } else {
    exportTableToPdf({
      filename: 'IR_Tracker_Incident_Reports.pdf',
      title: 'Incident Report (IR) Tracker Dossier',
      headers,
      rows,
      orientation
    });
  }
};
