# SD Commercial — UI Design System & Component Inventory

> **Pure UI Design Reference:** This document contains **only UI design tokens, component specifications, layout blocks, and UI module structures**. All application domain names and business logic have been removed.  
> **Interactive Preview:** Open [`ui-kit.html`](./ui-kit.html) in any browser to inspect interactive components, test states, and copy tokens.

---

## 1. UI Inventory: What We Used & Where We Used It (By UI Modules & Blocks)

| UI Element Name | Visual Style & Specification | CSS / Tailwind Classes | Where Used (UI Modules & Blocks) | What Used For (UI Function) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Action Button** | Bg: `#0d9488`, Hover: `#0f766e`, Text: White, Radius: 2px, Font: 12px/600 | `bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs px-3 py-1.5 font-semibold text-xs shadow-xs` | **View Header Block**, **Modal Action Footer Block** | Primary Call To Action (CTA) & Form Submission |
| **Secondary Outline Button** | Bg: White, Border: `#8a8886`, Hover: `#edebe9`, Text: `#323130`, Radius: 2px | `bg-white hover:bg-[#edebe9] text-[#323130] border border-[#8a8886] rounded-xs font-semibold text-xs px-3 py-1.5` | **Filter Toolbar Block**, **Modal Action Footer Block**, **Data Table Action Cell** | Secondary Action, Filter Reset, Dialog Cancel |
| **Danger Action Button** | Bg: `#a4262c`, Hover: `#8f1f25`, Text: White, Radius: 2px, Font: 12px/600 | `bg-[#a4262c] hover:bg-[#8f1f25] text-white rounded-xs font-semibold text-xs px-3 py-1.5` | **Destructive Modal Footer Block**, **Action Menu Dropdown** | Destructive Action & Permanent Deletion Trigger |
| **Soft Danger Button** | Bg: `#fdf3f2`, Border: `#f5b8b5`, Hover: `#fae7e6`, Text: `#a80000`, Radius: 2px | `bg-[#fdf3f2] hover:bg-[#fae7e6] text-[#a80000] border border-[#f5b8b5] rounded-xs font-medium text-[11px]` | **User Profile Dropdown Menu Block** | Warning Action & Session Logout Trigger |
| **Split Export Button** | Two-part component: Left primary button + Right dropdown toggle chevron | `bg-[#f3f8fd] hover:bg-[#f0fdfa] text-[#0f766e] border border-[#71afe5] rounded-xs font-semibold text-xs` | **Filter Toolbar Block**, **View Header Action Group** | Multi-Format Export Controller (PDF & CSV) |
| **Subnav Tab Pill Switcher**| Container: `#edebe9`, Active pill: White card with shadow, Inactive: `#605e5c` | `bg-[#edebe9] p-0.5 rounded-xs &rarr; active: bg-white text-[#0f766e] shadow-xs font-semibold` | **View Header Sub-Navigation Block** | Tabbed View Switcher (Primary View / Archive View) |
| **Form Text Input & Select** | Border: `#8a8886`, Focus Ring: `#71afe5`, Background: White, Text: `#323130` | `border border-[#8a8886] rounded-xs p-2 text-xs bg-white focus:outline-2 focus:outline-[#71afe5]` | **Form Block**, **Modal Dialog Body**, **Filter Toolbar Block** | Data Entry, Search Query Input, Option Selection |
| **Locked Input State** | Background: `#faf9f8`, Opacity: 0.8, Padlock icon + amber tag, Cursor: not-allowed | `bg-[#faf9f8] cursor-not-allowed opacity-80 border border-[#8a8886]` | **Form Block**, **Filter Toolbar Block** | Permission-Restricted / Read-Only Field Constraint |
| **Filter Toolbar Container** | Background: White, Border: `#e1dfdd`, Radius: 2px, Padding: 14px, Flex-wrap | `bg-white border border-[#e1dfdd] shadow-xs rounded-xs mb-4 p-3.5` | **View Top Control Block** | Horizontal Filter & Search Controls Container |
| **Data Table Column Header** | Background: `#faf9f8`, Border-bottom: `#edebe9`, Text: `#605e5c`, Font: 12px/600 | `bg-[#faf9f8] border-b border-[#edebe9] text-[#605e5c] font-semibold text-xs select-none` | **Data Table Container Block (Header Row)** | Column Titles, Sorting Triggers & Indicators |
| **Data Table Body Row** | Border-bottom: `#edebe9`, Hover: `#f3f8fd`, Text: `#323130`, Font: 12px | `border-b border-[#edebe9] hover:bg-[#f3f8fd] transition-colors text-xs text-[#323130]` | **Data Table Container Block (Body Rows)** | Record Row Display with Interactive Hover Highlight |
| **Table Pagination Bar** | Background: `#faf9f8`, Border-top: `#edebe9`, Flex justify-between, Font: 11px | `px-4 py-2.5 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between text-xs` | **Data Table Container Block (Footer Bar)** | Pagination Controls & Total Records Counter |
| **Metric Summary KPI Card** | Background: White, Border: `#5eead4`, Hover: `#0d9488` + shadow, Radius: 2px | `bg-white border border-[#5eead4] rounded-xs p-3.5 shadow-xs hover:shadow-md transition-all` | **Dashboard Metric Grid Block** | KPI Metric Display (Number, Icon, Sub-Metric, Link) |
| **Standard Confirmation Modal** | Backdrop: `rgba(0,0,0,0.4) blur(2px)`, Header: `#f3f8fd`, Border: `#e1dfdd` | `bg-white rounded shadow-2xl border border-[#e1dfdd] max-w-lg` | **Application Modal Overlay Layer** | Non-Destructive Action Verification Dialog |
| **Danger Confirmation Modal** | Header: `#fef2f2`, Border: `#fecaca`, Text: `#991b1b`, Yellow Warning Box | `bg-red-50/80 border-b border-red-200 text-red-900 with alert box` | **Application Modal Overlay Layer** | High-Risk Destructive Action Verification Dialog |
| **Global Top Header** | Height: 64px, Background: White, Border-bottom: `#e1dfdd`, Z-index: 30 | `h-16 bg-white border-b border-[#e1dfdd] px-6 flex items-center justify-between sticky top-0` | **Application Shell (Top Fixed Block)** | Global App Header (Logo, Context, Status, Menus) |
| **Static Navigation Sidebar** | Width: 256px (w-64), Background: `#fbfbfa`, Border-right: `#e5e5e5` | `w-64 bg-[#fbfbfa] border-r border-[#e5e5e5] h-full sticky top-0 left-0` | **Application Shell (Left Static Block)** | App Navigation (Menu Links, Accordion Groups, Badges) |

---

## 2. Master Color Tokens

### Primary Brand Scale (Teal)
* `--sd-teal-50`: `#f0fdfa` (Light tag & active item background)
* `--sd-teal-100`: `#ccfbf1` (Subtle hover tint)
* `--sd-teal-200`: `#99f6e4` (Soft badge border)
* `--sd-teal-300`: `#5eead4` (Card highlight border)
* `--sd-teal-400`: `#2dd4bf` (Bright active accent)
* `--sd-teal-500`: `#14b8a6` (Secondary interactive accent)
* **`--sd-teal-600`**: **`#0d9488`** (**CORE PRIMARY BRAND COLOR**)
* `--sd-teal-700`: `#0f766e` (Hover state for primary buttons)
* `--sd-teal-800`: `#115e59` (Emblem D & dark titles)
* `--sd-teal-900`: `#134e4a` (High-contrast text)

### Commercial Fluent Neutrals
* `--sd-neutral-canvas`: `#f3f2f1` (Viewport background)
* `--sd-neutral-sidebar`: `#fbfbfa` (Sidebar background)
* `--sd-neutral-card`: `#ffffff` (Card, modal & table surface)
* `--sd-neutral-subtle`: `#faf9f8` (Table alternate rows & summary box)
* `--sd-neutral-hover`: `#edebe9` (Standard hover state)
* `--sd-neutral-border`: `#e1dfdd` (Container & panel border)
* `--sd-neutral-border-input`: `#8a8886` (Form input & button border)
* `--sd-neutral-text-muted`: `#605e5c` (Labels, table headers & captions)
* `--sd-neutral-text-body`: `#323130` (Primary body reading text)
* `--sd-neutral-text-headings`: `#242424` (Display titles & modal headers)

### Semantic Status Colors
* **Danger:** Core `#a4262c` | Hover `#8f1f25` | Soft Bg `#fdf3f2` | Soft Border `#f5b8b5`
* **Warning:** Core `#d83b01` | Amber `#ca8a04` | Soft Bg `#fffbeb` | Soft Border `#fde68a`
* **Success:** Core `#107c10` | Emerald `#059669` | Soft Bg `#ecfdf5` | Soft Border `#a7f3d0`
* **Info:** Core `#0078d4` | Blue Text `#1e40af` | Soft Bg `#f3f8fd` | Focus Border `#71afe5`
* **Purple:** Core `#7c3aed` | Text `#6b21a8` | Soft Bg `#faf5ff` | Soft Border `#e9d5ff`

---

## 3. Typography Scale & Hierarchy

* **Font Family:** `'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
* **Monospace Family:** `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`

| Style | Font Size | Weight | Line Height | Tracking | Where Used (UI Layout Block) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display H1** | `24px (1.5rem)` | 700 (Bold) | `32px` | `-0.4px` | View Header Block (Page Title) |
| **Section H2** | `18px (1.125rem)` | 600 (SemiBold) | `24px` | `-0.2px` | Major Section / Sub-View Header Block |
| **Card H3** | `14px (0.875rem)` | 600 (SemiBold) | `20px` | `0px` | Modal Title Block, Widget Header Block |
| **Label H4** | `12px (0.75rem)` | 700 (Bold) | `16px` | `+0.6px` | Uppercase Category Tag, Metric Label |
| **Standard Body**| `13px (0.8125rem)`| 400 (Regular) | `20px` | `0px` | Content Description Block, Reading Text |
| **Table / Form** | `12px (0.75rem)` | 400 / 500 | `18px` | `0px` | Data Table Cells, Form Inputs, Dropdowns |
| **Caption** | `11px (0.6875rem)`| 500 (Medium) | `14px` | `0px` | Input Helper Hints, Timestamps, Footers |
| **Micro Badge** | `10px (0.625rem)` | 700 (Bold) | `12px` | `+0.5px` | Status Tags, Pill Counters, Badges |
| **Monospace** | `11px / 12px` | 500 (Medium) | `14px` | `0px` | Reference Codes, System IDs, Timestamps |

---

## 4. UI Layout Blocks & Structural Blueprints

### Block Pattern A: Register / Listing View
* **View Header Block:** Displays Display H1 Title, Subtitle, Subnav Tab Pill Switcher, Primary Action Button (`#0d9488`), and Split Export Button.
* **Filter Toolbar Block:** Grid container holding Dropdown Selects, Date Input, Search Input, and Reset Button.
* **Data Table Block:** Full-width container with sticky headers, sortable columns, alternating rows, status badges, and action icon buttons.
* **Pagination Footer Block:** Sticky table bottom row with item range counters and Prev/Next button triggers.

### Block Pattern B: Summary & Analytics View
* **Metric Grid Block:** 3-Column responsive grid composed of Metric KPI Cards with 32px values, icon boxes, sub-labels, and arrow footers.
* **Operational Grid Block:** 2-Column responsive cards with progress indicator bars and alert counters.
* **Chart Grid Block:** Multi-column responsive containers for data visualization modules.

### Block Pattern C: Configuration & Governance View
* **Configuration Form Block:** Multi-column form layout with toggle switches, checkbox matrices, and select menus.
* **Notification Banner Block:** Contextual status notices (`alert-warning`, `alert-danger`, `alert-info`, `alert-success`).
* **Action Footer Block:** Pinned bottom bar with Secondary "Cancel" and Primary "Save" buttons.

---

## 5. Reusable Code Implementation

### Vanilla CSS Custom Properties
```css
:root {
  --sd-teal-50: #f0fdfa;
  --sd-teal-100: #ccfbf1;
  --sd-teal-200: #99f6e4;
  --sd-teal-300: #5eead4;
  --sd-teal-400: #2dd4bf;
  --sd-teal-500: #14b8a6;
  --sd-teal-600: #0d9488;
  --sd-teal-700: #0f766e;
  --sd-teal-800: #115e59;
  --sd-teal-900: #134e4a;

  --sd-neutral-canvas: #f3f2f1;
  --sd-neutral-sidebar: #fbfbfa;
  --sd-neutral-card: #ffffff;
  --sd-neutral-subtle: #faf9f8;
  --sd-neutral-hover: #edebe9;
  --sd-neutral-border: #e1dfdd;
  --sd-neutral-border-input: #8a8886;
  --sd-neutral-text-muted: #605e5c;
  --sd-neutral-text-body: #323130;
  --sd-neutral-text-headings: #242424;

  --sd-danger-core: #a4262c;
  --sd-danger-bg: #fdf3f2;
  --sd-warning-core: #d83b01;
  --sd-warning-bg: #fffbeb;
  --sd-success-core: #107c10;
  --sd-success-bg: #ecfdf5;
  --sd-info-core: #0078d4;
  --sd-info-bg: #f3f8fd;

  --sd-font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --sd-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

### Tailwind Configuration
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        surface: {
          canvas: '#f3f2f1',
          sidebar: '#fbfbfa',
          card: '#ffffff',
          subtle: '#faf9f8',
          hover: '#edebe9',
          border: '#e1dfdd',
        }
      },
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  }
};
```
