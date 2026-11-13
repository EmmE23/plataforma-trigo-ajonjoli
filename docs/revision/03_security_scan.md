# Escaneo de seguridad — `/security-scan` (AgentShield) + `npm audit`

**Fecha:** 2026-11-13 · **Ejecución:** local, con `npx ecc-agentshield scan --path . --format text` (descarga temporal de npm) y `npm audit`.

## AgentShield
- **Nota:** B (80/100). Permisos, hooks, servidores MCP y agentes: 100/100. Secretos: 0/100.
- **Hallazgos:** 170, todos marcados como "CRITICAL — Hardcoded Azure storage account key" en `package-lock.json`.
- **Verificación:** se revisaron las 170 líneas señaladas: **las 170 son campos `"integrity": "sha512-…"`** (hashes de integridad de los paquetes npm en base64), no claves de Azure. Son **falsos positivos** del patrón de detección. No hay secretos reales en el proyecto: la única clave (`JWT_SECRET`) está en `.env.local`, excluido de git.
- **Acción:** ninguna sobre `package-lock.json` (debe conservarse para instalaciones reproducibles). AgentShield está orientado a configuraciones de agentes de IA (`.claude/`, hooks, MCP); el proyecto no tiene ninguna.

## npm audit
| Antes | Paquete | Severidad | Detalle | Corrección |
|---|---|---|---|---|
| 2 vulnerabilidades (1 alta, 1 moderada) | `postcss@8.4.31` (fijado dentro de `next@15.5.29`) | Alta | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp (lectura de archivos `.map` vía `sourceMappingURL`), GHSA-qx2v-qp2m-jg93 (XSS en la salida de `stringify`) | `overrides` de npm a `postcss@8.5.32` (versión corregida) sin cambiar de versión mayor de Next.js. **Después: 0 vulnerabilidades.** Compilación y 12 pruebas E2E correctas. |

## Revisión manual de seguridad (OWASP Top 10:2025, RNF-01)
Ver `01_code_review_ecc.md` y `02_revision_codex.md`. Controles existentes: JWT HS256 en cookie `httpOnly`/`SameSite=Strict`, bcrypt, permisos por rol en middleware y en cada ruta, CSRF por origen, validación con zod, SQL parametrizado, encabezados de seguridad, límite de intentos de ingreso y de peticiones públicas, consentimiento de datos (Ley 1581 de 2012).
