import type {
  ServiceUserMaster
} from '../types/masterData';
import type {
  IRRecord, ChallengingSU, SGReferral, WelfareCheckRecord, RFAWelfareCheckRecord,
  MHComplaintWelfareRecord, GPAppointmentRecord, PublicTransportRecord
} from '../types';

export interface ServiceUserRecordSources {
  irRecords: IRRecord[];
  challengingSUs: ChallengingSU[];
  referrals: SGReferral[];
  welfareChecks: WelfareCheckRecord[];
  rfaWelfareRecords: RFAWelfareCheckRecord[];
  mhComplaintWelfareRecords: MHComplaintWelfareRecord[];
  gpAppointmentRecords: GPAppointmentRecord[];
  publicTransportRecords: PublicTransportRecord[];
}

export interface ServiceUserRecordSet {
  incidents: { id: string; source: 'IR' | 'Challenging'; date: string; site: string; summary: string; status: string }[];
  referrals: SGReferral[];
  welfare: WelfareCheckRecord[];
  otherWelfare: { id: string; source: 'RFA' | 'MH Complaint'; date: string; site: string; room: string; detail: string; status: string }[];
  gp: GPAppointmentRecord[];
  transport: PublicTransportRecord[];
}

const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const splitList = (s?: string | null) => (s || '').split(/[,;\n]/).map(norm).filter(Boolean);

/** Builds a matcher: a record belongs to a Service User by id, Port Ref, or exact full name. */
export function buildServiceUserMatcher(su: ServiceUserMaster) {
  const ref = norm(su.externalReference);
  const refs = new Set([ref, norm(su.suReference)].filter(Boolean));
  const names = new Set(
    [`${su.firstName} ${su.lastName}`, `${su.preferredName || ''} ${su.lastName}`]
      .map(norm)
      .filter(n => n.length > 1)
  );
  return {
    one: (name?: string | null, portRef?: string | null) => {
      const r = norm(portRef);
      if (r && refs.has(r)) return true;
      // Only fall back to the name when the record has no Port Ref, so namesakes with a different ref don't leak in.
      return !r && names.has(norm(name));
    },
    many: (names_?: string | null, portRefs?: string | null) => {
      const rs = splitList(portRefs);
      if (rs.some(r => refs.has(r))) return true;
      return rs.length === 0 && splitList(names_).some(n => names.has(n));
    }
  };
}

const byDateDesc = <T,>(get: (x: T) => string | undefined) => (a: T, b: T) => (get(b) || '').localeCompare(get(a) || '');

export function getServiceUserRecords(su: ServiceUserMaster, d: ServiceUserRecordSources): ServiceUserRecordSet {
  const m = buildServiceUserMatcher(su);
  const incidents: ServiceUserRecordSet['incidents'] = [
    ...(d.irRecords || []).filter(r => m.one(r.suName, r.portRef)).map(r => ({
      id: r.id, source: 'IR' as const, date: r.date, site: r.site, summary: r.irSummary, status: r.submittedToCrh ? 'Submitted to CRH' : 'Open'
    })),
    ...(d.challengingSUs || []).filter(r => m.one(r.name, r.portRef)).map(r => ({
      id: r.id, source: 'Challenging' as const, date: r.dateOfIncident || r.date, site: r.site,
      summary: `${r.typeOfIssue}${r.incidentDescription ? ' - ' + r.incidentDescription : ''}`, status: String(r.status || '')
    }))
  ].sort(byDateDesc(x => x.date));

  return {
    incidents,
    referrals: (d.referrals || []).filter(r => m.one(r.suName, r.portRef)).sort(byDateDesc(x => x.dateReferred)),
    welfare: (d.welfareChecks || []).filter(w => (w as any).suId === su.id || w.serviceUserId === su.id || m.one((w as any).suName, w.portReference))
      .sort(byDateDesc(x => x.checkDatetime)),
    otherWelfare: [
      ...(d.rfaWelfareRecords || []).filter(r => m.one(r.name, r.portOrNassRef)).map(r => ({
        id: r.id, source: 'RFA' as const, date: r.date, site: r.siteName, room: r.roomOrFlatNo,
        detail: [r.vulnerability, r.actionTaken].filter(Boolean).join(' - '), status: r.mhTicket ? `MH ticket ${r.mhTicket}` : '—'
      })),
      ...(d.mhComplaintWelfareRecords || []).filter(r => m.one(r.name, r.portOrNassRef)).map(r => ({
        id: r.id, source: 'MH Complaint' as const, date: r.date, site: r.siteName, room: r.roomOrFlatNo,
        detail: [r.complaintCategory, r.complaintDetails].filter(Boolean).join(' - '), status: String(r.status || '')
      }))
    ].sort(byDateDesc(x => x.date)),
    gp: (d.gpAppointmentRecords || []).filter(r => m.one(r.suName, r.portReference)).sort(byDateDesc(x => x.appointmentDate)),
    transport: (d.publicTransportRecords || []).filter(r => m.many(r.suNames, r.portRefs)).sort(byDateDesc(x => x.appointmentDate))
  };
}

export const countServiceUserRecords = (s: ServiceUserRecordSet) => ({
  incidents: s.incidents.length,
  referrals: s.referrals.length,
  welfare: s.welfare.length + s.otherWelfare.length,
  gp: s.gp.length,
  transport: s.transport.length
});
