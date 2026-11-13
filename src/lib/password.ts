import bcrypt from "bcryptjs";

const COSTO = 10;

export function cifrarPassword(plano: string): Promise<string> {
  return bcrypt.hash(plano, COSTO);
}

export function verificarPassword(plano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plano, hash);
}

let hashFicticio: string | undefined;

/** Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe (evita enumerar correos). */
export function hashFicticio_(): string {
  hashFicticio ??= bcrypt.hashSync("usuario-inexistente", COSTO);
  return hashFicticio;
}
