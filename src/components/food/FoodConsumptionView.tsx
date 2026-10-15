import React, { useState, useMemo, useEffect } from 'react';
import { 
  Utensils, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  SlidersHorizontal,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  Inbox,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodConsumptionReport, FoodConsumptionItem, FoodBoxRequest } from '../../types';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption, ExportFormat, ExportScope, ExportOrientation } from '../common/ExportModal';
import { exportTableToPdf } from '../../utils/pdfExport';
import { exportTableToCsv } from '../../utils/csvExport';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { useTableSchema } from '../../hooks/useTableSchema';
import { FOOD_CONSUMPTION_TABLE_COLUMNS, FOOD_BOX_REQUEST_TABLE_COLUMNS } from '../../data/defaultTableSchemas';

const DEFAULT_BREAKFAST_ITEMS = [
  'Eggs', 'Bread', 'Milk', 'Cereal', 'Cheese', 'Butter', 'Juice', 'Jam'
];

const DEFAULT_LUNCH_ITEMS = [
  'Southern fried chicken', 'Southern fried tofu', 'Salad', 'Chips'
];

const DEFAULT_DINNER_ITEMS = [
  'Beef massaman curry', 'Cauliflower massaman curry', 'Rice', 'Salad'
];

export const FoodConsumptionView: React.FC = () => {
  const {
    foodConsumptionReports,
    addFoodConsumptionReport,
    updateFoodConsumptionReport,
    deleteFoodConsumptionReport,
    foodBoxRequests,
    addFoodBoxRequest,
    updateFoodBoxRequest,
    deleteFoodBoxRequest,
    allowedSites,
    assignedSite,
    canAccessAllSites,
    isSitePermitted,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    currentUserRole,
    requestConfirmation
  } = useApp();

  const [activeTab, setActiveTab] = useState<'daily_report' | 'box_requests'>('daily_report');

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [siteFilter, setSiteFilter] = useState(() => {
    if (assignedSite && assignedSite !== 'All Sites' && assignedSite !== 'all') return assignedSite;
    return 'all';
  });

  useEffect(() => {
    if (assignedSite === 'All Sites' || assignedSite === 'all') {
      if (canAccessAllSites() || (allowedSites && allowedSites.length > 1)) {
        setSiteFilter('all');
      }
    } else if (assignedSite) {
      setSiteFilter(assignedSite);
    }
  }, [assignedSite, canAccessAllSites, allowedSites]);

  // Modal states for Daily Food Report
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FoodConsumptionReport | null>(null);
  const [viewingReport, setViewingReport] = useState<FoodConsumptionReport | null>(null);

  // Modal states for Food Box Requests / Complaints
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<FoodBoxRequest | null>(null);

  // New report interactive items
  const [currentItems, setCurrentItems] = useState<FoodConsumptionItem[]>([]);
  const [feedbackComments, setFeedbackComments] = useState('Menu Satisfactory.');

  const initReportItems = () => {
    const items: FoodConsumptionItem[] = [];
    DEFAULT_BREAKFAST_ITEMS.forEach((it, i) => {
      items.push({
        id: `bf-${i}`,
        meal: 'Breakfast',
        item: it,
        quantityVol: '',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '8',
        remarks: ''
      });
    });
    DEFAULT_LUNCH_ITEMS.forEach((it, i) => {
      items.push({
        id: `lu-${i}`,
        meal: 'Lunch',
        item: it,
        quantityVol: '1 Tray',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '7',
        remarks: ''
      });
    });
    DEFAULT_DINNER_ITEMS.forEach((it, i) => {
      items.push({
        id: `di-${i}`,
        meal: 'Dinner',
        item: it,
        quantityVol: '1 Tray',
        consumptionPercent: '100%',
        binnedPercent: '0%',
        rating: '7',
        remarks: ''
      });
    });
    setCurrentItems(items);
    setFeedbackComments('Menu Satisfactory.');
  };

  const handleOpenCreateReport = () => {
    initReportItems();
    setIsReportModalOpen(true);
  };

  const filteredReports = useMemo(() => {
    return (foodConsumptionReports || []).filter(r => {
      if (!isSitePermitted(r.site, siteFilter)) return false;
      if (selectedDate && r.date !== selectedDate) return false;
      return true;
    });
  }, [foodConsumptionReports, isSitePermitted, siteFilter, selectedDate]);

  const filteredBoxRequests = useMemo(() => {
    return (foodBoxRequests || []).filter(b => {
      if (!isSitePermitted(b.site, siteFilter)) return false;
      return true;
    });
  }, [foodBoxRequests, isSitePermitted, siteFilter]);

  return (
    <div className="space-y-4">
      {/* Top Banner Card */}
      <div className="bg-white border border-[#e5e5e5] rounded-xs p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xs bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1e293b]">Food Consumption (In & Out) Log</h1>
              <p className="text-xs text-[#64748b]">
                Daily meal monitoring matrix for Breakfast, Lunch, and Dinner (Consumption %, Binned %, Ratings & Feedback) and Box Requests/Complaints log.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'daily_report' && canCreateRecord() && (
              <button
                onClick={handleOpenCreateReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Daily Food Report
              </button>
            )}

            {activeTab === 'box_requests' && canCreateRecord() && (
              <button
                onClick={() => setIsBoxModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Food Box / Complaint
              </button>
            )}
          </div>
        </div>

        {/* Tab & Property Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#f1f5f9] items-center">
          <div className="sm:col-span-2 flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xs border border-[#e2e8f0]">
            <button
              onClick={() => setActiveTab('daily_report')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
                activeTab === 'daily_report'
                  ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Daily Food Consumption Reports
            </button>
            <button
              onClick={() => setActiveTab('box_requests')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xs text-xs font-semibold transition-all ${
                activeTab === 'box_requests'
                  ? 'bg-white text-[#0d9488] shadow-2xs border border-[#cbd5e1]'
                  : 'text-[#64748b] hover:text-[#1e293b]'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Food Box Requests & Complaints
            </button>
          </div>

          <div>
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              disabled={!canAccessAllSites() && (allowedSites || []).length <= 1}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden font-semibold"
            >
              {(canAccessAllSites() || (allowedSites && allowedSites.length > 1)) && (
                <option value="all">
                  {canAccessAllSites() ? `All Properties (${allowedSites.length})` : `All Assigned Sites (${allowedSites.length})`}
                </option>
              )}
              {allowedSites.map((s, idx) => (
                <option key={`${s}-${idx}`} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#fbfbfa] border border-[#e5e5e5] rounded-xs text-xs focus:bg-white focus:border-[#0d9488] outline-hidden font-semibold"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: DAILY FOOD CONSUMPTION REPORT */}
      {activeTab === 'daily_report' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden">
            <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
              <span className="text-xs font-bold text-[#475569] uppercase">
                Recorded Food Consumption Reports ({filteredReports.length})
              </span>
            </div>

            <div className="divide-y divide-[#f1f5f9]">
              {filteredReports.length === 0 ? (
                <div className="p-8 text-center text-[#94a3b8] text-xs">
                  No daily food consumption report found for {selectedDate || 'this date'}. Click "New Daily Food Report" to record Breakfast, Lunch, and Dinner.
                </div>
              ) : (
                filteredReports.map(report => (
                  <div key={report.id} className="p-4 hover:bg-[#fafafa] transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#1e293b]">Daily Food Consumption Report – {report.site}</h3>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            Date: {report.date}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748b] mt-0.5">
                          Menu Feedback: <span className="font-semibold text-slate-700">{report.feedbackComments || 'Satisfactory'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingReport(report)}
                          className="px-2 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Table
                        </button>

                        {canEditRecord(report.site) && (
                          <button
                            onClick={() => {
                              setEditingReport(report);
                              setCurrentItems(report.items || []);
                              setFeedbackComments(report.feedbackComments || 'Menu Satisfactory.');
                              setIsReportModalOpen(true);
                            }}
                            className="px-2 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-300 flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Edit Report
                          </button>
                        )}

                        {canDeleteRecord() && (
                          <button
                            onClick={() => {
                              requestConfirmation({
                                title: 'Delete Food Report',
                                message: `Permanently delete Food Consumption Report for ${report.site} on ${report.date}?`,
                                confirmLabel: 'Delete Report',
                                isDanger: true,
                                onConfirm: async () => deleteFoodConsumptionReport(report.id)
                              });
                            }}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preview Table for Breakfast, Lunch & Dinner */}
                    <div className="border border-[#e2e8f0] rounded-xs overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-[#f8fafc] text-[#475569] font-bold">
                          <tr>
                            <th className="p-2">Meal</th>
                            <th className="p-2">Items</th>
                            <th className="p-2">Quantity/Vol</th>
                            <th className="p-2">Consumption (%)</th>
                            <th className="p-2">Binned (%)</th>
                            <th className="p-2">Rating (01-10)</th>
                            <th className="p-2">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {(report.items || []).slice(0, 6).map((it, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-semibold text-[#0d9488]">{it.meal}</td>
                              <td className="p-2 font-bold text-[#1e293b]">{it.item}</td>
                              <td className="p-2">{it.quantityVol || '—'}</td>
                              <td className="p-2 font-semibold text-emerald-600">{it.consumptionPercent}</td>
                              <td className="p-2 font-semibold text-rose-600">{it.binnedPercent}</td>
                              <td className="p-2 font-bold">{it.rating}</td>
                              <td className="p-2 text-slate-500">{it.remarks || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FOOD BOX REQUESTS & COMPLAINTS */}
      {activeTab === 'box_requests' && (
        <div className="bg-white border border-[#e5e5e5] rounded-xs shadow-2xs overflow-hidden">
          <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
            <span className="text-xs font-bold text-[#475569] uppercase">
              Food Box Requests & Complaints Register ({filteredBoxRequests.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Hotel / Property</th>
                  <th className="py-2.5 px-3 font-semibold">Room No.</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Reason / Description</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {filteredBoxRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#94a3b8]">
                      No food box requests or complaints logged.
                    </td>
                  </tr>
                ) : (
                  filteredBoxRequests.map(box => {
                    const canEdit = canEditRecord(box.site);
                    const canDelete = canDeleteRecord();

                    return (
                      <tr key={box.id} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="py-2.5 px-3 font-semibold">{box.date}</td>
                        <td className="py-2.5 px-3">{box.site}</td>
                        <td className="py-2.5 px-3 font-bold text-[#1e293b]">Room {box.roomNo}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            box.type === 'Complaint' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-teal-50 text-teal-700 border-teal-200'
                          }`}>
                            {box.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-sm truncate text-[#334155]">{box.reason}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            box.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {box.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <button
                                onClick={() => {
                                  setEditingBox(box);
                                  setIsBoxModalOpen(true);
                                }}
                                className="p-1 text-[#64748b] hover:text-amber-600 hover:bg-amber-50 rounded"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                onClick={() => {
                                  requestConfirmation({
                                    title: 'Delete Food Box Request',
                                    message: `Permanently delete food box entry for Room ${box.roomNo}?`,
                                    confirmLabel: 'Delete Entry',
                                    isDanger: true,
                                    onConfirm: async () => deleteFoodBoxRequest(box.id)
                                  });
                                }}
                                className="p-1 text-[#64748b] hover:text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FOOD REPORT MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-5xl w-full max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1e293b]">
                {editingReport ? 'Edit Daily Food Consumption Report' : 'New Daily Food Consumption Report (Pier Avenue Sheet)'}
              </h2>
              <button onClick={() => { setIsReportModalOpen(false); setEditingReport(null); }} className="font-bold text-[#64748b]">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const data = {
                  date: (formData.get('date') as string) || selectedDate,
                  site: (formData.get('site') as string) || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
                  items: currentItems,
                  feedbackComments: feedbackComments,
                  reportedBy: currentUserRole || 'Staff'
                };

                if (editingReport) {
                  updateFoodConsumptionReport(editingReport.id, data);
                } else {
                  addFoodConsumptionReport(data);
                }

                setIsReportModalOpen(false);
                setEditingReport(null);
              }}
              className="flex-1 overflow-y-auto p-5 space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={editingReport?.date || selectedDate || new Date().toISOString().slice(0, 10)}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Hotel / Property</label>
                  <select
                    name="site"
                    defaultValue={editingReport?.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''))}
                    required
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs font-semibold"
                  >
                    {allowedSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Matrix of Meals */}
              <div className="border border-[#e2e8f0] rounded-xs overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#f1f5f9] font-bold text-[#475569]">
                    <tr>
                      <th className="p-2">Meal</th>
                      <th className="p-2">Items</th>
                      <th className="p-2">Quantity/Vol</th>
                      <th className="p-2">Consumption (%)</th>
                      <th className="p-2">Binned (%)</th>
                      <th className="p-2">Rating (01-10)</th>
                      <th className="p-2">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {currentItems.map((item, idx) => (
                      <tr key={idx} className={item.meal === 'Breakfast' ? 'bg-amber-50/20' : item.meal === 'Lunch' ? 'bg-emerald-50/20' : 'bg-sky-50/20'}>
                        <td className="p-2 font-bold text-[#0d9488] whitespace-nowrap">{item.meal}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.item}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, item: val } : r));
                            }}
                            className="w-full px-2 py-1 border border-[#cbd5e1] rounded-xs font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="e.g. 1 Tray"
                            value={item.quantityVol}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, quantityVol: val } : r));
                            }}
                            className="w-24 px-2 py-1 border border-[#cbd5e1] rounded-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="100%"
                            value={item.consumptionPercent}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, consumptionPercent: val } : r));
                            }}
                            className="w-20 px-2 py-1 border border-[#cbd5e1] rounded-xs font-semibold text-emerald-700"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="0%"
                            value={item.binnedPercent}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, binnedPercent: val } : r));
                            }}
                            className="w-20 px-2 py-1 border border-[#cbd5e1] rounded-xs font-semibold text-rose-700"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="0-10"
                            value={item.rating}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, rating: val } : r));
                            }}
                            className="w-16 px-2 py-1 border border-[#cbd5e1] rounded-xs font-bold text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Notes..."
                            value={item.remarks}
                            onChange={e => {
                              const val = e.target.value;
                              setCurrentItems(prev => prev.map((r, i) => i === idx ? { ...r, remarks: val } : r));
                            }}
                            className="w-full px-2 py-1 border border-[#cbd5e1] rounded-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Feedback / Comments</label>
                <input
                  type="text"
                  value={feedbackComments}
                  onChange={e => setFeedbackComments(e.target.value)}
                  placeholder="e.g. Menu Satisfactory."
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs font-semibold bg-emerald-50/50"
                />
              </div>

              <div className="pt-3 border-t border-[#e2e8f0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsReportModalOpen(false); setEditingReport(null); }}
                  className="px-4 py-2 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold"
                >
                  Save Daily Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW REPORT FULL MODAL */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-4xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-[#1e293b]">Daily Food Consumption Report – {viewingReport.site}</h2>
              <button onClick={() => setViewingReport(null)} className="font-bold text-[#64748b]">✕</button>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded">
              <div><span className="font-bold">Date:</span> {viewingReport.date}</div>
              <div><span className="font-bold">Hotel:</span> {viewingReport.site}</div>
              <div><span className="font-bold">Feedback / Comments:</span> {viewingReport.feedbackComments || 'Menu Satisfactory.'}</div>
            </div>

            <div className="border rounded overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#f8fafc] font-bold text-[#475569]">
                  <tr>
                    <th className="p-2">Meal</th>
                    <th className="p-2">Item</th>
                    <th className="p-2">Quantity/Vol</th>
                    <th className="p-2">Consumption (%)</th>
                    <th className="p-2">Binned (%)</th>
                    <th className="p-2">Rating (01-10)</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(viewingReport.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-[#0d9488]">{it.meal}</td>
                      <td className="p-2 font-bold">{it.item}</td>
                      <td className="p-2">{it.quantityVol || '—'}</td>
                      <td className="p-2 font-semibold text-emerald-600">{it.consumptionPercent}</td>
                      <td className="p-2 font-semibold text-rose-600">{it.binnedPercent}</td>
                      <td className="p-2 font-bold">{it.rating}</td>
                      <td className="p-2 text-slate-500">{it.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setViewingReport(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT FOOD BOX MODAL */}
      {isBoxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xs shadow-xl border border-[#cbd5e1] max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-[#1e293b]">
                {editingBox ? 'Edit Food Box Request / Complaint' : 'Log Food Box Request or Complaint'}
              </h2>
              <button onClick={() => { setIsBoxModalOpen(false); setEditingBox(null); }} className="font-bold text-[#64748b]">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);

                const data = {
                  date: (formData.get('date') as string) || new Date().toISOString().slice(0, 10),
                  site: (formData.get('site') as string) || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || '')),
                  roomNo: (formData.get('roomNo') as string) || '',
                  type: (formData.get('type') as string) || 'Request',
                  reason: (formData.get('reason') as string) || '',
                  status: (formData.get('status') as string) || 'Pending',
                  remarks: (formData.get('remarks') as string) || ''
                };

                if (editingBox) {
                  updateFoodBoxRequest(editingBox.id, data);
                } else {
                  addFoodBoxRequest(data);
                }

                setIsBoxModalOpen(false);
                setEditingBox(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Date</label>
                <input
                  type="date"
                  name="date"
                  defaultValue={editingBox?.date || new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Hotel / Property</label>
                <select
                  name="site"
                  defaultValue={editingBox?.site || (siteFilter !== 'all' ? siteFilter : (allowedSites?.[0] || ''))}
                  required
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs font-semibold"
                >
                  {allowedSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Room No.</label>
                <input
                  type="text"
                  name="roomNo"
                  defaultValue={editingBox?.roomNo || ''}
                  required
                  placeholder="e.g. 104"
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Type</label>
                  <select
                    name="type"
                    defaultValue={editingBox?.type || 'Special Box'}
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs"
                  >
                    <option value="Special Box">Special Box</option>
                    <option value="Request">Request</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Dietary Adjustment">Dietary Adjustment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingBox?.status || 'Active'}
                    className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase mb-1">Reason / Description</label>
                <textarea
                  name="reason"
                  rows={2}
                  defaultValue={editingBox?.reason || ''}
                  required
                  placeholder="Reason for special box or details of complaint..."
                  className="w-full px-2.5 py-1.5 border border-[#cbd5e1] rounded-xs"
                />
              </div>

              <div className="pt-3 border-t border-[#e2e8f0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsBoxModalOpen(false); setEditingBox(null); }}
                  className="px-4 py-2 border border-[#cbd5e1] rounded-xs text-xs font-semibold text-[#475569] hover:bg-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
