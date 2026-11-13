import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { manejar, ok, requerirSesion } from "@/lib/api";
import { reporteMovimientos } from "@/lib/repos/reportes";
import { aCsv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RF-10: GET /api/reportes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD[&formato=csv] */
export const GET = manejar(async (req: NextRequest) => {
  await requerirSesion(["almacenista"]);
  const sp = req.nextUrl.searchParams;
  const r = await reporteMovimientos(await getDb(), { desde: sp.get("desde") ?? "", hasta: sp.get("hasta") ?? "" });
  if (sp.get("formato") !== "csv") return ok(r);

  const csv = aCsv(
    ["Fecha", "Tipo", "Artículo", "Lote", "Cantidad", "Beneficiario", "Destino o motivo", "Registrado por"],
    r.detalle.map((m) => [m.creado_en, m.tipo, m.item, m.lote, m.cantidad, m.beneficiario, m.destino, m.registrado_por]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movimientos_${r.periodo.desde}_${r.periodo.hasta}.csv"`,
    },
  });
});
