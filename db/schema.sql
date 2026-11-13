-- =====================================================================
-- Plataforma web Fundación Trigo y Ajonjolí — Esquema PostgreSQL
-- Compatible con PGlite (demo local) y con Supabase (producción).
-- 9 tablas del modelo + 1 tabla auxiliar de analítica, 4 vistas,
-- trigger de stock por lote y bloqueo de edición del libro de movimientos.
-- =====================================================================

create table if not exists perfiles (
  id             integer generated always as identity primary key,
  nombre         text not null check (length(trim(nombre)) > 0),
  email          text not null unique,
  password_hash  text not null,
  rol            text not null check (rol in ('administrador','recepcionista','almacenista','donante')),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create table if not exists personas (
  id                    integer generated always as identity primary key,
  tipo_documento        text not null check (tipo_documento in ('CC','TI','CE','PA','PPT','NIT','SD')),
  numero_documento      text not null check (length(trim(numero_documento)) > 0),
  nombres               text not null,
  apellidos             text not null default '',
  tipo                  text not null check (tipo in ('visitante','voluntario','donante','beneficiario')),
  telefono              text,
  email                 text,
  consentimiento_datos  boolean not null check (consentimiento_datos),   -- Ley 1581 de 2012
  fecha_consentimiento  timestamptz not null default now(),
  codigo_qr             text not null unique default ('TA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10))),
  creado_en             timestamptz not null default now(),
  unique (tipo_documento, numero_documento)
);

create table if not exists visitas (
  id              integer generated always as identity primary key,
  persona_id      integer not null references personas(id),
  motivo          text not null default 'Visita',
  hora_entrada    timestamptz not null default now(),
  hora_salida     timestamptz,
  registrada_por  integer not null references perfiles(id),
  check (hora_salida is null or hora_salida >= hora_entrada)
);
-- Una sola visita abierta por persona
create unique index if not exists ux_visita_abierta on visitas(persona_id) where hora_salida is null;

create table if not exists categorias (
  id      integer generated always as identity primary key,
  nombre  text not null unique
);

create table if not exists items (
  id            integer generated always as identity primary key,
  categoria_id  integer not null references categorias(id),
  nombre        text not null unique,
  unidad        text not null default 'unidad',
  stock_actual  integer not null default 0 check (stock_actual >= 0),
  stock_minimo  integer not null default 0 check (stock_minimo >= 0)
);

create table if not exists lotes (
  id                   integer generated always as identity primary key,
  item_id              integer not null references items(id),
  donante_id           integer references personas(id),
  codigo               text not null unique,
  fecha_ingreso        date not null default current_date,
  fecha_vencimiento    date,
  cantidad_disponible  integer not null default 0 check (cantidad_disponible >= 0)
);

create table if not exists movimientos_inventario (
  id              integer generated always as identity primary key,
  lote_id         integer not null references lotes(id),
  tipo            text not null check (tipo in ('entrada','salida','merma')),
  cantidad        integer not null check (cantidad > 0),
  beneficiario_id integer references personas(id),
  destino         text,
  observacion     text,
  registrado_por  integer not null references perfiles(id),
  creado_en       timestamptz not null default now(),
  -- Las salidas y mermas deben indicar beneficiario o destino/motivo
  check (tipo = 'entrada' or beneficiario_id is not null or (destino is not null and length(trim(destino)) > 0))
);
create index if not exists ix_mov_creado on movimientos_inventario(creado_en);

create table if not exists donaciones_dinero (
  id                   integer generated always as identity primary key,
  persona_id           integer references personas(id),
  nombre_donante       text not null,
  email                text not null,
  monto_cop            numeric(12,0) not null check (monto_cop >= 1000),
  estado               text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  referencia_pasarela  text not null unique,
  modo_prueba          boolean not null default true,
  consentimiento_datos boolean not null check (consentimiento_datos),
  creado_en            timestamptz not null default now()
);

create table if not exists solicitudes_voluntariado (
  id                    integer generated always as identity primary key,
  nombre                text not null,
  email                 text not null,
  telefono              text,
  mensaje               text,
  consentimiento_datos  boolean not null check (consentimiento_datos),
  estado                text not null default 'nueva' check (estado in ('nueva','contactada','aceptada','descartada')),
  creado_en             timestamptz not null default now()
);

-- Auxiliar: analítica propia del portal (sin cookies ni datos personales)
create table if not exists analitica_visitas (
  id         integer generated always as identity primary key,
  ruta       text not null,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Trigger de stock: actualiza lote e ítem y bloquea salidas sin existencias
-- ---------------------------------------------------------------------
create or replace function fn_aplicar_movimiento() returns trigger language plpgsql as $$
declare
  v_disponible integer;
  v_item       integer;
  v_delta      integer;
begin
  select cantidad_disponible, item_id into v_disponible, v_item
    from lotes where id = new.lote_id for update;
  if not found then
    raise exception 'El lote % no existe', new.lote_id;
  end if;

  if new.tipo = 'entrada' then
    v_delta := new.cantidad;
  else
    if new.cantidad > v_disponible then
      raise exception 'Stock insuficiente: el lote tiene % unidades y se intentó retirar %', v_disponible, new.cantidad
        using errcode = 'P0001';
    end if;
    v_delta := -new.cantidad;
  end if;

  update lotes set cantidad_disponible = cantidad_disponible + v_delta where id = new.lote_id;
  update items set stock_actual = stock_actual + v_delta where id = v_item;
  return new;
end $$;

create or replace function fn_bloquear_edicion_movimiento() returns trigger language plpgsql as $$
begin
  raise exception 'Los movimientos de inventario no se pueden modificar ni eliminar';
end $$;

drop trigger if exists tg_aplicar_movimiento on movimientos_inventario;
create trigger tg_aplicar_movimiento before insert on movimientos_inventario
  for each row execute function fn_aplicar_movimiento();

drop trigger if exists tg_bloquear_edicion on movimientos_inventario;
create trigger tg_bloquear_edicion before update or delete on movimientos_inventario
  for each row execute function fn_bloquear_edicion_movimiento();

-- ---------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------
create or replace view v_alertas_stock as
  select i.id, i.nombre, c.nombre as categoria, i.stock_actual, i.stock_minimo
    from items i join categorias c on c.id = i.categoria_id
   where i.stock_actual <= i.stock_minimo;

create or replace view v_lotes_peps as
  select l.id, l.codigo, l.item_id, i.nombre as item, l.fecha_ingreso, l.fecha_vencimiento, l.cantidad_disponible,
         row_number() over (partition by l.item_id order by l.fecha_ingreso, l.id) as orden_salida
    from lotes l join items i on i.id = l.item_id
   where l.cantidad_disponible > 0;

create or replace view v_lotes_por_vencer as
  select l.id, l.codigo, i.nombre as item, l.fecha_vencimiento, l.cantidad_disponible,
         (l.fecha_vencimiento - current_date) as dias_restantes
    from lotes l join items i on i.id = l.item_id
   where l.cantidad_disponible > 0
     and l.fecha_vencimiento is not null
     and l.fecha_vencimiento <= current_date + 30;

create or replace view v_aforo_actual as
  select count(*)::integer as personas_dentro from visitas where hora_salida is null;
