import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fundación Trigo y Ajonjolí",
  description: "Plataforma de gestión de visitas, inventarios y donaciones de la Fundación Trigo y Ajonjolí (Soacha, Cundinamarca).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body>
        <a href="#principal" className="saltar">Saltar al contenido principal</a>
        {children}
      </body>
    </html>
  );
}
