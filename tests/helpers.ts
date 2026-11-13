import { crearBaseDeDatos, type Db } from "@/lib/db";

let plantilla: Promise<Db> | undefined;

/** Base PostgreSQL (PGlite) en memoria con el esquema aplicado; se clona de una plantilla para ser rápida y aislada. */
export async function dbDePrueba(): Promise<Db> {
  plantilla ??= crearBaseDeDatos();
  const db = (await (await plantilla).clone()) as Db;
  await db.exec(`set time zone 'America/Bogota'`);
  return db;
}

export async function crearPerfil(db: Db, rol = "almacenista", email = `${rol}@prueba.org`) {
  const r = await db.query<{ id: number }>(
    `insert into perfiles (nombre, email, password_hash, rol) values ($1,$2,'x',$3) returning id`,
    [`Usuario ${rol}`, email, rol],
  );
  return r.rows[0].id;
}

export async function crearPersona(db: Db, documento = "1000000001", tipo = "visitante") {
  const r = await db.query<{ id: number }>(
    `insert into personas (tipo_documento, numero_documento, nombres, apellidos, tipo, consentimiento_datos)
     values ('CC',$1,'Ana','Pérez',$2,true) returning id`,
    [documento, tipo],
  );
  return r.rows[0].id;
}

export async function crearItem(db: Db, nombre = "Camiseta adulto", minimo = 30) {
  const c = await db.query<{ id: number }>(
    `insert into categorias (nombre) values ('Ropa') on conflict (nombre) do update set nombre = excluded.nombre returning id`,
  );
  const r = await db.query<{ id: number }>(
    `insert into items (categoria_id, nombre, stock_minimo) values ($1,$2,$3) returning id`,
    [c.rows[0].id, nombre, minimo],
  );
  return r.rows[0].id;
}

export async function crearLote(db: Db, itemId: number, codigo: string, ingreso = "2026-10-01", vence: string | null = null) {
  const r = await db.query<{ id: number }>(
    `insert into lotes (item_id, codigo, fecha_ingreso, fecha_vencimiento) values ($1,$2,$3,$4) returning id`,
    [itemId, codigo, ingreso, vence],
  );
  return r.rows[0].id;
}

export async function mover(db: Db, loteId: number, tipo: string, cantidad: number, perfilId: number, destino: string | null = "Jornada Soacha") {
  await db.query(
    `insert into movimientos_inventario (lote_id, tipo, cantidad, destino, registrado_por) values ($1,$2,$3,$4,$5)`,
    [loteId, tipo, cantidad, tipo === "entrada" ? null : destino, perfilId],
  );
}

export async function stockItem(db: Db, itemId: number) {
  const r = await db.query<{ stock_actual: number }>(`select stock_actual from items where id = $1`, [itemId]);
  return r.rows[0].stock_actual;
}
