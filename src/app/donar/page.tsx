import type { Metadata } from "next";
import { FormularioDonacion } from "./FormularioDonacion";
import { Analitica } from "../componentes/portal/Analitica";
import styles from "../portal.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Donar | Fundación Trigo y Ajonjolí" };

export default function DonarPage() {
  return (
    <div className={styles.portal}>
      <header className={styles.encabezado}>
        <a className={styles.marca} href="/">Fundación Trigo y Ajonjolí</a>
        <nav aria-label="Navegación principal">
          <a href="/">Inicio</a>
        </nav>
      </header>
      <main id="principal" className={styles.contenido}>
        <h1>Apoya nuestra labor</h1>
        <p>Tu aporte ayuda a acompañar a personas en situación de vulnerabilidad.</p>
        <section className="tarjeta" aria-label="Formulario de donación">
          <FormularioDonacion />
        </section>
      </main>
      <footer className={styles.pie}>Fundación Trigo y Ajonjolí · NIT 901.243.769-6</footer>
      <Analitica ruta="/donar" />
    </div>
  );
}
