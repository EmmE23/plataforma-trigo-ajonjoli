import { z } from "zod";

/** Fecha en formato AAAA-MM-DD y válida en el calendario. */
export const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use AAAA-MM-DD)")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Fecha inválida");

export const idEntero = z.coerce.number().int().positive("Identificador inválido");

export const cantidadEntera = z.coerce
  .number({ message: "Cantidad inválida" })
  .int("La cantidad debe ser un número entero")
  .positive("La cantidad debe ser mayor que cero")
  .max(100_000, "Cantidad demasiado grande");

/** Texto opcional: convierte cadenas vacías en undefined. */
export const textoOpcional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

/** Fecha de hoy en Colombia (AAAA-MM-DD). */
export const hoyBogota = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
