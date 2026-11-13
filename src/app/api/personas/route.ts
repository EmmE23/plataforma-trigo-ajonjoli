import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { leerJson, manejar, ok, requerirSesion } from "@/lib/api";
import { buscarPersona, crearPersona } from "@/lib/repos/personas";
import { ErrorDeNegocio } from "@/lib/errores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Busca una persona por ?documento= o ?qr= */
export const GET = manejar(async (req: NextRequest) => {
  await requerirSesion(["recepcionista", "almacenista"]);
  const sp = req.nextUrl.searchParams;
  const p = await buscarPersona(await getDb(), { documento: sp.get("documento") ?? undefined, codigoQr: sp.get("qr") ?? undefined });
  if (!p) throw new ErrorDeNegocio("Persona no encontrada", 404);
  return ok(p);
});

/** Registra una persona nueva (con autorización de datos) y devuelve su carné QR. */
export const POST = manejar(async (req: NextRequest) => {
  await requerirSesion(["recepcionista", "almacenista"]);
  const p = await crearPersona(await getDb(), (await leerJson(req)) as never);
  const qr = await QRCode.toDataURL(p.codigo_qr, { margin: 1, width: 220 });
  return ok({ ...p, qr }, 201);
});
