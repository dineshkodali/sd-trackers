/**
 * New Arrivals form - sanitising and validating every field (pure).
 *
 * `sanitizeArrival` cleans what is typed before it is saved (trim, collapse spaces, remove control characters and angle
 * brackets, normalise case/format where the format is known, enforce maximum lengths). `arrivalFieldError` checks ONE field
 * (used by the form for inline messages); `arrivalFormErrors` checks the whole form including rules between fields
 * (GP registered vs GP, pharmacy vs GP, disability category vs type). The same functions are used on screen and on save, so
 * they cannot disagree.
 */

import { nhsNumberError, digitsOnly, formatNhsNumber } from './nhsNumber';

export const LIMITS = {
  portReference: 30, name: 100, country: 60, language: 60, email: 254, contactNumber: 25, aspenCard: 30,
  room: 20, hotel: 100, gpPractice: 120, pharmacy: 120, disabilityCategory: 80, disabilityType: 120,
  suComments: 2000, dietaryRequirements: 1000, textLine: 300, dietaryLines: 20
} as const;

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH = /[​-‍﻿]/g;
const ANGLES = /[<>]/g;

/** One line: remove control/zero-width characters and angle brackets, collapse spaces, trim, cap the length. */
export function cleanLine(value: unknown, max: number): string {
  return String(value ?? '').normalize('NFC').replace(CONTROL, ' ').replace(ZERO_WIDTH, '').replace(ANGLES, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Several lines (notes): each line cleaned, empty lines dropped, line length and count capped, total length capped. */
export function cleanLines(value: unknown, maxTotal: number, maxLines = 50): string {
  const lines = String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n').split('\n')
    .map(l => cleanLine(l, LIMITS.textLine)).filter(Boolean).slice(0, maxLines);
  return lines.join('\n').slice(0, maxTotal);
}

const NAME_RE = /^[\p{L}][\p{L}\p{M} '’.\-]*$/u;
const PORT_RE = /^[A-Z0-9][A-Z0-9/\-. ]{2,29}$/;
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PHONE_RE = /^\+?[0-9 ()\-]+$/;
const ASPEN_RE = /^[A-Za-z0-9][A-Za-z0-9 \-]{2,29}$/;
const PLACE_RE = /^[\p{L}][\p{L}\p{M} '’.,()\-/]*$/u;
const ROOM_RE = /^[A-Za-z0-9][A-Za-z0-9 .\-/]{0,19}$/;
const NONE = new Set(['', 'none', 'no', 'n/a', 'na', 'nil']);

const isoDate = (v: unknown): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === `${m[1]}-${m[2]}-${m[3]}` ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const addDays = (date: string, n: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface ArrivalFormData {
  portReference?: string; name?: string; dob?: string; country?: string; language?: string; contactNumber?: string; email?: string;
  checkInDate?: string; hotel?: string; room?: string; aspenCard?: string; status?: string;
  disabilityCategory?: string; disabilityType?: string;
  gpRegistered?: string; gpPractice?: string; pharmacy?: string; nhsNumber?: string;
  suComments?: string; dietaryRequirements?: string; availableToBook?: string;
}

/** How far ahead a check-in may be dated (people can be registered shortly before they arrive). */
export const MAX_DAYS_AHEAD = 14;
export const EARLIEST_DATE = '2000-01-01';

/** The cleaned form. Only fields that were supplied are returned. Formats are normalised where the format is known. */
export function sanitizeArrival<T extends ArrivalFormData>(data: T): T {
  const out: Record<string, any> = { ...data };
  const line = (k: keyof ArrivalFormData, max: number) => { if (k in out) out[k] = cleanLine(out[k], max); };
  line('portReference', LIMITS.portReference); line('name', LIMITS.name); line('country', LIMITS.country); line('language', LIMITS.language);
  line('contactNumber', LIMITS.contactNumber); line('email', LIMITS.email); line('aspenCard', LIMITS.aspenCard); line('room', LIMITS.room);
  line('hotel', LIMITS.hotel); line('gpPractice', LIMITS.gpPractice); line('pharmacy', LIMITS.pharmacy);
  line('disabilityCategory', LIMITS.disabilityCategory); line('disabilityType', LIMITS.disabilityType);
  if ('portReference' in out) out.portReference = String(out.portReference).toUpperCase();
  if ('email' in out) out.email = String(out.email).toLowerCase();
  if ('aspenCard' in out) out.aspenCard = String(out.aspenCard).toUpperCase();
  if ('nhsNumber' in out) { const t = cleanLine(out.nhsNumber, 20); out.nhsNumber = t ? formatNhsNumber(t) : ''; }
  if ('dob' in out) out.dob = String(out.dob ?? '').trim();
  if ('checkInDate' in out) out.checkInDate = String(out.checkInDate ?? '').trim();
  if ('suComments' in out) out.suComments = cleanLines(out.suComments, LIMITS.suComments);
  if ('dietaryRequirements' in out) out.dietaryRequirements = cleanLines(out.dietaryRequirements, LIMITS.dietaryRequirements, LIMITS.dietaryLines);
  for (const k of ['availableToBook', 'gpRegistered'] as const) if (k in out) out[k] = out[k] === 'Yes' ? 'Yes' : out[k] === 'No' ? 'No' : '';
  return out as T;
}

export type FieldKey = keyof ArrivalFormData;

/** Message for one field, or null. `today` is a London 'YYYY-MM-DD'. Works on the raw value (it is cleaned first). */
export function arrivalFieldError(key: FieldKey, raw: unknown, form: ArrivalFormData, today: string): string | null {
  const text = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
  const v = key === 'suComments' || key === 'dietaryRequirements' ? text : cleanLine(text, 10_000);
  // Angle brackets are removed on save, but typing them into a structured field is almost certainly a mistake (or markup): say so.
  if (key !== 'suComments' && key !== 'dietaryRequirements' && /[<>]/.test(text)) return 'Remove the < and > characters.';
  const tooLong = (max: number) => (cleanLine(text, 100_000).length > max ? `Must be ${max} characters or fewer.` : null);

  switch (key) {
    case 'portReference': {
      const p = v.toUpperCase();
      if (!p) return 'Port Reference is required.';
      if (p.length > LIMITS.portReference) return `Port Reference must be ${LIMITS.portReference} characters or fewer.`;
      return PORT_RE.test(p) ? null : 'Port Reference may contain only letters, numbers, / - . and spaces (3 to 30 characters), e.g. MST/9412027.';
    }
    case 'name':
      if (!v) return 'Name is required.';
      if (v.length < 2) return 'Enter the full name.';
      return tooLong(LIMITS.name) || (NAME_RE.test(v) ? null : 'Name may contain only letters, spaces, apostrophes, hyphens and full stops (no numbers or symbols).');
    case 'dob': {
      if (!v) return null;
      const d = isoDate(v);
      if (!d) return 'Enter a valid date of birth.';
      if (d > today) return 'Date of birth cannot be in the future.';
      if (d < addDays(today, -365 * 120)) return 'Date of birth is more than 120 years ago.';
      return null;
    }
    case 'country': case 'language':
      return !v ? null : tooLong(LIMITS[key]) || (PLACE_RE.test(v) ? null : `${key === 'country' ? 'Country' : 'Language'} may contain only letters, spaces and basic punctuation.`);
    case 'contactNumber': {
      if (!v) return null;
      const digits = v.replace(/\D/g, '');
      return PHONE_RE.test(v) && digits.length >= 7 && digits.length <= 15 ? null : 'Enter a phone number with 7 to 15 digits (digits, spaces, + ( ) - only).';
    }
    case 'email':
      if (!v) return null;
      return v.length <= LIMITS.email && EMAIL_RE.test(v) ? null : 'Enter a valid email address, e.g. name@example.com.';
    case 'checkInDate': {
      if (!v) return 'Check-in date is required.';
      const d = isoDate(v);
      if (!d) return 'Enter a valid check-in date.';
      if (d < EARLIEST_DATE) return 'Check-in date is too far in the past.';
      if (d > addDays(today, MAX_DAYS_AHEAD)) return `Check-in date cannot be more than ${MAX_DAYS_AHEAD} days ahead.`;
      return null;
    }
    case 'hotel': return v ? null : 'Hotel is required.';
    case 'room': return !v ? null : ROOM_RE.test(v) ? null : 'Room may contain only letters, numbers, spaces and . - /.';
    case 'aspenCard': return !v ? null : ASPEN_RE.test(v) ? null : 'Aspen card may contain only letters, numbers, spaces and hyphens (3 to 30 characters).';
    case 'disabilityCategory': {
      if (v && !PLACE_RE.test(v) && !/[&]/.test(v)) return 'Disability category contains characters that are not allowed.';
      return tooLong(LIMITS.disabilityCategory);
    }
    case 'disabilityType': {
      const cat = norm(form.disabilityCategory);
      if (v && NONE.has(cat)) return 'Disability type is set but the category is None. Choose the category first, or clear the type.';
      if (!v && !NONE.has(cat)) return 'Choose the disability type for this category.';
      return v ? (tooLong(LIMITS.disabilityType) || (/^[\p{L}\p{N}][\p{L}\p{N}\p{M} '’.,()\-/&]*$/u.test(v) ? null : 'Disability type contains characters that are not allowed.')) : null;
    }
    case 'gpRegistered': return null;
    case 'gpPractice': {
      if (form.gpRegistered === 'Yes' && !v) return 'Choose the GP, or set GP Registered to No.';
      if (v && form.gpRegistered === 'No') return 'A GP is selected but GP Registered is No. Set it to Yes, or clear the GP.';
      if (v && form.gpRegistered !== 'Yes' && form.gpRegistered !== 'No') return 'Set GP Registered to Yes to record a GP.';
      return tooLong(LIMITS.gpPractice);
    }
    case 'pharmacy': {
      if (!v) return null;
      if (norm(v) === norm(form.gpPractice)) return 'The pharmacy is the same entry as the GP. Choose the pharmacy the resident uses.';
      return tooLong(LIMITS.pharmacy);
    }
    case 'nhsNumber': return nhsNumberError(v);
    case 'suComments': {
      const t = cleanLines(text, 1_000_000, 1_000_000);
      return t.length > LIMITS.suComments ? `Comments must be ${LIMITS.suComments} characters or fewer.` : null;
    }
    case 'dietaryRequirements': {
      const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map(l => cleanLine(l, 10_000)).filter(Boolean);
      if (lines.length > LIMITS.dietaryLines) return `Enter at most ${LIMITS.dietaryLines} requirements (one per line).`;
      if (lines.some(l => l.length > LIMITS.textLine)) return `Each requirement must be ${LIMITS.textLine} characters or fewer.`;
      return null;
    }
    default: return null;
  }
}

const ORDER: FieldKey[] = ['portReference', 'name', 'dob', 'country', 'language', 'contactNumber', 'email', 'checkInDate', 'hotel', 'room', 'aspenCard',
  'disabilityCategory', 'disabilityType', 'gpRegistered', 'gpPractice', 'pharmacy', 'nhsNumber', 'suComments', 'dietaryRequirements', 'availableToBook'];

/** Every field of the form, in form order. Empty object = the form may be saved. */
export function arrivalFormErrors(data: ArrivalFormData, today: string, only?: FieldKey[]): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const k of ORDER) {
    if (only && !only.includes(k)) continue;
    const e = arrivalFieldError(k, (data as any)[k], data, today);
    if (e) out[k] = e;
  }
  return out;
}

export { digitsOnly };
