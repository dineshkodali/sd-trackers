import React from 'react';
import type { MaintenanceRecord, RecordAttachment } from '../../types';
import { closingTimer, overdueDuration, isMaintenanceClosed } from '../../utils/maintenancePriority';

/** Compact table cells for the Maintenance Tracker. Static text and tags only. */

export const ClosingTimerCell: React.FC<{ record: MaintenanceRecord }> = ({ record }) => {
  const t = closingTimer(record, new Date());
  if (t.kind === 'unknown') return <span className="text-neutral-400">—</span>;
  if (t.kind === 'closed-no-time') return <span className="text-[11px] text-neutral-500" title="This job was closed without a closing time">Closed, time not recorded</span>;
  if (t.kind === 'closed') {
    return <span className="text-[11px] font-semibold text-neutral-800 tabular-nums" title="Time from report to closure">{t.label}</span>;
  }
  // Still open: elapsed time so far, labelled so it is not mistaken for a final duration
  return <span className="text-[11px] text-neutral-600 tabular-nums" title="Time since the job was reported (still open)">{t.label}</span>;
};

export const OverdueDurationCell: React.FC<{ record: MaintenanceRecord }> = ({ record }) => {
  const o = overdueDuration(record, new Date());
  if (o.kind === 'none') return <span className="text-neutral-400">—</span>;
  const cls = o.kind === 'overdue' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-neutral-200 text-neutral-700 border-neutral-300';
  return <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-xs border whitespace-nowrap tabular-nums ${cls}`}>{o.kind === 'overdue' ? 'SLA BREACH · ' : 'LATE · '}{o.label.replace(/^(Overdue|Late) by /, '')}</span>;
};

export const EvidenceCountCell: React.FC<{ images?: RecordAttachment[]; side: 'before' | 'after'; record: MaintenanceRecord }> = ({ images, side, record }) => {
  const n = Array.isArray(images) ? images.length : 0;
  if (n > 0) return <span className="text-[11px] font-medium text-[#0f766e]">{n} {n === 1 ? 'picture' : 'pictures'}</span>;
  if (side === 'after' && isMaintenanceClosed(record)) {
    return <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-xs border bg-amber-50 text-amber-800 border-amber-200 whitespace-nowrap">No after picture</span>;
  }
  return <span className="text-neutral-400">—</span>;
};
