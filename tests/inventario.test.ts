import { describe, it, expect, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import {
  crearCategoria,
  crearArticulo,
  registrarEntradaLote,
  registrarSalidaLote,
  registrarSalidaPeps,
  existencias,
  alertasStock,
  lotesPorVencer,
  ordenPeps,
  libroMovimientos,
} from "@/lib/repos/inventario";
import { dbDePrueba, crearPerfil, crearPersona } from "./helpers";

// Fecha calculada en la zona horaria de Colombia, igual que current_date en la base de datos.
const enDias = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

describe("Inventario", () => {
  let db: Db;
  let alm: number;
  let camiseta: number;

  beforeEach(async () => {
    db = await dbDePrueba();
    alm = await crearPerfil(db, "almacenista");
    const ropa = await crearCategoria(db, "Ropa");
    camiseta = (await crearArticulo(db, { categoria_id: ropa.id, nombre: "Camiseta adulto", unidad: "unidad", stock_minimo: 30 })).id;
  });

  it("registra un donativo como lote nuevo con código automático y actualiza el stock", async () => {
    const r = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 50 }, alm);
    expect(r.lote.codigo).toMatch(/^L-\d{8}-\d{3}$/);
    const e = await existencias(db);
    expect(e[0]).toMatchObject({ nombre: "Camiseta adulto", categoria: "Ropa", stock_actual: 50, stock_minimo: 30, estado: "OK" });
  });

  it("registra el donante del lote cuando se indica", async () => {
    const donante = await crearPersona(db, "8001", "donante");
    const r = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 5, donante_id: donante }, alm);
    expect(r.lote.donante_id).toBe(donante);
  });

  it("valida la cantidad y la fecha de vencimiento", async () => {
    await expect(registrarEntradaLote(db, { item_id: camiseta, cantidad: 0 }, alm)).rejects.toThrow();
    await expect(registrarEntradaLote(db, { item_id: camiseta, cantidad: 1.5 }, alm)).rejects.toThrow();
    await expect(registrarEntradaLote(db, { item_id: camiseta, cantidad: 3, fecha_vencimiento: "no-es-fecha" }, alm)).rejects.toThrow();
  });

  it("registra una salida de un lote con destino y bloquea si no hay existencias", async () => {
    const { lote } = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 50 }, alm);
    await registrarSalidaLote(db, { lote_id: lote.id, tipo: "salida", cantidad: 20, destino: "Jornada Soacha centro" }, alm);
    expect((await existencias(db))[0].stock_actual).toBe(30);
    await expect(
      registrarSalidaLote(db, { lote_id: lote.id, tipo: "salida", cantidad: 60, destino: "Jornada" }, alm),
    ).rejects.toThrow(/stock insuficiente/i);
  });

  it("exige beneficiario o destino en salidas y motivo en mermas", async () => {
    const { lote } = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 5 }, alm);
    await expect(registrarSalidaLote(db, { lote_id: lote.id, tipo: "salida", cantidad: 1 }, alm)).rejects.toThrow(/beneficiario o destino/i);
    await registrarSalidaLote(db, { lote_id: lote.id, tipo: "merma", cantidad: 1, destino: "Prenda rota" }, alm);
    expect((await existencias(db))[0].stock_actual).toBe(4);
  });

  it("la salida PEPS descuenta primero del lote más antiguo y reparte entre lotes", async () => {
    const viejo = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 10, fecha_ingreso: "2026-09-20" }, alm);
    const nuevo = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 10, fecha_ingreso: "2026-10-20" }, alm);
    const r = await registrarSalidaPeps(db, { item_id: camiseta, cantidad: 15, destino: "Jornada Maipore" }, alm);
    expect(r.map((m) => [m.lote_id, m.cantidad])).toEqual([
      [viejo.lote.id, 10],
      [nuevo.lote.id, 5],
    ]);
    expect((await existencias(db))[0].stock_actual).toBe(5);
  });

  it("la salida PEPS falla completa (sin descuentos parciales) si no alcanza el stock", async () => {
    await registrarEntradaLote(db, { item_id: camiseta, cantidad: 10 }, alm);
    await expect(registrarSalidaPeps(db, { item_id: camiseta, cantidad: 11, destino: "Jornada" }, alm)).rejects.toThrow(/stock insuficiente/i);
    expect((await existencias(db))[0].stock_actual).toBe(10);
  });

  it("muestra alertas de stock mínimo, estado 'Stock bajo' y 'Agotado'", async () => {
    expect((await existencias(db))[0].estado).toBe("Agotado");
    await registrarEntradaLote(db, { item_id: camiseta, cantidad: 12 }, alm);
    expect((await existencias(db))[0].estado).toBe("Stock bajo");
    expect((await alertasStock(db)).map((a) => a.nombre)).toEqual(["Camiseta adulto"]);
  });

  it("lista lotes por vencer en 30 días y el orden PEPS sugerido", async () => {
    await registrarEntradaLote(db, { item_id: camiseta, cantidad: 4, fecha_vencimiento: enDias(7), fecha_ingreso: "2026-10-01" }, alm);
    await registrarEntradaLote(db, { item_id: camiseta, cantidad: 4, fecha_vencimiento: enDias(200), fecha_ingreso: "2026-10-05" }, alm);
    const v = await lotesPorVencer(db);
    expect(v).toHaveLength(1);
    expect(Number(v[0].dias_restantes)).toBe(7);
    const peps = await ordenPeps(db, camiseta);
    expect(peps.map((p) => Number(p.orden_salida))).toEqual([1, 2]);
  });

  it("el libro de movimientos registra quién y cuándo", async () => {
    const { lote } = await registrarEntradaLote(db, { item_id: camiseta, cantidad: 5 }, alm);
    await registrarSalidaLote(db, { lote_id: lote.id, tipo: "salida", cantidad: 2, destino: "Jornada" }, alm);
    const libro = await libroMovimientos(db, { limite: 10 });
    expect(libro).toHaveLength(2);
    expect(libro[0]).toMatchObject({ tipo: "salida", cantidad: 2, item: "Camiseta adulto", registrado_por: "Usuario almacenista" });
    expect(libro[0].creado_en).toBeTruthy();
  });
});
