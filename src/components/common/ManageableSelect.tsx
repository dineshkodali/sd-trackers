import React, { useState, useMemo } from 'react';
import { Plus, Settings2, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FieldOptionCategory } from '../../types';
import { SelectOption } from '../../types/tableSchema';
import { QuickOptionModal } from './QuickOptionModal';

export interface ManageableSelectProps {
  label?: string;
  name?: string;
  value: any;
  onChange: (value: any) => void;
  options?: Array<string | SelectOption>;
  optionCategory?: FieldOptionCategory;
  allowQuickAdd?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  error?: string;
  badgeColors?: Record<string, string>;
  helperText?: string;
  showManageActions?: boolean;
}

const ADD_NEW_SENTINEL = '__ADD_NEW_OPTION__';

export const ManageableSelect: React.FC<ManageableSelectProps> = ({
  label,
  name,
  value,
  onChange,
  options = [],
  optionCategory,
  allowQuickAdd = true,
  placeholder,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  error,
  badgeColors,
  helperText,
  showManageActions = true
}) => {
  const { getFieldOptions, currentUserRole } = useApp();
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);

  // Determine if user can add/manage (Super Admin, Admin, and Staff)
  const canQuickAdd = allowQuickAdd && !disabled && !readOnly;

  // Resolve options from AppContext if optionCategory is bound, otherwise normalize raw options
  const resolvedOptions = useMemo(() => {
    if (optionCategory) {
      const dynamicOpts = getFieldOptions(optionCategory, false);
      if (dynamicOpts && dynamicOpts.length > 0) {
        return dynamicOpts.map(opt => ({
          label: opt.label,
          value: opt.value,
          color: opt.color,
          description: opt.description
        }));
      }
    }

    return options.map(opt => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      return opt;
    });
  }, [optionCategory, getFieldOptions, options]);

  // Selected option metadata
  const selectedOptionMeta = useMemo(() => {
    return resolvedOptions.find(o => String(o.value) === String(value));
  }, [resolvedOptions, value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    if (selectedVal === ADD_NEW_SENTINEL) {
      setIsQuickModalOpen(true);
      return;
    }
    onChange(selectedVal);
  };

  const handleOptionAdded = (newOpt: { label: string; value: string; color?: string }) => {
    onChange(newOpt.value);
  };

  return (
    <div className="space-y-1 w-full">
      {/* Label and Quick Actions Header */}
      {label && (
        <div className="flex items-center justify-between">
          <label className="font-semibold text-[#605e5c] text-xs flex items-center gap-1">
            <span>{label}</span>
            {required && <span className="text-red-500">*</span>}
          </label>

          {canQuickAdd && showManageActions && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsQuickModalOpen(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-[#0f766e] hover:text-[#0d9488] hover:bg-teal-50 rounded border border-teal-200/70 transition-colors cursor-pointer"
                title={`Quick add new choice to ${label}`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQuickModalOpen(true)}
                className="p-0.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                title={`Manage choices for ${label}`}
              >
                <Settings2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Select Input Wrapper */}
      <div className="relative">
        <select
          name={name}
          value={value ?? ''}
          disabled={disabled || readOnly}
          onChange={handleSelectChange}
          className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs ${
            error ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
          } ${readOnly || disabled ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed font-medium' : ''} ${className}`}
        >
          <option value="" disabled>
            {placeholder || `Select ${label || 'an option'}...`}
          </option>

          {resolvedOptions.map(opt => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}

          {canQuickAdd && (
            <option value={ADD_NEW_SENTINEL} className="font-bold text-teal-800 bg-teal-50">
              ➕ + Add New Option...
            </option>
          )}
        </select>
      </div>

      {/* Error / Helper text */}
      {error && (
        <p className="text-[11px] text-red-600 font-medium">{error}</p>
      )}
      {!error && helperText && (
        <p className="text-[10px] text-neutral-500">{helperText}</p>
      )}

      {/* Inline Quick Modal */}
      {isQuickModalOpen && (
        <QuickOptionModal
          isOpen={isQuickModalOpen}
          onClose={() => setIsQuickModalOpen(false)}
          categoryKey={optionCategory}
          categoryName={label}
          onOptionAdded={handleOptionAdded}
          customOptions={!optionCategory ? (resolvedOptions as any) : undefined}
        />
      )}
    </div>
  );
};
