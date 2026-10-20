import React from 'react';
import type { ServiceUserRecordSet } from '../../utils/serviceUserRecords';

const fmtDate = (d?: string) => {
  if (!d) return '—';
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString('en-GB');
};

interface Column<T> { label: string; render: (row: T) => React.ReactNode }

function RecordTable<T extends { id: string }>({ title, rows, columns, empty }: {
  title: string; rows: T[]; columns: Column<T>[]; empty: string;
}) {
  return (
    <div className="space-y-3">
      <h4 className="font-bold text-xs text-neutral-800">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-neutral-400 italic">{empty}</p>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-[10px] font-bold text-neutral-500 uppercase">
              <tr>{columns.map(c => <th key={c.label} className="p-2.5 whitespace-nowrap">{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-neutral-50 align-top">
                  {columns.map(c => <td key={c.label} className="p-2.5">{c.render(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-xs font-semibold whitespace-nowrap">{children || '—'}</span>
);

export const SUIncidentsTab: React.FC<{ rows: ServiceUserRecordSet['incidents'] }> = ({ rows }) => (
  <RecordTable
    title="Incident Reports"
    rows={rows}
    empty="No incident reports recorded for this resident."
    columns={[
      { label: 'Date', render: r => fmtDate(r.date) },
      { label: 'Type', render: r => <Pill>{r.source === 'IR' ? 'IR Tracker' : 'Challenging Behaviour'}</Pill> },
      { label: 'Site', render: r => r.site || '—' },
      { label: 'Summary', render: r => <span className="text-neutral-700">{r.summary || '—'}</span> },
      { label: 'Status', render: r => <Pill>{r.status}</Pill> }
    ]}
  />
);

export const SUReferralsTab: React.FC<{ rows: ServiceUserRecordSet['referrals'] }> = ({ rows }) => (
  <RecordTable
    title="SG Referrals"
    rows={rows}
    empty="No SG referrals recorded for this resident."
    columns={[
      { label: 'Date Referred', render: r => fmtDate(r.dateReferred) },
      { label: 'Type', render: r => r.referralType || '—' },
      { label: 'Council', render: r => r.referralCouncil || '—' },
      { label: 'Urgency', render: r => <Pill>{r.urgency}</Pill> },
      { label: 'LA Response', render: r => r.responseReceivedFromLA || '—' },
      { label: 'Status', render: r => <Pill>{String(r.status)}</Pill> },
      { label: 'Notes', render: r => <span className="text-neutral-600">{r.notesActionTaken || '—'}</span> }
    ]}
  />
);

export const SUGpTab: React.FC<{ rows: ServiceUserRecordSet['gp'] }> = ({ rows }) => (
  <RecordTable
    title="GP Appointments"
    rows={rows}
    empty="No GP appointments recorded for this resident."
    columns={[
      { label: 'Appointment', render: r => `${fmtDate(r.appointmentDate)}${r.timeOfGp ? ' ' + r.timeOfGp : ''}` },
      { label: 'Referral Sent', render: r => fmtDate(r.referralSentOn) },
      { label: 'Site / Room', render: r => `${r.siteName || '—'}${r.roomNo ? ' (Room ' + r.roomNo + ')' : ''}` },
      { label: 'Status', render: r => <Pill>{r.status}</Pill> },
      { label: 'Comments', render: r => <span className="text-neutral-600">{r.comments || '—'}</span> }
    ]}
  />
);

export const SUTransportTab: React.FC<{ rows: ServiceUserRecordSet['transport'] }> = ({ rows }) => (
  <RecordTable
    title="Public Transport"
    rows={rows}
    empty="No public transport requests recorded for this resident."
    columns={[
      { label: 'Date', render: r => `${fmtDate(r.appointmentDate)}${r.appointmentTime ? ' ' + r.appointmentTime : ''}` },
      { label: 'Approval URN', render: r => r.approvalUrn || '—' },
      { label: 'Destination', render: r => r.appointmentLocation || '—' },
      { label: 'Mode', render: r => r.modeOfTransport || '—' },
      { label: 'Miles', render: r => String(r.distanceMiles ?? '—') },
      { label: 'Status', render: r => <Pill>{r.status || 'Pending'}</Pill> }
    ]}
  />
);

export const SUOtherWelfareTable: React.FC<{ rows: ServiceUserRecordSet['otherWelfare'] }> = ({ rows }) => (
  <RecordTable
    title="RFA & MH-Complaint Welfare Checks"
    rows={rows}
    empty="No RFA or MH-complaint welfare checks recorded for this resident."
    columns={[
      { label: 'Date', render: r => fmtDate(r.date) },
      { label: 'Type', render: r => <Pill>{r.source}</Pill> },
      { label: 'Site / Room', render: r => `${r.site || '—'}${r.room ? ' (Room ' + r.room + ')' : ''}` },
      { label: 'Details', render: r => <span className="text-neutral-600">{r.detail || '—'}</span> },
      { label: 'Status', render: r => <Pill>{r.status}</Pill> }
    ]}
  />
);
