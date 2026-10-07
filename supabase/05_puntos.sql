-- HaxMatch · Paso 5: puntos, niveles y referidos
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Necesita los pasos 1, 2, 3 y 4. Se puede ejecutar más de una vez sin romper nada.
--
-- Cómo está pensado:
-- - Los puntos dejan de calcularse en cada celular: los da el servidor, en el
--   momento en que pasa lo que suma (un partido que cuenta, un video nuevo en
--   Clips, una reacción, el primer ingreso del día, un referido que completa
--   sus amistosos). Cada cosa suma una sola vez.
-- - Queda anotado cada movimiento (tabla "puntos") y el total en el perfil.
-- - El nivel sale del total, igual para todos: por eso ahora se puede mostrar
--   el nivel de los demás jugadores.
-- - El "día" (para los topes y la racha) es el de Buenos Aires, para todos.
-- - La primera vez, reconstruye los puntos de lo que ya estaba guardado
--   (partidos que contaron, videos nuevos y reacciones). Los días de conexión
--   anteriores no estaban guardados en el servidor: la racha arranca de nuevo.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Total de puntos de cada usuario. La app no puede tocarlo: solo cambia desde acá.
alter table public.profiles add column if not exists puntos int not null default 0;

create table if not exists public.puntos (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('amistoso', 'reel', 'reaccion', 'conexion', 'racha', 'referido')),
  -- 0 cuando ese día ya se había llegado al tope: queda anotado, pero no suma.
  puntos int not null check (puntos >= 0),
  -- Qué lo originó: el partido, el video, el día o el referido. Cada uno suma una sola vez.
  referencia text not null,
  -- Amistoso: contra quién fue (para el tope por rival). Racha: cuántos días seguidos.
  dato text,
  dia date not null,
  creado_at timestamptz not null default now(),
  unique (user_id, tipo, referencia)
);
create index if not exists puntos_por_usuario on public.puntos (user_id, creado_at desc);
create index if not exists puntos_por_dia on public.puntos (user_id, tipo, dia);
-- Para armar rápido la lista de referidos de cada uno.
create index if not exists perfiles_por_referente on public.profiles (referido_por) where referido_por is not null;

alter table public.puntos enable row level security;
revoke all on public.puntos from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------

-- Día calendario de un momento, en Buenos Aires.
create or replace function public._dia(p_cuando timestamptz)
returns date language sql immutable set search_path = '' as $$
  select (p_cuando at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- Nivel que corresponde a una cantidad de puntos (todos empiezan en 0).
create or replace function public._nivel(p_puntos int)
returns int language sql immutable set search_path = '' as $$
  select count(*)::int
  from unnest(array[50, 150, 300, 500, 800, 1200, 1700, 2300, 3000, 4000]) as minimo
  where coalesce(p_puntos, 0) >= minimo
$$;

-- Anota un movimiento. Devuelve false si eso ya había sumado antes.
create or replace function public._dar(
  p_user uuid, p_tipo text, p_puntos int, p_referencia text, p_dato text default null, p_cuando timestamptz default now())
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
begin
  insert into public.puntos (user_id, tipo, puntos, referencia, dato, dia, creado_at)
  values (p_user, p_tipo, greatest(p_puntos, 0), p_referencia, p_dato, public._dia(p_cuando), p_cuando)
  on conflict (user_id, tipo, referencia) do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  if p_puntos > 0 then
    update public.profiles set puntos = puntos + p_puntos where id = p_user;
  end if;
  return true;
end $$;

-- De a un movimiento por usuario a la vez, para que dos al mismo tiempo no pasen los dos por debajo del tope.
create or replace function public._turno_puntos(p_user uuid)
returns void language sql security definer set search_path = '' as $$
  select pg_advisory_xact_lock(7213, hashtext(p_user::text))
$$;

-- Días seguidos con conexión, terminando en p_hasta.
create or replace function public._racha(p_user uuid, p_hasta date)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from (
    select dia, row_number() over (order by dia desc) as n
    from public.puntos
    where user_id = p_user and tipo = 'conexion' and dia <= p_hasta
    order by dia desc limit 400) t
  where t.dia = p_hasta - (t.n - 1)::int
$$;

-- Racha para mostrar: si hoy todavía no entró, sigue viva la que traía hasta ayer.
create or replace function public._racha_viva(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select greatest(public._racha(p_user, public._dia(now())), public._racha(p_user, public._dia(now()) - 1))
$$;

-- Un referido completó sus 5 amistosos: 50 puntos para quien lo invitó, hasta 10 por mes.
create or replace function public._dar_referido(p_referente uuid, p_referido uuid, p_cuando timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_puntos int := 50;
  v_nick text;
begin
  if p_referente is null or p_referente = p_referido
     or exists (select 1 from public.puntos where user_id = p_referente and tipo = 'referido' and referencia = p_referido::text) then
    return;
  end if;
  perform public._turno_puntos(p_referente);
  if (select count(*) from public.puntos
      where user_id = p_referente and tipo = 'referido' and puntos > 0
        and date_trunc('month', dia) = date_trunc('month', public._dia(p_cuando))) >= 10 then
    v_puntos := 0;
  end if;
  if not public._dar(p_referente, 'referido', v_puntos, p_referido::text, null, p_cuando) then
    return;
  end if;
  -- Al reconstruir lo que ya estaba guardado no se avisa: serían novedades viejas.
  if coalesce(current_setting('haxmatch.reconstruyendo', true), '') = '1' then
    return;
  end if;
  select nick into v_nick from public.profiles where id = p_referido;
  perform public._notificar(
    p_referente, coalesce(v_nick, 'Tu referido') || ' completó 5 amistosos',
    case when v_puntos > 0 then '+' || v_puntos || ' puntos de nivel' else 'Este mes ya llegaste al tope de referidos' end,
    '/perfil/referir', 'referido');
  perform public._avisar();
end $$;

-- Un partido le cuenta a un jugador: 10 puntos, hasta 5 por día y 3 con el mismo rival.
-- Pasado el tope queda anotado con 0: cuenta para el historial y para los referidos.
create or replace function public._dar_amistoso(p_user uuid, p_match uuid, p_cuando timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_dia date := public._dia(p_cuando);
  v_rival text;
  v_puntos int := 10;
  v_referente uuid;
begin
  if exists (select 1 from public.puntos where user_id = p_user and tipo = 'amistoso' and referencia = p_match::text) then
    return;
  end if;
  perform public._turno_puntos(p_user);
  -- El rival son los del otro lado de la sala.
  select coalesce(string_agg(q.user_id::text, '+' order by q.user_id), '') into v_rival
  from public.match_participantes yo
  join public.match_participantes q on q.match_id = yo.match_id and q.equipo <> yo.equipo
  where yo.match_id = p_match and yo.user_id = p_user;
  if (select count(*) from public.puntos
      where user_id = p_user and tipo = 'amistoso' and dia = v_dia and puntos > 0) >= 5
     or (select count(*) from public.puntos
         where user_id = p_user and tipo = 'amistoso' and dia = v_dia and puntos > 0 and dato = v_rival) >= 3 then
    v_puntos := 0;
  end if;
  if not public._dar(p_user, 'amistoso', v_puntos, p_match::text, v_rival, p_cuando) then
    return;
  end if;
  -- ¿Con este llegó a los 5 amistosos y lo había invitado alguien?
  select referido_por into v_referente from public.profiles where id = p_user;
  if v_referente is not null
     and (select count(*) from public.puntos where user_id = p_user and tipo = 'amistoso') >= 5 then
    perform public._dar_referido(v_referente, p_user, p_cuando);
  end if;
end $$;

-- Video nuevo en Clips: 8 puntos, uno por día.
create or replace function public._dar_reel(p_user uuid, p_tiktok_id text, p_cuando timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_puntos int := 8;
begin
  if exists (select 1 from public.puntos where user_id = p_user and tipo = 'reel' and referencia = p_tiktok_id) then
    return;
  end if;
  perform public._turno_puntos(p_user);
  if exists (select 1 from public.puntos
             where user_id = p_user and tipo = 'reel' and dia = public._dia(p_cuando) and puntos > 0) then
    v_puntos := 0;
  end if;
  perform public._dar(p_user, 'reel', v_puntos, p_tiktok_id, null, p_cuando);
end $$;

-- Reacción a un clip de otro: 1 punto, hasta 10 clips distintos por día. Cada clip suma una sola vez.
create or replace function public._dar_reaccion(p_user uuid, p_tiktok_id text, p_cuando timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.puntos where user_id = p_user and tipo = 'reaccion' and referencia = p_tiktok_id) then
    return;
  end if;
  perform public._turno_puntos(p_user);
  if (select count(*) from public.puntos
      where user_id = p_user and tipo = 'reaccion' and dia = public._dia(p_cuando) and puntos > 0) >= 10 then
    return;
  end if;
  perform public._dar(p_user, 'reaccion', 1, p_tiktok_id, null, p_cuando);
end $$;

-- Primer ingreso del día: 2 puntos. Al llegar justo a 3, 7, 14 o 30 días seguidos, un extra.
create or replace function public._conexion(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_hoy date := public._dia(now());
  v_racha int;
  v_extra int;
begin
  if exists (select 1 from public.puntos where user_id = p_user and tipo = 'conexion' and dia = v_hoy)
     or not exists (select 1 from public.profiles where id = p_user and onboarding) then
    return;
  end if;
  if not public._dar(p_user, 'conexion', 2, v_hoy::text) then
    return;
  end if;
  v_racha := public._racha(p_user, v_hoy);
  v_extra := case v_racha when 3 then 5 when 7 then 15 when 14 then 30 when 30 then 60 else 0 end;
  if v_extra > 0 then
    perform public._dar(p_user, 'racha', v_extra, v_hoy::text, v_racha::text);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Disparadores: cuándo se dan los puntos
-- ---------------------------------------------------------------------------

-- El partido pasó a contar: suma para cada uno que entró o confirmó.
create or replace function public._puntos_al_contar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public._dar_amistoso(p.user_id, new.id, new.contado_at)
  from public.match_participantes p
  where p.match_id = new.id and (p.confirmado_at is not null or p.entro_at is not null);
  return null;
end $$;

drop trigger if exists puntos_al_contar on public.matches;
create trigger puntos_al_contar after update of contado_at on public.matches
  for each row when (old.contado_at is null and new.contado_at is not null)
  execute function public._puntos_al_contar();

-- Alguien entró o confirmó en un partido que ya contaba.
create or replace function public._puntos_al_entrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.confirmado_at is not null or new.entro_at is not null)
     and exists (select 1 from public.matches m where m.id = new.match_id and m.contado_at is not null) then
    perform public._dar_amistoso(new.user_id, new.match_id, now());
  end if;
  return null;
end $$;

drop trigger if exists puntos_al_entrar on public.match_participantes;
create trigger puntos_al_entrar after insert or update of confirmado_at, entro_at on public.match_participantes
  for each row execute function public._puntos_al_entrar();

-- Un video nuevo que está en Clips. "Nuevo" es publicado después de vincular la cuenta:
-- así un video viejo que deja de estar y vuelve a aparecer (por ejemplo, si lo pasan a
-- privado y de nuevo a público) no cuenta como nuevo.
create or replace function public._reel_suma(p_user uuid, p_inicial boolean, p_visible boolean, p_hashtags text[], p_publicado timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select not p_inicial and p_visible and p_hashtags && array['haxball', 'haxmatch']
    and exists (select 1 from public.tiktok_cuentas c where c.user_id = p_user and p_publicado >= c.vinculada_at)
$$;

create or replace function public._puntos_al_importar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public._reel_suma(new.user_id, new.inicial, new.visible, new.hashtags, new.publicado_at) then
    perform public._dar_reel(new.user_id, new.tiktok_id, now());
  end if;
  return null;
end $$;

drop trigger if exists puntos_al_importar on public.reels;
create trigger puntos_al_importar after insert or update of hashtags, visible on public.reels
  for each row execute function public._puntos_al_importar();

-- Una reacción a un clip de otro. Tiene que ser un clip de los que se ven en Clips.
create or replace function public._puntos_al_reaccionar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  select user_id, tiktok_id into r from public.reels
  where id = new.reel_id and visible and hashtags && array['haxball', 'haxmatch'];
  if found and r.user_id <> new.user_id then
    perform public._dar_reaccion(new.user_id, r.tiktok_id, now());
  end if;
  return null;
end $$;

drop trigger if exists puntos_al_reaccionar on public.reel_reacciones;
create trigger puntos_al_reaccionar after insert on public.reel_reacciones
  for each row execute function public._puntos_al_reaccionar();

-- ---------------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------------

-- Todo lo que la app muestra (cola y amigos, pasos 2 y 3) más mis puntos, mis
-- referidos y el nivel de los demás. De paso anota el ingreso del día.
create or replace function public.estado_completo(p_visible boolean default true)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v jsonb;
begin
  v := public.estado(p_visible)::jsonb;
  if p_visible is not false then
    perform public._conexion(yo);
  end if;
  v := jsonb_set(v, '{usuarios}', coalesce((
    select jsonb_agg(u.x || jsonb_build_object('nivel', public._nivel(p.puntos)) order by u.n)
    from jsonb_array_elements(v -> 'usuarios') with ordinality as u (x, n)
    left join public.profiles p on p.id = (u.x ->> 'id')::uuid), '[]'::jsonb));
  v := jsonb_set(v, '{amigos}', coalesce((
    select jsonb_agg(u.x || jsonb_build_object('nivel', public._nivel(p.puntos)) order by u.n)
    from jsonb_array_elements(v -> 'amigos') with ordinality as u (x, n)
    left join public.profiles p on p.id = (u.x ->> 'id')::uuid), '[]'::jsonb));
  return (v || jsonb_build_object('puntos', jsonb_build_object(
    'total', (select puntos from public.profiles where id = yo),
    'racha', public._racha_viva(yo),
    -- Cuántas veces sumó cada cosa (también las que quedaron en 0 por tope).
    'conteos', (
      select coalesce(jsonb_object_agg(t.tipo, t.n), '{}'::jsonb)
      from (select tipo, count(*) as n from public.puntos where user_id = yo group by tipo) t),
    -- Lo último, para avisar en la app cuando algo suma.
    'eventos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'tipo', e.tipo, 'puntos', e.puntos, 'referencia', e.referencia, 'dato', e.dato,
        'creado_at', e.creado_at) order by e.id), '[]'::jsonb)
      from public.puntos e
      where e.user_id = yo and e.tipo in ('amistoso', 'reel', 'racha', 'referido')
        and e.creado_at > now() - interval '9 days'),
    'de_referidos', (select coalesce(sum(puntos), 0) from public.puntos where user_id = yo and tipo = 'referido'),
    -- A quiénes invité y cómo van. puntos: lo que me sumó (null si todavía no completó).
    'referidos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'nick', r.nick, 'username', r.username, 'foto', public._foto_version(r.id, r.foto_url),
        'nivel', public._nivel(r.puntos),
        'amistosos', (select count(*) from (
          select 1 from public.puntos x where x.user_id = r.id and x.tipo = 'amistoso' limit 5) t),
        'puntos', (select x.puntos from public.puntos x
                   where x.user_id = yo and x.tipo = 'referido' and x.referencia = r.id::text)
      ) order by r.created_at desc), '[]'::jsonb)
      from public.profiles r where r.referido_por = yo and r.onboarding)
  )))::json;
end $$;

-- Clips (paso 4) con el nivel de cada autor.
create or replace function public.clips_completo()
returns json language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := public.clips()::jsonb;
begin
  return jsonb_set(v, '{feed}', coalesce((
    select jsonb_agg(f.x || jsonb_build_object('nivel', public._nivel(p.puntos)) order by f.n)
    from jsonb_array_elements(v -> 'feed') with ordinality as f (x, n)
    left join public.profiles p on p.id = (f.x ->> 'user_id')::uuid), '[]'::jsonb))::json;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._dia(timestamptz), public._nivel(int),
  public._dar(uuid, text, int, text, text, timestamptz), public._turno_puntos(uuid),
  public._racha(uuid, date), public._racha_viva(uuid),
  public._dar_referido(uuid, uuid, timestamptz), public._dar_amistoso(uuid, uuid, timestamptz),
  public._dar_reel(uuid, text, timestamptz), public._dar_reaccion(uuid, text, timestamptz),
  public._conexion(uuid), public._reel_suma(uuid, boolean, boolean, text[], timestamptz),
  public._puntos_al_contar(), public._puntos_al_entrar(), public._puntos_al_importar(), public._puntos_al_reaccionar()
from public, anon, authenticated;

revoke all on function public.estado_completo(boolean), public.clips_completo() from public, anon;
grant execute on function public.estado_completo(boolean), public.clips_completo() to authenticated;

-- ---------------------------------------------------------------------------
-- Lo que ya estaba guardado: se reconstruyen sus puntos (una sola vez cada cosa).
-- Va al final, con los permisos ya puestos.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  -- Lo que salga de acá es historia: no se manda como novedad.
  perform set_config('haxmatch.reconstruyendo', '1', true);
  for r in
    select p.user_id, p.match_id, m.contado_at
    from public.match_participantes p join public.matches m on m.id = p.match_id
    where m.contado_at is not null and (p.confirmado_at is not null or p.entro_at is not null)
    order by m.contado_at, p.user_id
  loop
    perform public._dar_amistoso(r.user_id, r.match_id, r.contado_at);
  end loop;
  for r in
    select user_id, tiktok_id, importado_at from public.reels
    where public._reel_suma(user_id, inicial, visible, hashtags, publicado_at)
    order by importado_at
  loop
    perform public._dar_reel(r.user_id, r.tiktok_id, r.importado_at);
  end loop;
  for r in
    select x.user_id, v.tiktok_id, x.creado_at
    from public.reel_reacciones x join public.reels v on v.id = x.reel_id
    where v.user_id <> x.user_id and v.visible and v.hashtags && array['haxball', 'haxmatch']
    order by x.creado_at
  loop
    perform public._dar_reaccion(r.user_id, r.tiktok_id, r.creado_at);
  end loop;
end $$;
