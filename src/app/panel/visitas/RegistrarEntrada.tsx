"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { datosFormulario, llamarApi } from "../../componentes/cliente";
import { Mensaje, type EstadoMensaje } from "../../componentes/Mensaje";
import { LectorQr } from "./LectorQr";

const MOTIVOS = ["Entrega de donativos", "Recibir ayuda", "Voluntariado", "Donación de enseres", "Reunión", "Otro"];

type PersonaCreada = { nombres: string; apellidos: string; codigo_qr: string; qr: string };

export function RegistrarEntrada() {
  const router = useRouter();
  const [msg, setMsg] = useState<EstadoMensaje>(null);
  const [documento, setDocumento] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [registrarNueva, setRegistrarNueva] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [carne, setCarne] = useState<PersonaCreada | null>(null);
  const formNueva = useRef<HTMLFormElement>(null);

  async function entrar(criterio: { documento?: string; codigoQr?: string }) {
    setMsg(null);
    const r = await llamarApi<{ persona: string }>("/api/visitas/entrada", "POST", { ...criterio, motivo });
    if (r.ok) {
      setMsg({ tipo: "ok", texto: `Entrada registrada: ${r.datos.persona}` });
      setDocumento("");
      router.refresh();
      return true;
    }
    if (r.status === 404 && criterio.documento) {
      setRegistrarNueva(true);
      setMsg({ tipo: "info", texto: "La persona no está registrada. Complete el formulario con la autorización de datos." });
    } else setMsg({ tipo: "error", texto: r.error });
    return false;
  }

  async function crearPersona(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = datosFormulario(e.currentTarget);
    const r = await llamarApi<PersonaCreada>("/api/personas", "POST", { ...datos, consentimiento: datos.consentimiento === true });
    if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
    setCarne(r.datos);
    setRegistrarNueva(false);
    await entrar({ documento: String(datos.numero_documento) });
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void entrar({ documento });
        }}
      >
        <div className="fila">
          <div className="campo">
            <label htmlFor="documento">Documento de identidad</label>
            <input id="documento" inputMode="numeric" autoComplete="off" value={documento} onChange={(e) => setDocumento(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="motivo">Motivo</label>
            <select id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="fila" style={{ marginBottom: 6 }}>
          <button type="button" className="btn btn-secundario" onClick={() => setEscaneando(!escaneando)} aria-expanded={escaneando}>
            {escaneando ? "Cerrar lector QR" : "Escanear QR"}
          </button>
          <button type="submit" className="btn">Registrar entrada</button>
        </div>
      </form>

      {escaneando && (
        <LectorQr
          onCodigo={async (codigo) => {
            setEscaneando(false);
            await entrar({ codigoQr: codigo });
          }}
        />
      )}

      <p style={{ fontSize: "0.9rem", color: "var(--texto-suave)" }}>
        Si la persona no existe, se abre el formulario con la casilla de autorización de datos.
      </p>
      <Mensaje estado={msg} />

      {registrarNueva && (
        <form ref={formNueva} onSubmit={crearPersona} className="tarjeta" style={{ marginTop: 12 }} aria-labelledby="t-nueva">
          <h3 id="t-nueva" style={{ marginTop: 0 }}>Registrar persona nueva</h3>
          <div className="fila">
            <div className="campo">
              <label htmlFor="tipo_documento">Tipo de documento</label>
              <select id="tipo_documento" name="tipo_documento" defaultValue="CC">
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PPT">Permiso por protección temporal</option>
                <option value="PA">Pasaporte</option>
                <option value="TI">Tarjeta de identidad</option>
                <option value="SD">Sin documento</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="numero_documento">Número</label>
              <input id="numero_documento" name="numero_documento" defaultValue={documento} required />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label htmlFor="nombres">Nombres</label>
              <input id="nombres" name="nombres" required autoComplete="off" />
            </div>
            <div className="campo">
              <label htmlFor="apellidos">Apellidos</label>
              <input id="apellidos" name="apellidos" autoComplete="off" />
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" defaultValue="visitante">
                <option value="visitante">Visitante</option>
                <option value="beneficiario">Beneficiario</option>
                <option value="voluntario">Voluntario</option>
                <option value="donante">Donante</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="telefono">Teléfono (opcional)</label>
              <input id="telefono" name="telefono" inputMode="tel" autoComplete="off" />
            </div>
          </div>
          <div className="casilla">
            <input id="consentimiento" name="consentimiento" type="checkbox" required />
            <label htmlFor="consentimiento">
              La persona autoriza el tratamiento de sus datos personales conforme a la Ley 1581 de 2012, para el registro de
              visitas y la entrega de ayudas de la fundación.
            </label>
          </div>
          <div className="fila">
            <button type="submit" className="btn">Guardar y registrar entrada</button>
            <button type="button" className="btn btn-secundario" onClick={() => setRegistrarNueva(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {carne && (
        <div className="tarjeta" style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }} aria-live="polite">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={carne.qr} alt={`Código QR de ${carne.nombres}`} width={140} height={140} />
          <div>
            <strong>Carné QR de {carne.nombres} {carne.apellidos}</strong>
            <p style={{ margin: "4px 0" }}>Código: {carne.codigo_qr}</p>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Imprímalo o tómele foto para agilizar las próximas visitas.</p>
            <button type="button" className="btn btn-secundario btn-chico" style={{ marginTop: 8 }} onClick={() => window.print()}>
              Imprimir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
