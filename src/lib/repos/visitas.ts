import { z } from "zod";
import type { Db } from "@/lib/db";
import { ErrorDeNegocio } from "@/lib/errores";
import { buscarPersona, type Persona } from "@/lib/repos/personas";

export type Visita = { id: number; persona_id: number; motivo: string; hora_entrada: Date; hora_salida: Date | null };

export type FilaVisita = {
  id: number;
  persona_id: number;
  nombre: string;
  documento: string;
  motivo: string;
  hora_entrada: string;
  hora_salida: string | null;
  permanencia_min: number;
};

export const esquemaEntrada = z
  .object({
    documento: z.string().trim().max(20).optional(),
    codigoQr: z.string().trim().max(20).optional(),
    motivo: z.string().trim().min(2, "Indique el motivo de la visita").max(120),
  })
  .refine((d) => !!(d.documento || d.codigoQr), { message: "Escriba el documento o escanee el código QR" });

export async function registrarEntrada(
  db: Db,
  datos: z.input<typeof esquemaEntrada>,
  perfilId: number,
): Promise<{ visita: Visita; persona: Persona }> {
  const d = esquemaEntrada.parse(datos);
  const persona = await buscarPersona(db, { documento: d.documento, codigoQr: d.codigoQr });
  if (!persona) throw new ErrorDeNegocio("La persona no está registrada. Complete el formulario de registro.", 404);

  const abierta = await db.query(`select 1 from visitas where persona_id = $1 and hora_salida is null`, [persona.id]);
  if (abierta.rows.length) throw new ErrorDeNegocio(`${persona.nombres} ya tiene una visita abierta`, 409);

  const r = await db.query<Visita>(
    `insert into visitas (persona_id, motivo, registrada_por) values ($1,$2,$3)
     returning id, persona_id, motivo, hora_entrada, hora_salida`,
    [persona.id, d.motivo, perfilId],
  );
  return { visita: r.rows[0], persona };
}

export async function registrarSalida(db: Db, visitaId: number): Promise<{ id: number; permanencia_min: number }> {
  const r = await db.query<{ id: number; permanencia_min: number }>(
    `update visitas set hora_salida = now()
      where id = $1 and hora_salida is null
      returning id, floor(extract(epoch from (hora_salida - hora_entrada)) / 60)::int as permanencia_min`,
    [visitaId],
  );
  if (r.rows[0]) return r.rows[0];
  const existe = await db.query(`select 1 from visitas where id = $1`, [visitaId]);
  if (!existe.rows.length) throw new ErrorDeNegocio("Visita no encontrada", 404);
  throw new ErrorDeNegocio("La visita ya tiene salida registrada", 409);
}

/** Visitas del día (zona horaria de Colombia) más las que siguen abiertas de días anteriores. */
export async function visitasDeHoy(db: Db): Promise<FilaVisita[]> {
  const r = await db.query<FilaVisita>(
    `select v.id, v.persona_id,
            trim(p.nombres || ' ' || p.apellidos) as nombre,
            p.tipo_documento || ' ' || p.numero_documento as documento,
            v.motivo,
            to_char(v.hora_entrada, 'HH24:MI') as hora_entrada,
            to_char(v.hora_salida, 'HH24:MI') as hora_salida,
            floor(extract(epoch from (coalesce(v.hora_salida, now()) - v.hora_entrada)) / 60)::int as permanencia_min
       from visitas v join personas p on p.id = v.persona_id
      where v.hora_entrada::date = current_date or v.hora_salida is null
      order by v.hora_salida is not null, v.hora_entrada desc`,
  );
  return r.rows;
}

export async function aforoActual(db: Db): Promise<number> {
  const r = await db.query<{ personas_dentro: number }>(`select personas_dentro from v_aforo_actual`);
  return Number(r.rows[0]?.personas_dentro ?? 0);
}
