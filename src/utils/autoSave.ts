export interface FormDraft<T> {
  data: T;
  savedAt: string; // ISO timestamp string
}

const DRAFT_PREFIX = 'sg_tracker_draft_';

// In-memory draft store for active user session — avoids local storage retention
const memoryDraftStore = new Map<string, FormDraft<any>>();

// Proactively purge any residual drafts from browser localStorage on startup
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  }
} catch {
  // Ignore
}

/**
 * Saves partial form progress to in-memory session store (no localStorage).
 */
export function saveFormDraft<T>(key: string, data: T): void {
  try {
    const draft: FormDraft<T> = {
      data,
      savedAt: new Date().toISOString()
    };
    memoryDraftStore.set(key, draft);
  } catch (err) {
    console.warn(`[AutoSave] Failed to save in-memory draft for "${key}":`, err);
  }
}

/**
 * Loads a previously saved form draft from in-memory session store if available.
 * Does not read stale data from localStorage.
 */
export function loadFormDraft<T>(key: string): FormDraft<T> | null {
  try {
    const draft = memoryDraftStore.get(key);
    return (draft as FormDraft<T>) || null;
  } catch {
    return null;
  }
}

/**
 * Clears the stored draft for the given key upon successful submission or user discard.
 */
export function clearFormDraft(key: string): void {
  try {
    memoryDraftStore.delete(key);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
    }
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
