import { useState, useCallback, useMemo } from 'react';
import { TableColumnConfig } from '../types/tableSchema';
import { tableSchemaService } from '../services/tableSchemaService';

export function useTableSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]) {
  const [columns, setColumns] = useState<TableColumnConfig<T>[]>(() => {
    return tableSchemaService.getSchema(moduleKey, defaultColumns);
  });

  const saveColumns = useCallback((newCols: TableColumnConfig<T>[]) => {
    setColumns(newCols);
    tableSchemaService.saveSchema(moduleKey, newCols);
  }, [moduleKey]);

  const addColumn = useCallback((newCol: TableColumnConfig<T>) => {
    setColumns(prev => {
      // Insert custom column before any system metadata columns
      const nonSystem = prev.filter(c => !c.isSystemMetadata);
      const system = prev.filter(c => c.isSystemMetadata);
      const updated = [...nonSystem, { ...newCol, isCustom: true }, ...system];
      tableSchemaService.saveSchema(moduleKey, updated);
      return updated;
    });
  }, [moduleKey]);

  const updateColumn = useCallback((key: string, updates: Partial<TableColumnConfig<T>>) => {
    setColumns(prev => {
      const updated = prev.map(col => {
        if (String(col.key) === key) {
          return { ...col, ...updates };
        }
        return col;
      });
      tableSchemaService.saveSchema(moduleKey, updated);
      return updated;
    });
  }, [moduleKey]);

  const deleteColumn = useCallback((key: string) => {
    setColumns(prev => {
      const updated = prev.filter(col => String(col.key) !== key);
      tableSchemaService.saveSchema(moduleKey, updated);
      return updated;
    });
  }, [moduleKey]);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setColumns(prev => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      tableSchemaService.saveSchema(moduleKey, updated);
      return updated;
    });
  }, [moduleKey]);

  const resetToDefault = useCallback(() => {
    const res = tableSchemaService.resetSchema(moduleKey, defaultColumns);
    setColumns(res);
  }, [moduleKey, defaultColumns]);

  const tableColumns = useMemo(() => {
    return columns.filter(c => !c.isSystemMetadata && c.visibleInTable !== false);
  }, [columns]);

  return {
    columns,
    tableColumns,
    visibleColumns: tableColumns,
    saveColumns,
    addColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    resetToDefault
  };
}
