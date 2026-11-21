/**
 * Operations Dashboard - "latest records" tabs (pure).
 *
 * For pages whose data is a log rather than a deadline (arrivals, registers, safeguarding logs, laundry, food ...) the
 * dashboard shows only a few of the newest records per page, and "View all" opens the page. Only the ACTIVE tab is
 * computed (the others cost nothing until chosen), and only the top rows are materialised.
 */

import { createSiteResolver, parseIsoDate, type SiteRef } from './operationsRules';
import { parseFlexDate } from './operationsDepartments';

export type RecordGroup = 'operations' | 'facilities';

export interface RecordTabSpec {
  key: string;
  label: string;
  group: RecordGroup;
  /** page that owns the records (also the permission to see the tab) */
  page: string;
  /** AppContext list name */
  source: string;
  site: (r: any) => unknown;
  title: (r: any) => string;
  date: (r: any) => unknown;
  status?: (r: any) => string;
  /** sub-text shown under the title */
  detail?: (r: any) => string;
}

const s = (v: unknown) => String(v ?? '').trim();

export const RECORD_TABS: RecordTabSpec[] = [
  // Operations: the other pages of the application
  { key: 'newArrivals', label: 'New arrivals', group: 'operations', page: 'dailyRegisters', source: 'newArrivalsRecords', site: r => r.hotel, title: r => s(r.name) || s(r.portReference), date: r => r.checkInDate || r.createdAt, status: r => s(r.status), detail: r => (r.room ? `Room ${r.room}` : '') },
  { key: 'liveRegister', label: 'Live register', group: 'operations', page: 'dailyRegisters', source: 'dailyRegisterRecords', site: r => r.hotel, title: r => s(r.name) || s(r.portRef), date: r => r.checkInDate || r.createdAt, status: r => (s(r.occupied).toLowerCase() === 'yes' ? 'Occupied' : 'Not occupied'), detail: r => (r.roomNo ? `Room ${r.roomNo}` : '') },
  { key: 'referrals', label: 'SG referrals', group: 'operations', page: 'referrals', source: 'referrals', site: r => r.site, title: r => s(r.suName) || s(r.portRef), date: r => r.createdAt, status: r => s(r.status) },
  { key: 'vulnerable', label: 'Vulnerable', group: 'operations', page: 'vulnerable', source: 'vulnerableSUs', site: r => r.site, title: r => s(r.suName) || s(r.portOrNassRef), date: r => r.updatedAt || r.createdAt, status: r => s(r.status) },
  { key: 'challenging', label: 'Challenging', group: 'operations', page: 'challenging', source: 'challengingSUs', site: r => r.site, title: r => s(r.name) || s(r.portRef), date: r => r.date || r.createdAt, status: r => s(r.status) },
  { key: 'welfareChecks', label: 'Welfare checks', group: 'operations', page: 'welfareChecks', source: 'welfareChecks', site: r => r.siteName, title: r => s(r.portReference), date: r => r.checkDatetime, detail: r => s(r.officerName) },
  { key: 'rfaWelfare', label: 'RFA welfare', group: 'operations', page: 'rfaWelfare', source: 'rfaWelfareRecords', site: r => r.siteName, title: r => s(r.name) || s(r.portOrNassRef), date: r => r.date || r.createdAt },
  { key: 'mhComplaint', label: 'MH complaints', group: 'operations', page: 'mhComplaintWelfare', source: 'mhComplaintWelfareRecords', site: r => r.siteName, title: r => s(r.name) || s(r.mhTicketRef), date: r => r.date || r.createdAt, status: r => s(r.status) },
  { key: 'gp', label: 'GP appointments', group: 'operations', page: 'gpAppointments', source: 'gpAppointmentRecords', site: r => r.siteName, title: r => s(r.suName) || (r.roomNo ? `Room ${r.roomNo}` : 'Appointment'), date: r => r.appointmentDate || r.createdAt, status: r => s(r.status) },
  { key: 'ir', label: 'IR tracker', group: 'operations', page: 'irTracker', source: 'irRecords', site: r => r.site, title: r => s(r.suName) || s(r.portRef), date: r => r.date || r.createdAt },
  { key: 'transport', label: 'Public transport', group: 'operations', page: 'publicTransport', source: 'publicTransportRecords', site: r => r.siteName, title: r => s(r.id), date: r => r.appointmentDate || r.createdAt, status: r => s(r.status) },
  // Facilities and site services
  { key: 'spcd', label: 'SPCD', group: 'facilities', page: 'spcd', source: 'spcdRecords', site: r => r.siteName || r.site, title: r => (r.roomNumber ? `Room ${r.roomNumber}` : '') || s(r.suName) || 'SPCD case', date: r => r.date || r.createdAt },
  { key: 'laundry', label: 'Laundry', group: 'facilities', page: 'laundry', source: 'laundryRecords', site: r => r.site, title: r => (r.roomNo ? `Room ${r.roomNo}` : '') || s(r.residentName) || 'Laundry job', date: r => r.date, status: r => s(r.status), detail: r => (r.bagCount ? `${r.bagCount} bag(s)` : '') },
  { key: 'propertyLaundry', label: 'Property laundry', group: 'facilities', page: 'laundry', source: 'propertyLaundryLogs', site: r => r.site, title: r => s(r.periodLabel) || 'Period', date: r => r.endDate || r.startDate, status: r => (r.hasDiscrepancy ? 'Discrepancy' : 'OK') },
  { key: 'hotMeals', label: 'Hot meals', group: 'facilities', page: 'food', source: 'foodRecords', site: r => r.site, title: r => (r.roomNo ? `Room ${r.roomNo}` : '') || s(r.residentName) || 'Meal', date: r => r.createdAt, status: r => s(r.status), detail: r => s(r.vendor) },
  { key: 'buffet', label: 'Vendor buffet', group: 'facilities', page: 'food', source: 'foodVendorBuffetLogs', site: r => r.site, title: r => s(r.vendor) || 'Buffet', date: r => r.endDate || r.startDate || r.updatedAt },
  { key: 'wastage', label: 'Food wastage', group: 'facilities', page: 'foodWastage', source: 'foodWastageRecords', site: r => r.site, title: r => s(r.foodWastage) || 'Food wastage', date: r => r.date || r.createdAt, detail: r => [r.quantity, r.unit].filter(Boolean).join(' ') },
  { key: 'surveys', label: 'Food surveys', group: 'facilities', page: 'foodSurveys', source: 'foodSurveys', site: r => r.siteName, title: r => s(r.portReference) || 'Survey', date: r => r.createdAt, status: r => s(r.overallFoodQuality) },
  { key: 'booklets', label: 'Booklets', group: 'facilities', page: 'booklets', source: 'bookletRecords', site: r => r.hotelName, title: r => s(r.bookletType), date: r => r.updatedAt || r.createdAt, status: r => s(r.status), detail: r => s(r.language) },
  { key: 'roomChecks', label: 'Room checks', group: 'facilities', page: 'roomChecks', source: 'roomChecks', site: r => r.siteName, title: r => (r.roomNumber ? `Room ${r.roomNumber}` : 'Room check'), date: r => r.inspectionDate, status: r => s(r.overallStatus), detail: r => s(r.officerName) }
];

export interface RecordRow {
  id: string;
  title: string;
  detail: string;
  siteName: string;
  /** 'YYYY-MM-DD' or '' */
  date: string;
  status: string;
}

export interface RecordTabResult { rows: RecordRow[]; total: number; unmatchedSite: number }

/** ISO or MM/DD/YYYY or a timestamp -> 'YYYY-MM-DD' (or ''). */
const toDay = (v: unknown) => parseIsoDate(v) || parseFlexDate(v) || '';

export function selectRecordTab(
  spec: RecordTabSpec,
  records: any[] | undefined,
  sites: SiteRef[],
  scope: { allowedSiteIds: Set<string> | 'all'; siteId: string | 'all' },
  limit = 5
): RecordTabResult {
  const resolve = createSiteResolver(sites);
  const names = new Map(sites.map(x => [x.id, x.name]));
  let total = 0; let unmatched = 0;
  const kept: Array<{ r: any; siteId: string; day: string }> = [];
  for (const r of records || []) {
    const siteId = resolve(spec.site(r));
    if (!siteId) { unmatched++; continue; }
    if (!(scope.allowedSiteIds === 'all' || scope.allowedSiteIds.has(siteId))) continue;
    if (!(scope.siteId === 'all' || scope.siteId === siteId)) continue;
    total++;
    kept.push({ r, siteId, day: toDay(spec.date(r)) });
  }
  // Newest first; records with no readable date go last. Only the top `limit` are turned into rows.
  kept.sort((a, b) => (b.day || '').localeCompare(a.day || '') || String(b.r.id).localeCompare(String(a.r.id)));
  const rows = kept.slice(0, limit).map(({ r, siteId, day }): RecordRow => ({
    id: String(r.id), title: spec.title(r) || '—', detail: spec.detail ? spec.detail(r) : '', siteName: names.get(siteId) || '', date: day, status: spec.status ? spec.status(r) : ''
  }));
  return { rows, total, unmatchedSite: unmatched };
}
