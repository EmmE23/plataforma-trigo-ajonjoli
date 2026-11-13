"use client";

import { useState, type FormEvent } from "react";

const SUGERENCIAS = ["20000", "50000", "100000"];

/** Donación con pasarela SIMULADA (modo de pruebas): no se realiza ningún cobro real. */
export function FormularioDonacion() {
  const [monto, setMonto] = useState("20000");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(form: HTMLFormElement, resultado: "aprobar" | "rechazar") {
    setEnviando(true);
    setMensaje("");
    const f = new FormData(form);
    try {
      const r = await fetch("/api/donaciones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre: f.get("nombre"),
          email: f.get("email"),
          monto_cop: Number(monto),
          consentimiento: f.get("consentimiento") === "on",
          resultado,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo simular el pago.");
      setError(false);
      setMensaje(
        `Referencia: ${d.datos.referencia}. Estado: ${d.datos.estado}. Monto: $${Number(d.datos.monto_cop).toLocaleString("es-CO")} COP.`,
      );
    } catch (err) {
      setError(true);
      setMensaje(err instanceof Error ? err.message : "No se pudo simular el pago.");
    } finally {
      setEnviando(false);
    }
  }

  function aprobado(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void enviar(e.currentTarget, "aprobar");
  }

  return (
    <form onSubmit={aprobado}>
      <div className="campo">
        <label htmlFor="don-nombre">Nombre completo</label>
        <input id="don-nombre" name="nombre" autoComplete="name" required maxLength={160} />
      </div>
      <div className="campo">
        <label htmlFor="don-email">Correo</label>
        <input id="don-email" name="email" type="email" autoComplete="email" required maxLength={160} />
      </div>
      <div className="campo">
        <label htmlFor="don-monto">Monto de la donación (COP)</label>
        <select
          id="don-sugerencias"
          aria-label="Sugerencias de monto"
          value={SUGERENCIAS.includes(monto) ? monto : "otro"}
          onChange={(e) => {
            if (e.target.value !== "otro") setMonto(e.target.value);
          }}
        >
          <option value="20000">$20.000</option>
          <option value="50000">$50.000</option>
          <option value="100000">$100.000</option>
          <option value="otro">Otro monto</option>
        </select>
        <input id="don-monto" name="monto" type="number" min="1000" max="50000000" step="1" required value={monto} onChange={(e) => setMonto(e.target.value)} />
      </div>
      <div className="casilla">
        <input id="don-consentimiento" name="consentimiento" type="checkbox" required />
        <label htmlFor="don-consentimiento">Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.</label>
      </div>
      <p className="mensaje mensaje-info">Pasarela en MODO DE PRUEBAS: no se realiza ningún cobro real.</p>
      <div className="fila">
        <button className="btn" type="submit" disabled={enviando}>
          Simular pago aprobado
        </button>
        <button
          className="btn btn-secundario"
          type="button"
          disabled={enviando}
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (form?.reportValidity()) void enviar(form, "rechazar");
          }}
        >
          Simular pago rechazado
        </button>
      </div>
      {mensaje && (
        <p className={`mensaje ${error ? "mensaje-error" : "mensaje-ok"}`} role={error ? "alert" : "status"}>
          {mensaje}
        </p>
      )}
    </form>
  );
}
