import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { suTrackerService, type GpRegistration } from '../../services/suTrackerService';
import { operationsRealtime } from '../../services/operationsRealtime';
import { formatNhsNumber, maskNhsNumber } from '../../utils/nhsNumber';
import type { ServiceUserMaster } from '../../types/masterData';

/**
 * GP registration, pharmacy, NHS number and booking status of one Service User, read from where the New Arrivals form (and
 * the GP Registrations page) save them. The NHS number is masked until someone with access to GP records chooses to show it.
 * Follows the shared live connection: a change to this person's GP registration is picked up without a reload.
 */

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[10px] uppercase tracking-wider font-semibold text-[#605e5c]">{label}</dt>
    <dd className="text-xs text-[#242424] break-words">{children || <span className="text-neutral-400">—</span>}</dd>
  </div>
);

export const SUHealthcareCard: React.FC<{ serviceUser: ServiceUserMaster }> = ({ serviceUser }) => {
  const { canAccessPage, dailyRegisterRecords } = useApp();
  const canSeeGpRecords = canAccessPage('gpAppointments');          // the page that manages gp_registrations
  const [reg, setReg] = useState<GpRegistration | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showNhs, setShowNhs] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!canSeeGpRecords) { setState('ready'); return; }
    const mine = ++seq.current;
    const res = await suTrackerService.getGpRegistrationForSu(serviceUser.id);
    if (mine !== seq.current) return;
    if (!res.success) { setState('error'); return; }
    setReg(res.data); setState('ready');
  }, [serviceUser.id, canSeeGpRecords]);

  useEffect(() => { setShowNhs(false); setState('loading'); void load(); }, [load]);
  useEffect(() => {
    if (!canSeeGpRecords) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = null; void load(); }, 400); };
    const release = operationsRealtime.acquire({
      onChange: c => { if (c.table === 'gp_registrations' && (!c.suId || c.suId === serviceUser.id)) soon(); },
      onResync: soon
    });
    return () => { if (timer) clearTimeout(timer); release(); };
  }, [serviceUser.id, canSeeGpRecords, load]);

  // Booking: the Daily Register entry for this person (matched by Port reference), which is where Available to Book lives.
  const ref = (serviceUser.externalReference || '').trim().toLowerCase();
  const register = ref ? (dailyRegisterRecords || []).filter(r => (r.portRef || '').trim().toLowerCase() === ref && r.occupied !== 'No')
    .sort((a, b) => String(b.checkInDate || '').localeCompare(String(a.checkInDate || '')))[0] : undefined;

  const practice = reg?.gpPractice || serviceUser.gpRegistration || '';
  const registered = Boolean(practice || reg);

  return (
    <section className="bg-white border border-[#e1dfdd] rounded-xs p-3" aria-label="Healthcare and booking">
      <h3 className="text-xs font-semibold text-[#242424] mb-2">GP, pharmacy and booking</h3>
      {state === 'error' && <p role="alert" className="mb-2 text-xs text-red-800">The GP registration could not be loaded.</p>}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Row label="GP registered">{registered ? 'Yes' : 'Not registered'}</Row>
        <Row label="GP">{practice}</Row>
        {canSeeGpRecords && <Row label="Registered pharmacy">{reg?.pharmacy}</Row>}
        {canSeeGpRecords && (
          <Row label="NHS number">
            {reg?.nhsNumber ? (
              <span className="inline-flex items-center gap-2">
                <span className="tabular-nums">{showNhs ? formatNhsNumber(reg.nhsNumber) : maskNhsNumber(reg.nhsNumber)}</span>
                <button type="button" onClick={() => setShowNhs(v => !v)} className="text-[11px] font-semibold text-[#0d9488] hover:underline cursor-pointer">{showNhs ? 'Hide' : 'Show'}</button>
              </span>
            ) : null}
          </Row>
        )}
        <Row label="Available to book">{register ? (register.availableToBook === 'Yes' ? 'Yes' : 'No') : ''}</Row>
      </dl>
      {!canSeeGpRecords && <p className="mt-2 text-[11px] text-[#605e5c]">Pharmacy and NHS number are shown only to staff with access to GP records.</p>}
    </section>
  );
};
