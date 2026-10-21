import React from 'react';
import { SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown, UserCheck, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Pagination } from './Pagination';

/**
 * The layout every tracker page uses: ONE header card (icon, title, count, description, buttons, switchable tabs,
 * summary cards and filters) and, below it, a table panel that fills the page height with the standard pagination.
 */
export interface TrackerTab { id: string; label: string }

export const TabSwitcher: React.FC<{ tabs: TrackerTab[]; active: string; onChange: (id: string) => void; label?: string }> = ({ tabs, active, onChange, label = 'Sections' }) => (
  <div role="tablist" aria-label={label} className="flex items-center gap-1 border-b border-[#e5e5e5] mt-3 -mx-1 overflow-x-auto">
    {tabs.map(t => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={active === t.id}
        onClick={() => onChange(t.id)}
        className={`px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-colors ${active === t.id ? 'border-[#0d9488] text-teal-800' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

export const TrackerHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  countLabel?: string;
  description: React.ReactNode;
  /** Buttons on the right: Customize Table, Export, primary action... */
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  summary?: React.ReactNode;
  notice?: React.ReactNode;
  /** Filter controls (search, site, status...) shown under a divider. */
  filters?: React.ReactNode;
  filtersClassName?: string;
}> = ({ icon, title, countLabel, description, actions, tabs, summary, notice, filters, filtersClassName }) => (
  <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-teal-50 border border-teal-200 text-[#0d9488] rounded-xs">{icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-[#242424] tracking-tight">{title}</h1>
            {countLabel && <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">{countLabel}</span>}
          </div>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
    {tabs}
    {summary}
    {notice}
    {filters && <div className={`mt-4 pt-3 border-t border-[#f0f0f0] ${filtersClassName || 'grid grid-cols-1 sm:grid-cols-3 gap-2.5'}`}>{filters}</div>}
  </div>
);

export const CustomizeTableButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-neutral-50 text-neutral-700 border border-[#e5e5e5] rounded-xs shadow-2xs transition-colors cursor-pointer"
    title="Super Admin: Customize table columns, headers, and fields"
  >
    <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
    <span>Customize Table</span>
  </button>
);

export const PrimaryButton: React.FC<{ onClick: () => void; label: string; icon?: React.ReactNode }> = ({ onClick, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-2xs transition-colors cursor-pointer"
  >
    {icon}<span>{label}</span>
  </button>
);

/** Table card with the standard page height, horizontal scroll and the pagination footer (always shown). */
export const TablePanel: React.FC<{
  children: React.ReactNode;
  totalItems: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  error?: string | null;
  onRetry?: () => void;
  errorTitle?: string;
}> = ({ children, totalItems, page, pageSize, onPage, onPageSize, error, onRetry, errorTitle }) => (
  <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[520px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
    {error ? (
      <div className="flex-1 p-8 text-center">
        <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
        <p className="text-xs font-semibold text-red-700">{errorTitle || 'Could not load the data'}</p>
        <p className="text-[11px] text-neutral-500 mt-1 max-w-xl mx-auto break-words">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#8a8886] rounded-xs text-xs font-semibold bg-white hover:bg-[#f3f2f1] cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        )}
      </div>
    ) : (
      <div className="overflow-x-auto flex-1">{children}</div>
    )}
    <Pagination currentPage={page} pageSize={pageSize} totalItems={totalItems} onPageChange={onPage} onPageSizeChange={onPageSize} />
  </div>
);

export const theadRowCls = 'bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap';
export const tbodyCls = 'divide-y divide-[#edebe9] text-[#323130]';
export const tdCls = 'p-2.5';

export const SortableTh: React.FC<{ label: string; active: boolean; asc: boolean; onSort: () => void }> = ({ label, active, asc, onSort }) => (
  <th className="p-2.5 cursor-pointer hover:bg-[#edebe9] transition-colors" onClick={onSort} aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}>
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      {active ? (asc ? <ArrowUp className="w-3.5 h-3.5 text-[#0078d4]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#0078d4]" />) : <ArrowUpDown className="w-3 h-3 text-[#a19f9d]" />}
    </div>
  </th>
);

export const ActionsTh: React.FC = () => (
  <th className="p-2.5 text-right w-28 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)]">Actions</th>
);
export const actionsTdCls = 'p-2.5 text-right whitespace-nowrap sticky right-0 bg-white/95 backdrop-blur-xs shadow-[-2px_0_4px_rgba(0,0,0,0.04)]';

export const EmptyRow: React.FC<{ colSpan: number; icon: React.ReactNode; title: string; hint?: string }> = ({ colSpan, icon, title, hint }) => (
  <tr>
    <td colSpan={colSpan} className="py-12 text-center text-[#605e5c]">
      <div className="mx-auto mb-2 text-neutral-300 flex justify-center">{icon}</div>
      <p className="font-semibold text-sm text-[#242424]">{title}</p>
      {hint && <p className="text-xs text-[#605e5c] mt-0.5">{hint}</p>}
    </td>
  </tr>
);

export const SkeletonRows: React.FC<{ cols: number; rows?: number }> = ({ cols, rows = 5 }) => (
  <>
    {Array.from({ length: rows }).map((_, i) => (
      <tr key={i}>{Array.from({ length: cols }).map((__, j) => <td key={j} className="p-2.5"><div className="h-3 bg-neutral-100 rounded animate-pulse" /></td>)}</tr>
    ))}
  </>
);

/**
 * "Audit & Accountability" block for record forms: the logged-in user is recorded as the person who added or
 * changed the record, and cannot be edited. Same look as the Reporting Staff Member field on every other form.
 */
export const AuditAccountability: React.FC<{ userName: string; createdBy?: string; updatedBy?: string; updatedAt?: string }> = ({ userName, createdBy, updatedBy, updatedAt }) => (
  <div className="space-y-3">
    <div className="pb-1 border-b border-neutral-200">
      <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Audit &amp; Accountability</h4>
    </div>
    <div className="space-y-1">
      <label className="font-semibold text-[#605e5c] flex items-center justify-between">
        <span className="flex items-center gap-1">
          <UserCheck className="w-3.5 h-3.5 text-teal-600 inline" />
          <span>Reporting Staff Member</span>
        </span>
        <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
          <Lock className="w-2.5 h-2.5 text-teal-600" /> Logged-in User (Locked)
        </span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={userName}
          readOnly
          disabled
          aria-label="Reporting Staff Member"
          className="w-full p-2 pr-8 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
          title="Locked to logged-in user for accountability and audit logs."
        />
        <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
      </div>
      {(createdBy || updatedBy) && (
        <p className="text-[10px] text-neutral-500">
          {createdBy && <>Added by <b>{createdBy}</b>. </>}
          {updatedBy && <>Last updated by <b>{updatedBy}</b>{updatedAt ? ` on ${new Date(updatedAt).toLocaleString('en-GB')}` : ''}.</>}
        </p>
      )}
    </div>
  </div>
);
