import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { manejar, leerJson, limitarPublico, ok } from "@/lib/api";
import { registrarVoluntario } from "@/lib/repos/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ruta pública: inscripción de voluntarios (máximo 20 solicitudes cada 10 minutos por origen). */
export const POST = manejar(async (req: NextRequest) => {
  limitarPublico(req, "voluntariado", 20, 10 * 60_000);
  return ok(await registrarVoluntario(await getDb(), await leerJson(req)), 201);
});
