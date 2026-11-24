# Infraestructura del backend — Configuración del VPS

## Estructura de directorios en el VPS

```
/opt/marketpaq/prod/backend/
├── docker-compose.yml      ← sincronizado desde infra/backend/ (este archivo)
├── README.md               ← sincronizado desde infra/backend/ (este archivo)
├── .env                    ← creado manualmente en el VPS; NUNCA se sube a git
└── backend/                ← sincronizado desde backend/ del repositorio
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    └── src/
```

## Redes

| Red | Tipo | Propósito |
| --- | --- | --- |
| `web` | externa | Red compartida de Traefik (debe existir ya en el servidor) |
| `backend_net` | interna | Comunicación entre Postgres y el backend; sin acceso externo |

## Preparación inicial (primer despliegue)

Conéctate por SSH al VPS y ejecuta:

```bash
# 1. Crear el directorio de despliegue
mkdir -p /opt/marketpaq/prod/backend

# 2. Crear el archivo .env (consulta la referencia de variables más abajo)
nano /opt/marketpaq/prod/backend/.env

# 3. Verificar que la red externa de Docker existe
docker network ls | grep web
# Si no existe: docker network create web
```

Cuando termine la primera ejecución de CI, verifica el stack:

```bash
cd /opt/marketpaq/prod/backend
docker compose ps
docker compose logs backend --tail 50
```

## Referencia de variables de .env

El archivo `.env` debe existir en `/opt/marketpaq/prod/backend/.env`.
Lo carga `env_file: .env` en el archivo compose y también se usa para la
sustitución de variables de compose (las referencias `${VAR}` de
docker-compose.yml).

```dotenv
# ── Postgres ──────────────────────────────────────────────────────────────────
POSTGRES_USER=marketpaq
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=marketpaq

# ── Backend ───────────────────────────────────────────────────────────────────
# Usa el nombre del servicio postgres, no localhost
DATABASE_URL="postgresql://marketpaq:<strong-random-password>@postgres:5432/marketpaq"

PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# Registro: trace | debug | info | warn | error | fatal | silent
LOG_LEVEL=info

# Orígenes CORS permitidos (separados por espacios)
CORS_ORIGIN=https://marketpaq.com

# ── Autenticación ─────────────────────────────────────────────────────────────
# Secreto usado para firmar/verificar los tokens JWT. Debe ser una cadena aleatoria larga.
AUTH_SECRET=<long-random-secret>

# Correos con acceso de administrador, separados por comas. Sin administradores si no se define.
ADMIN_EMAILS=<admin-email>

# URL base pública de este despliegue — usada en los enlaces y el logotipo de los correos.
MARKETPAQ_PUBLIC_URL=https://marketpaq.com

# ── Correo (opcional) ─────────────────────────────────────────────────────────
# Configuración SMTP para el correo transaccional (restablecimiento de contraseña, bienvenida, etc.).
# Déjalo vacío para desactivar el envío de correo.
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@marketpaq.com
```

> El archivo `backend/.env.example` del repositorio replica las mismas
> variables con valores de marcador para el desarrollo local.

## Enrutamiento con Traefik

### Cómo funciona la prioridad (y por qué importa)

Traefik v2 resuelve los conflictos entre routers que atienden la misma
petición mediante la **prioridad**. Cuando no se define una prioridad explícita,
Traefik usa la **longitud en caracteres de la regla** como prioridad
predeterminada (más larga = más específica = gana).

Los dos routers compiten por `marketpaq.com`:

| Router | Regla | Prioridad predeterminada (longitud de la regla) | Prioridad explícita |
|--------|------|-------------------------------|-------------------|
| frontend | `Host("marketpaq.com")` | ~20 | ninguna |
| backend | `Host("marketpaq.com") && PathPrefix("/api")` | ~47 | **10000** |

Sin una prioridad explícita en el backend, las prioridades predeterminadas
basadas en la longitud de la regla funcionarían bien (47 > 20). Sin embargo,
**cualquier prioridad explícita anula por completo la predeterminada**.
Definimos `priority=10000` en el backend para que:

1. Gane al router del frontend sin importar qué prioridad explícita pueda
   llegar a tener el frontend en el futuro.
2. La intención sea inequívoca — quien lea las etiquetas ve de inmediato que
   «esto debe tener precedencia».
3. Quede espacio (1–9999) para futuros routers de solo middleware con menor
   prioridad, si fuera necesario.

> **Historial**: la etiqueta original usaba `priority=10`. Como 10 < 20 (la
> prioridad efectiva del frontend por longitud de regla), Traefik enrutaba
> `/api/*` al nginx del frontend, que devolvía el `index.html` de la SPA — lo que
> provocaba respuestas `404`/HTML en todas las llamadas a la API.

### Etiquetas obligatorias en el contenedor del backend

```
traefik.enable=true
traefik.docker.network=web
traefik.http.routers.marketpaq-backend.rule=Host(`marketpaq.com`) && PathPrefix(`/api`)
traefik.http.routers.marketpaq-backend.priority=10000
traefik.http.routers.marketpaq-backend.entrypoints=websecure
traefik.http.routers.marketpaq-backend.tls.certresolver=letsencrypt
traefik.http.services.marketpaq-backend.loadbalancer.server.port=3000
```

`traefik.docker.network=web` es obligatoria porque el contenedor del backend está
conectado a **dos** redes (`web` + `backend_net`). Sin esta etiqueta, Traefik
puede elegir la IP de la red equivocada y no lograr redirigir las peticiones.

> Si tu instancia de Traefik usa un nombre de entrypoint o un resolutor de
> certificados distinto, actualiza las etiquetas
> `traefik.http.routers.marketpaq-backend.*` en `docker-compose.yml` antes del
> primer despliegue.

### Pruebas de humo

```bash
# Debe devolver HTTP 200 con Content-Type: application/json
curl -i https://marketpaq.com/api/health
curl -i https://marketpaq.com/api/v1/config

# Debe devolver HTTP 200 con Content-Type: text/html (SPA)
curl -i https://marketpaq.com/
```

O ejecuta el script de comprobación automatizado desde la raíz del repositorio:

```bash
bash scripts/check-routing.sh
# opcionalmente, indicar otra URL base:
bash scripts/check-routing.sh https://pr-9.marketpaq.com
```

### Solución de problemas: check-routing.sh devuelve `text/plain` en todos los endpoints

Esto es un falso negativo, no un fallo real de enrutamiento. Causas y
soluciones:

- **HEAD frente a GET**: el script antiguo usaba `curl -I` (HEAD). Algunos
  servidores devuelven `Content-Type: text/plain` en las peticiones HEAD. El
  script actual usa GET (`-o /dev/null -D -`), que es fiable.
- **Enrutamiento IPv6**: en un VPS con doble pila, una shell SSH no interactiva
  puede resolver `marketpaq.com` a la dirección IPv6 del propio servidor y
  alcanzar un listener diferente. El script actual fuerza IPv4 con `-4`.
- **Script obsoleto en el VPS**: si el paso «Upload scripts» de CI se ejecutó
  antes de esta corrección, el script antiguo puede seguir en el VPS. Vuelve a
  desplegar o copia la versión nueva manualmente:
  ```bash
  scp scripts/check-routing.sh user@vps:/opt/marketpaq/prod/backend/scripts/
  ssh user@vps "chmod +x /opt/marketpaq/prod/backend/scripts/check-routing.sh"
  ```

### Solución de problemas: /api vuelve a devolver HTML

Revisa esta lista en orden:

1. **Comprueba que el contenedor del backend está en ejecución**
   ```bash
   cd /opt/marketpaq/prod/backend && docker compose ps
   ```
   Si el backend está en `Exited`, revisa el registro: `docker compose logs backend --tail 50`

2. **Verifica que la etiqueta de prioridad está correcta**
   ```bash
   docker inspect prod-backend-backend-1 \
     --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}' \
     | grep priority
   ```
   Se espera: `traefik.http.routers.marketpaq-backend.priority=10000`

3. **Inspecciona la tabla de routers activa de Traefik** (si el panel está habilitado)
   ```bash
   curl -s http://localhost:8080/api/http/routers | python3 -m json.tool \
     | grep -A5 'marketpaq'
   ```
   Confirma que `marketpaq-backend` tiene la prioridad 10000 y el estado `enabled`.

4. **Comprueba qué red de Docker está usando Traefik**
   ```bash
   docker inspect prod-backend-backend-1 \
     --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
   ```
   Deben aparecer `web` y `backend_net`. Si falta `web`, el contenedor no se
   unió a la red externa — revisa `docker-compose.yml` y reinicia con
   `docker compose up -d backend`.

5. **Fuerza a Traefik a releer las etiquetas del contenedor** (sin reiniciar)
   ```bash
   # Traefik vigila el socket de Docker; las etiquetas se toman en cuenta
   # solo al reiniciar el contenedor. Recrea el contenedor del backend:
   docker compose up -d --force-recreate backend
   ```

6. **Confirma que no hay una configuración estática de Traefik que entra en conflicto**
   Busca en `/opt/marketpaq/traefik/` o `/etc/traefik/` cualquier definición de
   routers basada en archivos que pueda anular las etiquetas del proveedor de
   Docker.

## Despliegue con CI (automatizado)

Cada push a `main` activa el flujo de trabajo de GitHub Actions, que:

1. Sincroniza `infra/backend/` → `/opt/marketpaq/prod/backend/` (archivo compose; `.env` se excluye del borrado)
2. Sincroniza `backend/` → `/opt/marketpaq/prod/backend/backend/` (código de la aplicación)
3. Entra por SSH y ejecuta:
   ```bash
   docker compose up -d postgres
   docker compose build backend
   # espera a que pg_isready responda
   docker compose run --rm backend npx prisma migrate deploy
   docker compose up -d backend
   ```

## Redespiegue manual

```bash
cd /opt/marketpaq/prod/backend
docker compose build backend
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d backend
```

## Registros y solución de problemas

```bash
# Seguir el registro del backend
docker compose logs -f backend

# Seguir el registro de postgres
docker compose logs -f postgres
```
