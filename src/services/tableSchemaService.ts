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

function serialize<T>(columns: TableColumnConfig<T>[]): SerializedColumn[] {
  return columns.map(col => ({
    key: col.key,
    label: col.label,
    type: col.type || 'text',
    required: Boolean(col.required),
    placeholder: col.placeholder || '',
    options: Array.isArray(col.options) ? col.options : undefined,
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
        // Retain default callbacks like options and formatters if saved one doesn't supply them
        options: defaultCol.options || savedCol.options,
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

export const tableSchemaService = {
  /** Replace the cache with layouts loaded from the database. */
  hydrate(schemas: Record<string, SerializedColumn[]>) {
    cache = { ...schemas };
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
    const saved = cache[moduleKey];
    if (!Array.isArray(saved) || saved.length === 0) return defaultColumns;
    try {
      return merge(saved, defaultColumns);
    } catch (e) {
      console.warn(`[TableSchemaService] Failed to apply schema for ${moduleKey}:`, e);
      return defaultColumns;
    }
  },

  /** Save a layout to the database; reverts the cache if the write is refused. */
  async saveSchema<T = any>(moduleKey: string, columns: TableColumnConfig<T>[]): Promise<boolean> {
    const previous = cache[moduleKey];
    const serialized = serialize(columns);
    cache = { ...cache, [moduleKey]: serialized };
    notify();

    const res = await apiService.saveEntityRecord('tableSchemas', { id: moduleKey, moduleKey, columns: serialized }, {
      action: 'SETTINGS_UPDATE',
      module: 'Settings',
      targetItem: `Table layout: ${moduleKey}`,
      details: `Saved table layout for ${moduleKey} (${serialized.length} columns).`
    });
    if (!res.success) {
      const next = { ...cache };
      if (previous) next[moduleKey] = previous; else delete next[moduleKey];
      cache = next;
      notify();
      failureReporter?.(`Table layout for ${moduleKey} was not saved: ${res.error}`);
      return false;
    }
    return true;
  },

  resetSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]): TableColumnConfig<T>[] {
    const previous = cache[moduleKey];
    const next = { ...cache };
    delete next[moduleKey];
    cache = next;
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
          notify();
        }
        failureReporter?.(`Table layout for ${moduleKey} was not reset: ${res.error}`);
      }
    });
    return defaultColumns;
  }
};
