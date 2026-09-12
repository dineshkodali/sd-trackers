import React from 'react';
import { FieldOptionCategory } from './index';

export type FieldType = 
  | 'text' 
  | 'number' 
  | 'currency' 
  | 'date' 
  | 'select' 
  | 'textarea' 
  | 'checkbox' 
  | 'badge';

export interface SelectOption {
  label: string;
  value: any;
  color?: string;
  badgeBg?: string;
  badgeText?: string;
  description?: string;
}

export interface TableColumnConfig<T = any> {
  key: keyof T | string;
  label: string;
  type?: FieldType;
  options?: SelectOption[] | string[] | ((context?: any) => SelectOption[] | string[]);
  optionCategory?: FieldOptionCategory; // Links column to centralized FieldOptionCategory in AppContext
  allowQuickAdd?: boolean; // If true, enables in-modal + Add / ⚙️ Manage controls
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  editable?: boolean; // Default true. If false, rendered read-only in forms (e.g. system generated or logged-in user badge)
  visibleInTable?: boolean; // Default true. If false, present in Add/Edit/View forms but hidden from table columns
  visibleInView?: boolean; // Default true. If false, hidden from detail view modal
  isSystemMetadata?: boolean; // Default false. If true, represents internal IDs/timestamps and is excluded from Add/Edit/View unless configured
  badgeColors?: Record<string, string>; // Maps value to badge color classes (e.g. { 'High': 'bg-red-100 text-red-800' })
  step?: string | number;
  min?: number;
  max?: number;
  colSpan?: 1 | 2; // For modal grid layout (1 = half-width on desktop, 2 = full-width)
  section?: string; // Optional grouping in Add/Edit/View forms
  helperText?: string;
  renderCell?: (value: any, record: T) => React.ReactNode;
  formatValue?: (value: any) => string;
  isCustom?: boolean;
}
