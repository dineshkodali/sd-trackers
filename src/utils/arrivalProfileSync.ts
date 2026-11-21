/**
 * New Arrivals -> Service User Profile: what to write, decided without touching any database (pure).
 *
 * The rule that keeps existing information safe:
 *   - a BLANK form value never changes anything;
 *   - a single-value field (GP practice, pharmacy, NHS number, GP registered) FILLS a blank profile value and never
 *     replaces one that is already filled (the difference is reported, not applied);
 *   - a list/notes field (dietary requirements, safeguarding comments) is MERGED: lines already on the profile stay and
 *     new lines are added; the same line is never added twice (compared ignoring case and spacing).
 */

import { digitsOnly, formatNhsNumber } from './nhsNumber';

export interface ArrivalProfileDetails {
  suComments?: string;
  dietaryRequirements?: string;
  availableToBook?: string;
  gpRegistered?: string;
  gpPractice?: string;
  pharmacy?: string;
  nhsNumber?: string;
  disabilityCategory?: string;
  disabilityType?: string;
}

export interface ProfileState {
  /** safeguarding text on the profile (support row "Safeguarding"), as lines */
  safeguarding: string;
  dietary: string[];
  /** service_users.gp_registration */
  suGpPractice: string;
  /** service_users.disability_category / disability_type */
  suDisabilityCategory?: string;
  suDisabilityType?: string;
  gp: { id?: string; gpPractice?: string; pharmacy?: string; nhsNumber?: string; notes?: string } | null;
}

export interface ProfilePlan {
  safeguarding: { write: boolean; value: string };
  dietary: { write: boolean; value: string[] };
  /** set service_users.disability_category / disability_type (only the parts that fill a blank) */
  suDisability: { write: boolean; fields: { disabilityCategory?: string; disabilityType?: string } };
  /** set service_users.gp_registration */
  suGpPractice: { write: boolean; value: string };
  /** upsert gp_registrations with exactly these fields (only the ones that change) */
  gp: { write: boolean; id?: string; fields: { gpPractice?: string; pharmacy?: string; nhsNumber?: string } };
  /** profile values that differ from what was typed and were therefore kept */
  keptExisting: string[];
  /** human summary of what will be saved, for the confirmation message */
  saved: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export const splitLines = (text?: string) => String(text ?? '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

/** existing lines first, then any new line not already present */
export function mergeLines(existing: string[], incoming: string[]): { merged: string[]; added: string[] } {
  const have = new Set(existing.map(norm));
  const added: string[] = [];
  for (const line of incoming) {
    const k = norm(line);
    if (!k || have.has(k)) continue;
    have.add(k); added.push(line);
  }
  return { merged: [...existing, ...added], added };
}

export function hasAnyDetail(d: ArrivalProfileDetails): boolean {
  return Object.values(d).some(v => String(v ?? '').trim() !== '');
}

export function planProfileSync(state: ProfileState, d: ArrivalProfileDetails): ProfilePlan {
  const kept: string[] = []; const saved: string[] = [];

  const safeLines = mergeLines(splitLines(state.safeguarding), splitLines(d.suComments));
  const diet = mergeLines(state.dietary, splitLines(d.dietaryRequirements));
  if (safeLines.added.length) saved.push('safeguarding comments');
  if (diet.added.length) saved.push('dietary requirements');

  const fill = (label: string, current: string | undefined, typed: string | undefined, norm2: (s: string) => string = s => s.trim()) => {
    const t = norm2(String(typed ?? ''));
    const c = String(current ?? '').trim();
    if (!t) return { write: false, value: c };
    if (!c) { saved.push(label); return { write: true, value: t }; }
    if (norm(c) !== norm(t) && digitsOnly(c) !== digitsOnly(t)) kept.push(`${label}: kept "${label === 'NHS number' ? '••••' : c}"`);
    return { write: false, value: c };
  };

  // Disability: "None" and blank both mean nothing is recorded yet, so a real category may fill them; a recorded one is kept.
  const noneLike = (v?: string) => ['', 'none', 'no', 'n/a', 'na', 'nil'].includes(norm(v ?? ''));
  const disabilityFields: ProfilePlan['suDisability']['fields'] = {};
  const typedCat = String(d.disabilityCategory ?? '').trim();
  const typedType = String(d.disabilityType ?? '').trim();
  if (!noneLike(typedCat)) {
    if (noneLike(state.suDisabilityCategory)) { disabilityFields.disabilityCategory = typedCat; saved.push('disability category'); }
    else if (norm(state.suDisabilityCategory ?? '') !== norm(typedCat)) kept.push(`disability category: kept "${state.suDisabilityCategory}"`);
  }
  if (typedType) {
    if (!String(state.suDisabilityType ?? '').trim()) { disabilityFields.disabilityType = typedType; saved.push('disability type'); }
    else if (norm(state.suDisabilityType ?? '') !== norm(typedType)) kept.push(`disability type: kept "${state.suDisabilityType}"`);
  }

  const practiceTyped = String(d.gpPractice ?? '').trim();
  const suGp = fill('GP', state.suGpPractice, practiceTyped);
  const gpPractice = fill('GP details', state.gp?.gpPractice, practiceTyped);
  const pharmacy = fill('pharmacy', state.gp?.pharmacy, d.pharmacy);
  const nhs = fill('NHS number', state.gp?.nhsNumber, d.nhsNumber, s => (s ? formatNhsNumber(s) : ''));

  const fields: ProfilePlan['gp']['fields'] = {};
  if (gpPractice.write) fields.gpPractice = gpPractice.value;
  if (pharmacy.write) fields.pharmacy = pharmacy.value;
  if (nhs.write) fields.nhsNumber = nhs.value;

  return {
    safeguarding: { write: safeLines.added.length > 0, value: safeLines.merged.join('\n') },
    dietary: { write: diet.added.length > 0, value: diet.merged },
    suGpPractice: suGp,
    suDisability: { write: Object.keys(disabilityFields).length > 0, fields: disabilityFields },
    gp: { write: Object.keys(fields).length > 0, id: state.gp?.id, fields },
    keptExisting: kept,
    saved
  };
}
