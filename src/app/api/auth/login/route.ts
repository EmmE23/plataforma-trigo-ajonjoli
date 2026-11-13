import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { COOKIE_SESION, DURACION_SESION_SEG, firmarToken, rutaInicio } from "@/lib/auth";
import { autenticar } from "@/lib/repos/usuarios";
import { limitadorIngreso, limitadorNombrado } from "@/lib/limitador";
import { ipDe, leerJson, manejar } from "@/lib/api";
import { ErrorDeNegocio } from "@/lib/errores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUINCE_MIN = 15 * 60_000;

export const POST = manejar(async (req: NextRequest) => {
  const cuerpo = (await leerJson(req)) as { email?: string; password?: string };
  const email = String(cuerpo.email ?? "").trim().toLowerCase();
  // Dos límites: 5 fallos por cuenta (fuerza bruta a un usuario) y 50 por IP (ataque a muchas cuentas).
  const porCuenta = limitadorIngreso();
  const porIp = limitadorNombrado("ingreso-ip", 50, QUINCE_MIN);
  const claveCuenta = `cuenta:${email}`;
  const claveIp = `ip:${ipDe(req)}`;
  if (!porCuenta.permitido(claveCuenta) || !porIp.permitido(claveIp)) {
    throw new ErrorDeNegocio("Demasiados intentos fallidos. Espere 15 minutos e intente de nuevo.", 429);
  }
  const usuario = await autenticar(await getDb(), email, String(cuerpo.password ?? ""));
  if (!usuario) {
    porCuenta.registrarFallo(claveCuenta);
    porIp.registrarFallo(claveIp);
    throw new ErrorDeNegocio("Correo o contraseña incorrectos", 401);
  }
  porCuenta.reiniciar(claveCuenta);

  const token = await firmarToken({ sub: String(usuario.id), nombre: usuario.nombre, rol: usuario.rol });
  const res = NextResponse.json({ ok: true, datos: { nombre: usuario.nombre, rol: usuario.rol, destino: rutaInicio(usuario.rol) } });
  res.cookies.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: DURACION_SESION_SEG,
  });
  return res;
});
