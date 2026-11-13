// Prepara la aplicación para la demostración local:
//   npm run setup   → crea .env.local (si no existe) y la base con datos de ejemplo (si está vacía)
//   npm run seed    → borra SOLO la base local de la demo (carpeta data/pgdata) y la vuelve a crear con datos de ejemplo
// IMPORTANTE: detenga el servidor (Ctrl + C) antes de ejecutar estos comandos.
import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const reset = process.argv.includes("--reset");
// DATA_DIR permite usar otra base (por ejemplo, la de las pruebas E2E) sin tocar la de la demo.
const dirDatos = process.env.DATA_DIR ? path.resolve(raiz, process.env.DATA_DIR) : path.join(raiz, "data", "pgdata");
const relativo = path.relative(path.join(raiz, "data"), dirDatos);
if (!relativo || relativo.startsWith("..") || path.isAbsolute(relativo)) {
  console.error("DATA_DIR debe estar dentro de la carpeta data/ del proyecto");
  process.exit(1);
}

// 1) Clave secreta para firmar los JWT (nunca se sube a GitHub: .env.local está en .gitignore)
const env = path.join(raiz, ".env.local");
if (!existsSync(env)) {
  writeFileSync(env, `JWT_SECRET=${randomBytes(48).toString("base64url")}\n`, "utf8");
  console.log("[OK] Se creó .env.local con una clave JWT aleatoria");
}

// 2) Base de datos local
if (reset && existsSync(dirDatos)) {
  rmSync(dirDatos, { recursive: true, force: true });
  console.log("[OK] Base de datos local reiniciada");
}
mkdirSync(path.dirname(dirDatos), { recursive: true });
const db = new PGlite(dirDatos);
await db.waitReady;
await db.exec(`set time zone 'America/Bogota'`);
await db.exec(readFileSync(path.join(raiz, "db", "schema.sql"), "utf8"));

const { rows } = await db.query(`select count(*)::int as n from perfiles`);
if (rows[0].n > 0) {
  console.log("[OK] La base ya tiene datos. Use 'npm run seed' para reiniciarla con los datos de ejemplo.");
  await db.close();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------
// DATOS DE EJEMPLO (FICTICIOS): nombres, documentos y correos inventados solo para la demostración.
// Las categorías y los stocks mínimos son ejemplos; la fundación debe validarlos (dato pendiente).
// ---------------------------------------------------------------------------------------------
const USUARIOS_DEMO = [
  { nombre: "Administración Fundación", email: "admin@trigoyajonjoli.org", password: "Admin-Trigo-2026", rol: "administrador" },
  { nombre: "Laura Gómez", email: "recepcion@trigoyajonjoli.org", password: "Recepcion-2026", rol: "recepcionista" },
  { nombre: "Andrés Castillo", email: "almacen@trigoyajonjoli.org", password: "Almacen-2026!", rol: "almacenista" },
  { nombre: "Marta Ruiz", email: "donante@correo-ejemplo.co", password: "Donante-2026!", rol: "donante" },
];

/** Fecha (AAAA-MM-DD) a `dias` de hoy, en hora de Colombia. */
const fecha = (dias) => new Date(Date.now() + dias * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
/** Marca de tiempo en hora de Colombia. */
const marca = (dias, hora) => `${fecha(dias)} ${hora}:00-05`;

const ids = {};
for (const u of USUARIOS_DEMO) {
  const r = await db.query(`insert into perfiles (nombre,email,password_hash,rol) values ($1,$2,$3,$4) returning id`, [
    u.nombre, u.email, bcrypt.hashSync(u.password, 10), u.rol,
  ]);
  ids[u.rol] = r.rows[0].id;
}

const PERSONAS = [
  ["CC", "52418963", "María Teresa", "Rojas", "beneficiario", "3104567812"],
  ["CC", "80234517", "José Antonio", "Martínez", "beneficiario", null],
  ["CE", "4587123", "Yorman", "Pérez", "beneficiario", null],
  ["PPT", "6021458", "Daniela", "Hernández", "beneficiario", "3209876543"],
  ["SD", "SD-0001", "Luis", "(sin documento)", "beneficiario", null],
  ["CC", "1023456789", "Camila", "Suárez", "voluntario", "3001112233"],
  ["CC", "1012345678", "Sebastián", "Ortiz", "voluntario", "3157778899"],
  ["CC", "39785412", "Marta", "Ruiz", "donante", "3186665544", "donante@correo-ejemplo.co"],
  ["NIT", "900123456", "Panadería", "El Trigal", "donante", "6017234567"],
  ["CC", "79563214", "Hernando", "Vargas", "visitante", "3112223344"],
  ["CC", "1030555444", "Paola", "Cárdenas", "visitante", null],
];
const persona = {};
for (const [td, num, nom, ape, tipo, tel, email] of PERSONAS) {
  const r = await db.query(
    `insert into personas (tipo_documento,numero_documento,nombres,apellidos,tipo,telefono,email,consentimiento_datos)
     values ($1,$2,$3,$4,$5,$6,$7,true) returning id`,
    [td, num, nom, ape, tipo, tel, email ?? null],
  );
  persona[num] = r.rows[0].id;
}

const CATALOGO = {
  Ropa: [["Camiseta adulto", 30], ["Pantalón adulto", 20], ["Chaqueta", 15], ["Ropa infantil", 20]],
  Calzado: [["Zapatos adulto (par)", 15]],
  "Alimentos no perecederos": [["Arroz 500 g", 40], ["Lentejas 500 g", 30], ["Leche en polvo 400 g", 20], ["Panela", 25]],
  "Aseo personal": [["Jabón de baño", 40], ["Crema dental", 30], ["Toalla higiénica (paquete)", 20]],
  "Cobijas y toallas": [["Cobija", 25], ["Toalla", 15]],
  "Útiles escolares": [["Cuaderno", 30], ["Kit escolar", 10]],
};
const item = {};
for (const [cat, lista] of Object.entries(CATALOGO)) {
  const c = await db.query(`insert into categorias (nombre) values ($1) returning id`, [cat]);
  for (const [nombre, minimo] of lista) {
    const r = await db.query(`insert into items (categoria_id,nombre,stock_minimo) values ($1,$2,$3) returning id`, [c.rows[0].id, nombre, minimo]);
    item[nombre] = r.rows[0].id;
  }
}

let consecutivo = 0;
async function lote(nombreItem, cantidad, diasIngreso, vencimientoDias = null, donante = null) {
  consecutivo += 1;
  const ingreso = fecha(diasIngreso);
  const codigo = `L-${ingreso.replaceAll("-", "")}-${String(consecutivo).padStart(3, "0")}`;
  const l = await db.query(
    `insert into lotes (item_id,donante_id,codigo,fecha_ingreso,fecha_vencimiento) values ($1,$2,$3,$4,$5) returning id`,
    [item[nombreItem], donante, codigo, ingreso, vencimientoDias === null ? null : fecha(vencimientoDias)],
  );
  await db.query(
    `insert into movimientos_inventario (lote_id,tipo,cantidad,observacion,registrado_por,creado_en) values ($1,'entrada',$2,$3,$4,$5)`,
    [l.rows[0].id, cantidad, "Donativo recibido en bodega", ids.almacenista, marca(diasIngreso, "09:15")],
  );
  return l.rows[0].id;
}
async function salida(loteId, cantidad, dias, destino, beneficiario = null, tipo = "salida") {
  await db.query(
    `insert into movimientos_inventario (lote_id,tipo,cantidad,beneficiario_id,destino,registrado_por,creado_en) values ($1,$2,$3,$4,$5,$6,$7)`,
    [loteId, tipo, cantidad, beneficiario, destino, ids.almacenista, marca(dias, "05:30")],
  );
}

const donanteMarta = persona["39785412"];
const panaderia = persona["900123456"];

const camiseta1 = await lote("Camiseta adulto", 50, -40, null, donanteMarta);
await salida(camiseta1, 20, -33, "Jornada madrugada · Soacha centro");
await lote("Camiseta adulto", 25, -12);
await salida(camiseta1, 12, -5, "Jornada madrugada · Barrio Maipore");
const pantalon = await lote("Pantalón adulto", 30, -30);
await salida(pantalon, 18, -19, "Jornada madrugada · Bosa límites", persona["52418963"]);
const chaqueta = await lote("Chaqueta", 22, -25);
await salida(chaqueta, 10, -6, "Jornada madrugada · Soacha centro");
await lote("Ropa infantil", 35, -21);
const zapatos = await lote("Zapatos adulto (par)", 12, -18);
await salida(zapatos, 4, -4, "Entrega individual", persona["80234517"]);
const arroz1 = await lote("Arroz 500 g", 60, -35, 120, panaderia);
await salida(arroz1, 38, -20, "Mercados para familias · Maipore");
await lote("Arroz 500 g", 40, -8, 200, panaderia);
const lentejas = await lote("Lentejas 500 g", 24, -28, 18);
await salida(lentejas, 6, -10, "Mercados para familias · Maipore");
const leche = await lote("Leche en polvo 400 g", 20, -26, 9);
await salida(leche, 2, -3, "Producto con empaque roto", null, "merma");
await salida(leche, 6, -2, "Jornada madrugada · Soacha centro");
await lote("Panela", 30, -14, 25);
const jabon = await lote("Jabón de baño", 80, -32, 400);
await salida(jabon, 45, -15, "Kits de aseo · Jornada Bosa");
await lote("Crema dental", 18, -16, 300);
await lote("Toalla higiénica (paquete)", 30, -11, 500);
const cobija = await lote("Cobija", 40, -45);
await salida(cobija, 28, -9, "Jornada nocturna de frío · Soacha centro");
await lote("Toalla", 20, -20);
await lote("Cuaderno", 60, -38);
const kit = await lote("Kit escolar", 15, -37);
await salida(kit, 9, -24, "Entrega a niños de familias beneficiarias");

// Visitas de días anteriores (cerradas): [documento, motivo, días atrás, entrada, salida]
const historicas = [
  ["52418963", "Recibir ayuda", -6, "07:10", "07:55"],
  ["80234517", "Recibir ayuda", -4, "08:20", "09:05"],
  ["1023456789", "Voluntariado", -4, "06:00", "11:30"],
  ["900123456", "Donación de enseres", -8, "10:00", "10:40"],
  ["79563214", "Reunión", -2, "15:00", "16:10"],
  ["4587123", "Recibir ayuda", -1, "07:45", "08:15"],
];
for (const [doc, motivo, dias, entra, sale] of historicas) {
  await db.query(`insert into visitas (persona_id,motivo,hora_entrada,hora_salida,registrada_por) values ($1,$2,$3,$4,$5)`, [
    persona[doc], motivo, marca(dias, entra), marca(dias, sale), ids.recepcionista,
  ]);
}
// Visitas de hoy, relativas a la hora actual: [documento, motivo, minutos desde la entrada, minutos desde la salida | null]
const deHoy = [
  ["52418963", "Recibir ayuda", 150, 110],
  ["1012345678", "Voluntariado", 120, null],
  ["6021458", "Recibir ayuda", 45, null],
  ["1030555444", "Entrega de donativos", 15, null],
];
for (const [doc, motivo, minEntrada, minSalida] of deHoy) {
  await db.query(
    `insert into visitas (persona_id,motivo,hora_entrada,hora_salida,registrada_por)
     values ($1,$2, now() - ($3::int * interval '1 minute'), case when $4::int is null then null else now() - ($4::int * interval '1 minute') end, $5)`,
    [persona[doc], motivo, minEntrada, minSalida, ids.recepcionista],
  );
}

// Donaciones en dinero (MODO DE PRUEBAS: no hay cobros reales)
const donaciones = [
  ["Marta Ruiz", "donante@correo-ejemplo.co", 50000, "aprobada", -20],
  ["Marta Ruiz", "donante@correo-ejemplo.co", 30000, "aprobada", -3],
  ["Jorge Peña", "jorge.pena@correo-ejemplo.co", 100000, "aprobada", -10],
  ["Ana Lucía Torres", "ana.torres@correo-ejemplo.co", 20000, "rechazada", -7],
];
for (const [n, e, m, est, dias] of donaciones) {
  await db.query(
    `insert into donaciones_dinero (persona_id,nombre_donante,email,monto_cop,estado,referencia_pasarela,modo_prueba,consentimiento_datos,creado_en)
     values ($1,$2,$3,$4,$5,$6,true,true,$7)`,
    [e.startsWith("donante@") ? donanteMarta : null, n, e, m, est, `PRUEBA-DEMO-${randomBytes(6).toString("hex")}`, marca(dias, "19:30")],
  );
}

const voluntarios = [
  ["Natalia Bermúdez", "natalia.b@correo-ejemplo.co", "3014445566", "Puedo apoyar los sábados en la madrugada.", "nueva"],
  ["Felipe Ramírez", "felipe.r@correo-ejemplo.co", null, "Tengo carro y puedo ayudar a transportar donativos.", "contactada"],
  ["Lina Moreno", "lina.m@correo-ejemplo.co", "3125556677", null, "nueva"],
];
for (const [n, e, t, m, est] of voluntarios) {
  await db.query(
    `insert into solicitudes_voluntariado (nombre,email,telefono,mensaje,consentimiento_datos,estado) values ($1,$2,$3,$4,true,$5)`,
    [n, e, t, m, est],
  );
}

for (let i = 0; i < 46; i++) {
  await db.query(`insert into analitica_visitas (ruta,creado_en) values ($1, now() - ($2::int * interval '1 hour'))`, [
    i % 5 === 0 ? "/donar" : "/", i * 13,
  ]);
}

await db.close();
console.log("[OK] Datos de ejemplo cargados.");
console.log("\nUsuarios de demostración (contraseñas en README.md):");
for (const u of USUARIOS_DEMO) console.log(`  - ${u.rol.padEnd(14)} ${u.email}`);
