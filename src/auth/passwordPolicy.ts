/**
 * Password rules shown to the user and applied before anything is sent. The server applies the same minimum
 * (server/routes/auth.ts MIN_PASSWORD_LENGTH) and Supabase may add its own.
 */
export const MIN_PASSWORD_LENGTH = 12;

export interface PasswordCheck {
  ok: boolean;
  lengthOk: boolean;
  matches: boolean;
  /** First problem to show, or null */
  error: string | null;
}

export function checkNewPassword(password: string, confirm: string): PasswordCheck {
  const lengthOk = password.length >= MIN_PASSWORD_LENGTH;
  const matches = password.length > 0 && password === confirm;
  let error: string | null = null;
  if (!lengthOk) error = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (!matches) error = 'The two passwords do not match.';
  return { ok: lengthOk && matches, lengthOk, matches, error };
}
