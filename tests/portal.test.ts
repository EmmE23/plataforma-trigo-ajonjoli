import { afterEach, describe, expect, it } from "vitest";
import { dbDePrueba } from "./helpers";
import { registrarDonacionPrueba, registrarVisitaPortal, registrarVoluntario, resumenAnalitica, necesidadesActuales } from "@/lib/repos/portal";
import type { Db } from "@/lib/db";

const bases: Db[] = [];
async function base() { const db = await dbDePrueba(); bases.push(db); return db; }
afterEach(async () => { await Promise.all(bases.splice(0).map((db) => db.close())); });

describe("portal público", () => {
  it("registra voluntario con consentimiento y datos opcionales", async () => {
    const db = await base();
    await expect(registrarVoluntario(db, { nombre: " Ana Pérez ", email: "ANA@ejemplo.com", telefono: "3001234567", mensaje: "Quiero ayudar", consentimiento: true })).resolves.toEqual({ id: expect.any(Number) });
    const r = await db.query(`select nombre,email,consentimiento_datos from solicitudes_voluntariado`);
    expect(r.rows[0]).toEqual({ nombre: "Ana Pérez", email: "ana@ejemplo.com", consentimiento_datos: true });
  });
  it("rechaza voluntario sin consentimiento y datos inválidos", async () => {
    const db = await base();
    await expect(registrarVoluntario(db, { nombre: "Ana", email: "ana@ejemplo.com", consentimiento: false })).rejects.toThrow();
    await expect(registrarVoluntario(db, { nombre: " ", email: "mal", consentimiento: true })).rejects.toThrow();
  });
  it.each([["aprobar", "aprobada"], ["rechazar", "rechazada"]] as const)("simula donación %s", async (resultado, estado) => {
    const db = await base();
    const d = await registrarDonacionPrueba(db, { nombre: "Luis", email: "luis@ejemplo.com", monto_cop: 20000, consentimiento: true, resultado });
    expect(d).toMatchObject({ estado, monto_cop: 20000 });
    expect(d.referencia).toMatch(/^PRUEBA-/);
    const r = await db.query(`select modo_prueba, consentimiento_datos from donaciones_dinero where referencia_pasarela = $1`, [d.referencia]);
    expect(r.rows[0]).toEqual({ modo_prueba: true, consentimiento_datos: true });
  });
  it.each([999, 50_000_001, 1000.5, -1000])("rechaza monto inválido %s", async (monto_cop) => {
    await expect(registrarDonacionPrueba(await base(), { nombre: "Luis", email: "luis@ejemplo.com", monto_cop, consentimiento: true, resultado: "aprobar" })).rejects.toThrow();
  });
  it("rechaza donación sin consentimiento", async () => {
    await expect(registrarDonacionPrueba(await base(), { nombre: "Luis", email: "luis@ejemplo.com", monto_cop: 1000, consentimiento: false, resultado: "aprobar" })).rejects.toThrow();
  });
  it("registra y resume visitas anónimas por ruta", async () => {
    const db = await base();
    await registrarVisitaPortal(db, "/"); await registrarVisitaPortal(db, "/donar"); await registrarVisitaPortal(db, "/");
    expect(await resumenAnalitica(db)).toEqual({ total: 3, porRuta: [{ ruta: "/", total: 2 }, { ruta: "/donar", total: 1 }] });
  });
  it("rechaza rutas inválidas y devuelve necesidades de inventario", async () => {
    const db = await base();
    await expect(registrarVisitaPortal(db, "https://ejemplo.com")).rejects.toThrow();
    await expect(registrarVisitaPortal(db, "/" + "a".repeat(200))).rejects.toThrow();
    const { crearItem } = await import("./helpers");
    await crearItem(db, "Mantas", 2);
    expect(await necesidadesActuales(db)).toContain("Mantas");
  });
});
