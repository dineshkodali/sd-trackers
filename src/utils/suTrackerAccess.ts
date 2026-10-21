import type { RoleType } from '../types';

/**
 * Who may see sensitive resident information in the GP / PEEP / attendance trackers.
 * These are UI-level rules; the database and server routes apply the signed-in / site scope separately.
 */
const MANAGER_ROLES: RoleType[] = ['Super Admin', 'Admin', 'Regional Manager', 'General Manager', 'Area Manager'];

/** NHS numbers and full GP details. */
export const canViewNhsNumber = (role?: string) => MANAGER_ROLES.includes(role as RoleType);

/** Attendance notes can contain welfare detail. */
export const canViewAttendanceNotes = (role?: string) => MANAGER_ROLES.includes(role as RoleType) || role === 'Staff';

/** Create or change GP registrations, PEEP plans and attendance. Read-only roles are not defined today. */
export const canEditSuTrackers = (role?: string) => MANAGER_ROLES.includes(role as RoleType) || role === 'Staff';

/** Show an NHS number as 3 digits + hidden + last 3, e.g. 123 *** 890 for people who may not read it in full. */
export function maskNhsNumber(value?: string | null): string {
  const digits = (value || '').replace(/\s/g, '');
  if (!digits) return '';
  if (digits.length < 7) return '••••';
  return `${digits.slice(0, 3)} ••• ${digits.slice(-3)}`;
}

/** Ten digits, spaces allowed. Empty is allowed (not every resident has one yet). */
export function isValidNhsNumber(value?: string | null): boolean {
  const v = (value || '').trim();
  if (!v) return true;
  return /^\d{10}$/.test(v.replace(/\s/g, ''));
}

/** DD/MM/YYYY for display; the database keeps YYYY-MM-DD. Unparseable input is returned unchanged. */
export function formatUkDate(value?: string | null): string {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}
