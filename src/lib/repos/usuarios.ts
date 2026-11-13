import { z } from "zod";
import type { Db } from "@/lib/db";
import { ROLES, type Rol } from "@/lib/auth";
import { cifrarPassword, verificarPassword, hashFicticio_ } from "@/lib/password";
import { ErrorDeNegocio } from "@/lib/errores";

export type Usuario = { id: number; nombre: string; email: string; rol: Rol; activo: boolean; creado_en: string };

export const esquemaUsuario = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(160),
  password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(128),
  rol: z.enum(ROLES, { message: "Rol inválido" }),
});

export async function crearUsuario(db: Db, datos: z.input<typeof esquemaUsuario>): Promise<Usuario> {
  const d = esquemaUsuario.parse(datos);
  const existe = await db.query(`select 1 from perfiles where email = $1`, [d.email]);
  if (existe.rows.length) throw new ErrorDeNegocio("Ya existe un usuario con ese correo", 409);
  const hash = await cifrarPassword(d.password);
  const r = await db.query<Usuario>(
    `insert into perfiles (nombre, email, password_hash, rol) values ($1,$2,$3,$4)
     returning id, nombre, email, rol, activo, creado_en`,
    [d.nombre, d.email, hash, d.rol],
  );
  return r.rows[0];
}

export async function autenticar(db: Db, email: string, password: string): Promise<Usuario | null> {
  const r = await db.query<Usuario & { password_hash: string }>(
    `select id, nombre, email, rol, activo, creado_en, password_hash from perfiles where email = $1`,
    [String(email ?? "").trim().toLowerCase()],
  );
  const u = r.rows[0];
  const ok = await verificarPassword(String(password ?? ""), u?.password_hash ?? hashFicticio_());
  if (!u || !ok || !u.activo) return null;
  const { password_hash: _omitido, ...publico } = u;
  return publico;
}

export async function listarUsuarios(db: Db): Promise<Usuario[]> {
  const r = await db.query<Usuario>(`select id, nombre, email, rol, activo, creado_en from perfiles order by nombre`);
  return r.rows;
}

/** El administrador asigna una contraseña nueva (flujo "¿Olvidó su contraseña?"). */
export async function restablecerPassword(db: Db, id: number, password: string): Promise<void> {
  const p = esquemaUsuario.shape.password.parse(password);
  const r = await db.query(`update perfiles set password_hash = $2 where id = $1`, [id, await cifrarPassword(p)]);
  if (!r.affectedRows) throw new ErrorDeNegocio("Usuario no encontrado", 404);
}

/** Indica si el perfil existe y sigue activo (se consulta en cada sesión para revocar el acceso al desactivar). */
export async function perfilActivo(db: Db, id: number): Promise<boolean> {
  const r = await db.query<{ activo: boolean }>(`select activo from perfiles where id = $1`, [id]);
  return r.rows[0]?.activo === true;
}

export async function cambiarEstadoUsuario(db: Db, id: number, activo: boolean): Promise<void> {
  const r = await db.query(`update perfiles set activo = $2 where id = $1`, [id, activo]);
  if (!r.affectedRows) throw new ErrorDeNegocio("Usuario no encontrado", 404);
}
