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

Audit reports, the full application map (PDF, registers, diagrams, wireframes) and the root-cleanup report are kept in the local-only, git-ignored `application-map/` folder (see `application-map/README.md`). Design standards and plans remain in [docs/](docs/README.md); the iOS design pack is in `design/ios/`.
