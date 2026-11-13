import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";

export type Db = PGlite;

const RUTA_ESQUEMA = path.join(process.cwd(), "db", "schema.sql");

/** Aplica el esquema (idempotente: usa "if not exists" / "create or replace"). */
export async function aplicarEsquema(db: Db): Promise<void> {
  await db.exec(readFileSync(RUTA_ESQUEMA, "utf8"));
}

/**
 * Crea una base de datos PostgreSQL con PGlite.
 * Sin `dataDir` queda en memoria (pruebas); con `dataDir` se guarda en disco.
 */
export async function crearBaseDeDatos(dataDir?: string): Promise<Db> {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  await db.exec(`set time zone 'America/Bogota'`);
  await aplicarEsquema(db);
  return db;
}

type GlobalConDb = typeof globalThis & { __trigoDb?: Promise<Db> };

/** Instancia única para el servidor Next.js (sobrevive a la recarga en desarrollo). */
export function getDb(): Promise<Db> {
  const g = globalThis as GlobalConDb;
  if (!g.__trigoDb) {
    const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data", "pgdata");
    g.__trigoDb = crearBaseDeDatos(dir).catch((e) => {
      g.__trigoDb = undefined;
      throw e;
    });
  }
  return g.__trigoDb;
}
