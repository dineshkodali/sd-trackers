/**
 * Document Builder Module — Type Definitions
 *
 * Types for template-based document generation, field definitions,
 * live preview, and DOCX/PDF export.
 */

// ---------------------------------------------------------------------------
// Field Definitions (stored in template_versions.field_definitions JSONB)
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'number'
  | 'email'
  | 'phone'
  | 'checkbox'
  | 'repeating'
  | 'repeating_group'
  | 'attachment'
  | 'signature'
  | 'person_selector'
  | 'site_selector';

export interface RepeatingPersonItem {
  id: string;
  name: string;
  portRef?: string;
  role?: string;
  notes?: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  url?: string;
  dataUrl?: string;
  caption?: string;
  date?: string;
  sizeBytes?: number;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}

export interface TemplateFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  section: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: string[];
  validation?: FieldValidation;
  /** Column definitions for repeating (table) fields */
  columns?: { key: string; label: string; type: 'text' | 'number' | 'date' }[];
  /** Display order within the section */
  order: number;
  /** Width hint: 'full' | 'half' */
  width?: 'full' | 'half';
  /** Is this field repeatable into dynamic rows */
  repeatable?: boolean;
  /** Label for adding an item e.g. "+ Add Witness" */
  itemLabel?: string;
}


// ---------------------------------------------------------------------------
// Layout Configuration (stored in template_versions.layout_config JSONB)
// ---------------------------------------------------------------------------

export interface SectionLayout {
  id: string;
  title: string;
  order: number;
  columns?: 1 | 2;
  pageBreakBefore?: boolean;
}

export interface LayoutConfig {
  sections: SectionLayout[];
  pageSize?: 'A4' | 'Letter';
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface HeaderConfig {
  showLogo: boolean;
  showCompanyName: boolean;
  showDocumentNumber: boolean;
  showDate: boolean;
  subtitle?: string;
  confidentialityLevel?: 'Restricted' | 'Confidential' | 'Official' | 'Internal';
}

export interface FooterConfig {
  showPageNumbers: boolean;
  showGeneratedTimestamp: boolean;
  customText?: string;
}

// ---------------------------------------------------------------------------
// Template & Version Entities
// ---------------------------------------------------------------------------

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  isCurrent: boolean;
  fieldDefinitions: TemplateFieldDefinition[];
  layoutConfig: LayoutConfig;
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Document Builder Record
// ---------------------------------------------------------------------------

export type DocumentStatus = 'draft' | 'final' | 'archived';

export interface DocumentBuilderRecord {
  id: string;
  templateId: string;
  templateVersionId?: string;
  site: string;
  title: string;
  documentNumber: string;
  status: DocumentStatus;
  fieldValues: Record<string, any>;
  fieldDefinitions?: TemplateFieldDefinition[];
  layoutConfig?: LayoutConfig;
  headerConfig?: HeaderConfig;
  footerConfig?: FooterConfig;
  createdBy: string;
  createdByName: string;
  createdByRole?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByRole?: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

// ---------------------------------------------------------------------------
// Document Audit Trail (RBAC & Compliance Follow-up)
// ---------------------------------------------------------------------------

export interface DocumentAuditLog {
  id: string;
  documentId?: string;
  templateId?: string;
  action: string;
  userId: string;
  userName: string;
  userRole: string;
  userEmail?: string;
  site?: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Drag-and-Drop Template Builder Block Types
// ---------------------------------------------------------------------------

export type TemplateBlockType =
  | 'heading'
  | 'text'
  | 'field'
  | 'grid'
  | 'table'
  | 'alert'
  | 'signature'
  | 'divider';

export interface TemplateBlock {
  id: string;
  type: TemplateBlockType;
  section: string;
  title?: string;
  content?: string;
  alertType?: 'info' | 'warning' | 'alert' | 'success';
  field?: TemplateFieldDefinition;
  gridFields?: TemplateFieldDefinition[];
  tableColumns?: { key: string; label: string; type: 'text' | 'number' | 'date' }[];
  order: number;
}

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface TemplateWithVersion extends DocumentTemplate {
  currentVersion?: TemplateVersion;
}

export interface DocumentBuilderApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Repeating Section Row
// ---------------------------------------------------------------------------

export interface RepeatingRow {
  _rowId: string;
  [key: string]: string | number;
}

