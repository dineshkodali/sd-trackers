import React from 'react';
import { 
  Eye, 
  Edit3, 
  Archive, 
  RotateCcw, 
  Trash2, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Inbox
} from 'lucide-react';
import { TableColumnConfig } from '../../types/tableSchema';

interface DynamicDataTableProps<T = any> {
  columns: TableColumnConfig<T>[];
  data: T[];
  onView?: (record: T) => void;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void;
  onArchive?: (record: T) => void;
  onRestore?: (record: T) => void;
  sortField?: string;
  sortAsc?: boolean;
  onSort?: (field: string) => void;
  canEdit?: (record: T) => boolean;
  canDelete?: (record: T) => boolean;
  emptyMessage?: string;
  minWidth?: string;
}

export function DynamicDataTable<T = any>({
  columns,
  data,
  onView,
  onEdit,
  onDelete,
  onArchive,
  onRestore,
  sortField,
  sortAsc = false,
  onSort,
  canEdit = () => true,
  canDelete = () => true,
  emptyMessage = 'No matching operational records found.',
  minWidth = '1200px'
}: DynamicDataTableProps<T>) {
  // Only display columns configured as visible in table
  const tableColumns = columns.filter(col => col.visibleInTable !== false && !col.isSystemMetadata);

  const renderCellContent = (col: TableColumnConfig<T>, record: T) => {
    const value = (record as any)[col.key];

    if (col.renderCell) {
      return col.renderCell(value, record);
    }

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

    if (col.type === 'badge' || col.badgeColors) {
      const colorClass = (col.badgeColors && col.badgeColors[String(value)]) || 'bg-neutral-100 text-neutral-700';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${colorClass}`}>
          {String(value)}
        </span>
      );
    }

    if (col.type === 'checkbox') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
          value ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    return <span className="text-neutral-700">{String(value)}</span>;
  };

  const hasActions = Boolean(onView || onEdit || onDelete || onArchive || onRestore);

  return (
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left text-xs border-collapse" style={{ minWidth }}>
        <thead>
          <tr className="bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold select-none whitespace-nowrap">
            {tableColumns.map(col => {
              const key = String(col.key);
              const isSorted = sortField === key;

              return (
                <th
                  key={key}
                  onClick={() => onSort && onSort(key)}
                  className={`p-2.5 ${onSort ? 'cursor-pointer hover:bg-[#edebe9] transition-colors' : ''}`}
                  title={onSort ? `Sort by ${col.label}` : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {onSort && (
                      isSorted ? (
                        sortAsc ? (
                          <ArrowUp className="w-3 h-3 text-[#0d9488]" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                      )
                    )}
                  </div>
                </th>
              );
            })}

            {hasActions && (
              <th className="p-2.5 text-right sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.02)] whitespace-nowrap">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#edebe9]">
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={tableColumns.length + (hasActions ? 1 : 0)} 
                className="py-16 text-center text-neutral-500"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <Inbox className="w-8 h-8 text-neutral-400 stroke-1" />
                  <p className="text-sm font-medium">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((record, index) => {
              const recordId = (record as any).id || String(index);
              const isArchived = (record as any).status === 'Archived' || (record as any).isArchived === true;
              const allowEdit = canEdit(record);
              const allowDelete = canDelete(record);

              return (
                <tr 
                  key={recordId}
                  className="hover:bg-[#f3f9f8] transition-colors duration-100 group"
                >
                  {tableColumns.map(col => {
                    const key = String(col.key);
                    return (
                      <td key={key} className="p-2.5 text-neutral-700 whitespace-nowrap max-w-[280px] truncate">
                        {renderCellContent(col, record)}
                      </td>
                    );
                  })}

                  {hasActions && (
                    <td className="p-2.5 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#f3f9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.04)] transition-colors">
                      <div className="flex items-center justify-end gap-1">
                        {/* View record */}
                        {onView && (
                          <button
                            id={`view-rec-${recordId}`}
                            onClick={() => onView(record)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit record */}
                        {onEdit && allowEdit && (
                          <button
                            id={`edit-rec-${recordId}`}
                            onClick={() => onEdit(record)}
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#edebe9] rounded transition-colors"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Archive or Restore */}
                        {isArchived && onRestore ? (
                          <button
                            id={`restore-rec-${recordId}`}
                            onClick={() => onRestore(record)}
                            className="p-1 text-[#0d9488] hover:bg-[#edebe9] rounded font-semibold text-[11px] flex items-center gap-0.5 transition-colors"
                            title="Restore Record"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Restore</span>
                          </button>
                        ) : onArchive ? (
                          <button
                            id={`archive-rec-${recordId}`}
                            onClick={() => onArchive(record)}
                            className="p-1 text-neutral-500 hover:text-purple-700 hover:bg-[#edebe9] rounded transition-colors"
                            title="Archive Record"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : null}

                        {/* Delete record */}
                        {onDelete && allowDelete && (
                          <button
                            id={`delete-rec-${recordId}`}
                            onClick={() => onDelete(record)}
                            className="p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
  );
}
