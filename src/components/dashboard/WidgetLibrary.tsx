import React, { useEffect, useMemo, useState } from 'react';
import { IconPlus as Plus, IconSearch as Search, IconX as X } from '@tabler/icons-react';
import { WIDGET_CATEGORIES, WIDGET_DEFINITIONS, isWidgetAvailable, type WidgetCategory } from '../../config/dashboardWidgets';
import { widgetIcon } from './widgetIcons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (type: string) => void;
  /** Widget types already on the dashboard. */
  added: Set<string>;
  /** The app's existing page-view check. Widgets needing a page the user cannot view are not listed. */
  canViewPage: (pageId: string) => boolean;
}

export const WidgetLibrary: React.FC<Props> = ({ isOpen, onClose, onAdd, added, canViewPage }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WidgetCategory | 'all'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const available = useMemo(() => WIDGET_DEFINITIONS.filter(d => isWidgetAvailable(d, canViewPage)), [canViewPage]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter(d =>
      (category === 'all' || d.category === category) &&
      (!q || d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)));
  }, [available, query, category]);
  const categories = WIDGET_CATEGORIES.filter(c => available.some(d => d.category === c));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-label="Widget library" className="w-full max-w-md h-full bg-white border-l border-[#e1dfdd] shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e1dfdd]">
          <h2 className="text-sm font-semibold text-[#242424]">Add widget</h2>
          <button type="button" onClick={onClose} aria-label="Close widget library" className="p-1 text-[#605e5c] hover:text-[#242424]"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-[#e1dfdd]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#605e5c] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search widgets"
              aria-label="Search widgets"
              className="w-full pl-8 pr-2.5 py-2 text-xs border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as WidgetCategory | 'all')}
            aria-label="Filter by category"
            className="w-full px-2.5 py-2 text-xs border border-[#8a8886] rounded-xs bg-white focus:outline-none focus:border-[#0d9488]"
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          {visible.length === 0 ? (
            <p className="text-xs text-[#605e5c] py-6 text-center">
              {available.length === 0 ? 'No widgets are available for your access.' : 'No widgets match your search.'}
            </p>
          ) : (
            categories.filter(c => visible.some(d => d.category === c)).map(c => (
              <section key={c} className="mb-4 last:mb-0">
                <h3 className="text-xs font-semibold text-[#605e5c] mb-1">{c}</h3>
                <ul className="divide-y divide-[#edebe9]">
                  {visible.filter(d => d.category === c).map(d => {
                    const Icon = widgetIcon(d.icon);
                    const isAdded = added.has(d.type);
                    return (
                      <li key={d.type} className="flex items-center gap-3 py-2.5">
                        <Icon className="w-4 h-4 text-[#0d9488] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#242424]">{d.title}</p>
                          <p className="text-[11px] text-[#605e5c]">{d.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => onAdd(d.type)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xs border border-[#8a8886] bg-white text-[#323130] hover:bg-[#edebe9] disabled:opacity-50 disabled:cursor-default"
                        >
                          {!isAdded && <Plus className="w-3 h-3" />}
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};
