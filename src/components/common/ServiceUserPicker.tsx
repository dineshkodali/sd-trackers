import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch as Search, IconX as X } from '@tabler/icons-react';
import { useServiceUserProfiles } from '../../hooks/useServiceUserProfiles';
import { listSelectableProfiles, resolveServiceUserProfile, type ServiceUserProfile } from '../../utils/serviceUserProfile';

interface Props {
  /** The stored Service User id */
  value?: string;
  /** Old free-text value on a record saved before pickers existed; shown so nothing looks lost, never saved as an id */
  legacyText?: string;
  onChange: (profile: ServiceUserProfile | null) => void;
  /** Only offer people placed at this site (a form's own site field) */
  siteId?: string;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  placeholder?: string;
  id?: string;
}

const label = (p: ServiceUserProfile) =>
  [p.fullName, p.externalReference || p.suReference, p.roomNumber ? `Room ${p.roomNumber}` : '', p.siteName].filter(Boolean).join(' · ');

/**
 * The one Service User picker. Searchable by name, SU reference, port reference and room; lists only current,
 * non-archived people in the user's own sites; returns the whole profile so the form can autofill (see useServiceUserSelection).
 * It never creates a person.
 */
export const ServiceUserPicker: React.FC<Props> = ({ value, legacyText, onChange, siteId, disabled, required, hasError, placeholder = 'Search by name, reference or room…', id }) => {
  const { data, loading, error, scope } = useServiceUserProfiles(siteId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = useMemo(() => (data && value ? resolveServiceUserProfile(value, data) : null), [data, value]);
  const results = useMemo(() => (data && open ? listSelectableProfiles(data, scope, query).slice(0, 50) : []), [data, scope, query, open]);

  const baseCls = `w-full px-2.5 py-2 border rounded-xs bg-white text-xs text-[#323130] ${hasError ? 'border-red-500' : 'border-[#8a8886]'} ${disabled ? 'bg-neutral-100 cursor-not-allowed' : ''}`;

  return (
    <div ref={box} className="relative">
      {value && selected && !open ? (
        <div className={`${baseCls} flex items-center justify-between gap-2`}>
          <span className="truncate" title={label(selected)}>
            {label(selected)}
            {selected.archived && <span className="ml-1 text-amber-700">(archived)</span>}
            {!selected.placed && <span className="ml-1 text-amber-700">(not currently placed)</span>}
          </span>
          {!disabled && (
            <button type="button" aria-label="Clear Service User" onClick={() => { onChange(null); setQuery(''); }} className="shrink-0 p-0.5 hover:bg-[#edebe9] rounded-xs cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            required={required && !value}
            disabled={disabled}
            value={query}
            placeholder={value && !selected ? 'Service User not found in your sites' : placeholder}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            className={`${baseCls} pl-8`}
          />
        </div>
      )}

      {!value && legacyText && (
        <p className="mt-1 text-[11px] text-amber-700">Saved earlier as text: “{legacyText}”. Pick the Service User to link this record to their profile.</p>
      )}
      {error && <p role="alert" className="mt-1 text-[11px] text-red-700">{error}</p>}
      {loading && !data && <p className="mt-1 text-[11px] text-neutral-500" aria-busy="true">Loading Service Users…</p>}

      {open && !disabled && (
        <ul role="listbox" className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-auto bg-white border border-[#c8c6c4] rounded-xs shadow-md">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[#605e5c]">{loading && !data ? 'Loading…' : query ? 'No matching Service User in your sites.' : 'No current Service Users in your sites.'}</li>
          ) : results.map(p => (
            <li key={p.suId} role="option" aria-selected={p.suId === value}>
              <button type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#f3f2f1] cursor-pointer" onClick={() => { onChange(p); setOpen(false); setQuery(''); }}>
                <span className="font-medium text-[#242424]">{p.fullName}</span>
                <span className="text-[#605e5c]"> · {p.externalReference || p.suReference}{p.roomNumber ? ` · Room ${p.roomNumber}` : ''}{p.siteName ? ` · ${p.siteName}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Small notice for under a picker: what the profile could not supply, and fields left alone because they were typed. */
export const ServiceUserNotice: React.FC<{ profile: ServiceUserProfile | null; skipped?: string[]; onRefill?: () => void }> = ({ profile, skipped = [], onRefill }) => {
  if (!profile) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[11px]">
      {profile.missing.length > 0 && <p className="text-amber-700">Not on the profile: {profile.missing.join(', ')}.</p>}
      {skipped.length > 0 && (
        <p className="text-[#605e5c]">
          Kept what you typed in {skipped.length} field{skipped.length > 1 ? 's' : ''}.{' '}
          {onRefill && <button type="button" onClick={onRefill} className="text-[#0d9488] font-semibold hover:underline cursor-pointer">Update from profile</button>}
        </p>
      )}
    </div>
  );
};
