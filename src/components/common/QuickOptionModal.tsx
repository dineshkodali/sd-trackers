import React, { useState, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Settings2, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FieldOptionCategory, CustomFieldOption } from '../../types';
import { FIELD_CATEGORIES_META } from '../../data/defaultFieldOptions';

interface QuickOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryKey?: FieldOptionCategory;
  categoryName?: string;
  onOptionAdded?: (newOption: { label: string; value: string; color?: string }) => void;
  customOptions?: Array<{ label: string; value: string; color?: string; id?: string }>;
  onUpdateCustomOptions?: (newOptions: Array<{ label: string; value: string; color?: string }>) => void;
}

const COLOR_PALETTE: Array<{ key: string; name: string; bg: string; text: string; border: string }> = [
  { key: 'blue', name: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  { key: 'emerald', name: 'Emerald', bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
  { key: 'amber', name: 'Amber', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  { key: 'red', name: 'Rose / Red', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
  { key: 'purple', name: 'Purple', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  { key: 'teal', name: 'Teal', bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
  { key: 'indigo', name: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
  { key: 'cyan', name: 'Cyan', bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200' },
  { key: 'slate', name: 'Neutral Slate', bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' },
];

export const QuickOptionModal: React.FC<QuickOptionModalProps> = ({
  isOpen,
  onClose,
  categoryKey,
  categoryName,
  onOptionAdded,
  customOptions,
  onUpdateCustomOptions
}) => {
  const { 
    fieldOptions, 
    addFieldOption, 
    updateFieldOption, 
    deleteFieldOption, 
    toggleFieldOptionStatus, 
    reorderFieldOption,
    currentUserRole 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add');
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [newDescription, setNewDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManage = currentUserRole === 'Super Admin' || currentUserRole === 'Admin' || currentUserRole === 'Staff';

  const categoryMeta = useMemo(() => {
    if (!categoryKey) return null;
    return FIELD_CATEGORIES_META.find(c => c.key === categoryKey);
  }, [categoryKey]);

  const displayTitle = categoryName || categoryMeta?.name || 'Dropdown Field Options';

  // Live options for this category from AppContext (or custom options if not global category)
  const currentCategoryOptions: CustomFieldOption[] = useMemo(() => {
    if (categoryKey) {
      return fieldOptions
        .filter(opt => opt.category === categoryKey)
        .sort((a, b) => a.order - b.order);
    }
    if (customOptions) {
      return customOptions.map((opt, idx) => ({
        id: opt.id || `custom-${idx}`,
        category: 'referralTypes' as any,
        label: opt.label,
        value: opt.value,
        color: opt.color || 'blue',
        isActive: true,
        order: idx + 1
      }));
    }
    return [];
  }, [categoryKey, fieldOptions, customOptions]);

  if (!isOpen) return null;

  const handleSaveNewOption = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = newLabel.trim();
    if (!cleanLabel) {
      setErrorMessage('Please enter a valid option label.');
      return;
    }

    // Check for duplicate
    const exists = currentCategoryOptions.some(
      o => o.label.toLowerCase() === cleanLabel.toLowerCase() || o.value.toLowerCase() === cleanLabel.toLowerCase()
    );
    if (exists) {
      setErrorMessage(`An option with the name "${cleanLabel}" already exists in this field.`);
      return;
    }

    if (categoryKey) {
      const added = addFieldOption({
        category: categoryKey,
        label: cleanLabel,
        value: cleanLabel,
        color: newColor,
        description: newDescription.trim() || undefined,
        isActive: true
      });
      if (onOptionAdded) {
        onOptionAdded({ label: added.label, value: added.value, color: added.color });
      }
    } else if (onUpdateCustomOptions && customOptions) {
      const updated = [...customOptions, { label: cleanLabel, value: cleanLabel, color: newColor }];
      onUpdateCustomOptions(updated);
      if (onOptionAdded) {
        onOptionAdded({ label: cleanLabel, value: cleanLabel, color: newColor });
      }
    }

    setNewLabel('');
    setNewDescription('');
    setNewColor('blue');
    setErrorMessage(null);
    onClose();
  };

  const handleDelete = (id: string, label: string) => {
    if (window.confirm(`Are you sure you want to remove the option "${label}"?`)) {
      if (categoryKey) {
        deleteFieldOption(id);
      } else if (onUpdateCustomOptions && customOptions) {
        const updated = customOptions.filter(o => o.id !== id && o.value !== id);
        onUpdateCustomOptions(updated);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#faf9f8] border-b border-[#e1dfdd] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xs bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0f766e]">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                {displayTitle}
              </h3>
              <p className="text-[11px] text-neutral-500">
                Quick-add or manage available choices for this form field
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-200 px-5 bg-neutral-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'add'
                ? 'border-[#0d9488] text-[#0f766e]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Option</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'manage'
                ? 'border-[#0d9488] text-[#0f766e]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Manage Existing ({currentCategoryOptions.length})</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'add' ? (
            <form onSubmit={handleSaveNewOption} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Option Name / Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newLabel}
                  onChange={e => {
                    setNewLabel(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Awaiting Multi-Agency Review"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488]"
                />
              </div>

              {/* Color Badge Picker */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Visual Badge Color
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PALETTE.map(col => {
                    const isSelected = newColor === col.key;
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => setNewColor(col.key)}
                        className={`px-2.5 py-1.5 rounded-xs border text-left flex items-center justify-between text-[11px] font-semibold transition-all cursor-pointer ${
                          col.bg
                        } ${col.text} ${col.border} ${
                          isSelected ? 'ring-2 ring-neutral-900 ring-offset-1 font-bold' : 'hover:opacity-90'
                        }`}
                      >
                        <span>{col.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase tracking-wider mb-1">
                  Optional Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Guidance on when staff should select this option..."
                  className="w-full px-3 py-1.5 border border-neutral-300 rounded-xs bg-white text-neutral-900 focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488]"
                />
              </div>

              <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Will be immediately selected in your active form</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save & Select Option</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-neutral-500">
                Reorder options to change their display priority in dropdowns, or toggle active/inactive to hide outdated choices from new forms while keeping historical records intact.
              </p>

              <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-xs overflow-hidden max-h-[360px] overflow-y-auto">
                {currentCategoryOptions.map((opt, idx) => {
                  const palette = COLOR_PALETTE.find(c => c.key === opt.color) || COLOR_PALETTE[0];
                  return (
                    <div
                      key={opt.id || opt.value}
                      className={`p-2.5 flex items-center justify-between gap-2 transition-colors ${
                        opt.isActive ? 'bg-white hover:bg-neutral-50' : 'bg-neutral-50/80 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-neutral-400 w-4 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-neutral-800 truncate">{opt.label}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${palette.bg} ${palette.text} ${palette.border}`}>
                              {opt.color || 'blue'}
                            </span>
                            {!opt.isActive && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-neutral-200 text-neutral-600">
                                Inactive
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <p className="text-[10px] text-neutral-500 truncate mt-0.5">{opt.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {categoryKey && (
                          <>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => reorderFieldOption(opt.id, 'up')}
                              className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-25 rounded hover:bg-neutral-100"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === currentCategoryOptions.length - 1}
                              onClick={() => reorderFieldOption(opt.id, 'down')}
                              className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-25 rounded hover:bg-neutral-100"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleFieldOptionStatus(opt.id)}
                              className="p-1 text-neutral-500 hover:text-neutral-900 rounded hover:bg-neutral-100"
                              title={opt.isActive ? 'Deactivate (Hide from dropdowns)' : 'Activate'}
                            >
                              {opt.isActive ? (
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-neutral-400" />
                              )}
                            </button>
                          </>
                        )}
                        {!opt.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleDelete(opt.id, opt.label)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50"
                            title="Delete Custom Option"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-neutral-200 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
