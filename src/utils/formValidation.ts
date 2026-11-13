/**
 * Small, shared form validation. The same rules run for create and edit. Nothing here rewrites what the user typed:
 * values are only checked (trimmed for emptiness tests, never altered), so apostrophes and punctuation are safe.
 */
export type Rule =
  | { kind: 'required'; message?: string }
  | { kind: 'date'; message?: string; allowEmpty?: boolean; notFuture?: boolean; today?: string }
  | { kind: 'number'; min?: number; max?: number; integer?: boolean; message?: string; allowEmpty?: boolean }
  | { kind: 'oneOf'; values: readonly string[]; message?: string; allowEmpty?: boolean }
  | { kind: 'maxLength'; max: number; message?: string }
  | { kind: 'url'; message?: string; allowEmpty?: boolean };

export type Rules<K extends string = string> = Partial<Record<K, Rule[]>>;
export type Errors<K extends string = string> = Partial<Record<K, string>>;

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** A real calendar date written YYYY-MM-DD (so 2026-02-30 is rejected). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Only http(s) links are accepted, so javascript: and data: addresses cannot be stored. */
export function isSafeUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export function validateFields<K extends string>(values: Record<string, unknown>, rules: Rules<K>): Errors<K> {
  const errors: Errors<K> = {};
  for (const key of Object.keys(rules) as K[]) {
    const value = values[key];
    for (const rule of rules[key] || []) {
      const empty = isEmpty(value);
      let message = '';
      if (rule.kind === 'required') { if (empty) message = rule.message || 'This field is required'; }
      else if (empty) { if (rule.kind !== 'maxLength' && 'allowEmpty' in rule && rule.allowEmpty === false) message = 'This field is required'; }
      else if (rule.kind === 'date') {
        const text = String(value).slice(0, 10);
        if (!isValidIsoDate(text)) message = rule.message || 'Enter a valid date';
        else if (rule.notFuture && rule.today && text > rule.today) message = rule.message || 'The date cannot be in the future';
      } else if (rule.kind === 'number') {
        const n = Number(value);
        if (!Number.isFinite(n)) message = rule.message || 'Enter a number';
        else if (rule.integer && !Number.isInteger(n)) message = rule.message || 'Enter a whole number';
        else if (rule.min !== undefined && n < rule.min) message = rule.message || `Must be at least ${rule.min}`;
        else if (rule.max !== undefined && n > rule.max) message = rule.message || `Must be at most ${rule.max}`;
      } else if (rule.kind === 'oneOf') {
        if (!rule.values.includes(String(value))) message = rule.message || 'Choose one of the listed options';
      } else if (rule.kind === 'maxLength') {
        if (String(value).length > rule.max) message = rule.message || `Keep this under ${rule.max} characters`;
      } else if (rule.kind === 'url') {
        if (!isSafeUrl(String(value))) message = rule.message || 'Enter a web address starting with http:// or https://';
      }
      if (message) { errors[key] = message; break; }
    }
  }
  return errors;
}

export const hasErrors = (errors: Record<string, unknown>) => Object.keys(errors).length > 0;
