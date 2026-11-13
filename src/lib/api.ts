import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESION, verificarToken, type Rol, type Sesion } from "@/lib/auth";
import { ErrorDeNegocio, traducirError } from "@/lib/errores";
import { getDb } from "@/lib/db";
import { perfilActivo } from "@/lib/repos/usuarios";
import { limitadorNombrado } from "@/lib/limitador";

const MAX_CUERPO = 20_000; // 20 KB

/** Respuesta JSON de éxito. */
export const ok = <T>(datos: T, status = 200) => NextResponse.json({ ok: true, datos }, { status });

/** Envuelve un manejador de ruta: traduce errores a JSON en español sin filtrar detalles internos. */
export function manejar<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const err = traducirError(e);
      if (err.status >= 500) console.error("[api] error no controlado:", e);
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
  };
}

/**
 * Lee y valida la sesión JWT de la cookie (defensa en profundidad además del middleware).
 * También comprueba en la base de datos que el usuario siga activo: desactivar una cuenta revoca su acceso de inmediato.
 */
export async function sesionActual(): Promise<Sesion | null> {
  const c = await cookies();
  const s = await verificarToken(c.get(COOKIE_SESION)?.value);
  if (!s) return null;
  return (await perfilActivo(await getDb(), Number(s.sub))) ? s : null;
}

export async function requerirSesion(roles?: Rol[]): Promise<Sesion> {
  const s = await sesionActual();
  if (!s) throw new ErrorDeNegocio("Debe iniciar sesión", 401);
  if (roles && s.rol !== "administrador" && !roles.includes(s.rol)) {
    throw new ErrorDeNegocio("No tiene permiso para esta acción", 403);
  }
  return s;
}

/** Lee el cuerpo JSON de forma segura: rechaza cuerpos de más de 20 KB antes y después de leerlos. */
export async function leerJson(req: NextRequest | Request): Promise<unknown> {
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > MAX_CUERPO) throw new ErrorDeNegocio("Solicitud demasiado grande", 413);
  const texto = await req.text();
  if (texto.length > MAX_CUERPO) throw new ErrorDeNegocio("Solicitud demasiado grande", 413);
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    throw new ErrorDeNegocio("JSON inválido", 400);
  }
}

/**
 * IP del cliente. `X-Forwarded-For` solo es confiable detrás de un proxy propio (TRUST_PROXY=1);
 * sin proxy, el cliente podría falsificarla para evadir los límites, así que se ignora.
 */
export function ipDe(req: NextRequest | Request): string {
  if (process.env.TRUST_PROXY === "1") {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  }
  return "local";
}

/** Límite de peticiones para rutas públicas (protección contra abuso y llenado de la base). */
export function limitarPublico(req: NextRequest | Request, ruta: string, maximo: number, ventanaMs: number): void {
  if (!limitadorNombrado(ruta, maximo, ventanaMs).consumir(ipDe(req))) {
    throw new ErrorDeNegocio("Demasiadas solicitudes. Intente de nuevo en unos minutos.", 429);
  }
}
