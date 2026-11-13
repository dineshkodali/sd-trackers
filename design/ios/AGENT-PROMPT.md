# Prompt for the design agent: SDTracker iOS app — full redesign pass

> Paste everything below into the other agent. It is self-contained. Reference material already exists in this repository under `design/ios/`; the agent should read it first and improve on it, not start from nothing.

---

## 1. Your role

You are a Senior iOS Product Designer and Mobile UX Architect (with React Native / SwiftUI implementation sense). Redesign the SDTracker iPhone app so that **every module and section listed in section 5 exists as a polished, native-feeling iOS screen set**. This is a mobile adaptation of an existing enterprise web app, not a new product. Do not invent features. Do not drop features because they are hard on a phone.

## 2. Context

- SDTracker is an enterprise property-management, safeguarding and operations platform used by hotel/accommodation teams.
- Web stack: React + Vite, Supabase (PostgreSQL, Auth, RLS), Express API, hosted on AWS Amplify. The iOS app must work against the **same backend and data model** and respect the **same role and site rules**.
- The web app has **no URL router**; it switches pages in memory. Treat each page below as a module.
- The web brand colour is teal (`#0D9488` accent, `#0F766E` on light surfaces). Keep it as the app tint.
- There are exactly **six roles**: Super Admin, Admin, Regional Manager, General Manager, Area Manager, Staff. There is **no Engineer and no Customer role** in the repository; do not design them. If you believe they are needed, list that as a question, do not draw them.

## 3. Read first (in this repo)

1. `design/ios/README.md` and `design/ios/06-COVERAGE-REPORT.md` — what exists and its stated limits.
2. `design/ios/01-SCREEN-INVENTORY.md`, `02-NAVIGATION-ARCHITECTURE.md`, `03-DESIGN-SYSTEM.md`, `04-SCREEN-SPECS.md`.
3. `design/ios/mockups/` and `design/ios/overview/` — the current 258 screens.
4. `design/ios/data/audit.json` — machine-readable page, field, tab and role data extracted from the source.
5. Web source for truth when in doubt: `src/config/pageRegistry.ts`, `src/App.tsx`, `src/data/initialData.ts`, `src/data/defaultTableSchemas.ts`, `src/config/pagePermissionsConfig.ts`, `src/config/recordLifecycle.ts`, `db/migrations/`.

## 4. What to improve over the current set

The current mock-ups are a reference pass generated from templates. Raise them to premium, art-directed quality:

- Hand-design the ~14 trackers that currently share one generic list/detail/form template (Referrals, Vulnerable, Challenging, Welfare Checks, RFA, MH-Complaint, GP, PEEP, Maintenance, SPCD, IR, Dispersal, Escalations, Requests). Each needs its own card anatomy, colour band or timer where meaningful (risk, priority, SLA, review-due), and its own detail layout.
- Give every module tab/section its **own screen** (the current set represents many only as a segmented control).
- Show multi-section forms fully (Welfare Check, Food Survey, Property form, Service User form, HO report), as step-by-step flows with progress, not just the first fields.
- Add **dark mode** and **Dynamic Type (largest accessibility size)** variants for the key screens (Home, one list, one detail, one form, one sheet).
- Add **iPad** adaptation notes only if cheap; iPhone is the priority.
- Real SF Symbols and SF Pro if available in your environment. Otherwise keep stand-ins and name the SF Symbol under each module.
- Replace generic sample data with realistic but **fictional** data per module (never real residents, properties, references, phones or emails).

## 5. Modules and sections that must be in the iOS app

All 49 pages are in scope. For each: purpose, web actions, roles, tabs/sections, key fields (from the web columns) and the mobile pattern to keep.

### Overview
- **Executive Dashboard** (`dashboard`) — Site activity, risk levels and property occupancy.
  - Web actions: view. Roles: all six.
  - Key fields: Record Type; Site / Hotel; Service User / Resident; Reference (Port / NASS / ID); Status; Record Date; Details / Incident Notes.
  - Mobile pattern to keep: Widget grid becomes a scrollable home with KPI cards, charts and a needs-attention list.
- **Live Daily Registers** (`dailyRegisters`) — Real-time property room makeup, occupancy tracking, new arrivals, and evictions.
  - Web actions: view, edit, delete, export. Roles: all six.
  - Sections/tabs: Live Register Statistics · Room List · User Guide · Daily Register · Cross Checks & Validation · Language Summary · New Arrivals · Family Groups · Summary & Guest Statistics.
  - Key fields: Room No.; Floor; Room Makeup; Single Bed; Double Bed; Single Bunk; Double Bunk; Cot; SU Make Up; Port Ref; Name; Check In Date; Contact No.; Email.
  - Mobile pattern to keep: Nine sheet tabs become a segmented hub; the 54-column table becomes resident cards and a guest-filter sheet.

### Safeguarding
- **SG Referrals Master** (`referrals`) — Primary register for new resident arrivals, intake safeguarding, and property placements.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Hotel / Site; Referral Council; Service User Name; Port / NASS Ref; Mosaic ID; Date of Birth; Raised By; Officer Leading (Hotel); Referral Type; Status; Date Referred; Method of Referral; Acknowledgement; LA Response.
  - Mobile pattern to keep: Table of 19 columns becomes status-filtered cards; detail screen groups fields into sections.
- **Archived SG Referrals** (`referralsArchive`) — Historical archive of departed or completed resident referrals.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Hotel / Site; Referral Council; Service User Name; Port / NASS Ref; Mosaic ID; Date of Birth; Raised By; Officer Leading (Hotel); Referral Type; Status; Date Referred; Method of Referral; Acknowledgement; LA Response.
  - Mobile pattern to keep: Same card as Referrals, read-only, with a Restore action for permitted roles.
- **Vulnerable Residents** (`vulnerable`) — High-dependency resident monitoring, medical conditions, and safeguarding plans.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Hotel / Site; Room / Flat No; Service User Name; Port / NASS Ref; Date of Birth; Demographic Group; Gender; Risk Level; Vulnerability Category; Safeguarding Actions; SG Team Update; Next Review Date; Raised By; Allocated Worker.
  - Mobile pattern to keep: Risk level leads each card; review dates sort to the top.
- **Archived Vulnerable SUs** (`vulnerableArchive`) — Historical records of formerly tracked vulnerable service users.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Hotel / Site; Room / Flat No; Service User Name; Port / NASS Ref; Date of Birth; Demographic Group; Gender; Risk Level; Vulnerability Category; Safeguarding Actions; SG Team Update; Next Review Date; Raised By; Allocated Worker.
  - Mobile pattern to keep: Read-only archive of vulnerable residents.
- **Challenging Behavior SUs** (`challenging`) — Incident escalation register, behavioral risk warnings, and police involvement logs.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Log Date; Hotel / Site; Resident Name; PORT Reference; Date of Birth; Group; Gender; Raised By; Type of Issue; Incident Description; Date of Incident; Action Taken; Advice Given by SG Team; Follow-Up Required.
  - Mobile pattern to keep: Incident cards with risk factor and follow-up flag; description opens in detail.
- **Archived Challenging Incidents** (`challengingArchive`) — Historical archive of resolved behavioral incidents.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Log Date; Hotel / Site; Resident Name; PORT Reference; Date of Birth; Group; Gender; Raised By; Type of Issue; Incident Description; Date of Incident; Action Taken; Advice Given by SG Team; Follow-Up Required.
  - Mobile pattern to keep: Read-only archive of resolved incidents.
- **Welfare Checks** (`welfareChecks`) — Safeguarding welfare declarations, health screening, and resident contact checks.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Date & Time; Port Ref; Flat / Room No; Property / Site; Conducting Officer; Location; Contact Method; Engagement Agreed; Family/Individual; GP Registered; Health Change; Mental Health Change; Maintenance Issues; Welfare Notes.
  - Mobile pattern to keep: A long multi-section form becomes a step-by-step form with progress and per-section save.
- **RFA Welfare Checks** (`rfaWelfare`) — Room and flat welfare checks, with vulnerability categories.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Date; Hotel / Site; Room / Flat No; Resident Name; Date of Birth; Port / NASS Ref; Vulnerability / Issue; Action Taken; MH Ticket Ref.
  - Mobile pattern to keep: Room and flat checks as cards with the vulnerability tag.
- **MH-Complaint Welfare Checks** (`mhComplaintWelfare`) — Migrant Help complaint welfare checks, case investigations, and resident resolution tracking.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Date; Hotel / Site; Room / Flat No; Resident Name; Date of Birth; Port / NASS Ref; MH Complaint / Ticket Ref; Complaint Details / Issue Description; Action Taken / Site Remedies; Handled / Logged By; Internal Notes.
  - Mobile pattern to keep: Complaint case cards with ticket reference and status.
- **GP Appointments** (`gpAppointments`) — Medical appointment attendance tracking, scheduled bookings, and DNA logs.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Appointments · Registrations.
  - Key fields: Room No; Port Reference; Service User Name; Hotel Site; Referral Sent On; Appointment Date; Time of GP; Comments / Clinic Notes.
  - Mobile pattern to keep: Appointments and Registrations become a two-segment control.
- **PEEP Tracker** (`peepTracker`) — Personal Emergency Evacuation Plans: mobility, risk level, assistance and review dates.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Service User; Port Reference; Property; Room; Mobility; Risk Level; Assistance Needed; Equipment; Evacuation Route; Review Date; Status.
  - Mobile pattern to keep: Evacuation plan cards sorted by risk; review-due banner at the top.
- **SU Attendance Tracker** (`suAttendance`) — Daily attendance, absence monitoring and 3 / 7 day follow-up.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Roll · Records · Follow-ups.
  - Key fields: Port reference; Service User Name; DOB; Room No; Property / Site; Attendance Date; Attendance Status; Additional notes; Recorded By; Last Updated; Roll Date; Notes; Absent Since; Consecutive Days.
  - Mobile pattern to keep: Roll, Records and Follow-ups become three segments; the roll becomes tap-to-mark rows with a bulk "mark all present" action.
- **HO Report Generator** (`documentBuilder`) — Official Home Office Incident Report (IR) document builder and export engine.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Sections/tabs: Generator · Documents.
  - Mobile pattern to keep: Generator and Documents become two segments; the builder becomes a guided stepper with live preview in a sheet.
- **Service Users Master** (`suUsers`) — Central master database for Service Users, placements, household, support, and profiles.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Sections/tabs: Overview · Personal & Contact · Accommodation · Household · Support · Documents · Reports History · Incident Reports · SG Referrals · Welfare Checks · GP Appointments · Public Transport · PEEP · Education · Food Surveys · Room Checks · Activity.
  - Key fields: SU ID; Full Name; Port / HO Ref; Date of Birth; Gender; Nationality; Current Site; Current Property; Room; Status; Vulnerable; Personal Evacuation Plan; GP Registration; Disability Category.
  - Mobile pattern to keep: Master list opens a profile with a scrollable tab strip of 17 sections.

### Facilities & Welfare
- **Maintenance Tracker** (`maintenance`) — Property defect reports, emergency CAT 1 hazards, and contractor remediation.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Report Date; Priority Category; Timescale; Location; Hotel / Site; Room / Unit; HO Criteria Code; Defect Description; Raised By; Close Due Date; Defect Status; Action; Progress Details; Actual Closed Date.
  - Mobile pattern to keep: Priority colour band on each card; photo capture for evidence; criteria guide in a sheet.
- **SPCD Tracker** (`spcd`) — Special Pest Control & Decontamination logs and resolution statuses.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Current · Archived.
  - Key fields: Case Date; Hotel / Site; Room Number; Service User Name; PORT / NASS Ref; Date of Birth; Raised By; Action Taken / Description; Follow Up Notes; Case Updates; Safeguarding Review; Departure Date; Reason for Leaving.
  - Mobile pattern to keep: Current and Archived become a segmented control.
- **IR Tracker (Incidents)** (`irTracker`) — Property incidents, witness accounts and police logs.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: SITE; DATE; SU NAME; Port Ref; Incident Time; Witnesses (Security, Welfare, Managers, SUs, etc.); IR SUMMARY; IN for 1st review; CT 1ST Review; In for 2nd review; CT 2nd review.
  - Mobile pattern to keep: Incident report cards; summary and submitted-to-CRH flag on detail.
- **Public Transport Tracker** (`publicTransport`) — Service user travel tickets, bus passes, and exceptional circumstances.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Overview · Feedback · Challenges · Funding · Oyster.
  - Key fields: Hotel / Site; Site Manager; Staff Place; Reporting Staff Member; Approval URN; Service User Name(s); Port Ref(s); Accommodation Address; Appointment Date; Appointment Time; Appointment Location; Distance (Miles); Exceptional Circumstances.
  - Mobile pattern to keep: Five tabs become a scrollable segmented control.
- **Dispersal Sheet** (`dispersal`) — Notice issuance, departure schedules, exit briefings, and relocation tracking.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Dispersal · Evictions.
  - Key fields: S.No; Site / Hotel; Flat / Room No; SU Port / NASS Ref; Reason for Departure; Date Received; Dispersal Date; Date Left Property; Reason Failed to Travel; 2nd Dispersal Date.
  - Mobile pattern to keep: Dispersal and eviction tables become cards under a two-segment control.
- **Booklet Inventory** (`booklets`) — Multi-lingual informational booklet collection and replenishment logs.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Hotel / Site; Agent / Provider; Booklet Type; Language; Target / To Collect; Collected Booklets; Booklets Received; Notes.
  - Mobile pattern to keep: Stock rows with a collected/target progress bar.
- **Commercial Laundry Support** (`laundry`) — Weekly laundry cycle weights, contractor invoices, and variance flags.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Daily log · Summaries.
  - Key fields: Property / Hotel; Log Period; Dirty Laundry Sent; Clean Laundry Returned; Discrepancies; Discrepancy Details; Remarks / Actions Taken; Staff / Auditor; Date From; Date To.
  - Mobile pattern to keep: Daily room-by-room log with steppers; weekly and monthly summaries in a second segment.
- **Housekeeping Log** (`housekeeping`) — Daily room cleaning logs, communal sanitisation audits, and housekeeping inspections.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Date; Property / Site; Communal fridges cleaned (Thu & Sun); Inspected / Signed off by; Remarks & Follow-up.
  - Mobile pattern to keep: Daily checklist becomes toggles per task with inspector sign-off.
- **Hot Meals Tracker** (`food`) — Daily hot meal distribution, vendor buffet temperature logs, and quality scores.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Vendor buffet · SU meals · Consumption · Box requests.
  - Key fields: Property / Hotel; Week Range; Date From; Date To; Compliance & Quality Notes; Audited By.
  - Mobile pattern to keep: Four tabs become a segmented control; weekly grid becomes a day-by-day stepper.
- **Food Consumption (In & Out)** (`foodConsumption`) — Daily meal consumption ratings, portion waste percentages, and special box requests.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Consumption · Box requests · Vendor buffet · SU meals.
  - Key fields: Date; Property / Hotel; Feedback / Comments; Reported / Inspected By.
  - Mobile pattern to keep: Consumption ratings as cards with portion-waste bars.
- **Food Survey Checks** (`foodSurveys`) — Resident meal satisfaction survey, dietary requirements, and 21-rating matrices.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Details · Rating matrix · Service · Dishes.
  - Key fields: Survey Date; Property / Site; Port Ref; House Officer; Food Quality; Server Quality; Cleanliness; Menu Diversity; Liked Most; Liked Least; Suggestions; Dietary Requirements.
  - Mobile pattern to keep: Four survey sections become a stepper; the 21-meal matrix becomes tappable rating rows.
- **Food Wastage Tracker** (`foodWastage`) — Portion surplus tracking, meal wastage auditing, and disposal compliance.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: SITE; DATE; FOOD ITEM; QUANTITY WASTED; REMARKS.
  - Mobile pattern to keep: Wastage entries with item-row stepper and master list picker.
- **Room Checks (30-Point Audit)** (`roomChecks`) — 30-point room condition and safety inspection matrix with automated grading.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Date; Property / Site; Room No; AIC Ref; Inspector; Comments.
  - Mobile pattern to keep: 30-point audit becomes grouped pass / fail rows with photo evidence and an auto grade.
- **Escalations Log** (`escalations`) — Cross-module critical incident alerts, SLA timers, and supervisor sign-offs.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Date of Incident; Site / Property; Resident Name; Port / NASS Ref; Submitted By; Reported Authorities; Action Taken; Incident Notes.
  - Mobile pattern to keep: Urgency colour band and SLA timer on every card.
- **Proof Documents Repository** (`documents`) — Secure digital proof storage for safeguarding compliance and certificates.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Document Title; Hotel / Site; Resident / Property; Port Ref / Property Ref; Uploaded By; Upload Date; Notes.
  - Mobile pattern to keep: File list with type icons; upload via camera, scan or Files.
- **Property Management** (`propertyManagement`) — Central master database for sites, properties, rooms, facilities, assets, and compliance.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: Overview · Property Details · Rooms · Service Users · Compliance · Documents · Assets / Inventory · Facilities · Contacts.
  - Key fields: Property ID; Property Name; Site / Location; Full Address; Property Type; Rooms Count; Bed Capacity; Occupied Spaces; Occupancy Rate; Status.
  - Mobile pattern to keep: Property list opens a profile with nine sections including rooms, assets and compliance.

### Finance
- **Vendor Invoices** (`finance`) — Commercial supplier invoices, line item reconciliation, and payment statuses.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Sections/tabs: All · Pending · Approved · Paid · Queries · Rejected.
  - Key fields: Bill / Invoice #; Site / Property; PO / Ref #; Invoice Date; Due Date; Subtotal (£); VAT / Tax (£); Total (£).
  - Mobile pattern to keep: Status tabs become filter chips; invoice photo capture.
- **Credit Card Bills** (`financeCreditCards`) — Operational credit card expenditure logs and department expense receipts.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Sections/tabs: All · Pending · Approved · Paid · Queries · Rejected.
  - Key fields: Receipt / Ref #; Site / Property; Transaction Date; Amount (£); Expense Reason.
  - Mobile pattern to keep: Receipt capture first, fields second.
- **Delivery Notes** (`financeDeliveryNotes`) — Site goods receipt notes, physical delivery verifications, and signed proofs.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Sections/tabs: All · Pending · Verified · Invoiced · Paid · Queries.
  - Key fields: Delivery Note #; Delivery Site; PO Reference; Delivery Date; Invoice Value (£); Goods / Condition Notes.
  - Mobile pattern to keep: Delivery proof photo and signature on the detail screen.
- **Finance Approvals** (`financeApprovals`) — Financial approval steps and payment release approvals.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Key fields: Bill Reference; Property / Site; Type; Bill Date; Due Date; Payable (£).
  - Mobile pattern to keep: Approval queue with swipe actions and a confirm sheet.

### Compliance & Community
- **SD-Compliance Tracker** (`compliance`) — Statutory property compliance certificates, fire safety, gas, and electrical tests.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Key fields: Sr No; Site / Hotel; Contractor Name; Contractor Contact; Contractor Email; Issued Date; Expiry Date; Action Taken; Previous Contractor.
  - Mobile pattern to keep: Expiry countdown on each certificate card, sorted by soonest.
- **SD VCS Directory** (`vcsDirectory`) — Voluntary & Community Sector agency partners, contact directories, and services.
  - Web actions: view, create, edit, delete, export. Roles: all six.
  - Sections/tabs: List · Matrix.
  - Key fields: Agency / Organization; Hotel / Site; Services Provided; Contact Person; Contact Number; Email Address; Address; Notes.
  - Mobile pattern to keep: Directory cards with one-tap call, email and map.
- **Reports & SharePoint Hub** (`reports`) — Reports, data exports and live Excel workbook sync.
  - Web actions: view, export. Roles: Super Admin, Admin, Regional Manager, General Manager, Area Manager.
  - Key fields: Reference Code / ID; Subject / Resident / Title; Site / Hotel Location; Category / Incident Type; Status; Date Registered; Priority / Urgency Level; Duty Officer; Authority / Contractor; Details / Action Summary.
  - Mobile pattern to keep: Report builder becomes a step form; export and print through the iOS share sheet.
- **Audit Security Trail** (`audit`) — Immutable, tamper-evident cryptographic log of all system changes and writes.
  - Web actions: view, export. Roles: Super Admin, Admin.
  - Key fields: Timestamp; Logged By / User; User Role; Module; Action Type; Target Item; Hotel / Site; Action Details.
  - Mobile pattern to keep: Timeline of entries grouped by day; five tabs become filter chips.
- **Data Change Requests** (`requests`) — Requests to change locked records. A manager must sign them off.
  - Web actions: view, create, edit, delete, export, approve. Roles: all six.
  - Key fields: Request ID; Hotel / Site; Tracker Module; Record Subject / Title; Request Type; Submitted By; Submitter Role; Status; Reason / Justification; Reviewed By; Review Remarks; Submission Date.
  - Mobile pattern to keep: Request cards; managers get Approve / Reject with remarks.

### Admin & Governance
- **Properties Directory** (`properties`) — Hotel and accommodation site profiles, rooms inventory, and property managers.
  - Web actions: view, create, edit, delete, export. Roles: Super Admin, Admin, General Manager, Area Manager, Staff.
  - Key fields: PID (Hotel Code); Property / Site Name; City / Area; Address; Capacity; Lead Contact Officer; Contact Phone; Operational Status.
  - Mobile pattern to keep: Active, Archived and Deleted become a segmented control; archiving takes a two-step confirmation.
- **Staff & User Accounts** (`users`) — User access directory, account provisioning, assigned sites, and credentials.
  - Web actions: view, create, edit, delete, export. Roles: Super Admin, Admin, General Manager, Area Manager, Staff.
  - Key fields: Full Name; Email Address; Assigned Role; Assigned Hotels / Sites; Account Status; Last Active.
  - Mobile pattern to keep: Directory cards; role and site assignment in a form sheet; archive and delete with confirmation.
- **Roles & RBAC Matrix** (`roles`) — Granular role permissions matrix, export permissions, and authority levels.
  - Web actions: view, create, edit, delete. Roles: Super Admin.
  - Mobile pattern to keep: The role-by-permission matrix becomes a role list; each role opens its toggles.
- **Field Options & Setup** (`setupOptions`) — System dropdown options, custom lookup lists, and category tags.
  - Web actions: view, create, edit, delete. Roles: Super Admin.
  - Mobile pattern to keep: Category list opens an editable, reorderable options list.
- **Email Notifications Management** (`notifications`) — Automated SMTP email triggers, recipient rules, and incident notification alerts.
  - Web actions: view, create, edit, delete. Roles: Super Admin, Admin.
  - Sections/tabs: SMTP · Rules · Logs.
  - Mobile pattern to keep: SMTP status, rules and delivery logs become three segments.
- **Page Access Management** (`pageAccess`) — 
  - Web actions: view, create, edit, delete. Roles: Super Admin.
  - Mobile pattern to keep: User picker, then a page-by-action toggle list.
- **Page Maintenance Mode** (`pageMaintenance`) — 
  - Web actions: view, create, edit, delete, export. Roles: Super Admin.
  - Mobile pattern to keep: One toggle per page, with a message editor.
- **System Settings & Preferences** (`settings`) — 
  - Web actions: view, create, edit, delete, export. Roles: Super Admin, Admin.
  - Mobile pattern to keep: Grouped settings list with drill-in screens.

### Cross-cutting features that also need screens
- Sign-in, forgot/reset password, session lock after inactivity, account blocked (archived/suspended), page under maintenance, access denied, offline/sync state, loading/empty/error/success states.
- Global search (web "Quick Jump"), notification centre with unread badge, profile, personal app settings, Face ID unlock.
- Personalised Home: reorderable widgets (key summary, case totals, trends, cases by property, vulnerability risk, laundry and food summary, guest statistics, transport, priority safeguarding, quick actions, my requests, open maintenance, compliance status, finance bills, recent notifications). A widget appears only if the role can open its page.
- Guest filters and statistics on Daily Registers: age (children under 18, adults, elderly 65+, custom), gender, family size (1–5+, custom), Aspen card; summary cards and charts; tapping a figure opens the register with that filter, site and date.
- Interconnecting rooms: Room List badges, connected rooms, availability, manager-only configuration (Super Admin, Admin, General/Area Manager), allocation picker showing group availability, family across connected rooms, double-booking prevention.
- Archive and recoverable delete for Users and Properties: Active / Archived / Deleted, two-step archive confirmation, only Super Admin can restore, history.
- Per-user Page Access overrides (restrict only, never elevate), Page Maintenance Mode, Roles & RBAC matrix, Field Options setup, Email notification rules and logs, Audit trail (read-only), Reports builder and export, Data Change Requests with manager sign-off.
- Attachments everywhere they exist on the web: camera, document scan, Files, photo library.
- Export/print via the iOS share sheet.

## 6. Roles and access (do not expose what a role cannot open)

- **Super Admin** — Platform owner; scope: All sites; Page Access, Page Maintenance, Roles & RBAC, Field Options, restore of archived/deleted users and properties. Pages visible: 49/49.
- **Admin** — Administrator; scope: All sites; Users, Properties, Audit trail, Settings, Email notifications, finance; no restore, no Roles/Page Access. Pages visible: 45/49.
- **Regional Manager** — Manager (regional); scope: All sites; Reports and export; no Users/Properties pages, no deletes, no Audit/Settings. Pages visible: 40/49.
- **General Manager** — Manager (site); scope: Assigned sites; Reports and export; Users and Properties limited to own sites and lower roles. Pages visible: 42/49.
- **Area Manager** — Manager (area); scope: Assigned sites; Same as General Manager. Pages visible: 42/49.
- **Staff** — Frontline staff; scope: Assigned sites; Create and edit records; no export, no archive/restore, no Reports/Audit/Settings; Users and Properties limited to own sites. Pages visible: 41/49.

Per-user Page Access can remove any page for any user; it never adds access. Navigation must hide unavailable modules entirely (no greyed-out rows).

## 7. Navigation requirements

Five bottom tabs: **Home, Safeguarding, Operations, Search, More**. Do not put every module in the tab bar. Hub screens list modules; modules with 5+ tabs use a scrollable chip strip, up to 4 use a segmented control; filters, pickers and confirmations are bottom sheets; create/edit are modal forms (Cancel / Save); records push to Detail screens. Propose a better structure only if you can justify it against the role matrix, and show it.

## 8. Platform and quality rules

- Follow Apple's Human Interface Guidelines: large titles, inset grouped lists, system pickers, swipe actions, haptics, safe areas, 44pt targets, Dynamic Type, VoiceOver labels, Reduce Motion, Increase Contrast.
- Status is always colour plus text. Contrast at least 4.5:1.
- Desktop tables are never shrunk: identifying column = title, one supporting line, status badge, up to three facts; everything else on Detail in grouped sections.
- Destructive actions are confirmed; archive takes two separate confirmations.
- Never expose admin or sensitive functions to roles without them.
- Do not use Lucide or Tabler glyphs in the final art if SF Symbols are available.

## 9. Deliverables (write under `design/ios-v2/`; never overwrite `design/ios/` or any web file)

1. **Screen inventory** mapping every page, tab and modal to its mobile screens.
2. **Navigation architecture** and role-by-module access matrix.
3. **Design system**: colour (light and dark), typography, spacing, components, states, icons, with tokens in JSON.
4. **iPhone mock-up images (PNG)** for every screen: splash, sign-in, home (per role), module hubs, every list, detail, form, filter, sheet, every tab/section, notifications, profile, settings, role-specific variants, key workflows. Include dark mode and large-text variants for key screens.
5. **Screen specifications**: purpose, layout, components, data, actions, navigation, permissions, mobile interactions.
6. **Workflow walkthroughs** (images): referral intake, arrival and interconnecting-room allocation, finance approval, change request, archive and restore, room check and escalation.
7. **Coverage report**: pages identified vs redesigned, tabs and modals covered, roles covered, open questions. Every page in section 5 must be listed with its screen count; anything not covered must say so plainly.

## 10. Process

Phase 1 audit against the source and the existing `design/ios` set, listing gaps. Phase 2 navigation and roles. Phase 3 design system. Phase 4 mock-ups module by module, keeping a completion checklist. Phase 5 specifications and workflows. Phase 6 verification: re-count pages and tabs against `design/ios/data/audit.json` and report any difference.

## 11. Hard constraints

- Design only. No backend change, no migration, no database access, no production data, no web file edits, no iOS code in this task.
- Do not invent modules, roles, fields or flows. If something is unclear, record it as a question in the coverage report.
- Use fictional data only.
- Be honest in the coverage report about anything simplified, generated from a template or not rendered.

## 12. Known facts and open questions to carry forward

- Engineer and Customer roles do not exist (see section 2).
- Push notifications do not exist on the web (in-app centre and email rules only); designs may propose them, flagged as new.
- Offline conflict behaviour is undefined on the web; propose and flag it.
- Approver rules by amount band for finance were not found in the repository; do not invent thresholds.
- Customize Table (Super Admin edits columns) changes the schema forms are built from; assume mobile forms follow it.
