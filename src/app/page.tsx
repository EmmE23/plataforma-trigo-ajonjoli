import { necesidadesActuales } from "@/lib/repos/portal";
import { getDb } from "@/lib/db";
import { Analitica } from "./componentes/portal/Analitica";
import { FormularioVoluntariado } from "./componentes/portal/FormularioVoluntariado";
import styles from "./portal.module.css";

export const dynamic = "force-dynamic";

/** Portal público (wireframe 1 del Anexo D). Los datos [PENDIENTE: …] los debe confirmar la fundación. */
export default async function InicioPage() {
  const necesidades = await necesidadesActuales(await getDb());
  return (
    <div className={styles.portal}>
      <header className={styles.encabezado}>
        <a className={styles.marca} href="/" aria-label="Fundación Trigo y Ajonjolí, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo-trigo-ajonjoli.png" alt="" width={56} height={56} className={styles.logo} />
          Fundación Trigo y Ajonjolí
        </a>
        <nav aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="#quienes-somos">Quiénes somos</a>
          <a href="#como-ayudar">Cómo ayudar</a>
          <a href="#contacto">Contacto</a>
          <a className="btn" href="/donar">Donar</a>
          <a href="/ingreso">Ingreso del personal</a>
        </nav>
      </header>

      <main id="principal" className={styles.contenido}>
        <section className={styles.hero} aria-labelledby="titulo-principal">
          <div>
            <h1 id="titulo-principal">
              Transformar la vida de los habitantes de la calle y de personas en situación de extrema pobreza, mediante una
              atención integral que devuelva su dignidad humana, en Soacha, Bogotá y alrededores
            </h1>
            <p>
              Jornadas en la madrugada con el equipo de apoyo: entregamos comida, ropa y ayuda espiritual, y orientamos a
              algunas personas hacia un centro de rehabilitación.
            </p>
            <div className={styles.acciones}>
              <a className="btn" href="/donar">Donar ahora</a>
              <a className="btn btn-secundario" href="#voluntariado">Quiero ser voluntario</a>
            </div>
          </div>
          <figure className={styles.figuraJornada}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/jornada-entrega.jpg"
              alt="Voluntario de la fundación junto a personas atendidas durante una jornada nocturna de entrega"
              width={780}
              height={1040}
              className={styles.fotoJornada}
            />
            <figcaption>Jornada de entrega. Los rostros se ocultan para proteger la identidad de las personas.</figcaption>
          </figure>
        </section>

        <section className={`rejilla rejilla-3 ${styles.tarjetas}`} aria-label="Nuestra labor">
          <article className="tarjeta">
            <h2>Personas atendidas</h2>
            <p>Desplazados y habitantes de calle · entre 20 y 45 personas por jornada</p>
          </article>
          <article className="tarjeta">
            <h2>Jornadas</h2>
            <p>En la madrugada, con el equipo de apoyo · 2 por semana</p>
          </article>
          <article className="tarjeta">
            <h2>Qué entregamos</h2>
            <p>Comida, ropa y ayuda espiritual</p>
          </article>
        </section>

        <section id="como-ayudar">
          <h2>Cómo puedes ayudar</h2>
          <div className="rejilla rejilla-3">
            <article className="tarjeta">
              <h3>Donar dinero</h3>
              <p>
                Por <strong>Nequi: 350 803 3677</strong> o a la cuenta de ahorros <strong>Bancolombia 20200003464</strong>; o pago
                en línea (modo de pruebas).
              </p>
              <a className={styles.enlaces} href="/donar">Conoce cómo donar</a>
            </article>
            <article className="tarjeta">
              <h3>Donar enseres</h3>
              <p>Ropa, zapatos, comida no perecedera, libros, cuadernos y útiles, artículos de aseo, mantas y toallas.</p>
              <p><strong>Lo que más necesitamos hoy:</strong></p>
              {necesidades.length ? (
                <ul>
                  {necesidades.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p>En este momento no hay artículos por debajo del mínimo de inventario.</p>
              )}
              <p><em>La lista se actualiza según el inventario</em></p>
            </article>
            <article className="tarjeta">
              <h3>Voluntariado</h3>
              <p>Tu mejor disposición: no buscamos profesionales, sino personas que quieran servir con un corazón sincero.</p>
              <a className={styles.enlaces} href="#voluntariado">Quiero ser voluntario</a>
            </article>
          </div>
        </section>

        <section id="quienes-somos">
          <h2>Quiénes somos</h2>
          <p>
            Somos una entidad sin ánimo de lucro con siete años de funcionamiento y sede en el barrio Maipore (Soacha). Apoyamos
            a personas de bajos recursos y habitantes de calle con actividades y entrega de donativos de enseres de primera
            mano, en jornadas en distintos puntos de la Sabana de Bogotá y de Cundinamarca.
          </p>
        </section>

        <section id="voluntariado" aria-labelledby="titulo-voluntariado">
          <div className="tarjeta">
            <h2 id="titulo-voluntariado">Súmate como voluntario</h2>
            <p>Cuéntanos cómo te gustaría ayudar.</p>
            <FormularioVoluntariado />
          </div>
        </section>
      </main>

      <footer id="contacto" className={styles.pie}>
        <p>
          Barrio Maipore, Soacha (Cundinamarca) · <a href="mailto:fundaciontrijoli@outlook.com">fundaciontrijoli@outlook.com</a> ·{" "}
          <a href="tel:+573508033677">350 803 3677</a>
        </p>
        <p>
          <a href="https://www.facebook.com/share/19y6Bum7vu/" target="_blank" rel="noopener noreferrer">Síguenos en Facebook</a>
        </p>
        <p>NIT 901.243.769-6</p>
      </footer>
      <Analitica ruta="/" />
    </div>
  );
}
