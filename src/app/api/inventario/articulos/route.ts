import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { crearArticulo, crearCategoria } from "@/lib/repos/inventario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Crea un artículo; si viene `categoria_nueva` crea primero la categoría. */
export const POST = manejar(async (req: NextRequest) => {
  await requerirSesion(["almacenista"]);
  const db = await getDb();
  const c = (await leerJson(req)) as Record<string, unknown>;
  let categoriaId = c.categoria_id;
  if (typeof c.categoria_nueva === "string" && c.categoria_nueva.trim()) {
    categoriaId = (await crearCategoria(db, c.categoria_nueva)).id;
  }
  const r = await crearArticulo(db, { ...c, categoria_id: categoriaId } as never);
  return ok(r, 201);
});
