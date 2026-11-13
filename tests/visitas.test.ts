import { describe, it, expect, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { crearPersona, buscarPersona } from "@/lib/repos/personas";
import { registrarEntrada, registrarSalida, visitasDeHoy, aforoActual } from "@/lib/repos/visitas";
import { dbDePrueba, crearPerfil } from "./helpers";

const nueva = {
  tipo_documento: "CC" as const,
  numero_documento: "1028481999",
  nombres: "Carlos",
  apellidos: "Rodríguez",
  tipo: "visitante" as const,
  telefono: "3001234567",
  consentimiento: true as const,
};

describe("Personas", () => {
  let db: Db;
  beforeEach(async () => {
    db = await dbDePrueba();
  });

  it("registra una persona con consentimiento y le asigna un código QR", async () => {
    const p = await crearPersona(db, nueva);
    expect(p.id).toBeGreaterThan(0);
    expect(p.codigo_qr).toMatch(/^TA-[0-9A-F]{10}$/);
  });

  it("rechaza registrar sin consentimiento de datos", async () => {
    await expect(crearPersona(db, { ...nueva, consentimiento: false as never })).rejects.toThrow(/autoriza/i);
  });

  it("rechaza documentos duplicados", async () => {
    await crearPersona(db, nueva);
    await expect(crearPersona(db, nueva)).rejects.toThrow(/ya existe/i);
  });

  it("rechaza documentos con caracteres no válidos", async () => {
    await expect(crearPersona(db, { ...nueva, numero_documento: "12; drop" })).rejects.toThrow();
  });

  it("busca por documento o por código QR", async () => {
    const p = await crearPersona(db, nueva);
    expect((await buscarPersona(db, { documento: "1028481999" }))?.id).toBe(p.id);
    expect((await buscarPersona(db, { codigoQr: p.codigo_qr }))?.id).toBe(p.id);
    expect(await buscarPersona(db, { documento: "000" })).toBeNull();
  });
});

describe("Visitas", () => {
  let db: Db;
  let recep: number;
  beforeEach(async () => {
    db = await dbDePrueba();
    recep = await crearPerfil(db, "recepcionista");
    await crearPersona(db, nueva);
  });

  it("registra la entrada por documento y aumenta el aforo", async () => {
    const r = await registrarEntrada(db, { documento: "1028481999", motivo: "Entrega de mercado" }, recep);
    expect(r.persona.nombres).toBe("Carlos");
    expect(await aforoActual(db)).toBe(1);
  });

  it("registra la entrada por código QR", async () => {
    const p = await buscarPersona(db, { documento: "1028481999" });
    const r = await registrarEntrada(db, { codigoQr: p!.codigo_qr, motivo: "Voluntariado" }, recep);
    expect(r.visita.persona_id).toBe(p!.id);
  });

  it("indica que la persona no existe para abrir el formulario de registro", async () => {
    await expect(registrarEntrada(db, { documento: "555", motivo: "Visita" }, recep)).rejects.toMatchObject({ status: 404 });
  });

  it("no permite dos visitas abiertas para la misma persona", async () => {
    await registrarEntrada(db, { documento: "1028481999", motivo: "Visita" }, recep);
    await expect(registrarEntrada(db, { documento: "1028481999", motivo: "Visita" }, recep)).rejects.toThrow(/visita abierta/i);
  });

  it("registra la salida, calcula la permanencia y libera el aforo", async () => {
    const { visita } = await registrarEntrada(db, { documento: "1028481999", motivo: "Visita" }, recep);
    await db.query(`update visitas set hora_entrada = now() - interval '45 minutes' where id = $1`, [visita.id]);
    const s = await registrarSalida(db, visita.id);
    expect(s.permanencia_min).toBeGreaterThanOrEqual(45);
    expect(await aforoActual(db)).toBe(0);
    await expect(registrarSalida(db, visita.id)).rejects.toThrow(/ya tiene salida/i);
    await expect(registrarSalida(db, 9999)).rejects.toMatchObject({ status: 404 });
  });

  it("lista las visitas de hoy con nombre, documento, motivo y horas", async () => {
    await registrarEntrada(db, { documento: "1028481999", motivo: "Entrega" }, recep);
    const hoy = await visitasDeHoy(db);
    expect(hoy).toHaveLength(1);
    expect(hoy[0]).toMatchObject({ nombre: "Carlos Rodríguez", documento: "CC 1028481999", motivo: "Entrega", hora_salida: null });
  });
});
