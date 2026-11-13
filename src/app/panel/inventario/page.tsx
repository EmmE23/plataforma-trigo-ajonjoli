import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { alertasStock, existencias, libroMovimientos, listarCategorias, lotesPorVencer, ordenPeps } from "@/lib/repos/inventario";
import { listarPersonas } from "@/lib/repos/personas";
import { RegistrarMovimiento } from "./RegistrarMovimiento";
import { NuevoArticulo } from "./NuevoArticulo";

export const metadata: Metadata = { title: "Inventario de donativos · Trigo y Ajonjolí" };
export const dynamic = "force-dynamic";

const CLASE_ESTADO = { OK: "etiqueta-ok", "Stock bajo": "etiqueta-alerta", Agotado: "etiqueta-peligro" } as const;
const NOMBRE_TIPO = { entrada: "Entrada", salida: "Salida", merma: "Merma" } as const;

export default async function PaginaInventario() {
  const db = await getDb();
  const [items, alertas, porVencer, peps, libro, categorias, donantes, beneficiarios] = await Promise.all([
    existencias(db),
    alertasStock(db),
    lotesPorVencer(db),
    ordenPeps(db),
    libroMovimientos(db, { limite: 12 }),
    listarCategorias(db),
    listarPersonas(db, "donante"),
    listarPersonas(db, "beneficiario"),
  ]);

  const pepsPorItem = new Map<string, typeof peps>();
  for (const l of peps) pepsPorItem.set(l.item, [...(pepsPorItem.get(l.item) ?? []), l]);
  const nombre = (p: { nombres: string; apellidos: string }) => `${p.nombres} ${p.apellidos}`.trim();

  return (
    <>
      <h1>Inventario de donativos</h1>

      <div className="rejilla rejilla-2">
        <section className="tarjeta" aria-labelledby="t-alertas">
          <h2 id="t-alertas">Alertas de stock mínimo</h2>
          <p className="cifra" data-testid="alertas">{alertas.length}</p>
          {alertas.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {alertas.slice(0, 5).map((a) => (
                <li key={a.id}>{a.nombre}: {a.stock_actual} de mínimo {a.stock_minimo}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="tarjeta" aria-labelledby="t-vencer">
          <h2 id="t-vencer">Lotes por vencer (30 días)</h2>
          <p className="cifra" data-testid="por-vencer">{porVencer.length}</p>
          {porVencer.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {porVencer.slice(0, 5).map((l) => (
                <li key={l.id}>
                  {l.item} · {l.codigo} · vence {l.fecha_vencimiento} ({Number(l.dias_restantes) < 0 ? "vencido" : `${l.dias_restantes} días`}) · {l.cantidad_disponible} disp.
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rejilla" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", marginTop: 20 }}>
        <section className="tarjeta" aria-labelledby="t-exist">
          <h2 id="t-exist">Existencias por artículo</h2>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th scope="col">Artículo</th>
                  <th scope="col">Categoría</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Mínimo</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nombre}</td>
                    <td>{i.categoria}</td>
                    <td>{i.stock_actual}</td>
                    <td>{i.stock_minimo}</td>
                    <td><span className={`etiqueta ${CLASE_ESTADO[i.estado]}`}>{i.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NuevoArticulo categorias={categorias} />
        </section>

        <section className="tarjeta" aria-labelledby="t-mov">
          <h2 id="t-mov">Registrar movimiento</h2>
          <RegistrarMovimiento
            items={items.map((i) => ({ id: i.id, nombre: i.nombre, stock: i.stock_actual, unidad: i.unidad }))}
            lotes={peps.map((l) => ({ id: l.id, item: l.item, codigo: l.codigo, disponible: l.cantidad_disponible, vence: l.fecha_vencimiento }))}
            donantes={donantes.map((p) => ({ id: p.id, nombre: nombre(p) }))}
            beneficiarios={beneficiarios.map((p) => ({ id: p.id, nombre: nombre(p) }))}
          />
        </section>
      </div>

      <section className="tarjeta" aria-labelledby="t-peps" style={{ marginTop: 20 }}>
        <h2 id="t-peps">Orden de salida sugerido (PEPS)</h2>
        {pepsPorItem.size === 0 ? (
          <p>No hay lotes con existencias.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {[...pepsPorItem.entries()].map(([item, lotes]) => (
              <li key={item} style={{ marginBottom: 4 }}>
                <strong>{item}:</strong>{" "}
                {lotes.map((l) => `${l.orden_salida}. ${l.codigo}${l.fecha_vencimiento ? ` · vence ${l.fecha_vencimiento}` : ""} · ${l.cantidad_disponible} disponibles`).join("  |  ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="tarjeta" aria-labelledby="t-libro" style={{ marginTop: 20 }}>
        <h2 id="t-libro">Libro de movimientos (últimos 12)</h2>
        <p style={{ marginTop: 0, fontSize: "0.9rem", color: "var(--texto-suave)" }}>
          Los movimientos no se pueden modificar ni eliminar: cada registro guarda quién lo hizo y cuándo.
        </p>
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Artículo</th>
                <th scope="col">Lote</th>
                <th scope="col">Cantidad</th>
                <th scope="col">Beneficiario / destino</th>
                <th scope="col">Registró</th>
              </tr>
            </thead>
            <tbody>
              {libro.map((m) => (
                <tr key={m.id}>
                  <td>{m.creado_en}</td>
                  <td>{NOMBRE_TIPO[m.tipo]}</td>
                  <td>{m.item}</td>
                  <td>{m.lote}</td>
                  <td>{m.tipo === "entrada" ? `+${m.cantidad}` : `−${m.cantidad}`}</td>
                  <td>{m.beneficiario ?? m.destino ?? "—"}</td>
                  <td>{m.registrado_por}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
