import React from 'react';
import { Trash2, Edit3, X, CheckSquare, Square } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onDeleteSelected?: () => void;
  onUpdateStatusSelected?: () => void;
  customActions?: React.ReactNode;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  onDeleteSelected,
  onUpdateStatusSelected,
  customActions
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#323130] text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-2 border-r border-[#605e5c] pr-4">
        <span className="bg-[#0078d4] text-white px-2 py-0.5 rounded-full text-xs font-bold">
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          className="p-1 hover:bg-[#484644] rounded-full transition-colors text-neutral-300 hover:text-white"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {selectedCount < totalCount && (
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#484644] rounded-full text-sm font-medium transition-colors"
          >
            <CheckSquare className="w-4 h-4" /> Select All ({totalCount})
          </button>
        )}

        {onUpdateStatusSelected && (
          <button
            onClick={onUpdateStatusSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#484644] rounded-full text-sm font-medium transition-colors"
          >
            <Edit3 className="w-4 h-4" /> Edit Status
          </button>
        )}

        {customActions}

        {onDeleteSelected && (
          <button
            onClick={onDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-full text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        )}
      </div>
    </div>
  );
};
