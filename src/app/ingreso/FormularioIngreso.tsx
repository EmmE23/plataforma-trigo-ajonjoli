"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { llamarApi } from "../componentes/cliente";
import { Mensaje, type EstadoMensaje } from "../componentes/Mensaje";

export function FormularioIngreso({ destino }: { destino?: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<EstadoMensaje>(null);
  const [enviando, setEnviando] = useState(false);
  const [ayuda, setAyuda] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true);
    setMsg(null);
    const r = await llamarApi<{ destino: string }>("/api/auth/login", "POST", { email: f.get("email"), password: f.get("password") });
    setEnviando(false);
    if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
    router.push(destino ?? r.datos.destino);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required placeholder="correo@fundacion.org" />
      </div>
      <div className="campo">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Mensaje estado={msg} />
      <button className="btn" type="submit" disabled={enviando} style={{ width: "100%" }}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
      <p>
        <button type="button" className="btn-secundario" onClick={() => setAyuda(!ayuda)} aria-expanded={ayuda}
          style={{ background: "none", border: "none", color: "var(--primario)", textDecoration: "underline", cursor: "pointer", padding: "10px 0", fontSize: "1rem" }}>
          ¿Olvidó su contraseña?
        </button>
      </p>
      {ayuda && (
        <p className="mensaje mensaje-info">
          Solicite al administrador de la plataforma que le asigne una contraseña nueva desde el módulo Usuarios.
        </p>
      )}
    </form>
  );
}
