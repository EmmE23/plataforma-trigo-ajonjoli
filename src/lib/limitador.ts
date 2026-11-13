/** Limitador simple en memoria de intentos fallidos (protección contra fuerza bruta en el ingreso). */
export type Limitador = {
  permitido(clave: string): boolean;
  registrarFallo(clave: string): void;
  reiniciar(clave: string): void;
  /** Registra un uso y dice si estaba permitido (límite de peticiones por ventana de tiempo). */
  consumir(clave: string): boolean;
};

export function crearLimitador(opts: { maximo: number; ventanaMs: number; reloj?: () => number }): Limitador {
  const reloj = opts.reloj ?? Date.now;
  const fallos = new Map<string, { cuenta: number; desde: number }>();

  const vigente = (clave: string) => {
    const r = fallos.get(clave);
    if (r && reloj() - r.desde > opts.ventanaMs) {
      fallos.delete(clave);
      return undefined;
    }
    return r;
  };

  const permitido = (clave: string) => (vigente(clave)?.cuenta ?? 0) < opts.maximo;
  const registrarFallo = (clave: string) => {
    const r = vigente(clave);
    if (r) r.cuenta += 1;
    else fallos.set(clave, { cuenta: 1, desde: reloj() });
  };

  return {
    permitido,
    registrarFallo,
    reiniciar: (clave) => {
      fallos.delete(clave);
    },
    consumir: (clave) => {
      if (!permitido(clave)) return false;
      registrarFallo(clave);
      return true;
    },
  };
}

type GlobalConLimitadores = typeof globalThis & { __limitadores?: Map<string, Limitador> };

/** Limitador compartido por nombre (uno por ruta pública). */
export function limitadorNombrado(nombre: string, maximo: number, ventanaMs: number): Limitador {
  const g = globalThis as GlobalConLimitadores;
  g.__limitadores ??= new Map();
  let l = g.__limitadores.get(nombre);
  if (!l) {
    l = crearLimitador({ maximo, ventanaMs });
    g.__limitadores.set(nombre, l);
  }
  return l;
}

type GlobalConLimitador = typeof globalThis & { __limitadorIngreso?: Limitador };

/** Instancia compartida para la ruta de ingreso: 5 intentos fallidos cada 15 minutos. */
export function limitadorIngreso(): Limitador {
  const g = globalThis as GlobalConLimitador;
  g.__limitadorIngreso ??= crearLimitador({ maximo: 5, ventanaMs: 15 * 60_000 });
  return g.__limitadorIngreso;
}
