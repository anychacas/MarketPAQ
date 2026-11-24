# Historial de cambios

Todos los cambios relevantes de MarketPAQ se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto sigue [Versionado Semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-11-23

Primera versión publicada como código abierto bajo la licencia AGPL-3.0.

### Agregado

- Licencia AGPL-3.0, aviso de marcas y de no afiliación (`NOTICE`).
- Reglas de la comunidad: guía para contribuir, código de conducta, política
  de seguridad, gobierno del proyecto y reglas de publicación.
- Plantillas de issues y de Pull Request, y `CODEOWNERS`.
- Entorno de desarrollo local con `docker-compose.dev.yml`, datos de ejemplo
  ficticios (`npm run db:seed`) y modo de correo solo en registro (`MAIL_MODE=log`).
- Recordatorio semanal para completar el tipo de cuenta.
- Documentación del repositorio en español y logo en el README.

### Cambiado

- La API del backend se expone en `/api/v1/*` con un cliente propio en el
  frontend (`src/api/client.js`).
- Cualquier usuario con sesión puede proponer y votar mejoras.
- Los administradores y los datos de contacto se configuran con variables de
  entorno (`ADMIN_EMAILS`, `VITE_ADMIN_EMAILS`, `VITE_CONTACT_WHATSAPP`).
- Si el SMTP no está configurado, el envío de correo informa el error en lugar
  de reportar éxito.

### Eliminado

- Donaciones y la integración con MercadoPago.
- Dependencia del SDK y del complemento de Vite de la plataforma anterior.
- Documentos internos y datos personales del código.

### Seguridad

- Dependencias actualizadas para cerrar avisos de seguridad: `fastify` 5.12,
  `@fastify/static` 10, `nodemailer` 10, `lodash` 4.18, `postcss` 8.5.33,
  `react-router-dom` 6.30.6 y `vite` 6.4.6. Se retiró `zod`, que no se usaba.

[1.0.0]: https://github.com/anychacas/MarketPAQ/releases/tag/v1.0.0
