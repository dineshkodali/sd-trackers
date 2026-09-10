import React, { useState } from 'react';
import { 
  Shirt, 
  Soup, 
  UtensilsCrossed, 
  Truck, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  ArrowUpRight, 
  Flame, 
  Calendar,
  Building2,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FoodVendorName, FoodBuffetItemBreakdown } from '../../types';

interface PropertyOperationsOverviewWidgetProps {
  onNavigate: (page: string) => void;
}

export const PropertyOperationsOverviewWidget: React.FC<PropertyOperationsOverviewWidgetProps> = ({ 
  onNavigate 
}) => {
  const { 
    propertyLaundryLogs, 
    foodVendorBuffetLogs, 
    foodVendorsList, 
    properties, 
    sites 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'laundry' | 'food'>('laundry');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');
  const [selectedPeriodType, setSelectedPeriodType] = useState<'all' | 'Weekly' | 'Monthly'>('all');

  // Laundry aggregates
  const totalSent = propertyLaundryLogs.reduce((acc, l) => acc + (l.dirtyLaundrySent || 0), 0);
  const totalReturned = propertyLaundryLogs.reduce((acc, l) => acc + (l.cleanLaundryReturned || 0), 0);
  const totalDiscrepancies = propertyLaundryLogs.reduce((acc, l) => acc + (l.discrepanciesCount || 0), 0);
  const logsWithDiscrepancies = propertyLaundryLogs.filter(l => l.hasDiscrepancy || l.discrepanciesCount > 0);

  const filteredLaundryLogs = propertyLaundryLogs.filter(l => {
    if (selectedPeriodType !== 'all' && l.periodType !== selectedPeriodType) return false;
    return true;
  });

  // Food aggregates across vendors
  const filteredFoodLogs = foodVendorBuffetLogs.filter(f => {
    if (selectedVendorFilter !== 'all' && f.vendor !== selectedVendorFilter) return false;
    return true;
  });

  // Compute total weekly buffet meals delivered
  const totalBuffetMealsCount = foodVendorBuffetLogs.reduce((acc, log) => {
    let weekSum = 0;
    Object.values(log.dailyCounts || {}).forEach((day: FoodBuffetItemBreakdown | undefined) => {
      if (day) {
        weekSum += (day.lunch || 0) + (day.dinner || 0) + (day.todlrLunch || 0) + 
                   (day.todlrDinner || 0) + (day.specialLunch || 0) + (day.specialDinner || 0) + 
                   (day.schoolMealLunch || 0) + (day.childDinner || 0);
      }
    });
    return acc + weekSum;
  }, 0);

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs p-4 space-y-3.5">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#edebe9] gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#0f766e] text-white rounded-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#242424] flex items-center gap-2">
              Commercial Operations Center: Laundry &amp; Hot Food Catering
              <span className="text-[10px] px-2 py-0.5 font-semibold bg-[#f0fdfa] text-[#0f766e] border border-[#5eead4] rounded">
                Property Logs &amp; 4-Vendor Matrix
              </span>
            </h3>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Weekly / monthly laundry linen reconciliation and 4-vendor hot buffet supply schedule across contracted properties.
            </p>
          </div>
        </div>

        {/* Tab switcher & quick navigation */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-[#f3f2f1] p-0.5 rounded border border-[#e1dfdd] text-xs font-semibold">
            <button
              onClick={() => setActiveTab('laundry')}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'laundry'
                  ? 'bg-white text-[#0f766e] shadow-xs'
                  : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Weekly Laundry Logs</span>
              {totalDiscrepancies > 0 && (
                <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  {totalDiscrepancies} disc
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('food')}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'food'
                  ? 'bg-white text-orange-900 shadow-xs'
                  : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-600" />
              <span>4-Vendor Hot Food</span>
              <span className="bg-orange-100 text-orange-900 px-1.5 py-0.2 rounded text-[10px] font-bold">
                4 Vendors
              </span>
            </button>
          </div>

          <button
            onClick={() => onNavigate(activeTab === 'laundry' ? 'laundry' : 'food')}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs transition-colors"
          >
            <span>Open Full {activeTab === 'laundry' ? 'Laundry' : 'Food'} Hub</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab 1: Weekly & Monthly Laundry Logs */}
      {activeTab === 'laundry' && (
        <div className="space-y-3">
          {/* Top Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-[#f3f8fd] border border-[#5eead4] p-2.5 rounded-xs">
              <span className="text-[10px] text-[#0f766e] block font-medium">Dirty Laundry Sent</span>
              <span className="text-xl font-bold text-[#0f766e] font-mono">{totalSent} pcs</span>
              <span className="text-[10px] text-slate-500 block">All contracted sites</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xs">
              <span className="text-[10px] text-emerald-800 block font-medium">Clean Laundry Returned</span>
              <span className="text-xl font-bold text-emerald-900 font-mono">{totalReturned} pcs</span>
              <span className="text-[10px] text-emerald-700 block">Reconciled delivery</span>
            </div>
            <div className={`p-2.5 rounded-xs border ${
              totalDiscrepancies > 0 
                ? 'bg-amber-50 border-amber-300 text-amber-900' 
                : 'bg-[#faf9f8] border-[#edebe9] text-neutral-800'
            }`}>
              <span className="text-[10px] block font-medium">Discrepancies</span>
              <span className="text-xl font-bold font-mono">
                {totalDiscrepancies} {totalDiscrepancies === 1 ? 'item' : 'items'}
              </span>
              <span className="text-[10px] block opacity-80">
                {logsWithDiscrepancies.length} properties flagged
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xs">
              <span className="text-[10px] text-slate-700 block font-medium">Logged Cycles</span>
              <span className="text-xl font-bold text-slate-900 font-mono">{propertyLaundryLogs.length}</span>
              <span className="text-[10px] text-slate-500 block">Weekly &amp; Monthly records</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-700">Filter Period:</span>
              <div className="flex gap-1">
                {(['all', 'Weekly', 'Monthly'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriodType(p)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      selectedPeriodType === p
                        ? 'bg-[#0f766e] text-white font-semibold'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {p === 'all' ? 'All Logs' : p}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-neutral-500">
              Showing {filteredLaundryLogs.length} property log entries
            </span>
          </div>

          {/* Table of Weekly Laundry Log: Dirty Laundry Sent | Clean Laundry Returned | Discrepancies? | Remarks / Actions Taken */}
          <div className="border border-[#e1dfdd] rounded-xs overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f3f2f1] text-[#242424] font-semibold sticky top-0 border-b border-[#edebe9]">
                  <tr>
                    <th className="py-2 px-3">Property / Site</th>
                    <th className="py-2 px-3">Log Period</th>
                    <th className="py-2 px-3 text-right">Dirty Laundry Sent</th>
                    <th className="py-2 px-3 text-right">Clean Laundry Returned</th>
                    <th className="py-2 px-3 text-center">Discrepancies?</th>
                    <th className="py-2 px-3 min-w-[200px]">Remarks / Actions Taken</th>
                    <th className="py-2 px-3">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {filteredLaundryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-neutral-500">
                        No property laundry log records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLaundryLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#faf9f8] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#242424]">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{log.site}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.periodType === 'Weekly' ? 'bg-teal-50 text-blue-800' : 'bg-purple-50 text-purple-800'
                          }`}>
                            {log.periodType}
                          </span>
                          <div className="text-[11px] text-neutral-500 mt-0.5">{log.periodLabel}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {log.dirtyLaundrySent}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                          {log.cleanLaundryReturned}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {log.hasDiscrepancy || log.discrepanciesCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              Yes ({log.discrepanciesCount || 0} diff)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              No (0)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-700 text-xs">
                          {log.remarksActionsTaken || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-500 text-[11px] whitespace-nowrap">
                          {log.loggedBy}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 4-Vendor Hot Food Section (A&M, Freshbite, 9 cusines, sands) */}
      {activeTab === 'food' && (
        <div className="space-y-3">
          {/* Vendor selection tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fff8ed] p-2.5 rounded-xs border border-[#fedbb0]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#8a3700] uppercase tracking-wide">Approved Food Vendors:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedVendorFilter('all')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    selectedVendorFilter === 'all'
                      ? 'bg-[#8a3700] text-white shadow-xs'
                      : 'bg-white text-[#8a3700] border border-[#fedbb0] hover:bg-orange-50'
                  }`}
                >
                  All 4 Vendors ({foodVendorBuffetLogs.length})
                </button>
                {foodVendorsList.map(vendor => (
                  <button
                    key={vendor}
                    onClick={() => setSelectedVendorFilter(vendor)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      selectedVendorFilter === vendor
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-white text-orange-900 border border-orange-200 hover:bg-orange-50'
                    }`}
                  >
                    {vendor}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-right text-xs">
              <span className="text-neutral-600 text-[11px]">Total Buffet Meals: </span>
              <strong className="text-orange-900 font-mono text-sm">{totalBuffetMealsCount}</strong>
            </div>
          </div>

          {/* Buffet Weekly Tables for each vendor/property schedule */}
          <div className="space-y-4">
            {filteredFoodLogs.map(log => {
              const days: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN')[] = [
                'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'
              ];

              const rows = [
                { key: 'lunch', label: 'Lunch' },
                { key: 'dinner', label: 'Dinner' },
                { key: 'todlrLunch', label: 'Todlr(Lunch)' },
                { key: 'todlrDinner', label: 'Todlr(Dinner)' },
                { key: 'specialLunch', label: 'Special-Lunch' },
                { key: 'specialDinner', label: 'Special-Dinner' },
                { key: 'schoolMealLunch', label: 'School Meal/Child Lunch' },
                { key: 'childDinner', label: 'Child Dinner' }
              ] as const;

              // Calculate weekly totals per row
              const rowTotals = rows.map(r => {
                let sum = 0;
                days.forEach(d => {
                  const dayObj = log.dailyCounts?.[d];
                  if (dayObj) {
                    sum += (dayObj[r.key as keyof typeof dayObj] as number) || 0;
                  }
                });
                return { key: r.key, label: r.label, sum };
              });

              // Grand weekly total
              const grandTotal = rowTotals.reduce((a, b) => a + b.sum, 0);

              return (
                <div key={log.id} className="border border-[#e1dfdd] rounded-xs bg-white overflow-hidden shadow-xs">
                  {/* Schedule Header */}
                  <div className="bg-[#f3f8fd] px-3.5 py-2.5 border-b border-[#5eead4] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#0f766e] text-white text-xs font-bold rounded">
                        Vendor: {log.vendor}
                      </span>
                      <strong className="text-xs text-[#242424]">{log.site}</strong>
                      <span className="text-xs text-[#605e5c]">&bull; {log.weekRange}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[11px] text-[#605e5c]">Weekly Total:</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold rounded">
                        {grandTotal} Servings
                      </span>
                    </div>
                  </div>

                  {/* Matrix Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#faf9f8] text-[#242424] font-semibold border-b border-[#edebe9]">
                        <tr>
                          <th className="py-1.5 px-3 min-w-[180px]">Buffet Meal Category</th>
                          {days.map(d => (
                            <th key={d} className="py-1.5 px-2 text-center w-16">{d}</th>
                          ))}
                          <th className="py-1.5 px-3 text-right bg-slate-100 font-bold w-20">Weekly Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#edebe9]">
                        {rows.map(r => {
                          const rTot = rowTotals.find(t => t.key === r.key)?.sum || 0;
                          return (
                            <tr key={r.key} className="hover:bg-[#faf9f8]">
                              <td className="py-1.5 px-3 font-medium text-neutral-800">
                                {r.label}
                              </td>
                              {days.map(d => {
                                const val = log.dailyCounts?.[d]?.[r.key as keyof (typeof log.dailyCounts)[typeof d]];
                                return (
                                  <td key={d} className="py-1.5 px-2 text-center font-mono text-neutral-700">
                                    {val !== undefined ? val : '—'}
                                  </td>
                                );
                              })}
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-[#0f766e] bg-slate-50">
                                {rTot}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Summary Total Row */}
                        <tr className="bg-neutral-100 font-bold text-neutral-900 border-t-2 border-[#d2d0ce]">
                          <td className="py-2 px-3">Daily &amp; Weekly Grand Total</td>
                          {days.map(d => {
                            let daySum = 0;
                            rows.forEach(r => {
                              const v = log.dailyCounts?.[d]?.[r.key as keyof (typeof log.dailyCounts)[typeof d]];
                              if (typeof v === 'number') daySum += v;
                            });
                            return (
                              <td key={d} className="py-2 px-2 text-center font-mono text-[#0f766e]">
                                {daySum}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50">
                            {grandTotal}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {log.notes && (
                    <div className="px-3 py-1.5 bg-[#faf9f8] border-t border-[#edebe9] text-[11px] text-[#605e5c] flex items-center justify-between">
                      <span><strong>Notes:</strong> {log.notes}</span>
                      <span>Updated: {new Date(log.updatedAt).toLocaleDateString()} by {log.lastUpdatedBy}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
