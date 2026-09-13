# SDTracker — User Acceptance Testing (UAT) Master Test Specification
**Scope**: Records, dynamic columns, views, filters, permissions, rendering, persistence, and performance  
**Classification**: OFFICIAL - SENSITIVE (SAFEGUARDING & OPERATIONS)  
**Standard**: Home Office Operational & Safeguarding Compliance  

---

## 1. Overview & Purpose

This specification defines the standardized **User Acceptance Testing (UAT)** procedures for the SDTracker platform. Each test case documents the target persona, prerequisites, step-by-step user actions, expected outcomes, and defect references.

---

## 2. Test Personas & Roles

| Persona | Role Name | Primary Responsibilities | System Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `Super Admin` | Global system oversight, schema customizations, field options, security | Full read/write across all 31 operational pages |
| **Admin** | `Admin` | Cross-property management, escalations, staff assignments, exports | Read/write across operational modules; restricted from critical schema changes |
| **Site Manager** | `Site Manager` | Property-level management (e.g. Brit Hotel), resident intake, laundry, catering | Scoped to assigned accommodation properties |
| **Welfare Officer** | `Welfare Officer` | Safeguarding incidents, resident welfare, GP visits, vulnerability | Safeguarding, medical, and welfare tracking modules |
| **Night Shift** | `Night Shift` | Emergency response, nocturnal welfare checks, incident logging | Scoped shift logging; read-only settings |

---

## 3. Standardized Test Cases Matrix

### Module 1: System Health & Infrastructure Monitoring
- **Test ID**: `UAT-INFRA-01`
- **Persona**: Super Admin
- **Priority**: Critical
- **Preconditions**: Dev or production server running on port 3020.
- **Steps**:
  1. Send HTTP GET request to `/api/status`.
  2. Inspect the response payload for all 8 monitored sub-services (`web`, `auth`, `database`, `api`, `files`, `notifications`, `reporting`, `jobs`).
  3. Verify that `incidents.active` array is empty (`[]`).
- **Expected Result**: HTTP 200 returned with all 8 services in `operational` status and zero blocking outages.

---

### Module 2: Relational Database Storage & Page Coverage
- **Test ID**: `UAT-DATA-01`
- **Persona**: Super Admin
- **Priority**: Critical
- **Preconditions**: Database migration scripts `001`, `002`, `003` executed.
- **Steps**:
  1. Run `scripts/verify-db-coverage.ts` or query the PostgreSQL information schema.
  2. Verify all 29 tables respond with HTTP 200 / 206 via REST service role.
  3. Validate that shared tables (`laundry_logs`, `hot_food_logs`) cleanly segregate intake logs vs. property logs.
- **Expected Result**: **29 / 29 tables connected**, providing 100% database coverage across all **31 operational pages**.

---

### Module 3: Dynamic Table Column Schema Persistence (QA-01)
- **Test ID**: `UAT-COL-01`
- **Persona**: Super Admin
- **Priority**: High (Defect Remediation QA-01)
- **Preconditions**: Super Admin signed in; navigate to any tracker (e.g. SG Referrals, Maintenance).
- **Steps**:
  1. Click **"Customize Table"** in the top-right toolbar to open `TableSchemaEditorModal`.
  2. Click **"+ Add Column"**, enter Label: `Special Risk Note`, Type: `Select`, and Link to Master Field Category: `Safeguarding Incident Types`.
  3. Click **"Save Column Layout"**.
  4. Perform a hard browser refresh (`Ctrl + F5` or `Cmd + Shift + R`), or switch modules and return.
- **Expected Result**:
  - The newly created column remains visible in the table and form.
  - Column metadata (`optionCategory`, `allowQuickAdd`, `width`) is preserved in `localStorage` (`sd_table_schema_<moduleKey>`) and saved remotely in `table_schemas`.

---

### Module 4: Laundry Support Operational Cycle & Site Manager Permissions (QA-02)
- **Test ID**: `UAT-LAUNDRY-01`
- **Persona**: Site Manager
- **Priority**: High (Defect Remediation QA-02)
- **Preconditions**: Site Manager logged in, assigned to property (e.g. "Brit Hotel").
- **Steps**:
  1. Navigate to **Laundry Support** -> **Property Laundry Logs**.
  2. Click **"+ Add Property Laundry Record"**.
  3. Select the active operational week starting on Monday (`todayBounds.start`).
  4. Fill in bags sent, bags returned, clean bedding count, and notes.
  5. Click **"Save Laundry Record"**.
- **Expected Result**:
  - Record saves immediately without triggering "Date From cannot precede..." validation errors.
  - Form input `min` attribute allows selecting the current cycle's Monday.
  - Record appears immediately in the table.

---

### Module 5: Hot Meals Tracker 4-Vendor Buffet Matrix (QA-03, QA-04)
- **Test ID**: `UAT-MEALS-01`
- **Persona**: Site Manager
- **Priority**: High (Defect Remediation QA-03 & QA-04)
- **Preconditions**: Contracted accommodation property active with 4 catering suppliers.
- **Steps**:
  1. Navigate to **Hot Meals Tracker** -> **Buffet Matrix**.
  2. Verify that **Vendor Filter** defaults to **"All Food Vendors (4)"**, displaying schedules for A&M, Freshbite, 9 Cuisines, and Sands simultaneously.
  3. Click **"+ Add Vendor Buffet Log"**.
  4. Enter daily headcounts across all 8 meal categories (Lunch, Dinner, Toddler, Special meals) for Mon–Sun.
  5. Click **"Save Buffet Schedule"**.
  6. Reload page or switch tabs, then inspect the newly created schedule.
- **Expected Result**:
  - Initially entered headcounts persist immediately upon creation without requiring re-editing (`AppContext.persistCreate` guard).
  - Active week cursor automatically advances to the schedule's start date so the table is never blank.

---

### Module 6: SD VCS Support Agencies Partner Directory (QA-05)
- **Test ID**: `UAT-VCS-01`
- **Persona**: Welfare Officer
- **Priority**: High (Defect Remediation QA-05)
- **Preconditions**: Welfare Officer navigates to **SD VCS Directory**.
- **Steps**:
  1. Open the **SD VCS Directory** module.
  2. Inspect the agency list on initial load without changing filters.
  3. Type `Mental Health` into the directory search input.
  4. Test category filters (Legal, Housing, Food Bank, Women's Services).
- **Expected Result**:
  - All **69 master voluntary & community sector partner agencies** display immediately on page load (`selectedProperty` defaults to `'all'`).
  - Search and category filters operate instantaneously without displaying an empty table.

---

### Module 7: PDF Export Adaptive Wide Table Layout (QA-06)
- **Test ID**: `UAT-PDF-01`
- **Persona**: Admin
- **Priority**: Medium (Defect Remediation QA-06)
- **Preconditions**: Tracker module with wide dataset open (e.g. Welfare Checks, 4-Vendor Matrix with 10–16 columns).
- **Steps**:
  1. Click **"Export"** -> **"PDF Document (Landscape)"**.
  2. Download the generated `.pdf` file and open in PDF viewer.
  3. Verify all columns are present and no column text is cut off or truncated at the page margins.
- **Expected Result**:
  - The PDF export engine automatically scales typography (down to 4.8pt) and compresses margins (down to 14pt).
  - Proportional column width normalization fits all columns within printable boundaries.

---

### Module 8: High-Frequency Update Performance & Wire Latency (QA-07)
- **Test ID**: `UAT-PERF-01`
- **Persona**: Site Manager / Welfare Officer
- **Priority**: Medium (Defect Remediation QA-07)
- **Preconditions**: RFA Welfare Checks, Maintenance, or SPCD Tracker open.
- **Steps**:
  1. Edit a record inline (e.g. toggle welfare check status, update maintenance ticket priority).
  2. Observe network request `PUT /api/db/:entity/:id` in browser Developer Tools.
  3. Measure latency and inspect returned payload.
- **Expected Result**:
  - Backend executes a compact projection returning only necessary fields (`id, data, site, site_id, status`).
  - Wire payload is reduced by ~70%, and update round-trip latency completes in **under 50ms**.

---

### Module 9: Booklet Consignments Discoverability & Row Highlighting (QA-08)
- **Test ID**: `UAT-BOOKLET-01`
- **Persona**: Site Manager
- **Priority**: Low (Defect Remediation QA-08)
- **Preconditions**: Booklet Inventory opened with multi-page stock records.
- **Steps**:
  1. Click **"+ Add Booklet Stock"**.
  2. Add consignment for a hotel (e.g. "Abbey Hotel" or "Ready Homes").
  3. Click **"Save Consignment"**.
- **Expected Result**:
  - The new record is pinned to **row 1** of the table regardless of alphabetical sorting.
  - An emerald row border highlight, animated soft background, and a **"✨ NEW"** badge appear.
  - A top alert banner confirms creation with an auto-dismiss timer.

---

### Module 10: Role-Based Access Control (RBAC) & Persona Permissions
- **Test ID**: `UAT-RBAC-01`
- **Persona**: Super Admin vs. Operational Staff
- **Priority**: Critical
- **Preconditions**: Multiple user accounts configured with distinct roles.
- **Steps**:
  1. Log in as **Night Shift**: verify Customize Table button and Field Options setup are hidden or read-only.
  2. Log in as **Site Manager**: verify write operations are permitted for assigned property (e.g. Brit Hotel) but restricted on other properties.
  3. Log in as **Super Admin**: verify unrestricted global write access across all properties and settings.
- **Expected Result**: Permissions strictly enforced; unauthenticated API calls to `/api/db/*` return `HTTP 401 Authentication required`.

---

### Module 11: Core Safeguarding Referrals Lifecycle
- **Test ID**: `UAT-SG-01`
- **Persona**: Welfare Officer
- **Priority**: High
- **Steps**:
  1. Click **"+ New Referral"**, enter resident name, category (`Mental Health`), risk rating (`High`).
  2. Transition status: `Pending Triage` -> `Assigned to Officer` -> `Referred to Multi-Agency Team`.
  3. Verify audit trail logs mutation with user ID, module name, and timestamp.
- **Expected Result**: Referral flows smoothly through triage stages with persistent audit logging.

---

### Module 12: In-Modal Field Options Quick Creation
- **Test ID**: `UAT-DISP-01`
- **Persona**: Site Manager
- **Priority**: Medium
- **Steps**:
  1. Open any modal form with a configurable dropdown (e.g. Incident Type, Dispersal Reason).
  2. Click **"+ Add"** next to the dropdown label or select **"➕ + Add New Option..."**.
  3. Enter label `Urgent Dietary Assessment`, select a badge color, and click **"Save Option"**.
- **Expected Result**: The new option is persisted to the database and immediately auto-selected in the active form without losing previously typed input.
