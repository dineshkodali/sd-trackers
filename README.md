# SD Operations Platform

Safeguarding and accommodation-compliance management for people placed in contracted hotel accommodation.
A React single-page app with an optional Express API, backed by PostgreSQL on Supabase.

## Repository layout

| Path | Contents |
|---|---|
| `src/` | React frontend: `components/` (grouped by module), `context/` (app state, RBAC), `services/`, `hooks/`, `utils/` (pure business rules), `config/`, `types/` |
| `server/` | Express API: routes, auth middleware, schema adapter, mailer |
| `db/` | `schema.sql` (idempotent full schema, RLS, triggers) and numbered `migrations/` |
| `tests/` | Unit tests (`npm run test:unit`) |
| `scripts/` | Database, QA and maintenance utilities |
| `docs/` | Architecture, hosting, design system and audit documents ([index](docs/README.md)) |
| `deploy/` | Reverse-proxy and deployment examples |
| `public/` | Static assets and report templates |
| `status/` | Static status portal served at `/status` |
| `amplify.yml` | AWS Amplify build specification |

## Getting started

Requires Node.js 20+ and a Supabase project.

```bash
npm install
cp .env.example .env     # fill in the Supabase URL and keys; SMTP is optional
npm run dev              # app and API on http://localhost:3020
```

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (API and Vite on one origin) |
| `npm run build` | Production build: frontend to `dist/`, API to `dist/server.cjs` |
| `npm start` | Run the production build |
| `npm run lint` | Type-check |
| `npm run test:unit` | Unit tests |
| `npm run db:migrate` | Apply outstanding database migrations |

More detail: [docs/PROJECT_README.md](docs/PROJECT_README.md), [docs/AMPLIFY_HOSTING.md](docs/AMPLIFY_HOSTING.md), [docs/live-database.md](docs/live-database.md).

## Audit and design documents

- [Overdue management and email notifications: audit and plan](docs/SDTRACKER_OVERDUE_AND_NOTIFICATION_AUDIT.md)
- [Central Operations Dashboard: audit and design](docs/SDTRACKER_CENTRAL_DASHBOARD_AUDIT_AND_DESIGN.md)
