import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertCircle, Loader2, Lock, Building2, UserCheck } from 'lucide-react';
import { TableColumnConfig, SelectOption } from '../../types/tableSchema';
import { useApp } from '../../context/AppContext';
import { AttachmentsSection } from './AttachmentsSection';

interface DynamicRecordFormModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: TableColumnConfig<T>[];
  initialValues?: Partial<T> | null;
  onSave?: (record: any) => Promise<void> | void;
  onSubmit?: (record: any) => Promise<void> | void;
  isEdit?: boolean;
  submitLabel?: string;
  contextData?: Record<string, any>;
}

export function DynamicRecordFormModal<T = any>({
  isOpen,
  onClose,
  title,
  columns,
  initialValues,
  onSave,
  onSubmit,
  isEdit = false,
  submitLabel,
  contextData = {}
}: DynamicRecordFormModalProps<T>) {
  const {
    assignedSite,
    allowedSites,
    canAccessAllSites,
    selectedSite,
    sites,
    authProfile,
    currentUserName,
    currentUserRole
  } = useApp();

  const userAssignedHotel = assignedSite || 'Stansted Hotel (Ibis Budget Bisop Stortford)';

  const loggedInUserName = useMemo(() => {
    return authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (Staff)` : 'Duty Officer');
  }, [authProfile, currentUserName, currentUserRole]);

  const allSiteNames = useMemo(() => {
    const fromAllowed = (allowedSites || []).filter(Boolean);
    const fromSites = (sites || [])
      .map(s => (typeof s === 'string' ? s : s?.name))
      .filter((n): n is string => Boolean(n && typeof n === 'string' && n.trim() !== ''));
    const combined = Array.from(new Set([...fromAllowed, ...fromSites, userAssignedHotel]));
    return combined.length > 0 ? combined : [userAssignedHotel];
  }, [allowedSites, sites, userAssignedHotel]);

  const effectiveContext = useMemo(() => ({
    assignedSite: userAssignedHotel,
    allowedSites: allSiteNames,
    sites,
    selectedSite,
    canAccessAllSites,
    ...contextData
  }), [userAssignedHotel, allSiteNames, sites, selectedSite, canAccessAllSites, contextData]);

  const isSiteColumn = (col: TableColumnConfig<T>): boolean => {
    const key = String(col.key).toLowerCase();
    const label = String(col.label || '').toLowerCase();
    return (
      key === 'site' ||
      key === 'sitename' ||
      key === 'hotelname' ||
      key === 'property' ||
      label.includes('hotel') ||
      label.includes('property') ||
      (label.includes('site') && !label.includes('website'))
    );
  };

  const isLoggedByColumn = (col: TableColumnConfig<T>): boolean => {
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      key === 'loggedby' ||
      key === 'raisedby' ||
      key === 'reportedby' ||
      key === 'submittedby' ||
      key === 'personreporting' ||
      key === 'staffreporting' ||
      key === 'auditedby' ||
      key === 'officerleadinghotel' ||
      label === 'loggedby' ||
      label === 'raisedby' ||
      label === 'reportedby' ||
      label === 'submittedby' ||
      label === 'personreporting' ||
      label === 'staffreporting' ||
      label === 'auditedby' ||
      label === 'officerleadinghotel'
    );
  };

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevOpenRef = useRef<boolean>(false);
  const prevRecordIdRef = useRef<string | null>(null);

  // Filter out internal system metadata fields and guarantee a locked Logged By field
  const formColumns = useMemo(() => {
    const activeCols = columns.filter(col => !col.isSystemMetadata);
    const hasLoggedBy = activeCols.some(isLoggedByColumn);
    if (!hasLoggedBy) {
      const injectedLoggedByCol: TableColumnConfig<T> = {
        key: 'loggedBy' as any,
        label: 'Logged By',
        type: 'text',
        section: 'Audit & Accountability',
        editable: false,
        required: false,
        placeholder: loggedInUserName
      };
      return [...activeCols, injectedLoggedByCol];
    }
    return activeCols;
  }, [columns, loggedInUserName]);

  // Group columns by section if specified
  const sections = useMemo(() => {
    const map = new Map<string, TableColumnConfig<T>[]>();
    formColumns.forEach(col => {
      const secName = col.section || 'General Information';
      if (!map.has(secName)) map.set(secName, []);
      map.get(secName)!.push(col);
    });
    return Array.from(map.entries());
  }, [formColumns]);

  // Initialize form data only when modal opens or target record changes
  useEffect(() => {
    if (!isOpen) {
      prevOpenRef.current = false;
      prevRecordIdRef.current = null;
      return;
    }

    const currentRecordId = (initialValues as any)?.id || null;
    const justOpened = !prevOpenRef.current;
    const recordChanged = currentRecordId !== null && currentRecordId !== prevRecordIdRef.current;

    if (!justOpened && !recordChanged) {
      return;
    }

    prevOpenRef.current = true;
    prevRecordIdRef.current = currentRecordId;

    const initial: Record<string, any> = initialValues ? { ...initialValues } : {};
    formColumns.forEach(col => {
      const key = String(col.key);
      const isSite = isSiteColumn(col);
      const isLoggedBy = isLoggedByColumn(col);

      if (isSite) {
        if (!canAccessAllSites()) {
          initial[key] = userAssignedHotel;
        } else {
          const provided = initialValues ? (initialValues as any)[key] : undefined;
          if (provided && typeof provided === 'string' && provided.trim() !== '') {
            initial[key] = provided;
          } else if (selectedSite && selectedSite !== 'all') {
            initial[key] = selectedSite;
          } else if (assignedSite) {
            initial[key] = assignedSite;
          } else if (col.defaultValue !== undefined) {
            initial[key] = typeof col.defaultValue === 'function' ? col.defaultValue(effectiveContext) : col.defaultValue;
          } else {
            initial[key] = allSiteNames[0] || userAssignedHotel;
          }
        }
      } else if (isLoggedBy) {
        initial[key] = (initialValues && (initialValues as any)[key]) || loggedInUserName;
      } else if (initialValues && initialValues[col.key as keyof T] !== undefined) {
        initial[key] = initialValues[col.key as keyof T];
      } else if (col.defaultValue !== undefined) {
        initial[key] = typeof col.defaultValue === 'function' ? col.defaultValue(effectiveContext) : col.defaultValue;
      } else {
        switch (col.type) {
          case 'number':
          case 'currency':
            initial[key] = 0;
            break;
          case 'checkbox':
            initial[key] = false;
            break;
          case 'date':
            initial[key] = new Date().toISOString().slice(0, 10);
            break;
          default:
            initial[key] = '';
        }
      }
    });

    // Ensure attachments array exists
    initial.attachments = Array.isArray((initialValues as any)?.attachments) ? (initialValues as any).attachments : [];
    // Ensure standard loggedBy exists
    if (!initial.loggedBy) {
      initial.loggedBy = loggedInUserName;
    }

    // If editing, preserve the record ID and system metadata
    if (initialValues) {
      if ((initialValues as any).id) initial.id = (initialValues as any).id;
      if ((initialValues as any).createdAt) initial.createdAt = (initialValues as any).createdAt;
      if ((initialValues as any).updatedAt) initial.updatedAt = (initialValues as any).updatedAt;
      if ((initialValues as any).srNo) initial.srNo = (initialValues as any).srNo;
    }

    setFormData(initial);
    setErrors({});
    setSubmitError(null);
  }, [isOpen, initialValues, assignedSite, selectedSite, canAccessAllSites, userAssignedHotel, allSiteNames, effectiveContext, formColumns, loggedInUserName]);

  const handleClearOrRevert = () => {
    if (isEdit && initialValues) {
      // Revert to original record values
      const initial: Record<string, any> = { ...initialValues };
      if (!canAccessAllSites()) {
        formColumns.forEach(col => {
          if (isSiteColumn(col)) {
            initial[String(col.key)] = userAssignedHotel;
          }
        });
      }
      setFormData(initial);
    } else {
      // Clear/Reset to blank defaults
      const blank: Record<string, any> = {};
      formColumns.forEach(col => {
        const key = String(col.key);
        if (isSiteColumn(col)) {
          blank[key] = !canAccessAllSites()
            ? userAssignedHotel
            : (selectedSite && selectedSite !== 'all' ? selectedSite : (assignedSite || allSiteNames[0] || userAssignedHotel));
        } else if (col.defaultValue !== undefined) {
          blank[key] = typeof col.defaultValue === 'function' ? col.defaultValue(effectiveContext) : col.defaultValue;
        } else {
          switch (col.type) {
            case 'number':
            case 'currency':
              blank[key] = 0;
              break;
            case 'checkbox':
              blank[key] = false;
              break;
            case 'date':
              blank[key] = new Date().toISOString().slice(0, 10);
              break;
            default:
              blank[key] = '';
          }
        }
      });
      setFormData(blank);
    }
    setErrors({});
    setSubmitError(null);
  };

  if (!isOpen) return null;

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const resolveOptions = (col: TableColumnConfig<T>): SelectOption[] => {
    if (isSiteColumn(col)) {
      if (!canAccessAllSites()) {
        return [{ label: userAssignedHotel, value: userAssignedHotel }];
      }
      return allSiteNames.map(name => ({ label: name, value: name }));
    }
    if (!col.options) return [];
    const rawOptions = typeof col.options === 'function' ? col.options(effectiveContext) : col.options;
    return (rawOptions || []).map(opt => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      return opt;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    formColumns.forEach(col => {
      const key = String(col.key);
      const isSite = isSiteColumn(col);
      if (col.required) {
        const val = isSite && !canAccessAllSites() 
          ? userAssignedHotel 
          : (formData[key] ?? (isSite ? userAssignedHotel : ''));
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          newErrors[key] = `${col.label} is required`;
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Coerce number and currency fields and keep initial extra fields
      const processed: Record<string, any> = { ...(initialValues || {}), ...formData };
      processed.attachments = Array.isArray(formData.attachments) ? formData.attachments : [];
      processed.loggedBy = formData.loggedBy || loggedInUserName;

      formColumns.forEach(col => {
        const key = String(col.key);
        if (isSiteColumn(col)) {
          if (!canAccessAllSites()) {
            processed[key] = userAssignedHotel;
          } else if (!processed[key]) {
            processed[key] = selectedSite && selectedSite !== 'all' ? selectedSite : (assignedSite || allSiteNames[0] || userAssignedHotel);
          }
        }
        if (isLoggedByColumn(col)) {
          processed[key] = formData[key] || loggedInUserName;
        }
        if (col.type === 'number' || col.type === 'currency') {
          const val = processed[key];
          processed[key] = val !== '' && val !== null && val !== undefined ? Number(val) : 0;
        }
      });

      const saveFn = onSave || onSubmit;
      if (saveFn) {
        await saveFn(processed);
      }
      onClose();
    } catch (err: any) {
      console.error('Record save error:', err);
      setSubmitError(err.message || 'Failed to save record. Please verify all required fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8]">
          <div>
            <h3 className="text-base font-semibold text-[#242424]">
              {title}
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {isEdit ? 'Modify the record details below and click Save Changes.' : 'Fill in the configured fields below to create a new record.'}
            </p>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{submitError}</span>
            </div>
          )}

          {sections.map(([secName, secCols], secIdx) => (
            <div key={secName} className="space-y-3">
              {sections.length > 1 && (
                <div className="pb-1 border-b border-neutral-200">
                  <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{secName}</h4>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {secCols.map(col => {
                  const key = String(col.key);
                  const isFullWidth = col.colSpan === 2 || col.type === 'textarea';
                  const isSite = isSiteColumn(col);
                  const isLoggedBy = isLoggedByColumn(col);
                  const displayLabel = isLoggedBy ? 'Logged By' : col.label;
                  const isLockedForStaff = isSite && !canAccessAllSites();
                  const isReadOnly = col.editable === false || isLockedForStaff || isLoggedBy;
                  const value = isLockedForStaff ? userAssignedHotel : (isLoggedBy ? (formData[key] || loggedInUserName) : (formData[key] ?? ''));
                  const options = col.type === 'select' || isSite ? resolveOptions(col) : [];

                  return (
                    <div 
                      key={key} 
                      className={isFullWidth ? 'sm:col-span-2 space-y-1' : 'space-y-1'}
                    >
                      <label className="font-semibold text-[#605e5c] flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          {isSite && <Building2 className="w-3.5 h-3.5 text-teal-600 inline" />}
                          {isLoggedBy && <UserCheck className="w-3.5 h-3.5 text-teal-600 inline" />}
                          <span>{displayLabel} {col.required && <span className="text-red-500">*</span>}</span>
                        </span>
                        {isLoggedBy ? (
                          <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-teal-600" /> Locked to Logged-in User
                          </span>
                        ) : isLockedForStaff ? (
                          <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-teal-600" /> Assigned Property (Locked)
                          </span>
                        ) : isReadOnly ? (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5 text-amber-600" /> Auto
                          </span>
                        ) : null}
                      </label>

                      {/* Select input */}
                      {isLoggedBy ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={value}
                            readOnly
                            disabled
                            className="w-full p-2 pr-8 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed text-xs"
                            title="Locked to logged-in user for accountability and audit logs."
                          />
                          <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      ) : isLockedForStaff ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={userAssignedHotel}
                            readOnly
                            disabled
                            className="w-full p-2 pr-8 border border-teal-200 rounded-xs bg-teal-50/50 text-teal-950 font-medium cursor-not-allowed"
                          />
                          <Lock className="w-3.5 h-3.5 text-teal-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                        </div>
                      ) : col.type === 'select' || isSite ? (
                        <select
                          value={value}
                          disabled={isReadOnly || isSubmitting}
                          onChange={e => handleChange(key, e.target.value)}
                          className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors ${
                            errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                          } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed font-medium' : ''}`}
                        >
                          <option value="" disabled>{col.placeholder || `Select ${col.label}...`}</option>
                          {options.map(opt => (
                            <option key={String(opt.value)} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : col.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={value}
                          readOnly={isReadOnly}
                          disabled={isSubmitting}
                          placeholder={col.placeholder}
                          onChange={e => handleChange(key, e.target.value)}
                          className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors resize-y ${
                            errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                          } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed' : ''}`}
                        />
                      ) : col.type === 'currency' ? (
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold">£</span>
                          <input
                            type="number"
                            step={col.step || '0.01'}
                            min={col.min || 0}
                            value={value}
                            readOnly={isReadOnly}
                            disabled={isSubmitting}
                            placeholder={col.placeholder || '0.00'}
                            onChange={e => handleChange(key, e.target.value)}
                            className={`w-full pl-6 pr-2 py-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors ${
                              errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                            } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      ) : col.type === 'number' ? (
                        <input
                          type="number"
                          step={col.step || '1'}
                          min={col.min}
                          max={col.max}
                          value={value}
                          readOnly={isReadOnly}
                          disabled={isSubmitting}
                          placeholder={col.placeholder}
                          onChange={e => handleChange(key, e.target.value)}
                          className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors ${
                            errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                          } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed' : ''}`}
                        />
                      ) : col.type === 'date' ? (
                        <input
                          type="date"
                          value={value}
                          readOnly={isReadOnly}
                          disabled={isSubmitting}
                          onChange={e => handleChange(key, e.target.value)}
                          className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors ${
                            errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                          } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed' : ''}`}
                        />
                      ) : col.type === 'checkbox' ? (
                        <div className="flex items-center gap-2 pt-2">
                          <input
                            type="checkbox"
                            checked={!!value}
                            disabled={isReadOnly || isSubmitting}
                            onChange={e => handleChange(key, e.target.checked)}
                            className="w-4 h-4 text-[#0d9488] rounded border-neutral-300 focus:ring-[#0d9488]"
                          />
                          <span className="text-neutral-700">{col.placeholder || col.label}</span>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={value}
                          readOnly={isReadOnly}
                          disabled={isSubmitting}
                          placeholder={col.placeholder}
                          onChange={e => handleChange(key, e.target.value)}
                          className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors ${
                            errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                          } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed' : ''}`}
                        />
                      )}

                      {errors[key] && (
                        <p className="text-[11px] text-red-600">{errors[key]}</p>
                      )}
                      {col.helperText && !errors[key] && (
                        <p className="text-[10px] text-neutral-500">{col.helperText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Universal Proof & Document Attachments Section */}
          <AttachmentsSection
            attachments={formData.attachments || []}
            onChange={atts => setFormData(prev => ({ ...prev, attachments: atts }))}
            allowUpload={true}
            entityName={title}
          />

          {/* Footer actions */}
          <div className="pt-4 border-t border-[#edebe9] flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearOrRevert}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors"
              title={isEdit ? "Revert unsaved changes to original values" : "Clear all fields to defaults"}
            >
              {isEdit ? 'Revert Changes' : 'Clear Form'}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitLabel || (isEdit ? 'Save Changes' : 'Create Record')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
