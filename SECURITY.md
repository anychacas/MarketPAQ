# Política de seguridad

## Versiones soportadas

| Versión | Soporte |
| --- | --- |
| Rama `main` | Sí |
| Instancia de producción (marketpaq.com) | Sí |
| Ramas anteriores, *tags* y publicaciones viejas | No |

Las correcciones de seguridad se aplican a `main` y se despliegan en la
instancia oficial. No se mantienen versiones antiguas con parches de seguridad.

## Cómo reportar una vulnerabilidad

Utiliza el reporte privado de GitHub: en la pestaña **Security** del repositorio
elige **Report a vulnerability** (*Reportar una vulnerabilidad*). Eso abre un
aviso privado (*security advisory*) visible únicamente para quien reporta y para
el mantenedor, y permite conversar sin exponer el problema.

El enlace canónico del aviso se mantiene en un solo lugar del repositorio:
`.github/ISSUE_TEMPLATE/config.yml` (puede cambiar si el repositorio cambia de
nombre o de ubicación).

Incluye en el reporte, cuando lo tengas:

- Descripción de la vulnerabilidad y de su impacto.
- Pasos para reproducirla o prueba de concepto mínima.
- Versiones o commits afectados.
- Cualquier conocimiento público previo del problema (avisos publicados,
  vulnerabilidades relacionadas).

## Qué no hacer

- **No abras un issue público** ni abras un PR que exponga el problema: usa el
  aviso privado.
- **No pruebes contra la instancia de producción**: no accedas a datos de otros
  usuarios, no uses cuentas reales de terceros, no extraigas ni enumeres datos
  personales, no causes degradación del servicio y no hagas pruebas masivas
  sobre `marketpaq.com`.
- **No publiques los detalles** hasta que se haya corregido el problema y se
  haya publicado el aviso; la divulgación se coordina con el mantenedor.
- **No incluyas datos de clientes ni información personal** en el reporte, en los
  issues ni en los Pull Requests.

## Respuesta y tiempos

El proyecto se mantiene de forma voluntaria, por lo que no existe un SLA
formal; los tiempos son de **buena fe (best effort)**:

| Etapa | Objetivo |
| --- | --- |
| Acuse de recibo del reporte | Hasta 7 días |
| Evaluación inicial y severidad | Hasta 14 días |
| Corrección y publicación del aviso | Según la severidad y la disponibilidad del mantenedor |
| Mención de quien reportó en la publicación correspondiente | Una vez aplicada la corrección |

El mantenedor puede solicitar información adicional para continuar con la
revisión. Las vulnerabilidades confirmadas se corrigen con prioridad y se
documentan en un aviso de seguridad de GitHub.

## Divulgación

El mantenedor coordina la publicación del aviso de seguridad. Quien reporta y
lo indica expresamente puede ser acreditado en el aviso o en la publicación
correspondiente. Si un problema se divulga antes de la corrección,
el mantenedor lo tratará como un asunto urgente y priorizará la
mitigación.

## Dependencias de terceros

Los reportes sobre vulnerabilidades en dependencias de terceros se gestionan
como cualquier otro reporte: de forma privada y sin datos de producción. Para
un análisis automatizado se recomienda `npm audit` sobre los archivos
`package.json` del frontend y del backend.

## Responsabilidad

Quien reporte una vulnerabilidad de buena fe y evite el acceso no autorizado a
datos ajenos no será sancionado por su investigación.
