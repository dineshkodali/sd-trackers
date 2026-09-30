# SD Operations Platform

Safeguarding and accommodation-compliance management for vulnerable people
placed in contracted hotel accommodation. React frontend and Express API served
from a single origin, backed by PostgreSQL on Supabase.

## Project structure

```
.
├── src/                      React frontend
│   ├── components/           Views, grouped by module
│   ├── context/              AppContext — state, RBAC, CRUD
│   ├── services/             API client
│   ├── utils/                Export, cache, validation schemas
│   ├── data/                 Seed data and field options
│   ├── lib/                  Browser Supabase client
│   └── types/                Shared TypeScript models
│
├── server/                   Express API
│   ├── index.ts              Entry point — mounts routers, hosts Vite
│   ├── routes/               config · auth · db · smtp
│   ├── supabase.ts           Server Supabase clients
│   ├── schemaAdapter.ts      App model ↔ database column mapping
│   ├── migrate.ts            Schema bootstrap
│   ├── mailer.ts             SMTP transport
│   └── urlHelper.ts          Dynamic origin resolution
│
├── db/                       Database schemas & migrations
│   ├── schema.sql            Full schema, RLS policies, triggers
│   └── migrations/           Incremental migrations
│
├── deploy/                   Deployment configurations (Nginx, Docker)
├── docs/                     System architecture, design tokens, UI guide, operations manual
├── public/                   Static web assets & report templates
├── scripts/                  Database, sync, and reporting utility scripts
├── status/                   Real-time operations & system telemetry status portal
├── tests/                    Focused unit, adapter, and migration test suite
│
├── amplify.yml               AWS Amplify CI/CD hosting pipeline
├── Dockerfile                Multi-stage production container build
├── docker-compose.yml        Local and VPS orchestration
├── index.html                Vite SPA entry point
├── vite.config.ts            Frontend build config
├── tsconfig.json             TypeScript config
└── package.json
```

## Prerequisites

Node.js 20+, and a Supabase project.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your Supabase URL and keys. SMTP
   credentials are optional — the app degrades gracefully without them.
3. Apply `db/schema.sql` in the Supabase SQL editor (the server also attempts
   this on boot when a direct PostgreSQL connection string is available).

## Running

```bash
npm run dev      # dev server + API on http://localhost:3020
npm run build    # frontend to dist/, API bundled to dist/server.cjs
npm start        # run the production build
npm run lint     # type-check
npm run clean    # remove dist/
```

The API and the single-page app share one origin — in development Vite runs as
Express middleware, so there is no separate frontend port.

Useful environment flags:

| Flag | Effect |
|---|---|
| `PORT` | Port to bind (default 3020; auto-increments if taken) |
| `OPEN_BROWSER=false` | Do not open a browser on start |
| `DISABLE_HMR=true` | Disable Vite file watching |

## Testing

Unit and integration test suites live in **[`tests/`](file:///d:/SD%20Commercial/APPS/sdtracker/tests)**, and end-to-end procedural test runners live in **[`.testing/`](file:///d:/SD%20Commercial/APPS/sdtracker/.testing)**.

Run all tests in one command:
```bash
npm run test:all
```

Or run individual suites:
```bash
npm run test:unit         # Schema adapters, report generator & persistence tests
npm run test:uat          # End-to-end User Acceptance Testing
npm run test:auth         # Authentication & RBAC permissions testing
npm run test:api          # Core Express API endpoints
npm run test:db           # Supabase live database operations
npm run test:security     # Security checks & vulnerability scans
npm run db:coverage       # PostgreSQL 29-table & 31-page coverage
npm run test:qa:report    # Compile dated QA system diagnostics
```
