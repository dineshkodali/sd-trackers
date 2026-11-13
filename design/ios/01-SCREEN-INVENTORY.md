# 01 Screen inventory

Source of truth: the web app's page registry (`src/config/pageRegistry.ts`), the route switch in `src/App.tsx`, the role defaults in `src/data/initialData.ts` and the table/column definitions in `src/data/defaultTableSchemas.ts`. Extracted by `tools/audit.cjs` into `data/audit.json`. Nothing in the web app was changed.

**How navigation works on the web today:** there is no URL router. `App.tsx` switches on an in-memory `activePage`; every page is a full-screen view inside a sidebar shell. That is why each page below maps to a mobile screen set, not to a URL.

**Totals:** 49 pages (46 in the registry plus 3 admin pages routed outside it: pageAccess, pageMaintenance, settings). 258 iPhone screens.

| # | Page (web id) | Category | Web component | Data tables | Web actions | Mobile pattern | Screens |
|---|---|---|---|---|---|---|---|
| 1 | **Executive Dashboard** (`dashboard`) | Overview | `DashboardView` (819 lines, 12 sibling files) | — | view | Widget grid becomes a scrollable home with KPI cards, charts and a needs-attention list. | 2 |
| 2 | **Live Daily Registers** (`dailyRegisters`) | Overview | `LiveDailyRegistersView` (568 lines, 15 sibling files) | daily_register_rooms, daily_register_records, new_arrivals_records, eviction_records | view, edit, delete, export | Nine sheet tabs become a segmented hub; the 54-column table becomes resident cards and a guest-filter sheet. | 14 |
| 3 | **SG Referrals Master** (`referrals`) | Safeguarding | `ReferralsView` (903 lines) | referrals | view, create, edit, delete, export | Table of 19 columns becomes status-filtered cards; detail screen groups fields into sections. | 4 |
| 4 | **Archived SG Referrals** (`referralsArchive`) | Safeguarding | `ReferralsView` (903 lines) | — | view, create, edit, delete, export | Same card as Referrals, read-only, with a Restore action for permitted roles. | 3 |
| 5 | **Vulnerable Residents** (`vulnerable`) | Safeguarding | `VulnerableView` (837 lines) | vulnerable_residents | view, create, edit, delete, export | Risk level leads each card; review dates sort to the top. | 4 |
| 6 | **Archived Vulnerable SUs** (`vulnerableArchive`) | Safeguarding | `VulnerableView` (837 lines) | — | view, create, edit, delete, export | Read-only archive of vulnerable residents. | 3 |
| 7 | **Challenging Behavior SUs** (`challenging`) | Safeguarding | `ChallengingView` (949 lines) | challenging_behavior | view, create, edit, delete, export | Incident cards with risk factor and follow-up flag; description opens in detail. | 4 |
| 8 | **Archived Challenging Incidents** (`challengingArchive`) | Safeguarding | `ChallengingView` (949 lines) | — | view, create, edit, delete, export | Read-only archive of resolved incidents. | 3 |
| 9 | **Welfare Checks** (`welfareChecks`) | Safeguarding | `WelfareChecksView` (1086 lines, 2 sibling files) | welfare_checks | view, create, edit, delete, export | A long multi-section form becomes a step-by-step form with progress and per-section save. | 4 |
| 10 | **RFA Welfare Checks** (`rfaWelfare`) | Safeguarding | `RFAWelfareChecksView` (555 lines, 2 sibling files) | rfa_welfare_checks | view, create, edit, delete, export | Room and flat checks as cards with the vulnerability tag. | 4 |
| 11 | **MH-Complaint Welfare Checks** (`mhComplaintWelfare`) | Safeguarding | `MHComplaintWelfareChecksView` (513 lines, 2 sibling files) | mh_complaint_welfare_checks | view, create, edit, delete, export | Complaint case cards with ticket reference and status. | 4 |
| 12 | **GP Appointments** (`gpAppointments`) | Safeguarding | `GPAppointmentsView` (567 lines, 2 sibling files) | gp_appointments, gp_registrations | view, create, edit, delete, export | Appointments and Registrations become a two-segment control. | 4 |
| 13 | **PEEP Tracker** (`peepTracker`) | Safeguarding | `PEEPTrackerView` (532 lines) | peep_plans, peep_plan_history | view, create, edit, delete, export | Evacuation plan cards sorted by risk; review-due banner at the top. | 4 |
| 14 | **SU Attendance Tracker** (`suAttendance`) | Safeguarding | `SUAttendanceTrackerView` (1084 lines) | su_attendance_records, absence_followups | view, create, edit, delete, export | Roll, Records and Follow-ups become three segments; the roll becomes tap-to-mark rows with a bulk "mark all present" action. | 4 |
| 15 | **HO Report Generator** (`documentBuilder`) | Safeguarding | `DocumentBuilderView` (1579 lines, 8 sibling files) | ho_report_templates, ho_report_records, doc_builder | view, create, edit, delete, export, approve | Generator and Documents become two segments; the builder becomes a guided stepper with live preview in a sheet. | 2 |
| 16 | **Maintenance Tracker** (`maintenance`) | Facilities & Welfare | `MaintenanceTrackerView` (1354 lines, 1 sibling files) | maintenance_records | view, create, edit, delete, export | Priority colour band on each card; photo capture for evidence; criteria guide in a sheet. | 4 |
| 17 | **SPCD Tracker** (`spcd`) | Facilities & Welfare | `SPCDTrackerView` (897 lines) | spcd_records | view, create, edit, delete, export | Current and Archived become a segmented control. | 4 |
| 18 | **IR Tracker (Incidents)** (`irTracker`) | Facilities & Welfare | `IRTrackerView` (479 lines, 1 sibling files) | ir_records | view, create, edit, delete, export | Incident report cards; summary and submitted-to-CRH flag on detail. | 4 |
| 19 | **Public Transport Tracker** (`publicTransport`) | Facilities & Welfare | `PublicTransportTrackerView` (606 lines, 6 sibling files) | public_transport_records, transport_feedback, transport_challenges, transport_funding_requests, oyster_cards | view, create, edit, delete, export | Five tabs become a scrollable segmented control. | 4 |
| 20 | **Dispersal Sheet** (`dispersal`) | Facilities & Welfare | `DispersalSheetView` (26 lines, 2 sibling files) | dispersal_records | view, create, edit, delete, export | Dispersal and eviction tables become cards under a two-segment control. | 4 |
| 21 | **Booklet Inventory** (`booklets`) | Facilities & Welfare | `BookletCollectionView` (606 lines) | booklet_collections | view, create, edit, delete, export | Stock rows with a collected/target progress bar. | 4 |
| 22 | **Commercial Laundry Support** (`laundry`) | Facilities & Welfare | `LaundryView` (454 lines, 1 sibling files) | laundry_logs, daily_laundry_logs | view, create, edit, delete, export | Daily room-by-room log with steppers; weekly and monthly summaries in a second segment. | 4 |
| 23 | **Housekeeping Log** (`housekeeping`) | Facilities & Welfare | `HousekeepingView` (755 lines) | housekeeping_logs, housekeeping_room_logs | view, create, edit, delete, export | Daily checklist becomes toggles per task with inspector sign-off. | 4 |
| 24 | **Hot Meals Tracker** (`food`) | Facilities & Welfare | `FoodView` (54 lines, 5 sibling files) | hot_food_logs | view, create, edit, delete, export | Four tabs become a segmented control; weekly grid becomes a day-by-day stepper. | 4 |
| 25 | **Food Consumption (In & Out)** (`foodConsumption`) | Facilities & Welfare | `FoodView` (54 lines, 5 sibling files) | food_consumption_reports, food_box_requests | view, create, edit, delete, export | Consumption ratings as cards with portion-waste bars. | 4 |
| 26 | **Food Survey Checks** (`foodSurveys`) | Facilities & Welfare | `FoodSurveysView` (1041 lines, 5 sibling files) | food_surveys, food_meal_ratings | view, create, edit, delete, export | Four survey sections become a stepper; the 21-meal matrix becomes tappable rating rows. | 4 |
| 27 | **Food Wastage Tracker** (`foodWastage`) | Facilities & Welfare | `FoodWastageView` (1282 lines, 5 sibling files) | food_wastage_records | view, create, edit, delete, export | Wastage entries with item-row stepper and master list picker. | 4 |
| 28 | **Room Checks (30-Point Audit)** (`roomChecks`) | Facilities & Welfare | `RoomChecksView` (965 lines) | room_checks, room_check_items | view, create, edit, delete, export | 30-point audit becomes grouped pass / fail rows with photo evidence and an auto grade. | 4 |
| 29 | **Escalations Log** (`escalations`) | Facilities & Welfare | `EscalationsView` (724 lines) | escalations | view, create, edit, delete, export | Urgency colour band and SLA timer on every card. | 4 |
| 30 | **Proof Documents Repository** (`documents`) | Facilities & Welfare | `DocumentsView` (607 lines, 1 sibling files) | documents | view, create, edit, delete, export | File list with type icons; upload via camera, scan or Files. | 4 |
| 31 | **Vendor Invoices** (`finance`) | Finance | `VendorInvoicesView` (814 lines, 7 sibling files) | — | view, create, edit, delete, export, approve | Status tabs become filter chips; invoice photo capture. | 4 |
| 32 | **Credit Card Bills** (`financeCreditCards`) | Finance | `CreditCardBillsView` (800 lines, 7 sibling files) | — | view, create, edit, delete, export, approve | Receipt capture first, fields second. | 4 |
| 33 | **Delivery Notes** (`financeDeliveryNotes`) | Finance | `DeliveryNotesView` (762 lines, 7 sibling files) | — | view, create, edit, delete, export, approve | Delivery proof photo and signature on the detail screen. | 4 |
| 34 | **Finance Approvals** (`financeApprovals`) | Finance | `FinanceApprovalsView` (558 lines, 7 sibling files) | — | view, create, edit, delete, export, approve | Approval queue with swipe actions and a confirm sheet. | 4 |
| 35 | **SD-Compliance Tracker** (`compliance`) | Compliance & Community | `SDComplianceTrackerView` (584 lines) | compliance_records | view, create, edit, delete, export | Expiry countdown on each certificate card, sorted by soonest. | 4 |
| 36 | **SD VCS Directory** (`vcsDirectory`) | Compliance & Community | `SDVCSDirectoryView` (690 lines) | vcs_agencies | view, create, edit, delete, export | Directory cards with one-tap call, email and map. | 4 |
| 37 | **Reports & SharePoint Hub** (`reports`) | Compliance & Community | `ReportsView` (1043 lines, 1 sibling files) | — | view, export | Report builder becomes a step form; export and print through the iOS share sheet. | 2 |
| 38 | **Audit Security Trail** (`audit`) | Compliance & Community | `AuditView` (947 lines) | — | view, export | Timeline of entries grouped by day; five tabs become filter chips. | 1 |
| 39 | **Data Change Requests** (`requests`) | Compliance & Community | `RequestsApprovalsView` (684 lines) | data_change_requests | view, create, edit, delete, export, approve | Request cards; managers get Approve / Reject with remarks. | 5 |
| 40 | **Properties Directory** (`properties`) | Admin & Governance | `PropertiesView` (1082 lines) | — | view, create, edit, delete, export | Active, Archived and Deleted become a segmented control; archiving takes a two-step confirmation. | 7 |
| 41 | **Staff & User Accounts** (`users`) | Admin & Governance | `UsersView` (1511 lines, 2 sibling files) | — | view, create, edit, delete, export | Directory cards; role and site assignment in a form sheet; archive and delete with confirmation. | 7 |
| 42 | **Roles & RBAC Matrix** (`roles`) | Admin & Governance | `RolesView` (725 lines, 1 sibling files) | — | view, create, edit, delete | The role-by-permission matrix becomes a role list; each role opens its toggles. | 2 |
| 43 | **Field Options & Setup** (`setupOptions`) | Admin & Governance | `FieldOptionsSetupView` (695 lines) | — | view, create, edit, delete | Category list opens an editable, reorderable options list. | 2 |
| 44 | **Email Notifications Management** (`notifications`) | Admin & Governance | `NotificationsManagementView` (1066 lines) | — | view, create, edit, delete | SMTP status, rules and delivery logs become three segments. | 3 |
| 45 | **Service Users Master** (`suUsers`) | Safeguarding | `ServiceUsersView` (1018 lines, 16 sibling files) | — | view, create, edit, delete, export, approve | Master list opens a profile with a scrollable tab strip of 17 sections. | 21 |
| 46 | **Property Management** (`propertyManagement`) | Facilities & Welfare | `PropertyManagementView` (585 lines, 10 sibling files) | — | view, create, edit, delete, export | Property list opens a profile with nine sections including rooms, assets and compliance. | 13 |
| 47 | **Page Access Management** (`pageAccess`) | Admin & Governance | `PageAccessView` (407 lines, 1 sibling files) | — | view, create, edit, delete | User picker, then a page-by-action toggle list. | 2 |
| 48 | **Page Maintenance Mode** (`pageMaintenance`) | Admin & Governance | `PageMaintenanceManagerView` (48 lines, 1 sibling files) | — | view, create, edit, delete, export | One toggle per page, with a message editor. | 1 |
| 49 | **System Settings & Preferences** (`settings`) | Admin & Governance | `SettingsView` (533 lines, 2 sibling files) | — | view, create, edit, delete, export | Grouped settings list with drill-in screens. | 1 |

## Tabs, sections and sub-pages found

- **dailyRegisters**: Daily Register, Room List, User Guide, Live Register Statistics, Cross Checks & Validation, Language Summary, New Arrivals, Family Groups, Summary & Guest Statistics (9 sheet tabs)
- **suUsers**: Service User profile: Overview, Personal & Contact, Accommodation, Household, Support, Documents, Reports History, Incident Reports, SG Referrals, Welfare Checks, GP Appointments, Public Transport, PEEP, Education, Food Surveys, Room Checks, Activity (17; Education only when under 18)
- **propertyManagement**: Property profile: Overview, Property Details, Rooms, Service Users, Compliance, Documents, Assets / Inventory, Facilities, Contacts (9)
- **publicTransport**: Overview, Feedback, Challenges, Funding, Oyster
- **food / foodConsumption**: Vendor buffet, SU meals, Consumption, Box requests (one FoodView, two menu entries)
- **foodSurveys**: Survey details, 21 meal ratings matrix, Service & dining, Dishes & dietary
- **suAttendance**: Roll, Records, Follow-ups
- **gpAppointments**: Appointments, Registrations
- **spcd**: Current, Archived
- **documentBuilder**: Generator, Documents
- **notifications**: SMTP, Rules, Logs
- **audit**: Accountability, Properties, Users, Casework, All
- **vcsDirectory**: Table, Matrix
- **finance* (3 pages)**: All, Pending approval, Approved, Paid, Queries, Rejected
- **laundry**: Daily room-by-room log; weekly and monthly property summaries
- **users / properties**: Active, Archived, Deleted records (added in migration 028)

## Modals and forms found

Each tracker opens a create/edit form built from its column definitions (the "Customize Table" feature lets a Super Admin change columns). Notable dedicated modals: QuickIncidentModal, InterconnectRoomsModal, CreateOwnUploadModal, DocumentImportModal, FundingWorkflowModal, FinanceBillDetailModal, FinanceBillModal, FinanceSupplierModal, FinanceVendorModal, BulkUserActionModal, BulkUserImportModal, MoveAccommodationModal, ServiceUserFormModal, AssetFormModal, ComplianceFormModal, PropertyFormModal. Every modal form is represented on iPhone by that page's Form screen; every confirmation is represented by the confirmation sheet pattern (see design system).

## Cross-cutting features found

- Site scoping on every list (all sites vs assigned sites) → site pill and filter sheet.
- Customize Table (Super Admin) → not a mobile feature; schema changes apply to the mobile forms automatically because both read the same schema.
- Export (CSV/PDF), Print → iOS share sheet and print dialog.
- Attachments → camera, scan, Files.
- Audit trail on every write → "Audit trail" row on detail screens (Admin and Super Admin only).
- Live data / sync banner → offline and sync state.
- Inactivity lock → session lock screen.
- Page maintenance mode → maintenance screen.
- Per-user Page Access overrides → hide navigation entries; never grant more than the role.
