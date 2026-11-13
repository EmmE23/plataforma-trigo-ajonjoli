"use client";

import { useState, type FormEvent } from "react";

/** Formulario público de voluntariado con autorización obligatoria de datos (Ley 1581 de 2012). */
export function FormularioVoluntariado() {
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setMensaje("");
    const form = e.currentTarget; // se guarda antes del await: después React deja currentTarget en null
    const f = new FormData(form);
    try {
      const r = await fetch("/api/voluntariado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre: f.get("nombre"),
          email: f.get("email"),
          telefono: f.get("telefono") || undefined,
          mensaje: f.get("mensaje") || undefined,
          consentimiento: f.get("consentimiento") === "on",
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo enviar la solicitud.");
      setError(false);
      setMensaje("Gracias. Recibimos tu solicitud de voluntariado.");
      form.reset();
    } catch (err) {
      setError(true);
      setMensaje(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="vol-nombre">Nombre completo</label>
        <input id="vol-nombre" name="nombre" autoComplete="name" required maxLength={160} />
      </div>
      <div className="campo">
        <label htmlFor="vol-email">Correo</label>
        <input id="vol-email" name="email" type="email" autoComplete="email" required maxLength={160} />
      </div>
      <div className="campo">
        <label htmlFor="vol-telefono">Teléfono</label>
        <input id="vol-telefono" name="telefono" type="tel" autoComplete="tel" maxLength={40} />
      </div>
      <div className="campo">
        <label htmlFor="vol-mensaje">Mensaje opcional</label>
        <textarea id="vol-mensaje" name="mensaje" maxLength={2000} />
      </div>
      <div className="casilla">
        <input id="vol-consentimiento" name="consentimiento" type="checkbox" required />
        <label htmlFor="vol-consentimiento">
          Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012. Usaremos estos datos únicamente para
          responder a tu solicitud.
        </label>
      </div>
      <button className="btn" type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar"}
      </button>
      {mensaje && (
        <p className={`mensaje ${error ? "mensaje-error" : "mensaje-ok"}`} role={error ? "alert" : "status"}>
          {mensaje}
        </p>
      )}
    </form>
  );
}
