import { redirect } from "next/navigation";
import Link from "next/link";
import { sesionActual } from "@/lib/api";
import { puedeAcceder } from "@/lib/auth";
import { BotonSalir, EnlacesPanel } from "./NavPanel";

export const dynamic = "force-dynamic";

const ENLACES = [
  { href: "/panel/visitas", texto: "Visitas" },
  { href: "/panel/inventario", texto: "Inventario" },
  { href: "/panel/reportes", texto: "Reportes" },
  { href: "/panel/usuarios", texto: "Usuarios" },
  { href: "/panel/donante", texto: "Mis donaciones" },
];

const NOMBRE_ROL: Record<string, string> = {
  administrador: "Administrador",
  recepcionista: "Recepcionista",
  almacenista: "Almacenista",
  donante: "Donante",
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await sesionActual();
  if (!s) redirect("/ingreso");
  const enlaces = ENLACES.filter((e) => puedeAcceder(s.rol, e.href) && !(s.rol === "administrador" && e.href === "/panel/donante"));
  return (
    <div className="panel">
      <aside className="lateral" aria-label="Menú del panel">
        <Link href="/" className="marca">Trigo y Ajonjolí</Link>
        <EnlacesPanel enlaces={enlaces} />
        <div className="sesion">
          <div>Sesión: {s.nombre} · {NOMBRE_ROL[s.rol]}</div>
          <BotonSalir />
        </div>
      </aside>
      <main id="principal" className="contenido">{children}</main>
    </div>
  );
}
