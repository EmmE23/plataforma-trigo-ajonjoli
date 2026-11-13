import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { manejar, leerJson, limitarPublico, ok } from "@/lib/api";
import { ErrorDeNegocio } from "@/lib/errores";
import { registrarVisitaPortal } from "@/lib/repos/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ruta pública: registra una visita al portal (solo rutas reales; máximo 120 por minuto por origen). */
export const POST = manejar(async (req: NextRequest) => {
  limitarPublico(req, "analitica", 120, 60_000);
  const cuerpo = await leerJson(req);
  if (typeof cuerpo !== "object" || cuerpo === null || !("ruta" in cuerpo) || typeof cuerpo.ruta !== "string") {
    throw new ErrorDeNegocio("Solicitud inválida");
  }
  await registrarVisitaPortal(await getDb(), cuerpo.ruta);
  // No se devuelven estadísticas: se consultan en el panel de Reportes.
  return ok(null, 201);
});
