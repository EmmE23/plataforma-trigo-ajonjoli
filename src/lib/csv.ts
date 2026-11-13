type Celda = string | number | null | undefined;

/** Escapa una celda CSV y neutraliza fórmulas (prevención de inyección CSV en Excel). */
export function celdaCsv(v: Celda): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Genera CSV separado por punto y coma (formato que Excel en español abre directamente), con BOM UTF-8. */
export function aCsv(encabezados: string[], filas: Celda[][]): string {
  const lineas = [encabezados, ...filas].map((f) => f.map(celdaCsv).join(";"));
  return "﻿" + lineas.join("\r\n");
}
