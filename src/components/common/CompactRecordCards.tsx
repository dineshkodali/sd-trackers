import React from 'react';
import { 
  Eye, 
  Edit3, 
  Archive, 
  RotateCcw, 
  Trash2, 
  Building2, 
  Inbox,
  LucideIcon
} from 'lucide-react';

export interface CompactRecordField {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  badgeClass?: string;
  fullWidth?: boolean;
}

export interface CompactRecordCardProps {
  id?: string;
  srNo?: number | string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  site?: string;
  fields: CompactRecordField[];
  onView?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isArchived?: boolean;
  extraActions?: React.ReactNode;
}

export const CompactRecordCard: React.FC<CompactRecordCardProps> = ({
  id,
  srNo,
  title,
  subtitle,
  statusBadge,
  site,
  fields,
  onView,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  canEdit = true,
  canDelete = true,
  isArchived = false,
  extraActions
}) => {
  const hasActions = Boolean(onView || (onEdit && canEdit) || onArchive || onRestore || (onDelete && canDelete) || extraActions);

  return (
    <div 
      id={id ? `compact-card-${id}` : undefined}
      className="bg-white border border-[#e1dfdd] rounded-md p-3.5 shadow-xs hover:border-[#0d9488]/40 transition-all flex flex-col justify-between gap-3 text-xs"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {srNo !== undefined && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                #{srNo}
              </span>
            )}
            {site && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0f766e] bg-[#f0fdfa] border border-[#99f6e4] px-2 py-0.5 rounded">
                <Building2 className="w-3 h-3 text-[#0d9488]" />
                <span className="truncate max-w-[140px]">{site}</span>
              </span>
            )}
          </div>
          <h4 className="font-semibold text-sm text-[#242424] leading-snug truncate">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[11px] text-[#605e5c] mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Status Badge */}
        {statusBadge && (
          <div className="shrink-0">
            {statusBadge}
          </div>
        )}
      </div>

      {/* Middle Key-Value Metadata Grid */}
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-2 bg-[#faf9f8] p-2.5 rounded-sm border border-[#edebe9]">
          {fields.map((field, idx) => {
            const Icon = field.icon;
            return (
              <div 
                key={`${field.label}-${idx}`}
                className={`min-w-0 ${field.fullWidth ? 'col-span-2' : ''}`}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-[#8a8886] tracking-wider mb-0.5">
                  {Icon && <Icon className="w-3 h-3 text-neutral-400 shrink-0" />}
                  <span className="truncate">{field.label}</span>
                </div>
                <div className="text-xs text-[#242424] font-medium truncate">
                  {field.value !== null && field.value !== undefined && field.value !== '' ? (
                    field.value
                  ) : (
                    <span className="text-neutral-400 italic font-normal">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Toolbar */}
      {hasActions && (
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-[#edebe9]">
          <div className="flex items-center gap-1 flex-wrap">
            {/* View Details button */}
            {onView && (
              <button
                onClick={onView}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f3f8fd] hover:bg-[#ebf3fc] text-[#0078d4] font-semibold text-[11px] rounded transition-colors cursor-pointer"
                title="View Full Details"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
            )}

            {/* Edit button */}
            {onEdit && canEdit && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f0fdfa] hover:bg-[#ccfbf1] text-[#0f766e] font-semibold text-[11px] rounded transition-colors cursor-pointer"
                title="Edit Record"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {extraActions}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Archive / Restore button */}
            {isArchived && onRestore ? (
              <button
                onClick={onRestore}
                className="inline-flex items-center gap-1 px-2 py-1.5 bg-[#f0fdfa] hover:bg-[#ccfbf1] text-[#0d9488] font-semibold text-[11px] rounded transition-colors cursor-pointer"
                title="Restore Record"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            ) : onArchive ? (
              <button
                onClick={onArchive}
                className="p-1.5 text-neutral-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                title="Archive Record"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            ) : null}

            {/* Delete button */}
            {onDelete && canDelete && (
              <button
                onClick={onDelete}
                className="p-1.5 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded transition-colors cursor-pointer"
                title="Delete Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface CompactRecordListProps<T = any> {
  data: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
}

export function CompactRecordList<T = any>({
  data,
  renderCard,
  emptyMessage = 'No matching operational records found.'
}: CompactRecordListProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-500 bg-white border border-[#e1dfdd] rounded-sm p-6">
        <Inbox className="w-8 h-8 text-neutral-400 mx-auto mb-2 stroke-1" />
        <p className="text-xs font-medium text-[#605e5c]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0">
      {data.map((item, index) => renderCard(item, index))}
    </div>
  );
}
