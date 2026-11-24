<p align="center">
  <img src="public/marketpaq-logo.png" alt="MarketPAQ" width="360">
</p>

<p align="center">
  <strong>Marketplace de add-ons, scripts e integraciones para CONTPAQi y SoftRestaurant</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licencia-AGPL--3.0-blue.svg" alt="Licencia AGPL-3.0"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs_bienvenidos-brightgreen.svg" alt="PRs bienvenidos"></a>
</p>

# MarketPAQ

MarketPAQ es un marketplace de add-ons para CONTPAQi y SoftRestaurant. Los
desarrolladores publican sus add-ons y un perfil público de desarrollador; los
socios (distribuidores) y los líderes de socios exploran el catálogo, contactan
a los desarrolladores, califican los add-ons y votan las solicitudes de
funcionalidad. Los administradores revisan los add-ons y gestionan a las
personas usuarias desde un panel integrado.

## Stack

- **Frontend** (`src/`): SPA en React 18 construida con Vite, Tailwind CSS,
  Radix UI, React Router y TanStack Query.
- **Backend** (`backend/`): Fastify 5 + Prisma 6 sobre PostgreSQL,
  autenticación con JWT, Nodemailer para el correo transaccional y un pequeño
  ejecutor de trabajos en segundo plano.
- **Infraestructura** (`infra/backend/`): Docker Compose para Postgres + backend
  detrás de Traefik.

## Estructura del repositorio

```text
src/                 App React (páginas en src/pages, rutas en src/pages.config.js)
src/api/client.js    Cliente HTTP para la API del backend
backend/src/         Servidor Fastify (rutas, trabajos, correo)
backend/prisma/      Esquema Prisma, migraciones y el seed local
docker-compose.dev.yml  Stack de desarrollo (Postgres + contenedor opcional del backend)
infra/backend/       docker-compose de producción y notas de despliegue
scripts/             Scripts auxiliares de despliegue
```

## Ejecución local

Requisitos: Node.js 20+, npm y una base de datos PostgreSQL 16 (Docker funciona
sin problema).

Consulta la sección [Desarrollo local](#desarrollo-local) para la configuración
completa, lista para copiar y pegar — incluidos los datos de demostración.

### 1. Base de datos

```bash
docker run -d --name marketpaq-db -p 5432:5432 \
  -e POSTGRES_USER=marketpaq -e POSTGRES_PASSWORD=password -e POSTGRES_DB=marketpaq \
  postgres:16-alpine
```

### 2. Backend (puerto 3000)

```bash
cd backend
cp .env.example .env          # configura DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS, SMTP...
npm ci
npx prisma migrate deploy     # crea el esquema
npm run dev                   # tsx watch
```

Comprueba que responde con `curl http://localhost:3000/api/health`.

### 3. Frontend (puerto 5173)

```bash
cp .env.example .env.local    # opcional: VITE_ADMIN_EMAILS, VITE_CONTACT_WHATSAPP
npm ci
npm run dev
```

El servidor de desarrollo de Vite envía por proxy las peticiones de `/api` hacia
`http://localhost:3000` (puedes sobrescribir el destino con `API_PROXY_TARGET`).

---

## Desarrollo local

Esta sección es la configuración completa para un clon nuevo. Nada de esto
requiere datos de producción, credenciales reales ni una cuenta SMTP — los datos
de demostración se generan localmente y todas las contraseñas son valores
desechables.

### 0. Requisitos

- Node.js 20 o posterior
- npm 10 o posterior
- Docker (solo para la base de datos — el demonio de Docker debe estar en
  ejecución)

### 1. Inicia la base de datos

`docker-compose.dev.yml` es el archivo compose de **desarrollo** (credenciales
solo para desarrollo, sin Traefik, sin redes externas, sin rutas en `/opt`). El
compose de producción está en `infra/backend/docker-compose.yml` y no se usa
aquí.

```bash
docker compose -f docker-compose.dev.yml up -d
```

Crea un contenedor de PostgreSQL 16 con las credenciales desechables de
desarrollo `marketpaq` / `marketpaq`, escuchando únicamente en `127.0.0.1:5432`.

Comprueba su estado:

```bash
docker compose -f docker-compose.dev.yml ps
```

> ¿Prefieres ejecutar también el backend en un contenedor? Usa el perfil
> opcional:
> `docker compose -f docker-compose.dev.yml --profile backend up -d`
> (aplica las migraciones y arranca el backend con recarga en caliente en
> `http://localhost:3000`).

### 2. Configura el backend

```bash
cd backend
cp .env.example .env
```

`backend/.env.example` ya contiene valores predeterminados seguros para
desarrollo (`DATABASE_URL`, `PORT=3000`, `AUTH_SECRET`,
`ADMIN_EMAILS=admin@example.com`, `MAIL_MODE=log`, …) — no hace falta cambiar
nada para trabajar localmente.

- `MAIL_MODE=log` imprime los correos en el registro del backend en lugar de
  enviarlos, así que no hace falta una cuenta SMTP. Con `MAIL_MODE=smtp` (el
  valor predeterminado) y sin credenciales SMTP, los correos no se envían y el
  backend registra `SMTP_NOT_CONFIGURED`.
- `ADMIN_EMAILS` es la lista de administradores permitidos del backend. Usa
  `admin@example.com` — la cuenta de administrador que crea el seed.

### 3. Instala, migra y siembra el backend

```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy     # crea el esquema
npm run db:seed                # datos de demostración falsos (se puede repetir)
npm run dev                    # tsx watch → http://localhost:3000
```

Comprueba que responde con:

```bash
curl http://localhost:3000/api/health
```

### 4. Ejecuta el frontend

```bash
npm ci
npm run dev                    # → http://localhost:5173
```

El servidor de desarrollo de Vite envía por proxy todas las peticiones de
`/api` hacia `http://localhost:3000` (puedes sobrescribir el destino con
`API_PROXY_TARGET`), de modo que la SPA se comunica con tu backend local sin
ninguna configuración adicional.

### 5. Cuentas de demostración

`npm run db:seed` solo crea datos falsos: 1 administrador, 2 desarrolladores,
2 socios, 6 add-ons (de CONTPAQi y SoftRestaurant), 3 solicitudes de
funcionalidad con votos y algunas calificaciones.

| Rol | Correo electrónico | Contraseña |
| --- | --- | --- |
| Administrador | `admin@example.com` | `LocalDev123!` |
| Desarrollador | `dev1@example.com` | `LocalDev123!` |
| Desarrollador | `dev2@example.com` | `LocalDev123!` |
| Socio | `partner1@example.com` | `LocalDev123!` |
| Socio | `partner2@example.com` | `LocalDev123!` |

La cuenta de administrador es la que debes incluir en las listas de
administradores:

```dotenv
# backend/.env
ADMIN_EMAILS=admin@example.com
```

```dotenv
# .env.local (frontend)
VITE_ADMIN_EMAILS=admin@example.com
```

El backend aplica el control de acceso (`ADMIN_EMAILS`); el frontend solo usa
`VITE_ADMIN_EMAILS` para mostrar la navegación de administración, por lo que
ambos deben estar configurados.

El seed es idempotente — volver a ejecutar `npm run db:seed` actualiza las
mismas filas en lugar de duplicarlas.

### 6. Comandos útiles

```bash
npm run dev:db          # inicia la base de datos de desarrollo (docker compose)
npm run dev:db:down    # la detiene (conserva los datos)
npm run dev:db:reset   # la detiene y borra el volumen de la base de datos
npm run dev:seed       # vuelve a ejecutar el seed
npm run dev:backend    # ejecuta el backend desde la raíz del repositorio
```

### Solución de problemas

- `Can't reach database server at localhost:5432` → el contenedor no está en
  ejecución: `docker compose -f docker-compose.dev.yml up -d`.
- `Environment variable not found: DATABASE_URL` → falta `backend/.env`; ejecuta
  `cp .env.example .env` dentro de `backend/`.
- El panel de administración no es visible → `VITE_ADMIN_EMAILS` no está
  definido en `.env.local` (reinicia Vite después; el valor se lee al arrancar).

## Variables de entorno

Backend (`backend/.env`, consulta `backend/.env.example`):

| Variable | Propósito |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `AUTH_SECRET` | Secreto usado para firmar los JWT |
| `ADMIN_EMAILS` | Correos con acceso de administrador, separados por comas (ninguno si no se define) |
| `CORS_ORIGIN` | Origen permitido para el navegador |
| `FRONTEND_BASE_URL` | URL base usada en los enlaces de restablecimiento de contraseña |
| `MARKETPAQ_PUBLIC_URL` | URL pública usada en los enlaces y el logotipo de los correos |
| `MAIL_MODE` | `smtp` (predeterminado) envía el correo; `log` solo lo escribe en el registro del servidor |
| `ZOHO_SMTP_*` | Configuración SMTP para el correo transaccional |
| `UPLOAD_DIR` | Ruta donde se almacenan las imágenes subidas (predeterminado `backend/uploads`) |
| `DEV_BYPASS` | `1` omite la validación del JWT en `/entities/User/me` (solo fuera de producción) |
| `PORT` / `HOST` | Interfaz y puerto en los que escucha el backend (predeterminado `0.0.0.0:3000`) |
| `LOG_LEVEL` | Nivel de detalle del registro: trace, debug, info, warn, error, fatal, silent |
| `NODE_ENV` | `development` o `production` |

Frontend (`.env.local`, consulta `.env.example`; los valores `VITE_*` se
incrustan al compilar):

| Variable | Propósito |
| --- | --- |
| `VITE_ADMIN_EMAILS` | Muestra la navegación de administración para estos correos (mantenlos sincronizados con `ADMIN_EMAILS`) |
| `VITE_CONTACT_WHATSAPP` | Número público de contacto de WhatsApp; los enlaces de contacto se ocultan cuando está vacío |
| `API_PROXY_TARGET` | Solo para el servidor de desarrollo: URL del backend usada por el proxy de `/api` |

## Resumen de la API

| Ruta | Descripción |
| --- | --- |
| `GET /api/health` | Comprobación de disponibilidad |
| `GET /api/v1/config` | Nombre del servicio, versión y entorno |
| `/api/v1/auth/*` | Registro, inicio de sesión, restablecimiento de contraseña y verificación de correo |
| `/api/v1/entities/{Addons,DeveloperProfiles,User}` | Listar/filtrar (`q`, `sort`, `limit`, `skip`), obtener, crear, actualizar y eliminar |
| `GET/PUT /api/v1/entities/User/me` | Usuario actual |
| `POST /api/v1/functions/<name>` | Operaciones tipo RPC (estadísticas, calificaciones, herramientas de administración...) |
| `POST /api/v1/uploads/*` | Avatar, logotipo del desarrollador e imágenes de los add-ons |
| `/api/feature-requests` | Solicitudes de funcionalidad y votos |
| `GET /api/uploads/*` | Archivos subidos |

Las peticiones autenticadas envían `Authorization: Bearer <token>`.

## Scripts

```bash
npm run build        # compilación de producción del frontend (dist/)
npm run lint         # ESLint
npm run dev:db       # inicia el Postgres de desarrollo (docker compose)
npm run dev:seed     # carga los datos de demostración falsos
cd backend && npm run build      # compila el backend (dist/)
cd backend && npm run typecheck  # verificación de tipos del backend y del seed
cd backend && npm run db:seed   # carga los datos de demostración falsos
```

## Comunidad

MarketPAQ es un proyecto de código abierto y la comunidad es parte esencial de
él. Estas son las puertas de entrada:

- [Cómo contribuir a MarketPAQ](CONTRIBUTING.md) — flujo de trabajo, mensajes de
  commit y comprobaciones obligatorias.
- [Código de Conducta](CODE_OF_CONDUCT.md) — normas de convivencia en el
  proyecto y en sus espacios.
- [Política de seguridad](SECURITY.md) — cómo reportar una vulnerabilidad de
  forma privada.
- [Gobernanza](GOVERNANCE.md) — quién decide, cómo se toman las decisiones y
  qué límites tiene el proyecto.
- [Reglas de publicación](CONTENT_POLICY.md) — qué se puede publicar en la
  plataforma y qué no.
- [Licencia (AGPL-3.0-only)](LICENSE) — términos de uso del código.

### Marcas y ausencia de afiliación

CONTPAQi es una marca comercial de sus respectivos titulares y SoftRestaurant
es una marca comercial de National Soft. MarketPAQ es un proyecto independiente
y no está afiliado, patrocinado, autorizado ni respaldado por CONTPAQi,
National Soft ni por ninguna otra entidad. La mención de esas marcas se usa
únicamente de forma descriptiva, para indicar compatibilidad. MarketPAQ es una
marca de sus titulares y ninguna otra persona puede usarla de forma que
sugiera una autorización o una relación con el proyecto que no exista.
