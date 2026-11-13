import { describe, it, expect, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { dbDePrueba, crearPerfil, crearPersona, crearItem, crearLote, mover, stockItem } from "./helpers";

const enDias = (d: number) => new Date(Date.now() + d * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

describe("Esquema de base de datos", () => {
  let db: Db;
  let perfil: number;
  let item: number;
  let lote: number;

  beforeEach(async () => {
    db = await dbDePrueba();
    perfil = await crearPerfil(db);
    item = await crearItem(db);
    lote = await crearLote(db, item, "L-001");
  });

  it("crea las 9 tablas y las 4 vistas del modelo", async () => {
    const t = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
    );
    const nombres = t.rows.map((r) => r.table_name);
    for (const n of ["perfiles", "personas", "visitas", "categorias", "items", "lotes", "movimientos_inventario", "donaciones_dinero", "solicitudes_voluntariado"]) {
      expect(nombres).toContain(n);
    }
    const v = await db.query<{ table_name: string }>(`select table_name from information_schema.views where table_schema='public'`);
    expect(v.rows.map((r) => r.table_name).sort()).toEqual(["v_aforo_actual", "v_alertas_stock", "v_lotes_peps", "v_lotes_por_vencer"]);
  });

  it("una entrada de 50 unidades deja el stock en 50", async () => {
    await mover(db, lote, "entrada", 50, perfil);
    expect(await stockItem(db, item)).toBe(50);
    const l = await db.query<{ cantidad_disponible: number }>(`select cantidad_disponible from lotes where id=$1`, [lote]);
    expect(l.rows[0].cantidad_disponible).toBe(50);
  });

  it("una salida de 20 deja el stock en 30", async () => {
    await mover(db, lote, "entrada", 50, perfil);
    await mover(db, lote, "salida", 20, perfil);
    expect(await stockItem(db, item)).toBe(30);
  });

  it("las mermas también descuentan stock", async () => {
    await mover(db, lote, "entrada", 10, perfil);
    await mover(db, lote, "merma", 3, perfil, "Prenda dañada");
    expect(await stockItem(db, item)).toBe(7);
  });

  it("rechaza una salida de 60 cuando hay 50 en stock", async () => {
    await mover(db, lote, "entrada", 50, perfil);
    await expect(mover(db, lote, "salida", 60, perfil)).rejects.toThrow(/stock insuficiente/i);
    expect(await stockItem(db, item)).toBe(50);
  });

  it("rechaza salidas sin beneficiario ni destino", async () => {
    await mover(db, lote, "entrada", 5, perfil);
    await expect(mover(db, lote, "salida", 1, perfil, null)).rejects.toThrow();
  });

  it("rechaza cantidades cero o negativas", async () => {
    await expect(mover(db, lote, "entrada", 0, perfil)).rejects.toThrow();
    await expect(mover(db, lote, "entrada", -5, perfil)).rejects.toThrow();
  });

  it("no permite modificar ni borrar movimientos", async () => {
    await mover(db, lote, "entrada", 50, perfil);
    await expect(db.query(`update movimientos_inventario set cantidad = 99`)).rejects.toThrow(/no se pueden modificar/i);
    await expect(db.query(`delete from movimientos_inventario`)).rejects.toThrow(/no se pueden modificar/i);
  });

  it("v_lotes_peps ordena la salida por fecha de ingreso (primero en entrar, primero en salir)", async () => {
    const lote2 = await crearLote(db, item, "L-002", "2026-10-10");
    const lote0 = await crearLote(db, item, "L-000", "2026-09-20");
    await mover(db, lote, "entrada", 30, perfil);
    await mover(db, lote2, "entrada", 10, perfil);
    await mover(db, lote0, "entrada", 5, perfil);
    const r = await db.query<{ codigo: string; orden_salida: number }>(
      `select codigo, orden_salida from v_lotes_peps where item_id=$1 order by orden_salida`,
      [item],
    );
    expect(r.rows.map((x) => x.codigo)).toEqual(["L-000", "L-001", "L-002"]);
    expect(Number(r.rows[0].orden_salida)).toBe(1);
  });

  it("v_alertas_stock muestra artículos con stock en o por debajo del mínimo", async () => {
    await mover(db, lote, "entrada", 20, perfil); // mínimo 30
    const r = await db.query<{ nombre: string }>(`select nombre from v_alertas_stock`);
    expect(r.rows.map((x) => x.nombre)).toContain("Camiseta adulto");
    await mover(db, lote, "entrada", 50, perfil);
    const r2 = await db.query(`select * from v_alertas_stock`);
    expect(r2.rows).toHaveLength(0);
  });

  it("v_lotes_por_vencer lista lotes con existencias que vencen en 30 días o menos", async () => {
    const pronto = await crearLote(db, item, "L-PRONTO", "2026-10-01", enDias(10));
    const lejos = await crearLote(db, item, "L-LEJOS", "2026-10-01", enDias(90));
    await mover(db, pronto, "entrada", 5, perfil);
    await mover(db, lejos, "entrada", 5, perfil);
    const r = await db.query<{ codigo: string }>(`select codigo from v_lotes_por_vencer`);
    expect(r.rows.map((x) => x.codigo)).toEqual(["L-PRONTO"]);
  });

  it("permite una sola visita abierta por persona y v_aforo_actual cuenta las abiertas", async () => {
    const recep = await crearPerfil(db, "recepcionista");
    const p = await crearPersona(db);
    await db.query(`insert into visitas (persona_id, motivo, registrada_por) values ($1,'Entrega',$2)`, [p, recep]);
    await expect(
      db.query(`insert into visitas (persona_id, motivo, registrada_por) values ($1,'Otra',$2)`, [p, recep]),
    ).rejects.toThrow();
    const a = await db.query<{ personas_dentro: number }>(`select personas_dentro from v_aforo_actual`);
    expect(Number(a.rows[0].personas_dentro)).toBe(1);
  });

  it("exige el consentimiento de datos para registrar personas (Ley 1581 de 2012)", async () => {
    await expect(
      db.query(
        `insert into personas (tipo_documento, numero_documento, nombres, apellidos, tipo, consentimiento_datos) values ('CC','9','A','B','visitante',false)`,
      ),
    ).rejects.toThrow();
  });
});
