-- HaxMatch · Paso 6: borrar la cuenta, bloqueos y moderación
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Necesita los pasos 1 a 5. Se puede ejecutar más de una vez sin romper nada.
--
-- Qué agrega:
-- - Borrar la cuenta desde la app: se va el perfil con todo lo suyo.
-- - Bloqueos guardados en el servidor: a quien bloqueo no me lo acerca la app,
--   y no puede escribirme ni mandarme solicitud de amistad (ni yo a él).
-- - Suspender una cuenta por un tiempo. Solo se puede desde acá (SQL Editor),
--   con las funciones "mod_" que están al final. La app no puede llamarlas.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists suspendido_hasta timestamptz;
alter table public.profiles add column if not exists suspension_motivo text;

create table if not exists public.bloqueos (
  -- Quién bloquea y a quién.
  de uuid not null references public.profiles (id) on delete cascade,
  a uuid not null references public.profiles (id) on delete cascade,
  creado_at timestamptz not null default now(),
  primary key (de, a),
  check (de <> a)
);
create index if not exists bloqueos_por_a on public.bloqueos (a);

-- Cuentas que se borraron. No guarda quién era: solo una huella que no se puede
-- revertir, para que borrar la cuenta y volver a entrar no sirva para esquivar una
-- suspensión ni para contar otra vez como referido. Se borra sola al año.
create table if not exists public.cuentas_borradas (
  huella text primary key,
  borrada_at timestamptz not null default now(),
  -- Reportes que había recibido.
  reportes int not null default 0,
  suspendido_hasta timestamptz,
  suspension_motivo text
);

alter table public.bloqueos enable row level security;
alter table public.cuentas_borradas enable row level security;
revoke all on public.bloqueos, public.cuentas_borradas from anon, authenticated;

-- Ingrediente secreto de las huellas. Se genera una vez y no sale de la base.
insert into public.config_privada (clave, valor)
values ('sal_huellas', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

create or replace function public._huella(p_discord_id text)
returns text language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to(
    'haxmatch:' || p_discord_id || ':' || coalesce((select valor from public.config_privada where clave = 'sal_huellas'), ''), 'UTF8')), 'hex')
  where nullif(trim(coalesce(p_discord_id, '')), '') is not null
$$;

-- ¿Hay un bloqueo, para cualquiera de los dos lados, entre uno y alguno de los otros?
create or replace function public._bloqueo_entre(p_uno uuid, p_otros uuid[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bloqueos b
    where (b.de = p_uno and b.a = any (p_otros)) or (b.a = p_uno and b.de = any (p_otros)))
$$;

-- ¿Hay un bloqueo, para cualquiera de los dos lados, entre alguno de unos y alguno de otros?
create or replace function public._bloqueo_grupos(p_unos uuid[], p_otros uuid[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bloqueos b
    where (b.de = any (p_unos) and b.a = any (p_otros)) or (b.a = any (p_unos) and b.de = any (p_otros)))
$$;

-- El grupo con el que está buscando un jugador (él incluido). Si busca solo, o no busca, solo él.
create or replace function public._grupo_de(p_user uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select array[p_user] || coalesce((
    select array_agg(g.user_id)
    from public.busquedas mia
    join public.busquedas g
      on g.user_id <> p_user and g.estado in ('activa', 'agrupada')
     and coalesce(case when g.estado = 'agrupada' then g.lider_id end, g.id)
       = coalesce(case when mia.estado = 'agrupada' then mia.lider_id end, mia.id)
    where mia.user_id = p_user and mia.estado in ('activa', 'agrupada')), '{}'::uuid[])
$$;

-- Los datos de Discord de un usuario, tal como los dio Discord al entrar. No se toman
-- de lo que el usuario puede editar de su sesión.
create or replace function public._discord(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select i.identity_data from auth.identities i where i.user_id = p_user and i.provider = 'discord' limit 1
$$;

-- Si la cuenta está suspendida, el texto para mostrarle. Si no, null.
create or replace function public._suspension(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select 'Tu cuenta está suspendida'
    || case when p.suspendido_hasta = 'infinity' then ''
            else ' hasta el ' || to_char(p.suspendido_hasta at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') end
    || coalesce('. Motivo: ' || nullif(trim(p.suspension_motivo), ''), '') || '.'
  from public.profiles p
  where p.id = p_user and p.suspendido_hasta is not null and p.suspendido_hasta > now()
$$;

-- El emparejamiento automático, igual que en el paso 2 (que ya pregunta por los
-- bloqueos). Va repetido acá para que alcance con ejecutar este archivo.
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

-- ---------------------------------------------------------------------------
-- Disparadores: lo que una cuenta suspendida o bloqueada no puede hacer
-- ---------------------------------------------------------------------------

-- Una cuenta suspendida no puede ponerse a buscar ni abrir una sala.
create or replace function public._seg_busqueda()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v text := public._suspension(new.user_id);
begin
  if v is not null then
    raise exception '%', v;
  end if;
  return new;
end $$;

drop trigger if exists seg_busqueda on public.busquedas;
create trigger seg_busqueda before insert on public.busquedas
  for each row execute function public._seg_busqueda();

-- Mensajes: ni suspendidos, ni entre bloqueados. Se mira a los dos grupos enteros:
-- quien escribe y los que van con él, y quien recibe y los que buscan con él.
create or replace function public._seg_mensaje()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v text;
  v_bloqueo boolean := public._bloqueo_grupos(array[new.de] || new.con, public._grupo_de(new.a));
begin
  if new.auto then
    -- Red de seguridad, por si el emparejamiento propusiera a alguien bloqueado: ese pedido
    -- no se crea, y la sala lo descarta para que le acerquen a otro.
    if v_bloqueo then
      update public.busquedas set rechazados = array_append(rechazados, new.de)
      where user_id = new.a and estado = 'activa' and modo = 'sala' and not (new.de = any (rechazados));
      return null;
    end if;
    return new;
  end if;
  v := public._suspension(new.de);
  if v is not null then
    raise exception '%', v;
  end if;
  if v_bloqueo then
    raise exception 'No se puede contactar a ese jugador.';
  end if;
  return new;
end $$;

drop trigger if exists seg_mensaje on public.mensajes;
create trigger seg_mensaje before insert on public.mensajes
  for each row execute function public._seg_mensaje();

-- Un pedido pendiente al que se le sumó gente: si con eso aparece un bloqueo, el pedido se cae.
create or replace function public._seg_mensaje_grupo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'pendiente' and public._bloqueo_grupos(array[new.de] || new.con, public._grupo_de(new.a)) then
    new.estado := 'rechazado';
  end if;
  return new;
end $$;

drop trigger if exists seg_mensaje_grupo on public.mensajes;
create trigger seg_mensaje_grupo before update of con on public.mensajes
  for each row execute function public._seg_mensaje_grupo();

-- Entrar a una sala: nunca con un bloqueo de por medio con su dueño (por ejemplo, si
-- alguien bloqueado se sumó al grupo después de que se mandó el pedido).
create or replace function public._seg_participante()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dueno uuid;
begin
  select creado_por into v_dueno from public.matches where id = new.match_id;
  if v_dueno is not null and v_dueno <> new.user_id and public._bloqueo_entre(v_dueno, array[new.user_id]) then
    raise exception 'No se puede: hay un bloqueo entre el dueño de la sala y uno de los jugadores.';
  end if;
  return new;
end $$;

drop trigger if exists seg_participante on public.match_participantes;
create trigger seg_participante before insert on public.match_participantes
  for each row execute function public._seg_participante();

-- Sumarse a la búsqueda de otro: no si en los dos grupos hay dos jugadores bloqueados entre sí.
-- Y una cuenta suspendida no puede reabrir una sala que ya se había cerrado.
create or replace function public._seg_grupo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_todos uuid[];
  v text;
begin
  if new.estado = 'agrupada' and old.estado = 'activa' and new.lider_id is not null then
    select array_agg(distinct g.user_id) into v_todos from public.busquedas g
    where g.id in (new.id, new.lider_id)
       or (g.estado = 'agrupada' and g.lider_id in (new.id, new.lider_id));
    if exists (select 1 from public.bloqueos b where b.de = any (v_todos) and b.a = any (v_todos)) then
      raise exception 'No se puede armar ese grupo: hay un bloqueo entre dos de los jugadores.';
    end if;
  end if;
  if new.estado = 'activa' and old.estado = 'match' then
    v := public._suspension(new.user_id);
    if v is not null then
      raise exception '%', v;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists seg_grupo on public.busquedas;
create trigger seg_grupo before update of estado, lider_id on public.busquedas
  for each row execute function public._seg_grupo();

-- Solicitudes de amistad: lo mismo.
create or replace function public._seg_amistad()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v text := public._suspension(new.de);
begin
  if v is not null then
    raise exception '%', v;
  end if;
  if public._bloqueo_entre(new.a, array[new.de]) then
    raise exception 'No se puede agregar a ese jugador.';
  end if;
  return new;
end $$;

drop trigger if exists seg_amistad on public.amistades;
create trigger seg_amistad before insert on public.amistades
  for each row execute function public._seg_amistad();

-- Tampoco puede aceptar solicitudes mientras dure la suspensión.
create or replace function public._seg_amistad_aceptar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v text := public._suspension((select auth.uid()));
begin
  if new.estado = 'aceptada' and old.estado <> 'aceptada' and v is not null then
    raise exception '%', v;
  end if;
  return new;
end $$;

drop trigger if exists seg_amistad_aceptar on public.amistades;
create trigger seg_amistad_aceptar before update of estado on public.amistades
  for each row execute function public._seg_amistad_aceptar();

-- Alta de un perfil. El identificador y el usuario de Discord se toman de lo que dio
-- Discord al entrar (no de datos que el usuario puede editar). Y si esa persona había
-- borrado su cuenta estando suspendida, la suspensión sigue.
create or replace function public._seg_alta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  d jsonb := public._discord(new.id);
  b public.cuentas_borradas;
begin
  if d is not null then
    new.discord_id := coalesce(nullif(d ->> 'provider_id', ''), nullif(d ->> 'sub', ''), new.discord_id);
    new.username := coalesce(nullif(d ->> 'full_name', ''), nullif(d ->> 'name', ''), new.username);
  end if;
  -- Las huellas de más de un año se van solas (salvo que tengan una suspensión que sigue vigente).
  delete from public.cuentas_borradas
  where borrada_at < now() - interval '1 year' and (suspendido_hasta is null or suspendido_hasta < now());
  select * into b from public.cuentas_borradas where huella = public._huella(new.discord_id);
  if found and b.suspendido_hasta is not null and b.suspendido_hasta > now() then
    new.suspendido_hasta := b.suspendido_hasta;
    new.suspension_motivo := b.suspension_motivo;
  end if;
  return new;
end $$;

drop trigger if exists seg_alta on public.profiles;
create trigger seg_alta before insert on public.profiles
  for each row execute function public._seg_alta();

-- Los perfiles que ya existían: se les pone el identificador y el usuario que dio Discord.
update public.profiles p
set discord_id = coalesce(nullif(i.identity_data ->> 'provider_id', ''), nullif(i.identity_data ->> 'sub', ''), p.discord_id),
    username = coalesce(nullif(i.identity_data ->> 'full_name', ''), nullif(i.identity_data ->> 'name', ''), p.username)
from auth.identities i
where i.user_id = p.id and i.provider = 'discord'
  and (p.discord_id is distinct from coalesce(nullif(i.identity_data ->> 'provider_id', ''), nullif(i.identity_data ->> 'sub', ''), p.discord_id)
    or p.username is distinct from coalesce(nullif(i.identity_data ->> 'full_name', ''), nullif(i.identity_data ->> 'name', ''), p.username));

-- Si quien creó una sala borra su cuenta, los partidos que ya contaron les quedan a los demás.
alter table public.matches alter column creado_por drop not null;
do $$
declare
  v_nombre text;
begin
  -- La regla que hoy borra el partido junto con quien lo creó (se busca por columna, se llame como se llame).
  select c.conname into v_nombre
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
  where c.conrelid = 'public.matches'::regclass and c.contype = 'f'
    and cardinality(c.conkey) = 1 and a.attname = 'creado_por' and c.confdeltype <> 'n';
  if v_nombre is not null then
    execute format('alter table public.matches drop constraint %I', v_nombre);
    alter table public.matches add constraint matches_creado_por_fkey
      foreign key (creado_por) references public.profiles (id) on delete set null;
  end if;
end $$;

-- El código de un amigo vale para cuentas nuevas: quien borró su cuenta y volvió no cuenta otra vez como referido.
create or replace function public._seg_referido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.referido_por is not null and old.referido_por is null
     and exists (select 1 from public.cuentas_borradas where huella = public._huella(new.discord_id)) then
    new.referido_por := null;
  end if;
  return new;
end $$;

drop trigger if exists seg_referido on public.profiles;
create trigger seg_referido before update of referido_por on public.profiles
  for each row execute function public._seg_referido();

-- ---------------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------------

-- Bloquear a un jugador. Dejan de ser amigos y se caen los pedidos pendientes entre los dos.
create or replace function public.bloquear(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo) then
    raise exception 'Hay que entrar con Discord';
  end if;
  if p_user is null or p_user = yo or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Jugador no válido';
  end if;
  if (select count(*) from public.bloqueos where de = yo) >= 500 then
    raise exception 'Llegaste al máximo de jugadores bloqueados.';
  end if;
  perform public._turno();
  insert into public.bloqueos (de, a) values (yo, p_user) on conflict do nothing;
  delete from public.amistades where (de = yo and a = p_user) or (de = p_user and a = yo);
  delete from public.mensajes
  where estado = 'pendiente' and ((de = yo and a = p_user) or (de = p_user and a = yo));
  perform public._emparejar();
  perform public._avisar();
end $$;

create or replace function public.desbloquear(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._turno();
  delete from public.bloqueos where de = (select auth.uid()) and a = p_user;
  perform public._emparejar();
  perform public._avisar();
end $$;

-- A quiénes tengo bloqueados y si mi cuenta está suspendida.
create or replace function public.seguridad()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  return json_build_object(
    'bloqueados', (
      select coalesce(json_agg(json_build_object(
        'id', u.id, 'nick', u.nick, 'username', u.username, 'foto', public._foto_version(u.id, u.foto_url)
      ) order by b.creado_at desc), '[]'::json)
      from public.bloqueos b join public.profiles u on u.id = b.a where b.de = yo),
    'suspension', public._suspension(yo));
end $$;

-- Borrar mi cuenta: el perfil y todo lo que cuelga de él (búsquedas, mensajes, amigos,
-- clips, puntos, avisos). La foto la borra la app antes de llamar a esta función.
-- A los demás no les saca nada: los partidos que ya contaron les quedan, y si yo estaba
-- anotado en la sala de otro, ese lugar se libera.
create or replace function public.borrar_cuenta()
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  p public.profiles;
  v_huella text;
  r record;
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  select * into p from public.profiles where id = yo;
  if found then
    -- Sale de la cola como si cancelara, y le pide a TikTok que anule el permiso.
    perform public.cancelar_busqueda();
    perform public.tiktok_desvincular();
    -- Salas de otros donde yo ocupaba un lugar: si siguen abiertas, el lugar vuelve a quedar libre.
    for r in
      select b.id as sala, m.id as partido, m.contado_at
      from public.match_participantes q
      join public.matches m on m.id = q.match_id
      join public.busquedas b on b.match_id = m.id and b.user_id = m.creado_por and b.modo = 'sala' and b.estado = 'activa'
      where q.user_id = yo and q.salio_at is null and m.creado_por <> yo
    loop
      delete from public.match_participantes where match_id = r.partido and user_id = yo;
      if r.contado_at is null
         and not exists (select 1 from public.match_participantes x
                         join public.matches m on m.id = x.match_id
                         where x.match_id = r.partido and x.user_id <> m.creado_por) then
        -- No quedó nadie más y no había llegado a contar: no hay partido.
        delete from public.matches where id = r.partido;
        update public.busquedas set match_id = null where id = r.sala;
      end if;
      update public.busquedas
      set faltan = least(7, coalesce(faltan, 0) + 1), completa_at = null
      where id = r.sala;
    end loop;
    -- Mis salas que no llegaron a contar ya no se pueden confirmar: se van. Las que contaron, quedan.
    delete from public.matches where creado_por = yo and contado_at is null;
    v_huella := public._huella(p.discord_id);
    if v_huella is not null then
      insert into public.cuentas_borradas (huella, borrada_at, reportes, suspendido_hasta, suspension_motivo)
      values (
        v_huella, now(), (select count(*) from public.reportes where reportado = yo),
        case when p.suspendido_hasta > now() then p.suspendido_hasta end,
        case when p.suspendido_hasta > now() then p.suspension_motivo end)
      on conflict (huella) do update set
        borrada_at = now(),
        reportes = public.cuentas_borradas.reportes + excluded.reportes,
        -- Vale la suspensión que tenía la cuenta al borrarse (si se la habían levantado, ninguna).
        suspendido_hasta = excluded.suspendido_hasta,
        suspension_motivo = excluded.suspension_motivo;
    end if;
  end if;
  -- Al borrar el usuario se borra su perfil, y con él todo lo demás.
  delete from auth.users where id = yo;
  delete from public.profiles where id = yo;
  perform public._emparejar();
  perform public._avisar();
end $$;

-- ---------------------------------------------------------------------------
-- Moderación: solo desde el SQL Editor. La app no puede llamar a estas funciones.
-- ---------------------------------------------------------------------------
--
--   Ver a quiénes reportaron en los últimos 30 días:
--     select * from public.mod_reportes();
--   Ver el detalle de los reportes de alguien (por su usuario de Discord):
--     select * from public.mod_detalle('usuario');
--   Suspender 7 días (0 días = sin fecha de fin):
--     select public.mod_suspender('usuario', 7, 'Insultos en una sala');
--   Levantar la suspensión:
--     select public.mod_levantar('usuario');

create or replace function public._mod_buscar(p_usuario text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  v_nombre text := lower(trim(leading '@' from trim(coalesce(p_usuario, ''))));
  v_ids uuid[];
begin
  select array_agg(id) into v_ids from public.profiles where lower(username) = v_nombre;
  if v_ids is null then
    raise exception 'No hay nadie con el usuario de Discord "%". Fijate cómo figura en mod_reportes().', v_nombre;
  end if;
  if cardinality(v_ids) > 1 then
    raise exception 'Hay % cuentas con el usuario "%". Avisá para resolverlo a mano.', cardinality(v_ids), v_nombre;
  end if;
  return v_ids[1];
end $$;

create or replace function public.mod_reportes(p_dias int default 30)
returns table (usuario text, nick text, reportes bigint, de_distintos bigint, motivos text, ultimo timestamptz,
               en_cuentas_borradas int, suspendido_hasta timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.username, u.nick, count(*), count(distinct r.de),
         string_agg(distinct r.motivo, ', '), max(r.creado_at),
         coalesce((select b.reportes from public.cuentas_borradas b where b.huella = public._huella(u.discord_id)), 0),
         case when u.suspendido_hasta > now() then u.suspendido_hasta end
  from public.reportes r join public.profiles u on u.id = r.reportado
  where r.creado_at > now() - make_interval(days => greatest(coalesce(p_dias, 30), 1))
  group by u.id
  order by count(distinct r.de) desc, count(*) desc
$$;

create or replace function public.mod_detalle(p_usuario text)
returns table (cuando timestamptz, lo_reporto text, motivo text, detalle text)
language sql stable security definer set search_path = '' as $$
  select r.creado_at, d.username, r.motivo, r.detalle
  from public.reportes r join public.profiles d on d.id = r.de
  where r.reportado = public._mod_buscar(p_usuario)
  order by r.creado_at desc
$$;

create or replace function public.mod_suspender(p_usuario text, p_dias int default 7, p_motivo text default '')
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := public._mod_buscar(p_usuario);
  v_hasta timestamptz := case when coalesce(p_dias, 0) <= 0 then 'infinity'::timestamptz else now() + make_interval(days => p_dias) end;
  b record;
begin
  perform public._turno();
  update public.profiles
  set suspendido_hasta = v_hasta, suspension_motivo = left(trim(coalesce(p_motivo, '')), 200)
  where id = v_id;
  -- Si estaba buscando, deja de buscar.
  for b in select id from public.busquedas where user_id = v_id and estado in ('activa', 'agrupada') loop
    perform public._terminar(b.id, 'cancelada');
  end loop;
  delete from public.mensajes where estado = 'pendiente' and (de = v_id or a = v_id);
  perform public._emparejar();
  perform public._notificar(v_id, 'Tu cuenta fue suspendida', public._suspension(v_id), '/', 'suspension');
  perform public._avisar();
  return public._suspension(v_id);
end $$;

create or replace function public.mod_levantar(p_usuario text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := public._mod_buscar(p_usuario);
begin
  update public.profiles set suspendido_hasta = null, suspension_motivo = null where id = v_id;
  -- Y que no le vuelva si borra la cuenta y entra de nuevo.
  update public.cuentas_borradas set suspendido_hasta = null, suspension_motivo = null
  where huella = public._huella((select discord_id from public.profiles where id = v_id));
  perform public._avisar();
  return 'Listo: la cuenta ya no está suspendida.';
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._huella(text), public._bloqueo_entre(uuid, uuid[]), public._bloqueo_grupos(uuid[], uuid[]), public._grupo_de(uuid),
  public._discord(uuid), public._suspension(uuid), public._emparejar(),
  public._seg_busqueda(), public._seg_mensaje(), public._seg_mensaje_grupo(), public._seg_participante(), public._seg_grupo(),
  public._seg_amistad(), public._seg_amistad_aceptar(), public._seg_alta(), public._seg_referido(),
  public._mod_buscar(text), public.mod_reportes(int), public.mod_detalle(text),
  public.mod_suspender(text, int, text), public.mod_levantar(text)
from public, anon, authenticated;

revoke all on function public.bloquear(uuid), public.desbloquear(uuid), public.seguridad(), public.borrar_cuenta()
from public, anon;
grant execute on function public.bloquear(uuid), public.desbloquear(uuid), public.seguridad(), public.borrar_cuenta()
to authenticated;
