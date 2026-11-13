"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { datosFormulario, llamarApi } from "../../componentes/cliente";
import { Mensaje, type EstadoMensaje } from "../../componentes/Mensaje";

export function NuevoArticulo({ categorias }: { categorias: { id: number; nombre: string }[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<EstadoMensaje>(null);
  return (
    <details style={{ marginTop: 16 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center" }}>
        Agregar artículo al catálogo
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const r = await llamarApi("/api/inventario/articulos", "POST", datosFormulario(form));
          if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
          setMsg({ tipo: "ok", texto: "Artículo creado." });
          form.reset();
          router.refresh();
        }}
      >
        <div className="fila">
          <div className="campo">
            <label htmlFor="art-nombre">Nombre</label>
            <input id="art-nombre" name="nombre" required />
          </div>
          <div className="campo">
            <label htmlFor="art-cat">Categoría</label>
            <select id="art-cat" name="categoria_id">
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="fila">
          <div className="campo">
            <label htmlFor="art-catnueva">O categoría nueva</label>
            <input id="art-catnueva" name="categoria_nueva" />
          </div>
          <div className="campo">
            <label htmlFor="art-unidad">Unidad</label>
            <input id="art-unidad" name="unidad" defaultValue="unidad" required />
          </div>
          <div className="campo">
            <label htmlFor="art-min">Stock mínimo</label>
            <input id="art-min" name="stock_minimo" type="number" min={0} defaultValue={10} required />
          </div>
        </div>
        <Mensaje estado={msg} />
        <button className="btn btn-secundario" type="submit">Crear artículo</button>
      </form>
    </details>
  );
}
