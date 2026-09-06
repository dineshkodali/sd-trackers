export interface FormDraft<T> {
  data: T;
  savedAt: string; // ISO timestamp string
}

const DRAFT_PREFIX = 'sg_tracker_draft_';

/**
 * Saves partial form progress to browser local storage with a timestamp.
 */
export function saveFormDraft<T>(key: string, data: T): void {
  try {
    const draft: FormDraft<T> = {
      data,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(draft));
  } catch (err) {
    console.warn(`[AutoSave] Failed to save draft for "${key}":`, err);
  }
}

/**
 * Loads a previously saved form draft from local storage if available.
 */
export function loadFormDraft<T>(key: string): FormDraft<T> | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'data' in parsed && 'savedAt' in parsed) {
      return parsed as FormDraft<T>;
    }
    return {
      data: parsed as T,
      savedAt: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

/**
 * Clears the stored draft for the given key upon successful submission or user discard.
 */
export function clearFormDraft(key: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch (err) {
    console.warn(`[AutoSave] Failed to clear draft for "${key}":`, err);
  }
}

/**
 * Formats the savedAt timestamp into a human-readable time string.
 */
export function formatDraftTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'recently';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'recently';
  }
}
