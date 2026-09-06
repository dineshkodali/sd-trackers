import React, { useState, useMemo } from 'react';
import { 
  SlidersHorizontal, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Download, 
  Search, 
  Eye, 
  Check, 
  X, 
  FolderHeart, 
  HeartHandshake, 
  AlertTriangle, 
  ShieldAlert, 
  Siren, 
  HardHat, 
  Clock, 
  Soup, 
  Apple, 
  Waves, 
  Landmark, 
  Send,
  CheckCircle,
  Activity,
  AlertCircle,
  Wrench,
  Utensils
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomFieldOption, FieldOptionCategory } from '../../types';
import { FIELD_CATEGORIES_META, CategoryMeta } from '../../data/defaultFieldOptions';

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  blue: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200', dot: 'bg-teal-500', label: 'Sky Blue' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'Royal Purple' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', label: 'Teal Green' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Emerald' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Amber Warm' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Critical Red' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', label: 'Rose Pink' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500', label: 'Neutral Slate' }
};

export const FieldOptionsSetupView: React.FC = () => {
  const { 
    fieldOptions, 
    addFieldOption, 
    updateFieldOption, 
    deleteFieldOption, 
    toggleFieldOptionStatus, 
    reorderFieldOption, 
    resetFieldOptionsCategory,
    requestConfirmation,
    currentUserRole
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<FieldOptionCategory>('referralTypes');
  const [selectedDepartment, setSelectedDepartment] = useState<'All' | 'Safeguarding' | 'Facilities' | 'Welfare' | 'Governance'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<CustomFieldOption | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Form states
  const [formCategory, setFormCategory] = useState<FieldOptionCategory>('referralTypes');
  const [formLabel, setFormLabel] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const canManage = currentUserRole === 'Super Admin' || currentUserRole === 'Admin';

  // Category metadata lookup
  const currentCategoryMeta = useMemo(() => {
    return FIELD_CATEGORIES_META.find(c => c.key === selectedCategory) || FIELD_CATEGORIES_META[0];
  }, [selectedCategory]);

  // Filtered categories for department ribbon
  const visibleCategories = useMemo(() => {
    if (selectedDepartment === 'All') return FIELD_CATEGORIES_META;
    return FIELD_CATEGORIES_META.filter(c => c.department === selectedDepartment);
  }, [selectedDepartment]);

  // Options for current selected category
  const categoryOptions = useMemo(() => {
    return fieldOptions
      .filter(opt => opt.category === selectedCategory)
      .sort((a, b) => a.order - b.order);
  }, [fieldOptions, selectedCategory]);

  // Filtered options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return categoryOptions;
    const q = searchQuery.toLowerCase();
    return categoryOptions.filter(opt => 
      (opt.label || '').toLowerCase().includes(q) || 
      (opt.value || '').toLowerCase().includes(q) || 
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [categoryOptions, searchQuery]);

  const activeCount = categoryOptions.filter(o => o.isActive).length;
  const inactiveCount = categoryOptions.length - activeCount;

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingOption(null);
    setFormCategory(selectedCategory);
    setFormLabel('');
    setFormValue('');
    setFormColor('blue');
    setFormDescription('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (opt: CustomFieldOption) => {
    setEditingOption(opt);
    setFormCategory(opt.category);
    setFormLabel(opt.label);
    setFormValue(opt.value);
    setFormColor(opt.color || 'blue');
    setFormDescription(opt.description || '');
    setFormIsActive(opt.isActive);
    setIsModalOpen(true);
  };

  // Auto-fill value from label if value is empty or matching previous slug
  const handleLabelChange = (text: string) => {
    setFormLabel(text);
    if (!editingOption) {
      setFormValue(text);
    }
  };

  // Save Modal
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) return;

    const finalVal = formValue.trim() || formLabel.trim();

    if (editingOption) {
      updateFieldOption(editingOption.id, {
        label: formLabel.trim(),
        value: finalVal,
        color: formColor,
        description: formDescription.trim(),
        isActive: formIsActive
      });
    } else {
      addFieldOption({
        category: formCategory,
        label: formLabel.trim(),
        value: finalVal,
        color: formColor,
        description: formDescription.trim(),
        isActive: formIsActive,
        isSystem: false
      });
    }

    setIsModalOpen(false);
  };

  // Prompt delete
  const handleDelete = (opt: CustomFieldOption) => {
    requestConfirmation({
      title: `Delete Option: ${opt.label}`,
      message: `Are you sure you want to delete "${opt.label}" from "${currentCategoryMeta.name}"? This action cannot be undone. Any existing records with this value will retain their saved text, but this option will no longer be available in new dropdowns.`,
      confirmLabel: 'Delete Option',
      isDanger: true,
      onConfirm: () => {
        deleteFieldOption(opt.id);
      }
    });
  };

  // Reset category defaults
  const handleResetCategory = () => {
    requestConfirmation({
      title: `Reset ${currentCategoryMeta.name} to Defaults`,
      message: `This will restore all default system options for "${currentCategoryMeta.name}". Custom options you created for this category may be removed or replaced. Do you want to proceed?`,
      confirmLabel: 'Restore Defaults',
      isDanger: false,
      onConfirm: () => {
        resetFieldOptionsCategory(selectedCategory);
      }
    });
  };

  // Copy Schema JSON
  const handleCopySchemaJson = () => {
    const jsonString = JSON.stringify(fieldOptions, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // Render Category Icon
  const renderCategoryIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'FolderHeart': return <FolderHeart className={className} />;
      case 'Send': return <Send className={className} />;
      case 'HeartHandshake': return <HeartHandshake className={className} />;
      case 'AlertTriangle': return <AlertTriangle className={className} />;
      case 'ShieldAlert': return <ShieldAlert className={className} />;
      case 'Siren': return <Siren className={className} />;
      case 'HardHat': return <HardHat className={className} />;
      case 'Clock': return <Clock className={className} />;
      case 'Soup': return <Soup className={className} />;
      case 'Apple': return <Apple className={className} />;
      case 'Waves': return <Waves className={className} />;
      case 'Landmark': return <Landmark className={className} />;
      case 'CheckCircle': return <CheckCircle className={className} />;
      case 'Activity': return <Activity className={className} />;
      case 'AlertCircle': return <AlertCircle className={className} />;
      case 'Wrench': return <Wrench className={className} />;
      case 'Utensils': return <Utensils className={className} />;
      default: return <SlidersHorizontal className={className} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Microsoft 365 Standard Header & Action Command Bar */}
      <div className="bg-white border border-[#edebe9] rounded-xs p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#0d9488]/10 text-[#0d9488] rounded-xs">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#242424]">Field Options &amp; Form Setup Manager</h1>
                <p className="text-xs text-[#605e5c]">
                  Manage dynamic dropdown choices, operational categories, and custom classification tags across all tables and modals.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopySchemaJson}
              title="Copy all field option definitions as JSON backup"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#edebe9] rounded-xs hover:bg-[#f3f2f1] text-[#242424] text-xs font-semibold transition-colors"
            >
              {copySuccess ? <Check className="w-3.5 h-3.5 text-[#107c10]" /> : <Download className="w-3.5 h-3.5 text-[#0d9488]" />}
              <span>{copySuccess ? 'Schema Copied!' : 'Export Schema JSON'}</span>
            </button>

            {canManage && (
              <button
                onClick={handleResetCategory}
                title="Restore system defaults for this category"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#edebe9] rounded-xs hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Category</span>
              </button>
            )}

            {canManage && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Option</span>
              </button>
            )}
          </div>
        </div>

        {/* Department Filter Pills */}
        <div className="flex items-center gap-1.5 pt-4 mt-3 border-t border-[#edebe9] overflow-x-auto custom-scrollbar">
          <span className="text-[11px] font-semibold text-[#8a8886] uppercase tracking-wider mr-2">Department:</span>
          {(['All', 'Safeguarding', 'Facilities', 'Welfare', 'Governance'] as const).map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDepartment(dept)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-xs transition-all ${
                selectedDepartment === dept
                  ? 'bg-[#0d9488] text-white shadow-xs'
                  : 'bg-[#f3f2f1] text-[#605e5c] hover:bg-[#edebe9] hover:text-[#242424]'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column Layout: Categories Sidebar & Options Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Category Selector list */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white border border-[#edebe9] rounded-xs shadow-xs p-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#edebe9]">
              <span className="text-xs font-semibold text-[#242424] uppercase tracking-wider">
                Configurable Categories ({visibleCategories.length})
              </span>
            </div>

            <div className="space-y-1 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {visibleCategories.map(cat => {
                const count = fieldOptions.filter(o => o.category === cat.key && o.isActive).length;
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`w-full text-left p-2.5 rounded-xs transition-all flex items-start justify-between gap-2 border ${
                      isSelected
                        ? 'bg-[#f0fdfa] border-[#0d9488] text-[#0f766e] shadow-xs'
                        : 'bg-white border-transparent hover:bg-[#f3f2f1] text-[#323130]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`mt-0.5 p-1.5 rounded-xs ${isSelected ? 'bg-[#0d9488] text-white' : 'bg-[#f3f2f1] text-[#605e5c]'}`}>
                        {renderCategoryIcon(cat.iconName, 'w-3.5 h-3.5')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{cat.name}</div>
                        <div className="text-[10px] text-[#605e5c] truncate mt-0.5">{cat.department}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-xs shrink-0 ${
                      isSelected ? 'bg-[#0d9488] text-white' : 'bg-[#f3f2f1] text-[#605e5c]'
                    }`}>
                      {count} active
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Form Preview Box */}
          <div className="bg-white border border-[#edebe9] rounded-xs shadow-xs p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#242424]">
              <Eye className="w-3.5 h-3.5 text-[#0d9488]" />
              <span>Live Modal Dropdown Preview</span>
            </div>
            <p className="text-[11px] text-[#605e5c]">
              This shows how this category dynamically renders inside forms and filter bars:
            </p>
            <div className="pt-1">
              <label className="block text-[11px] font-semibold text-[#323130] mb-1">
                {currentCategoryMeta.name} (Live Test)
              </label>
              <select 
                className="w-full text-xs p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:outline-none"
                defaultValue={categoryOptions.find(o => o.isActive)?.value || ''}
              >
                {categoryOptions.filter(o => o.isActive).map(opt => (
                  <option key={opt.id} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Column: Options Management Table */}
        <div className="lg:col-span-8 space-y-3">
          {/* Category Details Banner */}
          <div className="bg-white border border-[#edebe9] rounded-xs p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0d9488] px-2 py-0.5 bg-[#f0fdfa] rounded-xs border border-[#5eead4]">
                  {currentCategoryMeta.department}
                </span>
                <h2 className="text-sm font-bold text-[#242424]">{currentCategoryMeta.name}</h2>
              </div>
              <p className="text-xs text-[#605e5c] mt-1">{currentCategoryMeta.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right text-xs">
                <span className="font-bold text-[#107c10]">{activeCount}</span> Active
                {inactiveCount > 0 && (
                  <span className="text-[#a4262c] ml-2">
                    (<span className="font-bold">{inactiveCount}</span> Inactive)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Search and Table Filter */}
          <div className="bg-white border border-[#edebe9] rounded-xs p-2.5 shadow-xs flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8886]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${currentCategoryMeta.name}...`}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:outline-none"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#0d9488] hover:underline"
              >
                Clear Search
              </button>
            )}
          </div>

          {/* Options Table */}
          <div className="bg-white border border-[#edebe9] rounded-xs shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f3f2f1] text-[#323130] font-semibold border-b border-[#edebe9]">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Display Label &amp; Badge</th>
                    <th className="py-2.5 px-3">Stored Key / Value</th>
                    <th className="py-2.5 px-3">Operational Context</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    {canManage && <th className="py-2.5 px-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {filteredOptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[#605e5c]">
                        No options found matching your filter in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredOptions.map((opt, idx) => {
                      const colorStyle = COLOR_MAP[opt.color || 'blue'] || COLOR_MAP.blue;
                      return (
                        <tr 
                          key={opt.id}
                          className={`hover:bg-[#fcfcfc] transition-colors ${!opt.isActive ? 'opacity-60 bg-[#faf9f8]' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center text-[#605e5c] font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Display Label and Badge */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs text-xs font-semibold border ${colorStyle.bg} ${colorStyle.text} ${colorStyle.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${colorStyle.dot}`} />
                                {opt.label}
                              </span>
                              {opt.isSystem && (
                                <span className="text-[9px] font-semibold px-1 py-0.2 bg-[#f3f2f1] text-[#605e5c] rounded-xs border border-[#edebe9]" title="Standard core system option">
                                  Default
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Stored Value */}
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#323130]">
                            <code>{opt.value}</code>
                          </td>

                          {/* Operational Context */}
                          <td className="py-2.5 px-3 text-[#605e5c] max-w-xs truncate" title={opt.description}>
                            {opt.description || '—'}
                          </td>

                          {/* Active / Inactive Status */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              disabled={!canManage}
                              onClick={() => toggleFieldOptionStatus(opt.id)}
                              title={canManage ? (opt.isActive ? 'Click to disable' : 'Click to enable') : undefined}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-semibold transition-colors ${
                                opt.isActive 
                                  ? 'bg-[#f1faf0] text-[#107c10] border border-[#cbe8cb] hover:bg-[#e4f6e2]' 
                                  : 'bg-[#fdf3f2] text-[#a4262c] border border-[#f8d2d0] hover:bg-[#fae7e6]'
                              } ${!canManage ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {opt.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>{opt.isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          {canManage && (
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => reorderFieldOption(opt.id, 'up')}
                                  disabled={idx === 0}
                                  title="Move Up in Dropdown"
                                  className="p-1 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#f3f2f1] rounded-xs disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => reorderFieldOption(opt.id, 'down')}
                                  disabled={idx === filteredOptions.length - 1}
                                  title="Move Down in Dropdown"
                                  className="p-1 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#f3f2f1] rounded-xs disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(opt)}
                                  title="Edit Option"
                                  className="p-1 text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(opt)}
                                  title="Delete Option"
                                  className="p-1 text-[#a4262c] hover:bg-[#fdf3f2] rounded-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT OPTION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-[#edebe9] flex items-center justify-between bg-[#f8f9fa]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#0d9488]/10 text-[#0d9488] rounded-xs">
                  {editingOption ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h3 className="text-sm font-semibold text-[#242424]">
                  {editingOption ? 'Edit Field Option' : 'Add New Custom Option'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#605e5c] hover:text-[#242424] p-1 rounded-xs hover:bg-[#edebe9]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Target Category
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as FieldOptionCategory)}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:outline-none"
                  disabled={!!editingOption}
                >
                  {FIELD_CATEGORIES_META.map(c => (
                    <option key={c.key} value={c.key}>
                      {c.name} ({c.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Display Label * <span className="font-normal text-[#605e5c]">(Shown to users in dropdowns)</span>
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={e => handleLabelChange(e.target.value)}
                  placeholder="e.g. Trauma-Informed Key Worker"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Internal Storage Value * <span className="font-normal text-[#605e5c]">(Used for database &amp; reports)</span>
                </label>
                <input
                  type="text"
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder="e.g. Trauma Support"
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] font-mono focus:ring-1 focus:ring-[#0d9488] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1.5">
                  Visual Badge Color Accent
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(COLOR_MAP).map(([colorKey, details]) => (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setFormColor(colorKey)}
                      className={`flex items-center gap-1.5 p-2 rounded-xs border text-left text-[11px] font-semibold transition-all ${
                        formColor === colorKey 
                          ? `${details.bg} ${details.text} border-[#0d9488] ring-1 ring-[#0d9488]` 
                          : 'bg-white text-[#605e5c] border-[#edebe9] hover:bg-[#f3f2f1]'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${details.dot}`} />
                      <span>{details.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#323130] mb-1">
                  Operational Description / Guidance <span className="font-normal text-[#605e5c]">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Explain when duty officers and staff should choose this option..."
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="form-active-toggle"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="h-4 w-4 text-[#0d9488] rounded border-[#8a8886] focus:ring-[#0d9488]"
                />
                <label htmlFor="form-active-toggle" className="text-xs text-[#242424] font-medium cursor-pointer">
                  Option is active and available in forms
                </label>
              </div>

              <div className="pt-3 border-t border-[#edebe9] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors"
                >
                  {editingOption ? 'Update Option' : 'Save & Add Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
