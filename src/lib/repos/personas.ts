import { z } from "zod";
import type { Db } from "@/lib/db";
import { ErrorDeNegocio } from "@/lib/errores";
import { textoOpcional } from "@/lib/validacion";

export const TIPOS_DOCUMENTO = ["CC", "TI", "CE", "PA", "PPT", "NIT", "SD"] as const;
export const TIPOS_PERSONA = ["visitante", "voluntario", "donante", "beneficiario"] as const;

export type Persona = {
  id: number;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  tipo: string;
  telefono: string | null;
  email: string | null;
  codigo_qr: string;
};

export const esquemaPersona = z.object({
  tipo_documento: z.enum(TIPOS_DOCUMENTO, { message: "Tipo de documento inválido" }),
  numero_documento: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{3,20}$/, "Número de documento inválido (solo letras, números y guiones; 3 a 20 caracteres)"),
  nombres: z.string().trim().min(2, "Escriba los nombres").max(80),
  apellidos: z.string().trim().max(80).default(""),
  tipo: z.enum(TIPOS_PERSONA, { message: "Tipo de persona inválido" }),
  telefono: textoOpcional(20),
  email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().email("Correo inválido").max(160).optional()),
  consentimiento: z.literal(true, { message: "Se requiere la autorización de la persona para el tratamiento de sus datos (Ley 1581 de 2012)" }),
});

const COLUMNAS = `id, tipo_documento, numero_documento, nombres, apellidos, tipo, telefono, email, codigo_qr`;

export async function crearPersona(db: Db, datos: z.input<typeof esquemaPersona>): Promise<Persona> {
  const d = esquemaPersona.parse(datos);
  const dup = await db.query(`select 1 from personas where tipo_documento = $1 and numero_documento = $2`, [d.tipo_documento, d.numero_documento]);
  if (dup.rows.length) throw new ErrorDeNegocio("Ya existe una persona con ese documento", 409);
  const r = await db.query<Persona>(
    `insert into personas (tipo_documento, numero_documento, nombres, apellidos, tipo, telefono, email, consentimiento_datos)
     values ($1,$2,$3,$4,$5,$6,$7,true) returning ${COLUMNAS}`,
    [d.tipo_documento, d.numero_documento, d.nombres, d.apellidos, d.tipo, d.telefono ?? null, d.email ?? null],
  );
  return r.rows[0];
}

export async function buscarPersona(db: Db, criterio: { documento?: string; codigoQr?: string }): Promise<Persona | null> {
  const doc = criterio.documento?.trim();
  const qr = criterio.codigoQr?.trim().toUpperCase();
  if (!doc && !qr) return null;
  const r = qr
    ? await db.query<Persona>(`select ${COLUMNAS} from personas where codigo_qr = $1`, [qr])
    : await db.query<Persona>(`select ${COLUMNAS} from personas where numero_documento = $1 order by id limit 1`, [doc]);
  return r.rows[0] ?? null;
}

export async function obtenerPersona(db: Db, id: number): Promise<Persona | null> {
  const r = await db.query<Persona>(`select ${COLUMNAS} from personas where id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function listarPersonas(db: Db, tipo?: string): Promise<Persona[]> {
  const r = tipo
    ? await db.query<Persona>(`select ${COLUMNAS} from personas where tipo = $1 order by nombres, apellidos`, [tipo])
    : await db.query<Persona>(`select ${COLUMNAS} from personas order by nombres, apellidos`);
  return r.rows;
}
