import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dashboardService, type DashboardStorage } from '../services/dashboardService';
import {
  BUILT_IN_DASHBOARD_ID,
  MAX_DASHBOARDS_PER_USER,
  buildDefaultLayout,
  cleanDashboardName,
  getWidgetDefinition,
  moveItem,
  newWidgetId,
  sanitizeLayout,
  type DashboardLayout,
  type DashboardRecord,
  type WidgetSize,
} from '../config/dashboardWidgets';

const activeKey = (uid: string) => `sd_active_dashboard_${uid}`;

function uniqueName(base: string, taken: string[]): string {
  const lower = new Set(taken.map(n => n.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base} ${i}`.slice(0, 60);
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return base;
}

/**
 * State for the signed-in user's dashboards: the built-in default plus any personal ones,
 * and the draft layout while editing. Nothing here widens access - the view still decides
 * per widget whether the user can see it.
 */
export function useDashboards(userId: string | undefined) {
  const uid = userId || 'anonymous';
  const [saved, setSaved] = useState<DashboardRecord[]>([]);
  const [storage, setStorage] = useState<DashboardStorage>('database');
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>(BUILT_IN_DASHBOARD_ID);
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [draftName, setDraftName] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedRef = useRef<DashboardRecord[]>([]);
  savedRef.current = saved;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDraft(null);
    dashboardService.list(uid).then(({ dashboards, storage: s }) => {
      if (cancelled) return;
      setSaved(dashboards);
      setStorage(s);
      let remembered: string | null = null;
      try { remembered = sessionStorage.getItem(activeKey(uid)); } catch { /* blocked */ }
      const pick =
        (remembered && (remembered === BUILT_IN_DASHBOARD_ID || dashboards.some(d => d.id === remembered)) ? remembered : null)
        ?? dashboards.find(d => d.isDefault)?.id
        ?? BUILT_IN_DASHBOARD_ID;
      setActiveId(pick);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError('Could not load your dashboards.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [uid]);

  const builtIn = useMemo<DashboardRecord>(
    () => ({ id: BUILT_IN_DASHBOARD_ID, name: 'Default dashboard', isDefault: !saved.some(d => d.isDefault), layout: buildDefaultLayout() }),
    [saved],
  );
  const all = useMemo(() => [builtIn, ...saved], [builtIn, saved]);
  const active = all.find(d => d.id === activeId) ?? builtIn;
  const isBuiltIn = active.id === BUILT_IN_DASHBOARD_ID;
  const isEditing = draft !== null;
  const layout = draft ?? active.layout;

  const rememberActive = (id: string) => {
    try { sessionStorage.setItem(activeKey(uid), id); } catch { /* blocked */ }
  };

  const select = useCallback((id: string) => {
    setDraft(null);
    setError(null);
    setActiveId(id);
    rememberActive(id);
  }, [uid]);

  const startEdit = useCallback(() => {
    setError(null);
    setDraftName(isBuiltIn ? '' : active.name);
    setDraft(sanitizeLayout(active.layout));
  }, [active, isBuiltIn]);

  const cancelEdit = useCallback(() => { setDraft(null); setError(null); }, []);

  const persist = async (record: DashboardRecord, current: DashboardRecord[]) => {
    const s = await dashboardService.save(uid, record, current);
    setStorage(s);
    const next = current.some(d => d.id === record.id) ? current.map(d => (d.id === record.id ? record : d)) : [...current, record];
    setSaved(next);
    return next;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e: any) { setError(e?.message || 'Something went wrong. Please try again.'); } finally { setBusy(false); }
  };

  const saveEdit = useCallback(() => run(async () => {
    if (!draft) return;
    const layoutToSave = sanitizeLayout(draft);
    if (isBuiltIn) {
      if (savedRef.current.length >= MAX_DASHBOARDS_PER_USER) throw new Error(`You can have up to ${MAX_DASHBOARDS_PER_USER} dashboards.`);
      const record: DashboardRecord = {
        id: dashboardService.newId(),
        name: uniqueName(cleanDashboardName(draftName, 'My dashboard'), savedRef.current.map(d => d.name)),
        isDefault: false,
        layout: layoutToSave,
      };
      await persist(record, savedRef.current);
      setActiveId(record.id);
      rememberActive(record.id);
    } else {
      await persist({ ...active, name: uniqueName(cleanDashboardName(draftName, active.name), savedRef.current.filter(d => d.id !== active.id).map(d => d.name)), layout: layoutToSave }, savedRef.current);
    }
    setDraft(null);
  }), [draft, isBuiltIn, active, draftName, uid]);

  const create = useCallback((name: string) => run(async () => {
    if (savedRef.current.length >= MAX_DASHBOARDS_PER_USER) throw new Error(`You can have up to ${MAX_DASHBOARDS_PER_USER} dashboards.`);
    const record: DashboardRecord = {
      id: dashboardService.newId(),
      name: uniqueName(cleanDashboardName(name), savedRef.current.map(d => d.name)),
      isDefault: false,
      layout: { version: 1, widgets: [] },
    };
    await persist(record, savedRef.current);
    setActiveId(record.id);
    rememberActive(record.id);
    setDraftName(record.name);
    setDraft(record.layout);
  }), [uid]);

  const rename = useCallback((name: string) => run(async () => {
    if (isBuiltIn) return;
    const clean = uniqueName(cleanDashboardName(name), savedRef.current.filter(d => d.id !== active.id).map(d => d.name));
    await persist({ ...active, name: clean }, savedRef.current);
  }), [active, isBuiltIn, uid]);

  const duplicate = useCallback(() => run(async () => {
    if (savedRef.current.length >= MAX_DASHBOARDS_PER_USER) throw new Error(`You can have up to ${MAX_DASHBOARDS_PER_USER} dashboards.`);
    const source = draft ? sanitizeLayout(draft) : active.layout;
    const record: DashboardRecord = {
      id: dashboardService.newId(),
      name: uniqueName(`${active.name} copy`.slice(0, 60), savedRef.current.map(d => d.name)),
      isDefault: false,
      layout: { version: 1, widgets: source.widgets.map(w => ({ ...w, id: newWidgetId(w.type) })) },
    };
    await persist(record, savedRef.current);
    setDraft(null);
    setActiveId(record.id);
    rememberActive(record.id);
  }), [active, draft, uid]);

  const remove = useCallback(() => run(async () => {
    if (isBuiltIn) return;
    const s = await dashboardService.remove(uid, active.id, savedRef.current);
    setStorage(s);
    const next = savedRef.current.filter(d => d.id !== active.id);
    setSaved(next);
    setDraft(null);
    const fallback = next.find(d => d.isDefault)?.id ?? BUILT_IN_DASHBOARD_ID;
    setActiveId(fallback);
    rememberActive(fallback);
  }), [active, isBuiltIn, uid]);

  const setAsDefault = useCallback(() => run(async () => {
    const id = isBuiltIn ? null : active.id;
    const s = await dashboardService.setDefault(uid, id, savedRef.current);
    setStorage(s);
    setSaved(savedRef.current.map(d => ({ ...d, isDefault: d.id === id })));
  }), [active, isBuiltIn, uid]);

  /** Put the draft (or, outside edit mode, the dashboard) back to the built-in layout. */
  const resetLayout = useCallback(() => {
    setError(null);
    if (isBuiltIn && !draft) return;
    if (!draft) setDraftName(active.name);
    setDraft(buildDefaultLayout());
  }, [isBuiltIn, draft, active]);

  const addWidget = useCallback((type: string) => {
    const def = getWidgetDefinition(type);
    if (!def) return;
    setDraft(d => (d ? { ...d, widgets: [...d.widgets, { id: newWidgetId(type), type, size: def.defaultSize }] } : d));
  }, []);
  const removeWidget = useCallback((id: string) => setDraft(d => (d ? { ...d, widgets: d.widgets.filter(w => w.id !== id) } : d)), []);
  const resizeWidget = useCallback((id: string, size: WidgetSize) =>
    setDraft(d => (d ? { ...d, widgets: d.widgets.map(w => (w.id === id ? { ...w, size } : w)) } : d)), []);
  const setWidgetLimit = useCallback((id: string, limit: number) =>
    setDraft(d => (d ? { ...d, widgets: d.widgets.map(w => (w.id === id ? { ...w, config: { ...w.config, limit } } : w)) } : d)), []);
  const moveWidget = useCallback((from: number, to: number) =>
    setDraft(d => (d ? { ...d, widgets: moveItem(d.widgets, from, to) } : d)), []);

  return {
    loading, busy, error, storage,
    dashboards: all, active, isBuiltIn, isEditing, layout, draftName, setDraftName,
    select, startEdit, cancelEdit, saveEdit, create, rename, duplicate, remove, setAsDefault, resetLayout,
    addWidget, removeWidget, resizeWidget, setWidgetLimit, moveWidget,
    canAddDashboard: saved.length < MAX_DASHBOARDS_PER_USER,
  };
}
