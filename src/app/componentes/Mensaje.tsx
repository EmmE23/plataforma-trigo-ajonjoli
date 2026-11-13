export type EstadoMensaje = { tipo: "ok" | "error" | "info"; texto: string } | null;

/** Mensaje accesible: los errores se anuncian de inmediato (role=alert) y los avisos con cortesía (role=status). */
export function Mensaje({ estado }: { estado: EstadoMensaje }) {
  if (!estado) return <div role="status" aria-live="polite" />;
  return (
    <div className={`mensaje mensaje-${estado.tipo}`} role={estado.tipo === "error" ? "alert" : "status"}>
      {estado.texto}
    </div>
  );
}
