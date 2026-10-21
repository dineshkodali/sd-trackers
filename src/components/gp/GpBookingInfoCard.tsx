import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { suPropertyService } from '../../services/suPropertyService';
import { suTrackerService, type GpRegistration } from '../../services/suTrackerService';
import { canViewNhsNumber, maskNhsNumber, formatUkDate } from '../../utils/suTrackerAccess';
import type { ServiceUserMaster } from '../../types/masterData';

/**
 * Shown in the "Book GP Appointment" form once a Service User is chosen. It reads the resident's current profile
 * and GP registration fresh from the database (never from a cached object) and re-reads whenever the selection
 * changes, so details from the previous resident can never stay on screen. It only displays: booking an
 * appointment never creates or changes a GP registration.
 */
export const GpBookingInfoCard: React.FC<{ suId: string }> = ({ suId }) => {
  const { currentUserRole, setActivePage } = useApp() as any;
  const [state, setState] = useState<{ loading: boolean; error?: string; su?: ServiceUserMaster | null; reg?: GpRegistration | null }>({ loading: false });

  useEffect(() => {
    let alive = true;
    if (!suId) { setState({ loading: false }); return; }
    setState({ loading: true });
    Promise.all([suPropertyService.getServiceUser(suId), suTrackerService.getGpRegistrationForSu(suId)]).then(([su, reg]) => {
      if (!alive) return;
      if (!su.success) setState({ loading: false, error: su.error || 'Could not load the Service User.' });
      else if (!reg.success) setState({ loading: false, su: su.data, error: reg.error || 'Could not load the GP registration.' });
      else setState({ loading: false, su: su.data, reg: reg.data });
    });
    return () => { alive = false; };
  }, [suId]);

  if (!suId) {
    return <p className="text-[11px] text-neutral-500 italic">Choose a Service User from the list to see their GP details here.</p>;
  }
  if (state.loading) return <div className="h-16 bg-neutral-100 rounded-xs animate-pulse" aria-busy="true" />;

  const { su, reg, error } = state;
  const canSeeNhs = canViewNhsNumber(currentUserRole);
  const row = (label: string, value?: string | null, missing = 'Not recorded') => (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-xs text-[#242424]">{value || <span className="text-neutral-400 italic">{missing}</span>}</dd>
    </div>
  );

  return (
    <div className="p-3 bg-[#f0fdfa] border border-[#99f6e4] rounded-xs space-y-2" data-testid="gp-booking-info">
      <div className="text-[10px] font-semibold text-teal-800 uppercase tracking-wider">Resident &amp; GP details (read-only)</div>
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      {su && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          {row('Port reference', su.externalReference || su.suReference, 'Not set')}
          {row('Name', `${su.firstName} ${su.lastName}`)}
          {row('Date of birth', formatUkDate(su.dateOfBirth), 'Not set')}
          {row('GP practice', reg?.gpPractice)}
          {row('Pharmacy', reg?.pharmacy)}
          {row('NHS number', reg?.nhsNumber ? (canSeeNhs ? reg.nhsNumber : maskNhsNumber(reg.nhsNumber)) : '')}
        </dl>
      )}
      {su && !error && !reg && (
        <p className="text-[11px] text-amber-800">
          This Service User has no GP registration yet. You can still book the appointment.
          {setActivePage && <> Complete the registration from the <b>GP Registrations</b> tab.</>}
        </p>
      )}
    </div>
  );
};
