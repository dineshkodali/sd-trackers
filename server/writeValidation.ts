/**
 * Checks on what a client sends to the generic write API, at the trusted boundary.
 *
 * Default mode is WARN: problems are logged (table, field and rule only - never the value, which can hold personal data)
 * and the write goes ahead, so old records and unusual-but-harmless data keep saving. Set WRITE_VALIDATION=strict to
 * reject a write that has problems instead. Nothing here rewrites a value.
 *
 * Checked on the record's own top-level fields:
 *   - date-like fields (name contains date, dob or birth) must be a real date in a recognised format;
 *   - link-like fields (name ends in url or link) must not use javascript:, vbscript: or data:text/html;
 *   - text must not contain control characters (other than tab, line feed and carriage return);
 *   - text must not contain a <script> element.
 * Attachment payloads (data: URIs of images / PDFs) and nested JSON are not inspected here.
 */
export interface WriteIssue { field: string; rule: 'date' | 'link' | 'control-characters' | 'script-tag' }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const UK_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2})?$/;

function realDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isRecognisedDate(value: string): boolean {
  const text = value.trim();
  let m = ISO_DATE.exec(text);
  if (m) return realDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = UK_DATE.exec(text);
  if (m) return realDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return false;
}

const DATE_FIELD = /(date|dob|birth)/i;
const LINK_FIELD = /(url|link)$/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const UNSAFE_LINK = /^\s*(javascript|vbscript):|^\s*data:text\/html/i;
const SCRIPT_TAG = /<\s*script[\s>/]/i;

export function findWriteIssues(record: unknown): WriteIssue[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  const issues: WriteIssue[] = [];
  for (const [field, value] of Object.entries(record as Record<string, unknown>)) {
    if (typeof value !== 'string' || value === '') continue;
    // Attachment bodies are large data: URIs; leave them to the upload checks.
    if (value.startsWith('data:') && !UNSAFE_LINK.test(value)) continue;
    if (DATE_FIELD.test(field) && !isRecognisedDate(value)) issues.push({ field, rule: 'date' });
    if (LINK_FIELD.test(field) && UNSAFE_LINK.test(value)) issues.push({ field, rule: 'link' });
    if (CONTROL.test(value)) issues.push({ field, rule: 'control-characters' });
    if (SCRIPT_TAG.test(value)) issues.push({ field, rule: 'script-tag' });
  }
  return issues;
}

export const writeValidationMode = (): 'warn' | 'strict' => (process.env.WRITE_VALIDATION === 'strict' ? 'strict' : 'warn');

/** Message safe to show the user: names the fields, never the values. */
export function describeIssues(issues: WriteIssue[]): string {
  const fields = Array.from(new Set(issues.map(i => i.field)));
  return `These fields have values that cannot be saved: ${fields.join(', ')}.`;
}
