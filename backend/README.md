# Marketpaq Backend

Fastify + Prisma API server. Runs on port 3000, served externally under `/api` via Traefik.

## Local dev

```bash
cp .env.example .env   # adjust DATABASE_URL to point at a local Postgres
npm install
npm run dev            # tsx watch — restarts on file changes
```

## Smoke tests

```bash
# Health check
curl http://127.0.0.1:3000/api/health

# Config endpoint (inside container: docker compose exec backend sh)
curl http://127.0.0.1:3000/api/v1/config
```

Expected response for `/api/v1/config`:
```json
{
  "status": "ok",
  "service": "marketpaq-backend",
  "version": "0.1.0",
  "environment": "production",
  "time": "2026-01-01T00:00:00.000Z"
}
```

## Build

```bash
npm run build      # tsc → dist/
npm run typecheck  # type-check without emitting
```
