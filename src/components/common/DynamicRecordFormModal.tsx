import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertCircle, Loader2, Lock, Building2, UserCheck, Calendar, Plus, Settings2 } from 'lucide-react';
import { TableColumnConfig, SelectOption } from '../../types/tableSchema';
import { useApp } from '../../context/AppContext';
import { AttachmentsSection } from './AttachmentsSection';
import { QuickOptionModal } from './QuickOptionModal';

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
    currentUserRole,
    getFieldOptions
  } = useApp();

  const userAssignedHotel = useMemo(() => {
    // 1. Direct assignedSite from AppContext if set and not "All Sites"
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') {
      return assignedSite;
    }
    // 2. From authProfile
    if (authProfile?.assignedSite && authProfile.assignedSite !== 'All Sites' && authProfile.assignedSite !== 'all') {
      return authProfile.assignedSite;
    }
    const profileAny = authProfile as any;
    if (profileAny?.assigned_site && profileAny.assigned_site !== 'All Sites' && profileAny.assigned_site !== 'all') {
      return profileAny.assigned_site;
    }
    if (profileAny?.hotel && profileAny.hotel !== 'All Sites' && profileAny.hotel !== 'all') {
      return profileAny.hotel;
    }
    // 3. From allowedSites
    if (allowedSites && allowedSites.length > 0 && allowedSites[0] !== 'All Sites' && allowedSites[0] !== 'all') {
      return allowedSites[0];
    }
    // 4. Currently selected site in filter bar (if not 'all')
    if (selectedSite && selectedSite !== 'all') {
      return selectedSite;
    }
    // 5. First real site name from sites list
    const firstRealSite = sites?.find(s => {
      const name = typeof s === 'string' ? s : s?.name;
      return name && name !== 'All Sites' && name !== 'all';
    });
    if (firstRealSite) {
      return typeof firstRealSite === 'string' ? firstRealSite : firstRealSite.name;
    }
    return '';
  }, [assignedSite, authProfile, allowedSites, selectedSite, sites]);

  const loggedInUserName = useMemo(() => {
    return authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (Staff)` : 'Duty Officer');
  }, [authProfile, currentUserName, currentUserRole]);

  const isSuperAdmin = currentUserRole === 'Super Admin';
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isEditing = Boolean(isEdit || (initialValues as any)?.id);

  const allSiteNames = useMemo(() => {
    const fromAllowed = (allowedSites || []).filter(s => Boolean(s && s !== 'All Sites' && s !== 'all'));
    const fromSites = (sites || [])
      .map(s => (typeof s === 'string' ? s : s?.name))
      .filter((n): n is string => Boolean(n && typeof n === 'string' && n.trim() !== '' && n !== 'All Sites' && n !== 'all'));
    const combined = Array.from(new Set([...fromAllowed, ...fromSites, ...(userAssignedHotel ? [userAssignedHotel] : [])]));
    return combined.length > 0 ? combined : (userAssignedHotel ? [userAssignedHotel] : ['Brit Hotel']);
  }, [allowedSites, sites, userAssignedHotel]);

  const effectiveContext = useMemo(() => ({
    assignedSite: userAssignedHotel,
    allowedSites: allSiteNames,
    sites,
    selectedSite,
    canAccessAllSites,
    ...contextData
  }), [userAssignedHotel, allSiteNames, sites, selectedSite, canAccessAllSites, contextData]);

  const isLoggedByColumn = (col: TableColumnConfig<T>): boolean => {
    // Non-text fields cannot be logged-by fields
    if (col.type === 'textarea' || col.type === 'date' || col.type === 'number' || col.type === 'currency' || col.type === 'checkbox' || col.type === 'select') {
      return false;
    }
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Explicit exclusions: These are NOT logged-by fields!
    if (
      key.includes('officerleadinghotel') ||
      key.includes('laofficer') ||
      key.includes('allocatedworker') ||
      key.includes('review') ||
      key.includes('contractor') ||
      key.includes('client') ||
      key.includes('lead') ||
      label.includes('officerleadinghotel') ||
      label.includes('laofficer') ||
      label.includes('allocatedworker') ||
      label.includes('review') ||
      label.includes('contractor') ||
      label.includes('client')
    ) {
      return false;
    }

    return (
      key === 'loggedby' ||
      key === 'raisedby' ||
      key === 'reportedby' ||
      key === 'submittedby' ||
      key === 'personreporting' ||
      key === 'staffreporting' ||
      key === 'auditedby' ||
      key === 'uploadedby' ||
      label === 'loggedby' ||
      label === 'raisedby' ||
      label === 'reportedby' ||
      label === 'submittedby' ||
      label === 'personreporting' ||
      label === 'staffreporting' ||
      label === 'auditedby' ||
      label === 'uploadedby'
    );
  };

  const isSiteColumn = (col: TableColumnConfig<T>): boolean => {
    // If it's a logged-by field, it can NEVER be a site column
    if (isLoggedByColumn(col)) {
      return false;
    }
    // Textareas, dates, numbers, currency, checkboxes can NEVER be a site column
    if (col.type === 'textarea' || col.type === 'date' || col.type === 'number' || col.type === 'currency' || col.type === 'checkbox') {
      return false;
    }
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exclude any columns that merely mention site/hotel/property in notes, reviews, officers, dates, etc.
    if (
      key.includes('review') ||
      key.includes('team') ||
      key.includes('officer') ||
      key.includes('staff') ||
      key.includes('worker') ||
      key.includes('damage') ||
      key.includes('left') ||
      key.includes('depart') ||
      key.includes('contact') ||
      key.includes('website') ||
      key.includes('address') ||
      label.includes('review') ||
      label.includes('team') ||
      label.includes('officer') ||
      label.includes('staff') ||
      label.includes('worker') ||
      label.includes('damage') ||
      label.includes('left') ||
      label.includes('depart') ||
      label.includes('contact') ||
      label.includes('website') ||
      label.includes('address')
    ) {
      return false;
    }

    // Exact key matches for property/hotel
    if (
      key === 'site' ||
      key === 'sitename' ||
      key === 'hotel' ||
      key === 'hotelname' ||
      key === 'property' ||
      key === 'propertyname' ||
      key === 'assignedhotel'
    ) {
      return true;
    }

    // Exact label matches for facility/hotel/property
    return (
      label === 'site' ||
      label === 'sitename' ||
      label === 'property' ||
      label === 'propertyname' ||
      label === 'hotel' ||
      label === 'hotelname' ||
      label === 'hotelsite' ||
      label === 'sitehotel' ||
      label === 'propertysite' ||
      label === 'siteproperty' ||
      label === 'propertyhotel' ||
      label === 'hotelproperty' ||
      label === 'contractedproperty'
    );
  };

  const isDobColumn = (col: TableColumnConfig<T>): boolean => {
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (
      key === 'dob' ||
      key === 'sudob' ||
      key === 'dateofbirth' ||
      key === 'birthdate' ||
      label.includes('dob') ||
      label.includes('birth')
    );
  };

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quickManageCol, setQuickManageCol] = useState<TableColumnConfig<T> | null>(null);

  const prevOpenRef = useRef<boolean>(false);
  const prevRecordIdRef = useRef<string | null>(null);

  // Filter out internal system metadata fields, dedicated file attachment columns (managed by AttachmentsSection), and guarantee a locked Logged By field
  const formColumns = useMemo(() => {
    const activeCols = columns.filter(col => {
      if (col.isSystemMetadata) return false;
      const k = String(col.key).toLowerCase();
      if (
        k === 'attachments' ||
        k === 'attachmenturl' ||
        k === 'fileurl' ||
        k === 'attachment_url' ||
        k === 'file_url' ||
        k === 'storagepath' ||
        k === 'storage_path' ||
        k === 'filepath' ||
        k === 'file_path'
      ) {
        return false;
      }
      return true;
    });
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
        const val = initialValues[col.key as keyof T];
        if (col.type === 'date' && !isEditing && !isDobColumn(col) && !isSuperAdmin) {
          if (val && typeof val === 'string' && val.slice(0, 10) >= todayStr) {
            initial[key] = val.slice(0, 10);
          } else {
            initial[key] = todayStr;
          }
        } else {
          initial[key] = val;
        }
      } else if (col.defaultValue !== undefined) {
        const resolved = typeof col.defaultValue === 'function' ? col.defaultValue(effectiveContext) : col.defaultValue;
        if (col.type === 'date' && !isEditing && !isDobColumn(col) && !isSuperAdmin) {
          if (resolved && typeof resolved === 'string' && resolved.slice(0, 10) >= todayStr) {
            initial[key] = resolved.slice(0, 10);
          } else {
            initial[key] = todayStr;
          }
        } else {
          initial[key] = resolved;
        }
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
            initial[key] = isDobColumn(col) ? '' : todayStr;
            break;
          default:
            initial[key] = '';
        }
      }
    });

    // Ensure attachments array exists and normalize JSON string or legacy singleUrl
    let initialAtts: any[] = [];
    const rawAtts = (initialValues as any)?.attachments;
    if (Array.isArray(rawAtts)) {
      initialAtts = rawAtts;
    } else if (typeof rawAtts === 'string' && rawAtts.trim().startsWith('[')) {
      try {
        initialAtts = JSON.parse(rawAtts);
      } catch {
        initialAtts = [];
      }
    } else {
      // Legacy fallback: if record only had attachmentUrl / fileUrl that is a valid http link, populate it as an initial attachment so the user can see and delete it!
      const legacyUrl = (initialValues as any)?.attachmentUrl || (initialValues as any)?.attachment_url || (initialValues as any)?.fileUrl || (initialValues as any)?.file_url;
      if (typeof legacyUrl === 'string' && legacyUrl.trim() && (legacyUrl.startsWith('http://') || legacyUrl.startsWith('https://')) && !legacyUrl.includes('null') && !legacyUrl.includes('undefined')) {
        initialAtts = [{
          id: 'att-legacy',
          name: (initialValues as any)?.documentTitle || (initialValues as any)?.title || (initialValues as any)?.name || legacyUrl.split('/').pop()?.split('?')[0] || 'Attached Document',
          size: 0,
          type: legacyUrl.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          url: legacyUrl,
          dataUrl: legacyUrl,
          uploadedBy: (initialValues as any)?.uploadedBy || (initialValues as any)?.loggedBy || loggedInUserName,
          uploadedAt: (initialValues as any)?.updatedAt || (initialValues as any)?.createdAt || todayStr
        }];
      }
    }
    initial.attachments = initialAtts;
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

    // Guard: Review notes or advice fields must NEVER contain hotel/property names. Keep them empty ('') if erroneously set to a hotel.
    formColumns.forEach(col => {
      const k = String(col.key);
      const val = initial[k];
      if (
        (k === 'reviewBySGTeam' || k.toLowerCase().includes('review') || k.toLowerCase().includes('advice')) &&
        typeof val === 'string' &&
        (val.toLowerCase().includes('hotel') || val.toLowerCase().includes('stansted') || val.toLowerCase().includes('ibis') || allSiteNames.includes(val))
      ) {
        initial[k] = '';
      }
    });

    setFormData(initial);
    setErrors({});
    setSubmitError(null);
  }, [isOpen, initialValues, assignedSite, selectedSite, canAccessAllSites, userAssignedHotel, allSiteNames, effectiveContext, formColumns, loggedInUserName, isEditing, isSuperAdmin, todayStr]);

  const handleClearOrRevert = () => {
    if (isEditing && initialValues) {
      // Revert to original record values
      const initial: Record<string, any> = { ...initialValues };
      if (!canAccessAllSites()) {
        formColumns.forEach(col => {
          if (isSiteColumn(col)) {
            initial[String(col.key)] = userAssignedHotel;
          }
        });
      }
      formColumns.forEach(col => {
        const k = String(col.key);
        const val = initial[k];
        if (
          (k === 'reviewBySGTeam' || k.toLowerCase().includes('review') || k.toLowerCase().includes('advice')) &&
          typeof val === 'string' &&
          (val.toLowerCase().includes('hotel') || val.toLowerCase().includes('stansted') || val.toLowerCase().includes('ibis') || allSiteNames.includes(val))
        ) {
          initial[k] = '';
        }
      });
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
        } else if (isLoggedByColumn(col)) {
          blank[key] = loggedInUserName;
        } else if (col.defaultValue !== undefined) {
          const resolved = typeof col.defaultValue === 'function' ? col.defaultValue(effectiveContext) : col.defaultValue;
          if (col.type === 'date' && !isDobColumn(col) && !isSuperAdmin) {
            blank[key] = (resolved && typeof resolved === 'string' && resolved.slice(0, 10) >= todayStr) ? resolved.slice(0, 10) : todayStr;
          } else {
            blank[key] = resolved;
          }
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
              blank[key] = isDobColumn(col) ? '' : todayStr;
              break;
            default:
              blank[key] = '';
          }
        }
      });
      blank.attachments = [];
      blank.loggedBy = loggedInUserName;
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
    if (col.optionCategory) {
      const dynamic = getFieldOptions(col.optionCategory, false);
      if (dynamic && dynamic.length > 0) {
        return dynamic.map(d => ({ label: d.label, value: d.value, color: d.color, description: d.description }));
      }
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
      const val = isSite && !canAccessAllSites() 
        ? userAssignedHotel 
        : (formData[key] ?? (isSite ? userAssignedHotel : ''));

      if (col.required) {
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          newErrors[key] = `${col.label} is required`;
          return;
        }
      }

      // Strict Date Rule: Non-Super Admin cannot choose past dates for operational logs/bookings
      if (col.type === 'date' && !isSuperAdmin && !isDobColumn(col) && val) {
        const dateVal = String(val).trim().slice(0, 10);
        if (dateVal) {
          if (!isEditing && dateVal < todayStr) {
            newErrors[key] = `${col.label} cannot be in the past (must be today or later). Only Super Admin can select past dates.`;
          } else if (isEditing && dateVal < todayStr) {
            const initialDateVal = (initialValues as any)?.[key] ? String((initialValues as any)[key]).trim().slice(0, 10) : '';
            if (dateVal !== initialDateVal) {
              newErrors[key] = `${col.label} cannot be changed to a past date. Only Super Admin can select past dates.`;
            }
          }
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

      const primaryAtt = processed.attachments.length > 0 ? processed.attachments[0] : null;
      if (primaryAtt) {
        const primaryLink = primaryAtt.url || primaryAtt.dataUrl || '';
        processed.attachmentUrl = primaryLink;
        processed.attachment_url = primaryLink;
        processed.fileUrl = primaryLink;
        processed.file_url = primaryLink;
      } else {
        processed.attachmentUrl = '';
        processed.attachment_url = '';
        processed.fileUrl = '';
        processed.file_url = '';
        processed.storagePath = '';
        processed.storage_path = '';
        processed.filePath = '';
        processed.file_path = '';
      }

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
                        ) : col.type === 'date' && !isDobColumn(col) ? (
                          !isSuperAdmin ? (
                            <span className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-teal-600" /> Today or Later
                            </span>
                          ) : (
                            <span className="text-[10px] text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5 text-purple-600" /> Super Admin: All Dates
                            </span>
                          )
                        ) : isReadOnly ? (
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5 text-amber-600" /> Auto
                          </span>
                        ) : (col.type === 'select' && !isSite && col.allowQuickAdd !== false) ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQuickManageCol(col)}
                              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-[#0f766e] hover:text-[#0d9488] hover:bg-teal-50 rounded border border-teal-200/70 transition-colors cursor-pointer"
                              title={`Quick add new choice to ${col.label}`}
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Add</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickManageCol(col)}
                              className="p-0.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                              title={`Manage choices for ${col.label}`}
                            >
                              <Settings2 className="w-3 h-3" />
                            </button>
                          </div>
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
                          onChange={e => {
                            if (e.target.value === '__ADD_NEW_OPTION__') {
                              setQuickManageCol(col);
                              return;
                            }
                            handleChange(key, e.target.value);
                          }}
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
                          {col.type === 'select' && !isSite && col.allowQuickAdd !== false && (
                            <option value="__ADD_NEW_OPTION__" className="font-bold text-teal-800 bg-teal-50">
                              ➕ + Add New Option...
                            </option>
                          )}
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
                        <div className="space-y-1">
                          <input
                            type="date"
                            value={value}
                            readOnly={isReadOnly}
                            disabled={isSubmitting}
                            min={
                              !isSuperAdmin && !isDobColumn(col)
                                ? (isEditing && (initialValues as any)?.[key] && String((initialValues as any)[key]).slice(0, 10) < todayStr
                                    ? String((initialValues as any)[key]).slice(0, 10)
                                    : todayStr)
                                : col.min
                            }
                            max={isDobColumn(col) ? todayStr : col.max}
                            onChange={e => handleChange(key, e.target.value)}
                            className={`w-full p-2 border rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors ${
                              errors[key] ? 'border-red-500 bg-red-50/20' : 'border-[#8a8886]'
                            } ${isReadOnly ? 'bg-neutral-100 text-neutral-600 cursor-not-allowed' : ''}`}
                          />
                          {!isDobColumn(col) && (
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              {!isSuperAdmin ? (
                                <span className="text-teal-700 font-medium flex items-center gap-1">
                                  <span>&bull;</span> Date must be today or later
                                </span>
                              ) : (
                                <span className="text-purple-700 font-medium flex items-center gap-1">
                                  <span>&bull;</span> Super Admin: Past dates allowed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
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
              title={isEditing ? "Revert unsaved changes to original values" : "Clear all fields to defaults"}
            >
              {isEditing ? 'Revert Changes' : 'Clear Form'}
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
                <span>{submitLabel || (isEditing ? 'Save Changes' : 'Create Record')}</span>
              </button>
            </div>
          </div>
        </form>

        {quickManageCol && (
          <QuickOptionModal
            isOpen={Boolean(quickManageCol)}
            onClose={() => setQuickManageCol(null)}
            categoryKey={quickManageCol.optionCategory}
            categoryName={quickManageCol.label}
            onOptionAdded={newOpt => {
              handleChange(String(quickManageCol.key), newOpt.value);
            }}
            customOptions={!quickManageCol.optionCategory ? (resolveOptions(quickManageCol) as any) : undefined}
          />
        )}
      </div>
    </div>
  );
}
