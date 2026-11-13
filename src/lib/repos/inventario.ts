import { z } from "zod";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Db } from "@/lib/db";
import { ErrorDeNegocio } from "@/lib/errores";
import { cantidadEntera, fechaISO, idEntero, textoOpcional } from "@/lib/validacion";

type Consulta = Pick<PGlite | Transaction, "query">;

export type Lote = {
  id: number;
  item_id: number;
  donante_id: number | null;
  codigo: string;
  fecha_ingreso: string;
  fecha_vencimiento: string | null;
  cantidad_disponible: number;
};

export type Existencia = {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  estado: "OK" | "Stock bajo" | "Agotado";
};

export type MovimientoLibro = {
  id: number;
  creado_en: string;
  tipo: "entrada" | "salida" | "merma";
  cantidad: number;
  item: string;
  lote: string;
  beneficiario: string | null;
  destino: string | null;
  observacion: string | null;
  registrado_por: string;
};

const COLUMNAS_LOTE = `id, item_id, donante_id, codigo, to_char(fecha_ingreso,'YYYY-MM-DD') as fecha_ingreso,
  to_char(fecha_vencimiento,'YYYY-MM-DD') as fecha_vencimiento, cantidad_disponible`;

// ---------------------------------------------------------------- Catálogo

export async function crearCategoria(db: Db, nombre: string): Promise<{ id: number; nombre: string }> {
  const n = z.string().trim().min(2, "Nombre de categoría inválido").max(60).parse(nombre);
  const r = await db.query<{ id: number; nombre: string }>(
    `insert into categorias (nombre) values ($1) on conflict (nombre) do update set nombre = excluded.nombre returning id, nombre`,
    [n],
  );
  return r.rows[0];
}

export async function listarCategorias(db: Db) {
  return (await db.query<{ id: number; nombre: string }>(`select id, nombre from categorias order by nombre`)).rows;
}

export const esquemaArticulo = z.object({
  categoria_id: idEntero,
  nombre: z.string().trim().min(2, "Escriba el nombre del artículo").max(80),
  unidad: z.string().trim().min(1).max(20).default("unidad"),
  stock_minimo: z.coerce.number().int().min(0, "El stock mínimo no puede ser negativo").max(100_000),
});

export async function crearArticulo(db: Db, datos: z.input<typeof esquemaArticulo>) {
  const d = esquemaArticulo.parse(datos);
  const r = await db.query<{ id: number }>(
    `insert into items (categoria_id, nombre, unidad, stock_minimo) values ($1,$2,$3,$4) returning id`,
    [d.categoria_id, d.nombre, d.unidad, d.stock_minimo],
  );
  return r.rows[0];
}

// ---------------------------------------------------------------- Movimientos

export const esquemaEntradaLote = z.object({
  item_id: idEntero,
  cantidad: cantidadEntera,
  fecha_vencimiento: z.preprocess((v) => (v === "" ? undefined : v), fechaISO.optional()),
  fecha_ingreso: z.preprocess((v) => (v === "" ? undefined : v), fechaISO.optional()),
  donante_id: z.preprocess((v) => (v === "" || v === null ? undefined : v), idEntero.optional()),
  observacion: textoOpcional(200),
});

/** Registra un donativo: crea el lote (código automático L-AAAAMMDD-NNN) y su movimiento de entrada en una transacción. */
export async function registrarEntradaLote(db: Db, datos: z.input<typeof esquemaEntradaLote>, perfilId: number) {
  const d = esquemaEntradaLote.parse(datos);
  return db.transaction(async (tx) => {
    const item = await tx.query(`select 1 from items where id = $1`, [d.item_id]);
    if (!item.rows.length) throw new ErrorDeNegocio("El artículo no existe", 404);

    // Bloqueo transaccional: dos entradas simultáneas (p. ej. en Supabase con varias conexiones) no pueden
    // calcular el mismo consecutivo. El número siguiente sale del máximo existente, no del conteo.
    await tx.query(`select pg_advisory_xact_lock(4172026)`);
    const pref = await tx.query<{ prefijo: string; n: number }>(
      `with p as (select 'L-' || to_char(coalesce($1::date, current_date), 'YYYYMMDD') as prefijo)
       select p.prefijo,
              coalesce((select max(substring(codigo from '-(\\d+)$')::int) from lotes where codigo like p.prefijo || '-%'), 0) as n
         from p`,
      [d.fecha_ingreso ?? null],
    );
    const codigo = `${pref.rows[0].prefijo}-${String(pref.rows[0].n + 1).padStart(3, "0")}`;

    const l = await tx.query<{ id: number }>(
      `insert into lotes (item_id, donante_id, codigo, fecha_ingreso, fecha_vencimiento)
       values ($1,$2,$3,coalesce($4::date, current_date),$5) returning id`,
      [d.item_id, d.donante_id ?? null, codigo, d.fecha_ingreso ?? null, d.fecha_vencimiento ?? null],
    );
    await tx.query(
      `insert into movimientos_inventario (lote_id, tipo, cantidad, observacion, registrado_por) values ($1,'entrada',$2,$3,$4)`,
      [l.rows[0].id, d.cantidad, d.observacion ?? null, perfilId],
    );
    const lote = await tx.query<Lote>(`select ${COLUMNAS_LOTE} from lotes where id = $1`, [l.rows[0].id]);
    return { lote: lote.rows[0] };
  });
}

const destinoRequerido = (d: { beneficiario_id?: number; destino?: string }) => !!(d.beneficiario_id || d.destino);
const MSJ_DESTINO = { message: "Indique el beneficiario o destino (para mermas, el motivo)" };

export const esquemaSalidaLote = z
  .object({
    lote_id: idEntero,
    tipo: z.enum(["salida", "merma"], { message: "Tipo de movimiento inválido" }),
    cantidad: cantidadEntera,
    beneficiario_id: z.preprocess((v) => (v === "" || v === null ? undefined : v), idEntero.optional()),
    destino: textoOpcional(120),
    observacion: textoOpcional(200),
  })
  .refine(destinoRequerido, MSJ_DESTINO);

async function insertarSalida(
  q: Consulta,
  d: { lote_id: number; tipo: "salida" | "merma"; cantidad: number; beneficiario_id?: number; destino?: string; observacion?: string },
  perfilId: number,
) {
  await q.query(
    `insert into movimientos_inventario (lote_id, tipo, cantidad, beneficiario_id, destino, observacion, registrado_por)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [d.lote_id, d.tipo, d.cantidad, d.beneficiario_id ?? null, d.destino ?? null, d.observacion ?? null, perfilId],
  );
}

/** Salida o merma de un lote concreto. El trigger de la base de datos bloquea si no hay existencias. */
export async function registrarSalidaLote(db: Db, datos: z.input<typeof esquemaSalidaLote>, perfilId: number) {
  const d = esquemaSalidaLote.parse(datos);
  await insertarSalida(db, d, perfilId);
}

export const esquemaSalidaPeps = z
  .object({
    item_id: idEntero,
    tipo: z.enum(["salida", "merma"]).default("salida"),
    cantidad: cantidadEntera,
    beneficiario_id: z.preprocess((v) => (v === "" || v === null ? undefined : v), idEntero.optional()),
    destino: textoOpcional(120),
    observacion: textoOpcional(200),
  })
  .refine(destinoRequerido, MSJ_DESTINO);

/**
 * Salida automática según PEPS (primero en entrar, primero en salir): descuenta de los lotes más antiguos
 * y reparte entre varios si hace falta. Todo o nada (transacción).
 */
export async function registrarSalidaPeps(db: Db, datos: z.input<typeof esquemaSalidaPeps>, perfilId: number) {
  const d = esquemaSalidaPeps.parse(datos);
  return db.transaction(async (tx) => {
    const lotes = await tx.query<{ id: number; codigo: string; cantidad_disponible: number; item: string }>(
      `select id, codigo, cantidad_disponible, item from v_lotes_peps where item_id = $1 order by orden_salida`,
      [d.item_id],
    );
    const total = lotes.rows.reduce((s, l) => s + l.cantidad_disponible, 0);
    if (total < d.cantidad) {
      throw new ErrorDeNegocio(`Stock insuficiente: hay ${total} unidades disponibles y se solicitaron ${d.cantidad}`, 409);
    }
    const aplicados: { lote_id: number; codigo: string; cantidad: number }[] = [];
    let pendiente = d.cantidad;
    for (const l of lotes.rows) {
      if (pendiente === 0) break;
      const tomar = Math.min(pendiente, l.cantidad_disponible);
      await insertarSalida(tx, { ...d, lote_id: l.id, cantidad: tomar }, perfilId);
      aplicados.push({ lote_id: l.id, codigo: l.codigo, cantidad: tomar });
      pendiente -= tomar;
    }
    return aplicados;
  });
}

// ---------------------------------------------------------------- Consultas

export async function existencias(db: Db): Promise<Existencia[]> {
  const r = await db.query<Existencia>(
    `select i.id, i.nombre, c.nombre as categoria, i.unidad, i.stock_actual, i.stock_minimo,
            case when i.stock_actual = 0 then 'Agotado' when i.stock_actual <= i.stock_minimo then 'Stock bajo' else 'OK' end as estado
       from items i join categorias c on c.id = i.categoria_id
      order by c.nombre, i.nombre`,
  );
  return r.rows;
}

export async function alertasStock(db: Db) {
  return (
    await db.query<{ id: number; nombre: string; categoria: string; stock_actual: number; stock_minimo: number }>(
      `select id, nombre, categoria, stock_actual, stock_minimo from v_alertas_stock order by stock_actual, nombre`,
    )
  ).rows;
}

export async function lotesPorVencer(db: Db) {
  return (
    await db.query<{ id: number; codigo: string; item: string; fecha_vencimiento: string; cantidad_disponible: number; dias_restantes: number }>(
      `select id, codigo, item, to_char(fecha_vencimiento,'YYYY-MM-DD') as fecha_vencimiento, cantidad_disponible, dias_restantes
         from v_lotes_por_vencer order by fecha_vencimiento`,
    )
  ).rows;
}

export async function ordenPeps(db: Db, itemId?: number) {
  const sql = `select id, codigo, item_id, item, to_char(fecha_ingreso,'YYYY-MM-DD') as fecha_ingreso,
                      to_char(fecha_vencimiento,'YYYY-MM-DD') as fecha_vencimiento, cantidad_disponible, orden_salida::int as orden_salida
                 from v_lotes_peps`;
  const r = itemId
    ? await db.query<{ id: number; codigo: string; item: string; fecha_ingreso: string; fecha_vencimiento: string | null; cantidad_disponible: number; orden_salida: number }>(
        `${sql} where item_id = $1 order by orden_salida`,
        [itemId],
      )
    : await db.query<{ id: number; codigo: string; item_id: number; item: string; fecha_ingreso: string; fecha_vencimiento: string | null; cantidad_disponible: number; orden_salida: number }>(
        `${sql} order by item, orden_salida`,
      );
  return r.rows;
}

export async function libroMovimientos(db: Db, opts: { limite?: number; desde?: string; hasta?: string } = {}): Promise<MovimientoLibro[]> {
  const limite = Math.min(Math.max(opts.limite ?? 50, 1), 1000);
  const r = await db.query<MovimientoLibro>(
    `select m.id, to_char(m.creado_en, 'YYYY-MM-DD HH24:MI') as creado_en, m.tipo, m.cantidad,
            i.nombre as item, l.codigo as lote,
            nullif(trim(coalesce(b.nombres,'') || ' ' || coalesce(b.apellidos,'')), '') as beneficiario,
            m.destino, m.observacion, p.nombre as registrado_por
       from movimientos_inventario m
       join lotes l on l.id = m.lote_id
       join items i on i.id = l.item_id
       join perfiles p on p.id = m.registrado_por
       left join personas b on b.id = m.beneficiario_id
      where ($1::date is null or m.creado_en >= $1::date)
        and ($2::date is null or m.creado_en < $2::date + 1)
      order by m.creado_en desc, m.id desc
      limit $3`,
    [opts.desde ?? null, opts.hasta ?? null, limite],
  );
  return r.rows;
}
