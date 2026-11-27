# Documentation Index

This directory contains technical and design documentation for the **SD Operations Platform**.

## Architecture & Hosting
- [**AWS Amplify Hosting Guide**](./AMPLIFY_HOSTING.md): Static frontend hosting on AWS Amplify with Direct Client-Side Supabase Mode.
- [**Live Database Architecture**](./live-database.md): PostgreSQL / Supabase live database connection, caching policies, schema adapters, and offline fallback.
- [**iOS Mobile Architecture & Implementation**](./ios.md): Native Capacitor 6 mobile app architecture, offline syncing, biometric security, and APNs.

## Audits & Design Plans
Audit reports now live in the local-only `application-map/` folder (git-ignored): `application-map/audit-progress/docs-audits/` holds the overdue/notification, central dashboard, operational workflow, route, room/welfare UI, SU data-integrity and design audits. Related planning and standards that remain here: [Implementation Roadmap](./SDTRACKER_IMPLEMENTATION_ROADMAP.md), [Operations Dashboard V2](./SDTRACKER_OPERATIONS_DASHBOARD_V2.md), [Global Form Standard](./SDTRACKER_GLOBAL_FORM_STANDARD.md), [Table & Navigation Standard](./SDTRACKER_TABLE_AND_NAVIGATION_STANDARD.md).

## Design System & UI
- [**Brand Kit & UI Component Inventory**](./BRAND_KIT.md): Comprehensive design tokens, palette colors, component styles, and accessibility rules.
- [**UI Component Library & Reuse Guide**](./ui.md): Detailed component documentation, blueprints, and implementation reference.
- [**Interactive UI Kit Preview**](./ui-kit.html): Standalone HTML preview to inspect interactive components, badges, buttons, and test states.

## Operations & Support Manuals
- [**Documentation & Operational Pack**](../.document-pack/index.html): Standard operating procedures, SLA & incident remediation framework, change management, and executive checklists.

## Testing & Quality Assurance
- [**QA Remediation Guide**](./qa-remediation.md): Test execution, failure report remediation workflows, and verification procedures.
