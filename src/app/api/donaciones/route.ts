import { type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { manejar, leerJson, limitarPublico, ok } from "@/lib/api";
import { registrarDonacionPrueba } from "@/lib/repos/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ruta pública: donación simulada en modo de pruebas (máximo 30 cada 10 minutos por origen). */
export const POST = manejar(async (req: NextRequest) => {
  limitarPublico(req, "donaciones", 30, 10 * 60_000);
  return ok(await registrarDonacionPrueba(await getDb(), await leerJson(req)), 201);
});
