-- HaxMatch · Paso 8: chat general, puntito de conectado y panel de administración
--
-- Va después de los pasos 1 a 7. Se puede correr de nuevo sin romper nada.
--
-- - Chat general: una sola sala para todos. Los mensajes duran 24 horas. No se
--   ven los de quien bloqueé ni los de quien me bloqueó. Una cuenta suspendida no
--   puede escribir. Cada uno borra los suyos; quien administra, cualquiera.
-- - Conectado: cada uno elige si los demás ven su puntito verde (el cálculo de
--   quién está conectado está en el paso 3, con la presencia).
-- - Panel: números de la app, últimos registrados, reportes y suspensiones. Solo
--   para quienes están en la tabla "admins", que se carga a mano desde el SQL Editor:
--     insert into public.admins (user_id) select id from public.profiles where username = 'tu_usuario';

create table if not exists public.chat (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 300),
  creado_at timestamptz not null default now()
);
-- Borrar un mensaje lo esconde, pero sigue contando para los topes hasta que se va a las 24 horas.
alter table public.chat add column if not exists borrado_at timestamptz;
create index if not exists chat_por_fecha on public.chat (creado_at desc);
create index if not exists chat_por_usuario on public.chat (user_id, creado_at desc);

-- Señal de "hay mensajes nuevos" para el tiempo real. Aparte de la de la cola, para
-- que un mensaje en el chat no haga que todas las apps vuelvan a pedir la cola.
create table if not exists public.chat_senal (
  id int primary key check (id = 1),
  version bigint not null default 0
);
insert into public.chat_senal (id) values (1) on conflict (id) do nothing;

create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);

alter table public.chat enable row level security;
alter table public.chat_senal enable row level security;
alter table public.admins enable row level security;
revoke all on public.chat, public.chat_senal, public.admins from anon, authenticated;

grant select on public.chat_senal to authenticated;
drop policy if exists "chat_senal: lectura" on public.chat_senal;
create policy "chat_senal: lectura" on public.chat_senal for select to authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_senal'
     ) then
    alter publication supabase_realtime add table public.chat_senal;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

create or replace function public._es_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = p_user)
$$;

create or replace function public._solo_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null or not public._es_admin(yo) then
    raise exception 'No autorizado';
  end if;
  if public._suspension(yo) is not null then
    raise exception 'Tu cuenta está suspendida';
  end if;
  return yo;
end $$;

create or replace function public._chat_avisar()
returns void language sql security definer set search_path = '' as $$
  update public.chat_senal set version = version + 1 where id = 1
$$;

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create or replace function public.chat_enviar(p_texto text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_texto text := regexp_replace(trim(coalesce(p_texto, '')), '\s+', ' ', 'g');
  v_suspension text;
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  v_suspension := public._suspension(yo);
  if v_suspension is not null then
    raise exception '%', v_suspension;
  end if;
  if v_texto = '' then
    raise exception 'Escribí un mensaje';
  end if;
  if char_length(v_texto) > 300 then
    raise exception 'El mensaje puede tener hasta 300 letras';
  end if;
  -- De a uno por persona, para que los topes no se puedan saltear mandando varios a la vez.
  perform pg_advisory_xact_lock(48293013, hashtext(yo::text));
  if (select count(*) from public.chat where user_id = yo and creado_at > now() - interval '10 seconds') >= 3 then
    raise exception 'Estás escribiendo muy rápido. Esperá unos segundos.';
  end if;
  if (select count(*) from public.chat where user_id = yo and creado_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Escribiste mucho seguido. Esperá un rato.';
  end if;
  if exists (
    select 1 from public.chat
    where user_id = yo and creado_at > now() - interval '1 minute' and lower(texto) = lower(v_texto)
  ) then
    raise exception 'Ya mandaste ese mensaje.';
  end if;
  insert into public.chat (user_id, texto) values (yo, v_texto);
  -- Lo de más de 24 horas se va.
  delete from public.chat where creado_at < now() - interval '24 hours';
  perform public._chat_avisar();
end $$;

-- Los mensajes de las últimas 24 horas (los 150 más nuevos), del más viejo al más nuevo.
-- De paso borra los más viejos, aunque nadie haya escrito desde entonces.
create or replace function public.chat_leer()
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  delete from public.chat where creado_at < now() - interval '24 hours';
  return (
    select coalesce(json_agg(json_build_object(
      'id', x.id, 'user_id', x.user_id, 'texto', x.texto, 'creado_at', x.creado_at,
      'nick', x.nick, 'username', x.username, 'foto', public._foto_version(x.user_id, x.foto_url),
      'nivel', public._nivel(x.puntos)
    ) order by x.id), '[]'::json)
    from (
      select c.id, c.user_id, c.texto, c.creado_at, p.nick, p.username, p.foto_url, p.puntos
      from public.chat c join public.profiles p on p.id = c.user_id
      where c.creado_at > now() - interval '24 hours' and c.borrado_at is null
        and not exists (select 1 from public.bloqueos b where (b.de = yo and b.a = c.user_id) or (b.a = yo and b.de = c.user_id))
      order by c.id desc
      limit 150) x);
end $$;

-- Borrar un mensaje: el propio, o cualquiera si administro. Queda escondido (no se
-- borra del todo) para que borrar no sirva para saltear los topes.
create or replace function public.chat_borrar(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  update public.chat set borrado_at = now()
  where id = p_id and borrado_at is null
    and (user_id = yo or (public._es_admin(yo) and public._suspension(yo) is null));
  if not found then
    raise exception 'Ese mensaje ya no está';
  end if;
  perform public._chat_avisar();
end $$;

-- ---------------------------------------------------------------------------
-- Ajustes propios
-- ---------------------------------------------------------------------------

-- Lo que la app necesita saber de mí y no viene con la cola: si administro y si muestro que estoy conectado.
create or replace function public.mis_ajustes()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  return json_build_object(
    'admin', public._es_admin(yo),
    'mostrar_conectado', coalesce((select mostrar_conectado from public.profiles where id = yo), true));
end $$;

create or replace function public.guardar_mostrar_conectado(p_mostrar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  -- Sin avisar a todas las apps: lo ven en la próxima vuelta (cada 8 segundos). Así prenderlo
  -- y apagarlo muchas veces no hace que todos vuelvan a pedir la cola.
  update public.profiles set mostrar_conectado = coalesce(p_mostrar, true) where id = yo;
end $$;

-- ---------------------------------------------------------------------------
-- Panel de administración
-- ---------------------------------------------------------------------------

create or replace function public.admin_resumen()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := public._solo_admin();
  v_hoy date := public._dia(now());
begin
  return json_build_object(
    'registrados', (select count(*) from public.profiles where onboarding),
    'nuevos_hoy', (select count(*) from public.profiles where onboarding and public._dia(created_at) = v_hoy),
    'nuevos_7_dias', (select count(*) from public.profiles where onboarding and created_at > now() - interval '7 days'),
    'activos_hoy', (select count(distinct user_id) from public.puntos where tipo = 'conexion' and dia = v_hoy),
    'activos_7_dias', (select count(distinct user_id) from public.puntos where tipo = 'conexion' and dia > v_hoy - 7),
    'conectados', (select count(*) from public.presencia where visto_at > now() - interval '30 seconds'),
    'buscando', (select count(*) from public.busquedas where estado = 'activa'),
    'amistosos_hoy', (select count(*) from public.matches where contado_at is not null and public._dia(contado_at) = v_hoy),
    'amistosos', (select count(*) from public.matches where contado_at is not null),
    'mensajes_chat', (select count(*) from public.chat where creado_at > now() - interval '24 hours' and borrado_at is null),
    'ultimos', (
      select coalesce(json_agg(json_build_object(
        'id', p.id, 'nick', p.nick, 'username', p.username, 'creado_at', p.created_at,
        'foto', public._foto_version(p.id, p.foto_url),
        'conectado', p.mostrar_conectado and exists (select 1 from public.presencia pr where pr.user_id = p.id and pr.visto_at > now() - interval '30 seconds')
      ) order by p.created_at desc), '[]'::json)
      from (select * from public.profiles where onboarding order by created_at desc limit 50) p),
    'reportados', (
      select coalesce(json_agg(json_build_object(
        'id', u.id, 'nick', u.nick, 'username', u.username,
        'reportes', r.reportes, 'de_distintos', r.de_distintos, 'motivos', r.motivos, 'ultimo', r.ultimo,
        'suspendido_hasta', r.suspendido_hasta,
        'detalle', (
          select coalesce(json_agg(json_build_object('cuando', d.creado_at, 'motivo', d.motivo, 'detalle', d.detalle)
                                   order by d.creado_at desc), '[]'::json)
          from (select * from public.reportes where reportado = u.id order by creado_at desc limit 10) d)
      ) order by r.de_distintos desc, r.reportes desc), '[]'::json)
      from (
        select x.reportado, count(*) as reportes, count(distinct x.de) as de_distintos,
               string_agg(distinct x.motivo, ', ') as motivos, max(x.creado_at) as ultimo,
               max(case when p.suspendido_hasta > now() then p.suspendido_hasta end) as suspendido_hasta
        from public.reportes x join public.profiles p on p.id = x.reportado
        where x.creado_at > now() - interval '30 days'
        group by x.reportado) r
      join public.profiles u on u.id = r.reportado),
    'suspendidos', (
      select coalesce(json_agg(json_build_object(
        'id', p.id, 'nick', p.nick, 'username', p.username,
        'hasta', p.suspendido_hasta, 'motivo', p.suspension_motivo
      ) order by p.suspendido_hasta), '[]'::json)
      from public.profiles p where p.suspendido_hasta > now()));
end $$;

-- Suspender por p_dias días (0: sin fecha de fin). Devuelve el texto que ve la persona.
create or replace function public.admin_suspender(p_user uuid, p_dias int, p_motivo text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := public._solo_admin();
  v_usuario text;
begin
  if p_user = yo then
    raise exception 'No te podés suspender a vos mismo';
  end if;
  if public._es_admin(p_user) then
    raise exception 'No se puede suspender a otro administrador';
  end if;
  select username into v_usuario from public.profiles where id = p_user;
  if v_usuario is null then
    raise exception 'Ese usuario ya no está en HaxMatch';
  end if;
  return public.mod_suspender(v_usuario, greatest(coalesce(p_dias, 7), 0), coalesce(p_motivo, ''));
end $$;

create or replace function public.admin_levantar(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := public._solo_admin();
  v_usuario text;
begin
  select username into v_usuario from public.profiles where id = p_user;
  if v_usuario is null then
    raise exception 'Ese usuario ya no está en HaxMatch';
  end if;
  return public.mod_levantar(v_usuario);
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._es_admin(uuid), public._solo_admin(), public._chat_avisar()
from public, anon, authenticated;

revoke all on function
  public.chat_enviar(text), public.chat_leer(), public.chat_borrar(bigint),
  public.mis_ajustes(), public.guardar_mostrar_conectado(boolean),
  public.admin_resumen(), public.admin_suspender(uuid, int, text), public.admin_levantar(uuid)
from public, anon;

grant execute on function
  public.chat_enviar(text), public.chat_leer(), public.chat_borrar(bigint),
  public.mis_ajustes(), public.guardar_mostrar_conectado(boolean),
  public.admin_resumen(), public.admin_suspender(uuid, int, text), public.admin_levantar(uuid)
to authenticated;
