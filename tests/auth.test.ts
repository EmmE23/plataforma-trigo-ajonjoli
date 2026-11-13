import { describe, it, expect, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { firmarToken, verificarToken, puedeAcceder, rutaInicio } from "@/lib/auth";
import { cifrarPassword, verificarPassword } from "@/lib/password";
import { autenticar, crearUsuario, listarUsuarios, cambiarEstadoUsuario } from "@/lib/repos/usuarios";
import { crearLimitador } from "@/lib/limitador";
import { dbDePrueba } from "./helpers";

describe("Contraseñas", () => {
  it("cifra con bcrypt y verifica correctamente", async () => {
    const hash = await cifrarPassword("Clave-Segura-2026");
    expect(hash).not.toContain("Clave-Segura-2026");
    expect(await verificarPassword("Clave-Segura-2026", hash)).toBe(true);
    expect(await verificarPassword("otra", hash)).toBe(false);
  });
});

describe("JWT", () => {
  it("firma y verifica un token con rol", async () => {
    const t = await firmarToken({ sub: "7", nombre: "Laura", rol: "recepcionista" });
    const p = await verificarToken(t);
    expect(p).toMatchObject({ sub: "7", nombre: "Laura", rol: "recepcionista" });
  });

  it("rechaza tokens alterados o vacíos", async () => {
    const t = await firmarToken({ sub: "7", nombre: "Laura", rol: "recepcionista" });
    expect(await verificarToken(t.slice(0, -3) + "abc")).toBeNull();
    expect(await verificarToken("")).toBeNull();
    expect(await verificarToken(undefined)).toBeNull();
  });
});

describe("Permisos por rol", () => {
  it.each([
    ["administrador", "/panel/usuarios", true],
    ["administrador", "/api/inventario/movimientos", true],
    ["recepcionista", "/panel/visitas", true],
    ["recepcionista", "/api/visitas/entrada", true],
    ["recepcionista", "/panel/inventario", false],
    ["recepcionista", "/panel/usuarios", false],
    ["almacenista", "/panel/inventario", true],
    ["almacenista", "/panel/reportes", true],
    ["almacenista", "/panel/visitas", false],
    ["almacenista", "/api/usuarios", false],
    ["donante", "/panel/donante", true],
    ["donante", "/panel/inventario", false],
    ["donante", "/api/visitas/entrada", false],
  ])("%s → %s = %s", (rol, ruta, esperado) => {
    expect(puedeAcceder(rol as never, ruta)).toBe(esperado);
  });

  it("redirige a cada rol a su panel", () => {
    expect(rutaInicio("recepcionista")).toBe("/panel/visitas");
    expect(rutaInicio("almacenista")).toBe("/panel/inventario");
    expect(rutaInicio("administrador")).toBe("/panel/reportes");
    expect(rutaInicio("donante")).toBe("/panel/donante");
  });
});

describe("Usuarios", () => {
  let db: Db;
  beforeEach(async () => {
    db = await dbDePrueba();
    await crearUsuario(db, { nombre: "Laura Gómez", email: "Recepcion@Trigo.org", password: "Recepcion-2026", rol: "recepcionista" });
  });

  it("autentica con correo (sin importar mayúsculas) y contraseña correctos", async () => {
    const u = await autenticar(db, "recepcion@trigo.org", "Recepcion-2026");
    expect(u).toMatchObject({ nombre: "Laura Gómez", rol: "recepcionista" });
    expect(u).not.toHaveProperty("password_hash");
  });

  it("rechaza contraseña incorrecta y usuario inexistente", async () => {
    expect(await autenticar(db, "recepcion@trigo.org", "mala")).toBeNull();
    expect(await autenticar(db, "nadie@trigo.org", "Recepcion-2026")).toBeNull();
  });

  it("no deja ingresar a usuarios desactivados", async () => {
    const [u] = await listarUsuarios(db);
    await cambiarEstadoUsuario(db, u.id, false);
    expect(await autenticar(db, "recepcion@trigo.org", "Recepcion-2026")).toBeNull();
  });

  it("valida datos al crear: contraseña mínima de 10 caracteres, rol válido y correo único", async () => {
    await expect(crearUsuario(db, { nombre: "X", email: "x@trigo.org", password: "corta", rol: "almacenista" })).rejects.toThrow();
    await expect(crearUsuario(db, { nombre: "X", email: "x@trigo.org", password: "Suficiente-123", rol: "jefe" as never })).rejects.toThrow();
    await expect(crearUsuario(db, { nombre: "Otra", email: "recepcion@trigo.org", password: "Suficiente-123", rol: "almacenista" })).rejects.toThrow(/ya existe/i);
  });
});

describe("Limitador de intentos de ingreso", () => {
  it("bloquea después de 5 intentos fallidos en la ventana y se reinicia", () => {
    let ahora = 0;
    const lim = crearLimitador({ maximo: 5, ventanaMs: 60_000, reloj: () => ahora });
    for (let i = 0; i < 5; i++) expect(lim.permitido("ip1")).toBe(true), lim.registrarFallo("ip1");
    expect(lim.permitido("ip1")).toBe(false);
    expect(lim.permitido("ip2")).toBe(true);
    ahora = 61_000;
    expect(lim.permitido("ip1")).toBe(true);
    lim.registrarFallo("ip1");
    lim.reiniciar("ip1");
    expect(lim.permitido("ip1")).toBe(true);
  });
});
