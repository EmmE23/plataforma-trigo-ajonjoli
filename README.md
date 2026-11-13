# Plataforma web integrada — Fundación Trigo y Ajonjolí

Plataforma web de bajo costo para la **gestión de visitas, inventarios y donaciones** de la Fundación Trigo y Ajonjolí
(NIT 901.243.769-6, barrio Maipore, Soacha, Cundinamarca). Proyecto de prácticas empresariales (modalidad social comunitaria)
de **Jairo Emmanuel Pinzón Rodríguez**, Ingeniería de Software, Fundación Universitaria Compensar.

## ¿Qué hace?

| Módulo | Funciones |
|---|---|
| **Portal público** | Información de la fundación, “lo que más necesitamos hoy” (se actualiza con el inventario), formulario de voluntariado con autorización de datos (Ley 1581 de 2012), donación en línea en **modo de pruebas** y analítica propia de visitas. |
| **Ingreso del personal** | Inicio de sesión con JWT (cookie segura) y redirección según el rol: administrador, recepcionista, almacenista o donante. Bloqueo temporal tras 5 intentos fallidos. |
| **Control de visitas** | Registro de entrada por documento o código QR, alta de personas nuevas con autorización de datos y carné QR, aforo actual, registro de salida y tiempo de permanencia. Una sola visita abierta por persona. |
| **Inventario de donativos** | Donativos por lote (código automático), salidas con beneficiario o destino, mermas, stock automático, bloqueo de salidas sin existencias, alertas de stock mínimo, lotes por vencer en 30 días, orden de salida PEPS (automático) y libro de movimientos que no se puede modificar ni borrar. |
| **Reportes** | Entradas, salidas y mermas por periodo (con descarga CSV para Excel), visitas por día, resumen general, solicitudes de voluntariado, donaciones y páginas más visitadas. |
| **Usuarios** | (Administrador) Crear usuarios, activarlos o desactivarlos y restablecer su contraseña. |
| **Mis donaciones** | (Donante) Historial de sus donaciones. |

## Tecnologías

- **Next.js 15** (React 19, TypeScript): interfaz y API RESTful en el mismo proyecto.
- **PostgreSQL**: en la demostración local se usa **PGlite** (PostgreSQL compilado a WebAssembly, se instala con npm; no requiere instalar un servidor de base de datos). El mismo esquema (`db/schema.sql`) es compatible con **Supabase**.
- **jose** (JWT), **bcryptjs** (contraseñas cifradas), **zod** (validación), **qrcode** (carné QR).
- **Vitest** (pruebas unitarias y de integración) y **Playwright** (pruebas de extremo a extremo).

## Requisitos

- Windows 10 u 11.
- **Node.js 20 o superior** (probado con Node.js 24). Descárguelo de <https://nodejs.org> (versión LTS) e instálelo con las opciones por defecto.
- Conexión a internet solo para el primer `npm install`.

## Instalación y ejecución en Windows (paso a paso)

1. Abra la carpeta `app` del proyecto en el Explorador de archivos.
2. Haga clic en la barra de direcciones, escriba `powershell` y presione **Enter**. Se abre una terminal ubicada en esa carpeta.
3. Instale las dependencias (solo la primera vez):
   ```powershell
   npm install
   ```
4. Prepare la aplicación: crea el archivo `.env.local` con una clave secreta aleatoria y la base de datos con datos de ejemplo:
   ```powershell
   npm run setup
   ```
5. Compile la aplicación:
   ```powershell
   npm run build
   ```
6. Iníciela:
   ```powershell
   npm start
   ```
7. Abra el navegador en **<http://localhost:3000>**.
8. Para detenerla, vuelva a la terminal y presione **Ctrl + C**.

> Modo desarrollo (recarga automática al editar el código): `npm run dev` en lugar de los pasos 5 y 6.

### Usuarios de demostración

Son datos **ficticios**, solo para la demostración local. Cámbielos o elimínelos antes de usar la plataforma con datos reales.

| Rol | Correo | Contraseña | Entra a |
|---|---|---|---|
| Administrador | `admin@trigoyajonjoli.org` | `Admin-Trigo-2026` | Reportes, y acceso a todo |
| Recepcionista | `recepcion@trigoyajonjoli.org` | `Recepcion-2026` | Control de visitas |
| Almacenista | `almacen@trigoyajonjoli.org` | `Almacen-2026!` | Inventario y reportes |
| Donante | `donante@correo-ejemplo.co` | `Donante-2026!` | Mis donaciones |

Documentos de prueba para el módulo de visitas: `79563214` (Hernando Vargas), `52418963` (María Teresa Rojas). Cualquier
documento nuevo (por ejemplo `1099888777`) abre el formulario de registro.

### Reiniciar los datos de ejemplo

Detenga el servidor (Ctrl + C) y ejecute:
```powershell
npm run seed
```
Esto borra **solo** la base local de la demostración (`data/pgdata`) y la vuelve a crear.

## Pruebas

```powershell
npm test                # 90 pruebas unitarias y de integración (Vitest)
npm run test:coverage   # con informe de cobertura
npm run build           # requisito para las pruebas E2E y las capturas
npx playwright install chromium   # solo la primera vez
npm run test:e2e        # 12 pruebas de extremo a extremo (Playwright), con una base de datos aparte
npm run capturas        # regenera las capturas de pantalla en ../entregables/evidencias/
npm run typecheck       # verificación de tipos de TypeScript
```

## Estructura

```
app/
├── db/schema.sql            # 9 tablas + analítica, 4 vistas, trigger de stock y bloqueo del libro de movimientos
├── scripts/setup.mjs        # crea .env.local y carga los datos de ejemplo
├── src/
│   ├── middleware.ts        # control de acceso por rol y protección CSRF
│   ├── lib/                 # base de datos, autenticación, validación y repositorios (lógica de negocio)
│   └── app/                 # pantallas (portal, ingreso, panel) y rutas de la API (/api/...)
├── tests/                   # pruebas unitarias e integración (Vitest)
├── e2e/                     # pruebas de extremo a extremo (Playwright)
└── docs/TDD_EVIDENCIA.md    # evidencia del desarrollo guiado por pruebas
```

## Seguridad y datos personales

- Contraseñas cifradas con bcrypt; sesión con JWT firmado (HS256) en cookie `httpOnly` y `SameSite=Strict`, válida por 8 horas.
- Permisos por rol verificados en el middleware y otra vez en cada ruta de la API.
- Protección CSRF (se exige el mismo origen en toda petición que modifica datos) y encabezados de seguridad.
- Límite de intentos de ingreso (5 fallos por cuenta en 15 minutos) y de peticiones a las rutas públicas.
  Si se publica detrás de un proxy o servicio de hosting, defina `TRUST_PROXY=1` en `.env.local` para limitar por IP real.
- Desactivar un usuario revoca su acceso de inmediato (la sesión se valida contra la base de datos en cada petición).
- Dependencias sin vulnerabilidades conocidas (`npm audit`: 0); PostCSS se fija en 8.5.32 mediante `overrides`.
- Validación de todos los datos de entrada con zod y consultas parametrizadas (sin concatenar SQL).
- Autorización de tratamiento de datos obligatoria para registrar personas, voluntarios y donantes (Ley 1581 de 2012).
- La clave `JWT_SECRET` está en `.env.local`, que **no** se sube al repositorio.

## Limitaciones conocidas

- La **pasarela de pagos es una simulación en modo de pruebas**: no se hacen cobros reales. El cobro real depende de la
  vinculación comercial de la fundación con un proveedor de pagos.
- La lectura de QR con la cámara usa la API `BarcodeDetector` del navegador (Chrome o Edge). Si no está disponible, se puede escribir el código del carné.
- La base PGlite es para la demostración en un solo equipo. Para producción se recomienda Supabase (PostgreSQL administrado con
  copias de respaldo automáticas, RNF-04), usando `db/schema.sql`.
- La foto del portal muestra los rostros pixelados para proteger la identidad de las personas atendidas (Ley 1581 de 2012),
  en especial la de un menor de edad. Solo debe reemplazarse por la original si existe autorización escrita de todas las personas.
