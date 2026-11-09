import React from 'react';
import { IconArrowUpRight as ArrowUpRight, IconAlarm as Siren } from '@tabler/icons-react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_ROW_LIMIT } from '../../config/dashboardWidgets';

/**
 * Small list/count widgets built from data the app has already loaded for the signed-in
 * user (same site scope and row-level security as the owning page).
 */

type State = 'loading' | 'error' | 'ready';

/** Loading / error state for a widget, from the app's live-data sync status. */
export function useWidgetState(moduleLabel?: string): State {
  const { liveDataStatus } = useApp();
  if (moduleLabel && liveDataStatus.unavailable.includes(moduleLabel)) return 'error';
  if (liveDataStatus.state === 'loading' || liveDataStatus.state === 'idle') return 'loading';
  return 'ready';
}

interface FrameProps {
  title: string;
  state?: State;
  onOpen?: () => void;
  openLabel?: string;
  empty?: string | null;
  children?: React.ReactNode;
}

/** Common widget shell: title, optional link to the owning page, and consistent loading / error / empty states. */
export const WidgetShell: React.FC<FrameProps> = ({ title, state = 'ready', onOpen, openLabel = 'Open', empty, children }) => (
  <section className="bg-white border border-[#e1dfdd] rounded-xs shadow-xs h-full flex flex-col">
    <header className="px-4 py-3 border-b border-[#e1dfdd] flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-[#242424]">{title}</h3>
      {onOpen && (
        <button type="button" onClick={onOpen} className="text-xs text-[#0d9488] hover:underline inline-flex items-center gap-1 shrink-0">
          {openLabel}<ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </header>
    <div className="p-4 text-xs flex-1">
      {state === 'loading' ? (
        <p className="text-[#605e5c]" aria-busy="true">Loading…</p>
      ) : state === 'error' ? (
        <p className="text-[#a4262c]">Could not load this data.</p>
      ) : empty ? (
        <p className="text-[#605e5c]">{empty}</p>
      ) : children}
    </div>
  </section>
);

const CountRow: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone = 'text-[#242424]' }) => (
  <li className="flex items-center justify-between py-1.5">
    <span className="text-[#323130]">{label}</span>
    <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
  </li>
);

export const MaintenanceOpenWidget: React.FC<{ onNavigate: (p: string) => void }> = ({ onNavigate }) => {
  const { maintenanceRecords, isSitePermitted } = useApp();
  const state = useWidgetState('Maintenance Tracker');
  const open = maintenanceRecords.filter(r => r.defectStatus === 'In Process' && isSitePermitted(r.site, 'all'));
  const priorities = ['CAT 1', 'CAT 2 - Interim', 'CAT 2', 'CAT 3'] as const;
  return (
    <WidgetShell title="Open maintenance" state={state} onOpen={() => onNavigate('maintenance')} openLabel="Maintenance tracker" empty={open.length === 0 ? 'No defects in process.' : null}>
      <p className="text-2xl font-semibold text-[#242424]">{open.length}</p>
      <p className="text-[#605e5c] mb-2">Defects in process</p>
      <ul className="divide-y divide-[#edebe9]">
        {priorities.map(p => (
          <CountRow key={p} label={p} value={open.filter(r => r.priority === p).length} tone={p === 'CAT 1' && open.some(r => r.priority === p) ? 'text-[#a4262c]' : undefined} />
        ))}
      </ul>
    </WidgetShell>
  );
};

export const ComplianceStatusWidget: React.FC<{ onNavigate: (p: string) => void }> = ({ onNavigate }) => {
  const { complianceRecords, isSitePermitted } = useApp();
  const state = useWidgetState('SD-Compliance');
  const rows = complianceRecords.filter(r => isSitePermitted(r.siteName, 'all'));
  const statuses = ['Overdue', 'Expired', 'Expiring Soon', 'In Progress', 'Compliant'] as const;
  const alert = new Set(['Overdue', 'Expired']);
  return (
    <WidgetShell title="Compliance status" state={state} onOpen={() => onNavigate('compliance')} openLabel="Compliance" empty={rows.length === 0 ? 'No compliance records.' : null}>
      <ul className="divide-y divide-[#edebe9]">
        {statuses.map(s => {
          const n = rows.filter(r => r.status === s).length;
          return <CountRow key={s} label={s} value={n} tone={alert.has(s) && n > 0 ? 'text-[#a4262c]' : undefined} />;
        })}
      </ul>
    </WidgetShell>
  );
};

const BILL_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  verification_pending: 'Verification pending',
  query_raised: 'Query raised',
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const FinanceBillsWidget: React.FC<{ onNavigate: (p: string) => void }> = ({ onNavigate }) => {
  const { financeBills, isSitePermitted } = useApp();
  const state = useWidgetState();
  const bills = financeBills.filter(b => b.status !== 'draft' && isSitePermitted(b.siteName, 'all'));
  const shown = Object.keys(BILL_STATUS_LABELS).filter(k => bills.some(b => b.status === k));
  return (
    <WidgetShell title="Finance bills by status" state={state} onOpen={() => onNavigate('finance')} openLabel="Finance" empty={bills.length === 0 ? 'No bills.' : null}>
      <ul className="divide-y divide-[#edebe9]">
        {shown.map(k => <CountRow key={k} label={BILL_STATUS_LABELS[k]} value={bills.filter(b => b.status === k).length} />)}
      </ul>
    </WidgetShell>
  );
};

export const MyRequestsWidget: React.FC<{ onNavigate: (p: string) => void; limit?: number }> = ({ onNavigate, limit = DEFAULT_ROW_LIMIT }) => {
  const { dataChangeRequests, currentUserName } = useApp();
  const state = useWidgetState('Requests & Approvals');
  const mine = dataChangeRequests.filter(r => r.requestedBy === currentUserName);
  return (
    <WidgetShell title="My change requests" state={state} onOpen={() => onNavigate('requests')} openLabel="Requests" empty={mine.length === 0 ? 'You have not submitted any requests.' : null}>
      <ul className="divide-y divide-[#edebe9]">
        {mine.slice(0, limit).map(r => (
          <li key={r.id} className="py-1.5 flex items-center justify-between gap-2">
            <span className="truncate text-[#323130]">{r.recordTitle || r.id}</span>
            <span className={`shrink-0 font-semibold ${r.status === 'Rejected' ? 'text-[#a4262c]' : r.status === 'Approved' ? 'text-[#107c10]' : 'text-[#7f6000]'}`}>{r.status}</span>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
};

export const RecentNotificationsWidget: React.FC<{ onNavigate: (p: string) => void; limit?: number }> = ({ onNavigate, limit = DEFAULT_ROW_LIMIT }) => {
  const { notifications } = useApp();
  const state = useWidgetState();
  return (
    <WidgetShell title="Recent notifications" state={state} empty={notifications.length === 0 ? 'No notifications.' : null}>
      <ul className="divide-y divide-[#edebe9]">
        {notifications.slice(0, limit).map(n => (
          <li key={n.id} className="py-1.5">
            <button type="button" disabled={!n.linkPage} onClick={() => n.linkPage && onNavigate(n.linkPage)} className="text-left w-full disabled:cursor-default">
              <span className={`block truncate ${n.read ? 'text-[#605e5c]' : 'font-semibold text-[#242424]'}`}>{n.title}</span>
              <span className="block text-[11px] text-[#605e5c]">{n.time}</span>
            </button>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
};

const QUICK_ACTIONS: Array<{ page: string; label: string }> = [
  { page: 'referrals', label: 'New SG referral' },
  { page: 'vulnerable', label: 'Log vulnerability assessment' },
  { page: 'challenging', label: 'Log challenging behaviour incident' },
  { page: 'laundry', label: 'Record laundry wash intake' },
  { page: 'food', label: 'Log hot food temperature check' },
];

export const QuickActionsWidget: React.FC<{ onNavigate: (p: string) => void; onQuickIncident: () => void }> = ({ onNavigate, onQuickIncident }) => {
  const { canAccessPage } = useApp();
  const actions = QUICK_ACTIONS.filter(a => canAccessPage(a.page));
  const canIncident = canAccessPage('escalations');
  const rowClass = 'w-full text-left py-2 flex items-center justify-between text-[#323130] hover:text-[#0d9488]';
  return (
    <WidgetShell title="Quick actions" empty={actions.length === 0 && !canIncident ? 'No actions available for your access.' : null}>
      <ul className="divide-y divide-[#edebe9]">
        {canIncident && (
          <li>
            <button type="button" onClick={onQuickIncident} className={`${rowClass} font-semibold text-[#a4262c] hover:text-[#a4262c]`}>
              <span className="flex items-center gap-2"><Siren className="w-3.5 h-3.5" />Quick incident log</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </li>
        )}
        {actions.map(a => (
          <li key={a.page}>
            <button type="button" onClick={() => onNavigate(a.page)} className={rowClass}>
              <span>{a.label}</span><ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
};
