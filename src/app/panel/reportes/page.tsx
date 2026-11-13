import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { sesionActual } from "@/lib/api";
import { esquemaPeriodo, listarDonaciones, listarVoluntarios, reporteMovimientos, reporteVisitas, resumenGeneral } from "@/lib/repos/reportes";
import { resumenAnalitica } from "@/lib/repos/portal";
import { hoyBogota } from "@/lib/validacion";

export const metadata: Metadata = { title: "Reportes · Trigo y Ajonjolí" };
export const dynamic = "force-dynamic";

const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default async function PaginaReportes({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const sp = await searchParams;
  const hoy = hoyBogota();
  const pedido = { desde: sp.desde ?? `${hoy.slice(0, 8)}01`, hasta: sp.hasta ?? hoy };
  const valido = esquemaPeriodo.safeParse(pedido);
  const periodo = valido.success ? valido.data : { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };

  const db = await getDb();
  const s = await sesionActual();
  const esAdmin = s?.rol === "administrador";
  const [resumen, mov, vis, analitica, voluntarios, donaciones] = await Promise.all([
    resumenGeneral(db),
    reporteMovimientos(db, periodo),
    reporteVisitas(db, periodo),
    resumenAnalitica(db, 30),
    esAdmin ? listarVoluntarios(db) : Promise.resolve([]),
    esAdmin ? listarDonaciones(db) : Promise.resolve([]),
  ]);
  const qs = `desde=${periodo.desde}&hasta=${periodo.hasta}`;

  return (
    <>
      <h1>Reportes</h1>

      <section aria-labelledby="t-resumen">
        <h2 id="t-resumen" className="sr-only">Resumen general</h2>
        <div className="rejilla rejilla-3">
          <Tarjeta titulo="Aforo actual" valor={resumen.aforo} />
          <Tarjeta titulo="Visitas de hoy" valor={resumen.visitasHoy} />
          <Tarjeta titulo="Artículos en alerta" valor={resumen.articulosEnAlerta} />
          <Tarjeta titulo="Lotes por vencer" valor={resumen.lotesPorVencer} />
          <Tarjeta titulo="Donaciones del mes (prueba)" valor={cop(resumen.donacionesMesCop)} />
          <Tarjeta titulo="Visitas al portal (30 días)" valor={analitica.total} />
        </div>
      </section>

      <form className="tarjeta fila" style={{ marginTop: 20 }} method="get" aria-label="Periodo del reporte">
        <div className="campo">
          <label htmlFor="desde">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={periodo.desde} required />
        </div>
        <div className="campo">
          <label htmlFor="hasta">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={periodo.hasta} required />
        </div>
        <button className="btn" type="submit" style={{ marginBottom: 14 }}>Consultar</button>
        <a className="btn btn-secundario" style={{ marginBottom: 14 }} href={`/api/reportes?${qs}&formato=csv`} download>
          Descargar CSV (Excel)
        </a>
      </form>
      {!valido.success && <p className="mensaje mensaje-error" role="alert">{valido.error.issues[0]?.message}. Se muestra el mes actual.</p>}

      <section className="tarjeta" style={{ marginTop: 20 }} aria-labelledby="t-mov">
        <h2 id="t-mov">Entradas y salidas del {periodo.desde} al {periodo.hasta}</h2>
        <div className="rejilla rejilla-3" style={{ marginBottom: 16 }}>
          <div><strong>Entradas:</strong> {mov.totales.entradas} unidades</div>
          <div><strong>Salidas:</strong> {mov.totales.salidas} unidades</div>
          <div><strong>Mermas:</strong> {mov.totales.mermas} unidades</div>
        </div>
        {mov.porArticulo.length === 0 ? (
          <p>No hay movimientos en el periodo.</p>
        ) : (
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th scope="col">Artículo</th>
                  <th scope="col">Entradas</th>
                  <th scope="col">Salidas</th>
                  <th scope="col">Mermas</th>
                  <th scope="col">Balance</th>
                </tr>
              </thead>
              <tbody>
                {mov.porArticulo.map((a) => (
                  <tr key={a.item}>
                    <td>{a.item}</td>
                    <td>{a.entradas}</td>
                    <td>{a.salidas}</td>
                    <td>{a.mermas}</td>
                    <td>{a.entradas - a.salidas - a.mermas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta" style={{ marginTop: 20 }} aria-labelledby="t-vis">
        <h2 id="t-vis">Visitas del periodo: {vis.total}</h2>
        {vis.porDia.length > 0 && (
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Visitas</th>
                  <th scope="col">Permanencia promedio</th>
                </tr>
              </thead>
              <tbody>
                {vis.porDia.map((d) => (
                  <tr key={d.dia}>
                    <td>{d.dia}</td>
                    <td>{d.total}</td>
                    <td>{d.permanencia_promedio_min === null ? "—" : `${d.permanencia_promedio_min} min`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {esAdmin && (
        <div className="rejilla rejilla-2" style={{ marginTop: 20 }}>
          <section className="tarjeta" aria-labelledby="t-volun">
            <h2 id="t-volun">Solicitudes de voluntariado ({voluntarios.length})</h2>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {voluntarios.slice(0, 10).map((v) => (
                <li key={v.id}>{v.creado_en} · {v.nombre} · {v.email}{v.telefono ? ` · ${v.telefono}` : ""} · <em>{v.estado}</em></li>
              ))}
            </ul>
          </section>
          <section className="tarjeta" aria-labelledby="t-don">
            <h2 id="t-don">Donaciones en línea (modo de pruebas)</h2>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {donaciones.slice(0, 10).map((d) => (
                <li key={d.id}>{d.creado_en} · {d.nombre_donante} · {cop(Number(d.monto_cop))} · <em>{d.estado}</em></li>
              ))}
            </ul>
          </section>
          <section className="tarjeta" aria-labelledby="t-analitica">
            <h2 id="t-analitica">Páginas más visitadas del portal (30 días)</h2>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {analitica.porRuta.map((r) => (
                <li key={r.ruta}>{r.ruta}: {r.total}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string | number }) {
  return (
    <div className="tarjeta">
      <h3 style={{ margin: "0 0 8px", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--texto-suave)" }}>{titulo}</h3>
      <p className="cifra" style={{ fontSize: "2rem" }}>{valor}</p>
    </div>
  );
}
