import type { Metadata } from "next";
import Link from "next/link";
import { FormularioIngreso } from "./FormularioIngreso";

export const metadata: Metadata = { title: "Ingreso del personal · Fundación Trigo y Ajonjolí" };

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<{ siguiente?: string }> }) {
  const { siguiente } = await searchParams;
  // Solo se permiten redirecciones internas al panel (evita redirecciones abiertas).
  const destino = siguiente && /^\/panel(\/[a-z]+)?$/.test(siguiente) ? siguiente : undefined;
  return (
    <main id="principal" style={{ maxWidth: 460, margin: "0 auto", padding: "56px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: "1.2rem", textDecoration: "none" }}>
          Fundación Trigo y Ajonjolí
        </Link>
        <h1 style={{ marginTop: 18 }}>Ingreso del personal</h1>
      </div>
      <div className="tarjeta">
        <FormularioIngreso destino={destino} />
      </div>
      <p style={{ textAlign: "center", color: "var(--texto-suave)", fontSize: "0.95rem" }}>
        Según el rol, el sistema lleva a Visitas (recepcionista), a Inventario (almacenista), a Reportes (administrador) o al
        panel del donante.
      </p>
    </main>
  );
}
