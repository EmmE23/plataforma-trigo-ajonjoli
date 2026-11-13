import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { ErrorDeNegocio } from "@/lib/errores";

const voluntarioSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre completo").max(160),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(160),
  telefono: z.string().trim().max(40).optional(),
  mensaje: z.string().trim().max(2000).optional(),
  consentimiento: z.literal(true, { error: "Debes autorizar el tratamiento de tus datos personales" }),
});
const donacionSchema = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre").max(160),
  email: z.string().trim().toLowerCase().email("Escribe un correo válido").max(160),
  monto_cop: z.number().int("El monto debe ser un número entero").min(1000, "El monto mínimo es $1.000 COP").max(50_000_000, "El monto máximo es $50.000.000 COP"),
  consentimiento: z.literal(true, { error: "Debes autorizar el tratamiento de tus datos personales" }),
  resultado: z.enum(["aprobar", "rechazar"]),
});

export async function registrarVoluntario(db: Db, datos: unknown): Promise<{ id: number }> {
  const d = voluntarioSchema.parse(datos);
  const r = await db.query<{ id: number }>(
    `insert into solicitudes_voluntariado (nombre,email,telefono,mensaje,consentimiento_datos) values ($1,$2,$3,$4,$5) returning id`,
    [d.nombre, d.email, d.telefono || null, d.mensaje || null, d.consentimiento],
  );
  return { id: r.rows[0].id };
}

export async function registrarDonacionPrueba(db: Db, datos: unknown): Promise<{ referencia: string; estado: "aprobada" | "rechazada"; monto_cop: number }> {
  const d = donacionSchema.parse(datos);
  const referencia = `PRUEBA-${randomUUID()}`;
  const estado = d.resultado === "aprobar" ? "aprobada" : "rechazada";
  await db.query(
    `insert into donaciones_dinero (nombre_donante,email,monto_cop,estado,referencia_pasarela,modo_prueba,consentimiento_datos) values ($1,$2,$3,$4,$5,true,$6)`,
    [d.nombre, d.email, d.monto_cop, estado, referencia, d.consentimiento],
  );
  return { referencia, estado, monto_cop: d.monto_cop };
}

export const RUTAS_PORTAL = ["/", "/donar"];

export async function registrarVisitaPortal(db: Db, ruta: string): Promise<void> {
  // Solo se cuentan las páginas reales del portal (evita llenar los reportes con rutas inventadas).
  if (typeof ruta !== "string" || !RUTAS_PORTAL.includes(ruta)) throw new ErrorDeNegocio("Ruta de visita inválida");
  await db.query(`insert into analitica_visitas (ruta) values ($1)`, [ruta]);
}

export async function resumenAnalitica(db: Db, dias = 30): Promise<{ total: number; porRuta: { ruta: string; total: number }[] }> {
  const periodo = z.number().int().min(1).max(365).parse(dias);
  const [total, rutas] = await Promise.all([
    db.query<{ total: number }>(`select count(*)::int as total from analitica_visitas where creado_en >= now() - ($1::int * interval '1 day')`, [periodo]),
    db.query<{ ruta: string; total: number }>(`select ruta, count(*)::int as total from analitica_visitas where creado_en >= now() - ($1::int * interval '1 day') group by ruta order by ruta`, [periodo]),
  ]);
  return { total: total.rows[0].total, porRuta: rutas.rows };
}

export async function necesidadesActuales(db: Db): Promise<string[]> {
  const r = await db.query<{ nombre: string }>(`select nombre from v_alertas_stock order by nombre`);
  return r.rows.map((fila) => fila.nombre);
}
