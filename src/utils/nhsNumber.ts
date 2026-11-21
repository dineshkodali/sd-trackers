/**
 * UK NHS number: 10 digits, the 10th being a modulus-11 check digit.
 * Weights 10..2 are applied to the first nine digits; check = 11 - (sum mod 11), where 11 becomes 0 and 10 means the number
 * can never be valid. Spaces and hyphens are accepted on input; the number is shown as "123 456 7890".
 */

export const digitsOnly = (v?: string | null) => String(v ?? '').replace(/[\s-]/g, '');

export function isValidNhsNumber(value?: string | null): boolean {
  const d = digitsOnly(value);
  if (!/^\d{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  return check !== 10 && check === Number(d[9]);
}

/** "123 456 7890" when it is ten digits, otherwise the trimmed input unchanged. */
export function formatNhsNumber(value?: string | null): string {
  const d = digitsOnly(value);
  return /^\d{10}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(value ?? '').trim();
}

/** Only the last four digits, for screens that do not need the whole number: "••• ••• 7890". */
export function maskNhsNumber(value?: string | null): string {
  const d = digitsOnly(value);
  return /^\d{10}$/.test(d) ? `••• ••• ${d.slice(6)}` : value ? '••••' : '';
}

/** Form check: empty is fine (optional); otherwise it must be a valid number. Returns an error message or null. */
export function nhsNumberError(value?: string | null): string | null {
  if (!String(value ?? '').trim()) return null;
  return isValidNhsNumber(value) ? null : 'Enter a valid 10-digit NHS number (the last digit is a check digit), e.g. 943 476 5919.';
}
