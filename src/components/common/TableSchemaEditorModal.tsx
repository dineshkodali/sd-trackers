import React, { useState } from 'react';
import { 
  X, 
  SlidersHorizontal, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Check, 
  ShieldAlert, 
  Settings2, 
  Eye, 
  EyeOff,
  Edit2
} from 'lucide-react';
import { TableColumnConfig, FieldType } from '../../types/tableSchema';

interface TableSchemaEditorModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  moduleTitle: string;
  columns: TableColumnConfig<T>[];
  onSaveColumns: (newColumns: TableColumnConfig<T>[]) => void;
  onResetToDefault: () => void;
  currentUserRole?: string;
}

export function TableSchemaEditorModal<T = any>({
  isOpen,
  onClose,
  moduleTitle,
  columns,
  onSaveColumns,
  onResetToDefault,
  currentUserRole
}: TableSchemaEditorModalProps<T>) {
  const isSuperAdmin = currentUserRole === 'Super Admin';

  // Working copy of columns
  const [workingCols, setWorkingCols] = useState<TableColumnConfig<T>[]>(() => columns);

  // Sync working copy when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setWorkingCols(columns);
    }
  }, [isOpen, columns]);

  // Form state for adding new field
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState<FieldType>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newPlaceholder, setNewPlaceholder] = useState('');
  const [newOptionsStr, setNewOptionsStr] = useState('');
  const [newSection, setNewSection] = useState('General Information');
  const [addError, setAddError] = useState<string | null>(null);

  // Edit column state
  const [editingColKey, setEditingColKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState<FieldType>('text');
  const [editPlaceholder, setEditPlaceholder] = useState('');
  const [editOptionsStr, setEditOptionsStr] = useState('');
  const [editRequired, setEditRequired] = useState(false);

  if (!isOpen) return null;

  // Enforce Super Admin restriction
  if (!isSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl p-6 max-w-md w-full text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-red-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-900">Access Restricted</h3>
          <p className="text-xs text-neutral-600">
            Table schema and header configuration can only be customized by users with the <strong>Super Admin</strong> role.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0d9488] text-white rounded-xs font-semibold text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const nonSystemCols = workingCols.filter(c => !c.isSystemMetadata);

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nonSystemCols.length) return;

    const reorderedNonSystem = [...nonSystemCols];
    const [moved] = reorderedNonSystem.splice(index, 1);
    reorderedNonSystem.splice(targetIndex, 0, moved);

    const systemCols = workingCols.filter(c => c.isSystemMetadata);
    setWorkingCols([...reorderedNonSystem, ...systemCols]);
  };

  const handleToggleVisibility = (key: string) => {
    setWorkingCols(prev => prev.map(c => {
      if (String(c.key) === key) {
        return { ...c, visibleInTable: c.visibleInTable === false ? true : false };
      }
      return c;
    }));
  };

  const handleToggleRequired = (key: string) => {
    setWorkingCols(prev => prev.map(c => {
      if (String(c.key) === key) {
        return { ...c, required: !c.required };
      }
      return c;
    }));
  };

  const handleDeleteColumn = (key: string) => {
    if (!confirm(`Are you sure you want to remove the field "${key}" from the table and forms?`)) return;
    setWorkingCols(prev => prev.filter(c => String(c.key) !== key));
  };

  const handleStartEdit = (col: TableColumnConfig<T>) => {
    setEditingColKey(String(col.key));
    setEditLabel(col.label);
    setEditType(col.type || 'text');
    setEditPlaceholder(col.placeholder || '');
    setEditRequired(Boolean(col.required));
    const optStr = Array.isArray(col.options) 
      ? col.options.map((o: any) => typeof o === 'string' ? o : (o?.label || o?.value || '')).filter(Boolean).join(', ') 
      : '';
    setEditOptionsStr(optStr);
  };

  const handleSaveEditCol = () => {
    if (!editingColKey) return;
    setWorkingCols(prev => prev.map(c => {
      if (String(c.key) === editingColKey) {
        const opts = editType === 'select' && editOptionsStr.trim()
          ? editOptionsStr.split(',').map(s => s.trim()).filter(Boolean)
          : c.options;

        return {
          ...c,
          label: editLabel.trim() || c.label,
          type: editType,
          placeholder: editPlaceholder.trim(),
          required: editRequired,
          options: opts
        };
      }
      return c;
    }));
    setEditingColKey(null);
  };

  const handleAddNewColumn = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newLabel.trim()) {
      setAddError('Please enter a column header label.');
      return;
    }

    // Auto-generate key if not entered
    let key = newKey.trim();
    if (!key) {
      key = newLabel.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    }

    if (!key) {
      setAddError('A valid field key is required.');
      return;
    }

    // Check duplicate
    if (workingCols.some(c => String(c.key).toLowerCase() === key.toLowerCase())) {
      setAddError(`A column with key "${key}" already exists.`);
      return;
    }

    const options = newType === 'select' && newOptionsStr.trim()
      ? newOptionsStr.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const newColumn: TableColumnConfig<T> = {
      key: key as any,
      label: newLabel.trim(),
      type: newType,
      placeholder: newPlaceholder.trim(),
      required: newRequired,
      options,
      section: newSection.trim() || 'General Information',
      visibleInTable: true,
      visibleInView: true,
      editable: true,
      isCustom: true
    };

    const nonSys = workingCols.filter(c => !c.isSystemMetadata);
    const sys = workingCols.filter(c => c.isSystemMetadata);
    setWorkingCols([...nonSys, newColumn, ...sys]);

    // Reset form
    setNewLabel('');
    setNewKey('');
    setNewType('text');
    setNewRequired(false);
    setNewPlaceholder('');
    setNewOptionsStr('');
  };

  const handleApplyAll = () => {
    onSaveColumns(workingCols);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#f8f9fa] border-b border-[#e1dfdd] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-[#0f766e] rounded-xs border border-teal-200">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#242424]">
                  Customize Table Headers & Form Fields
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 rounded">
                  Super Admin Only
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Module: <strong>{moduleTitle}</strong>. Changes made here automatically update the Table Headers, Add Form, View Dossier, and Edit Form.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700 rounded hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#242424]">
          
          {/* Section 1: Active Columns List */}
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200">
              <div>
                <h4 className="font-bold text-neutral-800 text-sm">Configured Columns ({nonSystemCols.length})</h4>
                <p className="text-[11px] text-neutral-500">Reorder columns, toggle table visibility, or adjust field rules.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset table columns and forms to original system defaults?')) {
                    onResetToDefault();
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded border border-neutral-300 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="border border-[#edebe9] rounded overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#faf9f8] text-[#605e5c] border-b border-[#edebe9] uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="p-2.5 w-12 text-center">Order</th>
                    <th className="p-2.5">Header Label</th>
                    <th className="p-2.5">Field Key</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-center">Required</th>
                    <th className="p-2.5 text-center">Table Visible</th>
                    <th className="p-2.5 text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {nonSystemCols.map((col, idx) => {
                    const isEditing = editingColKey === String(col.key);
                    const isCustom = Boolean(col.isCustom);

                    if (isEditing) {
                      return (
                        <tr key={String(col.key)} className="bg-teal-50/50">
                          <td colSpan={7} className="p-3">
                            <div className="space-y-3 bg-white p-3.5 rounded border border-teal-300 shadow-xs">
                              <div className="font-semibold text-xs text-[#0f766e]">
                                Editing Column: {col.label} ({String(col.key)})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Header Label</label>
                                  <input
                                    type="text"
                                    value={editLabel}
                                    onChange={e => setEditLabel(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Field Type</label>
                                  <select
                                    value={editType}
                                    onChange={e => setEditType(e.target.value as FieldType)}
                                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#0d9488]"
                                  >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="currency">Currency (£)</option>
                                    <option value="date">Date</option>
                                    <option value="select">Dropdown Select</option>
                                    <option value="textarea">Multi-line Text</option>
                                    <option value="checkbox">Checkbox (Yes/No)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Placeholder</label>
                                  <input
                                    type="text"
                                    value={editPlaceholder}
                                    onChange={e => setEditPlaceholder(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                                  />
                                </div>
                              </div>

                              {editType === 'select' && (
                                <div>
                                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                                    Dropdown Options (comma-separated)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Option 1, Option 2, Option 3"
                                    value={editOptionsStr}
                                    onChange={e => setEditOptionsStr(e.target.value)}
                                    className="w-full px-2.5 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                                  />
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                                  <input
                                    type="checkbox"
                                    checked={editRequired}
                                    onChange={e => setEditRequired(e.target.checked)}
                                    className="rounded text-[#0d9488] focus:ring-[#0d9488]"
                                  />
                                  <span>Required Field</span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingColKey(null)}
                                    className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 rounded text-xs text-neutral-700 font-semibold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEditCol}
                                    className="px-3.5 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded text-xs font-semibold"
                                  >
                                    Update Column
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={String(col.key)} className="hover:bg-[#f8f9fa] transition-colors">
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMove(idx, 'up')}
                              className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 rounded hover:bg-neutral-200 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === nonSystemCols.length - 1}
                              onClick={() => handleMove(idx, 'down')}
                              className="p-1 text-neutral-500 hover:text-neutral-900 disabled:opacity-30 rounded hover:bg-neutral-200 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 font-semibold text-neutral-800">
                          <div className="flex items-center gap-1.5">
                            <span>{col.label}</span>
                            {isCustom && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-teal-100 text-[#0f766e] rounded border border-teal-200">
                                Custom
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-neutral-500">
                          {String(col.key)}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-neutral-100 text-neutral-700 rounded border border-neutral-200 uppercase">
                            {col.type || 'text'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(col.required)}
                            onChange={() => handleToggleRequired(String(col.key))}
                            className="rounded text-[#0d9488] focus:ring-[#0d9488] cursor-pointer"
                            title="Toggle required validation"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(String(col.key))}
                            className={`p-1 rounded cursor-pointer ${col.visibleInTable !== false ? 'text-[#0f766e] hover:bg-teal-50' : 'text-neutral-400 hover:bg-neutral-100'}`}
                            title={col.visibleInTable !== false ? 'Visible in Table (Click to hide)' : 'Hidden in Table (Click to show)'}
                          >
                            {col.visibleInTable !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(col)}
                              className="p-1 text-neutral-600 hover:text-[#0d9488] hover:bg-neutral-100 rounded cursor-pointer"
                              title="Edit Header Label & Rules"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteColumn(String(col.key))}
                                className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                title="Remove Custom Column"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Add New Column Form */}
          <div className="bg-[#faf9f8] p-4 rounded-xs border border-[#edebe9] space-y-3">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#0d9488]" />
              <h4 className="font-bold text-neutral-800 text-xs uppercase tracking-wider">
                Add New Field to Table, Add Form, and View
              </h4>
            </div>

            {addError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddNewColumn} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Column Header Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Primary Language Spoken"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Field Identifier (Key)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. primaryLanguage"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs font-mono focus:ring-1 focus:ring-[#0d9488]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Input Control Type
                  </label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as FieldType)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs bg-white focus:ring-1 focus:ring-[#0d9488]"
                  >
                    <option value="text">Text (Single line)</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency (£)</option>
                    <option value="date">Date picker</option>
                    <option value="select">Dropdown Menu</option>
                    <option value="textarea">Textarea (Multi-line)</option>
                    <option value="checkbox">Checkbox (Yes/No)</option>
                  </select>
                </div>
              </div>

              {newType === 'select' && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Dropdown Select Options (comma-separated list) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. English, Arabic, Kurdish, Spanish, Other"
                    value={newOptionsStr}
                    onChange={e => setNewOptionsStr(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Placeholder / Helper text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Specify resident language"
                    value={newPlaceholder}
                    onChange={e => setNewPlaceholder(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Form Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Resident Details"
                    value={newSection}
                    onChange={e => setNewSection(e.target.value)}
                    className="w-full px-3 py-1.5 border border-neutral-300 rounded text-xs focus:ring-1 focus:ring-[#0d9488]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
                  <input
                    type="checkbox"
                    checked={newRequired}
                    onChange={e => setNewRequired(e.target.checked)}
                    className="rounded text-[#0d9488] focus:ring-[#0d9488]"
                  />
                  <span>Mandatory Field (Required for submission)</span>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0f766e] hover:bg-[#0d9488] text-white rounded-xs font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Field</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#f8f9fa] border-t border-[#edebe9] flex items-center justify-between">
          <div className="text-[11px] text-neutral-500">
            Click <strong>Save &amp; Apply Schema</strong> to immediately update Table Headers, Create Forms, and Record Views.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-neutral-300 hover:bg-neutral-100 rounded-xs text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyAll}
              className="inline-flex items-center gap-1.5 px-5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save &amp; Apply Schema</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
