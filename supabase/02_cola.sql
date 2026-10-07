-- HaxMatch · Paso 2: cola, grupos, salas y matches entre usuarios reales
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Necesita que antes se haya ejecutado 01_perfiles.sql.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Cómo está pensado:
-- - La app no toca estas tablas directamente. Todo pasa por las funciones de
--   abajo, que son las que aplican las reglas (una sola búsqueda activa,
--   cupos de la sala, quién puede aceptar a quién, cuándo cuenta un partido).
-- - "estado_cola" devuelve de una vez todo lo que la app necesita mostrar.
-- - La tabla "cambios" es solo una señal: cada vez que algo cambia se
--   actualiza, y las apps abiertas vuelven a pedir el estado.

-- ---------------------------------------------------------------------------
-- Refuerzos sobre los perfiles del paso 1
-- ---------------------------------------------------------------------------

-- El nick, la región y la foto ahora los ven los demás jugadores en la cola:
-- no pueden traer saltos de línea ni ser enormes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_nick_limpio') then
    alter table public.profiles add constraint perfiles_nick_limpio
      check (nick = btrim(nick) and nick !~ '[[:cntrl:]]') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfiles_region_corta') then
    alter table public.profiles add constraint perfiles_region_corta
      check (cardinality(region) <= 4 and array_ndims(region) = 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'perfiles_foto_corta') then
    alter table public.profiles add constraint perfiles_foto_corta
      check (foto_url is null or char_length(foto_url) <= 300) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.busquedas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  modo text not null check (modo in ('jugador', 'sala')),
  -- Las salas no tienen modalidad.
  formato text[],
  posicion text[] not null,
  cancha text[] not null,
  region text[] not null,
  nombre_sala text,
  -- Sala: lugares libres en este momento.
  faltan int check (faltan is null or faltan between 0 and 7),
  -- Sala: momento en que se llenó. Desde ahí el reloj queda quieto.
  completa_at timestamptz,
  creada_at timestamptz not null default now(),
  -- null = hasta conseguir partido.
  expira_at timestamptz,
  -- agrupada: se sumó a la búsqueda de otro jugador (lider_id) y comparte su reloj.
  -- match: terminó en partido. cerrada: sala que su dueño cerró (o que venció) con gente adentro.
  estado text not null default 'activa' check (estado in ('activa', 'agrupada', 'cancelada', 'vencida', 'match', 'cerrada')),
  lider_id uuid references public.busquedas (id) on delete set null,
  -- Jugador: el grupo ya es un equipo completo y falta que quien lo armó cree la sala.
  equipo_listo boolean not null default false,
  -- Sala: partido que reúne a los que fueron entrando.
  match_id uuid,
  -- Sala: jugadores que el dueño rechazó, para no volver a acercárselos.
  rechazados uuid[] not null default '{}',
  -- Respuesta al cartel "¿Te avisamos?".
  avisar boolean,
  -- Última vez que la app de este usuario dio señales de vida.
  visto_at timestamptz not null default now()
);

-- Una sola búsqueda activa por usuario.
create unique index if not exists busquedas_una_activa on public.busquedas (user_id) where estado in ('activa', 'agrupada');
create index if not exists busquedas_por_estado on public.busquedas (estado);
create index if not exists busquedas_por_lider on public.busquedas (lider_id) where estado = 'agrupada';

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  -- Quién creó la sala en HaxBall.
  creado_por uuid not null references public.profiles (id) on delete cascade,
  cancha text not null,
  nombre_sala text not null,
  creado_at timestamptz not null default now(),
  -- Momento en que el partido pasó a contar como válido.
  contado_at timestamptz
);

create table if not exists public.match_participantes (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- A: quien creó la sala y el grupo con el que la armó. B: los que entran después.
  equipo text not null check (equipo in ('A', 'B')),
  -- Confirmación propia ("Ya entré a la sala", o el dueño al marcar que alguien entró).
  confirmado_at timestamptz,
  -- El dueño de la sala marcó "Ya entró".
  entro_at timestamptz,
  -- El usuario dijo que no lo jugó.
  descarto boolean not null default false,
  -- El dueño marcó "Se salió" cuando el partido ya le contaba: deja el lugar, pero el partido le queda.
  salio_at timestamptz,
  primary key (match_id, user_id)
);
create index if not exists participantes_por_usuario on public.match_participantes (user_id);

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references public.profiles (id) on delete cascade,
  a uuid not null references public.profiles (id) on delete cascade,
  texto text not null,
  creado_at timestamptz not null default now(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
  -- Lo generó el emparejamiento automático, no una persona.
  auto boolean not null default false,
  -- Jugadores que vienen en grupo con quien escribe.
  con uuid[] not null default '{}'
);
create index if not exists mensajes_pendientes_a on public.mensajes (a) where estado = 'pendiente';
create index if not exists mensajes_pendientes_de on public.mensajes (de) where estado = 'pendiente';
create index if not exists mensajes_por_a on public.mensajes (a, creado_at);
create index if not exists mensajes_por_de on public.mensajes (de, creado_at);

-- Reportes de jugadores. Los lee el equipo desde Supabase (Table Editor > reportes).
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references public.profiles (id) on delete cascade,
  reportado uuid not null references public.profiles (id) on delete cascade,
  motivo text not null,
  detalle text not null default '',
  creado_at timestamptz not null default now()
);
create index if not exists reportes_por_reportado on public.reportes (reportado);

-- Señal de "algo cambió" para el tiempo real. No guarda datos de nadie.
create table if not exists public.cambios (
  id int primary key check (id = 1),
  version bigint not null default 0,
  at timestamptz not null default now()
);
insert into public.cambios (id) values (1) on conflict (id) do nothing;

-- Nadie lee ni escribe estas tablas directo: solo a través de las funciones.
alter table public.busquedas enable row level security;
alter table public.matches enable row level security;
alter table public.match_participantes enable row level security;
alter table public.mensajes enable row level security;
alter table public.cambios enable row level security;
alter table public.reportes enable row level security;
revoke all on public.busquedas, public.matches, public.match_participantes, public.mensajes, public.cambios, public.reportes from anon, authenticated;

-- La señal sí se puede escuchar.
grant select on public.cambios to authenticated;
drop policy if exists "cambios: lectura" on public.cambios;
create policy "cambios: lectura" on public.cambios for select to authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cambios'
     ) then
    alter publication supabase_realtime add table public.cambios;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Funciones internas (la app no las puede llamar)
-- ---------------------------------------------------------------------------

create or replace function public._avisar()
returns void language sql security definer set search_path = '' as $$
  update public.cambios set version = version + 1, at = now() where id = 1
$$;

-- Los cambios en la cola se hacen de a uno. Así dos personas que tocan al mismo
-- tiempo (dos salas aceptando al mismo jugador, por ejemplo) no se pisan.
create or replace function public._turno()
returns void language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(48293011)
$$;

-- Cuántos jugadores van juntos en una búsqueda (quien la creó más los que se sumaron).
create or replace function public._somos(p_busqueda uuid)
returns int language sql stable security definer set search_path = '' as $$
  select 1 + count(*)::int from public.busquedas where lider_id = p_busqueda and estado = 'agrupada'
$$;

create or replace function public._miembros(p_busqueda uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(user_id order by creada_at), '{}'::uuid[])
  from public.busquedas where lider_id = p_busqueda and estado = 'agrupada'
$$;

-- ¿Pueden jugar juntos? Comparten región y cancha ("Cualquiera" acepta todas).
create or replace function public._compatibles(p_region_a text[], p_cancha_a text[], p_region_b text[], p_cancha_b text[])
returns boolean language sql immutable set search_path = '' as $$
  select p_region_a && p_region_b
     and ('Cualquiera' = any (p_cancha_a) or 'Cualquiera' = any (p_cancha_b) or p_cancha_a && p_cancha_b)
$$;

-- ¿El grupo ya es un equipo completo? Tres buscando 3v3 lo son. En 1v1 hacen falta los dos.
-- Con varias modalidades marcadas vale la más chica. Con "Cualquiera" nunca se completa solo.
create or replace function public._equipo_completo(p_formato text[], p_cuantos int)
returns boolean language sql immutable set search_path = '' as $$
  -- count(*) > 0: sin modalidades concretas no hay equipo que completar.
  select count(*) > 0 and p_cuantos >= greatest(min(left(f, 1)::int), 2)
  from unnest(coalesce(p_formato, '{}'::text[])) as f
  where f <> 'Cualquiera'
$$;

-- Con qué cancha se arma el match: la primera concreta que les sirve a los dos.
create or replace function public._elegir_cancha(p_a text[], p_b text[])
returns text language sql immutable set search_path = '' as $$
  select coalesce(
    (select c from unnest(p_a) with ordinality as t (c, n) where c <> 'Cualquiera' and c = any (coalesce(p_b, '{}'::text[])) order by n limit 1),
    (select c from unnest(p_a) with ordinality as t (c, n) where c <> 'Cualquiera' order by n limit 1),
    (select c from unnest(coalesce(p_b, '{}'::text[])) with ordinality as t (c, n) where c <> 'Cualquiera' order by n limit 1),
    'Cualquiera')
$$;

create or replace function public._recalcular_grupo(p_busqueda uuid)
returns void language sql security definer set search_path = '' as $$
  update public.busquedas
  set equipo_listo = (modo = 'jugador' and public._equipo_completo(formato, public._somos(id)))
  where id = p_busqueda
$$;

-- El partido cuenta cuando confirmó uno de cada lado.
create or replace function public._evaluar(p_match uuid)
returns void language sql security definer set search_path = '' as $$
  update public.matches m
  set contado_at = now()
  where m.id = p_match and m.contado_at is null
    and exists (select 1 from public.match_participantes p where p.match_id = m.id and p.equipo = 'A' and p.confirmado_at is not null)
    and exists (select 1 from public.match_participantes p where p.match_id = m.id and p.equipo = 'B' and p.confirmado_at is not null)
$$;

-- Termina una búsqueda que no llegó a match (cancelada por su dueño o vencida).
create or replace function public._terminar(p_busqueda uuid, p_estado text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  b public.busquedas;
  con_gente boolean;
begin
  select * into b from public.busquedas where id = p_busqueda and estado in ('activa', 'agrupada') for update;
  if not found then
    return;
  end if;

  if b.estado = 'agrupada' then
    -- Estaba sumado a la búsqueda de otro: sale del grupo.
    update public.busquedas set estado = p_estado, lider_id = null where id = b.id;
    perform public._recalcular_grupo(b.lider_id);
  else
    con_gente := b.match_id is not null and exists (
      select 1 from public.match_participantes where match_id = b.match_id and user_id <> b.user_id and salio_at is null);
    if b.modo = 'sala' and con_gente then
      -- Una sala donde ya entró gente no se cancela: se cierra y el partido queda.
      update public.busquedas set estado = 'cerrada' where id = b.id;
    else
      if b.match_id is not null then
        delete from public.matches where id = b.match_id and contado_at is null;
      end if;
      update public.busquedas set estado = p_estado, match_id = null, equipo_listo = false where id = b.id;
      -- Los que se habían sumado vuelven a la cola por su cuenta, con el reloj en cero.
      update public.busquedas
      set estado = 'activa', lider_id = null, creada_at = now(), visto_at = now(),
          expira_at = case when expira_at is not null then now() + interval '15 minutes' end
      where lider_id = b.id and estado = 'agrupada';
    end if;
  end if;

  -- Los mensajes sin responder se caen con la búsqueda.
  update public.mensajes set estado = 'rechazado'
  where estado = 'pendiente' and (de = b.user_id or a = b.user_id);
end $$;

-- Jugadores que ocupan un lugar en una sala. Todos los que entran a una misma
-- sala quedan en un solo partido, y la sala sigue buscando si le faltan más.
create or replace function public._ocupar(p_sala uuid, p_ids uuid[], p_equipo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sala public.busquedas;
  v_match uuid;
  v_faltan int;
  v_libres int;
begin
  select * into sala from public.busquedas where id = p_sala and estado = 'activa' and modo = 'sala' for update;
  if not found then
    raise exception 'Esa sala ya no está buscando';
  end if;
  if p_equipo = 'B' and cardinality(p_ids) > coalesce(sala.faltan, 0) then
    raise exception 'No entran todos en esa sala';
  end if;
  -- Todos los que entran tienen que seguir buscando (otra sala pudo aceptarlos antes).
  select count(*) into v_libres from (
    select 1 from public.busquedas
    where user_id = any (p_ids) and estado in ('activa', 'agrupada') order by id for update) t;
  if v_libres <> cardinality(p_ids) then
    raise exception 'Ese jugador ya no está buscando';
  end if;
  -- Nadie ocupa dos lugares en la misma sala.
  if sala.match_id is not null and exists (
    select 1 from public.match_participantes
    where match_id = sala.match_id and user_id = any (p_ids) and salio_at is null) then
    raise exception 'Ese jugador ya está en la sala';
  end if;

  v_match := sala.match_id;
  if v_match is null then
    insert into public.matches (creado_por, cancha, nombre_sala)
    values (sala.user_id, public._elegir_cancha(sala.cancha, null), coalesce(sala.nombre_sala, ''))
    returning id into v_match;
    insert into public.match_participantes (match_id, user_id, equipo) values (v_match, sala.user_id, 'A');
  end if;

  -- Si alguno ya había pasado por esta sala y se había ido, vuelve a ocupar un lugar.
  insert into public.match_participantes (match_id, user_id, equipo)
  select v_match, u, p_equipo from unnest(p_ids) as u
  on conflict (match_id, user_id) do update set salio_at = null, entro_at = null, equipo = excluded.equipo;

  -- El match cierra la búsqueda de todos los que entran.
  update public.busquedas set estado = 'match', lider_id = null, equipo_listo = false
  where user_id = any (p_ids) and estado in ('activa', 'agrupada');
  update public.mensajes set estado = 'rechazado'
  where estado = 'pendiente' and (de = any (p_ids) or a = any (p_ids));

  v_faltan := case when p_equipo = 'B' then greatest(0, coalesce(sala.faltan, 0) - cardinality(p_ids)) else coalesce(sala.faltan, 0) end;
  update public.busquedas
  set faltan = v_faltan,
      match_id = v_match,
      -- Al llenarse la sala se frena el reloj: ya no se busca a nadie.
      completa_at = case when v_faltan = 0 then coalesce(completa_at, now()) else null end
  where id = p_sala;
  return v_match;
end $$;

-- Pedidos sin responder que dejaron de tener sentido: se caen solos, así no
-- quedan trabando a nadie. Y los que siguen en pie se ponen al día.
create or replace function public._limpiar_pedidos()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Alguna de las dos partes ya no está buscando (o pasó a ir en el grupo de otro).
  update public.mensajes m set estado = 'rechazado'
  where m.estado = 'pendiente'
    and (not exists (select 1 from public.busquedas b where b.user_id = m.de and b.estado = 'activa')
      or not exists (select 1 from public.busquedas b where b.user_id = m.a and b.estado = 'activa'));

  -- Pedidos de un jugador a una sala: se actualiza con quién viene...
  update public.mensajes m
  set con = public._miembros(j.id),
      texto = case
        when m.auto then m.texto
        when public._somos(j.id) > 1 then '¿Entramos ' || public._somos(j.id) || ' a tu sala?'
        else '¿Me sumo a tu sala?' end
  from public.busquedas j, public.busquedas sl
  where m.estado = 'pendiente'
    and j.user_id = m.de and j.estado = 'activa' and j.modo = 'jugador'
    and sl.user_id = m.a and sl.estado = 'activa' and sl.modo = 'sala'
    and m.con is distinct from public._miembros(j.id);

  -- ...y se cae si ya no entran todos, si alguno ya está en esa sala o si la sala ya lo había rechazado.
  update public.mensajes m set estado = 'rechazado'
  from public.busquedas j, public.busquedas sl
  where m.estado = 'pendiente'
    and j.estado = 'activa' and j.modo = 'jugador'
    and sl.estado = 'activa' and sl.modo = 'sala'
    and ((j.user_id = m.de and sl.user_id = m.a) or (j.user_id = m.a and sl.user_id = m.de))
    and (public._somos(j.id) > coalesce(sl.faltan, 0)
      -- La app no insiste con alguien que esa sala ya rechazó, aunque ahora venga en un grupo.
      or (m.auto and public._miembros(j.id) && sl.rechazados)
      or exists (
        select 1 from public.match_participantes p
        where p.match_id = sl.match_id and p.salio_at is null
          and (p.user_id = j.user_id or p.user_id = any (public._miembros(j.id)))));
end $$;

-- ¿Hay un bloqueo entre uno y alguno de los otros? Los bloqueos llegan con el paso 6,
-- que reemplaza esta función por la de verdad; por eso acá solo se crea si no existe.
do $$
begin
  if to_regprocedure('public._bloqueo_entre(uuid, uuid[])') is null then
    execute 'create function public._bloqueo_entre(p_uno uuid, p_otros uuid[]) returns boolean '
      || 'language sql stable security definer set search_path = '''' '
      || 'as ''select false'' ';
  end if;
end $$;

-- Emparejamiento automático: a cada sala con lugares libres la app le acerca
-- gente para que su dueño acepte o rechace. Primero un grupo (o jugador) que sea
-- justo los que faltan, después jugadores sueltos, después grupos más chicos.
-- Un mismo jugador puede quedar propuesto a varias salas: entra a la primera
-- que lo acepta y los otros pedidos se caen solos.
create or replace function public._emparejar()
returns void language plpgsql security definer set search_path = '' as $$
declare
  sala public.busquedas;
  cand public.busquedas;
begin
  perform public._limpiar_pedidos();
  for sala in
    select * from public.busquedas
    where estado = 'activa' and modo = 'sala' and coalesce(faltan, 0) > 0
    order by creada_at
  loop
    -- De a un pedido por vez: si el dueño tiene uno sin responder, espera.
    continue when exists (select 1 from public.mensajes where a = sala.user_id and estado = 'pendiente');

    select c.* into cand
    from public.busquedas c
    where c.estado = 'activa' and c.modo = 'jugador'
      and c.user_id <> sala.user_id
      -- Ni él ni nadie de su grupo fue rechazado por esta sala...
      and not (c.user_id = any (sala.rechazados))
      and not (public._miembros(c.id) && sala.rechazados)
      -- ...ni está ya adentro.
      and not exists (
        select 1 from public.match_participantes p
        where p.match_id = sala.match_id and p.salio_at is null
          and (p.user_id = c.user_id or p.user_id = any (public._miembros(c.id))))
      and (c.expira_at is null or c.expira_at > now())
      and public._compatibles(c.region, c.cancha, sala.region, sala.cancha)
      -- Ni el dueño de la sala bloqueó a alguno de ellos, ni alguno de ellos al dueño (paso 6).
      and not public._bloqueo_entre(sala.user_id, array[c.user_id] || public._miembros(c.id))
      and public._somos(c.id) <= sala.faltan
    order by
      case when public._somos(c.id) = sala.faltan then 0 when public._somos(c.id) = 1 then 1 else 2 end,
      c.creada_at
    limit 1;

    if found then
      insert into public.mensajes (de, a, texto, auto, con)
      values (cand.user_id, sala.user_id, 'La app lo conectó con tu sala', true, public._miembros(cand.id));
    end if;
  end loop;
end $$;

-- Cuánto aguanta una búsqueda sin señales de su dueño. El paso 3 (avisos) la
-- reemplaza para darle más tiempo a quien tiene los avisos activados; por eso
-- acá solo se crea si todavía no existe.
do $$
begin
  if to_regprocedure('public._aguante(uuid)') is null then
    execute 'create function public._aguante(p_user uuid) returns interval '
      || 'language sql stable security definer set search_path = '''' '
      || 'as ''select interval ''''10 minutes'''''' ';
  end if;
end $$;

-- Vence las búsquedas que cumplieron su tiempo o cuyo dueño dejó de dar señales.
create or replace function public._vencer()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  b record;
  hubo boolean := false;
begin
  -- Lo hace uno solo por vez. Si justo hay otro cambio en curso, queda para la próxima.
  if not pg_try_advisory_xact_lock(48293011) then
    return false;
  end if;

  -- Sumados que se quedaron sin grupo (por ejemplo, si se borró la cuenta de quien lo armó).
  update public.busquedas sumada
  set estado = 'activa', lider_id = null, creada_at = now(),
      expira_at = case when sumada.expira_at is not null then now() + interval '15 minutes' end
  where sumada.estado = 'agrupada'
    and not exists (
      select 1 from public.busquedas l
      where l.id = sumada.lider_id and l.estado = 'activa' and l.modo = 'jugador');
  if found then
    hubo := true;
  end if;

  for b in
    select id from public.busquedas
    where estado in ('activa', 'agrupada')
      and (
        -- 15 minutos, más 2 para responder el cartel de renovar.
        (estado = 'activa' and modo = 'jugador' and expira_at is not null and expira_at < now() - interval '2 minutes')
        -- App cerrada o sin conexión hace rato (10 minutos; más si tiene los avisos activados).
        or visto_at < now() - public._aguante(user_id)
      )
    order by creada_at
  loop
    perform public._terminar(b.id, 'vencida');
    hubo := true;
  end loop;
  if hubo then
    perform public._emparejar();
    perform public._avisar();
  end if;
  return hubo;
end $$;

-- ---------------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------------

-- Todo lo que la app necesita mostrar, de una vez.
create or replace function public.estado_cola()
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  update public.busquedas set visto_at = now() where user_id = yo and estado in ('activa', 'agrupada');
  perform public._vencer();

  return json_build_object(
    'ahora', now(),
    'busquedas', (
      select coalesce(json_agg(json_build_object(
        'id', b.id, 'user_id', b.user_id, 'modo', b.modo, 'formato', b.formato, 'posicion', b.posicion,
        'cancha', b.cancha, 'region', b.region, 'nombre_sala', b.nombre_sala, 'faltan', b.faltan,
        'completa_at', b.completa_at, 'creada_at', b.creada_at, 'expira_at', b.expira_at, 'estado', b.estado,
        'lider_id', b.lider_id, 'equipo_listo', b.equipo_listo, 'match_id', b.match_id,
        'rechazados', case when b.user_id = yo then b.rechazados else '{}'::uuid[] end,
        'avisar', case when b.user_id = yo then b.avisar end
      ) order by b.creada_at), '[]'::json)
      from public.busquedas b where b.estado in ('activa', 'agrupada')
    ),
    'mensajes', (
      select coalesce(json_agg(json_build_object(
        'id', m.id, 'de', m.de, 'a', m.a, 'texto', m.texto, 'creado_at', m.creado_at,
        'estado', m.estado, 'auto', m.auto, 'con', m.con
      ) order by m.creado_at desc), '[]'::json)
      from public.mensajes m
      where (m.de = yo or m.a = yo) and m.creado_at > now() - interval '1 day'
    ),
    'matches', (
      select coalesce(json_agg(json_build_object(
        'id', m.id, 'creado_por', m.creado_por, 'cancha', m.cancha, 'nombre_sala', m.nombre_sala,
        'creado_at', m.creado_at,
        -- El partido me cuenta a mí si es válido y además entré (lo marcó el dueño) o confirmé.
        'contado_at', (
          select m.contado_at from public.match_participantes q
          where q.match_id = m.id and q.user_id = yo and (q.confirmado_at is not null or q.entro_at is not null)),
        'participantes', (
          select json_agg(json_build_object(
            'user_id', p.user_id, 'equipo', p.equipo, 'confirmado_at', p.confirmado_at,
            'entro_at', p.entro_at, 'descarto', p.descarto, 'salio_at', p.salio_at) order by p.equipo, p.user_id)
          from public.match_participantes p where p.match_id = m.id)
      ) order by m.creado_at desc), '[]'::json)
      from public.matches m
      where m.creado_at > now() - interval '8 days'
        and exists (select 1 from public.match_participantes p where p.match_id = m.id and p.user_id = yo)
    ),
    'usuarios', (
      select coalesce(json_agg(json_build_object(
        'id', u.id, 'nick', u.nick, 'username', u.username,
        -- De la foto solo viaja la versión, y solo si es la de su carpeta: la dirección la arma la app.
        'foto', case
          when u.foto_url ~ ('/storage/v1/object/public/avatares/' || u.id::text || '/foto\.jpg(\?v=[0-9]+)?$')
          then coalesce(substring(u.foto_url from '\?v=([0-9]+)$'), '0') end)), '[]'::json)
      from public.profiles u
      where u.id in (select b.user_id from public.busquedas b where b.estado in ('activa', 'agrupada'))
         or u.id in (select m.de from public.mensajes m where m.a = yo and m.creado_at > now() - interval '1 day')
         or u.id in (select m.a from public.mensajes m where m.de = yo and m.creado_at > now() - interval '1 day')
         or u.id in (select unnest(m.con) from public.mensajes m where m.a = yo and m.creado_at > now() - interval '1 day')
         or u.id in (
           select p2.user_id from public.match_participantes p1
           join public.match_participantes p2 on p2.match_id = p1.match_id
           join public.matches m on m.id = p1.match_id
           where p1.user_id = yo and m.creado_at > now() - interval '8 days')
    ),
    -- Totales para el perfil, sin límite de fecha.
    'resumen', (
      select json_build_object(
        'jugados', count(*) filter (where m.contado_at is not null and (p.confirmado_at is not null or p.entro_at is not null)),
        'perdidos', count(*) filter (where p.confirmado_at is null and p.entro_at is null
          and (p.descarto or m.creado_at < now() - interval '7 days')))
      from public.match_participantes p join public.matches m on m.id = p.match_id
      where p.user_id = yo
    )
  );
end $$;

-- Ponerse disponible ("Quiero jugar un amistoso") o abrir una sala ("Necesito un jugador").
create or replace function public.crear_busqueda(
  p_modo text, p_formato text[], p_posicion text[], p_cancha text[], p_region text[],
  p_duracion text default 'match', p_nombre_sala text default null, p_faltan int default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_id uuid;
  v_nombre text := trim(coalesce(p_nombre_sala, ''));
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  perform public._turno();
  perform public._vencer();
  if exists (select 1 from public.busquedas where user_id = yo and estado in ('activa', 'agrupada')) then
    raise exception 'Ya tenés una búsqueda activa. Cancelala para empezar otra.';
  end if;
  if p_modo not in ('jugador', 'sala') then
    raise exception 'Modo no válido';
  end if;
  if coalesce(cardinality(p_posicion), 0) not between 1 and 9 or array_ndims(p_posicion) <> 1
     or not (p_posicion <@ array['Polifuncional', 'GK', 'LD', 'DFC', 'LI', 'MC', 'ED', 'EI', 'DC']) then
    raise exception 'Elegí al menos una posición';
  end if;
  if coalesce(cardinality(p_cancha), 0) not between 1 and 7 or array_ndims(p_cancha) <> 1
     or not (p_cancha <@ array['Classic', 'Big', 'Big Easy', 'Futsal', 'Real Futsal', 'Real Soccer', 'Cualquiera']) then
    raise exception 'Elegí al menos una cancha';
  end if;
  if coalesce(cardinality(p_region), 0) not between 1 and 4 or array_ndims(p_region) <> 1
     or not (p_region <@ array['ARG', 'CHI', 'BR', 'UY']) then
    raise exception 'Elegí al menos una región';
  end if;

  if p_modo = 'sala' then
    if v_nombre = '' or char_length(v_nombre) > 40 then
      raise exception 'Escribí el nombre de la sala';
    end if;
    if p_faltan is null or p_faltan < 1 or p_faltan > 7 then
      raise exception 'Elegí cuántos jugadores faltan';
    end if;
    insert into public.busquedas (user_id, modo, formato, posicion, cancha, region, nombre_sala, faltan)
    values (yo, 'sala', null, p_posicion, p_cancha, p_region, v_nombre, p_faltan)
    returning id into v_id;
  else
    if coalesce(cardinality(p_formato), 0) not between 1 and 5 or array_ndims(p_formato) <> 1
       or not (p_formato <@ array['1v1', '2v2', '3v3', '4v4', 'Cualquiera']) then
      raise exception 'Elegí al menos una modalidad';
    end if;
    insert into public.busquedas (user_id, modo, formato, posicion, cancha, region, expira_at)
    values (yo, 'jugador', p_formato, p_posicion, p_cancha, p_region,
            case when p_duracion = '15min' then now() + interval '15 minutes' end)
    returning id into v_id;
  end if;

  perform public._emparejar();
  perform public._avisar();
  return v_id;
end $$;

-- Cancelar mi búsqueda, salir del grupo o cerrar mi sala.
create or replace function public.cancelar_busqueda()
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_id uuid;
begin
  perform public._turno();
  select id into v_id from public.busquedas where user_id = yo and estado in ('activa', 'agrupada');
  if not found then
    return;
  end if;
  perform public._terminar(v_id, 'cancelada');
  perform public._emparejar();
  perform public._avisar();
end $$;

-- Respuesta al cartel "¿Te avisamos?".
create or replace function public.responder_aviso(p_avisar boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.busquedas set avisar = p_avisar
  where user_id = (select auth.uid()) and estado in ('activa', 'agrupada');
end $$;

-- Cartel de los 15 minutos: 15 minutos más, con el reloj en cero.
create or replace function public.renovar_busqueda()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._turno();
  update public.busquedas
  set creada_at = now(), expira_at = now() + interval '15 minutes'
  where user_id = (select auth.uid()) and estado = 'activa' and modo = 'jugador';
  if not found then
    raise exception 'No tenés una búsqueda para renovar';
  end if;
  perform public._emparejar();
  perform public._avisar();
end $$;

-- Mensaje rápido a un jugador o a una sala. Hay que estar buscando para escribir.
create or replace function public.enviar_mensaje(p_a uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  mia public.busquedas;
  suya public.busquedas;
  previo public.mensajes;
  v_id uuid;
  v_texto text;
  somos int;
begin
  if yo is null or p_a is null or p_a = yo then
    raise exception 'Mensaje no válido';
  end if;
  perform public._turno();
  perform public._vencer();

  select * into mia from public.busquedas where user_id = yo and estado in ('activa', 'agrupada');
  if not found then
    raise exception 'Primero ponete a buscar partido';
  end if;
  if mia.estado = 'agrupada' then
    raise exception 'Solo quien armó el grupo puede escribirles a otros';
  end if;
  select * into suya from public.busquedas where user_id = p_a and estado = 'activa';
  if not found then
    raise exception 'Ese jugador ya no está buscando';
  end if;

  somos := public._somos(mia.id);
  if suya.modo = 'sala' then
    if mia.modo = 'sala' then
      raise exception 'Ya tenés tu propia sala';
    end if;
    if somos > coalesce(suya.faltan, 0) then
      raise exception 'No entran todos en esa sala';
    end if;
    if exists (
      select 1 from public.match_participantes p
      where p.match_id = suya.match_id and p.salio_at is null
        and (p.user_id = yo or p.user_id = any (public._miembros(mia.id)))) then
      raise exception 'Ya estás en esa sala';
    end if;
    v_texto := case when somos > 1 then '¿Entramos ' || somos || ' a tu sala?' else '¿Me sumo a tu sala?' end;
  elsif mia.modo = 'sala' then
    if public._somos(suya.id) > coalesce(mia.faltan, 0) then
      raise exception 'No entran en tu sala';
    end if;
    if exists (
      select 1 from public.match_participantes p
      where p.match_id = mia.match_id and p.salio_at is null
        and (p.user_id = p_a or p.user_id = any (public._miembros(suya.id)))) then
      raise exception 'Ese jugador ya está en tu sala';
    end if;
    v_texto := '¿Te sumás a mi sala?';
  else
    v_texto := case
      when cardinality(array_remove(mia.formato, 'Cualquiera')) = 1
        then '¿Jugamos un ' || (array_remove(mia.formato, 'Cualquiera'))[1] || '?'
      else '¿Jugamos?' end;
  end if;

  select * into previo from public.mensajes where de = yo and a = p_a and estado = 'pendiente' limit 1;
  if found then
    -- Si la app ya me había acercado a esa sala, el pedido pasa a ser un mensaje mío.
    if previo.auto then
      update public.mensajes set auto = false, texto = v_texto, creado_at = now() where id = previo.id;
      perform public._avisar();
    end if;
    return previo.id;
  end if;
  -- Para que nadie insista: después de un "no", hay que esperar un rato para volver a escribirle.
  if exists (
    select 1 from public.mensajes
    where de = yo and a = p_a and estado = 'rechazado' and not auto and creado_at > now() - interval '2 minutes') then
    raise exception 'Ya le escribiste hace un momento. Esperá un rato para volver a intentar.';
  end if;
  if (select count(*) from public.mensajes where de = yo and estado = 'pendiente' and not auto) >= 10 then
    raise exception 'Tenés muchos mensajes sin responder. Esperá a que te contesten.';
  end if;

  insert into public.mensajes (de, a, texto, con)
  values (yo, p_a, v_texto, case when mia.modo = 'jugador' then public._miembros(mia.id) else '{}'::uuid[] end)
  returning id into v_id;
  perform public._avisar();
  return v_id;
end $$;

-- Aceptar o rechazar un mensaje (o a un jugador que la app acercó a mi sala).
create or replace function public.responder_mensaje(p_id uuid, p_aceptar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  msg public.mensajes;
  mia public.busquedas;
  suya public.busquedas;
  hay_mia boolean;
  hay_suya boolean;
begin
  perform public._turno();
  select * into msg from public.mensajes where id = p_id and a = yo and estado = 'pendiente' for update;
  if not found then
    raise exception 'Ese mensaje ya no está disponible';
  end if;

  select * into mia from public.busquedas where user_id = yo and estado = 'activa';
  hay_mia := found;
  select * into suya from public.busquedas where user_id = msg.de and estado = 'activa';
  hay_suya := found;

  if p_aceptar is not true then
    update public.mensajes set estado = 'rechazado' where id = msg.id;
    if hay_mia and mia.modo = 'sala' then
      -- El lugar sigue libre y la app no me lo vuelve a acercar.
      update public.busquedas set rechazados = array_append(rechazados, msg.de) where id = mia.id;
    end if;
    perform public._emparejar();
    perform public._avisar();
    return;
  end if;

  if not hay_suya then
    raise exception 'Ese jugador ya no está buscando';
  end if;
  if not hay_mia then
    raise exception 'Ya no estás buscando';
  end if;
  update public.mensajes set estado = 'aceptado' where id = msg.id;

  if mia.modo = 'sala' then
    -- Acepto a un jugador (o a su grupo) en mi sala: ocupa su lugar y la sala sigue buscando el resto.
    if suya.modo <> 'jugador' then
      raise exception 'Ese mensaje ya no está disponible';
    end if;
    perform public._ocupar(mia.id, array[suya.user_id] || public._miembros(suya.id), 'B');
  elsif suya.modo = 'sala' then
    -- Una sala me invitó: entro, con mi grupo si tengo. Ya me eligió, no hace falta que me acepte.
    perform public._ocupar(suya.id, array[yo] || public._miembros(mia.id), 'B');
  else
    -- Dos jugadores buscando: me sumo (con mi grupo, si tengo) a la búsqueda de quien me escribió.
    update public.busquedas set lider_id = suya.id where lider_id = mia.id and estado = 'agrupada';
    update public.busquedas set estado = 'agrupada', lider_id = suya.id, equipo_listo = false where id = mia.id;
    update public.mensajes set estado = 'rechazado'
    where estado = 'pendiente' and (de = yo or a = yo);
    perform public._recalcular_grupo(suya.id);
  end if;

  perform public._emparejar();
  perform public._avisar();
end $$;

-- Dueño de la sala: "Ya entró X a la sala".
create or replace function public.marcar_entro(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  mia public.busquedas;
begin
  perform public._turno();
  select * into mia from public.busquedas
  where user_id = yo and estado = 'activa' and modo = 'sala' and match_id is not null for update;
  if not found then
    raise exception 'No tenés una sala abierta';
  end if;
  update public.match_participantes set entro_at = coalesce(entro_at, now())
  where match_id = mia.match_id and user_id = p_user and user_id <> yo and salio_at is null;
  if not found then
    raise exception 'Ese jugador no está en tu sala';
  end if;
  -- Marcar que alguien entró es mi confirmación del partido.
  update public.match_participantes set confirmado_at = coalesce(confirmado_at, now())
  where match_id = mia.match_id and user_id = yo;
  perform public._evaluar(mia.match_id);

  -- Sala completa y todos adentro: se termina la búsqueda y queda armado el match.
  if coalesce(mia.faltan, 0) = 0 and not exists (
    select 1 from public.match_participantes
    where match_id = mia.match_id and user_id <> yo and salio_at is null and entro_at is null) then
    update public.busquedas set estado = 'match' where id = mia.id;
    -- Lo que hubiera quedado sin responder se cae con la búsqueda.
    perform public._emparejar();
  end if;
  perform public._avisar();
end $$;

-- Dueño de la sala: "Se salió" (o "No vino"). Libera el lugar y la sala vuelve a buscar.
create or replace function public.marcar_salio(p_user uuid, p_match uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_match uuid;
  part public.match_participantes;
  sala public.busquedas;
  hay_sala boolean;
  ya_conto boolean;
  sin_partido boolean;
  otra_activa boolean;
begin
  perform public._turno();
  v_match := coalesce(p_match, (
    select match_id from public.busquedas where user_id = yo and estado = 'activa' and modo = 'sala'));
  if v_match is null or not exists (select 1 from public.matches where id = v_match and creado_por = yo) then
    raise exception 'Ese partido no es de tu sala';
  end if;
  if p_user = yo then
    raise exception 'Jugador no válido';
  end if;

  select * into part from public.match_participantes
  where match_id = v_match and user_id = p_user and salio_at is null for update;
  if not found then
    raise exception 'Ese jugador no está en tu sala';
  end if;
  ya_conto := exists (select 1 from public.matches where id = v_match and contado_at is not null);
  if ya_conto and (part.confirmado_at is not null or part.entro_at is not null) then
    -- El partido ya le contaba: deja el lugar, pero el partido le queda.
    update public.match_participantes set salio_at = now() where match_id = v_match and user_id = p_user;
  else
    delete from public.match_participantes where match_id = v_match and user_id = p_user;
  end if;

  -- La sala de ese partido: la que está abierta, o la que se cerró al completarse.
  select * into sala from public.busquedas
  where user_id = yo and match_id = v_match and modo = 'sala' and estado in ('activa', 'match')
  order by creada_at desc limit 1 for update;
  hay_sala := found;

  -- Si no queda nadie y el partido no llegó a contar, no hay partido.
  sin_partido := not ya_conto
    and not exists (select 1 from public.match_participantes where match_id = v_match and user_id <> yo);
  if sin_partido then
    delete from public.matches where id = v_match;
  end if;

  otra_activa := exists (
    select 1 from public.busquedas
    where user_id = yo and estado in ('activa', 'agrupada') and (not hay_sala or id <> sala.id));
  -- Vuelve a buscar si la sala sigue abierta, o si se había completado hace poco y no empecé otra búsqueda.
  -- Una sala que cerré yo (o que venció) no se reabre.
  if hay_sala and (sala.estado = 'activa'
      or (not otra_activa and sala.completa_at is not null and sala.completa_at > now() - interval '6 hours')) then
    update public.busquedas
    set estado = 'activa',
        faltan = least(7, coalesce(faltan, 0) + 1),
        -- El reloj sigue desde donde había quedado cuando la sala se llenó.
        creada_at = creada_at + coalesce(now() - completa_at, interval '0'),
        completa_at = null,
        visto_at = now(),
        match_id = case when sin_partido then null else match_id end
    where id = sala.id;
  end if;
  perform public._emparejar();
  perform public._avisar();
end $$;

-- El que entra a una sala: "Ya entré a la sala". También confirma un partido pendiente.
create or replace function public.confirmar_match(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._turno();
  if not exists (select 1 from public.matches where id = p_match and creado_at > now() - interval '7 days') then
    raise exception 'Ese partido ya venció';
  end if;
  update public.match_participantes
  set confirmado_at = coalesce(confirmado_at, now()), descarto = false
  where match_id = p_match and user_id = (select auth.uid());
  if not found then
    raise exception 'No participás de ese partido';
  end if;
  perform public._evaluar(p_match);
  perform public._avisar();
end $$;

-- "No lo jugué": saca el partido de mis pendientes.
create or replace function public.descartar_match(p_match uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.match_participantes set descarto = true
  where match_id = p_match and user_id = (select auth.uid()) and confirmado_at is null;
end $$;

-- El grupo arma su sala: para buscar rival, para seguir buscando gente o para jugar entre ellos.
create or replace function public.convertir_en_sala(p_nombre text, p_faltan int, p_entre_nosotros boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  mia public.busquedas;
  v_nombre text := trim(coalesce(p_nombre, ''));
  miembros uuid[];
  v_faltan int;
begin
  perform public._turno();
  select * into mia from public.busquedas where user_id = yo and estado = 'activa' and modo = 'jugador' for update;
  if not found then
    raise exception 'No estás buscando partido';
  end if;
  if v_nombre = '' or char_length(v_nombre) > 40 then
    raise exception 'Escribí el nombre de la sala';
  end if;
  miembros := public._miembros(mia.id);
  if p_entre_nosotros is true then
    if cardinality(miembros) = 0 then
      raise exception 'No hay nadie más en tu búsqueda';
    end if;
    -- Juegan entre ellos: la sala tiene justo los lugares del grupo y no busca a nadie más.
    v_faltan := cardinality(miembros);
  else
    if p_faltan is null or p_faltan < 0 or p_faltan > 7 then
      raise exception 'Elegí cuántos jugadores faltan';
    end if;
    v_faltan := p_faltan;
  end if;

  update public.mensajes set estado = 'rechazado' where estado = 'pendiente' and (de = yo or a = yo);
  update public.busquedas
  set modo = 'sala', formato = null, nombre_sala = v_nombre, faltan = v_faltan,
      equipo_listo = false, expira_at = null, avisar = coalesce(avisar, false)
  where id = mia.id;

  -- Los del grupo ya tienen su lugar. Si juegan entre ellos son rivales;
  -- si van a buscar rival, son del equipo de quien creó la sala.
  if cardinality(miembros) > 0 then
    perform public._ocupar(mia.id, miembros, case when p_entre_nosotros is true then 'B' else 'A' end);
  elsif v_faltan = 0 then
    raise exception 'Elegí cuántos jugadores faltan';
  end if;

  perform public._emparejar();
  perform public._avisar();
end $$;

-- Reportar a un jugador. Queda guardado para que lo revise el equipo.
create or replace function public.reportar(p_user uuid, p_motivo text, p_detalle text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  if p_user is null or p_user = yo or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Jugador no válido';
  end if;
  if p_motivo is null or not (p_motivo = any (array['No apareció', 'Abandonó el partido', 'Comportamiento tóxico', 'Resultado falso'])) then
    raise exception 'Elegí un motivo';
  end if;
  if (select count(*) from public.reportes where de = yo and creado_at > now() - interval '1 day') >= 10 then
    raise exception 'Ya mandaste muchos reportes hoy. Probá mañana.';
  end if;
  insert into public.reportes (de, reportado, motivo, detalle)
  values (yo, p_user, p_motivo, left(trim(coalesce(p_detalle, '')), 300));
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._avisar(), public._turno(), public._somos(uuid), public._miembros(uuid),
  public._compatibles(text[], text[], text[], text[]), public._equipo_completo(text[], int), public._bloqueo_entre(uuid, uuid[]),
  public._elegir_cancha(text[], text[]), public._recalcular_grupo(uuid), public._evaluar(uuid),
  public._terminar(uuid, text), public._ocupar(uuid, uuid[], text), public._limpiar_pedidos(),
  public._emparejar(), public._vencer(), public._aguante(uuid)
from public, anon, authenticated;

revoke all on function
  public.estado_cola(),
  public.crear_busqueda(text, text[], text[], text[], text[], text, text, int),
  public.cancelar_busqueda(), public.responder_aviso(boolean), public.renovar_busqueda(),
  public.enviar_mensaje(uuid), public.responder_mensaje(uuid, boolean),
  public.marcar_entro(uuid), public.marcar_salio(uuid, uuid),
  public.confirmar_match(uuid), public.descartar_match(uuid),
  public.convertir_en_sala(text, int, boolean),
  public.reportar(uuid, text, text)
from public, anon;

grant execute on function
  public.estado_cola(),
  public.crear_busqueda(text, text[], text[], text[], text[], text, text, int),
  public.cancelar_busqueda(), public.responder_aviso(boolean), public.renovar_busqueda(),
  public.enviar_mensaje(uuid), public.responder_mensaje(uuid, boolean),
  public.marcar_entro(uuid), public.marcar_salio(uuid, uuid),
  public.confirmar_match(uuid), public.descartar_match(uuid),
  public.convertir_en_sala(text, int, boolean),
  public.reportar(uuid, text, text)
to authenticated;
