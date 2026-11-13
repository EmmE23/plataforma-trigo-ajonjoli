import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { crearUsuario } from "@/lib/repos/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = manejar(async (req: NextRequest) => {
  await requerirSesion(["administrador"]);
  const u = await crearUsuario(await getDb(), (await leerJson(req)) as never);
  return ok(u, 201);
});
