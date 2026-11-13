import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { registrarEntradaLote } from "@/lib/repos/inventario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RF-03: registra un donativo como lote nuevo. */
export const POST = manejar(async (req: NextRequest) => {
  const s = await requerirSesion(["almacenista"]);
  const r = await registrarEntradaLote(await getDb(), (await leerJson(req)) as never, Number(s.sub));
  return ok(r.lote, 201);
});
