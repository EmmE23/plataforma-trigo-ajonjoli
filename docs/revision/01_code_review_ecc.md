# Revisión de código — ECC `/code-review` (modo local)

**Fecha:** 2026-11-13 · **Alcance:** todo `src/`, `db/schema.sql`, `scripts/setup.mjs` (el proyecto aún no está en git, se revisaron los archivos completos).
**Decisión:** SOLICITAR CAMBIOS (hay hallazgos de severidad ALTA). Sin hallazgos CRÍTICOS.

## Hallazgos

### CRÍTICOS
Ninguno. No hay credenciales en el código de la aplicación (la clave JWT va en `.env.local`), todas las consultas SQL son parametrizadas, React escapa la salida (sin `dangerouslySetInnerHTML`) y toda entrada se valida con zod.

### ALTOS
| ID | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|
| ECC-1 | `src/app/api/voluntariado/route.ts:8`, `src/app/api/donaciones/route.ts:8`, `src/app/api/analitica/route.ts:9` | Las rutas públicas no tienen límite de peticiones: un tercero puede llenar la base con solicitudes, donaciones de prueba o visitas falsas. | Límite por IP en cada ruta pública. |
| ECC-2 | `src/lib/repos/portal.ts:41` (`registrarVisitaPortal`) | La analítica acepta cualquier texto que empiece por `/` como ruta, así que se pueden inyectar rutas inventadas en los reportes. | Aceptar solo las rutas reales del portal (`/`, `/donar`). |
| ECC-3 | `src/lib/api.ts:27` (`sesionActual`) y `src/app/panel/layout.tsx:26` | Un usuario **desactivado** conserva el acceso hasta que vence su JWT (8 h): solo se verifica la firma, no el estado en la base. | Comprobar `perfiles.activo` al validar la sesión en la API y en el panel. |
| ECC-4 | `src/app/ingreso/FormularioIngreso.tsx` (ayuda "¿Olvidó su contraseña?") | El texto dice que el administrador puede asignar una contraseña nueva desde Usuarios, pero esa función no existe. | Implementar "Restablecer contraseña" para el administrador (con prueba). |

### MEDIOS
| ID | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|
| ECC-5 | `src/lib/api.ts:46` (`ipDe`) | El límite de intentos de ingreso usa `X-Forwarded-For`, que el cliente puede falsificar para saltarse el bloqueo. | Confiar en esa cabecera solo si `TRUST_PROXY=1` y limitar además por correo. |
| ECC-6 | `src/lib/api.ts:37` (`leerJson`) | Lee el cuerpo completo antes de comprobar el tamaño. | Rechazar antes por `Content-Length`. |
| ECC-7 | `src/app/page.tsx:13-21`, `src/app/donar/page.tsx:8`, `src/app/donar/FormularioDonacion.tsx:24-27` | JSX en líneas de más de 1 000 caracteres (código de Codex): difícil de leer y de mantener. | Reformatear en varias líneas. |
| ECC-8 | `scripts/setup.mjs:15` | La validación de `DATA_DIR` con `startsWith` aceptaría una carpeta hermana como `data2`. | Usar `path.relative`. |

### BAJOS
| ID | Archivo:línea | Hallazgo | Corrección sugerida |
|---|---|---|---|
| ECC-9 | `src/lib/repos/reportes.ts:59` | Conversión redundante `::bigint::text::numeric`. | Simplificar a `::bigint`. |
| ECC-10 | `scripts/setup.mjs` | Símbolos "✔" en la salida de consola (regla de estilo: sin emojis). | Usar texto. |
| ECC-11 | `scripts/setup.mjs:44` | Contraseñas de demostración en el repositorio. | Aceptado: son datos ficticios de demo, documentados en el README con la advertencia de cambiarlos antes de usar datos reales. |

## Validación
| Comprobación | Resultado |
|---|---|
| Tipos (`tsc --noEmit`) | PASA |
| Lint | Omitido (el proyecto no tiene ESLint configurado) |
| Pruebas (`vitest`) | PASA (80/80) |
| Compilación (`next build`) | PASA |
