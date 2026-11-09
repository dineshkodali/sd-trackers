import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import {
  NO_GUEST_FILTER, describeGuestFilter, isGuestFilterActive,
  type AgeFilter, type AspenFilter, type FamilyFilter, type GenderFilter, type GuestFilter,
} from '../../utils/guestStats';

interface Props {
  value: GuestFilter;
  onChange: (next: GuestFilter) => void;
  /** Rows currently shown / rows before the guest filters. */
  shown: number;
  total: number;
  /** Starts open, e.g. when the Dashboard sent the user here with a filter. */
  defaultOpen?: boolean;
  familyNote?: string | null;
}

const selectCls = 'w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs text-[#242424] focus:outline-none focus:border-[#0d9488] cursor-pointer';
const inputCls = 'w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs text-[#242424] focus:outline-none focus:border-[#0d9488]';

const Field: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold text-[#605e5c] mb-1">{label}</label>
    {children}
  </div>
);

const toNum = (s: string) => (s === '' ? null : Math.max(0, Math.min(120, Math.floor(Number(s)))));

/** One collapsible panel for the four guest filters, so the register toolbar stays uncluttered. */
export const RegisterGuestFilters: React.FC<Props> = ({ value, onChange, shown, total, defaultOpen = false, familyNote }) => {
  const [open, setOpen] = useState(defaultOpen);
  const active = isGuestFilterActive(value);
  const chips = describeGuestFilter(value);
  const set = (patch: Partial<GuestFilter>) => onChange({ ...value, ...patch });

  return (
    <div className="mt-3 pt-3 border-t border-[#f0f0f0]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="register-guest-filters"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-[#8a8886] rounded-xs bg-white text-[#323130] hover:bg-[#edebe9] cursor-pointer"
        >
          <Filter className="w-3.5 h-3.5 text-[#0d9488]" />
          Guest filters
          {active && <span className="px-1.5 rounded-full bg-[#0d9488] text-white text-[10px]">{chips.length}</span>}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {active && (
          <>
            {chips.map(c => (
              <span key={c} className="px-2 py-0.5 text-[11px] font-semibold bg-teal-50 text-[#0f766e] border border-teal-200 rounded-full">{c}</span>
            ))}
            <span className="text-[11px] text-[#605e5c]" role="status">Showing {shown} of {total}</span>
            <button
              type="button"
              onClick={() => onChange(NO_GUEST_FILTER)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#a4262c] hover:underline cursor-pointer"
            >
              <X className="w-3 h-3" />Clear
            </button>
          </>
        )}
      </div>

      {open && (
        <div id="register-guest-filters" className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="space-y-2">
            <Field label="Age" htmlFor="gf-age">
              <select id="gf-age" className={selectCls} value={value.age} onChange={e => set({ age: e.target.value as AgeFilter })}>
                <option value="all">All ages</option>
                <option value="child">Children (under 18)</option>
                <option value="adult">Adults (18 to 64)</option>
                <option value="elderly">Elderly (65 and over)</option>
                <option value="unknown">Age not recorded</option>
                <option value="custom">Custom range…</option>
              </select>
            </Field>
            {value.age === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Minimum age" type="number" min={0} max={120} placeholder="From" className={inputCls} value={value.ageMin ?? ''} onChange={e => set({ ageMin: toNum(e.target.value) })} />
                <input aria-label="Maximum age" type="number" min={0} max={120} placeholder="To" className={inputCls} value={value.ageMax ?? ''} onChange={e => set({ ageMax: toNum(e.target.value) })} />
              </div>
            )}
          </div>

          <Field label="Gender" htmlFor="gf-gender">
            <select id="gf-gender" className={selectCls} value={value.gender} onChange={e => set({ gender: e.target.value as GenderFilter })}>
              <option value="all">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unknown">Not specified</option>
              <option value="other_unknown">Other or not specified</option>
            </select>
          </Field>

          <div className="space-y-2">
            <Field label="Family size" htmlFor="gf-family">
              <select id="gf-family" className={selectCls} value={value.family} onChange={e => set({ family: e.target.value as FamilyFilter })}>
                <option value="all">Any size</option>
                <option value="1">Family of 1</option>
                <option value="2">Family of 2</option>
                <option value="3">Family of 3</option>
                <option value="4">Family of 4</option>
                <option value="5+">Family of 5 or more</option>
                <option value="custom">Custom: at least…</option>
              </select>
            </Field>
            {value.family === 'custom' && (
              <input aria-label="Minimum family size" type="number" min={1} max={120} placeholder="Minimum family size" className={inputCls} value={value.familyMin ?? ''} onChange={e => set({ familyMin: toNum(e.target.value) })} />
            )}
          </div>

          <Field label="Aspen card" htmlFor="gf-aspen">
            <select id="gf-aspen" className={selectCls} value={value.aspen} onChange={e => set({ aspen: e.target.value as AspenFilter })}>
              <option value="all">Any</option>
              <option value="yes">Holders</option>
              <option value="no">Not holders</option>
            </select>
          </Field>

          {familyNote && <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-[#a4262c]" role="alert">{familyNote}</p>}
          <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-[#605e5c]">
            Family size counts the members of the guest's family group, or the people sharing their room when they are not in one.
          </p>
        </div>
      )}
    </div>
  );
};
