import { z } from "zod";
import type { Db } from "@/lib/db";
import { fechaISO } from "@/lib/validacion";
import { libroMovimientos } from "@/lib/repos/inventario";
import { aforoActual } from "@/lib/repos/visitas";

export const esquemaPeriodo = z
  .object({ desde: fechaISO, hasta: fechaISO })
  .refine((p) => p.desde <= p.hasta, { message: "El periodo es inválido: la fecha inicial debe ser anterior o igual a la final" });

export type Periodo = z.infer<typeof esquemaPeriodo>;

/** RF-10: entradas, salidas y mermas por periodo. */
export async function reporteMovimientos(db: Db, periodo: z.input<typeof esquemaPeriodo>) {
  const p = esquemaPeriodo.parse(periodo);
  const filtro = `m.creado_en >= $1::date and m.creado_en < $2::date + 1`;
  const totales = await db.query<{ entradas: number; salidas: number; mermas: number }>(
    `select coalesce(sum(cantidad) filter (where tipo='entrada'),0)::int as entradas,
            coalesce(sum(cantidad) filter (where tipo='salida'),0)::int as salidas,
            coalesce(sum(cantidad) filter (where tipo='merma'),0)::int as mermas
       from movimientos_inventario m where ${filtro}`,
    [p.desde, p.hasta],
  );
  const porArticulo = await db.query<{ item: string; entradas: number; salidas: number; mermas: number }>(
    `select i.nombre as item,
            coalesce(sum(m.cantidad) filter (where m.tipo='entrada'),0)::int as entradas,
            coalesce(sum(m.cantidad) filter (where m.tipo='salida'),0)::int as salidas,
            coalesce(sum(m.cantidad) filter (where m.tipo='merma'),0)::int as mermas
       from movimientos_inventario m join lotes l on l.id = m.lote_id join items i on i.id = l.item_id
      where ${filtro}
      group by i.nombre order by i.nombre`,
    [p.desde, p.hasta],
  );
  const detalle = await libroMovimientos(db, { desde: p.desde, hasta: p.hasta, limite: 1000 });
  return { periodo: p, totales: totales.rows[0], porArticulo: porArticulo.rows, detalle };
}

export async function reporteVisitas(db: Db, periodo: z.input<typeof esquemaPeriodo>) {
  const p = esquemaPeriodo.parse(periodo);
  const r = await db.query<{ dia: string; total: number; permanencia_promedio_min: number | null }>(
    `select to_char(hora_entrada::date, 'YYYY-MM-DD') as dia, count(*)::int as total,
            round(avg(extract(epoch from (hora_salida - hora_entrada)) / 60))::int as permanencia_promedio_min
       from visitas
      where hora_entrada >= $1::date and hora_entrada < $2::date + 1
      group by hora_entrada::date order by dia`,
    [p.desde, p.hasta],
  );
  const total = r.rows.reduce((s, x) => s + x.total, 0);
  return { periodo: p, total, porDia: r.rows };
}

export async function resumenGeneral(db: Db) {
  const r = await db.query<{
    visitas_hoy: number;
    articulos_en_alerta: number;
    lotes_por_vencer: number;
    donaciones_mes: number;
    voluntarios_nuevos: number;
    visitas_portal_30d: number;
  }>(
    `select (select count(*)::int from visitas where hora_entrada::date = current_date) as visitas_hoy,
            (select count(*)::int from v_alertas_stock) as articulos_en_alerta,
            (select count(*)::int from v_lotes_por_vencer) as lotes_por_vencer,
            (select coalesce(sum(monto_cop),0)::bigint from donaciones_dinero
              where estado = 'aprobada' and date_trunc('month', creado_en) = date_trunc('month', now())) as donaciones_mes,
            (select count(*)::int from solicitudes_voluntariado where estado = 'nueva') as voluntarios_nuevos,
            (select count(*)::int from analitica_visitas where creado_en >= now() - interval '30 days') as visitas_portal_30d`,
  );
  const x = r.rows[0];
  return {
    aforo: await aforoActual(db),
    visitasHoy: x.visitas_hoy,
    articulosEnAlerta: x.articulos_en_alerta,
    lotesPorVencer: x.lotes_por_vencer,
    donacionesMesCop: Number(x.donaciones_mes),
    voluntariosNuevos: x.voluntarios_nuevos,
    visitasPortal30d: x.visitas_portal_30d,
  };
}

export async function listarVoluntarios(db: Db) {
  return (
    await db.query<{ id: number; nombre: string; email: string; telefono: string | null; mensaje: string | null; estado: string; creado_en: string }>(
      `select id, nombre, email, telefono, mensaje, estado, to_char(creado_en,'YYYY-MM-DD HH24:MI') as creado_en
         from solicitudes_voluntariado order by creado_en desc limit 200`,
    )
  ).rows;
}

export async function listarDonaciones(db: Db) {
  return (
    await db.query<{ id: number; nombre_donante: string; email: string; monto_cop: string; estado: string; referencia_pasarela: string; creado_en: string }>(
      `select id, nombre_donante, email, monto_cop, estado, referencia_pasarela, to_char(creado_en,'YYYY-MM-DD HH24:MI') as creado_en
         from donaciones_dinero order by creado_en desc limit 200`,
    )
  ).rows;
}

/** Donaciones del usuario donante, buscadas por su correo. */
export async function donacionesDeDonante(db: Db, email: string) {
  return (
    await db.query<{ id: number; monto_cop: string; estado: string; referencia_pasarela: string; modo_prueba: boolean; creado_en: string }>(
      `select id, monto_cop, estado, referencia_pasarela, modo_prueba, to_char(creado_en,'YYYY-MM-DD HH24:MI') as creado_en
         from donaciones_dinero where lower(email) = lower($1) order by creado_en desc`,
      [email.trim()],
    )
  ).rows;
}
