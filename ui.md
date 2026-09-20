# SD Commercial — UI Component Library & Reuse Guide (`ui.md`)

> **Comprehensive UI Reference**: This guide documents all reusable UI components, design tokens, layout blueprints, and code patterns in **SD Commercial Trackers**.  
> Use this reference to quickly copy, compose, and maintain consistent UI components across all modules.

---

## Table of Contents
1. [Master Design System & Styling Tokens](#1-master-design-system--styling-tokens)
   - [Brand Color Palette (Teal)](#brand-color-palette-teal)
   - [Fluent Neutral Surface Scale](#fluent-neutral-surface-scale)
   - [Semantic Status Colors & Badges](#semantic-status-colors--badges)
   - [Typography Hierarchy](#typography-hierarchy)
   - [Button Styles & Variants](#button-styles--variants)
   - [Form Input Styles](#form-input-styles)
   - [Custom Scrollbars & Utilities](#custom-scrollbars--utilities)
2. [Component Directory](#2-component-directory)
3. [Core Common Components](#3-core-common-components)
   - [DynamicDataTable](#dynamicdatatable)
   - [DynamicRecordFormModal](#dynamicrecordformmodal)
   - [DynamicRecordViewModal](#dynamicrecordviewmodal)
   - [FilterBar](#filterbar)
   - [SearchInput](#searchinput)
   - [Pagination](#pagination)
   - [ManageableSelect](#manageableselect)
   - [ConfirmationModal](#confirmationmodal)
   - [ExportDropdown & ExportModal](#exportdropdown--exportmodal)
   - [WeekSwitcher](#weekswitcher)
   - [CompactRecordCards (`CompactRecordCard` & `CompactRecordList`)](#compactrecordcards)
   - [TableAttachmentCell](#tableattachmentcell)
   - [AttachmentsSection](#attachmentssection)
   - [TableSchemaEditorModal](#tableschemaeditormodal)
   - [QuickOptionModal](#quickoptionmodal)
   - [QuickJumpModal](#quickjumpmodal)
   - [SessionLockModal](#sessionlockmodal)
   - [LiveDataBanner](#livedatabanner)
   - [NetworkStatusIndicator](#networkstatusindicator)
   - [AccessDeniedView](#accessdeniedview)
   - [Logo](#logo)
   - [Header & Sidebar](#header--sidebar)
4. [Dashboard & Analytics Widgets](#4-dashboard--analytics-widgets)
5. [Table Schema & Dynamic Fields System](#5-table-schema--dynamic-fields-system)
6. [Complete Operational Tracker View Blueprint](#6-complete-operational-tracker-view-blueprint)
7. [Standard Modal Form Brand Pattern (Reference Architecture)](#7-standard-modal-form-brand-pattern-reference-architecture)
   - [ASCII Layout Blueprint](#ascii-layout-blueprint)
   - [Design Tokens & Visual Hierarchy](#design-tokens--visual-hierarchy)
   - [Complete Reusable Code Template (`StandardModalForm.tsx`)](#complete-reusable-code-template-standardmodalformtsx)

---

## 1. Master Design System & Styling Tokens

### Brand Color Palette (Teal)
The primary brand identity is built around a refined teal palette:

| Token / Scale | Hex Code | Tailwind / Custom Class | Recommended Usage |
| :--- | :--- | :--- | :--- |
| **`teal-50`** | `#f0fdfa` | `bg-[#f0fdfa]` | Active row tint, light badge background, pill hover |
| **`teal-100`** | `#ccfbf1` | `bg-[#ccfbf1]` | Hover background for secondary actions |
| **`teal-200`** | `#99f6e4` | `border-[#99f6e4]` | Active borders, chip highlights |
| **`teal-300`** | `#5eead4` | `border-[#5eead4]` | Card highlight borders, focused accents |
| **`teal-400`** | `#2dd4bf` | `text-[#2dd4bf]` | Interactive elements, vibrant accents |
| **`teal-500`** | `#14b8a6` | `bg-[#14b8a6]` | Secondary interactive accent |
| **`teal-600`** | **`#0d9488`** | **`bg-[#0d9488]`** | **Primary Brand Color** (Primary CTA buttons, active state) |
| **`teal-700`** | `#0f766e` | `hover:bg-[#0f766e]` | Hover state for primary buttons, active text |
| **`teal-800`** | `#115e59` | `text-[#115e59]` | Logo emblem secondary color, dark heading accent |
| **`teal-900`** | `#134e4a` | `text-[#134e4a]` | High-contrast body text, deep brand elements |

### Fluent Neutral Surface Scale

| Surface Token | Hex Code | Class / Utility | Purpose |
| :--- | :--- | :--- | :--- |
| **Canvas** | `#f3f2f1` | `bg-[#f3f2f1]` | Main viewport app background behind cards |
| **Sidebar** | `#fbfbfa` | `bg-[#fbfbfa]` | Left navigation sidebar background |
| **Card / Modal** | `#ffffff` | `bg-white` | Surfaces for cards, modals, dropdowns, table cells |
| **Subtle** | `#faf9f8` | `bg-[#faf9f8]` | Table headers, alternate rows, summary callouts |
| **Hover** | `#edebe9` | `hover:bg-[#edebe9]` | Hover state for rows, tabs, secondary buttons |
| **Container Border**| `#e1dfdd` | `border-[#e1dfdd]` | Structural borders, card borders, dividers |
| **Input Border** | `#8a8886` | `border-[#8a8886]` | Text inputs, dropdowns, secondary button outlines |
| **Text Muted** | `#605e5c` | `text-[#605e5c]` | Table headers, secondary labels, metadata |
| **Text Body** | `#323130` | `text-[#323130]` | Standard reading text, input text |
| **Text Headings** | `#242424` | `text-[#242424]` | Section titles, modal titles, page headers |

### Semantic Status Colors & Badges

```tsx
// Status badge class mapping
export const STATUS_BADGE_CLASSES: Record<string, string> = {
  // Danger / High Risk
  'High': 'bg-red-100 text-red-800 border-red-200',
  'Critical': 'bg-red-100 text-red-800 border-red-200',
  'Urgent': 'bg-red-100 text-red-800 border-red-200',
  'Overdue': 'bg-red-100 text-red-800 border-red-200',
  'Blocked': 'bg-red-100 text-red-800 border-red-200',

  // Warning / Medium Risk
  'Medium': 'bg-amber-100 text-amber-800 border-amber-200',
  'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
  'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
  'Under Review': 'bg-amber-100 text-amber-800 border-amber-200',

  // Success / Completed
  'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Low': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Resolved': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Approved': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Active': 'bg-emerald-100 text-emerald-800 border-emerald-200',

  // Info / Routine
  'Open': 'bg-blue-100 text-blue-800 border-blue-200',
  'Scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
  'New': 'bg-blue-100 text-blue-800 border-blue-200',

  // Purple / Specialized
  'Specialist': 'bg-purple-100 text-purple-800 border-purple-200',
  'Escalated': 'bg-purple-100 text-purple-800 border-purple-200'
};
```

Standard badge element markup:
```html
<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">
  Active
</span>
```

### Typography Hierarchy

* **Font Family**: `'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
* **Monospace**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

| Level | Size | Weight | Line-Height | Tailwind Classes | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display H1** | `24px (1.5rem)` | 700 (Bold) | `32px` | `text-2xl font-bold text-[#242424]` | Page view title |
| **Section H2** | `18px (1.125rem)` | 600 (SemiBold) | `24px` | `text-lg font-semibold text-[#242424]` | Modal title, major section |
| **Card H3** | `14px (0.875rem)` | 600 (SemiBold) | `20px` | `text-sm font-semibold text-[#242424]` | Widget header, fieldset |
| **Label H4** | `12px (0.75rem)` | 600 / 700 | `16px` | `text-xs font-semibold text-[#605e5c]` | Form labels, table header |
| **Body Regular** | `13px` | 400 (Regular) | `20px` | `text-[13px] text-[#323130]` | Descriptive copy |
| **Table / Input**| `12px (0.75rem)` | 400 / 500 | `18px` | `text-xs text-[#323130]` | Inputs, selects, table cells |
| **Caption** | `11px (0.6875rem)`| 500 (Medium) | `14px` | `text-[11px] text-[#605e5c]` | Helper hints, timestamps |
| **Micro Badge** | `10px (0.625rem)` | 700 (Bold) | `12px` | `text-[10px] font-bold uppercase` | Status pills, count badges |
| **Monospace** | `11px / 12px` | 500 (Medium) | `14px` | `font-mono text-xs text-[#323130]` | Port/NASS refs, URNs, IDs |

### Button Styles & Variants

```tsx
// 1. Primary Action Button (Teal)
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-semibold rounded-xs shadow-xs transition-colors cursor-pointer">
  <Plus className="w-3.5 h-3.5" />
  <span>Add Record</span>
</button>

// 2. Secondary Outline Button
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] text-xs font-semibold rounded-xs transition-colors cursor-pointer">
  <RotateCcw className="w-3.5 h-3.5" />
  <span>Reset Filters</span>
</button>

// 3. Danger Destructive Button
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#a4262c] hover:bg-[#8f1f25] text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer">
  <Trash2 className="w-3.5 h-3.5" />
  <span>Delete Permanently</span>
</button>

// 4. Soft Danger Button
<button className="inline-flex items-center gap-1 px-2 py-1 bg-[#fdf3f2] hover:bg-[#fae7e6] text-[#a4262c] border border-[#f5b8b5] rounded-xs font-medium text-[11px] transition-colors cursor-pointer">
  <LogOut className="w-3 h-3" />
  <span>Sign Out</span>
</button>

// 5. Ghost / Icon Button
<button className="p-1.5 text-[#605e5c] hover:text-[#0d9488] hover:bg-[#f0fdfa] rounded-xs transition-colors cursor-pointer">
  <Edit3 className="w-3.5 h-3.5" />
</button>
```

### Form Input Styles

```tsx
// Standard Text / Number Input
<input
  type="text"
  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs text-[#323130] placeholder-[#8a8886] focus:outline-2 focus:outline-[#71afe5] transition-all"
  placeholder="Enter value..."
/>

// Select Dropdown
<select className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs text-[#323130] focus:outline-2 focus:outline-[#71afe5] transition-all">
  <option value="">Select option...</option>
</select>

// Textarea
<textarea
  rows={3}
  className="w-full px-2.5 py-1.5 bg-white border border-[#8a8886] rounded-xs text-xs text-[#323130] placeholder-[#8a8886] focus:outline-2 focus:outline-[#71afe5] transition-all"
  placeholder="Enter detailed notes..."
/>

// Locked / Read-Only Input State
<div className="relative">
  <input
    type="text"
    readOnly
    disabled
    className="w-full px-2.5 py-1.5 bg-[#faf9f8] border border-[#8a8886] rounded-xs text-xs text-[#605e5c] cursor-not-allowed opacity-80"
  />
  <Lock className="w-3.5 h-3.5 text-amber-600 absolute right-2.5 top-2.5" />
</div>
```

### Custom Scrollbars & Utilities

```css
/* Thin custom scrollbar defined in src/index.css */
.custom-scrollbar, .slim-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}
```

---

## 2. Component Directory

All reusable components are located in [`src/components/common/`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common):

```
src/components/common/
├── AccessDeniedView.tsx          # RBAC forbidden state view
├── AttachmentsSection.tsx        # File uploader & attachment manager
├── CompactRecordCards.tsx        # Mobile-friendly card list & card view
├── ConfirmationModal.tsx         # Unified confirmation dialog (hook-driven)
├── DynamicDataTable.tsx          # Schema-driven responsive data table
├── DynamicRecordFormModal.tsx    # Schema-driven dynamic Add/Edit modal
├── DynamicRecordViewModal.tsx    # Schema-driven detail view modal
├── ExportDropdown.tsx            # Split button for CSV & PDF exports
├── ExportModal.tsx               # Full-feature export preview & config dialog
├── FilterBar.tsx                 # Standard horizontal filter toolbar
├── GlobalSearchBar.tsx           # Global search with Ctrl+K shortcut
├── Header.tsx                    # Fixed top navigation header
├── LiveDataBanner.tsx            # Alert banner for offline / sync issues
├── Logo.tsx                      # SD Commercial branded logo & emblem
├── ManageableSelect.tsx          # Select input with "+ Add" & "⚙️ Manage" options
├── NetworkStatusIndicator.tsx    # Live network/database connectivity status
├── Pagination.tsx                # Standard table pagination & page-size selector
├── QuickJumpModal.tsx            # Quick page navigation switcher (Cmd+J / Ctrl+J)
├── QuickOptionModal.tsx          # In-place modal for adding dropdown options
├── SearchInput.tsx               # Search box with in-memory recent search cache
├── SessionLockModal.tsx          # Security lock overlay on inactivity
├── Sidebar.tsx                   # Main navigation sidebar with badges
├── TableAttachmentCell.tsx       # Table cell renderer for file attachments
├── TableSchemaEditorModal.tsx    # Custom column configuration & reordering
└── WeekSwitcher.tsx              # Weekly period switcher for operational logs
```

---

## 3. Core Common Components

---

### `DynamicDataTable`
**File:** [`src/components/common/DynamicDataTable.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/DynamicDataTable.tsx)  
**Purpose:** High-performance, schema-driven data table supporting sorting, attachment previews, action menus (View, Edit, Delete, Archive, Restore), column formatting, and empty states. Automatically falls back to `CompactRecordCards` on mobile screens when compact mode is active.

#### TypeScript Interface
```tsx
export interface DynamicDataTableProps<T = any> {
  columns: TableColumnConfig<T>[];
  data: T[];
  onView?: (record: T) => void;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void;
  onArchive?: (record: T) => void;
  onRestore?: (record: T) => void;
  sortField?: string;
  sortAsc?: boolean;
  onSort?: (field: string) => void;
  canEdit?: (record: T) => boolean;
  canDelete?: (record: T) => boolean;
  emptyMessage?: string;
  minWidth?: string; // Default: '1200px'
}
```

#### Code Snippet
```tsx
import { DynamicDataTable } from '../common/DynamicDataTable';

<DynamicDataTable
  columns={columns}
  data={paginatedRecords}
  sortField={sortKey}
  sortAsc={sortOrder === 'asc'}
  onSort={(field) => handleSort(field)}
  onView={(record) => setSelectedViewRecord(record)}
  onEdit={(record) => handleOpenEditModal(record)}
  onDelete={(record) => handleDeleteRecord(record)}
  canEdit={() => canEditRecord('myModule')}
  canDelete={() => canDeleteRecord('myModule')}
  emptyMessage="No operational records match your filters."
  minWidth="1100px"
/>
```

---

### `DynamicRecordFormModal`
**File:** [`src/components/common/DynamicRecordFormModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/DynamicRecordFormModal.tsx)  
**Purpose:** Schema-driven Add and Edit dialog with automatic field rendering based on `TableColumnConfig`. Supports text, number, currency, date, textarea, checkbox, and manageable select with in-place option addition. Handles multi-file attachments automatically.

#### TypeScript Interface
```tsx
export interface DynamicRecordFormModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  columns: TableColumnConfig<T>[];
  initialValues?: Partial<T> | null;
  onSave?: (record: any) => Promise<void> | void;
  onSubmit?: (record: any) => Promise<void> | void;
  isEdit?: boolean;
  submitLabel?: string;
  contextData?: Record<string, any>;
}
```

#### Code Snippet
```tsx
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';

<DynamicRecordFormModal
  isOpen={isFormModalOpen}
  onClose={() => setIsFormModalOpen(false)}
  title={editingRecord ? 'Edit Operational Record' : 'Log New Record'}
  columns={columns}
  initialValues={editingRecord}
  isEdit={Boolean(editingRecord)}
  onSubmit={async (record) => {
    if (editingRecord) {
      await updateRecord(record);
    } else {
      await addRecord(record);
    }
    setIsFormModalOpen(false);
  }}
  submitLabel={editingRecord ? 'Save Changes' : 'Create Record'}
/>
```

---

### `DynamicRecordViewModal`
**File:** [`src/components/common/DynamicRecordViewModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/DynamicRecordViewModal.tsx)  
**Purpose:** Read-only modal displaying record details organized into 2-column key-value pairs, formatted badges, metadata stamps, and attached file previews. Includes a direct "Edit Record" button if the user has permission.

#### TypeScript Interface
```tsx
export interface DynamicRecordViewModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  record: Partial<T> | null;
  columns: TableColumnConfig<T>[];
  onEdit?: () => void;
  canEdit?: boolean;
}
```

#### Code Snippet
```tsx
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';

<DynamicRecordViewModal
  isOpen={Boolean(viewRecord)}
  onClose={() => setViewRecord(null)}
  title="Record Overview"
  record={viewRecord}
  columns={columns}
  canEdit={canEditRecord('myModule')}
  onEdit={() => {
    const rec = viewRecord;
    setViewRecord(null);
    setEditingRecord(rec);
  }}
/>
```

---

### `FilterBar`
**File:** [`src/components/common/FilterBar.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/FilterBar.tsx)  
**Purpose:** Standardized toolbar for operational views containing Site/Property filter, Month filter, Status filter, Search Input, Export Menu trigger, and Reset button. Automatically enforces RBAC hotel restrictions.

#### TypeScript Interface
```tsx
export interface FilterBarProps {
  siteFilter: string;
  setSiteFilter: (val: string) => void;
  monthFilter: string;
  setMonthFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onReset: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onOpenExport?: (format: 'pdf' | 'csv') => void;
  totalFilteredCount: number;
  searchStorageKey?: string;
  searchPlaceholder?: string;
}
```

#### Code Snippet
```tsx
import { FilterBar } from '../common/FilterBar';

<FilterBar
  siteFilter={siteFilter}
  setSiteFilter={setSiteFilter}
  monthFilter={monthFilter}
  setMonthFilter={setMonthFilter}
  statusFilter={statusFilter}
  setStatusFilter={setStatusFilter}
  searchQuery={searchQuery}
  setSearchQuery={setSearchQuery}
  onReset={() => {
    setSiteFilter('all');
    setMonthFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  }}
  onOpenExport={(format) => handleOpenExportModal(format)}
  totalFilteredCount={filteredData.length}
  searchStorageKey="my_module_filter_search"
  searchPlaceholder="Search by resident name, Port/NASS ref, room..."
/>
```

---

### `SearchInput`
**File:** [`src/components/common/SearchInput.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/SearchInput.tsx)  
**Purpose:** Clean text input with search icon, clear button (X), in-memory recent searches dropdown, and debounce support.

#### TypeScript Interface
```tsx
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  storageKey?: string;
  className?: string;
  inputClassName?: string;
  onSearchSubmit?: (value: string) => void;
}
```

#### Code Snippet
```tsx
import { SearchInput } from '../common/SearchInput';

<SearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search records or identifiers..."
  storageKey="transport_search"
  className="w-full sm:w-72"
/>
```

---

### `Pagination`
**File:** [`src/components/common/Pagination.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/Pagination.tsx)  
**Purpose:** Footer pagination control with rows-per-page dropdown (10, 25, 50, 100), record counter ("Showing 1 - 25 of 150"), and first/prev/next/last page buttons.

#### TypeScript Interface
```tsx
export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}
```

#### Code Snippet
```tsx
import { Pagination } from '../common/Pagination';

<Pagination
  currentPage={currentPage}
  totalItems={filteredData.length}
  pageSize={pageSize}
  onPageChange={(page) => setCurrentPage(page)}
  onPageSizeChange={(size) => {
    setPageSize(size);
    setCurrentPage(1);
  }}
/>
```

---

### `ManageableSelect`
**File:** [`src/components/common/ManageableSelect.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/ManageableSelect.tsx)  
**Purpose:** Dropdown select input connected to the system's `fieldOptions` taxonomy. Allows users to pick an option or immediately click "+ Add New Option" to open `QuickOptionModal` without leaving the active workflow.

#### TypeScript Interface
```tsx
export interface ManageableSelectProps {
  label?: string;
  name?: string;
  value: any;
  onChange: (value: any) => void;
  options?: Array<string | SelectOption>;
  optionCategory?: FieldOptionCategory;
  allowQuickAdd?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  error?: string;
  badgeColors?: Record<string, string>;
  helperText?: string;
  showManageActions?: boolean;
}
```

#### Code Snippet
```tsx
import { ManageableSelect } from '../common/ManageableSelect';

<ManageableSelect
  label="Incident Type"
  value={selectedType}
  onChange={(val) => setSelectedType(val)}
  optionCategory="incidentTypes"
  allowQuickAdd={true}
  placeholder="Select incident category..."
  required
/>
```

---

### `ConfirmationModal`
**File:** [`src/components/common/ConfirmationModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/ConfirmationModal.tsx)  
**Purpose:** Global confirmation dialog driven directly via `useApp().requestConfirmation()`. Displays non-destructive verification or red-toned high-risk warnings for destructive permanent deletions.

#### AppContext Trigger Usage
```tsx
import { useApp } from '../../context/AppContext';

const { requestConfirmation } = useApp();

// High-Risk Destructive Action
requestConfirmation({
  title: 'Delete Operational Record?',
  message: 'This action cannot be undone. The record will be permanently deleted from the live database.',
  confirmLabel: 'Delete Permanently',
  cancelLabel: 'Keep Record',
  isDanger: true,
  itemDetails: {
    'Record URN': record.urn,
    'Resident': record.suName,
    'Date': record.date
  },
  onConfirm: async () => {
    await deleteRecord(record.id);
  }
});
```

---

### `ExportDropdown` & `ExportModal`
**Files:** [`src/components/common/ExportDropdown.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/ExportDropdown.tsx) & [`ExportModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/ExportModal.tsx)  
**Purpose:** Multi-format export system. `ExportDropdown` renders a split button or toolbar icon; `ExportModal` provides interactive format switching (PDF / CSV), orientation selection, date filtering, column picking, and a live data preview table.

#### Code Snippet
```tsx
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';

const exportColumns: ExportColumnOption[] = [
  { id: 'urn', label: 'Reference URN' },
  { id: 'suName', label: 'Resident Name' },
  { id: 'siteName', label: 'Hotel / Site' },
  { id: 'date', label: 'Date Logged' },
  { id: 'status', label: 'Current Status' }
];

<ExportDropdown
  moduleName="Transport Requests"
  totalRecordCount={allRecords.length}
  filteredRecordCount={filteredRecords.length}
  availableColumns={exportColumns}
  onExport={({ format, scope, orientation, selectedColumns }) => {
    handleExecuteExport(format, scope, orientation, selectedColumns);
  }}
  buttonVariant="toolbar"
/>
```

---

### `WeekSwitcher`
**File:** [`src/components/common/WeekSwitcher.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/WeekSwitcher.tsx)  
**Purpose:** Week-by-week navigation bar for operational registers (e.g. food delivery logs, laundry sheets, welfare checks). Supports Jump-to-Today, Prev/Next Week chevrons, and "All Weeks" toggle.

#### TypeScript Interface
```tsx
export interface WeekOption {
  start: string;
  end: string;
  label: string;
  count?: number;
}

export interface WeekSwitcherProps {
  startDate: string;
  endDate: string;
  onWeekChange: (startDate: string, endDate: string, label: string) => void;
  availableWeeks?: WeekOption[];
  allowAllOption?: boolean;
  activeWeekCursor?: string; // 'all' or startDate ISO string
  onCursorChange?: (cursor: string) => void;
  compact?: boolean;
  className?: string;
  title?: string;
}
```

#### Code Snippet
```tsx
import { WeekSwitcher } from '../common/WeekSwitcher';

<WeekSwitcher
  startDate={currentWeekStart}
  endDate={currentWeekEnd}
  allowAllOption={true}
  activeWeekCursor={weekCursor}
  onCursorChange={(cursor) => setWeekCursor(cursor)}
  onWeekChange={(start, end, label) => {
    setCurrentWeekStart(start);
    setCurrentWeekEnd(end);
  }}
/>
```

---

### `CompactRecordCards`
**File:** [`src/components/common/CompactRecordCards.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/CompactRecordCards.tsx)  
**Purpose:** Responsive card representation of table records for mobile viewports or compact density mode. Includes `CompactRecordCard` and `CompactRecordList`.

#### TypeScript Interfaces
```tsx
export interface CompactRecordField {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  badgeClass?: string;
  fullWidth?: boolean;
}

export interface CompactRecordCardProps {
  id?: string;
  srNo?: number | string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  statusBadge?: React.ReactNode;
  site?: string;
  fields: CompactRecordField[];
  onView?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isArchived?: boolean;
  extraActions?: React.ReactNode;
}
```

#### Code Snippet
```tsx
import { CompactRecordList, CompactRecordCard } from '../common/CompactRecordCards';

<CompactRecordList
  data={paginatedRecords}
  emptyMessage="No records found."
  renderCard={(record, index) => (
    <CompactRecordCard
      key={record.id}
      srNo={index + 1}
      title={record.suName}
      subtitle={record.portRef}
      site={record.siteName}
      statusBadge={
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
          {record.status}
        </span>
      }
      fields={[
        { label: 'Date', value: record.date },
        { label: 'Officer', value: record.loggedBy },
        { label: 'Notes', value: record.notes, fullWidth: true }
      ]}
      onView={() => setSelectedView(record)}
      onEdit={() => handleEdit(record)}
      onDelete={() => handleDelete(record)}
    />
  )}
/>
```

---

### `TableAttachmentCell`
**File:** [`src/components/common/TableAttachmentCell.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/TableAttachmentCell.tsx)  
**Purpose:** Renders an interactive paperclip badge inside data tables. When clicked, opens a compact popover with file download links, copy-link buttons, and document previews.

#### TypeScript Interface
```tsx
export interface TableAttachmentCellProps {
  attachments?: RecordAttachment[] | any;
  attachmentUrl?: string | null;
  fileUrl?: string | null;
  recordTitle?: string;
}
```

#### Code Snippet
```tsx
import { TableAttachmentCell } from '../common/TableAttachmentCell';

// Inside a table cell or custom column renderer:
<TableAttachmentCell
  attachments={row.attachments}
  attachmentUrl={row.attachmentUrl}
  recordTitle={row.suName}
/>
```

---

### `AttachmentsSection`
**File:** [`src/components/common/AttachmentsSection.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/AttachmentsSection.tsx)  
**Purpose:** Comprehensive drag-and-drop document upload panel with file type icons, size calculations, progress indicators, preview dialogs, and deletion controls.

#### TypeScript Interface
```tsx
export interface AttachmentsSectionProps {
  attachments?: RecordAttachment[];
  onChange?: (attachments: RecordAttachment[]) => void;
  readOnly?: boolean;
  title?: string;
  entityName?: string;
  allowUpload?: boolean;
}
```

#### Code Snippet
```tsx
import { AttachmentsSection } from '../common/AttachmentsSection';

<AttachmentsSection
  attachments={formAttachments}
  onChange={(updated) => setFormAttachments(updated)}
  readOnly={false}
  title="Supporting Evidential Documents"
  entityName="Incident Report"
  allowUpload={true}
/>
```

---

### `TableSchemaEditorModal`
**File:** [`src/components/common/TableSchemaEditorModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/TableSchemaEditorModal.tsx)  
**Purpose:** Column customization modal allowing users to toggle column visibility, change column display order (up/down), and reset columns to the default configuration.

#### TypeScript Interface
```tsx
export interface TableSchemaEditorModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  moduleTitle: string;
  columns: TableColumnConfig<T>[];
  onSaveColumns: (newColumns: TableColumnConfig<T>[]) => void;
  onResetToDefault: () => void;
  currentUserRole?: string;
}
```

#### Code Snippet
```tsx
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';

<TableSchemaEditorModal
  isOpen={isSchemaModalOpen}
  onClose={() => setIsSchemaModalOpen(false)}
  moduleTitle="Public Transport Records"
  columns={columns}
  onSaveColumns={(newCols) => saveColumns(newCols)}
  onResetToDefault={() => resetToDefault()}
  currentUserRole={currentUserRole}
/>
```

---

### `QuickOptionModal`
**File:** [`src/components/common/QuickOptionModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/QuickOptionModal.tsx)  
**Purpose:** Modal for managing dropdown options (adding new items, reordering, assigning color tags, toggling active states).

#### TypeScript Interface
```tsx
export interface QuickOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryKey?: FieldOptionCategory;
  categoryName?: string;
  onOptionAdded?: (newOption: { label: string; value: string; color?: string }) => void;
  customOptions?: Array<{ label: string; value: string; color?: string; id?: string }>;
  onUpdateCustomOptions?: (newOptions: Array<{ label: string; value: string; color?: string }>) => void;
}
```

---

### `QuickJumpModal`
**File:** [`src/components/common/QuickJumpModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/QuickJumpModal.tsx)  
**Purpose:** Global quick navigator (accessible via `Ctrl+J` / `Cmd+J`). Filters accessible modules and routes users immediately.

```tsx
<QuickJumpModal isOpen={isJumpOpen} onClose={() => setIsJumpOpen(false)} />
```

---

### `SessionLockModal`
**File:** [`src/components/common/SessionLockModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/SessionLockModal.tsx)  
**Purpose:** Fullscreen modal locking access upon inactivity or security timeout, showing current operator and role with unlock / re-auth triggers.

```tsx
<SessionLockModal />
```

---

### `LiveDataBanner`
**File:** [`src/components/common/LiveDataBanner.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/LiveDataBanner.tsx)  
**Purpose:** Unobtrusive banner warning when the live database connection is offline or degraded, preventing silent data loss.

```tsx
<LiveDataBanner />
```

---

### `NetworkStatusIndicator`
**File:** [`src/components/common/NetworkStatusIndicator.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/NetworkStatusIndicator.tsx)  
**Purpose:** Header status indicator displaying live connection state (green online dot, amber warning, red offline indicator) with an interactive tooltip.

```tsx
<NetworkStatusIndicator />
```

---

### `AccessDeniedView`
**File:** [`src/components/common/AccessDeniedView.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/AccessDeniedView.tsx)  
**Purpose:** Standard unauthorized (403) placeholder shown when a user lacks required RBAC role permissions.

#### TypeScript Interface
```tsx
export interface AccessDeniedViewProps {
  pageName?: string;
  requiredRole?: string;
}
```

#### Code Snippet
```tsx
import { AccessDeniedView } from '../common/AccessDeniedView';

if (!canAccessSettings()) {
  return <AccessDeniedView pageName="System Settings" requiredRole="Super Admin" />;
}
```

---

### `Logo`
**File:** [`src/components/common/Logo.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/Logo.tsx)  
**Purpose:** Standard dual-tone SVG emblem and typography logo for SD Commercial.

#### TypeScript Interface
```tsx
export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg'; // Default: 'md'
  showText?: boolean;        // Default: true
}
```

#### Code Snippet
```tsx
import { Logo } from '../common/Logo';

<Logo size="md" showText={true} />
```

---

### `Header` & `Sidebar`
**Files:** [`src/components/common/Header.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/Header.tsx) & [`Sidebar.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/common/Sidebar.tsx)  
**Purpose:** Global application shell. `Header` contains Logo, Hotel Scope selector, Global Search, Notification bell, and Profile menu. `Sidebar` contains accordion-grouped navigation links, active badges, and collapse toggles.

---

## 4. Dashboard & Analytics Widgets

Located in [`src/components/dashboard/`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard):

| Component | File Path | Description |
| :--- | :--- | :--- |
| **`CommercialTrackersGrid`** | [`CommercialTrackersGrid.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/CommercialTrackersGrid.tsx) | Grid of operational module cards showing record counts, health pills, and deep links. |
| **`CommercialWelfareBreakdown`** | [`CommercialWelfareBreakdown.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/CommercialWelfareBreakdown.tsx) | Visual welfare checks progress bar and statistics per property. |
| **`DashboardAnalytics`** | [`DashboardAnalytics.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/DashboardAnalytics.tsx) | Incident trend charts and breakdown graphs (Recharts). |
| **`MonthlyIncidentsTable`** | [`MonthlyIncidentsTable.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/MonthlyIncidentsTable.tsx) | Aggregated monthly incident count table with severity breakdown. |
| **`PropertyLoadBreakdown`** | [`PropertyLoadBreakdown.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/PropertyLoadBreakdown.tsx) | Room capacity, occupancy rate, and active resident metrics. |
| **`PropertyOperationsOverviewWidget`** | [`PropertyOperationsOverviewWidget.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/PropertyOperationsOverviewWidget.tsx) | High-level KPI cards with daily shifts, check-ins, and pending tasks. |
| **`QuickIncidentModal`** | [`QuickIncidentModal.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/QuickIncidentModal.tsx) | Expedited incident reporting modal directly callable from dashboard. |
| **`VulnerabilityRiskBreakdown`** | [`VulnerabilityRiskBreakdown.tsx`](file:///d:/SD%20Commercial/APPS/sdtracker/src/components/dashboard/VulnerabilityRiskBreakdown.tsx) | Safeguarding risk matrix categorized by risk level (High, Medium, Low). |

---

## 5. Table Schema & Dynamic Fields System

The application relies on declarative schemas defined in [`src/types/tableSchema.ts`](file:///d:/SD%20Commercial/APPS/sdtracker/src/types/tableSchema.ts) and the [`useTableSchema`](file:///d:/SD%20Commercial/APPS/sdtracker/src/hooks/useTableSchema.ts) hook.

### `TableColumnConfig<T>` Interface
```tsx
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
  optionCategory?: FieldOptionCategory; // Connected to AppContext field options
  allowQuickAdd?: boolean;             // Enables "+ Add New" inside modals
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  editable?: boolean;                  // If false, read-only in forms
  visibleInTable?: boolean;            // If false, hidden from data table
  visibleInView?: boolean;             // If false, hidden from view modal
  isSystemMetadata?: boolean;          // If true, hidden from Add/Edit
  badgeColors?: Record<string, string>;// Custom badge color mapping
  colSpan?: 1 | 2;                     // 1 = half width, 2 = full width in form grid
  section?: string;                    // Fieldset / section title in forms
  helperText?: string;                 // Subtitle hint below input
  renderCell?: (value: any, record: T) => React.ReactNode;
}
```

### Schema Hook Example
```tsx
import { useTableSchema } from '../../hooks/useTableSchema';
import { TableColumnConfig } from '../../types/tableSchema';

const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: 'suName', label: 'Resident Name', type: 'text', required: true, section: 'Resident Info' },
  { key: 'room', label: 'Room No', type: 'text', section: 'Resident Info' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    options: ['Active', 'Pending', 'Closed'],
    badgeColors: {
      'Active': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
      'Closed': 'bg-neutral-100 text-neutral-800 border-neutral-200'
    }
  }
];

export const MyView = () => {
  const { columns, visibleColumns, saveColumns, resetToDefault } = useTableSchema('myModuleKey', DEFAULT_COLUMNS);
  // ...
};
```

---

## 6. Complete Operational Tracker View Blueprint

Copy and adapt this complete template when building a new operational register or tracker view:

```tsx
import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  SlidersHorizontal,
  LayoutGrid,
  List
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTableSchema } from '../../hooks/useTableSchema';
import { DynamicDataTable } from '../common/DynamicDataTable';
import { DynamicRecordFormModal } from '../common/DynamicRecordFormModal';
import { DynamicRecordViewModal } from '../common/DynamicRecordViewModal';
import { TableSchemaEditorModal } from '../common/TableSchemaEditorModal';
import { FilterBar } from '../common/FilterBar';
import { Pagination } from '../common/Pagination';
import { ExportDropdown } from '../common/ExportDropdown';
import { ExportColumnOption } from '../common/ExportModal';
import { CompactRecordList, CompactRecordCard } from '../common/CompactRecordCards';
import { TableColumnConfig } from '../../types/tableSchema';

// 1. Column Schema Definition
const DEFAULT_COLUMNS: TableColumnConfig[] = [
  { key: 'referenceUrn', label: 'Reference URN', type: 'text', required: true, section: 'Identity' },
  { key: 'dateLogged', label: 'Date Logged', type: 'date', required: true, section: 'Identity' },
  { key: 'siteName', label: 'Property / Hotel', type: 'select', required: true, section: 'Location' },
  { key: 'residentName', label: 'Resident Name', type: 'text', required: true, section: 'Resident' },
  { 
    key: 'status', 
    label: 'Status', 
    type: 'select', 
    options: ['Open', 'In Progress', 'Completed'],
    badgeColors: {
      'Open': 'bg-blue-100 text-blue-800 border-blue-200',
      'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
      'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
  },
  { key: 'notes', label: 'Operational Notes', type: 'textarea', colSpan: 2 }
];

export const MyOperationalTrackerView: React.FC = () => {
  const {
    currentUserRole,
    canCreateRecord,
    canEditRecord,
    canDeleteRecord,
    isMobileCompactView,
    setIsMobileCompactView
  } = useApp();

  // 2. Schema State Hook
  const { columns, saveColumns, resetToDefault } = useTableSchema('myTrackerKey', DEFAULT_COLUMNS);

  // 3. Local State (Filters, Modals, Pagination)
  const [siteFilter, setSiteFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string>('dateLogged');
  const [sortAsc, setSortAsc] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  // Replace with actual data from AppContext
  const rawRecords: any[] = [];

  // 4. Filtering & Sorting Logic
  const filteredRecords = useMemo(() => {
    return rawRecords.filter(r => {
      if (siteFilter !== 'all' && r.siteName !== siteFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          r.residentName?.toLowerCase().includes(q) ||
          r.referenceUrn?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      const valA = a[sortKey] || '';
      const valB = b[sortKey] || '';
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
  }, [rawRecords, siteFilter, statusFilter, searchQuery, sortKey, sortAsc]);

  // 5. Pagination
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  return (
    <div className="space-y-4 animate-fade-in p-4 md:p-6 bg-[#f3f2f1] min-h-screen">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xs border border-[#e1dfdd] shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-[#242424] tracking-tight">
            Operational Tracker
          </h1>
          <p className="text-xs text-[#605e5c] mt-0.5">
            Active monitoring, compliance verification, and log records.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile view switcher */}
          <button
            onClick={() => setIsMobileCompactView(!isMobileCompactView)}
            className="md:hidden p-1.5 bg-white border border-[#8a8886] rounded-xs text-[#323130]"
            title="Toggle Card / Table View"
          >
            {isMobileCompactView ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>

          {/* Customize Columns Button */}
          <button
            onClick={() => setIsSchemaModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs text-xs font-semibold cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>Columns</span>
          </button>

          {/* Add Record Primary CTA */}
          {canCreateRecord('myModuleKey') && (
            <button
              onClick={() => {
                setEditingRecord(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Record</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <FilterBar
        siteFilter={siteFilter}
        setSiteFilter={setSiteFilter}
        monthFilter={monthFilter}
        setMonthFilter={setMonthFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onReset={() => {
          setSiteFilter('all');
          setMonthFilter('all');
          setStatusFilter('all');
          setSearchQuery('');
        }}
        totalFilteredCount={filteredRecords.length}
      />

      {/* Main Data Presentation: Table vs Mobile Cards */}
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-xs overflow-hidden">
        {isMobileCompactView ? (
          <div className="p-3">
            <CompactRecordList
              data={paginatedRecords}
              renderCard={(record, idx) => (
                <CompactRecordCard
                  key={record.id || idx}
                  title={record.residentName}
                  subtitle={record.referenceUrn}
                  site={record.siteName}
                  statusBadge={
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                      {record.status}
                    </span>
                  }
                  fields={[
                    { label: 'Date', value: record.dateLogged },
                    { label: 'Notes', value: record.notes, fullWidth: true }
                  ]}
                  onView={() => setViewRecord(record)}
                  onEdit={() => {
                    setEditingRecord(record);
                    setIsFormOpen(true);
                  }}
                />
              )}
            />
          </div>
        ) : (
          <DynamicDataTable
            columns={columns}
            data={paginatedRecords}
            sortField={sortKey}
            sortAsc={sortAsc}
            onSort={(field) => {
              if (sortKey === field) setSortAsc(!sortAsc);
              else {
                setSortKey(field);
                setSortAsc(true);
              }
            }}
            onView={(record) => setViewRecord(record)}
            onEdit={(record) => {
              setEditingRecord(record);
              setIsFormOpen(true);
            }}
          />
        )}

        {/* Footer Pagination */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Dynamic Add / Edit Modal */}
      <DynamicRecordFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingRecord ? 'Edit Record' : 'Create New Record'}
        columns={columns}
        initialValues={editingRecord}
        isEdit={Boolean(editingRecord)}
        onSubmit={async (values) => {
          // Add or update logic here
          setIsFormOpen(false);
        }}
      />

      {/* Detail View Modal */}
      <DynamicRecordViewModal
        isOpen={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        title="Record Details"
        record={viewRecord}
        columns={columns}
        canEdit={canEditRecord('myModuleKey')}
        onEdit={() => {
          const rec = viewRecord;
          setViewRecord(null);
          setEditingRecord(rec);
          setIsFormOpen(true);
        }}
      />

      {/* Column Schema Customization Modal */}
      <TableSchemaEditorModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
        moduleTitle="Operational Tracker Columns"
        columns={columns}
        onSaveColumns={saveColumns}
        onResetToDefault={resetToDefault}
        currentUserRole={currentUserRole}
      />
    </div>
  );
};
```

---

## 7. Standard Modal Form Brand Pattern (Reference Architecture)

The canonical modal form design system for SDTracker operational and finance pages. Every new or redesigned modal form must adhere to this exact structural hierarchy, sizing, tokens, and button alignment.

### ASCII Layout Blueprint

```
┌──────────────────────────────────────────────┐
│  Header                              ✕       │
├──────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │                 │  │                 │   │
│  │    2-Column     │  │     Layout      │   │
│  │      Grid       │  │                 │   │
│  └─────────────────┘  └─────────────────┘   │
│                                              │
│  ───────────── Section Divider ───────────   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │            Content Card               │  │
│  │                                        │  │
│  │       ┌──────────────────────┐         │  │
│  │       │   Dashed Drop Zone   │         │  │
│  │       └──────────────────────┘         │  │
│  └────────────────────────────────────────┘  │
│                                              │
├──────────────────────────────────────────────┤
│  Secondary Action       Cancel   Primary     │
└──────────────────────────────────────────────┘
```

### Design Tokens & Visual Hierarchy

| Element | Class / Utility | Purpose |
| :--- | :--- | :--- |
| **Modal Overlay** | `fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4` | Centered backdrop with soft blur |
| **Modal Container** | `bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col` | Card surface with crisp 2px border radius |
| **Header** | `px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8] shrink-0` | Title, subtitle, and close button |
| **Header Title** | `text-base font-semibold text-[#242424] flex items-center gap-2` | Primary header text with brand icon |
| **Header Subtitle** | `text-[11px] text-neutral-500 mt-0.5` | Operational context / explanation |
| **Close Button** | `text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer` | Modal dismissal `✕` |
| **Modal Body** | `flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-white` | Scrollable interior with consistent spacing |
| **Section Header** | `pb-1 border-b border-neutral-200` with `text-xs font-bold text-neutral-700 uppercase tracking-wider` | Section category division |
| **2-Column Grid** | `grid grid-cols-1 sm:grid-cols-2 gap-4` | Responsive input grid |
| **Section Divider** | `border-t border-[#e1dfdd]` | Clean horizontal division |
| **Content Card** | `border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3` | Enclosed sub-section (items, banking, files) |
| **Dashed Drop Zone** | `border-2 border-dashed border-[#8a8886]/40 hover:border-[#0d9488] bg-white rounded-xs p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group` | File attachment drag-and-drop zone |
| **Inputs / Controls**| `w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs` | Fluent form input fields |
| **Modal Footer** | `px-6 py-4 border-t border-[#e1dfdd] bg-[#faf9f8] flex items-center justify-between shrink-0` | Standardized 3-button footer bar |
| **Secondary Action** | `px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer flex items-center gap-1.5` | Left-aligned action (*Clear Form*, *Refresh*) |
| **Cancel Button** | `px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors cursor-pointer text-xs` | Dismiss action |
| **Primary Action** | `flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors cursor-pointer text-xs` | Primary submission (*Submit*, *Save Changes*) |

### Complete Reusable Code Template (`StandardModalForm.tsx`)

```tsx
import React, { useState } from 'react';
import { X, FileText, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface StandardModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  title?: string;
}

export const StandardModalForm: React.FC<StandardModalFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Form Title'
}) => {
  const [formData, setFormData] = useState({
    fieldOne: '',
    fieldTwo: '',
    category: 'default',
    notes: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClear = () => {
    setFormData({ fieldOne: '', fieldTwo: '', category: 'default', notes: '' });
    setFile(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ ...formData, file });
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1dfdd] flex items-center justify-between bg-[#faf9f8] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[#242424] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0d9488]" />
              <span>{title}</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Standardized operational form layout following the SDTracker UI Brand Kit.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-neutral-400 hover:text-neutral-700 p-1 rounded hover:bg-[#edebe9] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: 2-Column Responsive Grid */}
          <div className="space-y-3">
            <div className="pb-1 border-b border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Section 1: Core Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] block">
                  Field One <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fieldOne}
                  onChange={e => setFormData({ ...formData, fieldOne: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#605e5c] block">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                >
                  <option value="default">Standard Option</option>
                  <option value="expedited">Expedited Priority</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-[#605e5c] block">Notes &amp; Justification</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full p-2 border border-[#8a8886] rounded-xs bg-white text-[#323130] focus:ring-1 focus:ring-[#0d9488] focus:border-[#0d9488] transition-colors text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="border-t border-[#e1dfdd]" />

          {/* Section 2: Content Card with Dashed Drop Zone */}
          <div className="border border-[#e1dfdd] rounded-xs bg-[#faf9f8] p-4 space-y-3">
            <div className="pb-1 border-b border-neutral-200">
              <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                Section 2: Supporting Document
              </h4>
            </div>

            <label className="border-2 border-dashed border-[#8a8886]/40 hover:border-[#0d9488] bg-white rounded-xs p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
              <Upload className="w-6 h-6 text-neutral-400 group-hover:text-[#0d9488] transition-colors mb-1.5" />
              <span className="text-xs font-semibold text-[#323130]">
                {file ? file.name : 'Click to select or drop supporting file here'}
              </span>
              <span className="text-[11px] text-neutral-500 mt-0.5">
                {file ? `${(file.size / 1024).toFixed(1)} KB selected` : 'PDF, PNG, JPG up to 15MB'}
              </span>
              <input
                type="file"
                className="hidden"
                disabled={isSubmitting}
                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
              />
            </label>
          </div>

          {/* Standard 3-Button Footer */}
          <div className="pt-4 border-t border-[#e1dfdd] flex items-center justify-between">
            {/* Left: Secondary Action */}
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-300 rounded-xs hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Clear Form
            </button>

            {/* Right: Cancel + Primary Action */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-[#8a8886] rounded-xs hover:bg-[#edebe9] text-[#323130] font-semibold transition-colors cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
```

