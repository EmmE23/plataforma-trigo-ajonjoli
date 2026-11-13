# Segunda revisión de código — Codex (solo lectura)

**Fecha:** 2026-11-13 · **Herramienta:** plugin de Codex para Claude Code (`codex-rescue`, en modo de solo lectura; el comando `/codex:review` no estaba disponible en la sesión).
**Alcance:** `db/schema.sql`, `src/middleware.ts`, `src/lib/**`, `src/app/**`, `scripts/setup.mjs`. Codex verificó además que `tsc --noEmit` termina sin errores.

| ID | Severidad | Archivo:línea (al momento de la revisión) | Hallazgo | Decisión |
|---|---|---|---|---|
| CDX-1 | ALTA | `src/lib/auth.ts:31`, `src/middleware.ts:29`, `src/lib/repos/usuarios.ts:46` | Las sesiones siguen siendo válidas después de desactivar una cuenta (el JWT solo se verifica por firma y vencimiento). | Corregido (coincide con ECC-3). |
| CDX-2 | MEDIA | `src/lib/repos/inventario.ts:94` | El código de lote se calcula contando lotes del día: dos entradas simultáneas pueden obtener el mismo número y una fallaría por la restricción `unique`. | Corregido con bloqueo transaccional (`pg_advisory_xact_lock`) y consecutivo a partir del máximo existente. No se reprodujo en PGlite (procesa una transacción a la vez), pero aplica en PostgreSQL/Supabase. |
| CDX-3 | MEDIA | `src/lib/repos/visitas.ts:27`, `db/schema.sql` | No hay un límite de aforo que impida registrar entradas por encima de una capacidad máxima. | No se cambió: el requisito RF-02 solo pide **mostrar** el aforo y la fundación no ha definido una capacidad máxima. Queda como dato pendiente y recomendación. |
| CDX-4 | MEDIA | `src/app/api/analitica/route.ts:9`, `src/lib/repos/portal.ts:41` | La ruta pública de analítica no tiene límite de frecuencia ni política de retención. | Corregido el límite y la lista blanca de rutas (coincide con ECC-1/ECC-2). La retención se deja como recomendación (la tabla no guarda datos personales). |

Codex no encontró defectos WCAG 2.2 AA evidentes, interpolación SQL directa ni sumideros de XSS.
