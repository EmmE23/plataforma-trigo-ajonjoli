import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { aforoActual, visitasDeHoy } from "@/lib/repos/visitas";
import { RegistrarEntrada } from "./RegistrarEntrada";
import { BotonSalida } from "./BotonSalida";

export const metadata: Metadata = { title: "Control de visitas · Trigo y Ajonjolí" };
export const dynamic = "force-dynamic";

const formatoPermanencia = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`);

export default async function PaginaVisitas() {
  const db = await getDb();
  const [aforo, visitas] = await Promise.all([aforoActual(db), visitasDeHoy(db)]);
  return (
    <>
      <h1>Control de visitas</h1>
      <div className="rejilla" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <section className="tarjeta" aria-labelledby="t-aforo">
          <h2 id="t-aforo">Aforo actual</h2>
          <p className="cifra" data-testid="aforo">{aforo}</p>
          <p style={{ margin: 0 }}>{aforo === 1 ? "persona dentro" : "personas dentro"}</p>
        </section>
        <section className="tarjeta" aria-labelledby="t-entrada" style={{ gridColumn: "span 2" }}>
          <h2 id="t-entrada">Registrar entrada</h2>
          <RegistrarEntrada />
        </section>
      </div>

      <section className="tarjeta" aria-labelledby="t-hoy" style={{ marginTop: 20 }}>
        <h2 id="t-hoy">Visitas de hoy</h2>
        {visitas.length === 0 ? (
          <p>Aún no hay visitas registradas hoy.</p>
        ) : (
          <div className="tabla-envoltura">
            <table>
              <caption className="sr-only">Visitas del día con hora de entrada, salida y permanencia</caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Entrada</th>
                  <th scope="col">Salida</th>
                  <th scope="col">Permanencia</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visitas.map((v) => (
                  <tr key={v.id}>
                    <td>{v.nombre}</td>
                    <td>{v.documento}</td>
                    <td>{v.motivo}</td>
                    <td>{v.hora_entrada}</td>
                    <td>{v.hora_salida ?? "—"}</td>
                    <td>{formatoPermanencia(v.permanencia_min)}</td>
                    <td>{v.hora_salida ? <span className="etiqueta etiqueta-ok">Salió</span> : <BotonSalida id={v.id} nombre={v.nombre} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
