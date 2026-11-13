import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { manejar, ok, requerirSesion } from "@/lib/api";
import { registrarSalida } from "@/lib/repos/visitas";
import { idEntero } from "@/lib/validacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = manejar(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requerirSesion(["recepcionista"]);
  const id = idEntero.parse((await ctx.params).id);
  return ok(await registrarSalida(await getDb(), id));
});
