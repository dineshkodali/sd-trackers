# 02 Navigation architecture

## Bottom tab bar (5 tabs, same for every role)

| Tab | Purpose | Content |
|---|---|---|
| Home | Role-aware dashboard | KPIs, quick actions, needs-attention, guest statistics, approvals (finance roles). Bell → Notifications, avatar → Profile. |
| Safeguarding | Module landing | SG Referrals Master, Archived SG Referrals, Vulnerable Residents, Archived Vulnerable SUs, Challenging Behavior SUs, Archived Challenging Incidents, Welfare Checks, RFA Welfare Checks, MH-Complaint Welfare Checks, GP Appointments, PEEP Tracker, SU Attendance Tracker, HO Report Generator, Service Users Master |
| Operations | Module landing | Executive Dashboard, Live Daily Registers, Maintenance Tracker, SPCD Tracker, IR Tracker (Incidents), Public Transport Tracker, Dispersal Sheet, Booklet Inventory, Commercial Laundry Support, Housekeeping Log, Hot Meals Tracker, Food Consumption (In & Out), Food Survey Checks, Food Wastage Tracker, Room Checks (30-Point Audit), Escalations Log, Proof Documents Repository, Property Management |
| Search | Global search | Residents, records, properties, modules (replaces the web Quick Jump). |
| More | Everything else | Profile, Finance (4), Compliance & Community (5), Admin & Governance (11), Notifications, Sign out. |

Why not all modules in the tab bar: there are 49 pages. Tabs hold the four things used all day; modules live one tap away on hub screens; Search reaches any record in two taps. Notifications are on Home (bell with badge) and in More so the five tabs stay stable.

## Hierarchy

```
Sign in → Home
├─ Home ── Notifications · Profile · Edit widgets · KPI/Card → filtered list
├─ Safeguarding ── module list → Detail → Form (modal) / Attachments / Audit trail
├─ Operations ── Live Registers (segmented hub) · trackers → Detail → Form
├─ Search ── results → Detail
└─ More ── Finance · Compliance & Community · Admin & Governance · Profile · Settings
```

Patterns: lists push to Detail (back swipe); create/edit are modal forms (Cancel / Save); filters, confirmations and pickers are bottom sheets; module tabs become a segmented control (up to 4) or a scrollable chip strip (5+).

## Role-based access (from the web rules)

Page visibility follows `App.tsx` gates and `initialData.ts`. A Super Admin can further restrict an individual user with Page Access; an override can only remove access, never add it. The mobile app must evaluate the same two layers.

| Page / module | Super Admin | Admin | Regional Manager | General Manager | Area Manager | Staff |
|---|---|---|---|---|---|---|
| Executive Dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| SG Referrals Master | Yes | Yes | Yes | Yes | Yes | Yes |
| Vendor Invoices | Yes | Yes | Yes | Yes | Yes | Yes |
| Finance Approvals | Yes | Yes | Yes | Yes | Yes | Yes |
| Live Daily Registers | Yes | Yes | Yes | Yes | Yes | Yes |
| Reports & SharePoint Hub | Yes | Yes | Yes | Yes | Yes | — |
| Staff & User Accounts | Yes | Yes | — | Yes | Yes | Yes |
| Properties Directory | Yes | Yes | — | Yes | Yes | Yes |
| Audit Security Trail | Yes | Yes | — | — | — | — |
| Email Notifications Management | Yes | Yes | — | — | — | — |
| System Settings & Preferences | Yes | Yes | — | — | — | — |
| Roles & RBAC Matrix | Yes | — | — | — | — | — |
| Field Options & Setup | Yes | — | — | — | — | — |
| Page Access Management | Yes | — | — | — | — | — |
| Page Maintenance Mode | Yes | — | — | — | — | — |
| All other 34 pages | Yes | Yes | Yes | Yes | Yes | Yes |

### Role capabilities (`INITIAL_ROLE_PERMISSIONS`, editable by a Super Admin in Roles)

| Capability | Super Admin | Admin | Regional Manager | General Manager | Area Manager | Staff |
|---|---|---|---|---|---|---|
| All sites | Yes | Yes | Yes | — | — | — |
| Create / edit | Yes | Yes | Yes | Yes | Yes | Yes |
| Delete | Yes | Yes | — | — | — | — |
| Archive / restore | Yes | Yes | Yes | Yes | Yes | — |
| Export | Yes | Yes | Yes | Yes | Yes | — |
| Restore archived users & properties | Yes | — | — | — | — | — |
| Manage finance | Yes | Yes | — | — | — | — |

### What each role sees on iPhone

**Super Admin** — Platform owner. Scope: All sites. Page Access, Page Maintenance, Roles & RBAC, Field Options, restore of archived/deleted users and properties. Screens: [Home](mockups/08-roles/super-admin/01-home.png), [Safeguarding](mockups/08-roles/super-admin/02-safeguarding-hub.png), [Operations](mockups/08-roles/super-admin/03-operations-hub.png), [More](mockups/08-roles/super-admin/04-more.png), [Profile](mockups/08-roles/super-admin/05-profile.png). Pages visible: 49 of 49.

**Admin** — Administrator. Scope: All sites. Users, Properties, Audit trail, Settings, Email notifications, finance; no restore, no Roles/Page Access. Screens: [Home](mockups/08-roles/admin/01-home.png), [Safeguarding](mockups/08-roles/admin/02-safeguarding-hub.png), [Operations](mockups/08-roles/admin/03-operations-hub.png), [More](mockups/08-roles/admin/04-more.png), [Profile](mockups/08-roles/admin/05-profile.png). Pages visible: 45 of 49.

**Regional Manager** — Manager (regional). Scope: All sites. Reports and export; no Users/Properties pages, no deletes, no Audit/Settings. Screens: [Home](mockups/08-roles/regional-manager/01-home.png), [Safeguarding](mockups/08-roles/regional-manager/02-safeguarding-hub.png), [Operations](mockups/08-roles/regional-manager/03-operations-hub.png), [More](mockups/08-roles/regional-manager/04-more.png), [Profile](mockups/08-roles/regional-manager/05-profile.png). Pages visible: 40 of 49.

**General Manager** — Manager (site). Scope: Assigned sites. Reports and export; Users and Properties limited to own sites and lower roles. Screens: [Home](mockups/08-roles/general-manager/01-home.png), [Safeguarding](mockups/08-roles/general-manager/02-safeguarding-hub.png), [Operations](mockups/08-roles/general-manager/03-operations-hub.png), [More](mockups/08-roles/general-manager/04-more.png), [Profile](mockups/08-roles/general-manager/05-profile.png). Pages visible: 42 of 49.

**Area Manager** — Manager (area). Scope: Assigned sites. Same as General Manager. Screens: [Home](mockups/08-roles/area-manager/01-home.png), [Safeguarding](mockups/08-roles/area-manager/02-safeguarding-hub.png), [Operations](mockups/08-roles/area-manager/03-operations-hub.png), [More](mockups/08-roles/area-manager/04-more.png), [Profile](mockups/08-roles/area-manager/05-profile.png). Pages visible: 42 of 49.

**Staff** — Frontline staff. Scope: Assigned sites. Create and edit records; no export, no archive/restore, no Reports/Audit/Settings; Users and Properties limited to own sites. Screens: [Home](mockups/08-roles/staff/01-home.png), [Safeguarding](mockups/08-roles/staff/02-safeguarding-hub.png), [Operations](mockups/08-roles/staff/03-operations-hub.png), [More](mockups/08-roles/staff/04-more.png), [Profile](mockups/08-roles/staff/05-profile.png). Pages visible: 41 of 49.

### The roles you listed

The brief names Administrator, Manager, Engineer and Customer. The repository defines **six** roles: Super Admin, Admin, Regional Manager, General Manager, Area Manager, Staff (`RoleType` in `src/types/index.ts`). There is **no Engineer role and no Customer role**, so none was designed; inventing them would contradict "do not invent features". Mapping used: Administrator → Super Admin and Admin; Manager → Regional, General and Area Manager; frontline user → Staff. If Engineer or Customer roles are planned, they need a permission definition first (see coverage report).
