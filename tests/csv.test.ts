import { describe, it, expect } from "vitest";
import { aCsv, celdaCsv } from "@/lib/csv";

describe("Exportación CSV", () => {
  it("escapa comillas, separadores y saltos de línea", () => {
    expect(celdaCsv('Jornada "Maipore"; norte')).toBe('"Jornada ""Maipore""; norte"');
    expect(celdaCsv(null)).toBe("");
    expect(celdaCsv(15)).toBe("15");
  });

  it("neutraliza fórmulas para evitar inyección en Excel", () => {
    expect(celdaCsv("=HYPERLINK(\"x\")")).toMatch(/^"'=/);
    expect(celdaCsv("-5")).toBe("'-5");
  });

  it("genera encabezados y filas con BOM UTF-8", () => {
    const csv = aCsv(["A", "B"], [[1, "dos"]]);
    expect(csv.startsWith("﻿A;B\r\n1;dos")).toBe(true);
  });
});
