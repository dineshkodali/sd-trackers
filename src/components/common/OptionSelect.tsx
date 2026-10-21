import React, { useMemo, useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QuickOptionModal } from './QuickOptionModal';
import type { FieldOptionCategory } from '../../types';

/**
 * A choice field whose list people can extend themselves: "+ Add" and the settings icon open the same quick-add /
 * manage window every other form uses, and a newly added choice is selected straight away. A value that is no longer
 * in the list (older record, removed choice) stays visible instead of being lost.
 */
export const OptionSelect: React.FC<{
  label: string;
  category: FieldOptionCategory;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Shown when the category has no saved choices yet. */
  fallback?: string[];
  /** Hide the add / manage controls (read-only views). */
  allowAdd?: boolean;
}> = ({ label, category, value, onChange, required, disabled, placeholder, fallback = [], allowAdd = true }) => {
  const { getFieldOptions } = useApp();
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const saved = (getFieldOptions(category) || []).map((o: any) => ({ label: o.label, value: o.value }));
    return saved.length > 0 ? saved : fallback.map(v => ({ label: v, value: v }));
  }, [getFieldOptions, category, fallback]);

  const known = options.some(o => o.value === value);

  return (
    <div className="space-y-1">
      <label className="font-semibold text-[#605e5c] flex items-center justify-between">
        <span>{label} {required && <span className="text-red-500">*</span>}</span>
        {allowAdd && !disabled && (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-[#0f766e] hover:text-[#0d9488] hover:bg-teal-50 rounded border border-teal-200/70 transition-colors cursor-pointer"
              title={`Quick add new choice to ${label}`}
            >
              <Plus className="w-2.5 h-2.5" /><span>Add</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="p-0.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
              title={`Manage choices for ${label}`}
            >
              <Settings2 className="w-3 h-3" />
            </button>
          </span>
        )}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={e => {
          if (e.target.value === '__ADD_NEW_OPTION__') { setOpen(true); return; }
          onChange(e.target.value);
        }}
        className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
      >
        <option value="">{placeholder || (required ? `Select ${label}...` : `Select ${label}... (Unassigned)`)}</option>
        {value && !known && <option value={value}>{value} (Current Value)</option>}
        {options.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
        {allowAdd && !disabled && <option value="__ADD_NEW_OPTION__" className="font-bold text-teal-800 bg-teal-50">➕ + Add New Option...</option>}
      </select>
      {open && (
        <QuickOptionModal
          isOpen={open}
          onClose={() => setOpen(false)}
          categoryKey={category}
          categoryName={label}
          onOptionAdded={opt => onChange(opt.value)}
        />
      )}
    </div>
  );
};
