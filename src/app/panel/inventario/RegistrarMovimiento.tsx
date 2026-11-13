"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { datosFormulario, llamarApi } from "../../componentes/cliente";
import { Mensaje, type EstadoMensaje } from "../../componentes/Mensaje";

type Props = {
  items: { id: number; nombre: string; stock: number; unidad: string }[];
  lotes: { id: number; item: string; codigo: string; disponible: number; vence: string | null }[];
  donantes: { id: number; nombre: string }[];
  beneficiarios: { id: number; nombre: string }[];
};

export function RegistrarMovimiento({ items, lotes, donantes, beneficiarios }: Props) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"entrada" | "salida" | "merma">("entrada");
  const [itemId, setItemId] = useState<string>(items[0] ? String(items[0].id) : "");
  const [msg, setMsg] = useState<EstadoMensaje>(null);
  const [ocupado, setOcupado] = useState(false);

  const item = items.find((i) => String(i.id) === itemId);
  const lotesItem = lotes.filter((l) => l.item === item?.nombre);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = datosFormulario(form);
    setOcupado(true);
    setMsg(null);
    let r;
    if (tipo === "entrada") {
      r = await llamarApi<{ codigo: string }>("/api/inventario/entradas", "POST", d);
      if (r.ok) setMsg({ tipo: "ok", texto: `Entrada guardada en el lote ${r.datos.codigo}.` });
    } else {
      const cuerpo = { ...d, tipo, ...(d.lote_id ? {} : { item_id: itemId }) };
      r = await llamarApi<{ aplicados: { codigo?: string; cantidad: number }[] }>("/api/inventario/salidas", "POST", cuerpo);
      if (r.ok) {
        const detalle = r.datos.aplicados.map((a) => `${a.cantidad}${a.codigo ? ` del lote ${a.codigo}` : ""}`).join(", ");
        setMsg({ tipo: "ok", texto: `${tipo === "merma" ? "Merma" : "Salida"} guardada: ${detalle}.` });
      }
    }
    setOcupado(false);
    if (!r.ok) return setMsg({ tipo: "error", texto: r.error });
    form.reset();
    setItemId(itemId);
    router.refresh();
  }

  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label htmlFor="tipo-mov">Tipo</label>
        <select id="tipo-mov" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          <option value="entrada">Entrada (donativo recibido)</option>
          <option value="salida">Salida (entrega)</option>
          <option value="merma">Merma (daño o vencimiento)</option>
        </select>
      </div>
      <div className="campo">
        <label htmlFor="item_id">Artículo</label>
        <select id="item_id" name={tipo === "entrada" ? "item_id" : undefined} value={itemId} onChange={(e) => setItemId(e.target.value)} required>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} (stock {i.stock})
            </option>
          ))}
        </select>
      </div>

      {tipo === "entrada" ? (
        <>
          <p style={{ margin: "0 0 10px", fontSize: "0.9rem" }}>Lote: se crea un lote nuevo con código automático.</p>
          <div className="fila">
            <div className="campo">
              <label htmlFor="cantidad">Cantidad</label>
              <input id="cantidad" name="cantidad" type="number" min={1} step={1} required inputMode="numeric" />
            </div>
            <div className="campo">
              <label htmlFor="fecha_vencimiento">Vencimiento (si aplica)</label>
              <input id="fecha_vencimiento" name="fecha_vencimiento" type="date" />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="donante_id">Donante (opcional)</label>
            <select id="donante_id" name="donante_id" defaultValue="">
              <option value="">Anónimo / no registrado</option>
              {donantes.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="campo">
            <label htmlFor="lote_id">Lote</label>
            <select id="lote_id" name="lote_id" defaultValue="">
              <option value="">Automático según PEPS (recomendado)</option>
              {lotesItem.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} · {l.disponible} disponibles{l.vence ? ` · vence ${l.vence}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="cantidad">Cantidad</label>
            <input id="cantidad" name="cantidad" type="number" min={1} step={1} required inputMode="numeric" />
          </div>
          {tipo === "salida" && (
            <div className="campo">
              <label htmlFor="beneficiario_id">Beneficiario registrado (opcional)</label>
              <select id="beneficiario_id" name="beneficiario_id" defaultValue="">
                <option value="">—</option>
                {beneficiarios.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="campo">
            <label htmlFor="destino">{tipo === "merma" ? "Motivo de la merma" : "Beneficiario o destino"}</label>
            <input id="destino" name="destino" placeholder={tipo === "merma" ? "Ej.: producto vencido" : "Nombre o jornada"} autoComplete="off" />
          </div>
        </>
      )}
      <Mensaje estado={msg} />
      <button className="btn" type="submit" disabled={ocupado || !items.length}>
        {ocupado ? "Guardando…" : "Guardar movimiento"}
      </button>
    </form>
  );
}
