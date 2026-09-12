# 01. Production & Environment Readiness Guide

> **Audience**: DevOps Engineers, Infrastructure Leads, Super Admins  
> **System**: SD Commercial Tracker WebCRM  
> **Last Updated**: Current Release  

---

## 1. System Architecture Overview

SD Tracker WebCRM is architected as a high-performance, resilient, dual-layer cloud web application:

```mermaid
graph TD
    UserBrowser[Staff & Manager Browsers\nDesktop & Tablet] -->|HTTPS / WSS| CDN[Edge CDN / Reverse Proxy\nAWS Amplify / Cloudflare / Nginx]
    CDN -->|Static SPA Assets| ViteDist[Vite React Frontend Bundle\nHTML, CSS, TSX]
    CDN -->|API Requests /api/*| ExpressServer[Express.js Node API Server\nPort 3000 / tsx]
    ExpressServer -->|Service Role / Direct SQL| SupabaseDB[(Supabase Managed PostgreSQL\n+ RLS Policies)]
    ViteDist -->|Direct Query Auth & Read Fallback| SupabaseDB
    SupabaseDB --> StorageBucket[Supabase Storage\nEncrypted Evidence & Attachments]
```

### Components:
1. **Frontend**: React 18 + TypeScript + TailwindCSS / Fluent Design tokens built with Vite.
2. **Backend API**: Express.js server providing REST endpoints, system health, database proxying, and email notifications.
3. **Database Layer**: Supabase PostgreSQL 15+ with Row-Level Security (RLS) policies and automatic JSON schema adaptation.
4. **Offline / Network Resilience**: Dual-write pattern with graceful local cache fallback to prevent data entry loss during hotel WiFi drops.

---

## 2. Production Environment Configuration

All environment variables must be securely set in the production environment (AWS Amplify Console, Docker `.env.production`, or Linux systemd service).

### Required Environment Variables

| Variable Name | Required By | Description / Example | Security Requirement |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Both | `production` | Public |
| `PORT` | Server | `3000` (or host-assigned port) | Public |
| `VITE_SUPABASE_URL` | Frontend & Server | `https://<project-ref>.supabase.co` | Safe for client bundle |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public Anon JWT key | Safe for client bundle (protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server ONLY | Server Service Role JWT key | **CRITICAL SECRET** (Never expose to client) |
| `DATABASE_URL` | Server (optional) | `postgresql://postgres:[password]@db...` | **CRITICAL SECRET** |
| `CORS_ORIGIN` | Server | `https://tracker.sdcommercial.co.uk` | Production domain only |
| `SMTP_HOST` | Server (notifications) | e.g. `smtp.office365.com` or SendGrid | Infrastructure Secret |
| `SMTP_PORT` | Server | `587` | Standard TLS Port |
| `SMTP_USER` | Server | `notifications@sdcommercial.co.uk` | Email address |
| `SMTP_PASS` | Server | Secure App Password | **CRITICAL SECRET** |

> [!CAUTION]
> Never commit `.env` or files containing `SUPABASE_SERVICE_ROLE_KEY` or `SMTP_PASS` into version control. Ensure `.gitignore` ignores all `.env*` files except `.env.example`.

---

## 3. Database Schema & Migration Management

### Migration Scripts:
- `db/schema.sql`: Core PostgreSQL schema, role types, indexes, and initial constraints.
- `db/migrations/001_core_schema.sql`: Initial table setups and RLS policies.
- `db/migrations/002_add_attachments_columns.sql`: Attachments array columns, URL references, and evidence storage support.

### Running Migrations in Production:
Migrations can be executed directly through the **Supabase Dashboard SQL Editor** or via Supabase CLI:
```bash
supabase db push
```

### Table Whitelist Integrity:
The application utilizes a strict schema adapter (`server/schemaAdapter.ts`). Any custom column added by Super Admins via the **Customize Table** modal is dynamically stored in the row's `data` JSONB column while preserving typed reporting columns.

---

## 4. Backups & Disaster Recovery (DR)

### Recovery Point Objective (RPO) & Recovery Time Objective (RTO)
- **RPO (Maximum Acceptable Data Loss)**: ≤ 1 hour
- **RTO (Maximum Acceptable Downtime)**: ≤ 2 hours

### Backup Strategy:
1. **Automated Supabase Backups**:
   - Continuous Point-in-Time Recovery (PITR) enabled on Supabase Pro/Team tier (allows 1-second granularity restore up to 7 days).
   - Daily automated database snapshots retained for 30 days.
2. **Weekly Cold Archive (Self-Service)**:
   - Super Admins can download a full cryptographic JSON snapshot of all modules via **Settings > Database Backup & Export**.
   - Store cold backups in encrypted enterprise OneDrive/SharePoint storage.

### Disaster Recovery Restoration Protocol:
1. If database corruption or accidental truncation occurs:
   - Navigate to **Supabase Dashboard > Settings > Database Backups**.
   - Select the restore point (timestamp prior to incident).
   - Click **Restore to this point**.
2. Verify integrity by running:
   ```bash
   npm run test:unit
   ```
3. Check the `/api/health` endpoint to ensure Express server reconnected successfully.

---

## 5. Security & SSL Enforcement

1. **HTTPS / TLS 1.3**:
   - Enforce HTTPS across all traffic. Any HTTP request must return `301 Moved Permanently` to `https://`.
2. **Security Headers**:
   - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`
   - `X-Content-Type-Options`: `nosniff`
   - `X-Frame-Options`: `SAMEORIGIN`
   - `Referrer-Policy`: `strict-origin-when-cross-origin`
3. **CORS Policy**:
   - Backend Express API strictly rejects origins other than the registered company frontend domains.

---

## 6. Health Checks & Uptime Monitoring

The Express server exposes an automated health probe:
- **URL**: `https://<domain>/api/health`
- **Method**: `GET`
- **Success Response**: `200 OK`
```json
{
  "status": "healthy",
  "database": "connected",
  "uptimeSeconds": 86400,
  "timestamp": "2026-09-12T18:00:00.000Z"
}
```

Configure external monitoring (e.g. UptimeRobot, Pingdom, or AWS Route 53 Health Check) to probe `/api/health` every **60 seconds**.
