import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { registrarEntrada } from "@/lib/repos/visitas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = manejar(async (req: NextRequest) => {
  const s = await requerirSesion(["recepcionista"]);
  const r = await registrarEntrada(await getDb(), (await leerJson(req)) as never, Number(s.sub));
  return ok({ visita_id: r.visita.id, persona: `${r.persona.nombres} ${r.persona.apellidos}`.trim() }, 201);
});
