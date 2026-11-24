# Backend Infrastructure — VPS Setup

## Directory layout on the VPS

```
/opt/marketpaq/prod/backend/
├── docker-compose.yml      ← rsynced from infra/backend/ (this file)
├── README.md               ← rsynced from infra/backend/ (this file)
├── .env                    ← created manually on the VPS; NEVER committed to git
└── backend/                ← rsynced from backend/ in repo
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    └── src/
```

## Networks

| Network | Type | Purpose |
|---------|------|---------|
| `web` | external | Shared Traefik network (must already exist on the host) |
| `backend_net` | internal | Postgres ↔ backend communication; no external access |

## One-time bootstrap (first deploy)

SSH into the VPS and run:

```bash
# 1. Create the deploy directory
mkdir -p /opt/marketpaq/prod/backend

# 2. Create the .env file (see variable reference below)
nano /opt/marketpaq/prod/backend/.env

# 3. Verify the external Docker network exists
docker network ls | grep web
# If missing: docker network create web
```

After the first CI run completes, verify the stack:

```bash
cd /opt/marketpaq/prod/backend
docker compose ps
docker compose logs backend --tail 50
```

## .env variable reference

The `.env` file must exist at `/opt/marketpaq/prod/backend/.env`.
It is loaded by `env_file: .env` in the compose file and is also used for
compose variable substitution (the `${VAR}` references in docker-compose.yml).

```dotenv
# ── Postgres ──────────────────────────────────────────────────────────────────
POSTGRES_USER=marketpaq
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=marketpaq

# ── Backend ───────────────────────────────────────────────────────────────────
# Use the postgres service name, not localhost
DATABASE_URL="postgresql://marketpaq:<strong-random-password>@postgres:5432/marketpaq"

PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Logging: trace | debug | info | warn | error | fatal | silent
LOG_LEVEL=info

# Allowed CORS origins (space-separated)
CORS_ORIGIN=https://marketpaq.com

# ── Auth ──────────────────────────────────────────────────────────────────────
# Secret used to sign/verify JWT tokens. Must be a long random string.
AUTH_SECRET=<long-random-secret>

# Comma-separated emails with admin access. No admins when unset.
ADMIN_EMAILS=<admin-email>

# Public base URL of this deployment — used for links and the logo in emails.
MARKETPAQ_PUBLIC_URL=https://marketpaq.com

# ── Email (optional) ──────────────────────────────────────────────────────────
# SMTP settings for transactional email (password reset, welcome, etc.).
# Leave blank to disable email sending.
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@marketpaq.com
```

> The `backend/.env.example` in the repo mirrors the same variables with
> placeholder values for local development.

## Traefik routing

### How priority works (and why it matters)

Traefik v2 resolves conflicts between routers that match the same request by
**priority**. When no explicit priority is set, Traefik uses the **rule's
character length** as the default priority (longer = more specific = wins).

The two routers competing for `marketpaq.com`:

| Router | Rule | Default priority (rule length) | Explicit priority |
|--------|------|-------------------------------|-------------------|
| frontend | `Host("marketpaq.com")` | ~20 | none |
| backend | `Host("marketpaq.com") && PathPrefix("/api")` | ~47 | **10000** |

Without an explicit priority on the backend, the default rule-length priorities
would actually work correctly (47 > 20). However, **any explicit priority
overrides the default completely**. We set `priority=10000` on the backend
so that:

1. It wins over the frontend router regardless of what explicit priority the
   frontend may ever gain.
2. The intent is unambiguous — a human reading the labels immediately sees
   "this is meant to take precedence."
3. It leaves room (1–9999) for any future middleware-only routers with lower
   priority if needed.

> **History**: the original label used `priority=10`. Because 10 < 20 (the
> frontend's effective rule-length priority), Traefik routed `/api/*` to the
> frontend nginx, which returned the SPA's `index.html` — causing `404`/HTML
> responses for all API calls.

### Required labels on the backend container

```
traefik.enable=true
traefik.docker.network=web
traefik.http.routers.marketpaq-backend.rule=Host(`marketpaq.com`) && PathPrefix(`/api`)
traefik.http.routers.marketpaq-backend.priority=10000
traefik.http.routers.marketpaq-backend.entrypoints=websecure
traefik.http.routers.marketpaq-backend.tls.certresolver=letsencrypt
traefik.http.services.marketpaq-backend.loadbalancer.server.port=3000
```

`traefik.docker.network=web` is required because the backend container is
attached to **two** networks (`web` + `backend_net`). Without this label,
Traefik may pick the wrong network IP and fail to proxy requests.

> If your Traefik instance uses a different entrypoint name or cert resolver,
> update the `traefik.http.routers.marketpaq-backend.*` labels in
> `docker-compose.yml` before the first deploy.

### Smoke tests

```bash
# Must return HTTP 200 with Content-Type: application/json
curl -i https://marketpaq.com/api/health
curl -i https://marketpaq.com/api/v1/config

# Must return HTTP 200 with Content-Type: text/html (SPA)
curl -i https://marketpaq.com/
```

Or run the automated check script from the repo root:

```bash
bash scripts/check-routing.sh
# optionally pass a different base URL:
bash scripts/check-routing.sh https://pr-9.marketpaq.com
```

### Troubleshooting: check-routing.sh returns `text/plain` for all endpoints

This is a false negative, not a real routing failure. Causes and fixes:

- **HEAD vs GET**: the old script used `curl -I` (HEAD). Some servers return
  `Content-Type: text/plain` for HEAD requests. The current script uses GET
  (`-o /dev/null -D -`) which is reliable.
- **IPv6 routing**: on a dual-stack VPS, a non-interactive SSH shell may
  resolve `marketpaq.com` to the server's own IPv6 address and hit a different
  listener. The current script forces IPv4 with `-4`.
- **Stale script on VPS**: if the CI "Upload scripts" step ran before this fix,
  the old script may still be on the VPS. Re-deploy or copy the new version
  manually:
  ```bash
  scp scripts/check-routing.sh user@vps:/opt/marketpaq/prod/backend/scripts/
  ssh user@vps "chmod +x /opt/marketpaq/prod/backend/scripts/check-routing.sh"
  ```

### Troubleshooting: /api returns HTML again

Work through this checklist in order:

1. **Check the backend container is running**
   ```bash
   cd /opt/marketpaq/prod/backend && docker compose ps
   ```
   If the backend is `Exited`, check logs: `docker compose logs backend --tail 50`

2. **Verify the priority label is set correctly**
   ```bash
   docker inspect prod-backend-backend-1 \
     --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' \
     | grep priority
   ```
   Expected: `traefik.http.routers.marketpaq-backend.priority=10000`

3. **Inspect the live Traefik router table** (if dashboard is enabled)
   ```bash
   curl -s http://localhost:8080/api/http/routers | python3 -m json.tool \
     | grep -A5 'marketpaq'
   ```
   Confirm `marketpaq-backend` has priority 10000 and status `enabled`.

4. **Check which Docker network Traefik is using**
   ```bash
   docker inspect prod-backend-backend-1 \
     --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
   ```
   Both `web` and `backend_net` should appear. If `web` is missing, the
   container was not joined to the external network — re-check
   `docker-compose.yml` and restart with `docker compose up -d backend`.

5. **Force Traefik to re-read the container labels** (no restart needed)
   ```bash
   # Traefik watches the Docker socket; labels are picked up on container
   # restart only. Recreate the backend container:
   docker compose up -d --force-recreate backend
   ```

6. **Confirm there is no conflicting static Traefik config**
   Look for `/opt/marketpaq/traefik/` or `/etc/traefik/` for any file-based
   router definitions that might override the Docker provider labels.

## CI deploy (automated)

Every push to `main` triggers the GitHub Actions workflow which:

1. Rsyncs `infra/backend/` → `/opt/marketpaq/prod/backend/` (compose file; `.env` is excluded from deletion)
2. Rsyncs `backend/` → `/opt/marketpaq/prod/backend/backend/` (app source)
3. SSHs in and runs:
   ```bash
   docker compose up -d postgres
   docker compose build backend
   # waits for pg_isready
   docker compose run --rm backend npx prisma migrate deploy
   docker compose up -d backend
   ```

## Manual re-deploy

```bash
cd /opt/marketpaq/prod/backend
docker compose build backend
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d backend
```

## Logs & troubleshooting

```bash
# Tail backend logs
docker compose logs -f backend

# Tail postgres logs
docker compose logs -f postgres
```
