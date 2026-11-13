"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { datosFormulario, llamarApi } from "../../componentes/cliente";
import { Mensaje, type EstadoMensaje } from "../../componentes/Mensaje";

export function CrearUsuario() {
  const router = useRouter();
  const [msg, setMsg] = useState<EstadoMensaje>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const r = await llamarApi("/api/usuarios", "POST", datosFormulario(form));
        if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
        setMsg({ tipo: "ok", texto: "Usuario creado." });
        form.reset();
        router.refresh();
      }}
    >
      <div className="campo">
        <label htmlFor="u-nombre">Nombre completo</label>
        <input id="u-nombre" name="nombre" required autoComplete="off" />
      </div>
      <div className="campo">
        <label htmlFor="u-email">Correo</label>
        <input id="u-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="campo">
        <label htmlFor="u-pass">Contraseña inicial (mínimo 10 caracteres)</label>
        <input id="u-pass" name="password" type="password" minLength={10} required autoComplete="new-password" />
      </div>
      <div className="campo">
        <label htmlFor="u-rol">Rol</label>
        <select id="u-rol" name="rol" defaultValue="recepcionista">
          <option value="recepcionista">Recepcionista</option>
          <option value="almacenista">Almacenista</option>
          <option value="donante">Donante</option>
          <option value="administrador">Administrador</option>
        </select>
      </div>
      <Mensaje estado={msg} />
      <button className="btn" type="submit">Crear usuario</button>
    </form>
  );
}

/** Asignar una contraseña nueva a un usuario (flujo "¿Olvidó su contraseña?"). */
export function RestablecerPassword({ id, nombre }: { id: number; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState<EstadoMensaje>(null);
  const campo = `pass-${id}`;
  if (!abierto) {
    return (
      <button type="button" className="btn btn-secundario btn-chico" onClick={() => setAbierto(true)} aria-label={`Restablecer la contraseña de ${nombre}`}>
        Restablecer contraseña
      </button>
    );
  }
  return (
    <form
      className="fila"
      style={{ alignItems: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const r = await llamarApi(`/api/usuarios/${id}`, "PATCH", { password: datosFormulario(form).password });
        if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
        setMsg({ tipo: "ok", texto: `Contraseña de ${nombre} actualizada.` });
        form.reset();
      }}
    >
      <label htmlFor={campo} className="sr-only">Contraseña nueva para {nombre}</label>
      <input id={campo} name="password" type="password" minLength={10} required autoComplete="new-password" placeholder="Nueva (mín. 10)" style={{ minHeight: 36, padding: "4px 8px" }} />
      <button className="btn btn-chico" type="submit">Guardar</button>
      <button className="btn btn-secundario btn-chico" type="button" onClick={() => { setAbierto(false); setMsg(null); }}>Cancelar</button>
      <Mensaje estado={msg} />
    </form>
  );
}

export function BotonEstado({ id, activo, nombre }: { id: number; activo: boolean; nombre: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-secundario btn-chico"
        aria-label={`${activo ? "Desactivar" : "Activar"} a ${nombre}`}
        onClick={async () => {
          const r = await llamarApi(`/api/usuarios/${id}`, "PATCH", { activo: !activo });
          if (!r.ok) return setError(r.error);
          router.refresh();
        }}
      >
        {activo ? "Desactivar" : "Activar"}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
