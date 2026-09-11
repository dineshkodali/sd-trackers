# Remedies & Defect Problem Resolutions Playbook

This document tracks identified application defects, root causes, technical remedies, and verification status across the SD Operations Platform.

---

## Resolution Matrix

| Bug ID | Severity | Module / Area | Defect Summary | Technical Remedy | Status | Verified In |
| :--- | :---: | :--- | :--- | :--- | :---: | :--- |
| **BUG-001** | **Critical** | Database / Storage | 13 tables missing, 2/31 pages connected | Executed idempotent `db/schema.sql` migration; created 13 tables, added `data` JSONB columns, reloaded PostgREST cache. | **Resolved** | Live DB (31/31) |
| **BUG-012** | **High** | Forms / Validation | Form submittable with empty required fields | Implemented Zod schema validation & client-side boundary checks before mutation dispatch. | **Resolved** | `tests/validation/` |
| **BUG-023** | **High** | Schema / Custom Columns | Dynamic administrator-defined columns lost on save | Added full-fidelity `data` JSONB envelope column across all data tables in `schemaAdapter.ts`. | **Resolved** | `tests/api/` |
| **BUG-026** | **Medium** | Audit Security | Audit records missing `module` & `target_label` | Added explicit `module` and `target_label` columns to `audit_trails` table. | **Resolved** | `tests/workflows/` |
| **BUG-029** | **Medium** | Security / Auth | Public signup allowed unassigned role elevation | Replaced `raw_user_meta_data` read in profile trigger with `raw_app_meta_data` (service role only). | **Resolved** | `tests/auth/` |
| **BUG-031** | **Medium** | Laundry & Food | Property logs vs intake log cross-contamination | Implemented entity variant discriminators (`isPropertyLaundry`, `isVendorBuffet`) in `ENTITY_REGISTRY`. | **Resolved** | `tests/modules/` |

---

## Detailed Remedies Log

### BUG-001: Missing Database Tables & Page Coverage Disconnection
- **Problem**: Application reported `2/31 pages fully connected`. Tables like `public_transport_records`, `compliance_records`, `gp_appointments`, `rfa_welfare_checks`, `dispersal_records`, `booklet_collections`, etc. did not exist in PostgreSQL.
- **Root Cause**: The original database schema had only a partial migration applied; IPv6-only hostname DNS prevented automated CLI execution.
- **Remedy**:
  1. Ran `db/schema.sql` creating all 13 missing tables with proper foreign keys and triggers.
  2. Applied `data JSONB` additive columns to all 13 existing operational tables.
  3. Configured `NOTIFY pgrst, 'reload schema'` to refresh the PostgREST cache.
  4. Seeded initial master vocabularies (`booklet_collections`, `vcs_agencies`, `field_options`, `role_permissions`).
- **Verification**: `npm run db:coverage` confirms **29/29 tables connected (31/31 pages)**.

---

### BUG-023: Custom Dynamic Column Loss on Save
- **Problem**: When an administrator added custom columns in Custom Table Columns, values entered on forms were stripped on database write.
- **Root Cause**: Typed column mapping only recognized hardcoded schema fields; unmapped fields were discarded.
- **Remedy**:
  1. Added `data JSONB` column to all tables.
  2. Updated `schemaAdapter.ts` to pack full application records into `data` during `toDatabaseRow()`.
  3. `fromDatabaseRow()` unpacks `data` first, preserving 100% of custom and dynamic fields.
- **Verification**: Live CRUD test verified custom JSON payload round trip without data loss.

---

### BUG-026: Orphaned Audit Trail Entries
- **Problem**: Security audit logs showed changes without linking back to the human-readable entity or module name.
- **Root Cause**: `audit_trails` only had `entity_type` and `entity_id`, missing readable subject labels.
- **Remedy**:
  1. Added `module TEXT` and `target_label TEXT` to `audit_trails`.
  2. Updated server audit logging middleware to populate `module` and `target_label` on every mutation.
- **Verification**: Verified via `04_security_pentest_template.spec.ts`.

---

## How to Add a New Remedy Entry
1. Identify the defect ID and severity (`Critical`, `High`, `Medium`, `Low`).
2. Add a regression test using `QA Testing & Results/test-templates/05_remediation_regression_template.spec.ts`.
3. Apply the code fix.
4. Run `npm run test:qa:report` to generate an updated, dated HTML report.
5. Record the resolution in this table.
