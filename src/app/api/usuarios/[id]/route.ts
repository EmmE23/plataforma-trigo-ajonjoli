import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { cambiarEstadoUsuario, restablecerPassword } from "@/lib/repos/usuarios";
import { idEntero } from "@/lib/validacion";
import { ErrorDeNegocio } from "@/lib/errores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esquemaCambio = z
  .object({ activo: z.boolean().optional(), password: z.string().optional() })
  .refine((c) => c.activo !== undefined || c.password !== undefined, { message: "Indique el cambio a realizar" });

/** Activa/desactiva un usuario o le asigna una contraseña nueva. El administrador no puede desactivarse a sí mismo. */
export const PATCH = manejar(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const s = await requerirSesion(["administrador"]);
  const id = idEntero.parse((await ctx.params).id);
  const cambio = esquemaCambio.parse(await leerJson(req));
  const db = await getDb();
  if (cambio.activo !== undefined) {
    if (id === Number(s.sub) && !cambio.activo) throw new ErrorDeNegocio("No puede desactivar su propio usuario", 400);
    await cambiarEstadoUsuario(db, id, cambio.activo);
  }
  if (cambio.password !== undefined) await restablecerPassword(db, id, cambio.password);
  return ok({ id, activo: cambio.activo, passwordActualizada: cambio.password !== undefined });
});
