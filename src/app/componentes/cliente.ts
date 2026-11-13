"use client";

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string; status: number };

/** Llama a la API JSON del propio sitio y normaliza errores. */
export async function llamarApi<T = unknown>(url: string, metodo: "POST" | "PATCH" | "GET", cuerpo?: unknown): Promise<Respuesta<T>> {
  try {
    const res = await fetch(url, {
      method: metodo,
      headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) return { ok: false, error: json.error ?? "No se pudo completar la operación", status: res.status };
    return { ok: true, datos: json.datos as T };
  } catch {
    return { ok: false, error: "Sin conexión con el servidor", status: 0 };
  }
}

/** Convierte un formulario en objeto plano (checkbox → boolean). */
export function datosFormulario(form: HTMLFormElement): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const el of Array.from(form.elements) as HTMLInputElement[]) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") salida[el.name] = el.checked;
    else if (el.type === "radio") {
      if (el.checked) salida[el.name] = el.value;
    } else salida[el.name] = el.value;
  }
  return salida;
}
