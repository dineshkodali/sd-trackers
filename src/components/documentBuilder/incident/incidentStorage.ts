/**
 * Incident Report Builder — on-this-computer settings and unfinished-report storage.
 *
 * - "Remember my name and site" keeps only Person Reporting + Property (never SU details).
 * - "Keep an unfinished report after the browser is closed" is OFF by default: the draft then
 *   lives in sessionStorage only and is forgotten when the browser closes (safe for shared PCs).
 * Every storage access is wrapped: storage can be unavailable (private mode, blocked cookies).
 */

import { freshState, normalizeState, sanitizeState, type BuilderState } from './incidentEngine';

const SET_KEY = 'sdt_ir_builder_settings';
const STORE_KEY = 'sdt_ir_builder_draft';

export interface BuilderSettings {
  remember: boolean;
  keep: boolean;
  me: { reporter: string; propertyChoice: string; propertyId: string } | null;
}
export const DEFAULT_SETTINGS: BuilderSettings = { remember: true, keep: false, me: null };

function ls(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
function ss(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function loadSettings(): BuilderSettings {
  try {
    const o = JSON.parse((ls() && ls()!.getItem(SET_KEY)) || 'null');
    if (o && typeof o === 'object') return { ...DEFAULT_SETTINGS, ...o };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}
export function saveSettings(s: BuilderSettings): void {
  try { ls()?.setItem(SET_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** A fresh report, pre-filled with the remembered reporter + property when enabled. */
export function startState(settings: BuilderSettings): BuilderState {
  const s = freshState();
  if (settings.remember && settings.me) {
    s.core.reporter = settings.me.reporter || '';
    s.core.propertyChoice = settings.me.propertyChoice || '';
    s.core.propertyId = settings.me.propertyId || '';
  }
  return normalizeState(s);
}

/** Save the current reporter/property for next time (no SU details). Returns the updated settings. */
export function rememberMe(state: BuilderState, settings: BuilderSettings): BuilderSettings {
  if (!settings.remember) return settings;
  const me = {
    reporter: state.core.reporter || '',
    propertyChoice: state.core.propertyChoice || '',
    propertyId: state.core.propertyId || '',
  };
  if (!settings.me && !me.reporter && !me.propertyChoice && !me.propertyId) return settings;
  if (JSON.stringify(me) === JSON.stringify(settings.me)) return settings;
  const next = { ...settings, me };
  saveSettings(next);
  return next;
}

export function readDraft(): BuilderState | null {
  try {
    const raw = (ss() && ss()!.getItem(STORE_KEY)) || (ls() && ls()!.getItem(STORE_KEY));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== 1) return null;
    return sanitizeState(o.state);
  } catch {
    return null;
  }
}
export function writeDraft(state: BuilderState, keep: boolean): void {
  const json = JSON.stringify({ v: 1, state });
  const target = keep ? ls() : ss();
  const other = keep ? ss() : ls();
  try { target?.setItem(STORE_KEY, json); } catch { /* storage not available */ }
  try { other?.removeItem(STORE_KEY); } catch { /* ignore */ }
}
export function forgetDraft(): void {
  try { ls()?.removeItem(STORE_KEY); } catch { /* ignore */ }
  try { ss()?.removeItem(STORE_KEY); } catch { /* ignore */ }
}
export function wipeAll(): void {
  forgetDraft();
  try { ls()?.removeItem(SET_KEY); } catch { /* ignore */ }
}
