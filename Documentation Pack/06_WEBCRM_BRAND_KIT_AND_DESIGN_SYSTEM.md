# SDTracker WebCRM — Brand Kit & Design System Specification

> **Document Type:** Brand Kit, Visual Design System & UI Tokens  
> **Application:** SDTracker WebCRM (SD Commercial Operations & Compliance Portal)  
> **Version:** 1.0 Production Standard  
> **Effective Date:** Production Release 2026  

---

## 1. Brand Identity & Logo Geometry

The SD Commercial identity embodies clarity, trust, and operational efficiency across municipal compliance, safeguarding, and property operations.

### Logo Composition & Geometry
The official SD Commercial logo consists of a precision-cut dual-tone emblem paired with a structured typographic wordmark:

```
+-------------------+-------------------------------------------------------------+
|    [S] / [D]      |   SD COMMERCIAL Tracker                                     |
|  Teal / Dark Teal |   Operations & Compliance Portal                            |
+-------------------+-------------------------------------------------------------+
```

* **Left Slice ('S'):** Bright Turquoise/Teal (`#0d9488` / RGB 13, 148, 136) clipped via polygon: `polygon(0 0, 70% 0, 40% 100%, 0 100%)`.
* **Right Slice ('D'):** Deep Dark Teal (`#115e59` / RGB 17, 94, 89) clipped via polygon: `polygon(70% 0, 100% 0, 100% 100%, 40% 100%)`.
* **Emblem Typography:** Pure White (`#ffffff`), 900 Weight (Black), tracking-tighter.
* **Wordmark:**
  * **SD**: Deep Dark Teal (`#115e59`), Font Weight 900, tracking-wider.
  * **COMMERCIAL**: Bright Teal (`#0d9488`), Font Weight 800, tracking-widest, uppercase.
  * **Tracker**: Neutral Black (`#242424`), Font Weight 700.
  * **Subtitle**: Neutral Gray (`#605e5c`), Font Weight 500, size 10px–11px (*"Operations & Compliance Portal"*).

---

## 2. Color Palette & Token System

SDTracker WebCRM utilizes a refined Microsoft Fluent Design neutral palette anchored by SD Commercial signature teals:

### Primary Brand Colors
| Token Name | HEX | RGB | Use Case |
| :--- | :--- | :--- | :--- |
| `--brand-teal` | `#0d9488` | `rgb(13, 148, 136)` | Primary buttons, active nav tabs, key accents, brand links |
| `--brand-teal-dark` | `#115e59` | `rgb(17, 94, 89)` | Top bar headers, dark emblem slice, emphasized text |
| `--brand-teal-deep` | `#134e4a` | `rgb(19, 78, 74)` | Text on light teal backgrounds, deep badges |
| `--brand-teal-hover` | `#0f766e` | `rgb(15, 118, 110)` | Button hover states, interactive table icons |
| `--brand-teal-light` | `#f0fdfa` | `rgb(240, 253, 250)` | Selected table rows, active tab backgrounds, alert boxes |
| `--brand-teal-border`| `#99f6e4` | `rgb(153, 246, 228)`| Subtle teal borders, assigned property topbar tags |
| `--brand-teal-glow`  | `rgba(13, 148, 136, 0.18)` | — | Input focus rings, glowing active states |

### Fluent Neutrals & Surface Colors
| Token Name | HEX | Role |
| :--- | :--- | :--- |
| `--fluent-black` | `#242424` | Primary high-contrast body text and card titles |
| `--fluent-dark` | `#323130` | Navigation text, dropdown items, secondary headers |
| `--fluent-muted` | `#605e5c` | Subtitles, field labels, metadata timestamps |
| `--fluent-subtle` | `#8a8886` | Placeholder text, disabled icon fills, inactive states |
| `--fluent-border` | `#e1dfdd` | Standard card borders, table dividers, panel borders |
| `--fluent-border-light` | `#edebe9` | Sub-menu dividers, subtle table grid lines |
| `--fluent-bg-subtle` | `#f8fafc` | Page backgrounds, alternating table rows, table headers |
| `--fluent-bg-hover` | `#f3f2f1` | Unselected nav item hover state, button hover |
| `--surface-white` | `#ffffff` | Primary card panels, modal backgrounds, input fields |

### Operational Status & SLA Colors
| Severity / Status | Text & Accent | Background Tint | Border | Operational Example |
| :--- | :--- | :--- | :--- | :--- |
| **P1 Critical / Cat 1** | `#dc2626` (Red-600) | `#fef2f2` (Red-50) | `#fca5a5` (Red-300) | Emergency maintenance, system outage, fire hazard |
| **P2 High / Cat 2** | `#ea580c` (Orange-600) | `#fff7ed` (Orange-50) | `#fdba74` (Orange-300) | Major function down, heating failure, urgent referral |
| **P3 Medium / Cat 3** | `#d97706` (Amber-600) | `#fefce8` (Amber-50) | `#fde047` (Amber-300) | Minor defect, isolated filter issue, standard booking |
| **P4 Low / Normal** | `#059669` (Emerald-600)| `#f0fdf4` (Emerald-50)| `#86efac` (Emerald-300)| Resolved record, compliant certificate, general inquiry|
| **Informational** | `#2563eb` (Blue-600) | `#eff6ff` (Blue-50) | `#bfdbfe` (Blue-200) | Multi-site notice, shift reminder, system announcement |

---

## 3. Typography Hierarchy

### Standard Font Family: `Poppins`
Across all web views, dashboards, dialogs, and forms, SDTracker WebCRM strictly enforces Google Font **Poppins** with system fallback:
```css
font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### Monospace Standard: `JetBrains Mono` / `ui-monospace`
Used exclusively for system reference numbers, booking IDs, timestamps, and database codes:
```css
font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### Type Scale
| Level | Font Size | Weight | Line Height | Application |
| :--- | :--- | :--- | :--- | :--- |
| **Display Header** | `24px – 26px` | 800 (ExtraBold) | 1.2 | Top page title, KPI summary numbers |
| **Card Header** | `18px – 20px` | 700 (Bold) | 1.3 | Module card titles, section headings |
| **Section Title** | `15px – 16px` | 600 (SemiBold) | 1.4 | Modal dialog titles, subsection headers |
| **Body Text** | `13.5px – 14px` | 400 (Regular) | 1.6 | Table cell values, descriptions, audit text |
| **Field Labels** | `12px – 12.5px` | 600 (SemiBold) | 1.2 | Form input labels, column headers |
| **Badges / Micro** | `10px – 11.5px` | 700 (Bold) | 1.0 | Status pills, site tags, count chips |

---

## 4. UI Components & Microsoft Fluent Micro-Design

### 1. Primary Action Buttons
* **Background:** `var(--brand-teal)` (`#0d9488`)
* **Color:** Pure White (`#ffffff`)
* **Padding:** `8px 16px` (Compact: `6px 12px`)
* **Border Radius:** `4px` (`--radius-xs` matching Fluent Design)
* **Font:** Poppins 600 SemiBold, 13px
* **Hover:** `var(--brand-teal-hover)` (`#0f766e`) with `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`

### 2. Secondary & Ghost Buttons
* **Background:** Transparent or `#ffffff`
* **Border:** 1px solid `var(--fluent-border)` (`#e1dfdd`)
* **Color:** `var(--fluent-dark)` (`#323130`)
* **Hover:** Background `#f3f2f1`, text `var(--brand-teal-dark)` (`#115e59`)

### 3. Form Inputs & Select Controls
* **Background:** `#ffffff`
* **Border:** 1px solid `var(--fluent-border)` (`#e1dfdd`)
* **Border Radius:** `4px`
* **Padding:** `8px 12px`
* **Focus State:** Border `var(--brand-teal)` (`#0d9488`), box-shadow `0 0 0 3px rgba(13, 148, 136, 0.18)`

### 4. Custom Slim Scrollbar (App Standard)
```css
* {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #0d9488;
}
```

---

## 5. Iconography Guidelines

SDTracker WebCRM uses **Lucide React** icons throughout:
* **Stroke Width:** 1.75px to 2.0px.
* **Standard Size:** `16px × 16px` (inline/buttons), `14px × 14px` (badges), `20px × 20px` (card headers).
* **Colors:** Icons must inherit parent text color or use specific brand accents (`text-[#0d9488]`, `text-[#dc2626]`).
