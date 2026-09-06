import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#faf9f8] border-t border-[#edebe9] text-xs text-[#605e5c]">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          id="select-page-size"
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 bg-white border border-[#8a8886] rounded-xs text-[#323130] focus:outline-2 focus:outline-[#71afe5]"
          title="Adjust page size to optimize rendering speed"
        >
          <option value={10}>10 (Fastest)</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="hidden sm:inline text-neutral-400">|</span>
        <span>
          Showing <strong className="text-[#242424]">{startItem}</strong> - <strong className="text-[#242424]">{endItem}</strong> of <strong className="text-[#242424]">{totalItems}</strong>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1 rounded bg-white border border-[#8a8886] text-[#323130] hover:bg-[#edebe9] disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
          title="First Page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1 rounded bg-white border border-[#8a8886] text-[#323130] hover:bg-[#edebe9] disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
          title="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <span className="px-3 py-1 font-semibold text-[#242424]">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1 rounded bg-white border border-[#8a8886] text-[#323130] hover:bg-[#edebe9] disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
          title="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1 rounded bg-white border border-[#8a8886] text-[#323130] hover:bg-[#edebe9] disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed"
          title="Last Page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
