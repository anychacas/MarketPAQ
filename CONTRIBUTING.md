# Cómo contribuir a MarketPAQ

Gracias por querer mejorar MarketPAQ. Este documento explica cómo contribuir de
forma práctica: qué se espera de cada Pull Request (PR), qué comprobaciones
debes ejecutar y cómo se revisa el trabajo. Todas las interacciones se rigen
por el [Código de Conducta](CODE_OF_CONDUCT.md).

## 1. Antes de escribir código

- **Cambios grandes, discutibles o que alteran el modelo de datos**: abre
  primero un *issue* con el problema, la propuesta y las alternativas
  consideradas. Acordar el enfoque evita trabajo duplicado.
- **Correcciones pequeñas** (erratas, documentación, refactors acotados): puedes
  abrir el PR directamente.
- **Errores**: usa la plantilla [reporte de error](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Funcionalidad nueva**: usa la plantilla
  [solicitud de funcionalidad](.github/ISSUE_TEMPLATE/feature_request.yml).
- **Vulnerabilidades**: no abras un issue; revisa [SECURITY.md](SECURITY.md).

## 2. Flujo de trabajo

1. Haz *fork* del repositorio en tu cuenta de GitHub.
2. Clona tu fork y apunta `upstream` al repositorio oficial:

   ```bash
   git clone https://github.com/<tu-usuario>/MarketPAQ.git
   cd MarketPAQ
   git remote add upstream https://github.com/anychacas/MarketPAQ.git
   ```

3. Crea una rama corta y enfocada a partir de `main`:

   ```bash
   git checkout -b feat/nombre-corto
   ```

4. Trabaja en commits pequeños y atómicos.
5. Publica la rama y abre el PR contra `main`:

   ```bash
   git push -u origin feat/nombre-corto
   ```

6. Atiende los comentarios de revisión con commits adicionales en la misma
   rama (`git push`). No abras un PR nuevo para las correcciones.

## 3. Mensajes de commit

Se usan [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/):

```text
<tipo>(<ámbito>): <descripción breve en imperativo>
```

Tipos habituales: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `build`,
`chore`, `style` y `revert`. El ámbito es opcional (`backend`, `frontend`,
`infra`).

```bash
git commit -s -m "fix(backend): valida el token al reenviar la contraseña"
```

El flag `-s` agrega la línea `Signed-off-by:` (firmado DCO) y es **obligatorio**.

## 4. Comprobaciones obligatorias antes de abrir el PR

```bash
npm ci
npm run lint
npm run build
cd backend && npm ci && npx tsc --noEmit
```

Ejecuta además a mano el flujo afectado (iniciar sesión, publicar un add-on,
abrir el panel de administración, etc.). Para preparar el entorno local, ver la
sección de desarrollo local («Running locally») del [README](README.md).

## 5. Qué debe incluir la descripción del PR

- **Qué cambia** y **por qué**, en dos o tres líneas.
- **Issue relacionado**: `Cierra #12` o `Relacionado con #12`.
- **Alcance**: qué queda explícitamente fuera de este PR.
- **Cómo se probó**: pasos manuales, capturas o salidas relevantes.
- **Riesgos**: migraciones de base de datos, cambios de API, variables de
  entorno nuevas, efecto sobre los despliegues.
- **Licencia**: confirmas que tu contribución se publica bajo AGPL-3.0-only.

## 6. Revisión y aprobación

- `main` está protegida: **todo cambio entra mediante un PR**; no hay merges
  directos ni pushes directos a `main`.
- Cada PR requiere **al menos una aprobación de un mantenedor**. Los
  mantenedores son responsables de revisión de todas las rutas del repositorio
  (ver [CODEOWNERS](.github/CODEOWNERS)), por lo que su revisión se solicita
  automáticamente.
- Los mantenedores pueden solicitar cambios o cerrar un PR que no siga estas
  pautas. Una vez aprobado, el PR se integra con *squash* usando el mensaje del
  commit convencional.
- El flujo de trabajo de *preview* construye la aplicación de cada PR; el
  despliegue a la instancia oficial lo realiza el mantenedor (ver
  [GOVERNANCE.md](GOVERNANCE.md)).
- Si un PR queda sin respuesta, puedes mencionarlo al mantenedor en el issue
  o en la discusión del PR.

## 7. Roles y cómo se obtienen

| Rol | Qué puede hacer | Cómo se obtiene |
| --- | --- | --- |
| Colaborador | Reporta issues, abre PRs, participa en la discusión | Automático al abrir un issue o un PR |
| Triage | Etiqueta, clasifica, pide información, revisa PRs pequeños | Contribución sostenida, por decisión del mantenedor |
| Write (mantenedor) | Aprueba e integra PRs, gestiona ramas y publicaciones | Contribución sostenida, por decisión del mantenedor |

Para obtener un rol se requiere un historial de contribuciones útiles y
revisadas, buena comunicación y respeto al Código de Conducta. La otorgación
y la revocación de roles son decisión del mantenedor, según lo descrito en
[GOVERNANCE.md](GOVERNANCE.md).

## 8. Acuerdo de contribución (DCO)

Cada commit debe incluir la línea `Signed-off-by:`. Se añade así:

```bash
git commit -s -m "mensaje del commit"
```

Si ya habías hecho el commit, agrega el sign-off con
`git commit --amend -s --no-edit` y vuelve a subir la rama. El sign-off declara
que tienes derecho a enviar ese código y que lo contribuyes bajo la misma
licencia del proyecto. No se requiere ningún acuerdo adicional.

## 9. Licencia de las contribuciones

MarketPAQ se distribuye bajo **AGPL-3.0-only** (ver [LICENSE](LICENSE)). Al
enviar un PR (o un parche) cedes los derechos de autor de esa contribución al
proyecto para que se distribuya bajo AGPL-3.0-only, tal como exige la sección 5
de la licencia. No envíes código del que no tengas los derechos ni con una
licencia incompatible.

## 10. Publicación de add-ons

Las publicaciones en la plataforma se rigen por las
[Reglas de publicación](CONTENT_POLICY.md).
