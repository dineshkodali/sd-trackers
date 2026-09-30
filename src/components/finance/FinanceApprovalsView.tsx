import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileCheck, 
  Search, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  SlidersHorizontal, 
  Building2,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { financeService } from '../../services/financeService';
import { FinanceBillDetailModal } from './FinanceBillDetailModal';
import { FinanceBillModal } from './FinanceBillModal';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { AccessDeniedView } from '../common/AccessDeniedView';
import { FINANCE_APPROVALS_TABLE_COLUMNS, FINANCE_STATUS_BADGE_CLASSES } from '../../data/defaultTableSchemas';
import type { FinanceBill } from '../../types/finance';

const approvalExportColumns: ExportColumnOption[] = [
  { id: 'billNumber', label: 'Bill Reference' },
  { id: 'siteName', label: 'Property / Site' },
  { id: 'vendorName', label: 'Payee / Vendor' },
  { id: 'billType', label: 'Type' },
  { id: 'billDate', label: 'Bill Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'totalAmount', label: 'Payable (£)' },
  { id: 'status', label: 'Workflow Stage' },
  { id: 'submitterName', label: 'Submitted By' },
  { id: 'finalApprovedByName', label: 'Approved By' }
];

export const FinanceApprovalsView: React.FC = () => {
  const { properties, isFinanceUser, currentUserRole, authProfile, requestConfirmation, closeConfirmation } = useApp();

  const { columns, saveColumns, resetToDefault } = useTableSchema('finance_approvals', FINANCE_APPROVALS_TABLE_COLUMNS);

  const [bills, setBills] = useState<FinanceBill[]>(() => financeService.getCachedBills());
  const [isLoading, setIsLoading] = useState(() => financeService.getCachedBills().length === 0);

  // Filters
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending_any');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('billDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modals
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<FinanceBill | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<FinanceBill | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const loadData = async () => {
    setIsLoading(true);
    try {
      const billsData = await financeService.getBills();
      setBills(billsData);
    } catch (err) {
      console.error('Failed to load approval queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      if (siteFilter !== 'all') {
        const filter = siteFilter.toLowerCase().trim();
        const bSiteName = (b.siteName || '').toLowerCase().trim();
        const bSiteId = (b.siteId || '').toLowerCase().trim();
        const prop = properties.find(p => p.id?.toLowerCase() === filter || p.name?.toLowerCase() === filter);
        const propName = (prop?.name || '').toLowerCase();
        const propId = (prop?.id || '').toLowerCase();
        const matchesFilter =
          bSiteName === filter || (filter && bSiteName.includes(filter)) ||
          bSiteId === filter || (filter && bSiteId.includes(filter)) ||
          (propName && (bSiteName === propName || bSiteName.includes(propName))) ||
          (propId && (bSiteId === propId || bSiteId.includes(propId)));
        if (!matchesFilter) return false;
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'pending_any') {
          if (b.status !== 'submitted' && b.status !== 'under_review' && b.status !== 'awaiting_approval' && b.status !== 'verification_pending') {
            return false;
          }
        } else if (b.status !== statusFilter) {
          return false;
        }
      }

      if (typeFilter !== 'all' && b.billType !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (b.billNumber || '').toLowerCase().includes(q) ||
          (b.vendorName && b.vendorName.toLowerCase().includes(q)) ||
          (b.purchaseReference && b.purchaseReference.toLowerCase().includes(q)) ||
          (b.submitterName && b.submitterName.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const valA = (a as any)[sortField] ?? '';
      const valB = (b as any)[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [bills, siteFilter, statusFilter, typeFilter, searchQuery, sortField, sortAsc]);

  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBills.slice(start, start + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.visibleInTable !== false);
  }, [columns]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const pendingActionCount = useMemo(() => {
    return bills.filter(b => b.status === 'awaiting_approval' || b.status === 'under_review' || b.status === 'submitted').length;
  }, [bills]);

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return filteredBills;
    if (scope === 'custom' && startDate && endDate) {
      return bills.filter(b => b.billDate >= startDate && b.billDate <= endDate);
    }
    return bills;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (b: FinanceBill) => string | number }> => ({
    billNumber: { label: 'Bill Reference', getValue: b => b.billNumber },
    siteName: { label: 'Property / Site', getValue: b => b.siteName || b.siteId },
    vendorName: { label: 'Payee / Vendor', getValue: b => b.vendorName || 'N/A' },
    billType: { label: 'Type', getValue: b => (b.billType || 'vendor_invoice').replace(/_/g, ' ') },
    billDate: { label: 'Bill Date', getValue: b => b.billDate },
    dueDate: { label: 'Due Date', getValue: b => b.dueDate || '—' },
    totalAmount: { label: 'Payable (£)', getValue: b => `£${Number(b.totalAmount || 0).toFixed(2)}` },
    status: { label: 'Workflow Stage', getValue: b => (b.status || 'submitted').replace(/_/g, ' ').toUpperCase() },
    submitterName: { label: 'Submitted By', getValue: b => b.submitterName || b.submittedBy },
    finalApprovedByName: { label: 'Approved By', getValue: b => b.finalApprovedByName || 'Pending' }
  });

  const handlePerformExport = ({
    format,
    scope,
    orientation,
    startDate,
    endDate,
    selectedColumns,
    isCompact
  }: {
    format: ExportFormat;
    scope: ExportScope;
    orientation: ExportOrientation;
    startDate?: string;
    endDate?: string;
    selectedColumns?: string[];
    isCompact?: boolean;
  }) => {
    const dataToExport = getExportDataForScope(scope, startDate, endDate);
    const colMap = getExportColumnMap();
    const cols = selectedColumns && selectedColumns.length > 0
      ? selectedColumns
      : approvalExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(b => activeCols.map(c => colMap[c].getValue(b)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Finance-Approvals-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Central Finance Final Approval Queue',
        subtitle: 'Authorization decisions, segregation of duties compliance, and approved payout records.',
        filename: `Finance-Approvals-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation: orientation || 'landscape',
        isCompact: isCompact !== false,
        metadata: [
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Properties' : siteFilter },
          { label: 'Status Scope', value: statusFilter },
          { label: 'Total Records', value: dataToExport.length }
        ]
      });
    }
  };

  const renderCellContent = (bill: FinanceBill, col: any) => {
    const val = (bill as any)[col.key];

    if (col.key === 'billNumber') {
      return (
        <span className="font-mono font-bold text-[#0d9488] hover:underline cursor-pointer">
          {bill.billNumber}
        </span>
      );
    }

    if (col.key === 'siteId') {
      return (
        <div className="flex items-center gap-1.5 font-semibold text-[#242424]">
          <Building2 className="w-3.5 h-3.5 text-[#0d9488]" />
          <span>{bill.siteName || bill.siteId}</span>
        </div>
      );
    }

    if (col.key === 'billType') {
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 capitalize">
          {String(val || '').replace(/_/g, ' ')}
        </span>
      );
    }

    if (col.key === 'totalAmount') {
      const num = Number(val || 0);
      return (
        <span className="font-mono font-bold text-[#242424]">
          £{num.toFixed(2)}
        </span>
      );
    }

    if (col.key === 'status') {
      const badgeClass = FINANCE_STATUS_BADGE_CLASSES[bill.status] || 'bg-gray-100 text-gray-700';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-semibold border ${badgeClass}`}>
          {(bill.status || 'submitted').replace(/_/g, ' ').toUpperCase()}
        </span>
      );
    }

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{val ? String(val).slice(0, 10) : '—'}</span>;
    }

    return <span>{val || '—'}</span>;
  };

// Strict RBAC Guard: Only Central Finance or Super Admin can access the Finance Approvals Queue
  // NOTE: This MUST be placed after all hooks to comply with React's Rules of Hooks.
  if (!isFinanceUser()) {
    return (
      <AccessDeniedView
        pageName="Finance Approvals & Sign-off"
        requiredRole="Central Finance Team (Finance Admin / Finance Manager)"
      />
    );
  }

  return (
    <div className="space-y-4 w-full animate-fade-in">
      {/* Top Header Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xs">
              <FileCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Finance Approvals Queue</h1>
                {pendingActionCount > 0 ? (
                  <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    {pendingActionCount} Pending Sign-off
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                    All Cleared
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Central Finance final authorization, segregation of duties compliance, and payment release control.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {(authProfile?.role || currentUserRole) === 'Super Admin' && (
              <button
                type="button"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0078d4]" />
                <span>Customize Table</span>
              </button>
            )}

            <ExportDropdown
              moduleName="Finance Approvals Queue"
              totalRecordCount={bills.length}
              filteredRecordCount={filteredBills.length}
              defaultOrientation="landscape"
              availableColumns={approvalExportColumns}
              onExport={handlePerformExport}
            />
          </div>
        </div>

        {/* Integrated Filter Row */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search reference, vendor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] placeholder-neutral-400 focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Properties / Sites</option>
              {properties.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            >
              <option value="awaiting_approval">Awaiting Approval (Primary)</option>
              <option value="pending_any">All Pending Review</option>
              <option value="all">All Stages</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="query_raised">Query Raised</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs text-[#242424] focus:bg-white focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Bill Types</option>
              <option value="vendor_invoice">Vendor Invoice</option>
              <option value="credit_card_expense">Credit Card Expense</option>
              <option value="other_expense">Other Expense</option>
            </select>

            {(siteFilter !== 'all' || statusFilter !== 'awaiting_approval' || typeFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSiteFilter('all');
                  setStatusFilter('awaiting_approval');
                  setTypeFilter('all');
                  setSearchQuery('');
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-xs transition-colors shrink-0"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs overflow-hidden shadow-2xs min-h-[500px] lg:min-h-[calc(100vh-270px)] flex flex-col justify-between">
        <div className="overflow-x-auto flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead className="bg-[#f3f2f1] text-[#242424] font-semibold border-b border-[#edebe9] select-none whitespace-nowrap sticky top-0 z-20 shadow-xs">
              <tr>
                {visibleColumns.map(col => {
                  const isSorted = sortField === col.key;
                  const isNumber = col.type === 'number';
                  return (
                    <th
                      key={String(col.key)}
                      onClick={() => handleSort(String(col.key))}
                      className={`py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors ${
                        isNumber ? 'text-right' : 'text-left'
                      }`}
                      title={`Sort by ${col.label}`}
                    >
                      <div className={`flex items-center gap-1 ${isNumber ? 'justify-end' : 'justify-start'}`}>
                        <span>{col.label}</span>
                        {isSorted ? (
                          sortAsc ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-neutral-400 opacity-50" />
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-2.5 px-3 text-center w-28 sticky right-0 bg-[#f3f2f1] shadow-[-2px_0_4px_rgba(0,0,0,0.06)] z-10 select-none">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-24 text-center text-[#605e5c]">
                    Loading approval queue...
                  </td>
                </tr>
              ) : paginatedBills.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-24 text-center text-[#605e5c]">
                    No bills currently awaiting approval matching the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedBills.map(bill => (
                  <tr
                    key={bill.id}
                    onClick={() => {
                      setSelectedBillId(bill.id);
                      setIsDetailModalOpen(true);
                    }}
                    className="hover:bg-[#f9f9f8] group cursor-pointer transition-colors"
                  >
                    {visibleColumns.map(col => (
                      <td
                        key={String(col.key)}
                        className={`py-2 px-3 ${col.type === 'number' ? 'text-right' : 'text-left'}`}
                      >
                        {renderCellContent(bill, col)}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-center sticky right-0 bg-white group-hover:bg-[#f9f9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.06)] z-10" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedBill(bill);
                          setSelectedBillId(bill.id);
                          setIsDetailModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#0d9488] hover:bg-[#0f766e] text-white text-[11px] font-semibold rounded-xs shadow-xs transition-colors cursor-pointer"
                        title="Review Bill and Sign-off"
                      >
                        <FileCheck className="w-3 h-3" />
                        <span>Sign-off</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredBills.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Bill Edit Modal */}
      <FinanceBillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        onSuccess={loadData}
        billToEdit={billToEdit}
        vendors={[]}
        title="Edit Queue Bill"
      />

      {/* Bill Detail Review Modal */}
      {selectedBillId && (
        <FinanceBillDetailModal
          billId={selectedBillId}
          initialBill={selectedBill}
          isOpen={isDetailModalOpen}
          onClose={() => { setIsDetailModalOpen(false); setSelectedBill(null); }}
          onRefresh={loadData}
        />
      )}

      {/* Schema Customization Modal */}
      <TableSchemaEditorModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        moduleTitle="Finance Approvals"
        currentUserRole={authProfile?.role || currentUserRole}
      />
    </div>
  );
};
