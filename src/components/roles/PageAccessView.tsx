import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconKey as KeyRound, IconSearch as Search, IconDeviceFloppy as Save, IconRotate as RotateCcw, IconShieldCheck as ShieldCheck, IconShieldExclamation as ShieldAlert, IconCopy as Copy, IconChecks as CheckCheck, IconBan as Ban, IconHistory as History, IconLock as Lock, IconUsers as Users2, IconX as X } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { APP_PAGES_REGISTRY } from '../../config/pageRegistry';
import {
  actionsForPage, ALL_PAGE_ACTIONS, PAGE_ACTION_LABELS, sanitizePermissions,
  type PageAction, type UserPagePermissions,
} from '../../config/pagePermissionsConfig';
import { pageAccessService, type PageAccessAuditEntry, type PageAccessUser } from '../../services/pageAccessService';

const CATEGORIES = Array.from(new Set(APP_PAGES_REGISTRY.map(p => p.category)));

const fullAccess = (): UserPagePermissions => {
  const out: UserPagePermissions = {};
  for (const p of APP_PAGES_REGISTRY) {
    out[p.id] = Object.fromEntries(actionsForPage(p.id).map(a => [a, true]));
  }
  return out;
};
const noAccess = (): UserPagePermissions => {
  const out: UserPagePermissions = {};
  for (const p of APP_PAGES_REGISTRY) out[p.id] = Object.fromEntries(ALL_PAGE_ACTIONS.map(a => [a, false]));
  return out;
};
const same = (a: UserPagePermissions | null, b: UserPagePermissions | null) => JSON.stringify(a) === JSON.stringify(b);

function summarize(perms: UserPagePermissions | null | undefined): string {
  if (!perms || Object.keys(perms).length === 0) return 'Role defaults';
  const pages = Object.values(perms).filter(p => p.view).length;
  return `${pages} page${pages === 1 ? '' : 's'}`;
}

export const PageAccessView: React.FC = () => {
  const { currentUserRole, authProfile, refreshPagePermissions } = useApp();
  const isSuperAdmin = authProfile?.role === 'Super Admin' || (!authProfile && currentUserRole === 'Super Admin');

  const [users, setUsers] = useState<PageAccessUser[]>([]);
  const [installed, setInstalled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [original, setOriginal] = useState<UserPagePermissions | null>(null);
  const [draft, setDraft] = useState<UserPagePermissions | null>(null);
  const [pageSearch, setPageSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<PageAccessAuditEntry[]>([]);
  const [copySource, setCopySource] = useState('');

  const selected = users.find(u => u.id === selectedId) || null;
  const isSelf = !!selected && selected.id === authProfile?.id;
  const locked = !selected || selected.role === 'Super Admin' || isSelf;
  const dirty = !same(original, draft);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await pageAccessService.listUsers();
      setUsers(res.users);
      setInstalled(res.installed);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Could not load users.' });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (isSuperAdmin) loadUsers(); }, [isSuperAdmin, loadUsers]);

  const loadAudit = useCallback(async (userId?: string) => {
    try { setAudit(await pageAccessService.fetchAudit(userId)); } catch { setAudit([]); }
  }, []);

  const selectUser = async (id: string) => {
    setSelectedId(id);
    setNotice(null);
    setCopySource('');
    try {
      const perms = await pageAccessService.getUser(id);
      setOriginal(perms);
      setDraft(perms);
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'Could not load permissions.' });
    }
    if (showAudit) loadAudit(id);
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => !q || [u.name, u.email, u.role].some(v => (v || '').toLowerCase().includes(q)));
  }, [users, search]);

  const visiblePages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    return APP_PAGES_REGISTRY.filter(p => !q || p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [pageSearch]);

  const setAction = (pageId: string, action: PageAction, value: boolean) => {
    if (locked) return;
    setDraft(prev => {
      const base = prev ? { ...prev } : fullAccess();
      const row = { ...(base[pageId] || {}) };
      row[action] = value;
      if (action === 'view' && !value) for (const a of ALL_PAGE_ACTIONS) row[a] = false;
      if (action !== 'view' && value) row.view = true;
      base[pageId] = row;
      return base;
    });
  };
  const setPageAll = (pageId: string, value: boolean) => {
    if (locked) return;
    setDraft(prev => {
      const base = prev ? { ...prev } : fullAccess();
      base[pageId] = Object.fromEntries(ALL_PAGE_ACTIONS.map(a => [a, value && actionsForPage(pageId).includes(a)]));
      return base;
    });
  };

  const run = async (fn: () => Promise<void>, okText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setNotice({ kind: 'ok', text: okText });
      await loadUsers();
      if (selectedId) {
        const perms = await pageAccessService.getUser(selectedId);
        setOriginal(perms);
        setDraft(perms);
        if (showAudit) loadAudit(selectedId);
      }
      refreshPagePermissions();
    } catch (e: any) {
      setNotice({ kind: 'err', text: e?.message || 'The change was refused.' });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!selected || locked || draft === null) return;
    const clean = sanitizePermissions(draft);
    run(() => pageAccessService.save(selected.id, clean, 'UPDATE'), `Permissions saved for ${selected.name}.`);
  };
  const resetToRole = () => {
    if (!selected || locked) return;
    run(() => pageAccessService.save(selected.id, null, 'RESET'), `${selected.name} now uses role defaults (${selected.role}).`);
  };
  const copyPermissions = () => {
    if (!selected || locked || !copySource) return;
    run(() => pageAccessService.copyFrom(selected.id, copySource), `Permissions copied to ${selected.name}.`);
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-sm text-[#605e5c] flex items-center gap-2">
        <Lock className="w-4 h-4" /> Only a Super Admin can manage page access.
      </div>
    );
  }

  const custom = draft !== null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#242424] flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#0d9488]" /> Page Access Management
          </h1>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Restrict which pages and actions an individual user can use. Overrides only narrow a user's role; they never grant more than the role allows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { const next = !showAudit; setShowAudit(next); if (next) loadAudit(selectedId || undefined); }}
          className="px-3 py-1.5 bg-white border border-[#8a8886] text-[#323130] hover:bg-[#f3f2f1] text-xs font-semibold rounded-xs flex items-center gap-1.5"
        >
          <History className="w-3.5 h-3.5" /> {showAudit ? 'Hide' : 'Show'} change history
        </button>
      </div>

      {!installed && (
        <div className="p-3 bg-[#fff8ed] border border-[#fedbb0] text-[#8a3700] rounded-xs text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Page access tables are not installed. Run <code className="font-mono">db/migrations/026_page_access_management.sql</code> in the Supabase SQL Editor.
        </div>
      )}
      {notice && (
        <div className={`p-3 border rounded-xs text-xs flex items-center justify-between gap-2 ${notice.kind === 'ok' ? 'bg-[#f1faf0] border-[#cbe8cb] text-[#107c10]' : 'bg-red-50 border-red-200 text-red-800'}`} role="status">
          <span className="flex items-center gap-2">
            {notice.kind === 'ok' ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {notice.text}
          </span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* User list */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs">
          <div className="p-2.5 border-b border-[#edebe9]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8a8886] absolute left-2 top-2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users…"
                aria-label="Search users"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488]"
              />
            </div>
          </div>
          <div className="max-h-[560px] overflow-y-auto divide-y divide-[#f3f2f1]">
            {loading && <div className="p-4 text-xs text-[#605e5c]">Loading users…</div>}
            {!loading && filteredUsers.length === 0 && <div className="p-4 text-xs text-[#605e5c]">No users found.</div>}
            {filteredUsers.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectUser(u.id)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${u.id === selectedId ? 'bg-[#f0fdfa]' : 'hover:bg-[#faf9f8]'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#242424] truncate">{u.name || u.email}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${u.restricted ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>
                    {u.restricted ? 'Custom' : 'Role'}
                  </span>
                </div>
                <div className="text-[11px] text-[#605e5c] truncate">{u.email}</div>
                <div className="text-[10px] text-[#0f766e] mt-0.5">{u.role}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white border border-[#e1dfdd] rounded-xs">
          {!selected ? (
            <div className="p-10 text-center text-xs text-[#605e5c] flex flex-col items-center gap-2">
              <Users2 className="w-8 h-8 text-[#c8c6c4]" />
              Select a user to manage their page access.
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-[#edebe9] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[#242424]">{selected.name}</div>
                  <div className="text-[11px] text-[#605e5c]">
                    {selected.email} · Role: <strong className="text-[#0f766e]">{selected.role}</strong> · Access: <strong>{summarize(original)}</strong>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={locked || busy} onClick={() => setDraft(fullAccess())}
                    className="px-2.5 py-1.5 bg-white border border-[#8a8886] text-xs font-semibold rounded-xs flex items-center gap-1 disabled:opacity-50">
                    <CheckCheck className="w-3.5 h-3.5" /> Select All
                  </button>
                  <button type="button" disabled={locked || busy} onClick={() => setDraft(noAccess())}
                    className="px-2.5 py-1.5 bg-white border border-[#d83b01] text-[#d83b01] text-xs font-semibold rounded-xs flex items-center gap-1 disabled:opacity-50">
                    <Ban className="w-3.5 h-3.5" /> Revoke All
                  </button>
                  <button type="button" disabled={locked || busy} onClick={resetToRole}
                    className="px-2.5 py-1.5 bg-white border border-[#8a8886] text-xs font-semibold rounded-xs flex items-center gap-1 disabled:opacity-50">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset to role defaults
                  </button>
                </div>
              </div>

              {locked && (
                <div className="m-3 p-2.5 bg-neutral-50 border border-[#e1dfdd] rounded-xs text-xs text-[#605e5c] flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  {isSelf ? 'You cannot change your own page access.' : 'Super Admin access cannot be restricted.'}
                </div>
              )}

              {!locked && !custom && (
                <div className="m-3 p-2.5 bg-[#f0fdfa] border border-[#99f6e4] rounded-xs text-xs text-[#0f766e] flex items-center justify-between gap-2">
                  <span>This user follows their <strong>{selected.role}</strong> role defaults (no restrictions).</span>
                  <button type="button" onClick={() => setDraft(fullAccess())} className="px-2.5 py-1 bg-[#0d9488] text-white rounded-xs font-semibold">
                    Customize access
                  </button>
                </div>
              )}

              {!locked && (
                <div className="px-3 pt-3 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8a8886] absolute left-2 top-2" />
                    <input value={pageSearch} onChange={e => setPageSearch(e.target.value)} placeholder="Filter pages…" aria-label="Filter pages"
                      className="pl-7 pr-2 py-1.5 text-xs border border-[#8a8886] rounded-xs focus:outline-none focus:border-[#0d9488] w-52" />
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Copy className="w-3.5 h-3.5 text-[#605e5c]" />
                    <select value={copySource} onChange={e => setCopySource(e.target.value)} aria-label="Copy permissions from user"
                      className="text-xs border border-[#8a8886] rounded-xs py-1.5 px-2 bg-white max-w-[200px]">
                      <option value="">Copy permissions from…</option>
                      {users.filter(u => u.id !== selected.id).map(u => <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>)}
                    </select>
                    <button type="button" disabled={!copySource || busy} onClick={copyPermissions}
                      className="px-2.5 py-1.5 bg-white border border-[#8a8886] text-xs font-semibold rounded-xs disabled:opacity-50">Apply</button>
                  </div>
                </div>
              )}

              {custom && !locked && (
                <div className="p-3 overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-left text-[#605e5c] border-b border-[#e1dfdd]">
                        <th className="py-1.5 pr-2 font-semibold">Page</th>
                        {ALL_PAGE_ACTIONS.map(a => <th key={a} className="py-1.5 px-2 font-semibold text-center">{PAGE_ACTION_LABELS[a]}</th>)}
                        <th className="py-1.5 pl-2 font-semibold text-center">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CATEGORIES.map(cat => {
                        const rows = visiblePages.filter(p => p.category === cat);
                        if (rows.length === 0) return null;
                        return (
                          <React.Fragment key={cat}>
                            <tr><td colSpan={ALL_PAGE_ACTIONS.length + 2} className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8c8c8c]">{cat}</td></tr>
                            {rows.map(p => {
                              const relevant = actionsForPage(p.id);
                              const row = draft![p.id] || {};
                              const allOn = relevant.every(a => row[a]);
                              return (
                                <tr key={p.id} className="border-b border-[#f3f2f1] hover:bg-[#faf9f8]">
                                  <td className="py-1.5 pr-2">
                                    <div className="font-medium text-[#242424]">{p.title}</div>
                                  </td>
                                  {ALL_PAGE_ACTIONS.map(a => (
                                    <td key={a} className="py-1.5 px-2 text-center">
                                      {relevant.includes(a) ? (
                                        <input type="checkbox" checked={row[a] === true} disabled={busy}
                                          aria-label={`${PAGE_ACTION_LABELS[a]} ${p.title}`}
                                          onChange={e => setAction(p.id, a, e.target.checked)}
                                          className="accent-[#0d9488] w-3.5 h-3.5 cursor-pointer" />
                                      ) : <span className="text-[#c8c6c4]">–</span>}
                                    </td>
                                  ))}
                                  <td className="py-1.5 pl-2 text-center">
                                    <input type="checkbox" checked={allOn} disabled={busy}
                                      aria-label={`All actions ${p.title}`}
                                      onChange={e => setPageAll(p.id, e.target.checked)}
                                      className="accent-[#0d9488] w-3.5 h-3.5 cursor-pointer" />
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!locked && (
                <div className="p-3 border-t border-[#edebe9] flex items-center justify-end gap-2">
                  <button type="button" disabled={!dirty || busy} onClick={() => { setDraft(original); setNotice(null); }}
                    className="px-3 py-1.5 bg-white border border-[#8a8886] text-xs font-semibold rounded-xs disabled:opacity-50">Cancel</button>
                  <button type="button" disabled={!dirty || busy || draft === null} onClick={save}
                    className="px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs flex items-center gap-1.5 disabled:opacity-50">
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAudit && (
        <div className="bg-white border border-[#e1dfdd] rounded-xs">
          <div className="p-3 border-b border-[#edebe9] text-xs font-semibold text-[#323130] flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#0d9488]" /> Permission change history {selected ? `· ${selected.name}` : '· all users'}
          </div>
          {audit.length === 0 ? (
            <div className="p-4 text-xs text-[#605e5c]">No changes recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-[#605e5c] border-b border-[#e1dfdd]">
                  <th className="p-2">When</th><th className="p-2">Changed by</th><th className="p-2">User</th><th className="p-2">Action</th><th className="p-2">Before</th><th className="p-2">After</th>
                </tr></thead>
                <tbody>
                  {audit.map(a => (
                    <tr key={a.id} className="border-b border-[#f3f2f1]">
                      <td className="p-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="p-2">{a.actorName}</td>
                      <td className="p-2">{a.targetUserName}</td>
                      <td className="p-2">{a.action}</td>
                      <td className="p-2">{summarize(a.previous)}</td>
                      <td className="p-2">{summarize(a.newPermissions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
