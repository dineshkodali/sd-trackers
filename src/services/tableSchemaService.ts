import { TableColumnConfig } from '../types/tableSchema';

const STORAGE_PREFIX = 'sd_table_schema_';

export const tableSchemaService = {
  getSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]): TableColumnConfig<T>[] {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${moduleKey}`);
      if (!raw) return defaultColumns;
      const parsed: TableColumnConfig<T>[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return defaultColumns;

      // Merge saved schema with any system metadata or dynamic callbacks in default schema
      const defaultMap = new Map(defaultColumns.map(c => [String(c.key), c]));
      
      const merged: TableColumnConfig<T>[] = parsed.map(savedCol => {
        const defaultCol = defaultMap.get(String(savedCol.key));
        if (defaultCol) {
          return {
            ...defaultCol,
            ...savedCol,
            // Retain default callbacks like options and formatters if saved one doesn't supply them
            options: defaultCol.options || savedCol.options,
            formatValue: defaultCol.formatValue,
            defaultValue: defaultCol.defaultValue ?? savedCol.defaultValue
          };
        }
        // Custom column added by user
        return {
          ...savedCol,
          isCustom: true
        };
      });

      // Ensure any missing system metadata columns are present
      defaultColumns.forEach(defCol => {
        if (defCol.isSystemMetadata && !merged.some(m => String(m.key) === String(defCol.key))) {
          merged.push(defCol);
        }
      });

      return merged;
    } catch (e) {
      console.warn(`[TableSchemaService] Failed to load schema for ${moduleKey}:`, e);
      return defaultColumns;
    }
  },

  saveSchema<T = any>(moduleKey: string, columns: TableColumnConfig<T>[]): void {
    try {
      // Serialize clean schema without functions
      const serialized = columns.map(col => ({
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
      localStorage.setItem(`${STORAGE_PREFIX}${moduleKey}`, JSON.stringify(serialized));
    } catch (e) {
      console.warn(`[TableSchemaService] Failed to save schema for ${moduleKey}:`, e);
    }
  },

  resetSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]): TableColumnConfig<T>[] {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${moduleKey}`);
    } catch (e) {
      console.warn(`[TableSchemaService] Failed to reset schema for ${moduleKey}:`, e);
    }
    return defaultColumns;
  }
};
