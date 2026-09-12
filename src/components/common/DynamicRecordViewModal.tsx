import React, { useMemo } from 'react';
import { X, Edit3, ShieldCheck, UserCheck } from 'lucide-react';
import { TableColumnConfig, SelectOption } from '../../types/tableSchema';
import { AttachmentsSection } from './AttachmentsSection';

interface DynamicRecordViewModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  record: Partial<T> | null;
  columns: TableColumnConfig<T>[];
  onEdit?: () => void;
  canEdit?: boolean;
}

export function DynamicRecordViewModal<T = any>({
  isOpen,
  onClose,
  title,
  record,
  columns,
  onEdit,
  canEdit = false
}: DynamicRecordViewModalProps<T>) {
  if (!isOpen || !record) return null;

  const isLoggedByColumn = (col: TableColumnConfig<T>): boolean => {
    if (col.type === 'textarea' || col.type === 'date' || col.type === 'number' || col.type === 'currency' || col.type === 'checkbox' || col.type === 'select') {
      return false;
    }
    const key = String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '');
    const label = String(col.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Exclude fields that represent external officers, lead officers, reviewers, contractors, or clients
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

  // Filter out internal system metadata fields and file attachment columns (which are rendered in the dedicated AttachmentsSection)
  const viewColumns = useMemo(() => {
    const activeCols = columns
      .filter(col => {
        if (col.isSystemMetadata || col.visibleInView === false) return false;
        const k = String(col.key).toLowerCase();
        if (k === 'attachments' || k === 'attachmenturl' || k === 'fileurl' || k === 'attachment_url' || k === 'file_url') {
          return false;
        }
        return true;
      })
      .map(col => isLoggedByColumn(col) ? { ...col, label: 'Logged By' } : col);

    const hasLoggedBy = activeCols.some(isLoggedByColumn);
    if (!hasLoggedBy && (record as any)?.loggedBy) {
      const injectedLoggedByCol: TableColumnConfig<T> = {
        key: 'loggedBy' as any,
        label: 'Logged By',
        section: 'Audit & Accountability'
      };
      return [...activeCols, injectedLoggedByCol];
    }
    return activeCols;
  }, [columns, record]);

  // Group columns by section if specified
  const sections = useMemo(() => {
    const map = new Map<string, TableColumnConfig<T>[]>();
    viewColumns.forEach(col => {
      const secName = col.section || 'General Information';
      if (!map.has(secName)) map.set(secName, []);
      map.get(secName)!.push(col);
    });
    return Array.from(map.entries());
  }, [viewColumns]);

  const renderValue = (col: TableColumnConfig<T>, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-neutral-400 italic">—</span>;
    }

    if (col.formatValue) {
      return <span>{col.formatValue(value)}</span>;
    }

    if (col.type === 'currency') {
      const num = Number(value);
      return <span className="font-semibold text-neutral-800">£{Number.isFinite(num) ? num.toFixed(2) : '0.00'}</span>;
    }

    if (col.type === 'checkbox') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${value ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
          }`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    if (col.type === 'badge' || col.badgeColors) {
      const colorClass = (col.badgeColors && col.badgeColors[String(value)]) || 'bg-neutral-100 text-neutral-800 border-neutral-200';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${colorClass}`}>
          {String(value)}
        </span>
      );
    }

    if (col.type === 'textarea') {
      return (
        <div className="bg-[#faf9f8] p-3 rounded-xs border border-[#edebe9] text-neutral-700 whitespace-pre-wrap leading-relaxed">
          {String(value)}
        </div>
      );
    }

    return <span className="text-neutral-800 font-medium">{String(value)}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#f3f8fd]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#e0f2fe] text-[#0284c7] rounded">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0f766e]">
                {title}
              </h3>
              <p className="text-[11px] text-neutral-500">
                Complete operational business record dossier
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Record</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Details */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#242424]">
          {sections.map(([secName, secCols]) => (
            <div key={secName} className="space-y-3">
              <div className="pb-1 border-b border-neutral-200">
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{secName}</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {secCols.map(col => {
                  const key = String(col.key);
                  const isFullWidth = col.colSpan === 2 || col.type === 'textarea';
                  const value = (record as any)[key];

                  return (
                    <div key={key} className={isFullWidth ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
                      <div className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider">
                        {col.label}
                      </div>
                      <div className="text-xs">
                        {renderValue(col, value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Universal Proof & Document Attachments Dossier */}
          {(() => {
            let rawAttachments: any[] = [];
            const hasExplicitArray = Array.isArray((record as any)?.attachments);
            if (hasExplicitArray) {
              rawAttachments = (record as any).attachments;
            } else if (typeof (record as any)?.attachments === 'string' && (record as any).attachments.trim().startsWith('[')) {
              try {
                rawAttachments = JSON.parse((record as any).attachments);
              } catch {
                rawAttachments = [];
              }
            }
            const singleUrl = (record as any)?.attachmentUrl || (record as any)?.attachment_url || (record as any)?.fileUrl || (record as any)?.file_url;
            const isValidHttpUrl = typeof singleUrl === 'string' && singleUrl.trim() && (singleUrl.startsWith('http://') || singleUrl.startsWith('https://')) && !singleUrl.includes('null') && !singleUrl.includes('undefined');
            // Only fallback to singleUrl if the record does NOT have an explicit attachments array (e.g. legacy table row)
            // AND singleUrl is a valid http link (never a lingering data: URI)
            const effectiveAttachments = rawAttachments.length > 0 
              ? rawAttachments 
              : (!hasExplicitArray && isValidHttpUrl
                  ? [{
                      id: 'primary-doc',
                      name: (singleUrl.startsWith('http') ? singleUrl.split('/').pop()?.split('?')[0] : '') || 'Attached Document',
                      size: 0,
                      type: singleUrl.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
                      url: singleUrl,
                      uploadedAt: (record as any)?.updatedAt || (record as any)?.createdAt || new Date().toISOString()
                    }]
                  : []);

            return (
              <AttachmentsSection
                attachments={effectiveAttachments}
                readOnly={true}
                entityName={title}
              />
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-mono">
            Record ID: {(record as any).id || '—'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
