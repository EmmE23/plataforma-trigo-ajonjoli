/** Pruebas de las correcciones de la Fase 3 (revisión ECC, revisión Codex y escaneo de seguridad). */
import { describe, it, expect, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { registrarVisitaPortal } from "@/lib/repos/portal";
import { crearLimitador } from "@/lib/limitador";
import { autenticar, crearUsuario, listarUsuarios, restablecerPassword, perfilActivo, cambiarEstadoUsuario } from "@/lib/repos/usuarios";
import { crearArticulo, crearCategoria, registrarEntradaLote } from "@/lib/repos/inventario";
import { ipDe, leerJson, limitarPublico, manejar } from "@/lib/api";
import { dbDePrueba, crearPerfil } from "./helpers";

describe("ECC-2: la analítica solo acepta rutas reales del portal", () => {
  it("rechaza rutas inventadas", async () => {
    const db = await dbDePrueba();
    await expect(registrarVisitaPortal(db, "/ruta-inventada")).rejects.toThrow(/inválida/i);
    await expect(registrarVisitaPortal(db, "/donar")).resolves.toBeUndefined();
  });
});

describe("ECC-1: límite de peticiones por clave", () => {
  it("consumir() permite hasta el máximo dentro de la ventana", () => {
    let ahora = 0;
    const lim = crearLimitador({ maximo: 3, ventanaMs: 1000, reloj: () => ahora });
    expect([lim.consumir("ip"), lim.consumir("ip"), lim.consumir("ip"), lim.consumir("ip")]).toEqual([true, true, true, false]);
    ahora = 1500;
    expect(lim.consumir("ip")).toBe(true);
  });
});

describe("Usuarios: restablecer contraseña y estado activo", () => {
  let db: Db;
  let id: number;
  beforeEach(async () => {
    db = await dbDePrueba();
    await crearUsuario(db, { nombre: "Laura Gómez", email: "laura@trigo.org", password: "Clave-Inicial-1", rol: "recepcionista" });
    id = (await listarUsuarios(db))[0].id;
  });

  it("ECC-4: el administrador puede asignar una contraseña nueva", async () => {
    await restablecerPassword(db, id, "Clave-Nueva-2026");
    expect(await autenticar(db, "laura@trigo.org", "Clave-Inicial-1")).toBeNull();
    expect(await autenticar(db, "laura@trigo.org", "Clave-Nueva-2026")).not.toBeNull();
  });

  it("ECC-4: exige contraseñas de al menos 10 caracteres y usuario existente", async () => {
    await expect(restablecerPassword(db, id, "corta")).rejects.toThrow();
    await expect(restablecerPassword(db, 9999, "Clave-Nueva-2026")).rejects.toMatchObject({ status: 404 });
  });

  it("ECC-3 / CDX-1: un usuario desactivado deja de tener sesión válida", async () => {
    expect(await perfilActivo(db, id)).toBe(true);
    await cambiarEstadoUsuario(db, id, false);
    expect(await perfilActivo(db, id)).toBe(false);
    expect(await perfilActivo(db, 9999)).toBe(false);
  });
});

describe("ECC-5 / ECC-6 / ECC-1: utilidades de la API", () => {
  const req = (cuerpo: string, cabeceras: Record<string, string> = {}) =>
    new Request("http://localhost/api/x", { method: "POST", body: cuerpo, headers: cabeceras });

  it("ECC-5: ignora X-Forwarded-For salvo que se confíe en un proxy", () => {
    const r = req("{}", { "x-forwarded-for": "1.2.3.4" });
    expect(ipDe(r)).toBe("local");
    process.env.TRUST_PROXY = "1";
    expect(ipDe(r)).toBe("1.2.3.4");
    delete process.env.TRUST_PROXY;
  });

  it("ECC-6: rechaza cuerpos grandes por Content-Length antes de leerlos y JSON inválido", async () => {
    await expect(leerJson(req("{}", { "content-length": "999999" }))).rejects.toMatchObject({ status: 413 });
    await expect(leerJson(req("x".repeat(20_001)))).rejects.toMatchObject({ status: 413 });
    await expect(leerJson(req("{malo"))).rejects.toMatchObject({ status: 400 });
    await expect(leerJson(req('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it("ECC-1: limitarPublico responde 429 al superar el máximo", () => {
    const r = req("{}");
    limitarPublico(r, "prueba-unitaria", 2, 60_000);
    limitarPublico(r, "prueba-unitaria", 2, 60_000);
    expect(() => limitarPublico(r, "prueba-unitaria", 2, 60_000)).toThrow(/Demasiadas solicitudes/);
  });

  it("manejar() convierte errores en JSON sin exponer detalles internos", async () => {
    const h = manejar(async () => {
      throw new Error("detalle interno secreto");
    });
    const res = await h();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "Error interno. Intente de nuevo." });
  });
});

describe("CDX-2: códigos de lote únicos con entradas simultáneas", () => {
  it("cinco donativos registrados a la vez reciben códigos distintos y consecutivos", async () => {
    const db = await dbDePrueba();
    const alm = await crearPerfil(db);
    const cat = await crearCategoria(db, "Ropa");
    const item = (await crearArticulo(db, { categoria_id: cat.id, nombre: "Chaqueta", unidad: "unidad", stock_minimo: 1 })).id;
    // Un lote existente con código fuera de secuencia no debe provocar colisiones.
    await registrarEntradaLote(db, { item_id: item, cantidad: 1, fecha_ingreso: "2026-11-01" }, alm);
    const r = await Promise.all(
      Array.from({ length: 5 }, () => registrarEntradaLote(db, { item_id: item, cantidad: 2, fecha_ingreso: "2026-11-01" }, alm)),
    );
    const codigos = r.map((x) => x.lote.codigo).sort();
    expect(new Set(codigos).size).toBe(5);
    expect(codigos).toEqual(["L-20261101-002", "L-20261101-003", "L-20261101-004", "L-20261101-005", "L-20261101-006"]);
  });
});
