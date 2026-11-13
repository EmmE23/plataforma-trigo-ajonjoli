"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { llamarApi } from "../../componentes/cliente";

export function BotonSalida({ id, nombre }: { id: number; nombre: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-secundario btn-chico"
        disabled={ocupado}
        aria-label={`Registrar salida de ${nombre}`}
        onClick={async () => {
          setOcupado(true);
          const r = await llamarApi(`/api/visitas/${id}/salida`, "POST");
          setOcupado(false);
          if (!r.ok) return setError(r.error);
          router.refresh();
        }}
      >
        Registrar salida
      </button>
      {error && <span role="alert" className="etiqueta etiqueta-peligro">{error}</span>}
    </>
  );
}
