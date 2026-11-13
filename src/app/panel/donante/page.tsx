import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { sesionActual } from "@/lib/api";
import { donacionesDeDonante } from "@/lib/repos/reportes";

export const metadata: Metadata = { title: "Mis donaciones · Trigo y Ajonjolí" };
export const dynamic = "force-dynamic";

const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

export default async function PaginaDonante() {
  const db = await getDb();
  const s = await sesionActual();
  const perfil = await db.query<{ email: string }>(`select email from perfiles where id = $1`, [Number(s?.sub)]);
  const donaciones = perfil.rows[0] ? await donacionesDeDonante(db, perfil.rows[0].email) : [];
  const total = donaciones.filter((d) => d.estado === "aprobada").reduce((t, d) => t + Number(d.monto_cop), 0);

  return (
    <>
      <h1>Mis donaciones</h1>
      <p>Gracias por apoyar a la Fundación Trigo y Ajonjolí. Aquí puede consultar las donaciones hechas con su correo.</p>
      <div className="rejilla rejilla-3">
        <div className="tarjeta">
          <h2>Total aportado</h2>
          <p className="cifra">{cop(total)}</p>
        </div>
        <div className="tarjeta">
          <h2>Donaciones</h2>
          <p className="cifra">{donaciones.length}</p>
        </div>
      </div>
      <section className="tarjeta" style={{ marginTop: 20 }} aria-labelledby="t-hist">
        <h2 id="t-hist">Historial</h2>
        {donaciones.length === 0 ? (
          <p>Aún no hay donaciones registradas con su correo.</p>
        ) : (
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Monto</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {donaciones.map((d) => (
                  <tr key={d.id}>
                    <td>{d.creado_en}</td>
                    <td>{cop(Number(d.monto_cop))}</td>
                    <td>{d.estado}{d.modo_prueba ? " (prueba)" : ""}</td>
                    <td><code>{d.referencia_pasarela.slice(0, 18)}…</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p style={{ marginTop: 20 }}>
        <Link className="btn" href="/donar">Hacer una nueva donación</Link>
      </p>
    </>
  );
}
