# MarketPAQ

MarketPAQ is a marketplace of add-ons for CONTPAQi and SoftRestaurant. Developers
publish their add-ons and a public developer profile; partners (distributors) and
partner leaders browse the catalog, contact developers, rate add-ons and vote on
feature requests. Admins review add-ons and manage users from a built-in panel.

## Stack

- **Frontend** (`src/`): React 18 SPA built with Vite, Tailwind CSS, Radix UI,
  React Router and TanStack Query.
- **Backend** (`backend/`): Fastify 5 + Prisma 6 on PostgreSQL, JWT auth,
  Nodemailer for transactional email and a small background job runner.
- **Infra** (`infra/backend/`): Docker Compose for Postgres + backend behind Traefik.

## Repository layout

```text
src/                 React app (pages in src/pages, routes in src/pages.config.js)
src/api/client.js    HTTP client for the backend API
backend/src/         Fastify server (routes, jobs, email)
backend/prisma/      Prisma schema, migrations and the local seed
docker-compose.dev.yml  Development stack (Postgres + optional backend container)
infra/backend/       Production docker-compose and deployment notes
scripts/             Deployment helper scripts
```

## Running locally

Requirements: Node.js 20+, npm and a PostgreSQL 16 database (Docker works fine).

See [Local development](#local-development) for the full, copy‑paste setup —
including the demo data.

### 1. Database

```bash
docker run -d --name marketpaq-db -p 5432:5432 \
  -e POSTGRES_USER=marketpaq -e POSTGRES_PASSWORD=password -e POSTGRES_DB=marketpaq \
  postgres:16-alpine
```

### 2. Backend (port 3000)

```bash
cd backend
cp .env.example .env          # set DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS, SMTP...
npm ci
npx prisma migrate deploy     # create the schema
npm run dev                   # tsx watch
```

Check it with `curl http://localhost:3000/api/health`.

### 3. Frontend (port 5173)

```bash
cp .env.example .env.local    # optional: VITE_ADMIN_EMAILS, VITE_CONTACT_WHATSAPP
npm ci
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3000` (override with
`API_PROXY_TARGET`).

---

## Local development

This section is the complete setup for a fresh clone. Nothing here needs
production data, real credentials or an SMTP account — the demo data is
generated locally and every password is a throw‑away value.

### 0. Requirements

- Node.js 20 or newer
- npm 10 or newer
- Docker (only for the database — the Docker daemon must be running)

### 1. Start the database

`docker-compose.dev.yml` is the **development** compose file (dev‑only
credentials, no Traefik, no external networks, no `/opt` paths). The
production compose lives in `infra/backend/docker-compose.yml` and is not
used here.

```bash
docker compose -f docker-compose.dev.yml up -d
```

It creates a PostgreSQL 16 container with the throw‑away development
credentials `marketpaq` / `marketpaq`, listening on `127.0.0.1:5432` only.

Check it:

```bash
docker compose -f docker-compose.dev.yml ps
```

> Prefer to run the backend in a container as well? Use the optional profile:
> `docker compose -f docker-compose.dev.yml --profile backend up -d`
> (it applies the migrations and starts the backend with hot reload on
> `http://localhost:3000`).

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

`backend/.env.example` already contains safe development defaults
(`DATABASE_URL`, `PORT=3000`, `AUTH_SECRET`, `ADMIN_EMAILS=admin@example.com`,
`MAIL_MODE=log`, …) — nothing has to be changed for local work.

- `MAIL_MODE=log` prints emails to the backend log instead of sending them, so
  no SMTP account is needed. With `MAIL_MODE=smtp` (the default) and no SMTP
  credentials, emails are not sent and the backend logs `SMTP_NOT_CONFIGURED`.
- `ADMIN_EMAILS` is the admin allowlist of the backend. Use
  `admin@example.com` — the admin created by the seed.

### 3. Install, migrate and seed the backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy     # create the schema
npm run db:seed                # fake demo data (safe to run again)
npm run dev                    # tsx watch → http://localhost:3000
```

Check it:

```bash
curl http://localhost:3000/api/health
```

### 4. Run the frontend

```bash
npm ci
npm run dev                    # → http://localhost:5173
```

The Vite dev server proxies every `/api` request to `http://localhost:3000`
(override with `API_PROXY_TARGET`), so the SPA talks to your local backend
without any extra configuration.

### 5. Demo accounts

`npm run db:seed` creates fake data only: 1 admin, 2 developers, 2 partners,
6 add‑ons (CONTPAQi and SoftRestaurant), 3 feature requests with votes and a
few ratings.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `LocalDev123!` |
| Developer | `dev1@example.com` | `LocalDev123!` |
| Developer | `dev2@example.com` | `LocalDev123!` |
| Partner | `partner1@example.com` | `LocalDev123!` |
| Partner | `partner2@example.com` | `LocalDev123!` |

The admin account is the one to put in the admin allowlists:

```dotenv
# backend/.env
ADMIN_EMAILS=admin@example.com
```

```dotenv
# .env.local (frontend)
VITE_ADMIN_EMAILS=admin@example.com
```

The backend enforces access (`ADMIN_EMAILS`); the frontend only uses
`VITE_ADMIN_EMAILS` to show the admin navigation, so both must be set.

The seed is idempotent — running `npm run db:seed` again updates the same
rows instead of duplicating them.

### 6. Useful commands

```bash
npm run dev:db          # start the dev database (docker compose)
npm run dev:db:down    # stop it (keeps the data)
npm run dev:db:reset   # stop it and wipe the database volume
npm run dev:seed       # re-run the seed
npm run dev:backend    # run the backend from the repo root
```

### Troubleshooting

- `Can't reach database server at localhost:5432` → the container is not
  running: `docker compose -f docker-compose.dev.yml up -d`.
- `Environment variable not found: DATABASE_URL` → `backend/.env` is missing;
  run `cp .env.example .env` inside `backend/`.
- The admin panel is not visible → `VITE_ADMIN_EMAILS` is not set in
  `.env.local` (restart Vite afterwards, the value is read at start‑up).

## Environment variables

Backend (`backend/.env`, see `backend/.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Secret used to sign JWTs |
| `ADMIN_EMAILS` | Comma-separated emails with admin access (none when unset) |
| `CORS_ORIGIN` | Allowed browser origin |
| `FRONTEND_BASE_URL` | Base URL used in password-reset links |
| `MARKETPAQ_PUBLIC_URL` | Public URL used for links and the logo in emails |
| `MAIL_MODE` | `smtp` (default) sends email, `log` only writes it to the server log |
| `ZOHO_SMTP_*` | SMTP settings for transactional email |
| `UPLOAD_DIR` | Where uploaded images are stored (default `backend/uploads`) |
| `DEV_BYPASS` | `1` skips the JWT check on `/entities/User/me` (non-production only) |
| `PORT` / `HOST` | Interface and port the backend listens on (default `0.0.0.0:3000`) |
| `LOG_LEVEL` | Log verbosity: trace, debug, info, warn, error, fatal, silent |
| `NODE_ENV` | `development` or `production` |

Frontend (`.env.local`, see `.env.example`; `VITE_*` values are embedded at build time):

| Variable | Purpose |
| --- | --- |
| `VITE_ADMIN_EMAILS` | Shows admin navigation for these emails (keep in sync with `ADMIN_EMAILS`) |
| `VITE_CONTACT_WHATSAPP` | Public WhatsApp contact number; contact links are hidden when empty |
| `API_PROXY_TARGET` | Dev server only: backend URL for the `/api` proxy |

## API overview

| Path | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/v1/config` | Service name, version and environment |
| `/api/v1/auth/*` | Register, login, password reset, email verification |
| `/api/v1/entities/{Addons,DeveloperProfiles,User}` | List/filter (`q`, `sort`, `limit`, `skip`), get, create, update, delete |
| `GET/PUT /api/v1/entities/User/me` | Current user |
| `POST /api/v1/functions/<name>` | RPC-style operations (stats, ratings, admin tools...) |
| `POST /api/v1/uploads/*` | Avatar, developer logo and add-on images |
| `/api/feature-requests` | Feature requests and votes |
| `GET /api/uploads/*` | Uploaded files |

Authenticated requests send `Authorization: Bearer <token>`.

## Scripts

```bash
npm run build        # production build of the frontend (dist/)
npm run lint         # ESLint
npm run dev:db       # start the dev Postgres (docker compose)
npm run dev:seed     # load the fake demo data
cd backend && npm run build      # compile the backend (dist/)
cd backend && npm run typecheck  # type-check the backend and the seed
cd backend && npm run db:seed   # load the fake demo data
```
