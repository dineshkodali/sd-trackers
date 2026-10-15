/**
 * IncidentBuilderForm — guided "Incident Report" form for the HO Report Generator.
 *
 * Seven steps: 1 What happened? · 2 Report details · 3 Details for this incident ·
 * 4 Incident description · 5 Action taken · 6 Warning letter & authorities · 7 Check & send.
 * Fully controlled: every edit produces a new BuilderState via `onChange`.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, RotateCcw, Settings, Trash2, X, FilePlus2 } from 'lucide-react';
import {
  AUTH_ROWS,
  EMAIL_TYPES,
  NOTE_GENERIC,
  SCENARIOS,
  SITES,
  WARNING_OPTIONS,
  CST_EMAIL,
  siteText,
  type Scenario,
} from './incidentData';
import {
  applyScenario,
  autoEmailType,
  countPlaceholders,
  defsFor,
  emailBody,
  emailSubject,
  emailType,
  getScenario,
  itemText,
  makeCtx,
  newDraft,
  normalizeState,
  portRefs,
  reportChecks,
  resolveReport,
  type BuilderState,
  type Draft,
  type DraftItem,
  type Report,
} from './incidentEngine';
import type { BuilderSettings } from './incidentStorage';
import { DownloadWordButton, type DownloadGuard } from './IncidentBuilderPreview';

export interface SiteSU {
  id: string;
  name: string;
  portRef: string;
  room?: string;
  source: string;
}

interface FormProps {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  siteSUs: SiteSU[];
  /** Logged-in user's name; when set, the Housing Officer name is filled with it and cannot be edited */
  lockedHo?: string;
  settings: BuilderSettings;
  onSettingsChange: (s: BuilderSettings) => void;
  onWipe: () => void;
  onNewReport: () => void;
  guard: DownloadGuard;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/* ---------- shared styling ---------- */
const INPUT =
  'w-full px-2 py-1 text-xs border border-[#cbd5e1] rounded-xs bg-white text-[#1e293b] focus:outline-none focus:border-[#0d9488] disabled:bg-[#f1f5f9]';
const LABEL = 'block text-[10px] font-bold text-[#475569] uppercase mb-0.5';
const SMALL_BTN =
  'inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold bg-white hover:bg-[#f0fdfa] text-[#334155] border border-[#cbd5e1] hover:border-[#0d9488] rounded-xs transition-colors cursor-pointer';
const LINK_BTN = 'text-[11px] font-semibold text-[#0d9488] hover:text-[#0f766e] underline underline-offset-2 cursor-pointer';

const Panel: React.FC<{ num: number; title: string; children: React.ReactNode }> = ({ num, title, children }) => (
  <section className="bg-white border border-[#cbd5e1] rounded-xs shadow-xs p-3">
    <div className="flex items-center gap-2 mb-2">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0d9488] text-white text-[11px] font-bold">{num}</span>
      <h3 className="text-xs font-bold text-[#1e293b]">{title}</h3>
    </div>
    {children}
  </section>
);

const Field: React.FC<{ label: string; htmlFor?: string; className?: string; children: React.ReactNode }> = ({ label, htmlFor, className, children }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={LABEL}>{label}</label>
    {children}
  </div>
);

const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ value, className, ...rest }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} className={`${INPUT} resize-none overflow-hidden ${className || ''}`} {...rest} />;
};

const clone = (s: BuilderState): BuilderState => JSON.parse(JSON.stringify(s));

function scenarioText(s: Scenario): string {
  const parts: string[] = [s.label, s.sub, s.group, typeof s.lead === 'string' ? s.lead : ''];
  const defs = defsFor(s);
  Object.keys(defs).forEach(k => parts.push(defs[k].label || '', defs[k].ph || '', defs[k].hint || ''));
  s.bullets.concat(s.actions).forEach(x => { if (typeof x === 'string') parts.push(x); });
  return parts.join(' ').toLowerCase();
}

const isoDay = (back: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const residentLabel = (su: SiteSU) => `${su.name}${su.portRef ? ` (${su.portRef})` : ''}`;

export const IncidentBuilderForm: React.FC<FormProps> = ({
  state, onChange, siteSUs, lockedHo, settings, onSettingsChange, onWipe, onNewReport, guard, onToast,
}) => {
  const scn = getScenario(state.scenarioId);
  const draft: Draft = state.drafts[scn.id] || newDraft(scn);
  const defs = defsFor(scn);
  const report: Report = useMemo(() => resolveReport(clone(state)), [state]);
  const checks = useMemo(() => reportChecks(state, report), [state, report]);
  const ctx = makeCtx(state, scn);

  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wipeArmed, setWipeArmed] = useState(false);
  const [otherSite, setOtherSite] = useState(state.core.propertyChoice === 'other' ? state.core.propertyId : '');
  const listRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close the settings popover when clicking anywhere else
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [settingsOpen]);

  const mutate = (fn: (s: BuilderState) => void) => {
    const next = clone(state);
    fn(next);
    onChange(normalizeState(next));
  };
  const mutateDraft = (fn: (d: Draft, s: BuilderState) => void) => mutate(s => fn(s.drafts[s.scenarioId], s));

  /* ---------- 1. scenario chips ---------- */
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = useMemo(() => {
    const out: { name: string; items: Scenario[] }[] = [];
    let matches = 0;
    SCENARIOS.forEach(s => {
      const hit = !words.length || words.every(w => scenarioText(s).indexOf(w) >= 0);
      if (hit) matches++;
      if (!hit && s.id !== state.scenarioId) return;
      let g = out.find(x => x.name === s.group);
      if (!g) { g = { name: s.group, items: [] }; out.push(g); }
      g.items.push(s);
    });
    return { out, matches };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, state.scenarioId]);

  /* ---------- 7. email / copy ---------- */
  const kind = emailType(state, report);
  const subject = emailSubject(report, state);
  const body = emailBody(report, state);
  const autoLabel = (EMAIL_TYPES.find(x => x[0] === autoEmailType(state, report)) || EMAIL_TYPES[0])[1];

  const copyText = (text: string, okMsg: string) => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); onToast(okMsg); } catch { onToast('Copy failed – select the text and copy manually', 'error'); }
      ta.remove();
    };
    try { navigator.clipboard.writeText(text).then(() => onToast(okMsg), fallback); } catch { fallback(); }
  };

  /* ---------- editable description / action lines ---------- */
  const focusLastIn = (list: 'bullets' | 'actions') => {
    requestAnimationFrame(() => {
      const tas = listRef.current?.querySelectorAll<HTMLTextAreaElement>(`textarea[data-list="${list}"]`);
      if (tas && tas.length) tas[tas.length - 1].focus();
    });
  };

  const renderItem = (list: 'lead' | 'bullets' | 'actions', item: DraftItem, idx: number) => {
    const arr = list === 'lead' ? null : draft[list];
    const setItem = (fn: (it: DraftItem) => void) => mutateDraft(d => {
      fn(list === 'lead' ? d.lead : d[list][idx]);
    });
    return (
      <div key={`${list}-${idx}-${item.ref || 'x'}`} className={`flex items-start gap-1 mb-1.5 ${item.edited ? 'border-l-2 border-[#0d9488] pl-1' : ''}`}>
        <AutoTextarea
          data-list={list}
          aria-label={list === 'lead' ? 'Incident summary' : list === 'bullets' ? 'Bullet point' : 'Action taken'}
          placeholder={list === 'lead' ? 'Incident Summary – one line (optional)' : list === 'bullets' ? 'Write a bullet point…' : 'Write an action…'}
          value={itemText(scn, item, ctx)}
          onChange={e => setItem(it => { it.text = e.target.value; it.edited = true; })}
        />
        <div className="flex gap-0.5 shrink-0">
          {arr && (
            <>
              <button type="button" className={SMALL_BTN} title="Move up" aria-label="Move up" disabled={idx === 0}
                onClick={() => mutateDraft(d => { const a = d[list as 'bullets' | 'actions']; if (idx > 0) [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; })}>
                <ArrowUp className="w-3 h-3" />
              </button>
              <button type="button" className={SMALL_BTN} title="Move down" aria-label="Move down" disabled={idx >= arr.length - 1}
                onClick={() => mutateDraft(d => { const a = d[list as 'bullets' | 'actions']; if (idx < a.length - 1) [a[idx + 1], a[idx]] = [a[idx], a[idx + 1]]; })}>
                <ArrowDown className="w-3 h-3" />
              </button>
              <button type="button" className={SMALL_BTN} title="Remove this line" aria-label="Remove this line"
                onClick={() => mutateDraft(d => { d[list as 'bullets' | 'actions'].splice(idx, 1); })}>
                <X className="w-3 h-3" />
              </button>
            </>
          )}
          {item.ref && (
            <button type="button" className={SMALL_BTN} title="Undo my edits – back to the standard wording" aria-label="Reset to standard wording"
              onClick={() => setItem(it => { it.edited = false; it.text = ''; })}>
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  /* ---------- people (offenders / victims / witnesses) ---------- */
  const people: { key: 'offenders' | 'victims' | 'witnesses'; label: string }[] = [
    { key: 'offenders', label: 'Offenders (Name / Port)' },
    { key: 'victims', label: 'Victims (Name / Port)' },
    { key: 'witnesses', label: 'Witnesses (Security, Welfare, Managers, SUs & Others)' },
  ];
  const personText = (k: 'offenders' | 'victims' | 'witnesses') => state.core[k];
  const personMode = (k: 'offenders' | 'victims' | 'witnesses') => state.core[`${k}Mode` as 'offendersMode'];

  const appendPerson = (k: 'victims' | 'witnesses', suId: string) => {
    const su = siteSUs.find(x => x.id === suId);
    if (!su) return;
    const line = residentLabel(su);
    mutate(s => {
      const existing = s.core[k].split('\n').map(x => x.trim()).filter(Boolean);
      if (!existing.includes(line)) existing.push(line);
      s.core[k] = existing.join('\n');
      s.core[`${k}Mode` as 'victimsMode'] = 'write';
    });
  };

  const appendWitnessRole = (roleTitle: string) => {
    mutate(s => {
      const existing = s.core.witnesses.split('\n').map(x => x.trim()).filter(Boolean);
      const template = `[${roleTitle}] Name: `;
      existing.push(template);
      s.core.witnesses = existing.join('\n');
      s.core.witnessesMode = 'write';
    });
  };

  const authSet = (key: string, fn: (a: Draft['auth'][string]) => void) => mutateDraft(d => fn(d.auth[key]));

  /* ---------- download ---------- */
  const phCount = countPlaceholders(report);

  return (
    <div className="space-y-2.5" ref={listRef}>
      {/* Header: settings + new report */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-[#475569] flex-1 min-w-[220px]">
          Choose what happened, fill in the details, tweak the wording if you need to, then download a finished report on the real Clearsprings Incident Report template. Anything still showing in red is something left to complete.
        </p>
        <div className="flex items-center gap-1.5 relative" ref={settingsRef}>
          <button type="button" className={SMALL_BTN} onClick={() => setSettingsOpen(o => !o)} aria-expanded={settingsOpen}>
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <button type="button" className={SMALL_BTN} onClick={onNewReport}>
            <FilePlus2 className="w-3 h-3" />
            <span>New report</span>
          </button>
          {settingsOpen && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-30 w-[320px] max-w-[calc(100vw-3rem)] bg-white border border-[#94a3b8] rounded-xs shadow-lg p-3">
              <h4 className="text-xs font-bold text-[#1e293b] mb-2">On this computer</h4>
              <label className="flex gap-2 items-start text-xs mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#0d9488]"
                  checked={settings.remember}
                  onChange={e => {
                    const next = { ...settings, remember: e.target.checked, me: e.target.checked ? settings.me : null };
                    onSettingsChange(next);
                    onToast(e.target.checked ? 'Your name and site will be remembered' : 'Your name and site will not be remembered', 'info');
                  }}
                />
                <span>
                  Remember my name and site
                  <small className="block text-[10px] text-[#64748b]">Fills in Person Reporting and Property ID for each new report. No SU details are kept.</small>
                </span>
              </label>
              <label className="flex gap-2 items-start text-xs mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-[#0d9488]"
                  checked={settings.keep}
                  onChange={e => {
                    onSettingsChange({ ...settings, keep: e.target.checked });
                    onToast(e.target.checked ? 'Unfinished reports will be kept on this computer' : 'Unfinished reports will be forgotten when the browser closes', 'info');
                  }}
                />
                <span>
                  Keep an unfinished report after the browser is closed
                  <small className="block text-[10px] text-[#64748b]">Leave this off on shared site computers. When off, the draft is forgotten when the browser closes.</small>
                </span>
              </label>
              <button
                type="button"
                className={`${SMALL_BTN} ${wipeArmed ? '!bg-[#fef2f2] !border-[#dc2626] !text-[#b91c1c]' : ''}`}
                onClick={() => {
                  if (!wipeArmed) {
                    setWipeArmed(true);
                    window.setTimeout(() => setWipeArmed(false), 4000);
                    return;
                  }
                  setWipeArmed(false);
                  setSettingsOpen(false);
                  setSearch('');
                  onWipe();
                }}
              >
                <Trash2 className="w-3 h-3" />
                <span>{wipeArmed ? 'Click again to confirm' : 'Clear everything saved on this computer'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. What happened? */}
      <Panel num={1} title="What happened?">
        <input
          type="search"
          className={`${INPUT} mb-2`}
          placeholder="Search incidents – e.g. fire, smoking, missing, kettle"
          aria-label="Search incident types"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {words.length > 0 && groups.matches === 0 && (
          <p className="text-[11px] text-[#64748b] mb-2">
            No incident type matches that – try another word, or use &ldquo;Blank – write your own&rdquo;.
          </p>
        )}
        <label htmlFor="irb_scenario" className={LABEL}>Incident type</label>
        <select
          id="irb_scenario"
          className={INPUT}
          value={state.scenarioId}
          onChange={e => onChange(applyScenario(clone(state), e.target.value))}
        >
          {groups.out.map(g => (
            <optgroup key={g.name} label={g.name}>
              {g.items.map(s => (
                <option key={s.id} value={s.id}>{s.label}{s.sub ? ` · ${s.sub}` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className={`mt-2 p-2 text-[11px] rounded-xs border space-y-1 ${state.review ? 'bg-[#fde8e6] border-[#e6a39c] text-[#7a1e16]' : 'bg-[#f0fdfa] border-[#99f6e4] text-[#134e4a]'}`}>
          {state.review && <div><b>Marked for review: </b>download the report and send it to your line manager for review before it goes to CST.</div>}
          {scn.draft && <div><b>Draft wording: </b>this scenario has not been agreed yet, so please send the report for review.</div>}
          <div><b>Before you submit: </b>{scn.note || NOTE_GENERIC}</div>
          {scn.note && scn.id !== 'blank' && scn.note !== NOTE_GENERIC && <div>{NOTE_GENERIC}</div>}
        </div>

        <label className="flex gap-2 items-start text-xs mt-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#0d9488]"
            checked={state.review}
            onChange={e => mutate(s => { s.review = e.target.checked; })}
          />
          <span>
            <b>This incident differs from the standard</b> (e.g. the SU became aggressive or refused to comply)
            <small className="block text-[10px] text-[#64748b]">Marks the email &ldquo;FOR REVIEW&rdquo; so it goes to your line manager before CST.</small>
          </span>
        </label>
      </Panel>

      {/* 2. Report details */}
      <Panel num={2} title="Report details">
        <div className="space-y-2">
          <Field label="Property ID" htmlFor="irb_prop">
            <select
              id="irb_prop"
              className={INPUT}
              value={state.core.propertyChoice || ''}
              onChange={e => {
                const v = e.target.value;
                mutate(s => {
                  s.core.propertyChoice = v;
                  const hit = SITES.find(x => x[0] === v);
                  if (hit) s.core.propertyId = siteText(hit);
                  else if (v === 'other') s.core.propertyId = otherSite;
                  else s.core.propertyId = '';
                });
              }}
            >
              <option value="">Select the site…</option>
              {SITES.map(x => <option key={x[0]} value={x[0]}>{x[0]} – {x[1]}</option>)}
              <option value="other">Other – type it in</option>
            </select>
            {state.core.propertyChoice === 'other' && (
              <input
                type="text"
                className={`${INPUT} mt-1`}
                aria-label="Property ID and site name"
                placeholder="Type the ID and site name, e.g. 999 (New Site Hotel)"
                value={state.core.propertyId}
                onChange={e => { setOtherSite(e.target.value); mutate(s => { s.core.propertyId = e.target.value; }); }}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Person reporting" htmlFor="irb_reporter">
              <input
                id="irb_reporter"
                type="text"
                className={INPUT}
                placeholder="Name & role, e.g. John Smith (HO)"
                value={state.core.reporter}
                onChange={e => mutate(s => { s.core.reporter = e.target.value; })}
              />
            </Field>
            <Field label="Date of incident" htmlFor="irb_date">
              <input
                id="irb_date"
                type="date"
                className={INPUT}
                value={state.core.date}
                onChange={e => mutate(s => { s.core.date = e.target.value; })}
              />
              <div className="flex gap-2 mt-1">
                <button type="button" className={LINK_BTN} onClick={() => mutate(s => { s.core.date = isoDay(0); })}>Today</button>
                <button type="button" className={LINK_BTN} onClick={() => mutate(s => { s.core.date = isoDay(1); })}>Yesterday</button>
              </div>
            </Field>
          </div>

          {people.map(p => {
            const mode = personMode(p.key);
            return (
              <Field key={p.key} label={p.label} htmlFor={`irb_${p.key}`}>
                <div className={`grid gap-1 ${mode === 'write' ? 'grid-cols-[110px_1fr]' : 'grid-cols-[110px]'}`}>
                  <select
                    id={`irb_m_${p.key}`}
                    className={INPUT}
                    aria-label={`${p.label}: N/A or write names`}
                    value={mode}
                    onChange={e => mutate(s => {
                      s.core[`${p.key}Mode` as 'offendersMode'] = e.target.value as 'na' | 'write';
                      if (p.key === 'offenders') s.core.offendersModeAuto = false;
                    })}
                  >
                    <option value="na">N/A</option>
                    <option value="write">Write names{'…'}</option>
                  </select>
                  {mode === 'write' && (
                    <AutoTextarea
                      id={`irb_${p.key}`}
                      placeholder="e.g. John Smith (CIU/123456) — one per line if more than one"
                      value={personText(p.key)}
                      onChange={e => mutate(s => {
                        s.core[p.key] = e.target.value;
                        if (p.key === 'offenders') s.core.offendersEdited = e.target.value.trim() !== '';
                      })}
                    />
                  )}
                </div>
                {p.key === 'offenders' && defs.su && mode !== 'na' && (
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    Filled in from the SU field in step 3 {'–'} type here to override (one per line if more than one).
                  </p>
                )}
                {p.key !== 'offenders' && siteSUs.length > 0 && (
                  <select
                    className={`${INPUT} mt-1`}
                    aria-label={`Add a resident to ${p.label}`}
                    value=""
                    onChange={e => appendPerson(p.key as 'victims' | 'witnesses', e.target.value)}
                  >
                    <option value="">+ Add a resident from site records{'…'}</option>
                    {siteSUs.map(su => <option key={su.id} value={su.id}>{residentLabel(su)}{su.room ? ` • Room ${su.room}` : ''} [{su.source}]</option>)}
                  </select>
                )}
                {p.key === 'witnesses' && (
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <span className="text-[10px] text-[#64748b] font-medium">+ Quick add witness:</span>
                    <button
                      type="button"
                      onClick={() => appendWitnessRole('Security Staff')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300"
                    >
                      + Security Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => appendWitnessRole('Welfare Staff')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-300"
                    >
                      + Welfare Staff
                    </button>
                    <button
                      type="button"
                      onClick={() => appendWitnessRole('Manager')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded border border-indigo-300"
                    >
                      + Manager
                    </button>
                    <button
                      type="button"
                      onClick={() => appendWitnessRole('Other Witness')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300"
                    >
                      + Other Witness
                    </button>
                  </div>
                )}
              </Field>
            );
          })}
        </div>
      </Panel>

      {/* 3. Details for this incident */}
      <Panel num={3} title="Details for this incident">
        <p className="text-[11px] text-[#64748b] mb-2">These fill the gaps in the wording below automatically.</p>
        {Object.keys(defs).length === 0 ? (
          <p className="text-[11px] text-[#64748b]">Nothing to fill in for this one {'–'} write the wording in the next step.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.keys(defs).map(k => {
              const d = defs[k];
              if (d.showIf && state.values[d.showIf.key] !== d.showIf.eq) return null;
              const id = `irb_f_${k}`;
              const wide = d.type === 'text' || d.type === 'textarea';
              const val = state.values[k] || (d.type === 'select' && d.options ? d.options[0][0] : '');
              const set = (v: string) => mutate(s => { s.values[k] = v; });
              return (
                <Field key={k} label={d.label} htmlFor={id} className={wide ? 'sm:col-span-2' : ''}>
                  {d.type === 'select' ? (
                    <select id={id} className={INPUT} value={val} onChange={e => set(e.target.value)}>
                      {(d.options || []).map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                    </select>
                  ) : d.type === 'textarea' ? (
                    <AutoTextarea id={id} placeholder={d.hint || ''} value={state.values[k] || ''} onChange={e => set(e.target.value)} />
                  ) : (
                    <>
                      <input
                        id={id}
                        type={d.type}
                        placeholder={k === 'ho' ? 'Uses the Person Reporting name if left blank' : (d.hint || '')}
                        readOnly={k === 'ho' && !!lockedHo}
                        title={k === 'ho' && lockedHo ? 'Filled in from your login – cannot be changed' : undefined}
                        className={`${INPUT} ${k === 'ho' && lockedHo ? 'bg-[#f1f5f9] cursor-not-allowed' : ''}`}
                        value={state.values[k] || ''}
                        onChange={e => set(e.target.value)}
                      />
                      {(k === 'su' || k === 'su2') && siteSUs.length > 0 && (
                        <select
                          className={`${INPUT} mt-1`}
                          aria-label={`Pick a resident for ${d.label}`}
                          value=""
                          onChange={e => {
                            const su = siteSUs.find(x => x.id === e.target.value);
                            if (su) set(residentLabel(su));
                          }}
                        >
                          <option value="">Pick a resident from site records{'…'}</option>
                          {siteSUs.map(su => <option key={su.id} value={su.id}>{residentLabel(su)}{su.room ? ` • Room ${su.room}` : ''} [{su.source}]</option>)}
                        </select>
                      )}
                    </>
                  )}
                </Field>
              );
            })}
          </div>
        )}
      </Panel>

      {/* 4. Incident description */}
      <Panel num={4} title="Incident description">
        <p className="text-[11px] text-[#64748b] mb-2">
          Edit any line, or add your own. Anything in <code className="bg-[#f1f5f9] px-1 rounded-xs">[square brackets]</code> shows in red in the report as a reminder to complete it.
        </p>
        <label className={LABEL}>Incident Summary</label>
        {renderItem('lead', draft.lead, 0)}
        <label className={`${LABEL} mt-2`}>Bullet points</label>
        {draft.bullets.map((it, i) => renderItem('bullets', it, i))}
        <div className="flex gap-1.5 mt-1">
          <button type="button" className={SMALL_BTN} onClick={() => { mutateDraft(d => { d.bullets.push({ ref: null, text: '', edited: true }); }); focusLastIn('bullets'); }}>+ Add bullet</button>
          <button
            type="button"
            className={SMALL_BTN}
            onClick={() => { mutateDraft(d => { const nd = newDraft(scn); d.lead = nd.lead; d.bullets = nd.bullets; }); onToast('Standard description wording restored', 'info'); }}
          >
            Restore standard wording
          </button>
        </div>
      </Panel>

      {/* 5. Action taken */}
      <Panel num={5} title="Action taken">
        {draft.actions.map((it, i) => renderItem('actions', it, i))}
        <div className="flex gap-1.5 mt-1">
          <button type="button" className={SMALL_BTN} onClick={() => { mutateDraft(d => { d.actions.push({ ref: null, text: '', edited: true }); }); focusLastIn('actions'); }}>+ Add action</button>
          <button
            type="button"
            className={SMALL_BTN}
            onClick={() => { mutateDraft(d => { d.actions = newDraft(scn).actions; }); onToast('Standard action wording restored', 'info'); }}
          >
            Restore standard wording
          </button>
        </div>
      </Panel>

      {/* 6. Warning letter & authorities */}
      <Panel num={6} title="Warning letter & authorities">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Warning letter issued?" htmlFor="irb_w_issued">
            <select
              id="irb_w_issued"
              className={INPUT}
              value={draft.warning.issued}
              onChange={e => mutateDraft(d => { d.warning.issued = e.target.value; })}
            >
              {WARNING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="To whom? (Port ref numbers)" htmlFor="irb_w_whom">
            <AutoTextarea
              id="irb_w_whom"
              placeholder="e.g. CIU/123456"
              value={draft.warning.whom}
              onChange={e => mutateDraft(d => { d.warning.whom = e.target.value; })}
            />
            <button
              type="button"
              className={`${LINK_BTN} mt-1`}
              onClick={() => {
                const refs = portRefs(report.offenders);
                if (!refs.length) { onToast('No port reference found in Offenders – e.g. John Smith (CIU/123456)', 'error'); return; }
                mutateDraft(d => { d.warning.whom = refs.join('\n'); });
              }}
            >
              Use the offenders{'’'} port refs
            </button>
          </Field>
        </div>

        <label className={`${LABEL} mt-3`}>Reported authorities</label>
        <div className="space-y-1">
          {AUTH_ROWS.map(r => {
            const a = draft.auth[r.key];
            const mode = a.mode || ((a.txt || '').trim() ? 'write' : 'na');
            const isWho = r.whoLabel === 'Who?';
            return (
              <div key={r.key} className="grid grid-cols-1 sm:grid-cols-[150px_70px_130px_1fr] gap-1 items-center">
                <span className="text-xs font-semibold text-[#334155]">{r.label}</span>
                <select
                  className={INPUT}
                  aria-label={r.label}
                  value={a.inv}
                  onChange={e => authSet(r.key, x => { x.inv = e.target.value; })}
                >
                  {['N/A', 'Yes', 'No'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                  className={INPUT}
                  aria-label={`${r.whoLabel} for ${r.label}`}
                  value={mode}
                  onChange={e => authSet(r.key, x => { x.mode = e.target.value as 'na' | 'write'; })}
                >
                  <option value="na">{isWho ? 'Who' : 'CAD'}: N/A</option>
                  <option value="write">{isWho ? 'Write who…' : 'Write CAD ref…'}</option>
                </select>
                {mode === 'write' ? (
                  <input
                    type="text"
                    className={INPUT}
                    aria-label={`${r.label} ${r.whoLabel}`}
                    placeholder={isWho ? 'Name / team informed' : 'CAD / reference number'}
                    value={a.txt}
                    onChange={e => authSet(r.key, x => { x.txt = e.target.value; })}
                  />
                ) : <span />}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* 7. Check & send */}
      <Panel num={7} title="Check & send">
        <ul className="space-y-1 mb-3">
          {!checks.some(c => c.lvl === 'warn') && (
            <li className="text-xs px-2 py-1 rounded-xs bg-[#f0fdf4] text-[#166534] font-semibold">{'✓'} Everything required is filled in.</li>
          )}
          {checks.map((c, i) => (
            <li
              key={i}
              className={`text-xs px-2 py-1 rounded-xs ${c.lvl === 'warn' ? 'bg-[#fffbeb] text-[#92400e]' : 'bg-[#f0fdfa] text-[#134e4a]'}`}
            >
              {c.lvl === 'warn' ? '⚠ ' : 'ℹ '}{c.text}
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <Field label="Email type" htmlFor="irb_e_type">
            <select
              id="irb_e_type"
              className={INPUT}
              value={state.emailType || 'auto'}
              onChange={e => mutate(s => {
                s.emailType = e.target.value;
                if (s.emailType === 'review') s.review = true;
                else if (s.emailType !== 'auto') s.review = false;
              })}
            >
              <option value="auto">Automatic {'–'} {autoLabel}</option>
              {EMAIL_TYPES.map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
            </select>
            <p className="text-[10px] text-[#64748b] mt-0.5">Chosen automatically from the warning letter and review boxes {'–'} change it for an Updated or HPN IR.</p>
          </Field>
          <Field label="Email subject" htmlFor="irb_e_subject">
            <div className="grid grid-cols-[1fr_auto] gap-1 items-start">
              <input id="irb_e_subject" type="text" readOnly className={INPUT} value={subject} />
              <button type="button" className={SMALL_BTN} onClick={() => copyText(subject, 'Email subject copied')}><Copy className="w-3 h-3" /><span>Copy</span></button>
            </div>
          </Field>
          <Field label="Email message" htmlFor="irb_e_body">
            <div className="grid grid-cols-[1fr_auto] gap-1 items-start">
              <textarea id="irb_e_body" readOnly rows={7} className={`${INPUT} resize-y`} value={body} />
              <button type="button" className={SMALL_BTN} onClick={() => copyText(body, 'Email message copied')}><Copy className="w-3 h-3" /><span>Copy</span></button>
            </div>
          </Field>
          <div className="pt-1">
            <DownloadWordButton id="send" guard={guard} placeholders={phCount} />
          </div>
          <p className="text-[11px] text-[#64748b]">
            {kind === 'review'
              ? 'Copy the subject and message into a new email to your line manager, then attach the Word file and the photos.'
              : `Copy the subject and message into a new email to ${CST_EMAIL}, then attach the Word file and the photos.`}
          </p>
        </div>
      </Panel>
    </div>
  );
};
