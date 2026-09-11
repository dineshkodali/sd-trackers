# Live database storage

Every page now stores its records in the live Supabase Postgres database. There is
no "Local State (Safe Fallback)" mode: when the database cannot accept a change the
change is rolled back on screen and the user is told, instead of it being kept in
the browser where it would never reach anyone else.

## How a save works

```
Page -> AppContext persist helper -> /api/db/<entity> (Express, verified session)
     -> schemaAdapter.toDatabaseRow -> Supabase (service role) -> audit_trails row
```

* The screen updates immediately; if the API refuses the write, the change is
  reverted and an "… was NOT saved" notification explains why.
* Every row keeps typed columns for reporting **and** a `data` JSONB copy of the
  full record, so no field (including administrator-defined custom columns) is lost.
* The server writes exactly one audit row per change, with the verified user's
  identity and the record id (`entity_id`) always set.
* All pages are loaded in one `POST /api/db/batch-read` request, every 45 s while
  signed in.

## Page to table map

| Page | Table |
|---|---|
| SG Referrals (+ archive) | `referrals` |
| Vulnerable SUs (+ archive) | `vulnerable_residents` |
| Challenging SUs (+ archive) | `challenging_behavior` |
| Maintenance Tracker | `maintenance_records` |
| SPCD Tracker | `spcd_records` |
| Laundry Support (resident intake, property logs) | `laundry_logs` |
| Hot Meals Tracker (deliveries, vendor buffet) | `hot_food_logs` |
| Escalations Log | `escalations` |
| Proof Documents | `documents` |
| Properties Directory | `sites` |
| Staff & User Accounts | Supabase Auth + `profiles` |
| User groups / property assignments | `user_groups`, `property_user_assignments` |
| Audit Security Trail | `audit_trails` |
| Requests & Approvals | `data_change_requests` |
| **Public Transport Tracker** | **`public_transport_records`** (new) |
| **SD-Compliance Tracker** | **`compliance_records`** (new) |
| **GP Appointments** | **`gp_appointments`** (new) |
| **RFA Welfare Checks** | **`rfa_welfare_checks`** (new) |
| **Dispersal Sheet** | **`dispersal_records`** (new) |
| **Booklets to be Collected** | **`booklet_collections`** (new, seeded) |
| **SD VCS Directory** | **`vcs_agencies`** (new, seeded) |
| **Field Options & Setup** | **`field_options`** (new, seeded) |
| **Roles & RBAC Matrix** | **`role_permissions`** (new, seeded) |
| **System Preferences / SharePoint config** | **`app_settings`** (new, seeded) |
| **Custom table columns** | **`table_schemas`** (new) |
| Notification rules / delivery log | `email_notification_rules` (seeded), `email_notification_logs` |

Settings > Database shows this table live, with row counts and status per page.

## Applying the schema

`db/schema.sql` is **non-destructive and idempotent**: it only creates missing
tables, adds missing nullable columns and replaces triggers/policies. It never
drops a table or a row, and runs in one transaction. (The previous version began
with `DROP TABLE … CASCADE` and ran on every boot.)

It is applied automatically on server start, by `npm run db:migrate`, or by
**Settings > Database > Run Migration SQL**. It needs a reachable Postgres endpoint:

```
DATABASE_URL=postgresql://postgres.<project-ref>:<db-password>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

Use the **Session pooler** string (Supabase > Connect). The direct host
`db.<ref>.supabase.co` is IPv6-only. If no endpoint is reachable the server logs
`[Migration NOT applied]` with the reason; alternatively use **Copy Migration SQL**
and run it in the Supabase SQL Editor, then click **Run Migration SQL** once to seed.

Reference data (properties, booklets, VCS agencies, field options, RBAC matrix,
preferences, notification rules) is seeded into empty tables once; a
`seeded:<table>` marker in `app_settings` stops a restart re-inserting rows an
administrator deleted. Operational demo records are never seeded.

## Records previously held in browsers

On first sign-in after upgrade, `legacyLocalDataMigration` uploads records that
exist only in that browser (and edits made there after the database copy), skips
bundled demo rows and anything the audit trail shows was deleted, then removes the
browser copy. Administrator-only modules wait for an administrator's sign-in;
failures are kept and retried.

## Security changes made with this work

* Row Level Security on every table; all `anon` policies and the blanket
  "any authenticated user can do anything" policies removed. Browsers can read
  only their own `profiles` row; all data goes through the API.
* Self-registered accounts are created **Inactive** with role Staff; roles come
  only from admin-set `app_metadata`/`profiles`, never from user-editable metadata.
* Identity/config entities (users, role permissions, settings, field options,
  table layouts, sites, groups) are writable by Admin/Super Admin only; deletes of
  operational records follow `role_permissions.canDeleteRecords`; audit rows are
  append-only (purge: Super Admin).
* `/api/smtp/*` requires a session; arbitrary recipients are admin-only.
* Deleting a user deletes the Supabase Auth account (previously only the profile).
* Failed logins are throttled (10 per 15 min per IP and per account).

## Tests

* `npm run test:unit` - adapter round trip for every page, browser-data migration.
* `QA Testing & Results/tests/api/persistence.spec.ts` - create/read/update/delete
  of every page's entity against the running server.
