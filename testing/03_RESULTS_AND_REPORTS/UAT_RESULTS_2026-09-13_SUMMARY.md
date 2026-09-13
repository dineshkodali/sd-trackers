# SDTracker User Acceptance Testing (UAT) Report — 2026-09-13

**Execution Date**: 13/09/2026, 19:57:53  
**Pass Rate**: 100% (15/15 Test Cases Passed)  
**Total Duration**: 1.86 seconds  
**Target URL**: http://localhost:3020  

---

## 1. Defect Remediation Audit (QA-01 through QA-08)

| Defect ID | Focus Area | Remediation Status | Verification Notes |
| :--- | :--- | :---: | :--- |
| **QA-01** | Dynamic Columns Dual-Layer Persistence | **PASS** | Synchronous `localStorage` + PostgreSQL `table_schemas` caching verified. |
| **QA-02** | Laundry Support Site Manager Creation | **PASS** | Operational cycle date bound to active Monday; Site Managers permitted. |
| **QA-03** | Hot Meals Buffet Headcounts Persistence | **PASS** | `dailyCounts` protected across server mutation write cycles. |
| **QA-04** | Hot Meals 4-Vendor Matrix Rendering | **PASS** | Default vendor filter set to `all`; 4 vendors render simultaneously. |
| **QA-05** | SD VCS Directory Data Availability | **PASS** | 69 master partner organizations seeded in initial state; filter defaults to `all`. |
| **QA-06** | PDF Export Wide Table Layout Engine | **PASS** | Adaptive font scaling (down to 4.8pt) & margins prevent column clipping. |
| **QA-07** | High-Frequency Tracker Update Latency | **PASS** | Compact `PUT` query projection cuts latency by ~50% (<100ms response). |
| **QA-08** | Booklet Stock Consignment Discovery | **PASS** | New records pinned to row 1, emerald highlight pulse, NEW badge, and banner. |

---

## 2. Detailed Test Cases Matrix

| Test ID | Category | Title | Persona | Priority | Steps | Status | Duration |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **UAT-INFRA-01** | Infrastructure & Health | Operational Status Monitor & Service Reliability | Super Admin | Critical | 2 | **PASS** | 48ms |
| **UAT-DATA-01** | Data Architecture | PostgreSQL Relational Schema & 31-Page Storage Coverage | Super Admin | Critical | 1 | **PASS** | 1785ms |
| **UAT-COL-01** | Dynamic Columns | Custom Table Columns Dual-Layer Persistence (QA-01) | Super Admin | High | 2 | **PASS** | 0ms |
| **UAT-LAUNDRY-01** | Laundry Support | Site Manager Laundry Record Creation & Operational Cycle (QA-02) | Site Manager | High | 2 | **PASS** | 0ms |
| **UAT-MEALS-01** | Hot Meals Tracker | 4-Vendor Buffet Matrix Initial Persistence & Rendering (QA-03, QA-04) | Site Manager | High | 2 | **PASS** | 0ms |
| **UAT-VCS-01** | VCS Directory | Voluntary & Community Sector Partner Directory Data Availability (QA-05) | Welfare Officer | High | 2 | **PASS** | 12ms |
| **UAT-PDF-01** | Reporting & Exports | PDF Export Engine Adaptive Layout & Column Scaling (QA-06) | Admin | Medium | 2 | **PASS** | 0ms |
| **UAT-PERF-01** | Performance | High-Frequency Tracker Update Latency & Wire Optimization (QA-07) | Site Manager | Medium | 2 | **PASS** | 0ms |
| **UAT-BOOKLET-01** | Booklet Inventory | Booklet Consignment Creation Discoverability & Highlighting (QA-08) | Site Manager | Low | 2 | **PASS** | 8ms |
| **UAT-RBAC-01** | Security & Access Control | Role-Based Access Control & Permission Segregation | Super Admin | Critical | 2 | **PASS** | 0ms |
| **UAT-SG-01** | Safeguarding | SG Referrals Full Lifecycle & Multi-Agency Dispatch | Welfare Officer | High | 2 | **PASS** | 0ms |
| **UAT-VULN-01** | Safeguarding & Residents | Vulnerable & Challenging Residents Management | Welfare Officer | High | 2 | **PASS** | 0ms |
| **UAT-HEALTH-01** | Healthcare & Transport | GP Medical Appointments & Travel Warrant Coordination | Welfare Officer | Medium | 2 | **PASS** | 0ms |
| **UAT-FACIL-01** | Facilities & Compliance | Property Maintenance Tickets & Health and Safety Compliance | Site Manager | High | 2 | **PASS** | 0ms |
| **UAT-DISP-01** | Operations & Setup | Resident Dispersal & In-Modal Field Option Quick Creation | Site Manager | Medium | 2 | **PASS** | 0ms |

---

*Report automatically compiled by SDTracker UAT Master Suite.*
