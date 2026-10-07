-- HaxMatch · Paso 4: clips de TikTok
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Necesita los pasos 1, 2 y 3. Se puede ejecutar más de una vez sin romper nada.
--
-- Cómo está pensado:
-- - Cada usuario puede vincular una cuenta de TikTok. El permiso lo da en la
--   página de TikTok; la web de HaxMatch recibe las llaves de acceso y las
--   guarda acá, en una tabla que la app nunca puede leer.
-- - De TikTok se trae solo la lista de videos públicos del usuario (título,
--   fecha, duración y enlace). Los videos no se copian: se reproducen desde TikTok.
-- - En Clips aparecen los que tienen #haxball o #haxmatch y que su dueño no ocultó.
-- - Al desvincular se borran las llaves y todos los videos de ese usuario.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Vinculaciones en curso: une el pedido que sale hacia TikTok con el usuario que lo empezó.
create table if not exists public.tiktok_estados (
  state text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  creado_at timestamptz not null default now()
);

create table if not exists public.tiktok_cuentas (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Identificador que TikTok le da a ese usuario para esta app.
  open_id text not null unique,
  nombre text,
  access_token text not null,
  refresh_token text not null,
  expira_at timestamptz not null,
  refresh_expira_at timestamptz not null,
  scope text,
  vinculada_at timestamptz not null default now(),
  -- Última vez que se trajo la lista de videos, y última vez que se pidió traerla.
  sincronizada_at timestamptz,
  pedida_at timestamptz,
  -- Si TikTok rechazó el acceso (por ejemplo, el usuario quitó el permiso desde TikTok).
  error text
);

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tiktok_id text not null unique check (tiktok_id ~ '^[0-9]{5,25}$'),
  titulo text not null default '',
  hashtags text[] not null default '{}',
  duracion int,
  enlace text check (enlace is null or enlace ~ '^https://(www|vm|vt|m)\.tiktok\.com/'),
  publicado_at timestamptz not null,
  -- El dueño puede ocultarlo de Clips.
  visible boolean not null default true,
  -- Vino con la primera importación, al vincular. Esos no suman puntos.
  inicial boolean not null default false,
  importado_at timestamptz not null default now()
);
create index if not exists reels_por_usuario on public.reels (user_id);
create index if not exists reels_por_fecha on public.reels (publicado_at desc);

create table if not exists public.reel_reacciones (
  reel_id uuid not null references public.reels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  creado_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

alter table public.tiktok_estados enable row level security;
alter table public.tiktok_cuentas enable row level security;
alter table public.reels enable row level security;
alter table public.reel_reacciones enable row level security;
revoke all on public.tiktok_estados, public.tiktok_cuentas, public.reels, public.reel_reacciones from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

-- ¿Es la clave que comparten la base y la web de HaxMatch?
create or replace function public._clave_ok(p_secreto text)
returns boolean language sql stable security definer set search_path = '' as $$
  -- coalesce: si la clave todavía no se configuró, la respuesta es "no", nunca "no sé".
  select coalesce(
    p_secreto is not null and char_length(p_secreto) >= 32
      and p_secreto = (select valor from public.config_privada where clave = 'push_secreto'),
    false)
$$;

-- Dirección de la web de HaxMatch (sale de la configuración de los avisos).
create or replace function public._web()
returns text language sql stable security definer set search_path = '' as $$
  select regexp_replace(valor, '/api/push/enviar$', '') from public.config_privada where clave = 'push_url'
$$;

-- Hashtags de un texto, en minúsculas y sin repetir.
create or replace function public._hashtags(p_texto text)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct lower(m[1])), '{}'::text[])
  from regexp_matches(coalesce(p_texto, ''), '#([[:alnum:]_]{1,50})', 'g') as m
$$;

-- Guarda llaves nuevas de un usuario. Solo pisa lo que vino con un valor válido.
create or replace function public._tiktok_guardar_llaves(p_user uuid, p_tokens jsonb)
returns void language sql security definer set search_path = '' as $$
  update public.tiktok_cuentas
  set access_token = coalesce(nullif(p_tokens ->> 'access_token', ''), access_token),
      refresh_token = coalesce(nullif(p_tokens ->> 'refresh_token', ''), refresh_token),
      expira_at = case when (p_tokens ->> 'expira') ~ '^[1-9][0-9]{0,8}$'
        then now() + make_interval(secs => (p_tokens ->> 'expira')::int) else expira_at end,
      refresh_expira_at = case when (p_tokens ->> 'refresh_expira') ~ '^[1-9][0-9]{0,8}$'
        then now() + make_interval(secs => (p_tokens ->> 'refresh_expira')::int) else refresh_expira_at end
  where user_id = p_user and p_tokens is not null and jsonb_typeof(p_tokens) = 'object'
$$;

-- Le pide a la web que traiga de TikTok los videos de un usuario.
-- Devuelve 'pedido', 'reciente' (ya hay un pedido en curso), 'vencido' (hay que
-- volver a vincular) o 'no' (no se puede pedir ahora).
create or replace function public._tiktok_sincronizar(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c public.tiktok_cuentas;
  v_secreto text;
begin
  -- De a un pedido por cuenta: dos al mismo tiempo se pisarían al renovar las llaves.
  select * into c from public.tiktok_cuentas where user_id = p_user for update;
  if not found then
    return 'no';
  end if;
  if c.refresh_expira_at < now() then
    -- El permiso dura un año sin usarse. Pasado eso, solo queda vincular de nuevo.
    update public.tiktok_cuentas
    set error = 'El permiso de TikTok venció. Volvé a vincular tu cuenta.' where user_id = p_user;
    return 'vencido';
  end if;
  if c.pedida_at is not null and c.pedida_at > now() - interval '45 seconds' then
    return 'reciente';
  end if;
  select valor into v_secreto from public.config_privada where clave = 'push_secreto';
  if v_secreto is null or public._web() is null or not public._hay_red() then
    return 'no';
  end if;
  update public.tiktok_cuentas set pedida_at = now() where user_id = p_user;
  perform net.http_post(
    url := public._web() || '/api/tiktok/sincronizar',
    body := jsonb_build_object(
      'user_id', c.user_id, 'access_token', c.access_token, 'refresh_token', c.refresh_token,
      'expira', floor(extract(epoch from c.expira_at))::bigint),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-haxmatch-secreto', v_secreto),
    timeout_milliseconds := 20000);
  return 'pedido';
end $$;

-- Para la tarea programada: actualiza las cuentas que hace más de 6 horas que no se revisan.
create or replace function public._tiktok_sincronizar_todos()
returns int language plpgsql security definer set search_path = '' as $$
declare
  c record;
  n int := 0;
begin
  for c in
    select user_id from public.tiktok_cuentas
    where error is null and (sincronizada_at is null or sincronizada_at < now() - interval '6 hours')
      and (pedida_at is null or pedida_at < now() - interval '1 hour')
    order by sincronizada_at nulls first limit 50
  loop
    if public._tiktok_sincronizar(c.user_id) = 'pedido' then
      n := n + 1;
    end if;
  end loop;
  delete from public.tiktok_estados where creado_at < now() - interval '1 hour';
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Funciones que llama la web de HaxMatch (con la clave compartida)
-- ---------------------------------------------------------------------------

-- Empieza una vinculación para un usuario. Devuelve el código que viaja a TikTok y vuelve.
create or replace function public.tiktok_empezar(p_secreto text, p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_state text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  delete from public.tiktok_estados where user_id = p_user or creado_at < now() - interval '1 hour';
  insert into public.tiktok_estados (state, user_id) values (v_state, p_user);
  return v_state;
end $$;

-- TikTok dio el permiso: se guardan las llaves de acceso de ese usuario.
create or replace function public.tiktok_guardar(
  p_secreto text, p_state text, p_open_id text, p_nombre text,
  p_access text, p_refresh text, p_expira int, p_refresh_expira int, p_scope text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
  v_antes text;
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  delete from public.tiktok_estados
  where state = p_state and creado_at > now() - interval '15 minutes'
  returning user_id into v_user;
  if v_user is null then
    raise exception 'vencido';
  end if;
  if coalesce(p_open_id, '') = '' or coalesce(p_access, '') = '' or coalesce(p_refresh, '') = '' then
    raise exception 'incompleto';
  end if;
  if exists (select 1 from public.tiktok_cuentas where open_id = p_open_id and user_id <> v_user) then
    raise exception 'ocupada';
  end if;
  -- Si antes tenía vinculada otra cuenta de TikTok, sus videos se van.
  select open_id into v_antes from public.tiktok_cuentas where user_id = v_user;
  if v_antes is not null and v_antes <> p_open_id then
    delete from public.reels where user_id = v_user;
  end if;
  insert into public.tiktok_cuentas (user_id, open_id, nombre, access_token, refresh_token, expira_at, refresh_expira_at, scope)
  values (v_user, p_open_id, left(nullif(trim(coalesce(p_nombre, '')), ''), 60), p_access, p_refresh,
          now() + make_interval(secs => greatest(coalesce(p_expira, 0), 60)),
          now() + make_interval(secs => greatest(coalesce(p_refresh_expira, 0), 3600)), left(p_scope, 200))
  on conflict (user_id) do update
    set open_id = excluded.open_id, nombre = excluded.nombre, access_token = excluded.access_token,
        refresh_token = excluded.refresh_token, expira_at = excluded.expira_at,
        refresh_expira_at = excluded.refresh_expira_at, scope = excluded.scope,
        vinculada_at = now(), error = null,
        -- Si cambió de cuenta de TikTok, lo que venga es una primera importación.
        sincronizada_at = case when public.tiktok_cuentas.open_id = excluded.open_id then public.tiktok_cuentas.sincronizada_at end;
  return v_user;
end $$;

-- Lista de videos de un usuario, recién traída de TikTok.
-- p_videos: [{id, titulo, descripcion, duracion, creado (segundos), enlace}]
-- p_completa: la lista trae todos sus videos (entonces los que ya no están se borran).
-- p_inicial: es la primera importación, al vincular. También cuenta como primera
--   si todavía no se había podido traer nada desde que se vinculó.
-- p_tokens: llaves nuevas, si hubo que renovarlas.
create or replace function public.tiktok_importar(
  p_secreto text, p_user uuid, p_videos jsonb, p_completa boolean default false,
  p_inicial boolean default false, p_tokens jsonb default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  n int := 0;
  v_ids text[] := '{}';
  v_titulo text;
  v_primera boolean;
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  select (p_inicial is true or sincronizada_at is null) into v_primera
  from public.tiktok_cuentas where user_id = p_user for update;
  if not found then
    raise exception 'Ese usuario no tiene TikTok vinculado';
  end if;
  if p_videos is null or jsonb_typeof(p_videos) <> 'array' or jsonb_array_length(p_videos) > 300 then
    raise exception 'Lista no válida';
  end if;

  for v in select * from jsonb_array_elements(p_videos) loop
    continue when coalesce(v ->> 'id', '') !~ '^[0-9]{5,25}$';
    v_ids := v_ids || (v ->> 'id');
    -- El "título" de TikTok suele venir vacío: lo que escribe la gente es la descripción.
    v_titulo := left(trim(coalesce(nullif(trim(v ->> 'titulo'), ''), v ->> 'descripcion', '')), 150);
    insert into public.reels (user_id, tiktok_id, titulo, hashtags, duracion, enlace, publicado_at, inicial)
    values (
      p_user, v ->> 'id', v_titulo,
      public._hashtags(coalesce(v ->> 'titulo', '') || ' ' || coalesce(v ->> 'descripcion', '')),
      case when (v ->> 'duracion') ~ '^[0-9]{1,6}$' then (v ->> 'duracion')::int end,
      case when (v ->> 'enlace') ~ '^https://(www|vm|vt|m)\.tiktok\.com/' then left(v ->> 'enlace', 300) end,
      case when (v ->> 'creado') ~ '^[0-9]{9,11}$' then to_timestamp((v ->> 'creado')::bigint) else now() end,
      v_primera)
    on conflict (tiktok_id) do update
      set titulo = excluded.titulo, hashtags = excluded.hashtags, duracion = excluded.duracion, enlace = excluded.enlace
      where public.reels.user_id = p_user;
    n := n + 1;
  end loop;

  if p_completa is true then
    delete from public.reels where user_id = p_user and not (tiktok_id = any (v_ids));
  end if;

  update public.tiktok_cuentas set sincronizada_at = now(), error = null where user_id = p_user;
  perform public._tiktok_guardar_llaves(p_user, p_tokens);
  return n;
end $$;

-- La web renovó las llaves de un usuario: se guardan en el momento, pase lo que pase después.
create or replace function public.tiktok_llaves(p_secreto text, p_user uuid, p_tokens jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  perform public._tiktok_guardar_llaves(p_user, p_tokens);
end $$;

-- TikTok rechazó el acceso de un usuario: queda anotado para pedirle que vuelva a vincular.
create or replace function public.tiktok_fallo(p_secreto text, p_user uuid, p_error text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  update public.tiktok_cuentas set error = left(coalesce(p_error, 'error'), 200) where user_id = p_user;
end $$;

-- ---------------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------------

-- Todo lo de Clips, de una vez: el feed, mis videos y el estado de mi TikTok.
create or replace function public.clips()
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  return json_build_object(
    'feed', (
      select coalesce(json_agg(f order by f.publicado_at desc), '[]'::json) from (
        select r.id, r.user_id, r.tiktok_id, r.titulo, r.hashtags, r.duracion, r.enlace, r.publicado_at,
               u.nick, u.username, public._foto_version(u.id, u.foto_url) as foto,
               (select count(*) from public.reel_reacciones x where x.reel_id = r.id)::int as reacciones,
               exists (select 1 from public.reel_reacciones x where x.reel_id = r.id and x.user_id = yo) as reaccione
        from public.reels r join public.profiles u on u.id = r.user_id
        where r.visible and r.hashtags && array['haxball', 'haxmatch']
        order by r.publicado_at desc limit 100) f),
    'mios', (
      select coalesce(json_agg(json_build_object(
        'id', r.id, 'tiktok_id', r.tiktok_id, 'titulo', r.titulo, 'hashtags', r.hashtags, 'duracion', r.duracion,
        'enlace', r.enlace, 'publicado_at', r.publicado_at, 'visible', r.visible, 'inicial', r.inicial,
        'reacciones', (select count(*) from public.reel_reacciones x where x.reel_id = r.id)::int
      ) order by r.publicado_at desc), '[]'::json)
      from public.reels r where r.user_id = yo),
    'tiktok', (
      select json_build_object(
        'vinculada', true, 'nombre', c.nombre, 'vinculada_at', c.vinculada_at,
        'sincronizada_at', c.sincronizada_at, 'error', c.error)
      from public.tiktok_cuentas c where c.user_id = yo)
  );
end $$;

-- Mostrar u ocultar uno de mis videos en Clips.
create or replace function public.reel_visible(p_reel uuid, p_visible boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.reels set visible = (p_visible is true) where id = p_reel and user_id = (select auth.uid());
  if not found then
    raise exception 'Ese video no es tuyo';
  end if;
end $$;

drop function if exists public.reaccionar(uuid);

-- Reaccionar a un clip (p_marcar true) o quitar la reacción (false). Devuelve cómo quedó.
create or replace function public.reaccionar(p_reel uuid, p_marcar boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  if p_marcar is not true then
    delete from public.reel_reacciones where reel_id = p_reel and user_id = yo;
    return false;
  end if;
  if not exists (select 1 from public.reels where id = p_reel and visible) then
    raise exception 'Ese clip ya no está';
  end if;
  insert into public.reel_reacciones (reel_id, user_id) values (p_reel, yo) on conflict do nothing;
  return true;
end $$;

-- "Actualizar": pide que se vuelva a traer mi lista de videos de TikTok.
create or replace function public.tiktok_actualizar()
returns text language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v text;
begin
  if not exists (select 1 from public.tiktok_cuentas where user_id = yo) then
    raise exception 'No tenés TikTok vinculado';
  end if;
  v := public._tiktok_sincronizar(yo);
  if v = 'no' then
    raise exception 'No pudimos pedirle tus videos a TikTok. Probá de nuevo más tarde.';
  end if;
  -- 'pedido', 'reciente' (ya se estaba actualizando) o 'vencido' (la app muestra que hay que volver a vincular).
  return v;
end $$;

-- "Deslizar para actualizar" en Clips: le pide a TikTok los videos nuevos de las
-- cuentas vinculadas. La mía siempre; las de los demás, si hace más de 2 minutos
-- que no se revisan. Hasta 20 por vez. Devuelve cuántas pidió.
create or replace function public.clips_refrescar()
returns int language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  c record;
  n int := 0;
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  for c in
    select user_id from public.tiktok_cuentas
    where error is null
      and (user_id = yo or ((sincronizada_at is null or sincronizada_at < now() - interval '2 minutes')
                            and (pedida_at is null or pedida_at < now() - interval '2 minutes')))
    order by (user_id = yo) desc, sincronizada_at nulls first limit 20
  loop
    if public._tiktok_sincronizar(c.user_id) = 'pedido' then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Desvincular TikTok: se borran las llaves y todos mis videos, y se le avisa a TikTok.
create or replace function public.tiktok_desvincular()
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  c public.tiktok_cuentas;
  v_secreto text;
begin
  select * into c from public.tiktok_cuentas where user_id = yo;
  if not found then
    return;
  end if;
  delete from public.reels where user_id = yo;
  delete from public.tiktok_cuentas where user_id = yo;
  -- Además se le pide a TikTok que anule el permiso. Si esto falla, lo de acá ya quedó borrado.
  begin
    select valor into v_secreto from public.config_privada where clave = 'push_secreto';
    if v_secreto is not null and public._web() is not null and public._hay_red() then
      perform net.http_post(
        url := public._web() || '/api/tiktok/revocar',
        body := jsonb_build_object('access_token', c.access_token, 'refresh_token', c.refresh_token),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-haxmatch-secreto', v_secreto),
        timeout_milliseconds := 10000);
    end if;
  exception when others then
    null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Tarea programada: cada 6 horas se revisan los videos nuevos de todos
-- ---------------------------------------------------------------------------

-- Usa la extensión pg_cron. Si no está disponible, no pasa nada: los videos se
-- actualizan igual cuando el usuario abre "Mis videos".
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron no está disponible: los videos se actualizan al abrir Mis videos';
end $$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'haxmatch-tiktok';
    perform cron.schedule('haxmatch-tiktok', '17 */6 * * *', 'select public._tiktok_sincronizar_todos()');
  end if;
exception when others then
  raise notice 'No se pudo programar la actualización automática de videos';
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._clave_ok(text), public._web(), public._hashtags(text),
  public._tiktok_sincronizar(uuid), public._tiktok_sincronizar_todos(),
  public._tiktok_guardar_llaves(uuid, jsonb)
from public, anon, authenticated;

revoke all on function
  public.clips(), public.reel_visible(uuid, boolean), public.reaccionar(uuid, boolean),
  public.tiktok_actualizar(), public.tiktok_desvincular(), public.clips_refrescar(),
  public.tiktok_empezar(text, uuid), public.tiktok_llaves(text, uuid, jsonb),
  public.tiktok_guardar(text, text, text, text, text, text, int, int, text),
  public.tiktok_importar(text, uuid, jsonb, boolean, boolean, jsonb),
  public.tiktok_fallo(text, uuid, text)
from public, anon;

grant execute on function
  public.clips(), public.reel_visible(uuid, boolean), public.reaccionar(uuid, boolean),
  public.tiktok_actualizar(), public.tiktok_desvincular(), public.clips_refrescar()
to authenticated;

-- Estas las llama la web de HaxMatch sin sesión de usuario; las protege la clave compartida.
grant execute on function
  public.tiktok_empezar(text, uuid), public.tiktok_llaves(text, uuid, jsonb),
  public.tiktok_guardar(text, text, text, text, text, text, int, int, text),
  public.tiktok_importar(text, uuid, jsonb, boolean, boolean, jsonb),
  public.tiktok_fallo(text, uuid, text)
to anon, authenticated;
