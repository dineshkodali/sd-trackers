import { IconX as CloseIcon } from '@tabler/icons-react';
import React, { useState, useMemo, useEffect } from 'react';
import { BulkActionToolbar } from '../common/BulkActionToolbar';
import { IconBuilding as Building2, IconPlus as Plus, IconSearch as Search, IconEdit as Edit3, IconTrash as Trash2, IconEye as Eye, IconCircleCheck as CheckCircle2, IconAlertTriangle as AlertTriangle, IconAlertOctagon as AlertOctagon, IconClock as Clock, IconUser as User, IconMessage as MessageSquare, IconAdjustmentsHorizontal as SlidersHorizontal, IconArrowUp as ArrowUp, IconArrowDown as ArrowDown, IconArrowsSort as ArrowUpDown, IconLock as Lock } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { RoomCheckRecord, RoomCheckItem, RoomCheckResponse, RoomCheckOverallStatus } from '../../types';
import { SiteServiceUserSelector } from '../common/SiteServiceUserSelector';
import { Pagination } from '../common/Pagination';
import { useCheckObligations } from '../../hooks/useCheckObligations';
import { useTabState } from '../../hooks/useTabState';
import { TabSwitcher, serialNo } from '../common/TrackerLayout';
import { monthOptions, monthLabel } from '../checks/CheckObligationsPanel';
import { londonNow } from '../../utils/operationsRules';
import { monthWindows, isSatisfied, matchesDueFilter, dueCounts, type DueFilter, type CheckRow, type CheckObligation } from '../../utils/checkObligations';
import { exportTableToCsv } from '../../utils/csvExport';
import { exportTableToPdf } from '../../utils/pdfExport';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { ROOM_CHECKS_TABLE_COLUMNS } from '../../data/defaultTableSchemas';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { TableColumnConfig } from '../../types/tableSchema';

interface QuestionDef {
  key: string;
  text: string;
  section: 'ROOM CONDITION' | 'OTHER ITEMS' | 'FINAL COMMENTS';
  isCriticalSafety?: boolean;
  defaultExpected?: RoomCheckResponse; // Expected positive response
}

export const ROOM_CHECK_QUESTIONS: QuestionDef[] = [
  // SECTION 1: ROOM CONDITION
  { key: 'clean_and_tidy', text: '1. Is the room clean and tidy?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'housekeeping_sheets_changed', text: '2. Has Housekeeping attended this week and changed the sheets?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'windows_clean', text: '3. Are the windows clean and free of cobwebs?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'window_restrictors_working', text: '4. Are the windows restrictors in working order?', section: 'ROOM CONDITION', isCriticalSafety: true, defaultExpected: 'Yes' },
  { key: 'defects_pest_signs', text: '5. Are there any defects/damages or signs of pest control in the room?', section: 'ROOM CONDITION', defaultExpected: 'No' },
  { key: 'furniture_good_condition', text: '6. Is the furniture in good condition and free of damages?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'lamps_working', text: '7. Are the lamps working properly?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'tv_working', text: '8. Is the television working properly?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'ac_heating_working', text: '9. Is the air conditioning/fan or heating working properly?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'furniture_provision_correct', text: '10. Is the correct furniture provision(s) in place?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'room_size_config_correct', text: '11. Is the room/unit the correct size/configuration for the SU(s)?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'cooking_in_room_signs', text: '12. If applicable are there any signs of SU\'s cooking in the room?', section: 'ROOM CONDITION', isCriticalSafety: true, defaultExpected: 'No' },
  { key: 'fire_extinguisher_present', text: '13. If applicable is there a fire extinguisher in the room?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'smoke_detector_working_uncovered', text: '14. Is there a working smoke detector in the room which is uncovered?', section: 'ROOM CONDITION', isCriticalSafety: true, defaultExpected: 'Yes' },
  { key: 'co_detector_working', text: '15. If applicable is there a working carbon monoxide detector in the room?', section: 'ROOM CONDITION', isCriticalSafety: true, defaultExpected: 'Yes' },
  { key: 'fire_alarm_working', text: '16. Is there a working fire alarm in the room?', section: 'ROOM CONDITION', isCriticalSafety: true, defaultExpected: 'Yes' },
  { key: 'door_lock_doorbell_working', text: '17. Is there a working door/lock & doorbell in the room?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'internet_connection_working', text: '18. Is there a working internet connection in the room?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'prohibited_items', text: '19. Are there any prohibited items?', section: 'ROOM CONDITION', isCriticalSafety: true, defaultExpected: 'No' },
  { key: 'bathroom_clean_no_mould', text: '20. Is the bathroom clean and tidy and free of mould?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'toilet_clean_flushed', text: '21. Is the toilet clean and flushed properly?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'sink_clean', text: '22. Is the sink clean and free of toothpaste or soap scum?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'shower_bath_clean', text: '23. Is the shower or bathtub clean and free of soap scum or hair?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'toilet_paper_stocked', text: '24. Is the toilet paper stocked?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'housekeeping_towels_changed', text: '25. Have housekeeping changed the towels?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'trash_taken_out', text: '26. Is the trash taken out?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },
  { key: 'necessary_provisions', text: '27. Does the SU(s) have the necessary provisions?', section: 'ROOM CONDITION', defaultExpected: 'Yes' },

  // SECTION 2: OTHER ITEMS
  { key: 'iron_access', text: '28. Does the SU have access to an Iron/Ironing Board?', section: 'OTHER ITEMS', defaultExpected: 'Yes' },
  { key: 'hair_dryer_access', text: '29. Is there a working hair dryer in the room or does SU have access to one?', section: 'OTHER ITEMS', defaultExpected: 'Yes' },

  // SECTION 3: FINAL COMMENTS
  { key: 'maintenance_or_other_concerns', text: '30. Any other comments/concerns or maintenance issues?', section: 'FINAL COMMENTS', defaultExpected: 'No' },
];

/**
 * Explicit deterministic overall status calculation:
 * - 'Attention Required': Critical safety violation (smoke detector/fire alarm failed, cooking in room, prohibited items, window restrictors broken)
 * - 'Issues': Any non-critical issue identified
 * - 'Passed': All expected standards met
 */
export function calculateRoomOverallStatus(items: RoomCheckItem[]): RoomCheckOverallStatus {
  let hasCriticalSafetyIssue = false;
  let hasOtherIssues = false;

  for (const item of items) {
    const qDef = ROOM_CHECK_QUESTIONS.find(q => q.key === item.questionKey);
    if (!qDef) continue;

    if (item.response === 'N/A') continue;

    const isIssue = item.response !== qDef.defaultExpected;
    if (isIssue) {
      if (qDef.isCriticalSafety) {
        hasCriticalSafetyIssue = true;
      } else {
        hasOtherIssues = true;
      }
    }
  }

  if (hasCriticalSafetyIssue) return 'Attention Required';
  if (hasOtherIssues) return 'Issues';
  return 'Passed';
}

const roomExportColumns: ExportColumnOption[] = [
  { id: 'inspectionDate', label: 'Inspection Date', defaultSelected: true },
  { id: 'siteName', label: 'Site / Hotel', defaultSelected: true },
  { id: 'roomNumber', label: 'Room Number', defaultSelected: true },
  { id: 'aicReference', label: 'AIC Reference', defaultSelected: true },
  { id: 'officerName', label: 'Inspecting Officer', defaultSelected: true },
  { id: 'overallStatus', label: 'Overall Status', defaultSelected: true },
  { id: 'finalComments', label: 'Final Comments', defaultSelected: true }
];

const roomComplianceExportColumns: ExportColumnOption[] = [
  { id: 'sno', label: 'S.No.', defaultSelected: true },
  { id: 'roomNumber', label: 'Room Number', defaultSelected: true },
  { id: 'suName', label: 'Service User', defaultSelected: true },
  { id: 'suReference', label: 'SU Reference', defaultSelected: true },
  { id: 'siteName', label: 'Property / Site', defaultSelected: true },
  { id: 'check1', label: 'Check 1 (Target: 10th)', defaultSelected: true },
  { id: 'check2', label: 'Check 2 (Target: 25th)', defaultSelected: true },
  { id: 'frequency', label: 'Monthly Frequency', defaultSelected: true },
  { id: 'complianceStatus', label: 'Compliance Status', defaultSelected: true },
  { id: 'lastChecked', label: 'Last Checked', defaultSelected: true },
  { id: 'assignedStaff', label: 'Assigned / Done By', defaultSelected: true }
];

export const RoomChecksView: React.FC = () => {
  const {
    defaultSiteFilter,
    roomChecks,
    addRoomCheck,
    updateRoomCheck,
    deleteRoomCheck,
    canAccessAllSites,
    isSitePermitted,
    assignedSite,
    allowedSites,
    sites,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    currentUserName,
    authProfile
  , requestConfirmation } = useApp();

  const loggedInUserName = authProfile?.name || authProfile?.email?.split('@')[0] || currentUserName || (currentUserRole ? `${currentUserRole} (User)` : 'Duty Officer');

  const [searchQuery, setSearchQuery] = useState('');

  // Sync with active property switcher in Header
  useEffect(() => {
    setSiteFilter(defaultSiteFilter);
  }, [defaultSiteFilter]);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const handleToggleSelectAll = () => { setSelectedIds(prev => prev.length ? [] : paginatedData?.map(p => p.id) || []); };
  const handleToggleSelect = (e: any, id: string) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Selected', message: 'Are you sure you want to delete selected items?', isDanger: true,
        onConfirm: async () => { /* Add logic */ setSelectedIds([]); }
      });
    }
  };

  const [siteFilter, setSiteFilter] = useState(defaultSiteFilter);
  const [statusFilter, setStatusFilter] = useState('all');

  // Clock for monthly compliance evaluations
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = londonNow(now).date;
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));

  // Compliance Tabs: 'all' | 'completed' | 'pending' | 'overdue' | 'history'
  // Page-level tabs (Required checks / Inspection log) are remembered for the session; the status chips are only a filter.
  const [pageTab, setPageTab] = useTabState('roomChecks', ['required', 'log'] as const, 'required');
  const [statusChip, setStatusChip] = useState<DueFilter>('all');
  const complianceTab: DueFilter | 'history' = pageTab === 'log' ? 'history' : statusChip;
  const setComplianceTab = (t: DueFilter | 'history') => {
    if (t === 'history') setPageTab('log');
    else { setPageTab('required'); setStatusChip(t); }
  };
  const [compliancePage, setCompliancePage] = useState(1);
  const [compliancePageSize, setCompliancePageSize] = useState(10);

  // Which of the month's two checks the open form is recording (null for a free-standing check, counted by its date)
  const [recording, setRecording] = useState<{ period: 1 | 2; month: string; deadline: string } | null>(null);

  // Real-time Monthly Obligation Calculation
  const obligationsMonth = selectedMonth === 'all' ? today.slice(0, 7) : selectedMonth;
  const obligationsState = useCheckObligations('room', obligationsMonth, now, true);
  const windows = useMemo(() => monthWindows(obligationsMonth, obligationsState.result?.settings), [obligationsMonth, obligationsState.result]);

  const allowedNames = useMemo(() => {
    if (canAccessAllSites()) return null;
    return new Set((allowedSites || []).map(s => String(s).toLowerCase()));
  }, [canAccessAllSites, allowedSites]);

  const filteredComplianceRows = useMemo(() => {
    return (obligationsState.rows || []).filter(r => {
      if (allowedNames && !allowedNames.has(r.siteName.toLowerCase())) return false;
      if (siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') {
        const sf = siteFilter.toLowerCase();
        const matchSite = r.siteName?.toLowerCase() === sf || r.propertyName?.toLowerCase() === sf;
        if (!matchSite) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (r.roomNumber && r.roomNumber.toLowerCase().includes(q)) ||
          (r.siteName && r.siteName.toLowerCase().includes(q)) ||
          (r.propertyName && r.propertyName.toLowerCase().includes(q)) ||
          (r.suName && r.suName.toLowerCase().includes(q)) ||
          (r.suReference && r.suReference.toLowerCase().includes(q)) ||
          (r.responsible?.name && r.responsible.name.toLowerCase().includes(q)) ||
          (r.first?.completedBy && r.first.completedBy.toLowerCase().includes(q)) ||
          (r.second?.completedBy && r.second.completedBy.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [obligationsState.rows, allowedNames, siteFilter, searchQuery]);

  // Rows are kept by how many of the month's two checks are done (see matchesDueFilter), not by guessing from overdue flags.
  const tabComplianceRows = useMemo(
    () => filteredComplianceRows.filter(r => matchesDueFilter(r, statusChip)),
    [filteredComplianceRows, statusChip]
  );

  const complianceKpis = useMemo(() => {
    const c = dueCounts(filteredComplianceRows);
    const pct = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
    return { total: c.total, completed: c.completed, inProgress: c.oneDone, notStarted: c.noneDone, overdue: c.overdue, pct };
  }, [filteredComplianceRows]);

  const paginatedComplianceRows = useMemo(() => {
    const start = (compliancePage - 1) * compliancePageSize;
    return tabComplianceRows.slice(start, start + compliancePageSize);
  }, [tabComplianceRows, compliancePage, compliancePageSize]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<keyof RoomCheckRecord>('inspectionDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RoomCheckRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  // View & Edit Context across Check 1 & Check 2
  interface ViewContext {
    row?: CheckRow | null;
    rec1?: RoomCheckRecord | null;
    rec2?: RoomCheckRecord | null;
    activeCheck: 1 | 2;
  }
  const [viewContext, setViewContext] = useState<ViewContext | null>(null);
  const [editRowContext, setEditRowContext] = useState<{ row?: CheckRow | null; rec1?: RoomCheckRecord | null; rec2?: RoomCheckRecord | null } | null>(null);

  // Table Customization Schema Hook
  const {
    columns: schemaColumns,
    visibleColumns,
    saveColumns,
    resetToDefault
  } = useTableSchema<RoomCheckRecord>('roomChecks', ROOM_CHECKS_TABLE_COLUMNS);

  // Form State
  const defaultItems: RoomCheckItem[] = useMemo(() => {
    return ROOM_CHECK_QUESTIONS.map((q, idx) => ({
      section: q.section,
      questionKey: q.key,
      questionText: q.text,
      response: q.defaultExpected || 'Yes',
      comment: '',
      sortOrder: idx + 1
    }));
  }, []);

  const initialFormState: Partial<RoomCheckRecord> = {
    siteName: (siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') ? siteFilter : (sites[0]?.name || ''),
    roomNumber: '',
    aicReference: '',
    officerName: loggedInUserName,
    inspectionDate: new Date().toISOString().split('T')[0],
    overallStatus: 'Passed',
    finalComments: '',
    items: defaultItems
  };

  const [formData, setFormData] = useState<Partial<RoomCheckRecord>>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeSectionTab, setActiveSectionTab] = useState<'ROOM CONDITION' | 'OTHER ITEMS' | 'FINAL COMMENTS'>('ROOM CONDITION');

  // Site filter & search
  const accessibleRecords = useMemo(() => {
    if (canAccessAllSites()) return roomChecks;
    return roomChecks.filter(r => isSitePermitted(r.siteName, 'all'));
  }, [roomChecks, canAccessAllSites, isSitePermitted]);

  const filteredRecords = useMemo(() => {
    return accessibleRecords.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (r.roomNumber && r.roomNumber.toLowerCase().includes(q)) ||
        (r.siteName && r.siteName.toLowerCase().includes(q)) ||
        (r.aicReference && r.aicReference.toLowerCase().includes(q)) ||
        (r.officerName && r.officerName.toLowerCase().includes(q));

      const matchesSite = isSitePermitted(r.siteName, siteFilter);
      const matchesStatus = statusFilter === 'all' || r.overallStatus === statusFilter;
      const matchesMonth = !selectedMonth || selectedMonth === 'all' || !r.inspectionDate || r.inspectionDate.startsWith(selectedMonth);

      return matchesSearch && matchesSite && matchesStatus && matchesMonth;
    });
  }, [accessibleRecords, searchQuery, siteFilter, statusFilter, selectedMonth, isSitePermitted]);

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      const valA = a[sortKey] ?? '';
      const valB = b[sortKey] ?? '';
      if (sortOrder === 'asc') {
        return String(valA).localeCompare(String(valB));
      }
      return String(valB).localeCompare(String(valA));
    });
  }, [filteredRecords, sortKey, sortOrder]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.siteName) errors.siteName = 'Site is required';
    if (!formData.roomNumber?.trim()) errors.roomNumber = 'Room number is required';
    if (!formData.inspectionDate) errors.inspectionDate = 'Inspection date is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setFormData({
      ...initialFormState,
      officerName: loggedInUserName,
      siteName: (siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') ? siteFilter : (sites[0]?.name || ''),
      items: defaultItems
    });
    setFormErrors({});
    setIsEditing(false);
    setRecording(null);
    setActiveSectionTab('ROOM CONDITION');
    setIsFormOpen(true);
  };

  const handleQuickResolve = (row: CheckRow, preferredPeriod?: 1 | 2) => {
    const period: 1 | 2 = preferredPeriod || (row.first && !isSatisfied(row.first.status) ? 1 : 2);
    const ob = period === 1 ? row.first : row.second;
    setRecording(row.overall === 'complete' && !preferredPeriod ? null : { period, month: selectedMonth, deadline: ob?.deadline || '' });
    setFormData({
      ...initialFormState,
      siteName: row.siteName || ((siteFilter && siteFilter !== 'all' && siteFilter !== 'All Sites') ? siteFilter : (sites[0]?.name || '')),
      siteId: ob?.siteId || undefined,
      propertyId: ob?.propertyId || undefined,
      roomId: ob?.roomId || undefined,
      suId: ob?.suId || undefined,
      roomNumber: row.roomNumber,
      aicReference: row.suReference || '',
      officerName: loggedInUserName,
      inspectionDate: today,
      items: defaultItems
    });
    setFormErrors({});
    setIsEditing(false);
    setActiveSectionTab('ROOM CONDITION');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (rec: RoomCheckRecord) => {
    let items = rec.items;
    if (!items || items.length === 0) {
      items = defaultItems;
    }
    setFormData({ ...rec, officerName: rec.officerName || loggedInUserName, items });
    const savedPeriod = Number(rec.data?.checkPeriod);
    setRecording(savedPeriod === 1 || savedPeriod === 2 ? { period: savedPeriod as 1 | 2, month: String(rec.data?.checkMonth || ''), deadline: '' } : null);
    setFormErrors({});
    setIsEditing(true);
    setActiveSectionTab('ROOM CONDITION');
    setIsFormOpen(true);
  };

  const handleOpenView = (rec: RoomCheckRecord) => {
    setSelectedRecord(rec);
    setIsViewOpen(true);
  };

  const handleItemResponseChange = (questionKey: string, response: RoomCheckResponse) => {
    setFormData(prev => {
      const updatedItems = (prev.items || []).map(item => {
        if (item.questionKey === questionKey) {
          return { ...item, response };
        }
        return item;
      });
      // Recalculate status dynamically
      const newStatus = calculateRoomOverallStatus(updatedItems);
      return { ...prev, items: updatedItems, overallStatus: newStatus };
    });
  };

  const handleItemCommentChange = (questionKey: string, comment: string) => {
    setFormData(prev => {
      const updatedItems = (prev.items || []).map(item => {
        if (item.questionKey === questionKey) {
          return { ...item, comment };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const computedStatus = calculateRoomOverallStatus(formData.items || []);
    const dataToSave = {
      ...formData,
      officerName: formData.officerName || loggedInUserName,
      overallStatus: computedStatus,
      // Which of the month's two checks this is, kept with the record
      data: { ...(formData.data || {}), ...(recording ? { checkPeriod: recording.period, checkMonth: recording.month } : {}) }
    };

    if (isEditing && formData.id) {
      await updateRoomCheck(formData.id, dataToSave);
    } else {
      await addRoomCheck(dataToSave as any);
    }
    setIsFormOpen(false);
    setRecording(null);
  };

  const handlePerformExport = (options: {
    format: 'csv' | 'pdf';
    orientation: 'portrait' | 'landscape';
    selectedColumns?: string[];
  }) => {
    const cols = options.selectedColumns && options.selectedColumns.length > 0
      ? roomExportColumns.filter(c => options.selectedColumns?.includes(c.id))
      : roomExportColumns;
    const headers = cols.map(c => c.label);
    const rows = filteredRecords.map(r => cols.map(c => {
      if (c.id === 'inspectionDate') return r.inspectionDate ? new Date(r.inspectionDate).toLocaleDateString('en-GB') : '';
      return String((r as any)[c.id] ?? '');
    }));

    if (options.format === 'csv') {
      exportTableToCsv({ filename: 'Room_Checks_Export.csv', headers, rows });
    } else {
      exportTableToPdf({
        filename: 'Room_Checks_Export.pdf',
        title: 'Room Checks & Inspections Registry',
        subtitle: `Site Scope: ${siteFilter === 'all' ? 'All Sites' : siteFilter}`,
        headers,
        rows,
        orientation: options.orientation || 'landscape'
      });
    }
  };

  const getStatusBadge = (status: RoomCheckOverallStatus) => {
    switch (status) {
      case 'Passed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Issues':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Attention Required':
        return 'bg-red-50 text-red-800 border-red-200 font-bold';
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200';
    }
  };

  const renderColumnCell = (col: TableColumnConfig<RoomCheckRecord>, record: RoomCheckRecord) => {
    if (col.renderCell) {
      return col.renderCell((record as any)[col.key], record);
    }

    const value = (record as any)[col.key];

    if (col.badgeColors && value) {
      const badgeClass = col.badgeColors[value] || 'bg-neutral-100 text-neutral-800';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeClass}`}>
          {value}
        </span>
      );
    }

    if (col.key === 'inspectionDate') {
      return (
        <span className="font-medium text-neutral-800">
          {record.inspectionDate ? new Date(record.inspectionDate).toLocaleDateString('en-GB') : '—'}
        </span>
      );
    }

    if (col.key === 'roomNumber') {
      return <span className="font-bold text-neutral-800">{value || '—'}</span>;
    }

    if (col.key === 'aicReference') {
      return <span className="font-mono text-neutral-600">{value || '—'}</span>;
    }

    if (col.key === 'overallStatus') {
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusBadge(record.overallStatus)}`}>
          {record.overallStatus === 'Passed' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
          {record.overallStatus === 'Issues' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
          {record.overallStatus === 'Attention Required' && <AlertOctagon className="w-3 h-3 text-red-600" />}
          <span>{record.overallStatus}</span>
        </span>
      );
    }

    if (value === null || value === undefined || value === '') {
      return <span className="text-neutral-400">—</span>;
    }

    return <span className="text-neutral-700 truncate max-w-[200px] inline-block">{String(value)}</span>;
  };

  const currentQuestions = useMemo(() => {
    return ROOM_CHECK_QUESTIONS.filter(q => q.section === activeSectionTab);
  }, [activeSectionTab]);

  const fmt = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');

  // "Check 1 - November 2026" for every recorded inspection that counts toward a month
  const checkLabelByVisit = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of obligationsState.rows) for (const o of [r.first, r.second]) {
      if (o?.visitId) m.set(o.visitId, `Check ${o.period} · ${monthLabel(o.month)}${o.status === 'completed_late' ? ' (late)' : ''}`);
    }
    return m;
  }, [obligationsState.rows]);
  const checkLabelOf = (rec: RoomCheckRecord) => {
    const found = checkLabelByVisit.get(rec.id);
    if (found) return found;
    const sp = Number(rec.data?.checkPeriod);
    return sp ? `Check ${sp}${rec.data?.checkMonth ? ' · ' + monthLabel(String(rec.data.checkMonth)) : ''}` : '—';
  };
  const recordedFor = (o: CheckObligation | null) => (o?.visitId ? roomChecks.find(r => r.id === o.visitId) : undefined);

  const renderObligationCell = (o: CheckObligation | null, row: CheckRow, period: 1 | 2) => {
    if (!o) return <span className="text-neutral-400">—</span>;
    if (o.status === 'completed' || o.status === 'completed_late') {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap cursor-default"
          title={`Completed on ${fmt(o.visitDate)}${o.completedBy ? ` by ${o.completedBy}` : ''}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Done {fmt(o.visitDate)}</span>
        </span>
      );
    }
    if (o.status === 'overdue') {
      return (
        <button
          type="button"
          onClick={() => handleQuickResolve(row, period)}
          title={`Overdue by ${o.daysLate ?? 1}d (Due ${fmt(o.deadline)}). Click to resolve now.`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[11px] font-bold bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer shadow-2xs transition-colors whitespace-nowrap"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>Overdue ({o.daysLate ?? 1}d)</span>
        </button>
      );
    }
    // Pending
    return (
      <button
        type="button"
        onClick={() => handleQuickResolve(row, period)}
        title={`Due by ${fmt(o.deadline)}. Click to record.`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[11px] font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 cursor-pointer transition-colors whitespace-nowrap"
      >
        <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span>Due {fmt(o.deadline).slice(0, 5)}</span>
      </button>
    );
  };

  const renderFrequencyBadge = (row: CheckRow) => {
    const isC1 = row.first?.status === 'completed' || row.first?.status === 'completed_late';
    const isC2 = row.second?.status === 'completed' || row.second?.status === 'completed_late';
    const count = (isC1 ? 1 : 0) + (isC2 ? 1 : 0);
    if (count === 2) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          2/2 ✓
        </span>
      );
    }
    if (count === 1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          1/2
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
        0/2
      </span>
    );
  };

  const renderComplianceStatus = (row: CheckRow) => {
    if (row.overall === 'complete') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Completed</span>
        </span>
      );
    }
    if (row.first?.status === 'overdue' || row.second?.status === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-red-50 text-red-800 border border-red-200 whitespace-nowrap">
          <AlertOctagon className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>Due · Overdue</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Due</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#242424] tracking-tight">Room Checks &amp; Monthly Compliance</h1>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-teal-50 text-[#0d9488] border border-teal-200 rounded-xs">
                  Twice-Monthly Check Schedule (10th &amp; 25th)
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Monthly compliance tracking per occupied room (Check 1 by the 10th, Check 2 by the 25th).</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {complianceTab === 'history' && currentUserRole === 'Super Admin' && (
              <button
                type="button"
                id="btn-customize-room-table"
                onClick={() => setIsSchemaModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#f3f2f1] text-[#323130] border border-[#8a8886] rounded-xs shadow-xs transition-colors cursor-pointer"
                title="Super Admin: Customize table columns, headers, and fields"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#0d9488]" />
                <span>Customize Table</span>
              </button>
            )}

            {complianceTab === 'history' && (
              <ExportDropdown 
                moduleName="Room Checks"
                totalRecordCount={accessibleRecords.length}
                filteredRecordCount={filteredRecords.length}
                availableColumns={roomExportColumns}
                onExport={handlePerformExport}
              />
            )}

            {canCreateRecord() && (
              <button
                type="button"
                id="btn-create-room-check"
                onClick={handleOpenCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Room Check</span>
              </button>
            )}
          </div>
        </div>

        <TabSwitcher
          label="Room Checks views"
          idPrefix="roomchecks-tab"
          active={pageTab}
          onChange={id => {
            setPageTab(id as 'required' | 'log');
            setStatusFilter('all');
            setStatusChip('all');
            setCompliancePage(1);
            setCurrentPage(1);
          }}
          tabs={[
            { id: 'required', label: 'Required checks' },
            { id: 'log', label: `Inspection log (${filteredRecords.length})` }
          ]}
        />

        {/* Filter Bar */}
        <div className="mt-4 pt-3 border-t border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* Month Selector */}
          <div>
            <select
              aria-label="Inspection Month"
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setCompliancePage(1); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs font-medium focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              <option value="all">All Months</option>
              {monthOptions(today).map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => { setSiteFilter(e.target.value); setCurrentPage(1); setCompliancePage(1); }}
              disabled={!canAccessAllSites() && (allowedSites || []).length <= 1}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            >
              {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                <option value="all">
                  {canAccessAllSites() ? `All Properties / Sites (${allowedSites.length})` : `All Assigned Sites (${allowedSites.length})`}
                </option>
              )}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Room Number, Site, Officer, SU..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); setCompliancePage(1); }}
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all"
            />
          </div>

          <div>
            {pageTab === 'required' ? (
              <select
                aria-label="Filter by Compliance Status"
                value={statusChip}
                onChange={e => {
                  setStatusChip(e.target.value as DueFilter);
                  setCompliancePage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed (2/2)</option>
                <option value="pending">Due (0/2 or 1/2)</option>
                <option value="one_done">Due · 1 of 2 done</option>
                <option value="none_done">Due · none done (0/2)</option>
                <option value="overdue">Overdue Action</option>
              </select>
            ) : (
              <select
                aria-label="Filter by Inspection Status"
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Passed">Passed (Completed)</option>
                <option value="Issues">Issues Identified</option>
                <option value="Attention Required">Attention Required</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Compliance KPI Cards (Only for Required checks view) */}
      {pageTab === 'required' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">Total Rooms</span>
            <div className="text-xl font-bold text-[#242424] tabular-nums mt-0.5">{complianceKpis.total}</div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xs p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Completed (2/2)
            </span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-xl font-bold text-emerald-800 tabular-nums">{complianceKpis.completed}</span>
              <span className="text-[10px] font-bold text-emerald-700 tabular-nums">{complianceKpis.pct}%</span>
            </div>
          </div>

          <div className="bg-amber-50/50 border border-amber-200 rounded-xs p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> Due · 1 of 2 done
            </span>
            <div className="text-xl font-bold text-amber-800 tabular-nums mt-0.5">{complianceKpis.inProgress}</div>
          </div>

          <div className="bg-[#faf9f8] border border-[#edebe9] rounded-xs p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" /> Due · none done (0/2)
            </span>
            <div className="text-xl font-bold text-[#605e5c] tabular-nums mt-0.5">{complianceKpis.notStarted}</div>
          </div>

          <div className={`${complianceKpis.overdue > 0 ? 'bg-red-50/60 border-red-200' : 'bg-[#faf9f8] border-[#edebe9]'} rounded-xs p-2.5 flex flex-col justify-between`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${complianceKpis.overdue > 0 ? 'text-red-800' : 'text-[#605e5c]'} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${complianceKpis.overdue > 0 ? 'bg-red-600 animate-pulse' : 'bg-neutral-400'}`} /> Overdue Action
            </span>
            <div className={`text-xl font-bold tabular-nums mt-0.5 ${complianceKpis.overdue > 0 ? 'text-red-700' : 'text-[#605e5c]'}`}>{complianceKpis.overdue}</div>
          </div>

          <div className="bg-white border border-[#e1dfdd] rounded-xs p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#605e5c]">Monthly Progress</span>
            <div className="mt-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-[#242424] mb-1">
                <span>Rate</span>
                <span className="tabular-nums">{complianceKpis.pct}%</span>
              </div>
              <div className="w-full bg-[#edebe9] rounded-xs h-1.5 overflow-hidden">
                <div className="bg-[#0d9488] h-1.5 rounded-xs transition-all duration-300" style={{ width: `${complianceKpis.pct}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Container */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden flex flex-col justify-between min-h-[520px] lg:min-h-[calc(100vh-270px)]">
        <div className="px-3 py-2 border-b border-[#e5e5e5] bg-[#faf9f8] flex flex-wrap items-center justify-between gap-2">
          <div className={`flex items-center gap-1 overflow-x-auto ${pageTab !== 'required' ? 'hidden' : ''}`} role="group" aria-label="Filter by status">
            <button
              type="button"
              onClick={() => { setStatusChip('all'); setStatusFilter('all'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                statusChip === 'all'
                  ? 'bg-white text-[#0d9488] border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              All Rooms ({filteredComplianceRows.length})
            </button>
            <button
              type="button"
              onClick={() => { setStatusChip('completed'); setStatusFilter('completed'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                statusChip === 'completed'
                  ? 'bg-white text-emerald-800 border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              Completed 2/2 ({complianceKpis.completed})
            </button>
            <button
              type="button"
              onClick={() => { setStatusChip('pending'); setStatusFilter('pending'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer ${
                statusChip === 'pending'
                  ? 'bg-white text-amber-800 border border-[#cbd5e1] shadow-2xs'
                  : 'text-[#605e5c] hover:bg-[#f3f2f1]'
              }`}
            >
              Due ({complianceKpis.inProgress + complianceKpis.notStarted})
            </button>
            <button
              type="button"
              onClick={() => { setStatusChip('overdue'); setStatusFilter('overdue'); setCompliancePage(1); }}
              className={`px-2.5 py-1 rounded-xs text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                statusChip === 'overdue'
                  ? 'bg-white text-red-800 border border-[#cbd5e1] shadow-2xs'
                  : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <span>Overdue</span>
              {complianceKpis.overdue > 0 && (
                <span className="px-1.5 py-0.2 bg-red-100 text-red-800 text-[10px] font-bold rounded-full">
                  {complianceKpis.overdue}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-[#605e5c]">
            {pageTab === 'log'
              ? `Showing ${paginatedRecords.length} of ${filteredRecords.length} historical logs`
              : `Showing ${paginatedComplianceRows.length} of ${tabComplianceRows.length} room check obligations`}
          </div>
        </div>

        {/* Tab 1-4: Monthly Compliance Obligation Table */}
        {pageTab === 'required' && (
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                  <th className="py-2.5 px-3 w-12 whitespace-nowrap">S.No.</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Service User</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Room</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Site / Property</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Check 1 (by {fmt(windows[0].deadline).slice(0, 5)})</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Check 2 (by {fmt(windows[1].deadline).slice(0, 5)})</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Frequency</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Last Checked</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Assigned Staff</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap min-w-[240px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paginatedComplianceRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-neutral-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                      <p className="font-medium text-xs">No rooms found in this view</p>
                      <p className="text-[11px] mt-0.5">Every occupied room in the selected site and month will appear here.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedComplianceRows.map((row, rowIndex) => {
                    const hasOverdue = row.first?.status === 'overdue' || row.second?.status === 'overdue';
                    const lastChecked = row.second?.visitDate || row.first?.visitDate;
                    const lastOfficer = row.second?.completedBy || row.first?.completedBy;
                    const assignedOfficer = row.responsible?.name || loggedInUserName;
                    const overduePeriod: 1 | 2 = (row.first && !isSatisfied(row.first.status) && row.first.status === 'overdue') ? 1 : 2;
                    const nextPeriod: 1 | 2 = (row.first && !isSatisfied(row.first.status)) ? 1 : 2;
                    const latestRecord = recordedFor(row.second) || recordedFor(row.first);

                    return (
                      <tr key={row.subjectKey} className="group hover:bg-[#fbfbfa] transition-colors">
                        <td className="py-2.5 px-3 text-neutral-500 tabular-nums whitespace-nowrap">{serialNo(rowIndex, compliancePage, compliancePageSize)}</td>
                        <td className="py-2.5 px-3">
                          {row.occupancy === 'vacant' ? (
                            <div className="font-medium text-neutral-400">Vacant</div>
                          ) : (
                            <>
                              <div className="font-semibold text-neutral-800">
                                {row.suName || <span className="font-medium text-neutral-500">Occupied (resident record missing)</span>}
                              </div>
                              {row.suReference && <div className="text-[10px] text-neutral-500 font-mono">{row.suReference}</div>}
                              {row.occupancy === 'vacated' && (
                                <div className="text-[10px] text-amber-700">Left {fmt(row.vacatedOn)}</div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-neutral-800 whitespace-nowrap">{row.roomNumber}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-neutral-800">{row.siteName}</div>
                          {row.propertyName && row.propertyName !== row.siteName && (
                            <div className="text-[10px] text-neutral-500">{row.propertyName}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{renderObligationCell(row.first, row, 1)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{renderObligationCell(row.second, row, 2)}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">{renderFrequencyBadge(row)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{renderComplianceStatus(row)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-medium text-neutral-800">{fmt(lastChecked) || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {lastOfficer ? (
                            <div className="flex items-center gap-1.5 text-neutral-800 font-medium whitespace-nowrap" title={`Submitted by ${lastOfficer}`}>
                              <User className="w-3.5 h-3.5 text-[#0d9488] shrink-0" />
                              <span className="truncate max-w-[130px]">{lastOfficer}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-neutral-500 whitespace-nowrap" title={`Assigned: ${assignedOfficer}`}>
                              <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{assignedOfficer}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap min-w-[240px]">
                          <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                            {hasOverdue ? (
                              <button
                                type="button"
                                onClick={() => handleQuickResolve(row, overduePeriod)}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xs text-xs shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0 min-w-[135px]"
                                title={`Resolve Overdue Check ${overduePeriod}`}
                              >
                                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                                <span>Resolve Check {overduePeriod}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickResolve(row, nextPeriod)}
                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 min-w-[135px] ${
                                  row.overall === 'complete'
                                    ? 'bg-white hover:bg-[#f3f2f1] text-[#0d9488] border border-[#cbd5e1]'
                                    : 'bg-[#0d9488] hover:bg-[#0f766e] text-white shadow-2xs'
                                }`}
                                title={row.overall === 'complete' ? 'Record Extra Inspection' : `Record Check ${nextPeriod}`}
                              >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span>{row.overall === 'complete' ? 'Extra Check' : `Record Check ${nextPeriod}`}</span>
                              </button>
                            )}

                            <div className="inline-flex items-center justify-end gap-0.5 w-[76px] shrink-0">
                              {latestRecord && (
                                <div className="inline-flex items-center gap-0.5 pl-1.5 border-l border-neutral-200">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenView(latestRecord)}
                                    title="View Check Record"
                                    className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {canEditRecord() && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(latestRecord)}
                                      title="Edit Check Record"
                                      className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {canDeleteRecord() && (
                                    <button
                                      type="button"
                                      onClick={() => deleteRoomCheck(latestRecord.id)}
                                      title="Delete Check Record"
                                      className="p-1 text-neutral-500 hover:text-red-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: Raw Inspection History Logs */}
        {pageTab === 'log' && (
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                  <th className="py-2.5 px-3 w-12 whitespace-nowrap">S.No.</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Service User</th>
                  {visibleColumns.map(col => {
                    const isSorted = sortKey === col.key;
                    return (
                      <th 
                        key={String(col.key)} 
                        className="py-2.5 px-3 cursor-pointer hover:bg-[#edebe9] transition-colors"
                        onClick={() => {
                          if (sortKey === col.key) {
                            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortKey(col.key as keyof RoomCheckRecord);
                            setSortOrder('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          {isSorted ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#0d9488]" /> : <ArrowDown className="w-3 h-3 text-[#0d9488]" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-3 whitespace-nowrap">Check</th>
                  <th className="py-2.5 px-3 text-right w-24 sticky right-0 bg-[#faf9f8] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10 select-none">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + 4} className="py-12 text-center text-neutral-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-neutral-300 opacity-60" />
                      <p className="font-medium text-xs">No historical room inspections found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((rec, recIndex) => (
                    <tr key={rec.id} className="group hover:bg-[#fbfbfa] transition-colors">
                      <td className="py-2.5 px-3 text-neutral-500 tabular-nums">{serialNo(recIndex, currentPage, pageSize)}</td>
                      <td className="py-2.5 px-3 font-medium text-neutral-800">
                        {(rec.suId && obligationsState.suNameById.get(rec.suId)) || rec.aicReference || <span className="text-neutral-400">—</span>}
                      </td>
                      {visibleColumns.map(col => (
                        <td key={String(col.key)} className="py-2.5 px-3">
                          {renderColumnCell(col, rec)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 whitespace-nowrap text-neutral-700">{checkLabelOf(rec)}</td>
                      <td className="py-2.5 px-3 text-right sticky right-0 bg-white group-hover:bg-[#fbfbfa] shadow-[-2px_0_4px_rgba(0,0,0,0.05)] z-10">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenView(rec)}
                            title="View 30-Point Audit"
                            className="p-1 text-neutral-500 hover:text-[#0d9488] hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEditRecord() && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(rec)}
                              title="Edit Inspection"
                              className="p-1 text-neutral-500 hover:text-blue-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDeleteRecord() && (
                            <button
                              type="button"
                              onClick={() => deleteRoomCheck(rec.id)}
                              title="Delete Inspection"
                              className="p-1 text-neutral-500 hover:text-red-600 hover:bg-[#f0efeb] rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pageTab === 'required' ? (
          <Pagination
            currentPage={compliancePage}
            totalItems={tabComplianceRows.length}
            pageSize={compliancePageSize}
            onPageSizeChange={size => {
              setCompliancePageSize(size);
              setCompliancePage(1);
            }}
            onPageChange={setCompliancePage}
          />
        ) : (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* CREATE / EDIT 30-POINT INSPECTION MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header with live status badge */}
            <div className="px-6 py-4 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h2 className="text-sm font-bold text-[#242424]">{isEditing ? 'Edit Room Check' : '30-Point Room Inspection'}</h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border ${getStatusBadge(formData.overallStatus || 'Passed')}`}>
                  <span>Computed: {formData.overallStatus || 'Passed'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Which check this is */}
            <div className={`px-6 py-2 border-b text-xs flex flex-wrap items-center gap-x-3 gap-y-1 ${recording ? 'bg-teal-50 border-teal-100 text-teal-900' : 'bg-neutral-50 border-[#e5e5e5] text-neutral-600'}`}>
              {recording ? (
                <>
                  <span className="font-bold">Recording Check {recording.period} of 2{recording.month ? ` · ${monthLabel(recording.month)}` : ''}</span>
                  {recording.deadline && <span>due by {recording.deadline.split('-').reverse().join('/')}</span>}
                  <span className="text-[11px] opacity-80">Saved against this check; the inspection date decides whether it counts as on time.</span>
                </>
              ) : (
                <span>Free-standing check: it counts toward Check 1 (1st–{windows[0].deadline.slice(8)}th) or Check 2 (until the {windows[1].deadline.slice(8)}th) by its inspection date.</span>
              )}
            </div>

            {/* Central Master Selection */}
            <div className="px-6 py-2.5 bg-white border-b border-teal-100">
              <div className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider mb-1.5">
                Master Data Selection (Room & Resident)
              </div>
              <SiteServiceUserSelector
                selectedSiteId={formData.siteId}
                selectedSuId={formData.suId}
                onSelect={(sel) => {
                  setFormData(prev => ({
                    ...prev,
                    siteName: sel.siteName,
                    siteId: sel.siteId,
                    suId: sel.suId,
                    propertyId: sel.propertyId,
                    roomId: sel.roomId,
                    roomNumber: sel.roomNumber && sel.roomNumber !== 'Unassigned Room' ? sel.roomNumber : '',
                    aicReference: sel.externalReference || ''
                  }));
                }}
              />
            </div>

            {/* Room Basic Info Header */}
            <div className="px-6 py-3 bg-neutral-50/70 border-b border-[#e5e5e5] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">Property / Site *</label>
                <input
                  type="text"
                  value={formData.siteName || ''}
                  readOnly
                  placeholder="From the selection above"
                  className="w-full p-1.5 border border-teal-200 rounded-xs bg-teal-50/50 text-xs cursor-not-allowed"
                />
                {formErrors.siteName && <p className="text-red-500 text-[10px] mt-0.5">{formErrors.siteName}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">Room Number *</label>
                <input
                  type="text"
                  placeholder="From the selection above"
                  value={formData.roomNumber || ''}
                  readOnly
                  className="w-full p-1.5 border border-teal-200 rounded-xs bg-teal-50/50 text-xs font-semibold cursor-not-allowed"
                />
                {formErrors.roomNumber && <p className="text-red-500 text-[10px] mt-0.5">{formErrors.roomNumber}</p>}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">AIC Reference</label>
                <input
                  type="text"
                  placeholder="From the selection above"
                  value={formData.aicReference || ''}
                  readOnly
                  className="w-full p-1.5 border border-teal-200 rounded-xs bg-teal-50/50 text-xs font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-0.5">Inspection Date *</label>
                <input
                  type="date"
                  value={formData.inspectionDate}
                  onChange={e => setFormData({ ...formData, inspectionDate: e.target.value })}
                  className="w-full p-1.5 border border-[#e5e5e5] rounded-xs bg-white text-xs"
                />
                {formErrors.inspectionDate && <p className="text-red-500 text-[10px] mt-0.5">{formErrors.inspectionDate}</p>}
              </div>
            </div>

            {/* Section Tabs */}
            <div className="px-6 pt-2 pb-0 border-b border-[#e5e5e5] flex gap-1 bg-[#faf9f8] text-xs font-medium shrink-0">
              {[
                { id: 'ROOM CONDITION', label: '1. Room Condition (Q1–27)' },
                { id: 'OTHER ITEMS', label: '2. Other Provisions (Q28–29)' },
                { id: 'FINAL COMMENTS', label: '3. Final Comments (Q30)' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSectionTab(tab.id as any)}
                  className={`px-3 py-2 border-b-2 font-medium transition-colors cursor-pointer ${
                    activeSectionTab === tab.id
                      ? 'border-[#0d9488] text-[#0d9488]'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Questions List */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="space-y-4">
                {currentQuestions.map(q => {
                  const currentItem = (formData.items || []).find(it => it.questionKey === q.key);
                  const response = currentItem?.response || q.defaultExpected || 'Yes';
                  const comment = currentItem?.comment || '';

                  return (
                    <div 
                      key={q.key} 
                      className={`p-3.5 rounded-xs border transition-colors ${
                        q.isCriticalSafety ? 'border-amber-200 bg-amber-50/20' : 'border-neutral-200 bg-[#fbfbfa]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2">
                          {q.isCriticalSafety && (
                            <span className="p-1 bg-amber-100 text-amber-800 rounded text-[10px] font-bold shrink-0 mt-0.5" title="Critical Safety Question">
                              SAFETY
                            </span>
                          )}
                          <p className="font-semibold text-neutral-800 text-xs">{q.text}</p>
                        </div>

                        {/* Yes / No / N/A Selector */}
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                          {(['Yes', 'No', 'N/A'] as RoomCheckResponse[]).map(val => {
                            const isSelected = response === val;
                            let btnClass = 'border border-neutral-300 text-neutral-600 bg-white hover:bg-neutral-50';
                            if (isSelected) {
                              if (val === 'Yes') btnClass = 'bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs';
                              else if (val === 'No') btnClass = 'bg-red-600 text-white border-red-600 font-semibold shadow-xs';
                              else btnClass = 'bg-neutral-600 text-white border-neutral-600 font-semibold shadow-xs';
                            }

                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleItemResponseChange(q.key, val)}
                                className={`px-2.5 py-1 text-xs rounded-xs transition-all cursor-pointer ${btnClass}`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Comment Input for each question */}
                      <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Add comment / defect details for this question..."
                          value={comment}
                          onChange={e => handleItemCommentChange(q.key, e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-neutral-200 rounded-xs focus:border-[#0d9488] outline-hidden"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Final general comments & Conducting Officer signoff (Step 3) */}
                {activeSectionTab === 'FINAL COMMENTS' && (
                  <div className="pt-2 space-y-4">
                    <div className="bg-[#faf9f8] border border-[#e5e5e5] rounded-xs p-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-medium text-neutral-700">Inspecting / Conducting Officer</label>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Locked to session</span>
                        </span>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={formData.officerName || loggedInUserName}
                        className="w-full p-2 border border-[#e1dfdd] rounded-xs bg-[#f3f2f1] text-[#323130] font-medium text-xs cursor-not-allowed select-none outline-hidden"
                      />
                      <p className="text-[10px] text-neutral-400 mt-0.5">Audit log records this room inspection under your authenticated staff account.</p>
                    </div>

                    <div>
                      <label className="block font-medium text-neutral-700 mb-1">Overall Inspection Summary &amp; Recommendations</label>
                      <textarea
                        rows={3}
                        placeholder="Add summary notes, follow-up actions needed by maintenance or housing team..."
                        value={formData.finalComments || ''}
                        onChange={e => setFormData({ ...formData, finalComments: e.target.value })}
                        className="w-full p-2.5 border border-neutral-300 rounded-xs bg-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#e5e5e5] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-700 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white font-medium rounded-xs transition-colors shadow-2xs cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Submit Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {isViewOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0d9488]" />
                <div>
                  <h3 className="text-sm font-bold text-[#242424]">Room {selectedRecord.roomNumber} Inspection</h3>
                  <p className="text-[11px] text-neutral-500">{selectedRecord.siteName} • {selectedRecord.inspectionDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold border ${getStatusBadge(selectedRecord.overallStatus)}`}>
                  {selectedRecord.overallStatus}
                </span>
                <button
                  type="button"
                  onClick={() => setIsViewOpen(false)}
                  className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 p-3 rounded-xs border border-neutral-200">
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Room Number</span>
                  <span className="font-bold text-neutral-900 text-sm">{selectedRecord.roomNumber}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Property</span>
                  <span className="font-semibold">{selectedRecord.siteName}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">AIC Reference</span>
                  <span className="font-mono">{selectedRecord.aicReference || '—'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px] uppercase font-semibold">Inspector</span>
                  <span>{selectedRecord.officerName || 'Staff'}</span>
                </div>
              </div>

              {/* 30 Questions Responses */}
              <div className="border border-neutral-200 rounded-xs overflow-hidden">
                <div className="bg-[#faf9f8] px-3 py-2 border-b border-neutral-200 font-semibold text-neutral-800">
                  Full 30-Point Inspection Results
                </div>
                <div className="divide-y divide-neutral-100 max-h-[400px] overflow-y-auto">
                  {(selectedRecord.items || defaultItems).map(item => (
                    <div key={item.questionKey} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-neutral-50/50">
                      <div>
                        <p className="font-medium text-neutral-800">{item.questionText}</p>
                        {item.comment && (
                          <p className="text-[11px] text-neutral-500 mt-0.5 bg-neutral-100 px-2 py-0.5 rounded inline-block">
                            Note: {item.comment}
                          </p>
                        )}
                      </div>
                      <div>
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.response === 'Yes' ? 'bg-emerald-100 text-emerald-800' :
                          item.response === 'No' ? 'bg-red-100 text-red-800' :
                          'bg-neutral-200 text-neutral-700'
                        }`}>
                          {item.response}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRecord.finalComments && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xs">
                  <span className="font-semibold text-neutral-800 block mb-1">Final Comments:</span>
                  <p className="text-neutral-700 whitespace-pre-wrap">{selectedRecord.finalComments}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-[#e1dfdd] bg-[#faf9f8] flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white rounded-xs transition-colors cursor-pointer text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Table Customization Modal for Super Admin */}
      <TableSchemaEditorModal<RoomCheckRecord>
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Room Checks"
        columns={schemaColumns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
