"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { llamarApi } from "../componentes/cliente";

export function EnlacesPanel({ enlaces }: { enlaces: { href: string; texto: string }[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones">
      {enlaces.map((e) => (
        <Link key={e.href} href={e.href} aria-current={ruta === e.href ? "page" : undefined}>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}

export function BotonSalir() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await llamarApi("/api/auth/logout", "POST");
        router.push("/ingreso");
        router.refresh();
      }}
    >
      Cerrar sesión
    </button>
  );
}
