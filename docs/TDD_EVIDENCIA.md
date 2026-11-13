# Evidencia de desarrollo guiado por pruebas (TDD)

**Plan de origen:** `../PLAN_DESARROLLO.md` (aprobado el 2026-11-12). Recorridos de usuario tomados de los requisitos RF-01 a RF-10 del documento del proyecto.

## Recorridos de usuario
- Como **recepcionista**, quiero registrar la entrada de una persona por documento o QR para conocer el aforo y la permanencia (RF-01, RF-02).
- Como **almacenista**, quiero registrar donativos por lote y salidas con destino para que el stock se actualice solo y no se entregue lo que no hay (RF-03 a RF-05).
- Como **almacenista**, quiero ver alertas de stock mínimo, lotes por vencer y el orden PEPS para evitar vencimientos y excesos (RF-06, RF-07).
- Como **visitante del portal**, quiero inscribirme como voluntario y donar en línea (RF-08).
- Como **administrador**, quiero que cada rol vea solo lo suyo y consultar reportes por periodo (RF-09, RF-10).

## Ciclo RED → GREEN por tarea

| Tarea | Prueba (archivo) | RED (fallo esperado) | GREEN |
|---|---|---|---|
| Esquema, trigger y vistas | `tests/esquema.test.ts` (13) | No existía `@/lib/db` (falla de importación) | 13/13 tras `db/schema.sql` y `src/lib/db.ts` |
| Autenticación y roles | `tests/auth.test.ts` (22) | No existían `auth`, `usuarios`, `limitador` | 22/22 |
| Personas y visitas | `tests/visitas.test.ts` (11) | No existían los repositorios | 10/11 → corregido el mensaje de autorización → 11/11 |
| Inventario | `tests/inventario.test.ts` (10) | No existía el repositorio | 9/10 → la prueba calculaba fechas en UTC; corregida a hora de Colombia → 10/10 |
| Reportes | `tests/reportes.test.ts` (5) | No existía el repositorio | 5/5 |
| Portal (Codex) | `tests/portal.test.ts` (11) | Codex reportó la falla inicial por ausencia de `portal.ts` | 11/11 |
| Exportación CSV | `tests/csv.test.ts` (3) | — (la implementación se escribió antes que la prueba; desviación registrada) | 3/3 |
| Traducción de errores | `tests/errores.test.ts` (5) | Cobertura 17 % en `errores.ts` | 5/5, cobertura 100 % de líneas |
| Flujos completos | `e2e/flujos.spec.ts` (11) | 8/11: detectó un error real en el formulario de voluntariado (`e.currentTarget` nulo tras `await`) y dos selectores ambiguos | 11/11 |

## Garantías verificadas

| # | Qué se garantiza | Prueba | Tipo | Resultado |
|---|---|---|---|---|
| 1 | Entrada de 50 deja el stock en 50; salida de 20 lo deja en 30 | `esquema.test.ts` | integración (BD) | PASA |
| 2 | Se rechaza una salida de 60 con 50 en stock | `esquema.test.ts`, `inventario.test.ts`, E2E | integración / E2E | PASA |
| 3 | Los movimientos no se pueden modificar ni borrar | `esquema.test.ts` | integración (BD) | PASA |
| 4 | El orden PEPS sale del lote más antiguo y reparte entre lotes; sin descuentos parciales | `inventario.test.ts`, E2E | integración / E2E | PASA |
| 5 | Una sola visita abierta por persona; el aforo sube y baja | `visitas.test.ts`, E2E | integración / E2E | PASA |
| 6 | No se registra a nadie sin autorización de datos (Ley 1581) | `esquema.test.ts`, `visitas.test.ts`, `portal.test.ts` | integración | PASA |
| 7 | Cada rol accede solo a sus rutas; la API sin sesión responde 401 | `auth.test.ts`, E2E | unitaria / E2E | PASA |
| 8 | Bloqueo tras 5 intentos fallidos de ingreso | `auth.test.ts` | unitaria | PASA |
| 9 | Los reportes totalizan entradas, salidas y mermas del periodo | `reportes.test.ts` | integración | PASA |
| 10 | El CSV neutraliza fórmulas (inyección en Excel) | `csv.test.ts` | unitaria | PASA |

## Comandos y resultados (2026-11-12)

```
npx vitest run --coverage   → 8 archivos, 80 pruebas PASAN
                              Cobertura src/lib: sentencias 82.63 %, ramas 72.77 %, funciones 81.17 %, líneas 84.70 %
npx playwright test         → 11 pruebas PASAN
npx tsc --noEmit            → sin errores
npm run build               → compilación correcta
```

## Fase 3 — correcciones de la revisión (2026-11-13)

| Tarea | Prueba | RED | GREEN |
|---|---|---|---|
| Correcciones ECC/Codex | `tests/correcciones.test.ts` (10) | 5 fallos: no existían `consumir`, `restablecerPassword`, `perfilActivo` y la lista blanca de analítica. La prueba de concurrencia de lotes pasó sin la corrección (PGlite serializa transacciones; la corrección aplica a PostgreSQL/Supabase). | 10/10 |
| Sesión revocada al desactivar | `e2e/flujos.spec.ts` (nueva prueba) | — | 12/12 E2E |

Resultado final de la Fase 3: `vitest` 90/90 PASAN; cobertura `src/lib`: sentencias 88,12 %, ramas 75,96 %, funciones 86,66 %, líneas 90,07 %. `playwright` 12/12 PASAN. `tsc` sin errores. `npm audit`: 0 vulnerabilidades.

## Brechas conocidas
- La cobertura de **ramas** (76 % tras la Fase 3) sigue por debajo del 80 %; las ramas faltantes están sobre todo en `sesionActual`/`requerirSesion` de `src/lib/api.ts` (dependen de cookies de Next.js y se cubren con las pruebas E2E, que no miden cobertura) y en `src/lib/db.ts` (instancia del servidor).
- Las pantallas de React se validan con las pruebas E2E, no con pruebas de componentes.
- El proyecto aún no está en git, por lo que no hay commits de control por etapa (se harán en la Fase 4).
