# Gobernanza de MarketPAQ

Este documento describe quién decide, cómo se toman las decisiones y qué
límites tiene el proyecto. Complementa al
[Código de Conducta](CODE_OF_CONDUCT.md), a
[CONTRIBUTING.md](CONTRIBUTING.md) y a [SECURITY.md](SECURITY.md).

## Principios

1. **El proyecto es de la comunidad y se desarrolla en abierto**: todo cambio
   entra mediante un Pull Request revisado en GitHub.
2. **Una sola persona mantiene el control final** mientras el proyecto sea
   pequeño: el mantenedor (*owner*) (`@anychacas`).
3. **La instancia oficial y sus datos no son comunitario**: se operan de forma
   privada.
4. **Las decisiones se toman de forma transparente y documentada**: issues,
   Pull Requests y este repositorio son el registro.

## Roles

### Mantenedor (*maintainer*)

Es el owner del proyecto (`@anychacas`) y, al inicio, la única persona con este
rol. Puede:

- Aprobar, integrar, editar o cerrar Pull Requests.
- Fusionar en `main` (la rama está protegida) y preparar publicaciones.
- Otorgar o revocar los roles de **Triage** y **Write**.
- Decidir sobre la moderación del contenido publicado en la plataforma y
  aplicar bajas (ver [CONTENT_POLICY.md](CONTENT_POLICY.md)).
- Responder los reportes de seguridad y publicar avisos.
- Desplegar la instancia oficial.

### Triage

Personas de confianza que ayudan a clasificar y revisar el trabajo entrante.
Pueden:

- Etiquetar, clasificar, pedir información y cerrar issues y PRs.
- Revisar PRs pequeños y aprobar cambios triviales (documentación, estilos).
- Revisar traducciones y documentación.

No pueden fusionar en `main`, ni desplegar, ni gestionar los roles.

### Colaborador (*contributor*)

Cualquier persona que participe: reporta issues, propone mejoras, abre Pull
Requests, responde preguntas y participa en la discusión. No requiere ningún
permiso previo más allá de aceptar el Código de Conducta.

### Cómo se evoluciona a Triage y a Write

Ambos roles se otorgan por decisión del mantenedor, considerando:

- Historial de contribuciones útiles, revisadas y aceptadas.
- Calidad de la comunicación y seguimiento de las normas del proyecto.
- Cumplimiento del Código de Conducta y de los [términos de publicación](CONTENT_POLICY.md).
- Confianza en el manejo de issues y reviews.

Los criterios son orientativos: no hay un número mínimo de PRs ni un proceso
automático. El mantenedor puede retirar un rol en cualquier momento, notificando
las razones en la discusión correspondiente.

## Cómo se toman las decisiones

- **Cambios de código**: propuesta en un issue (si es grande o discutible) →
  Pull Request → revisión → al menos una aprobación de un mantenedor →
  fusión con *squash* en `main`.
- **Cambios de alcance o de reglas** (estos documentos, la política de
  contenido, los roles): se discuten en un issue y se aplican mediante un PR
  aprobado por el mantenedor.
- **Decisiones técnicas**: las toma quien implementa el cambio, siempre que
  encaje en la arquitectura existente y respete los límites del proyecto. Si
  hay desacuerdo, decide el mantenedor.
- **Discusiones no concluyentes**: se pospone la decisión y se mantiene el
  estado actual; no se bloquea el proyecto esperando un consenso.
- El mantenedor puede cerrar issues o PRs que no encajen con el proyecto,
  explicando el motivo en el hilo correspondiente.

## La instancia oficial y sus datos

- **marketpaq.com** y la base de datos que la sostiene son operados de forma
  privada por el mantenedor.
- **Los colaboradores nunca reciben datos de producción**: ni usuarios, ni
  visitas, ni add-ons reales, ni credenciales, ni acceso al servidor. Para
  desarrollar se usa el entorno local descrito en el
  [README](README.md) con datos de prueba.
- Los despliegues a la instancia oficial **los realiza únicamente el
  mantenedor**. El flujo de trabajo de despliegue está asociado a `main` y
  requiere los secretos del servidor; los Pull Requests de la comunidad nunca
  tienen acceso a ellos.
- El código es público y está bajo AGPL-3.0-only, pero la operación del
  servicio, su infraestructura y sus datos no forman parte del proyecto
  comunitario.

## Licencia

El proyecto se distribuye bajo **AGPL-3.0-only**. Los cambios de licencia
requieren acuerdo del mantenedor y la aceptación de quienes tienen
contribuciones registradas. Ver [LICENSE](LICENSE) y
[NOTICE](NOTICE).

## Cambios en este documento

Cualquier modificación de este documento se propone en un issue, se discute de
forma abierta y se integra mediante un Pull Request aprobado por el
mantenedor.
