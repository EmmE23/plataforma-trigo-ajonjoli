"use client";

import { useEffect } from "react";

export function Analitica({ ruta }: { ruta: string }) {
  useEffect(() => { void fetch("/api/analitica", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ruta }), keepalive: true }).catch(() => undefined); }, [ruta]);
  return null;
}
