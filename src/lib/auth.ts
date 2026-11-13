import { SignJWT, jwtVerify } from "jose";

/** Módulo compatible con el runtime Edge (lo usa el middleware): solo depende de `jose`. */

export const ROLES = ["administrador", "recepcionista", "almacenista", "donante"] as const;
export type Rol = (typeof ROLES)[number];

export type Sesion = { sub: string; nombre: string; rol: Rol };

export const COOKIE_SESION = "trigo_sesion";
export const DURACION_SESION_SEG = 60 * 60 * 8; // 8 horas (una jornada)

function clave(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET no está configurado (mínimo 32 caracteres). Ejecute: npm run setup");
  }
  return new TextEncoder().encode(s);
}

export async function firmarToken(s: Sesion): Promise<string> {
  return new SignJWT({ nombre: s.nombre, rol: s.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setIssuedAt()
    .setIssuer("trigo-ajonjoli")
    .setExpirationTime(`${DURACION_SESION_SEG}s`)
    .sign(clave());
}

export async function verificarToken(token: string | undefined | null): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { issuer: "trigo-ajonjoli", algorithms: ["HS256"] });
    const rol = payload.rol as Rol;
    if (!payload.sub || !ROLES.includes(rol)) return null;
    return { sub: payload.sub, nombre: String(payload.nombre ?? ""), rol };
  } catch {
    return null;
  }
}

/** Prefijos de ruta permitidos por rol. El administrador accede a todo. */
const PERMISOS: Record<Exclude<Rol, "administrador">, string[]> = {
  recepcionista: ["/panel/visitas", "/api/visitas", "/api/personas"],
  almacenista: ["/panel/inventario", "/panel/reportes", "/api/inventario", "/api/reportes", "/api/personas"],
  donante: ["/panel/donante", "/api/donante"],
};

const coincide = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(prefijo + "/");

export function puedeAcceder(rol: Rol, ruta: string): boolean {
  if (rol === "administrador") return true;
  if (ruta === "/panel") return true;
  return PERMISOS[rol].some((p) => coincide(ruta, p));
}

export function rutaInicio(rol: Rol): string {
  switch (rol) {
    case "recepcionista":
      return "/panel/visitas";
    case "almacenista":
      return "/panel/inventario";
    case "donante":
      return "/panel/donante";
    default:
      return "/panel/reportes";
  }
}
