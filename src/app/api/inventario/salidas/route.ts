import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { registrarSalidaLote, registrarSalidaPeps } from "@/lib/repos/inventario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RF-04: salida o merma. Si se indica `lote_id` se descuenta de ese lote;
 * si se indica `item_id` se aplica el orden PEPS automáticamente (RF-07).
 */
export const POST = manejar(async (req: NextRequest) => {
  const s = await requerirSesion(["almacenista"]);
  const db = await getDb();
  const cuerpo = (await leerJson(req)) as Record<string, unknown>;
  if (cuerpo.lote_id) {
    await registrarSalidaLote(db, cuerpo as never, Number(s.sub));
    return ok({ aplicados: [{ lote_id: Number(cuerpo.lote_id), cantidad: Number(cuerpo.cantidad) }] }, 201);
  }
  const aplicados = await registrarSalidaPeps(db, cuerpo as never, Number(s.sub));
  return ok({ aplicados }, 201);
});
