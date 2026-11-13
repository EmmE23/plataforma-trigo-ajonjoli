import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ErrorDeNegocio, traducirError } from "@/lib/errores";
import { dbDePrueba, crearPerfil, crearPersona, crearItem, crearLote, mover } from "./helpers";

describe("Traducción de errores a mensajes para el usuario", () => {
  it("conserva los errores de negocio", () => {
    const e = new ErrorDeNegocio("Visita no encontrada", 404);
    expect(traducirError(e)).toBe(e);
  });

  it("muestra el primer mensaje de validación", () => {
    const r = z.object({ cantidad: z.number().positive("La cantidad debe ser mayor que cero") }).safeParse({ cantidad: -1 });
    const t = traducirError(r.error);
    expect(t).toMatchObject({ status: 400, message: "La cantidad debe ser mayor que cero" });
  });

  it("traduce el bloqueo del trigger de stock (409)", async () => {
    const db = await dbDePrueba();
    const p = await crearPerfil(db);
    const lote = await crearLote(db, await crearItem(db), "L-1");
    const e = await mover(db, lote, "salida", 5, p).catch((x) => x);
    expect(traducirError(e)).toMatchObject({ status: 409, message: expect.stringMatching(/Stock insuficiente/) });
  });

  it("traduce duplicados, visita abierta, reglas y referencias inexistentes", async () => {
    const db = await dbDePrueba();
    const recep = await crearPerfil(db, "recepcionista");
    const persona = await crearPersona(db);
    const dup = await crearPersona(db).catch((x) => x);
    expect(traducirError(dup)).toMatchObject({ status: 409, message: "El registro ya existe" });

    await db.query(`insert into visitas (persona_id, registrada_por) values ($1,$2)`, [persona, recep]);
    const abierta = await db.query(`insert into visitas (persona_id, registrada_por) values ($1,$2)`, [persona, recep]).catch((x) => x);
    expect(traducirError(abierta)).toMatchObject({ status: 409, message: "La persona ya tiene una visita abierta" });

    const cat = await db.query<{ id: number }>(`insert into categorias (nombre) values ('Aseo') returning id`);
    const check = await db.query(`insert into items (categoria_id, nombre, stock_minimo) values ($1,'X',-1)`, [cat.rows[0].id]).catch((x) => x);
    expect(traducirError(check)).toMatchObject({ status: 400 });

    const fk = await db.query(`insert into visitas (persona_id, registrada_por) values (9999,$1)`, [recep]).catch((x) => x);
    expect(traducirError(fk)).toMatchObject({ status: 400, message: "El registro relacionado no existe" });
  });

  it("oculta los detalles de errores desconocidos", () => {
    const t = traducirError(new Error("select * from perfiles: conexión perdida"));
    expect(t).toMatchObject({ status: 500, message: "Error interno. Intente de nuevo." });
  });
});
