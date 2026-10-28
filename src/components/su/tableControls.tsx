import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { filterInputCls } from '../common/TrackerToolbar';

/**
 * Sorting and paging for the tracker tables on the Service User pages, so every page behaves like the older trackers:
 * click a heading to sort, choose a page size, and go back to page 1 whenever a filter changes.
 */
export function useTableControls<T>(defaultKey: string, getters: Record<string, (row: T) => string | number>, defaultPageSize = 10) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const sortBy = (key: string) => {
    if (key === sortKey) setAsc(a => !a); else { setSortKey(key); setAsc(true); }
    setPage(1);
  };

  const sortRows = (rows: T[]): T[] => {
    const get = getters[sortKey] || getters[defaultKey];
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      return asc ? cmp : -cmp;
    });
  };

  return { sortKey, asc, sortBy, page, setPage, pageSize, setPageSize: (s: number) => { setPageSize(s); setPage(1); }, sortRows, resetPage: () => setPage(1) };
}

/** A page of rows; the page is clamped so a shrinking list never leaves you on an empty page. */
export function usePaged<T>(rows: T[], page: number, pageSize: number): T[] {
  return useMemo(() => {
    const last = Math.max(1, Math.ceil(rows.length / pageSize));
    const p = Math.min(page, last);
    return rows.slice((p - 1) * pageSize, p * pageSize);
  }, [rows, page, pageSize]);
}

/** The search box used in every tracker header. */
export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative flex-[2] min-w-[140px]">
    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${filterInputCls} pl-7`} aria-label="Search" />
  </div>
);

export const filterSelectCls = filterInputCls;
