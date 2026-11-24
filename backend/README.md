# Backend de MarketPAQ

Servidor de API con Fastify + Prisma. Escucha en el puerto 3000 y se publica
externamente bajo `/api` a través de Traefik.

## Desarrollo local

```bash
cp .env.example .env   # ajusta DATABASE_URL para apuntar a un Postgres local
npm install
npm run dev            # tsx watch — se reinicia al cambiar los archivos
```

## Pruebas de humo

```bash
# Comprobación de disponibilidad
curl http://127.0.0.1:3000/api/health

# Endpoint de configuración (dentro del contenedor: docker compose exec backend sh)
curl http://127.0.0.1:3000/api/v1/config
```

Respuesta esperada de `/api/v1/config`:
```json
{
  "status": "ok",
  "service": "marketpaq-backend",
  "version": "0.1.0",
  "environment": "production",
  "time": "2026-01-01T00:00:00.000Z"
}
```

## Compilación

```bash
npm run build      # tsc → dist/
npm run typecheck  # verificación de tipos sin emitir archivos
```
