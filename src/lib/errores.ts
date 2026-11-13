import { ZodError } from "zod";

/** Error de negocio con mensaje apto para mostrar al usuario y código HTTP. */
export class ErrorDeNegocio extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ErrorDeNegocio";
  }
}

type ErrorPg = { code?: string; message?: string; constraint?: string };

/**
 * Traduce errores de validación y de PostgreSQL a mensajes claros en español.
 * Nunca expone detalles internos (consultas, trazas) al cliente.
 */
export function traducirError(e: unknown): ErrorDeNegocio {
  if (e instanceof ErrorDeNegocio) return e;
  if (e instanceof ZodError) {
    const primero = e.issues[0];
    return new ErrorDeNegocio(primero?.message ?? "Datos inválidos", 400);
  }
  const pg = e as ErrorPg;
  switch (pg?.code) {
    case "P0001": // raise exception del trigger
      return new ErrorDeNegocio(pg.message ?? "Operación no permitida", 409);
    case "23505":
      if (pg.constraint === "ux_visita_abierta") return new ErrorDeNegocio("La persona ya tiene una visita abierta", 409);
      return new ErrorDeNegocio("El registro ya existe", 409);
    case "23514":
      return new ErrorDeNegocio("Los datos no cumplen las reglas de validación", 400);
    case "23503":
      return new ErrorDeNegocio("El registro relacionado no existe", 400);
  }
  return new ErrorDeNegocio("Error interno. Intente de nuevo.", 500);
}
