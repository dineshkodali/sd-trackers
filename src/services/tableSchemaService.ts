import { TableColumnConfig } from '../types/tableSchema';
import { apiService } from './apiService';

/**
 * Administrator-defined table layouts (custom columns, ordering, visibility),
 * persisted in the `table_schemas` table - one row per module, id = module key.
 *
 * Layouts are held in an in-memory cache so that `getSchema` stays
 * synchronous for the views. AppContext hydrates the cache from the database
 * on every sync; hooks subscribe and re-render when it changes. Layouts were
 * previously kept in each browser's localStorage, so a column one
 * administrator added was invisible to everyone else.
 */

export const LEGACY_SCHEMA_STORAGE_PREFIX = 'sd_table_schema_';

type SerializedColumn = Record<string, any>;

let cache: Record<string, SerializedColumn[]> = {};
const listeners = new Set<() => void>();
let failureReporter: ((message: string) => void) | null = null;

const notify = () => listeners.forEach(listener => listener());

function readFromStorage(moduleKey: string): SerializedColumn[] | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(LEGACY_SCHEMA_STORAGE_PREFIX + moduleKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeToStorage(moduleKey: string, cols: SerializedColumn[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LEGACY_SCHEMA_STORAGE_PREFIX + moduleKey, JSON.stringify(cols));
  } catch {}
}

function removeFromStorage(moduleKey: string) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(LEGACY_SCHEMA_STORAGE_PREFIX + moduleKey);
  } catch {}
}

function serialize<T>(columns: TableColumnConfig<T>[]): SerializedColumn[] {
  return columns.map(col => ({
    key: col.key,
    label: col.label,
    type: col.type || 'text',
    required: Boolean(col.required),
    placeholder: col.placeholder || '',
    options: Array.isArray(col.options) ? col.options : undefined,
    optionCategory: (col as any).optionCategory,
    allowQuickAdd: (col as any).allowQuickAdd !== false,
    helperText: (col as any).helperText || '',
    step: (col as any).step,
    min: (col as any).min,
    max: (col as any).max,
    width: (col as any).width,
    defaultValue: typeof col.defaultValue === 'function' ? undefined : col.defaultValue,
    visibleInTable: col.visibleInTable !== false,
    visibleInView: col.visibleInView !== false,
    editable: col.editable !== false,
    isSystemMetadata: Boolean(col.isSystemMetadata),
    isCustom: Boolean(col.isCustom),
    section: col.section || 'General Information',
    colSpan: col.colSpan || 1,
    badgeColors: col.badgeColors
  }));
}

function merge<T>(saved: SerializedColumn[], defaultColumns: TableColumnConfig<T>[]): TableColumnConfig<T>[] {
  // Merge saved schema with any system metadata or dynamic callbacks in default schema
  const defaultMap = new Map(defaultColumns.map(c => [String(c.key), c]));

  const merged: TableColumnConfig<T>[] = saved.map(savedCol => {
    const defaultCol = defaultMap.get(String(savedCol.key));
    if (defaultCol) {
      return {
        ...defaultCol,
        ...savedCol,
        // Retain default callbacks like options, optionCategory, and formatters if saved one doesn't supply them
        options: defaultCol.options || savedCol.options,
        optionCategory: defaultCol.optionCategory || savedCol.optionCategory,
        allowQuickAdd: defaultCol.allowQuickAdd ?? savedCol.allowQuickAdd ?? true,
        formatValue: defaultCol.formatValue,
        defaultValue: defaultCol.defaultValue ?? savedCol.defaultValue
      } as TableColumnConfig<T>;
    }
    // Custom column added by an administrator
    return { ...savedCol, isCustom: true } as TableColumnConfig<T>;
  });

  // Ensure any missing system metadata columns are present
  defaultColumns.forEach(defCol => {
    if (defCol.isSystemMetadata && !merged.some(m => String(m.key) === String(defCol.key))) {
      merged.push(defCol);
    }
  });

  return merged;
}

const SCHEMA_ALIASES: Record<string, string[]> = {
  vendor_invoices: ['finance_invoices'],
  credit_card_bills: ['finance_credit_cards', 'finance_cc_bills'],
  delivery_notes: ['finance_delivery_notes'],
  finance_approvals: ['finance_approvals']
};

export const tableSchemaService = {
  /** Replace the cache with layouts loaded from the database + merged with local persistent store. */
  hydrate(schemas: Record<string, SerializedColumn[]>) {
    const combined: Record<string, SerializedColumn[]> = { ...schemas };

    // Inspect local storage for any existing custom layouts not yet synced to DB
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LEGACY_SCHEMA_STORAGE_PREFIX)) {
            const moduleKey = key.slice(LEGACY_SCHEMA_STORAGE_PREFIX.length);
            if (!combined[moduleKey]) {
              const localCols = readFromStorage(moduleKey);
              if (localCols && localCols.length > 0) {
                combined[moduleKey] = localCols;
              }
            }
          }
        }
      } catch {}
    }

    cache = combined;
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  setFailureReporter(reporter: ((message: string) => void) | null) {
    failureReporter = reporter;
  },

  getSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]): TableColumnConfig<T>[] {
    const candidateKeys = [moduleKey, ...(SCHEMA_ALIASES[moduleKey] || [])];
    let saved: SerializedColumn[] | null = null;

    for (const key of candidateKeys) {
      if (Array.isArray(cache[key]) && cache[key].length > 0) {
        saved = cache[key];
        break;
      }
      const local = readFromStorage(key);
      if (local && local.length > 0) {
        saved = local;
        cache[key] = local;
        break;
      }
    }

    if (!Array.isArray(saved) || saved.length === 0) return defaultColumns;
    try {
      return merge(saved, defaultColumns);
    } catch (e) {
      console.warn(`[TableSchemaService] Failed to apply schema for ${moduleKey}:`, e);
      return defaultColumns;
    }
  },

  /** Save a layout to the database and persistent local store immediately. */
  async saveSchema<T = any>(moduleKey: string, columns: TableColumnConfig<T>[]): Promise<boolean> {
    const previous = cache[moduleKey];
    const serialized = serialize(columns);
    
    // 1. Instant local persistence (ensures columns survive browser reloads & offline use)
    cache = { ...cache, [moduleKey]: serialized };
    writeToStorage(moduleKey, serialized);
    notify();

    // 2. Persist to backend database entity
    try {
      const res = await apiService.saveEntityRecord('tableSchemas', { id: moduleKey, moduleKey, columns: serialized }, {
        action: 'SETTINGS_UPDATE',
        module: 'Settings',
        targetItem: `Table layout: ${moduleKey}`,
        details: `Saved table layout for ${moduleKey} (${serialized.length} columns).`
      });

      if (!res.success) {
        console.warn(`[TableSchemaService] Remote save failed for ${moduleKey}, preserved locally:`, res.error);
        // Do NOT wipe the user's custom columns from memory or localStorage.
        failureReporter?.(`Table layout saved locally. Remote database sync warning: ${res.error}`);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn(`[TableSchemaService] Network exception saving schema for ${moduleKey}:`, err);
      failureReporter?.(`Table layout saved locally. Network warning: ${err?.message || err}`);
      return false;
    }
  },

  resetSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]): TableColumnConfig<T>[] {
    const previous = cache[moduleKey];
    const next = { ...cache };
    delete next[moduleKey];
    cache = next;
    removeFromStorage(moduleKey);
    notify();

    apiService.deleteEntityRecord('tableSchemas', moduleKey, {
      action: 'SETTINGS_UPDATE',
      module: 'Settings',
      targetItem: `Table layout: ${moduleKey}`,
      details: `Reset table layout for ${moduleKey} to system defaults.`
    }).then(res => {
      if (!res.success) {
        if (previous) {
          cache = { ...cache, [moduleKey]: previous };
          writeToStorage(moduleKey, previous);
          notify();
        }
        failureReporter?.(`Table layout for ${moduleKey} was not reset: ${res.error}`);
      }
    });
    return defaultColumns;
  }
};
