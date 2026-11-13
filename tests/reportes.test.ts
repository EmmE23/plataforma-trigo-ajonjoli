import { describe, it, expect, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { crearCategoria, crearArticulo, registrarEntradaLote, registrarSalidaLote } from "@/lib/repos/inventario";
import { reporteMovimientos, reporteVisitas, resumenGeneral, donacionesDeDonante } from "@/lib/repos/reportes";
import { registrarEntrada } from "@/lib/repos/visitas";
import { dbDePrueba, crearPerfil, crearPersona } from "./helpers";

const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

describe("Reportes", () => {
  let db: Db;
  let alm: number;
  let item: number;

  beforeEach(async () => {
    db = await dbDePrueba();
    alm = await crearPerfil(db, "almacenista");
    const c = await crearCategoria(db, "Aseo");
    item = (await crearArticulo(db, { categoria_id: c.id, nombre: "Jabón de baño", unidad: "unidad", stock_minimo: 5 })).id;
  });

  it("totaliza entradas, salidas y mermas por artículo en el periodo", async () => {
    const { lote } = await registrarEntradaLote(db, { item_id: item, cantidad: 40 }, alm);
    await registrarSalidaLote(db, { lote_id: lote.id, tipo: "salida", cantidad: 15, destino: "Jornada" }, alm);
    await registrarSalidaLote(db, { lote_id: lote.id, tipo: "merma", cantidad: 2, destino: "Dañado" }, alm);
    const r = await reporteMovimientos(db, { desde: hoy(), hasta: hoy() });
    expect(r.totales).toEqual({ entradas: 40, salidas: 15, mermas: 2 });
    expect(r.porArticulo).toEqual([{ item: "Jabón de baño", entradas: 40, salidas: 15, mermas: 2 }]);
    expect(r.detalle).toHaveLength(3);
  });

  it("no incluye movimientos fuera del periodo", async () => {
    await registrarEntradaLote(db, { item_id: item, cantidad: 40 }, alm);
    const r = await reporteMovimientos(db, { desde: "2020-01-01", hasta: "2020-01-31" });
    expect(r.totales).toEqual({ entradas: 0, salidas: 0, mermas: 0 });
  });

  it("rechaza periodos inválidos", async () => {
    await expect(reporteMovimientos(db, { desde: "2026-11-30", hasta: "2026-11-01" })).rejects.toThrow(/periodo/i);
    await expect(reporteMovimientos(db, { desde: "x", hasta: "2026-11-01" })).rejects.toThrow();
  });

  it("reporta visitas por periodo y el resumen general", async () => {
    const recep = await crearPerfil(db, "recepcionista");
    await crearPersona(db, "123");
    await registrarEntrada(db, { documento: "123", motivo: "Visita" }, recep);
    const v = await reporteVisitas(db, { desde: hoy(), hasta: hoy() });
    expect(v.total).toBe(1);
    const g = await resumenGeneral(db);
    expect(g).toMatchObject({ aforo: 1, visitasHoy: 1, articulosEnAlerta: 1 });
  });

  it("lista las donaciones de un donante por su correo", async () => {
    await db.query(
      `insert into donaciones_dinero (nombre_donante, email, monto_cop, estado, referencia_pasarela, consentimiento_datos)
       values ('Marta', 'marta@correo.co', 50000, 'aprobada', 'PRUEBA-1', true), ('Otro', 'otro@correo.co', 20000, 'aprobada', 'PRUEBA-2', true)`,
    );
    const d = await donacionesDeDonante(db, "MARTA@correo.co");
    expect(d).toHaveLength(1);
    expect(Number(d[0].monto_cop)).toBe(50000);
  });
});
