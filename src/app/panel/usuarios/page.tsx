import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { sesionActual } from "@/lib/api";
import { listarUsuarios } from "@/lib/repos/usuarios";
import { BotonEstado, CrearUsuario, RestablecerPassword } from "./GestionUsuarios";

export const metadata: Metadata = { title: "Usuarios · Trigo y Ajonjolí" };
export const dynamic = "force-dynamic";

export default async function PaginaUsuarios() {
  const [usuarios, s] = await Promise.all([listarUsuarios(await getDb()), sesionActual()]);
  return (
    <>
      <h1>Usuarios</h1>
      <div className="rejilla" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <section className="tarjeta" aria-labelledby="t-lista">
          <h2 id="t-lista">Personal con acceso</h2>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td style={{ textTransform: "capitalize" }}>{u.rol}</td>
                    <td>
                      <span className={`etiqueta ${u.activo ? "etiqueta-ok" : "etiqueta-peligro"}`}>{u.activo ? "Activo" : "Inactivo"}</span>
                    </td>
                    <td>
                      <div className="fila" style={{ gap: 8 }}>
                        {String(u.id) !== s?.sub && <BotonEstado id={u.id} activo={u.activo} nombre={u.nombre} />}
                        <RestablecerPassword id={u.id} nombre={u.nombre} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="tarjeta" aria-labelledby="t-nuevo">
          <h2 id="t-nuevo">Crear usuario</h2>
          <CrearUsuario />
        </section>
      </div>
    </>
  );
}
