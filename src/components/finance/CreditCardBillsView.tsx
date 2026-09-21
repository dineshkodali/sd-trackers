import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  RotateCcw, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  SlidersHorizontal, 
  Eye,
  Edit3,
  Trash2,
  Copy,
  Check, 
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  Clock,
  Store
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { financeService } from '../../services/financeService';
import { FinanceBillModal } from './FinanceBillModal';
import { FinanceBillDetailModal } from './FinanceBillDetailModal';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { ManageableSelect } from '../common/ManageableSelect';
import { QuickOptionModal } from '../common/QuickOptionModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { FINANCE_CREDIT_CARD_TABLE_COLUMNS, FINANCE_STATUS_BADGE_CLASSES } from '../../data/defaultTableSchemas';
import type { FinanceBill, FinanceVendor } from '../../types/finance';

const creditCardExportColumns: ExportColumnOption[] = [
  { id: 'siteName', label: 'Property / Site' },
  { id: 'vendorName', label: 'Merchant / Store' },
  { id: 'billDate', label: 'Transaction Date' },
  { id: 'totalAmount', label: 'Amount (£)' },
  { id: 'description', label: 'Expense Reason' },
  { id: 'status', label: 'Status' },
  { id: 'submitterName', label: 'Cardholder / Staff' }
];

export const CreditCardBillsView: React.FC = () => {
  const { properties, assignedSite, canAccessAllSites, currentUserRole, isFinanceUser, canManageFinance, authProfile, requestConfirmation, closeConfirmation, getFieldOptions } = useApp();

  const { columns, saveColumns, resetToDefault } = useTableSchema('credit_card_bills', FINANCE_CREDIT_CARD_TABLE_COLUMNS);

  const [bills, setBills] = useState<FinanceBill[]>(() => financeService.getCachedBills('credit_card_expense'));
  const [vendors, setVendors] = useState<FinanceVendor[]>(() => financeService.getCachedVendors());
  const [isLoading, setIsLoading] = useState(() => financeService.getCachedBills('credit_card_expense').length === 0);

  // Filters
  const [siteFilter, setSiteFilter] = useState<string>(!canAccessAllSites() ? (assignedSite || 'all') : 'all');
  const [merchantFilter, setMerchantFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusTabFilter, setStatusTabFilter] = useState<'all' | 'awaiting_approval' | 'approved' | 'paid' | 'queries'>('all');
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('billDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modals
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<FinanceBill | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<FinanceBill | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyRef = (ref: string) => {
    if (!ref) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(ref);
      }
    } catch {}
    setCopiedId(ref);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDeleteBill = (bill: FinanceBill) => {
    requestConfirmation({
      title: 'Delete Credit Card Expense',
      message: `Are you sure you want to delete receipt "${bill.billNumber}" (${bill.vendorName || 'Expense'}) for £${Number(bill.totalAmount || 0).toFixed(2)}? This cannot be undone.`,
      confirmLabel: 'Delete Expense',
      isDanger: true,
      onConfirm: async () => {
        closeConfirmation();
        try {
          await financeService.deleteBill(bill.id, bill.billType || 'credit_card_expense');
          await loadData();
        } catch (err) {
          console.error('Failed to delete credit card bill:', err);
        }
      }
    });
  };

  const allowedSites = canAccessAllSites()
    ? properties.map(p => p.name)
    : properties.filter(p => p.id === assignedSite || p.name === assignedSite).map(p => p.name);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [billsData, vendorsData] = await Promise.all([
        financeService.getBills(),
        financeService.getVendors()
      ]);
      setBills(billsData.filter(b => b.billType === 'credit_card_expense' || b.billType === 'other_expense'));
      setVendors(vendorsData);
    } catch (err) {
      console.error('Failed to load credit card bills:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleChanged = () => {
      loadData();
    };
    window.addEventListener('finance-bills-changed', handleChanged);
    window.addEventListener('finance-vendors-changed', handleChanged);
    window.addEventListener('field-options-changed', handleChanged);
    return () => {
      window.removeEventListener('finance-bills-changed', handleChanged);
      window.removeEventListener('finance-vendors-changed', handleChanged);
      window.removeEventListener('field-options-changed', handleChanged);
    };
  }, []);

  const siteScopedBills = useMemo(() => {
    return bills.filter(b => {
      if (!canAccessAllSites()) {
        const allowed = (assignedSite || '').toLowerCase().trim();
        const bSiteName = (b.siteName || '').toLowerCase().trim();
        const bSiteId = (b.siteId || '').toLowerCase().trim();
        const prop = properties.find(p => p.id?.toLowerCase() === allowed || p.name?.toLowerCase() === allowed);
        const propName = (prop?.name || '').toLowerCase();
        const propId = (prop?.id || '').toLowerCase();
        const matchesAllowed = 
          bSiteName === allowed || (allowed && bSiteName.includes(allowed)) ||
          bSiteId === allowed || (allowed && bSiteId.includes(allowed)) ||
          (propName && (bSiteName === propName || bSiteName.includes(propName))) ||
          (propId && (bSiteId === propId || bSiteId.includes(propId)));
        if (allowed && !matchesAllowed) return false;
      } else if (siteFilter !== 'all') {
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
      return true;
    });
  }, [bills, siteFilter, canAccessAllSites, assignedSite, properties]);

  const merchantOptions = useMemo(() => {
    return getFieldOptions('financeCardMerchants', false);
  }, [getFieldOptions]);

  const availableMerchants = useMemo(() => {
    const set = new Set<string>();
    merchantOptions.forEach(o => {
      if (o.label && o.label.trim()) set.add(o.label.trim());
    });
    bills.forEach(b => {
      if (b.vendorName && b.vendorName.trim()) set.add(b.vendorName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [merchantOptions, bills]);

  const merchantScopedBills = useMemo(() => {
    if (merchantFilter === 'all') return siteScopedBills;
    const filter = merchantFilter.toLowerCase().trim();
    return siteScopedBills.filter(b => (b.vendorName || '').toLowerCase().trim() === filter);
  }, [siteScopedBills, merchantFilter]);

  const filteredBills = useMemo(() => {
    return merchantScopedBills.filter(b => {
      if (statusTabFilter !== 'all') {
        if (statusTabFilter === 'awaiting_approval') {
          if (b.status !== 'awaiting_approval' && b.status !== 'submitted') return false;
        } else if (statusTabFilter === 'approved') {
          if (b.status !== 'approved') return false;
        } else if (statusTabFilter === 'paid') {
          if (b.status !== 'paid') return false;
        } else if (statusTabFilter === 'queries') {
          if (b.status !== 'rejected' && (b.status as any) !== 'query_raised') return false;
        }
      }

      if (statusFilter !== 'all' && b.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (b.vendorName && b.vendorName.toLowerCase().includes(q)) ||
          (b.description && b.description.toLowerCase().includes(q)) ||
          (b.siteName && b.siteName.toLowerCase().includes(q)) ||
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
  }, [merchantScopedBills, statusFilter, statusTabFilter, searchQuery, sortField, sortAsc]);

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

  const getExportDataForScope = (scope: ExportScope, startDate?: string, endDate?: string) => {
    if (scope === 'filtered') return filteredBills;
    if (scope === 'custom' && startDate && endDate) {
      return bills.filter(b => b.billDate >= startDate && b.billDate <= endDate);
    }
    return bills;
  };

  const getExportColumnMap = (): Record<string, { label: string; getValue: (b: FinanceBill) => string | number }> => ({
    siteName: { label: 'Property / Site', getValue: b => b.siteName || b.siteId },
    vendorName: { label: 'Merchant / Store', getValue: b => b.vendorName || 'N/A' },
    billDate: { label: 'Transaction Date', getValue: b => b.billDate },
    totalAmount: { label: 'Amount (£)', getValue: b => `£${Number(b.totalAmount || 0).toFixed(2)}` },
    description: { label: 'Expense Reason', getValue: b => b.description || '—' },
    status: { label: 'Status', getValue: b => (b.status || 'submitted').replace(/_/g, ' ').toUpperCase() },
    submitterName: { label: 'Cardholder / Staff', getValue: b => b.submitterName || b.submittedBy }
  });

  const canApproveThisBill = (bill: FinanceBill) => {
    if (bill.status !== 'awaiting_approval') return false;
    if (bill.assignedApproverId) {
      return authProfile?.id === bill.assignedApproverId || currentUserRole === 'Super Admin';
    }
    if (bill.assignedApproverName && authProfile?.name) {
      if (authProfile.name.toLowerCase() === bill.assignedApproverName.toLowerCase()) {
        return true;
      }
    }
    return currentUserRole === 'Super Admin' || canManageFinance() || isFinanceUser() || currentUserRole === 'Admin';
  };

  const handleInlineApprove = async (billId: string) => {
    setProcessingActionId(billId);
    try {
      const res = await financeService.financeFinalApproval(billId, 'Approved via quick table action');
      if (res.success) {
        await loadData();
      }
    } catch {}
    setProcessingActionId(null);
  };

  const handleInlineReject = async (billId: string) => {
    const reason = window.prompt('Please enter a rejection reason:');
    if (!reason) return;
    setProcessingActionId(billId);
    try {
      const res = await financeService.financeRejectBill(billId, reason);
      if (res.success) {
        await loadData();
      }
    } catch {}
    setProcessingActionId(null);
  };

  const handleInlineRequestApproval = async (billId: string) => {
    setProcessingActionId(billId);
    try {
      const res = await financeService.requestApproval(billId);
      if (res.success) {
        await loadData();
      }
    } catch {}
    setProcessingActionId(null);
  };

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
      : creditCardExportColumns.map(c => c.id);
    const activeCols = cols.filter(c => colMap[c]);
    const headers = activeCols.map(c => colMap[c].label);
    const rows = dataToExport.map(b => activeCols.map(c => colMap[c].getValue(b)));

    if (format === 'csv') {
      exportTableToCsv({
        filename: `Credit-Card-Bills-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      });
    } else {
      exportTableToPdf({
        title: 'Corporate Credit Card & Direct Expenses Register',
        subtitle: 'Card transactions, employee expense reimbursements, receipt attachments, and approval tracking.',
        filename: `Credit-Card-Bills-${new Date().toISOString().slice(0, 10)}.pdf`,
        headers,
        rows,
        orientation: orientation || 'landscape',
        isCompact: isCompact !== false,
        metadata: [
          { label: 'Site Scope', value: siteFilter === 'all' ? 'All Properties' : siteFilter },
          { label: 'Merchant Scope', value: merchantFilter === 'all' ? 'All Merchants' : merchantFilter },
          { label: 'Status Scope', value: statusFilter === 'all' ? 'All Statuses' : statusFilter },
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

    if (col.key === 'vendorName') {
      return <span className="font-medium text-[#323130]">{bill.vendorName || 'Direct Expense'}</span>;
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
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-semibold border ${badgeClass}`}>
            {(bill.status || 'submitted').replace(/_/g, ' ').toUpperCase()}
          </span>
          {bill.status === 'awaiting_approval' && (
            <span className="text-[10px] text-amber-600 flex items-center gap-0.5" title="Awaiting Manager Approval">
              <Clock className="w-3 h-3 animate-pulse text-amber-500" />
            </span>
          )}
        </div>
      );
    }

    if (col.type === 'date') {
      return <span className="font-mono text-[#323130]">{val ? String(val).slice(0, 10) : '—'}</span>;
    }

    return <span>{val || '—'}</span>;
  };

  return (
    <div className="space-y-4 w-full animate-fade-in">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xs border border-[#e1dfdd] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#0d9488]" />
            <h1 className="text-xl font-bold text-[#242424] tracking-tight">
              Credit Card Bills & Expenses
            </h1>
            <span className="text-xs bg-[#f0fdfa] text-[#0f766e] font-semibold px-2 py-0.5 rounded-xs border border-[#99f6e4]">
              {filteredBills.length} Card Expenses
            </span>
          </div>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Corporate credit card receipts, petty cash disbursements, and direct emergency site expense logs.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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

          <button
            type="button"
            onClick={() => setIsMerchantModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
            title="Manage credit card merchant and store choices"
          >
            <Store className="w-3.5 h-3.5 text-[#0d9488]" />
            <span>Manage Merchants</span>
          </button>

          <ExportDropdown
            moduleName="Credit Card Register"
            totalRecordCount={bills.length}
            filteredRecordCount={filteredBills.length}
            defaultOrientation="landscape"
            availableColumns={creditCardExportColumns}
            onExport={handlePerformExport}
            buttonVariant="toolbar"
          />

          <button
            onClick={() => {
              setBillToEdit(null);
              setIsBillModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Log Card Expense</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#e1dfdd] p-3 rounded-xs flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Site / Property Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Property:</span>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              disabled={!canAccessAllSites()}
              className={`p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs max-w-[160px] ${
                !canAccessAllSites() ? 'bg-[#f3f2f1] cursor-not-allowed text-[#605e5c]' : ''
              }`}
            >
              {canAccessAllSites() && <option value="all">All Properties</option>}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Merchant Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#605e5c] whitespace-nowrap">Merchant:</span>
            <select
              value={merchantFilter}
              onChange={e => {
                setMerchantFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="p-1.5 border border-[#8a8886] rounded-xs bg-white text-[#323130] text-xs max-w-[170px]"
            >
              <option value="all">All Merchants ({availableMerchants.length})</option>
              {availableMerchants.map((m, idx) => (
                <option key={`${m}-${idx}`} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[190px]">
            <ManageableSelect
              label="Status"
              value={statusFilter === 'all' ? '' : statusFilter}
              onChange={setStatusFilter}
              optionCategory="financeBillStatuses"
              allowQuickAdd={true}
              placeholder="All Statuses"
              showManageActions={true}
              className="p-1.5"
              compact
            />
          </div>

          {/* Search Input */}
          <div className="relative min-w-[160px] flex-1 max-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-[#605e5c]" />
            <input
              type="text"
              placeholder="Search receipt, merchant, staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1 border border-[#8a8886] rounded-xs text-xs bg-white focus:outline-2 focus:outline-[#71afe5]"
            />
          </div>

          {(siteFilter !== 'all' || merchantFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                if (canAccessAllSites()) setSiteFilter('all');
                setMerchantFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="flex items-center gap-1 text-[11px] text-[#605e5c] hover:text-[#242424] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Approval Status Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-[#edebe9] pb-1 overflow-x-auto text-xs">
        {[
          { id: 'all', label: 'All Card Expenses', count: merchantScopedBills.length },
          { id: 'awaiting_approval', label: 'Pending Approval', count: merchantScopedBills.filter(b => b.status === 'awaiting_approval' || b.status === 'submitted').length },
          { id: 'approved', label: 'Approved', count: merchantScopedBills.filter(b => b.status === 'approved').length },
          { id: 'paid', label: 'Paid', count: merchantScopedBills.filter(b => b.status === 'paid').length },
          { id: 'queries', label: 'Queries / Rejected', count: merchantScopedBills.filter(b => b.status === 'rejected' || (b.status as any) === 'query_raised').length }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusTabFilter(tab.id as any)}
            className={`px-3 py-1.5 rounded-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              statusTabFilter === tab.id
                ? 'bg-[#0d9488] text-white shadow-xs'
                : 'bg-white text-[#605e5c] hover:bg-[#f3f2f1] hover:text-[#242424] border border-[#e1dfdd]'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              statusTabFilter === tab.id ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden flex flex-col justify-between min-h-[560px] lg:min-h-[calc(100vh-270px)]">
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
                <th className="py-2.5 px-3 text-right w-36 sticky right-0 bg-[#f3f2f1] shadow-[-2px_0_4px_rgba(0,0,0,0.06)] z-10 select-none">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-24 text-center text-[#605e5c]">
                    Loading credit card records...
                  </td>
                </tr>
              ) : paginatedBills.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-24 text-center text-[#605e5c]">
                    No credit card expenses found matching the current filters.
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
                    <td
                      className="py-2 px-3 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-[#f9f9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.06)] z-10"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {/* Inline Approval Module */}
                        <>
                            {bill.status === 'awaiting_approval' && (
                              canApproveThisBill(bill) ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleInlineApprove(bill.id)}
                                    disabled={processingActionId === bill.id}
                                    className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xs transition-colors cursor-pointer"
                                    title="Approve Record"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInlineReject(bill.id)}
                                    disabled={processingActionId === bill.id}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                                    title="Reject Record"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span
                                  className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-xs font-medium whitespace-nowrap"
                                  title={bill.assignedApproverName ? `Assigned to ${bill.assignedApproverName} for sign-off` : 'Awaiting Approval'}
                                >
                                  Awaiting {bill.assignedApproverName ? bill.assignedApproverName.split(' ')[0] : 'RM'}
                                </span>
                              )
                            )}
                            {(bill.status === 'draft' || bill.status === 'submitted') && (
                              <button
                                type="button"
                                onClick={() => handleInlineRequestApproval(bill.id)}
                                disabled={processingActionId === bill.id}
                                className="p-1 text-[#0d9488] hover:text-[#0f766e] hover:bg-teal-50 rounded-xs transition-colors cursor-pointer"
                                title="Move to Approval"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBillId(bill.id);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                          title="View Details & Receipt Evidence"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBillToEdit(bill);
                            setIsBillModalOpen(true);
                          }}
                          className="p-1 text-[#605e5c] hover:text-[#0078d4] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                          title="Edit Card Expense"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyRef(bill.billNumber)}
                          className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                          title={copiedId === bill.billNumber ? 'Copied Reference!' : 'Copy Reference #'}
                        >
                          {copiedId === bill.billNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBill(bill)}
                          className="p-1 text-neutral-400 hover:text-[#a4262c] hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                          title="Delete Card Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {/* Bill Submission Modal */}
      <FinanceBillModal
        isOpen={isBillModalOpen}
        onClose={() => setIsBillModalOpen(false)}
        onSuccess={loadData}
        billToEdit={billToEdit}
        vendors={vendors}
        defaultBillType="credit_card_expense"
        title="Log Credit Card Expense"
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
        moduleTitle="Credit Card Bills"
        currentUserRole={authProfile?.role || currentUserRole}
      />

      {/* Merchant Management Modal */}
      <QuickOptionModal
        isOpen={isMerchantModalOpen}
        onClose={() => setIsMerchantModalOpen(false)}
        categoryKey="financeCardMerchants"
        categoryName="Credit Card Merchants"
      />
    </div>
  );
};
