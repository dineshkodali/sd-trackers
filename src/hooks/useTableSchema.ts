import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TableColumnConfig } from '../types/tableSchema';
import { tableSchemaService } from '../services/tableSchemaService';

export function useTableSchema<T = any>(moduleKey: string, defaultColumns: TableColumnConfig<T>[]) {
  // Views often pass a freshly built array each render; keep the latest without
  // making it an effect dependency.
  const defaultsRef = useRef(defaultColumns);
  defaultsRef.current = defaultColumns;

  const [columns, setColumns] = useState<TableColumnConfig<T>[]>(() => {
    return tableSchemaService.getSchema(moduleKey, defaultColumns);
  });
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Layouts load from the database after mount and may be changed by another
  // administrator; follow the shared cache.
  useEffect(() => {
    const refresh = () => setColumns(tableSchemaService.getSchema(moduleKey, defaultsRef.current));
    refresh();
    return tableSchemaService.subscribe(refresh);
  }, [moduleKey]);

  // Persistence happens outside state updaters, which React may invoke twice.
  const commit = useCallback((next: TableColumnConfig<T>[]) => {
    setColumns(next);
    tableSchemaService.saveSchema(moduleKey, next);
  }, [moduleKey]);

  const saveColumns = useCallback((newCols: TableColumnConfig<T>[]) => {
    commit(newCols);
  }, [commit]);

  const addColumn = useCallback((newCol: TableColumnConfig<T>) => {
    const prev = columnsRef.current;
    // Insert custom column before any system metadata columns
    const nonSystem = prev.filter(c => !c.isSystemMetadata);
    const system = prev.filter(c => c.isSystemMetadata);
    commit([...nonSystem, { ...newCol, isCustom: true }, ...system]);
  }, [commit]);

  const updateColumn = useCallback((key: string, updates: Partial<TableColumnConfig<T>>) => {
    commit(columnsRef.current.map(col => (String(col.key) === key ? { ...col, ...updates } : col)));
  }, [commit]);

  const deleteColumn = useCallback((key: string) => {
    commit(columnsRef.current.filter(col => String(col.key) !== key));
  }, [commit]);

  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    const prev = columnsRef.current;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
      return;
    }
    const updated = [...prev];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    commit(updated);
  }, [commit]);

  const resetToDefault = useCallback(() => {
    const res = tableSchemaService.resetSchema(moduleKey, defaultsRef.current);
    setColumns(res);
  }, [moduleKey]);

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
