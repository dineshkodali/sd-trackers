import React from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ExportDropdown } from './ExportDropdown';
import type { ExportColumnOption, ExportFormat, ExportOrientation, ExportScope } from './ExportModal';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';

export const filterInputCls =
  'w-full flex-1 min-w-0 px-2 py-1 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-[11px] text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed';

/** The same site filter every other tracker page has: all permitted sites, or one; locked for single-site accounts. */
export const SiteFilterSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const { canAccessAllSites, allowedSites } = useApp();
  const locked = !canAccessAllSites() && (allowedSites || []).length <= 1;
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={locked}
      aria-label="Site"
      title={locked ? 'Locked to your assigned site' : 'Filter by site'}
      className={filterInputCls}
    >
      {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
        <option value="all">{canAccessAllSites() ? 'All Properties' : `All Assigned Sites (${allowedSites.length})`}</option>
      )}
      {allowedSites.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
};

/** True when a row's site passes the chosen site filter (and the user's permitted sites). */
export const useSiteMatcher = () => {
  const { isSitePermitted } = useApp();
  return (siteName: string | undefined, filter: string) => isSitePermitted(siteName, filter);
};

export const ToolbarButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; title?: string; disabled?: boolean }> = ({ onClick, icon, label, title, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title || label}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
  >
    {icon}<span>{label}</span>
  </button>
);

export const RefreshButton: React.FC<{ onClick: () => void; loading?: boolean }> = ({ onClick, loading }) => (
  <ToolbarButton onClick={onClick} disabled={loading} label="Refresh" icon={<RefreshCw className={`w-3.5 h-3.5 text-[#0078d4] ${loading ? 'animate-spin' : ''}`} />} />
);

export const ResetFiltersButton: React.FC<{ onClick: () => void; active: boolean }> = ({ onClick, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!active}
    className="flex-none whitespace-nowrap flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-600 hover:text-[#0d9488] border border-[#e5e5e5] rounded-xs bg-white hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
  >
    <RotateCcw className="w-3 h-3" /><span>Reset</span>
  </button>
);

export interface TrackerExportColumn<T> extends ExportColumnOption {
  get: (row: T) => string | number | null | undefined;
}

/**
 * The standard Export button (CSV / PDF, all or filtered rows, column choice, date range) for a tracker table.
 * `dateOf` gives the date used by the "custom date range" scope.
 */
export function TrackerExport<T>({
  moduleName, filename, title, columns, allRows, filteredRows, dateOf
}: {
  moduleName: string;
  filename: string;
  title: string;
  columns: TrackerExportColumn<T>[];
  allRows: T[];
  filteredRows: T[];
  dateOf?: (row: T) => string;
}) {
  const rowsFor = (scope: ExportScope, start?: string, end?: string) => {
    if (scope === 'filtered') return filteredRows;
    if (scope === 'custom' && dateOf && start && end) return allRows.filter(r => { const d = (dateOf(r) || '').slice(0, 10); return d >= start && d <= end; });
    return allRows;
  };
  const build = (scope: ExportScope, selected?: string[], start?: string, end?: string) => {
    const cols = selected && selected.length > 0 ? columns.filter(c => selected.includes(c.id)) : columns;
    return { headers: cols.map(c => c.label), rows: rowsFor(scope, start, end).map(r => cols.map(c => String(c.get(r) ?? ''))) };
  };
  return (
    <ExportDropdown
      moduleName={moduleName}
      totalRecordCount={allRows.length}
      filteredRecordCount={filteredRows.length}
      defaultOrientation="landscape"
      dateRangeRecordCount={dateOf ? (s, e) => rowsFor('custom', s, e).length : undefined}
      availableColumns={columns.map(({ id, label, defaultSelected }) => ({ id, label, defaultSelected }))}
      getPreviewData={({ scope, startDate, endDate, selectedColumns }) => {
        const b = build(scope, selectedColumns, startDate, endDate);
        return { headers: b.headers, rows: b.rows.slice(0, 5) };
      }}
      onExport={({ format, scope, orientation = 'landscape', startDate, endDate, selectedColumns }: {
        format: ExportFormat; scope: ExportScope; orientation: ExportOrientation; startDate?: string; endDate?: string; selectedColumns?: string[];
      }) => {
        const { headers, rows } = build(scope, selectedColumns, startDate, endDate);
        if (format === 'csv') exportTableToCsv({ filename: `${filename}.csv`, headers, rows });
        else exportTableToPdf({ filename: `${filename}.pdf`, title, headers, rows, orientation });
      }}
      buttonVariant="toolbar"
    />
  );
}
