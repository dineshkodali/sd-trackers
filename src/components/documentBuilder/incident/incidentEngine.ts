/**
 * Incident Report Builder — engine
 *
 * Pure (UI-free) logic for the guided HO Report Generator "Incident Report" flow:
 * state, wording engine (standard wording + {token} filling), report resolution,
 * email subject/body, completeness checks, file naming, and filling the real
 * Clearsprings Incident Report Word template.
 */

import JSZip from 'jszip';
import {
  AUTH_ROWS,
  EMAIL_TYPES,
  FIELD_LIB,
  NOTE_GENERIC,
  SCENARIOS,
  fmtDate,
  type DetailFieldDef,
  type Scenario,
  type ScenarioFieldRef,
} from './incidentData';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const BUILDER_KEY = '__irBuilder';

/* ---------- small helpers ---------- */
export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function cap1(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function withThe(s: string): string {
  return /^(a|an|the|some|any|\d)\b/i.test(s) ? s : `the ${s}`;
}
export function nameFromReporter(s: string): string {
  const t = (s || '').trim();
  return t ? t.split(/\s*[(,]| - | – /)[0].trim() : '';
}
export function slug(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
export function countPh(s: unknown): number {
  return (String(s || '').match(/\[[^\]\n]*\]/g) || []).length;
}
export function isPh(s: unknown): boolean {
  return /^\[[^\]]*\]$/.test(String(s || '').trim());
}

/* A "segment" parser: [ ... ] = red placeholder, photo notes in ( ) = italic */
const RICH_SRC = '(\\[[^\\]\\n]*\\])|(\\((?:Pictures?|Photos?|Photographs?|Please see|Please attach)[^)\\n]*\\))';
export interface RichSeg {
  k: 'n' | 'ph' | 'it';
  s: string;
}
export function parseRich(input: unknown): RichSeg[] {
  const re = new RegExp(RICH_SRC, 'gi');
  const out: RichSeg[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const text = String(input == null ? '' : input);
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ k: 'n', s: text.slice(last, m.index) });
    out.push({ k: m[1] ? 'ph' : 'it', s: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ k: 'n', s: text.slice(last) });
  return out;
}

/* ---------- state ---------- */
export type PeopleMode = 'na' | 'write';

export interface CoreState {
  propertyId: string;
  propertyChoice: string;
  reporter: string;
  date: string;
  offenders: string;
  offendersMode: PeopleMode;
  offendersModeAuto: boolean;
  offendersEdited: boolean;
  victims: string;
  victimsMode: PeopleMode;
  witnesses: string;
  witnessesMode: PeopleMode;
}
export interface DraftItem {
  ref: string | null;
  text: string;
  edited: boolean;
}
export interface AuthState {
  inv: string;
  mode: PeopleMode;
  txt: string;
}
export interface Draft {
  lead: DraftItem;
  bullets: DraftItem[];
  actions: DraftItem[];
  warning: { issued: string; whom: string };
  auth: Record<string, AuthState>;
}
export interface BuilderState {
  scenarioId: string;
  review: boolean;
  emailType: string;
  core: CoreState;
  values: Record<string, string>;
  drafts: Record<string, Draft>;
}

export function freshState(): BuilderState {
  return {
    scenarioId: SCENARIOS[0].id,
    review: false,
    emailType: 'auto',
    core: {
      propertyId: '', propertyChoice: '', reporter: '', date: '',
      offenders: '', offendersMode: 'write', offendersModeAuto: true, offendersEdited: false,
      victims: '', victimsMode: 'na', witnesses: '', witnessesMode: 'na',
    },
    values: {},
    drafts: {},
  };
}

export function getScenario(id: string): Scenario {
  return SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
}

export function defsFor(scn: Scenario): Record<string, DetailFieldDef> {
  const out: Record<string, DetailFieldDef> = {};
  scn.fields.forEach((f: ScenarioFieldRef) => {
    const key = Array.isArray(f) ? f[0] : f;
    const ov = Array.isArray(f) ? f[1] : {};
    out[key] = { key, ...FIELD_LIB[key], ...ov } as DetailFieldDef;
  });
  return out;
}

export function newDraft(scn: Scenario): Draft {
  return {
    lead: { ref: 'lead', text: '', edited: false },
    bullets: scn.bullets.map((_, i) => ({ ref: `b${i}`, text: '', edited: false })),
    actions: scn.actions.map((_, i) => ({ ref: `a${i}`, text: '', edited: false })),
    warning: { issued: scn.warning, whom: '' },
    auth: {
      safe: { inv: 'N/A', mode: 'na', txt: '' },
      police: { inv: scn.police ? 'Yes' : 'N/A', mode: scn.police ? 'write' : 'na', txt: '' },
      amb: { inv: scn.ambulance ? 'Yes' : 'N/A', mode: scn.ambulance ? 'write' : 'na', txt: '' },
      fire: { inv: 'N/A', mode: 'na', txt: '' },
    },
  };
}

export function ensureDraft(state: BuilderState, scn: Scenario): Draft {
  const d = state.drafts[scn.id];
  const ok = d && d.lead && Array.isArray(d.bullets) && Array.isArray(d.actions) && d.warning && d.auth;
  if (!ok) state.drafts[scn.id] = newDraft(scn);
  return state.drafts[scn.id];
}

export function ensureDefaults(state: BuilderState, scn: Scenario): void {
  const defs = defsFor(scn);
  Object.keys(defs).forEach(k => {
    const d = defs[k];
    if (d.type === 'select' && d.options && !state.values[k]) state.values[k] = d.options[0][0];
  });
}

/** Keep derived state consistent after any change (drafts exist, select defaults, offenders from SU fields). */
export function normalizeState(state: BuilderState): BuilderState {
  const scn = getScenario(state.scenarioId);
  ensureDraft(state, scn);
  ensureDefaults(state, scn);
  const defs = defsFor(scn);
  if (defs.su && !state.core.offendersEdited && state.core.offendersMode !== 'na') {
    state.core.offenders = [state.values.su, defs.su2 ? state.values.su2 : '']
      .map(x => String(x || '').trim()).filter(Boolean).join('\n');
  }
  return state;
}

/** Switch scenario, applying the scenario's default offenders mode (unless the user chose one). */
export function applyScenario(state: BuilderState, id: string): BuilderState {
  state.scenarioId = id;
  const scn = getScenario(id);
  ensureDraft(state, scn);
  ensureDefaults(state, scn);
  if (state.core.offendersModeAuto !== false) state.core.offendersMode = scn.offenders || 'write';
  return normalizeState(state);
}

/** Validate/repair a state that came from storage or a saved record. Returns null if unusable. */
export function sanitizeState(raw: unknown): BuilderState | null {
  try {
    const s = raw as BuilderState;
    if (!s || typeof s !== 'object' || !s.core || !s.values || !s.drafts) return null;
    const base = freshState();
    const oc: any = { ...s.core };
    (['victims', 'witnesses'] as const).forEach(k => {
      if (!oc[`${k}Mode`]) {
        const t = String(oc[k] || '').trim();
        if (!t || /^n\/?a$/i.test(t)) { oc[`${k}Mode`] = 'na'; oc[k] = ''; } else oc[`${k}Mode`] = 'write';
      }
    });
    if (!oc.offendersMode) oc.offendersMode = 'write';
    const out: BuilderState = {
      scenarioId: SCENARIOS.some(x => x.id === s.scenarioId) ? s.scenarioId : SCENARIOS[0].id,
      review: !!s.review,
      emailType: typeof s.emailType === 'string' ? s.emailType : 'auto',
      core: { ...base.core, ...oc },
      values: { ...s.values },
      drafts: { ...s.drafts },
    };
    if (out.core.propertyChoice == null) out.core.propertyChoice = '';
    return normalizeState(out);
  } catch {
    return null;
  }
}

/* ---------- wording engine ---------- */
export interface Ctx {
  values: Record<string, string>;
  core: CoreState;
  defs: Record<string, DetailFieldDef>;
}
export function makeCtx(state: BuilderState, scn: Scenario): Ctx {
  return { values: state.values, core: state.core, defs: defsFor(scn) };
}
function resolveToken(key: string, ctx: Ctx): string | null {
  const def = ctx.defs[key];
  if (!def) return null;
  let raw = String(ctx.values[key] == null ? '' : ctx.values[key]).trim();
  if (key === 'ho' && !raw) raw = nameFromReporter(ctx.core.reporter);
  if (!raw) return def.ph || `[Insert ${def.label}]`;
  return def.fmt ? def.fmt(raw) : raw;
}
export function fillTemplate(tpl: string, ctx: Ctx): string {
  return String(tpl).replace(/\{(\w+)(?:\|(\w+))?\}/g, (m, key: string, filt?: string) => {
    let out = resolveToken(key, ctx);
    if (out == null) return m;
    if (filt === 'cap') out = cap1(out);
    else if (filt === 'the') out = withThe(out);
    return out;
  });
}
function itemTemplate(scn: Scenario, item: DraftItem): string | ((v: Record<string, string>) => string) | null | undefined {
  if (!item.ref) return null;
  if (item.ref === 'lead') return scn.lead;
  const idx = parseInt(item.ref.slice(1), 10);
  return item.ref.charAt(0) === 'b' ? scn.bullets[idx] : scn.actions[idx];
}
export function itemText(scn: Scenario, item: DraftItem, ctx: Ctx): string {
  if (item.edited) return item.text || '';
  let tpl = itemTemplate(scn, item);
  if (typeof tpl === 'function') tpl = tpl(ctx.values);
  return tpl == null ? '' : fillTemplate(tpl, ctx);
}

/* ---------- state -> report ---------- */
export const CORE_PH = {
  property: '[Insert Property ID and site name – e.g. 519 (Name of the site)]',
  reporter: '[Insert Name & Role – e.g. John Smith (HO)]',
  date: '[DD/MM/YYYY]',
  offenders: '[Insert Name and Port Ref – e.g. John Smith (CIU/123456)]',
  people: '[Insert Name and Port Ref – e.g. John Smith (CIU/123456)]',
  whom: '[Insert Port Reference Number(s) of SU(s) the warning letter is to be issued to]',
};

export interface ReportAuth {
  label: string;
  whoLabel: string;
  inv: string;
  txt: string;
}
export interface Report {
  scenarioId: string;
  scenarioLabel: string;
  propertyId: string;
  reporter: string;
  date: string;
  offenders: string;
  victims: string;
  witnesses: string;
  lead: string;
  bullets: string[];
  actions: string[];
  warningIssued: string;
  warningWhom: string;
  auth: ReportAuth[];
}

export function resolveReport(state: BuilderState): Report {
  const scn = getScenario(state.scenarioId);
  const d = ensureDraft(state, scn);
  ensureDefaults(state, scn);
  const ctx = makeCtx(state, scn);
  const c = state.core;
  const nonEmpty = (t: string) => String(t).trim() !== '';
  const issued = d.warning.issued || 'N/A';
  let whom = (d.warning.whom || '').trim();
  if (!whom) whom = /^(requesting|please issue|yes|issued)$/i.test(issued) ? CORE_PH.whom : 'N/A';
  return {
    scenarioId: scn.id,
    scenarioLabel: scn.label + (scn.sub ? ` – ${scn.sub}` : ''),
    propertyId: c.propertyId.trim() || CORE_PH.property,
    reporter: c.reporter.trim() || CORE_PH.reporter,
    date: c.date ? fmtDate(c.date) : CORE_PH.date,
    offenders: c.offendersMode === 'na' ? 'N/A' : (c.offenders.trim() || CORE_PH.offenders),
    victims: c.victimsMode === 'write' ? (c.victims.trim() || CORE_PH.people) : 'N/A',
    witnesses: c.witnessesMode === 'write' ? (c.witnesses.trim() || CORE_PH.people) : 'N/A',
    lead: itemText(scn, d.lead, ctx).trim(),
    bullets: d.bullets.map(it => itemText(scn, it, ctx)).filter(nonEmpty),
    actions: d.actions.map(it => itemText(scn, it, ctx)).filter(nonEmpty),
    warningIssued: issued,
    warningWhom: whom,
    auth: AUTH_ROWS.map(r => {
      const a = d.auth[r.key];
      const typed = (a.txt || '').trim();
      const mode = a.mode || (typed ? 'write' : 'na');
      const txt = mode === 'write' ? (typed || r.ph) : 'N/A';
      return { label: r.label, whoLabel: r.whoLabel, inv: a.inv || 'N/A', txt };
    }),
  };
}

export function reportStrings(r: Report): string[] {
  return [r.propertyId, r.reporter, r.date, r.offenders, r.victims, r.witnesses, r.lead]
    .concat(r.bullets, r.actions, [r.warningIssued, r.warningWhom], r.auth.map(a => `${a.inv} ${a.txt}`));
}
export function countPlaceholders(r: Report): number {
  return reportStrings(r).reduce((n, s) => n + countPh(s), 0);
}

const PORT_RE = /\b[A-Z]{2,5}\/\d{3,10}\b/gi;
export function portRefs(text: unknown): string[] {
  const seen: string[] = [];
  // [bracketed placeholders] contain example refs (e.g. CIU/123456) that must never count as real ones
  const m: string[] = String(text || '').replace(/\[[^\]\n]*\]/g, ' ').match(PORT_RE) || [];
  m.forEach(x => {
    const u = x.toUpperCase();
    if (seen.indexOf(u) < 0) seen.push(u);
  });
  return seen;
}

export function reportFileName(r: Report): string {
  const parts = ['IR'];
  const iso = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.date);
  parts.push(iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : 'undated');
  if (!isPh(r.propertyId)) {
    const num = /^\s*(\d+)/.exec(r.propertyId);
    parts.push(num ? num[1] : slug(r.propertyId).slice(0, 20));
  }
  const sl = slug(r.scenarioLabel);
  parts.push(sl.length > 34 ? sl.slice(0, 35).replace(/-[^-]*$/, '') : sl);
  const refs = portRefs(r.offenders);
  if (refs.length) parts.push(refs[0].replace('/', '-'));
  return `${parts.filter(Boolean).join('_')}.docx`;
}

/* ---------- email ---------- */
export function autoEmailType(state: BuilderState, r: Report): string {
  if (state.review) return 'review';
  if (/^(Requesting|Please issue)$/i.test(r.warningIssued)) return 'warning';
  return 'standard';
}
export function emailType(state: BuilderState, r: Report): string {
  const t = state.emailType;
  return t && t !== 'auto' && EMAIL_TYPES.some(x => x[0] === t) ? t : autoEmailType(state, r);
}
export function hotelName(r: Report): string {
  if (isPh(r.propertyId)) return '[Hotel Name]';
  const p = r.propertyId.trim();
  let m = /^\d+\s*[-–]?\s*\((.+)\)\s*$/.exec(p);
  if (m) return m[1].trim();
  m = /^\d+\s*[-–]\s*(.+)$/.exec(p);
  return m ? m[1].trim() : p;
}
export function subjectSUs(r: Report, state: BuilderState): string {
  let list: string[] = [];
  if (r.offenders !== 'N/A' && !isPh(r.offenders)) list = r.offenders.split('\n').map(x => x.trim()).filter(Boolean);
  if (!list.length) {
    const defs = defsFor(getScenario(state.scenarioId));
    ['su', 'su2'].forEach(k => {
      const v = String(state.values[k] || '').trim();
      if (v && defs[k]) list.push(v);
    });
  }
  return list.length ? list.join(' & ') : '[SU Full Name (Port Ref)]';
}
export function incidentType(r: Report, state: BuilderState): string {
  const scn = getScenario(state.scenarioId);
  if (scn.id === 'blank') return r.lead && !countPh(r.lead) ? r.lead.replace(/[.\s]+$/, '') : '[Incident Type]';
  return scn.label;
}
export function emailSubject(r: Report, state: BuilderState): string {
  const kind = emailType(state, r);
  const prefix = (EMAIL_TYPES.find(x => x[0] === kind) || EMAIL_TYPES[0])[2];
  const date = isPh(r.date) ? '[Date]' : r.date;
  return `${prefix}Incident Report – ${[incidentType(r, state), subjectSUs(r, state), date, hotelName(r)].join(' – ')}`;
}
export function emailBody(r: Report, state: BuilderState): string {
  const kind = emailType(state, r);
  const who = isPh(r.reporter) ? '' : r.reporter;
  const L: string[] = [];
  L.push(kind === 'review' ? 'Hi,' : 'Hi CST team,', '');
  const intro: Record<string, string> = {
    standard: 'Please find attached the incident report for the incident below.',
    warning: 'Please find attached the incident report for the incident below. A warning letter is requested for the SU(s) listed.',
    review: 'Please find attached an incident report for review before it is submitted to CST, as the circumstances differ from the standard scenario.',
    updated: 'Please find attached the updated incident report for the incident below. This replaces the version sent previously.',
    hpn: 'Please find attached the HPN incident report for the incident below.',
  };
  L.push(intro[kind]);
  L.push('');
  L.push(`Site: ${isPh(r.propertyId) ? '' : r.propertyId}`);
  L.push(`Date of incident: ${isPh(r.date) ? '' : r.date}`);
  L.push(`Incident: ${r.lead && !countPh(r.lead) ? r.lead : incidentType(r, state)}`);
  L.push(`SU(s): ${r.offenders === 'N/A' || isPh(r.offenders) ? 'N/A' : r.offenders.replace(/\n/g, '; ')}`);
  L.push(`Warning letter: ${r.warningIssued}${r.warningIssued !== 'N/A' && !isPh(r.warningWhom) ? ` (${r.warningWhom.replace(/\n/g, ', ')})` : ''}`);
  L.push('');
  if (reportStrings(r).join(' ').match(/photo|picture/i)) L.push('Photos of the evidence are attached.', '');
  L.push('Kind regards,');
  if (who) L.push(who);
  return L.join('\n');
}

/* ---------- checks ---------- */
export interface ReportCheck {
  lvl: 'warn' | 'info';
  text: string;
}
export function reportChecks(state: BuilderState, r: Report, now: Date = new Date()): ReportCheck[] {
  const out: ReportCheck[] = [];
  const scn = getScenario(state.scenarioId);
  const n = countPlaceholders(r);
  if (n) out.push({ lvl: 'warn', text: `${n} item${n > 1 ? 's are' : ' is'} still in red in the report.` });
  if (state.core.offendersMode !== 'na' && !isPh(r.offenders) && !portRefs(r.offenders).length) {
    out.push({ lvl: 'warn', text: 'Offenders: no port reference found – use the format John Smith (CIU/123456).' });
  }
  ['su', 'su2'].forEach(k => {
    const v = String(state.values[k] || '').trim();
    if (v && scn.fields.some(f => (Array.isArray(f) ? f[0] : f) === k) && !portRefs(v).length) {
      out.push({ lvl: 'warn', text: `${k === 'su' ? 'SU' : 'Other SU'} name has no port reference – e.g. John Smith (CIU/123456).` });
    }
  });
  if (state.core.date) {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (state.core.date > today) out.push({ lvl: 'warn', text: 'The date of incident is in the future.' });
  }
  if (/^(Requesting|Please issue|Yes)$/.test(r.warningIssued) && !portRefs(r.warningWhom).length && !isPh(r.warningWhom)) {
    out.push({ lvl: 'warn', text: 'Warning letter: “To whom” should list the port reference number(s).' });
  }
  if (scn.draft) out.push({ lvl: 'warn', text: 'This scenario uses draft wording that has not been agreed yet – send the report for review.' });
  if (state.review) out.push({ lvl: 'info', text: 'Marked for review – send it to your line manager before submitting to CST.' });
  if (reportStrings(r).join(' ').match(/photo|picture/i)) out.push({ lvl: 'info', text: 'Remember to attach the photos to the email.' });
  return out;
}

export function reportPlainText(r: Report): string {
  const L: string[] = [];
  L.push('INCIDENT REPORT', '');
  L.push(`Property ID: ${r.propertyId}`);
  L.push(`Person Reporting: ${r.reporter}`);
  L.push(`Date of Incident: ${r.date}`);
  L.push(`Offenders (Name/Port): ${r.offenders}`);
  L.push(`Victims (Name/Port): ${r.victims}`);
  L.push(`Witnesses (SUs) (Name/Port): ${r.witnesses}`, '');
  L.push('Incident Description:');
  if (r.lead) L.push(r.lead);
  r.bullets.forEach(b => L.push(`  • ${b}`));
  L.push('', 'Action Taken:');
  r.actions.forEach(a => L.push(`  • ${a}`));
  L.push('', `Warning Letter Issued?: ${r.warningIssued}    To Whom?: ${r.warningWhom}`, '', 'Reported Authorities:');
  r.auth.forEach(a => L.push(`  ${a.label} ${a.inv}    ${a.whoLabel}: ${a.txt}`));
  return L.join('\n');
}

/* ---------- mapping onto the standard HO report fields (saved reports, PDF, classic form) ---------- */
function toPeople(text: string, mode: PeopleMode, ph: string): { id: string; name: string; portRef: string }[] {
  if (mode === 'na') return [{ id: 'p-0', name: 'N/A', portRef: '' }];
  const lines = (text.trim() || ph).split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map((line, i) => {
    const m = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(line);
    if (m && portRefs(m[2]).length) return { id: `p-${i}`, name: m[1].trim() || line, portRef: m[2].trim() };
    return { id: `p-${i}`, name: line, portRef: '' };
  });
}

/** Standard HO report field values for a builder state (merged into the saved record alongside the builder state). */
export function toFieldValues(state: BuilderState): Record<string, any> {
  const r = resolveReport(state);
  const c = state.core;
  const [safe, police, amb, fire] = r.auth;
  return {
    propertyId: r.propertyId,
    personReporting: r.reporter,
    dateOfIncident: c.date || '',
    offenders: toPeople(c.offenders, c.offendersMode, CORE_PH.offenders),
    victims: toPeople(c.victims, c.victimsMode, CORE_PH.people),
    witnesses: toPeople(c.witnesses, c.witnessesMode, CORE_PH.people),
    incidentLead: r.lead,
    incidentDescription: r.bullets.join('\n'),
    actionTaken: r.actions.join('\n'),
    warningLetterIssued: r.warningIssued,
    warningLetterToWhom: r.warningWhom,
    safeguardingInformed: safe.inv,
    safeguardingWho: safe.txt,
    policeInvolved: police.inv,
    policeCadRef: police.txt,
    ambulanceInvolved: amb.inv,
    ambulanceCadRef: amb.txt,
    fireServiceInvolved: fire.inv,
    fireCadRef: fire.txt,
    [BUILDER_KEY]: state,
  };
}

/** Suggested document title for the saved report. */
export function suggestTitle(state: BuilderState): string {
  const r = resolveReport(state);
  const su = subjectSUs(r, state);
  return `Incident Report – ${incidentType(r, state)}${su.startsWith('[') ? '' : ` – ${su}`}`;
}

/* ---------- Word document (fills the real Clearsprings template) ---------- */
const PPR_LEAD = '<w:pPr><w:spacing w:before="100" w:beforeAutospacing="1" w:after="100" w:afterAutospacing="1" w:line="276" w:lineRule="auto"/><w:ind w:left="720"/><w:jc w:val="center"/></w:pPr>';
const PPR_BUL = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="26"/></w:numPr><w:spacing w:before="100" w:beforeAutospacing="1" w:after="100" w:afterAutospacing="1" w:line="276" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>';
const PPR_ACT = '<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="14"/></w:numPr><w:spacing w:line="256" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>';

type RunKind = 'cell' | 'desc' | 'act';
const RFONT: Record<RunKind, string> = {
  cell: '<w:rFonts w:cstheme="minorHAnsi"/>',
  desc: '<w:rFonts w:eastAsia="Times New Roman" w:cstheme="minorHAnsi"/>',
  act: '<w:rFonts w:eastAsiaTheme="minorEastAsia"/>',
};
const RTAIL: Record<RunKind, string> = {
  cell: '<w:sz w:val="24"/><w:szCs w:val="24"/>',
  desc: '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:eastAsia="en-GB"/>',
  act: '<w:sz w:val="24"/><w:szCs w:val="24"/>',
};
function rpr(kind: RunKind, o: { b?: boolean; i?: boolean; red?: boolean }): string {
  return `<w:rPr>${RFONT[kind]}${o.b ? '<w:b/><w:bCs/>' : ''}${o.i ? '<w:i/><w:iCs/>' : ''}${o.red ? '<w:color w:val="EE0000"/>' : ''}${RTAIL[kind]}</w:rPr>`;
}
export function runsXml(text: string, kind: RunKind, baseBold?: boolean): string {
  let out = '';
  parseRich(text).forEach(seg => {
    const o = seg.k === 'ph' ? { b: true, red: true } : seg.k === 'it' ? { b: !!baseBold, i: true } : { b: !!baseBold };
    seg.s.split('\n').forEach((line, i) => {
      if (i > 0) out += '<w:r><w:br/></w:r>';
      if (line !== '') out += `<w:r>${rpr(kind, o)}<w:t xml:space="preserve">${esc(line).replace(/&quot;/g, '"')}</w:t></w:r>`;
    });
  });
  return out;
}
function replaceAllStr(hay: string, needle: string, value: string): string {
  return hay.split(needle).join(value);
}

/**
 * Fill the real Clearsprings Incident Report template with the report.
 * `template` is the bytes of public/templates/incident/Incident_Report_Master.docx.
 */
export async function buildIncidentDocx(
  report: Report,
  template: ArrayBuffer | Uint8Array,
  outType: 'blob' | 'uint8array' = 'blob'
): Promise<Blob | Uint8Array> {
  const zip = await JSZip.loadAsync(template);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Template is missing word/document.xml');
  let xml = await docFile.async('string');
  const tok = (name: string, content: string) => {
    const needle = `<w:r><w:t>{{${name}}}</w:t></w:r>`;
    if (xml.indexOf(needle) < 0) throw new Error(`Template marker missing: ${name}`);
    xml = replaceAllStr(xml, needle, content);
  };
  tok('PROPERTY_ID', runsXml(report.propertyId, 'cell'));
  tok('PERSON_REPORTING', runsXml(report.reporter, 'cell'));
  tok('DATE_OF_INCIDENT', runsXml(report.date, 'cell'));
  tok('OFFENDERS', runsXml(report.offenders, 'cell'));
  tok('VICTIMS', runsXml(report.victims, 'cell'));
  tok('WITNESSES', runsXml(report.witnesses, 'cell'));
  tok('WARN_ISSUED', runsXml(report.warningIssued, 'cell'));
  tok('WARN_WHOM', runsXml(report.warningWhom, 'cell'));
  const A = report.auth;
  tok('AUTH_SAFE_INV', runsXml(A[0].inv, 'cell')); tok('AUTH_SAFE_WHO', runsXml(A[0].txt, 'cell'));
  tok('AUTH_POLICE_INV', runsXml(A[1].inv, 'cell')); tok('AUTH_POLICE_CAD', runsXml(A[1].txt, 'cell'));
  tok('AUTH_AMB_INV', runsXml(A[2].inv, 'cell')); tok('AUTH_AMB_CAD', runsXml(A[2].txt, 'cell'));
  tok('AUTH_FIRE_INV', runsXml(A[3].inv, 'cell')); tok('AUTH_FIRE_CAD', runsXml(A[3].txt, 'cell'));

  let desc = '';
  if (report.lead) desc += `<w:p>${PPR_LEAD}${runsXml(report.lead, 'desc', true)}</w:p>`;
  report.bullets.forEach(b => { desc += `<w:p>${PPR_BUL}${runsXml(b, 'desc', false)}</w:p>`; });
  if (!desc) desc = '<w:p><w:pPr><w:jc w:val="both"/></w:pPr></w:p>';
  let act = '';
  report.actions.forEach(a => { act += `<w:p>${PPR_ACT}${runsXml(a, 'act', false)}</w:p>`; });
  if (!act) act = '<w:p><w:pPr><w:jc w:val="both"/></w:pPr></w:p>';
  const markDesc = '<w:p><w:r><w:t>{{DESC}}</w:t></w:r></w:p>';
  const markAct = '<w:p><w:r><w:t>{{ACTION}}</w:t></w:r></w:p>';
  if (xml.indexOf(markDesc) < 0 || xml.indexOf(markAct) < 0) throw new Error('Template marker missing: description/action');
  xml = replaceAllStr(xml, markDesc, desc);
  xml = replaceAllStr(xml, markAct, act);

  zip.file('word/document.xml', xml);

  // Don't carry the template author's personal details into generated reports.
  const core = zip.file('docProps/core.xml');
  if (core) {
    let c = await core.async('string');
    c = c.replace(/<dc:creator>[^<]*<\/dc:creator>/, '<dc:creator>SDTracker</dc:creator>')
      .replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>SDTracker</cp:lastModifiedBy>');
    zip.file('docProps/core.xml', c);
  }

  const opts = { compression: 'DEFLATE' as const, mimeType: DOCX_MIME };
  return outType === 'uint8array'
    ? zip.generateAsync({ type: 'uint8array', ...opts })
    : zip.generateAsync({ type: 'blob', ...opts });
}

export { NOTE_GENERIC };
