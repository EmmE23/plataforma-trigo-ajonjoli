import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, puedeAcceder, verificarToken } from "@/lib/auth";

/** Rutas de la API que no requieren sesión (portal público e ingreso). */
const API_PUBLICAS = ["/api/auth/login", "/api/auth/logout", "/api/voluntariado", "/api/donaciones", "/api/analitica"];

const esPublica = (ruta: string) => API_PUBLICAS.some((p) => ruta === p || ruta.startsWith(p + "/"));

export async function middleware(req: NextRequest) {
  const ruta = req.nextUrl.pathname;
  const esApi = ruta.startsWith("/api/");

  // Protección CSRF: toda petición que modifica datos debe venir del mismo origen.
  if (esApi && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origen = req.headers.get("origin");
    let mismoOrigen = false;
    try {
      mismoOrigen = !!origen && new URL(origen).host === req.nextUrl.host;
    } catch {
      mismoOrigen = false;
    }
    if (!mismoOrigen) {
      return NextResponse.json({ ok: false, error: "Origen no permitido" }, { status: 403 });
    }
  }

  if (esApi && esPublica(ruta)) return NextResponse.next();

  const sesion = await verificarToken(req.cookies.get(COOKIE_SESION)?.value);
  if (!sesion) {
    if (esApi) return NextResponse.json({ ok: false, error: "Debe iniciar sesión" }, { status: 401 });
    const url = new URL("/ingreso", req.url);
    url.searchParams.set("siguiente", ruta);
    return NextResponse.redirect(url);
  }

  if (!puedeAcceder(sesion.rol, ruta)) {
    if (esApi) return NextResponse.json({ ok: false, error: "No tiene permiso para esta acción" }, { status: 403 });
    return NextResponse.redirect(new URL("/panel", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*", "/panel", "/api/:path*"],
};
