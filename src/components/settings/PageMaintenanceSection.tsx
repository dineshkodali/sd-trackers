import React, { useState, useMemo } from 'react';
import { 
  Wrench, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Power, 
  ShieldAlert, 
  Filter,
  MessageSquare,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { APP_PAGES_REGISTRY, AppModulePage } from '../../config/pageRegistry';

export const PageMaintenanceSection: React.FC = () => {
  const { 
    currentUserRole, 
    settings, 
    updateSettings, 
    setPageMaintenanceMode, 
    setAllPagesMaintenanceMode 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Maintenance' | 'Live'>('All');
  const [customMsg, setCustomMsg] = useState(
    settings.maintenanceMessage || 
    'This page is currently undergoing scheduled maintenance and updates. It will be restored shortly.'
  );
  const [msgSaved, setMsgSaved] = useState(false);

  const maintenanceMap = settings.pageMaintenance || {};

  const categories = useMemo(() => {
    const set = new Set(APP_PAGES_REGISTRY.map(p => p.category));
    return ['All', ...Array.from(set)];
  }, []);

  const totalPages = APP_PAGES_REGISTRY.length;
  const maintenanceCount = Object.entries(maintenanceMap).filter(([, v]) => v).length;
  const liveCount = totalPages - maintenanceCount;

  const filteredPages = useMemo(() => {
    return APP_PAGES_REGISTRY.filter(page => {
      const isMaint = Boolean(maintenanceMap[page.id]);
      const matchesSearch = 
        page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || page.category === selectedCategory;
      const matchesStatus = 
        statusFilter === 'All' ? true :
        statusFilter === 'Maintenance' ? isMaint :
        !isMaint;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [searchQuery, selectedCategory, statusFilter, maintenanceMap]);

  // Strict RBAC gate — must come AFTER all hooks (React Rules of Hooks)
  if (currentUserRole !== 'Super Admin') {
    return null;
  }

  const handleToggle = (pageId: string) => {
    const current = Boolean(maintenanceMap[pageId]);
    setPageMaintenanceMode(pageId, !current);
  };

  const handleClearAll = () => {
    const activeMaintenanceIds = Object.entries(maintenanceMap)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeMaintenanceIds.length === 0) return;
    setAllPagesMaintenanceMode(activeMaintenanceIds, false);
  };

  const handleSaveMessage = () => {
    updateSettings({ maintenanceMessage: customMsg });
    setMsgSaved(true);
    setTimeout(() => setMsgSaved(false), 2500);
  };

  return (
    <div className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-4 border-b border-[#edebe9] bg-[#faf9f8] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-[#242424]">
                Page Maintenance Mode Control
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                Super Admin Only
              </span>
            </div>
            <p className="text-[11px] text-[#605e5c]">
              Temporarily take individual pages offline during updates. Regular users see the maintenance screen; Super Admins retain full access.
            </p>
          </div>
        </div>

        {/* Stats & Quick Actions */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{liveCount} Live</span>
          </span>

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${
            maintenanceCount > 0 
              ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse' 
              : 'bg-neutral-50 text-neutral-600 border-neutral-200'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>{maintenanceCount} In Maintenance</span>
          </span>

          {maintenanceCount > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 rounded text-xs font-medium transition-colors cursor-pointer"
              title="Turn off maintenance on all pages"
            >
              <Power className="w-3 h-3 text-red-600" />
              <span>Restore All</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom Maintenance Message Editor */}
      <div className="p-4 bg-amber-50/40 border-b border-[#edebe9] text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <label className="font-semibold text-neutral-800 flex items-center gap-1.5 text-[11px]">
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              Global Notice Displayed to Users on Maintenance Pages:
            </label>
            <input
              type="text"
              value={customMsg}
              onChange={e => setCustomMsg(e.target.value)}
              placeholder="e.g. This page is currently undergoing scheduled updates and will return shortly."
              className="w-full p-2 border border-neutral-300 rounded-xs bg-white text-xs text-neutral-800 focus:border-[#0d9488] outline-hidden shadow-2xs"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveMessage}
            className="mt-5 px-3 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white font-medium text-xs rounded-xs transition-colors shrink-0 shadow-2xs cursor-pointer"
          >
            {msgSaved ? 'Notice Saved!' : 'Save Notice'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-[#faf9f8] border-b border-[#edebe9] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search pages by name or module..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-[#d1d1d1] rounded-xs bg-white text-xs text-neutral-800 focus:border-[#0d9488] outline-hidden shadow-2xs"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat 
                  ? 'bg-[#0d9488] text-white shadow-2xs' 
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-neutral-200 text-[11px]">
          {(['All', 'Maintenance', 'Live'] as const).map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                statusFilter === st 
                  ? 'bg-neutral-800 text-white shadow-2xs' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Pages — compact list */}
      <div className="overflow-y-auto max-h-[520px]">
        {filteredPages.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-xs">
            No pages match the selected filters.
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f3f2f1] border-b border-[#e1dfdd] sticky top-0">
                <th className="text-left px-3 py-2 font-semibold text-neutral-600 w-[38%]">Page</th>
                <th className="text-left px-3 py-2 font-semibold text-neutral-600 w-[26%]">Category</th>
                <th className="text-center px-3 py-2 font-semibold text-neutral-600 w-[16%]">Status</th>
                <th className="text-right px-3 py-2 font-semibold text-neutral-600 w-[20%]">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPages.map((page, i) => {
                const inMaintenance = Boolean(maintenanceMap[page.id]);
                return (
                  <tr
                    key={page.id}
                    className={`border-b border-[#edebe9] transition-colors ${
                      inMaintenance
                        ? 'bg-amber-50/50'
                        : i % 2 === 0 ? 'bg-white' : 'bg-[#faf9f8]'
                    } hover:bg-[#f0efeb]`}
                  >
                    <td className="px-3 py-2">
                      <span className="font-medium text-neutral-900 truncate block max-w-[220px]" title={page.title}>
                        {page.title}
                      </span>
                      <code className="text-[10px] text-neutral-400 font-mono">#{page.id}</code>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded border border-neutral-200">
                        {page.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        inMaintenance
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {inMaintenance ? '⚠ Maintenance' : '● Live'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggle(page.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          inMaintenance
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                        }`}
                      >
                        <Power className="w-3 h-3 shrink-0" />
                        {inMaintenance ? 'Go Live' : 'Maintenance'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
