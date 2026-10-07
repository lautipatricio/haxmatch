-- HaxMatch · Paso 3: amigos y avisos (notificaciones con la app cerrada)
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Necesita que antes se hayan ejecutado 01_perfiles.sql y 02_cola.sql.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Cómo está pensado:
-- - Amigos: una fila por par de usuarios, pendiente hasta que el otro acepta.
-- - Avisos: cada celular que los activa guarda acá su "suscripción". Cuando pasa
--   algo que le importa a un usuario (le escriben, lo aceptan en una sala, un
--   amigo se pone a buscar), la base le pide a la web de HaxMatch que le mande
--   la notificación. Si justo tiene la app abierta y a la vista, el celular no la
--   muestra (el aviso ya aparece adentro de la app); eso lo decide el celular,
--   que es el único que sabe con certeza si la app está a la vista.
-- - Nada de esto toca las reglas de la cola: los avisos salen de "disparadores"
--   que miran lo que la cola va guardando.

-- La base necesita poder hacer pedidos a internet para mandar los avisos.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net no está disponible: los avisos con la app cerrada quedan apagados';
end $$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.amistades (
  -- Quién mandó la solicitud y a quién.
  de uuid not null references public.profiles (id) on delete cascade,
  a uuid not null references public.profiles (id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada')),
  creado_at timestamptz not null default now(),
  primary key (de, a),
  check (de <> a)
);
-- Una sola fila por par, sin importar quién la mandó.
create unique index if not exists amistades_par on public.amistades (least(de, a), greatest(de, a));
create index if not exists amistades_por_a on public.amistades (a);

-- Registro de solicitudes mandadas, para que nadie pueda insistir sin límite
-- (mandar, retirar y volver a mandar).
create table if not exists public.amistad_envios (
  de uuid not null references public.profiles (id) on delete cascade,
  a uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists amistad_envios_por_de on public.amistad_envios (de, at);

-- Última vez que cada usuario tuvo la app abierta y a la vista.
create table if not exists public.presencia (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  visto_at timestamptz not null default now(),
  -- Último aviso de prueba que pidió: cuándo, y qué número de pedido fue.
  probo_at timestamptz,
  prueba_id bigint
);

-- Un renglón por cada celular o navegador que activó los avisos.
create table if not exists public.push_suscripciones (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creado_at timestamptz not null default now()
);
create index if not exists push_por_usuario on public.push_suscripciones (user_id);

-- Datos de configuración que la app nunca puede leer (dirección y clave para mandar avisos).
create table if not exists public.config_privada (
  clave text primary key,
  valor text not null
);

alter table public.presencia add column if not exists probo_at timestamptz;
alter table public.presencia add column if not exists prueba_id bigint;

alter table public.amistades enable row level security;
alter table public.amistad_envios enable row level security;
alter table public.presencia enable row level security;
alter table public.push_suscripciones enable row level security;
alter table public.config_privada enable row level security;
revoke all on public.amistades, public.amistad_envios, public.presencia, public.push_suscripciones, public.config_privada from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funciones internas (la app no las puede llamar)
-- ---------------------------------------------------------------------------

-- De la foto de otro usuario solo viaja la versión, y solo si es la de su carpeta.
create or replace function public._foto_version(p_id uuid, p_url text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_url ~ ('/storage/v1/object/public/avatares/' || p_id::text || '/foto\.jpg(\?v=[0-9]+)?$')
    then coalesce(substring(p_url from '\?v=([0-9]+)$'), '0') end
$$;

create or replace function public._amigos(p_user uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(case when de = p_user then a else de end), '{}'::uuid[])
  from public.amistades
  where estado = 'aceptada' and (de = p_user or a = p_user)
$$;

create or replace function public._nick(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select nick from public.profiles where id = p_user), 'Un jugador')
$$;

-- ¿La base puede hacer pedidos a internet? (extensión pg_net)
create or replace function public._hay_red()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'net' and p.proname = 'http_post')
$$;

drop function if exists public._enviar_push(uuid, text, text, text, text);

-- Le pide a la web de HaxMatch que mande un aviso a todos los celulares de un
-- usuario. Devuelve {"estado": "enviado", "id": número de pedido}, o por qué no se pudo.
-- p_esperar: la web contesta recién cuando sabe si el celular lo recibió (para la prueba).
create or replace function public._enviar_push(
  p_user uuid, p_titulo text, p_cuerpo text, p_url text, p_tag text, p_esperar boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secreto text;
  v_subs jsonb;
  v_id bigint;
begin
  select valor into v_url from public.config_privada where clave = 'push_url';
  select valor into v_secreto from public.config_privada where clave = 'push_secreto';
  if v_url is null or v_secreto is null then
    return jsonb_build_object('estado', 'sin configurar');
  end if;
  if not public._hay_red() then
    return jsonb_build_object('estado', 'sin red');
  end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
  into v_subs from public.push_suscripciones where user_id = p_user;
  if v_subs is null then
    return jsonb_build_object('estado', 'sin celulares');
  end if;
  select net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'suscripciones', v_subs,
      'esperar', p_esperar is true,
      'aviso', jsonb_build_object(
        'titulo', left(coalesce(p_titulo, 'HaxMatch'), 80),
        'cuerpo', left(coalesce(p_cuerpo, ''), 160),
        'url', coalesce(p_url, '/'),
        'tag', coalesce(p_tag, 'haxmatch'))),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-haxmatch-secreto', v_secreto),
    timeout_milliseconds := 8000) into v_id;
  return jsonb_build_object('estado', 'enviado', 'id', v_id);
end $$;

-- Avisa a un usuario de algo que hizo otro. Nunca falla: si algo sale mal, lo
-- que estaba haciendo el otro usuario sigue igual.
create or replace function public._notificar(p_user uuid, p_titulo text, p_cuerpo text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then
    return;
  end if;
  -- A uno mismo no se le avisa lo que acaba de hacer. Salvo que su app esté en
  -- segundo plano: ahí lo que "hizo" fue solo preguntar cómo está la cola.
  if p_user = (select auth.uid()) and coalesce(current_setting('haxmatch.oculto', true), '') <> '1' then
    return;
  end if;
  -- Se manda siempre. Si la persona tiene la app a la vista, es su celular el que
  -- decide no mostrarla: desde acá no se puede saber a tiempo si acaba de salir.
  perform public._enviar_push(p_user, p_titulo, p_cuerpo, p_url, p_tag);
exception when others then
  null;
end $$;

-- Quien tiene los avisos activados puede dejar la app en segundo plano más
-- tiempo sin que su búsqueda salga de la cola: se entera por la notificación.
create or replace function public._aguante(p_user uuid)
returns interval language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.push_suscripciones where user_id = p_user) then interval '30 minutes'
    else interval '10 minutes' end
$$;

-- Igual que en el paso 2, repetida acá para que alcance con ejecutar este archivo.
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
-- Disparadores: qué se avisa y a quién
-- ---------------------------------------------------------------------------

-- Me escribieron, o alguien quiere entrar a mi sala.
create or replace function public._al_crear_mensaje()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sala boolean;
  v_mas int := coalesce(cardinality(new.con), 0);
begin
  -- Tope para que nadie moleste cancelando y volviendo a buscar una y otra vez:
  -- hasta 4 avisos de la misma persona en 10 minutos.
  if (select count(*) from public.mensajes
      where de = new.de and a = new.a and id <> new.id and creado_at > now() - interval '10 minutes') >= 4 then
    return new;
  end if;
  v_sala := exists (select 1 from public.busquedas where user_id = new.a and estado = 'activa' and modo = 'sala');
  perform public._notificar(
    new.a,
    case
      when v_sala and v_mas > 0 then public._nick(new.de) || ' y ' || v_mas || ' más quieren entrar a tu sala'
      when v_sala then public._nick(new.de) || ' quiere entrar a tu sala'
      else public._nick(new.de) || ' te escribió' end,
    case when new.auto then 'La app los acercó. Aceptá o rechazá desde HaxMatch.' else new.texto end,
    '/buscando', 'mensaje');
  return new;
end $$;

drop trigger if exists avisar_mensaje on public.mensajes;
create trigger avisar_mensaje after insert on public.mensajes
  for each row when (new.estado = 'pendiente') execute function public._al_crear_mensaje();

-- Alguien ocupó un lugar en una sala: se le avisa "Match listo".
create or replace function public._al_ocupar_lugar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_dueno uuid;
  v_sala text;
begin
  select creado_por, nombre_sala into v_dueno, v_sala from public.matches where id = new.match_id;
  if v_dueno is null or new.user_id = v_dueno then
    return new;
  end if;
  perform public._notificar(
    new.user_id, 'Match listo con ' || public._nick(v_dueno),
    'Sala "' || v_sala || '". Entrá desde la compu y avisá cuando estés adentro.',
    '/match/' || new.match_id::text, 'match');
  -- Cuando vuelve alguien que ya había pasado por la sala, no hay tanda: se le avisa acá al dueño.
  if tg_op = 'UPDATE' then
    perform public._notificar(
      v_dueno, public._nick(new.user_id) || ' va a entrar a tu sala',
      'Marcá "Ya entró" cuando esté adentro.', '/buscando', 'sala');
  end if;
  return new;
end $$;

drop trigger if exists avisar_lugar on public.match_participantes;
create trigger avisar_lugar after insert on public.match_participantes
  for each row execute function public._al_ocupar_lugar();

drop trigger if exists avisar_regreso on public.match_participantes;
create trigger avisar_regreso after update on public.match_participantes
  for each row when (old.salio_at is not null and new.salio_at is null)
  execute function public._al_ocupar_lugar();

-- Al dueño de la sala se le avisa una sola vez por tanda: si entra un grupo de
-- tres, le llega un aviso, no tres.
create or replace function public._al_entrar_tanda()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t record;
begin
  for t in
    select m.id, m.creado_por, count(*)::int as cuantos, (array_agg(n.user_id order by n.user_id))[1] as primero
    from nuevos n join public.matches m on m.id = n.match_id
    where n.user_id <> m.creado_por
    group by m.id, m.creado_por
  loop
    perform public._notificar(
      t.creado_por,
      case when t.cuantos > 1
        then public._nick(t.primero) || ' y ' || (t.cuantos - 1) || ' más van a entrar a tu sala'
        else public._nick(t.primero) || ' va a entrar a tu sala' end,
      'Marcá "Ya entró" cuando estén adentro.', '/buscando', 'sala');
  end loop;
  return null;
end $$;

drop trigger if exists avisar_tanda on public.match_participantes;
create trigger avisar_tanda after insert on public.match_participantes
  referencing new table as nuevos
  for each statement execute function public._al_entrar_tanda();

-- Un amigo se puso a buscar: se les avisa a sus amigos.
create or replace function public._al_empezar_busqueda()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  f uuid;
begin
  -- Tope para quien cancela y vuelve a buscar muchas veces: hasta 3 avisos a sus amigos en 10 minutos.
  if (select count(*) from public.busquedas
      where user_id = new.user_id and id <> new.id and creada_at > now() - interval '10 minutes') >= 3 then
    return new;
  end if;
  foreach f in array public._amigos(new.user_id) loop
    perform public._notificar(
      f,
      case when new.modo = 'sala'
        then 'Tu amigo ' || public._nick(new.user_id) || ' necesita ' || coalesce(new.faltan, 1) || ' más'
        else 'Tu amigo ' || public._nick(new.user_id) || ' se puso disponible' end,
      case when new.modo = 'sala'
        then 'Sala "' || coalesce(new.nombre_sala, '') || '"'
        else array_to_string(new.formato, ', ') || ' · ' || array_to_string(new.cancha, ', ') end,
      '/perfil/amigos', 'amigo');
  end loop;
  return new;
end $$;

drop trigger if exists avisar_busqueda on public.busquedas;
create trigger avisar_busqueda after insert on public.busquedas
  for each row when (new.estado = 'activa') execute function public._al_empezar_busqueda();

-- Alguien se sumó a mi búsqueda.
create or replace function public._al_sumarse()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public._notificar(
    (select user_id from public.busquedas where id = new.lider_id),
    public._nick(new.user_id) || ' se sumó a tu búsqueda', 'Siguen buscando juntos.', '/buscando', 'grupo');
  return new;
end $$;

drop trigger if exists avisar_grupo on public.busquedas;
create trigger avisar_grupo after update on public.busquedas
  for each row when (new.estado = 'agrupada' and old.estado <> 'agrupada' and new.lider_id is not null)
  execute function public._al_sumarse();

-- Solicitudes de amistad.
create or replace function public._al_cambiar_amistad()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.estado = 'pendiente' then
    -- Si ya le había mandado una solicitud hoy (y la retiró o se la rechazaron), no se le avisa de nuevo.
    if exists (
      select 1 from public.amistad_envios
      where de = new.de and a = new.a and at > now() - interval '1 day') then
      return new;
    end if;
    perform public._notificar(new.a, public._nick(new.de) || ' quiere ser tu amigo', 'Respondé desde Amigos.', '/perfil/amigos', 'amistad');
  elsif tg_op = 'UPDATE' and new.estado = 'aceptada' and old.estado = 'pendiente' then
    perform public._notificar(new.de, public._nick(new.a) || ' aceptó tu solicitud', 'Ya son amigos.', '/perfil/amigos', 'amistad');
  end if;
  return new;
end $$;

drop trigger if exists avisar_amistad on public.amistades;
create trigger avisar_amistad after insert or update on public.amistades
  for each row execute function public._al_cambiar_amistad();

-- ---------------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------------

-- Todo lo que la app necesita mostrar: la cola (paso 2) más los amigos.
-- p_visible: la app está abierta y a la vista (entonces no hace falta notificar).
create or replace function public.estado(p_visible boolean default true)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  if p_visible is not false then
    insert into public.presencia (user_id, visto_at)
    select yo, now() where exists (select 1 from public.profiles where id = yo)
    on conflict (user_id) do update set visto_at = now();
  else
    -- Pasó a segundo plano: desde ahora, lo que pase le llega como notificación.
    update public.presencia set visto_at = '-infinity' where user_id = yo;
    perform set_config('haxmatch.oculto', '1', true);
  end if;
  return (public.estado_cola()::jsonb || jsonb_build_object(
    'amigos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'nick', u.nick, 'username', u.username,
        'foto', public._foto_version(u.id, u.foto_url), 'relacion', r.relacion) order by u.nick), '[]'::jsonb)
      from (
        select case when am.de = yo then am.a else am.de end as otro,
               case when am.estado = 'aceptada' then 'amigo' when am.de = yo then 'enviada' else 'recibida' end as relacion
        from public.amistades am where am.de = yo or am.a = yo) r
      join public.profiles u on u.id = r.otro)
  ))::json;
end $$;

-- Mandar una solicitud de amistad. Si el otro ya me había mandado una, quedan amigos.
-- Devuelve 'enviada' o 'amigos'.
create or replace function public.pedir_amistad(p_user uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  fila public.amistades;
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  if p_user is null or p_user = yo then
    raise exception 'Ese sos vos';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and onboarding) then
    raise exception 'Ese usuario todavía no está en HaxMatch';
  end if;
  -- De a uno, para que dos pedidos cruzados al mismo tiempo no choquen.
  perform pg_advisory_xact_lock(48293012);

  select * into fila from public.amistades
  where (de = yo and a = p_user) or (de = p_user and a = yo) for update;
  if found then
    if fila.estado = 'aceptada' then
      return 'amigos';
    end if;
    if fila.de = yo then
      return 'enviada';
    end if;
    update public.amistades set estado = 'aceptada' where de = fila.de and a = fila.a;
    perform public._avisar();
    return 'amigos';
  end if;

  if (select count(*) from public.amistades where de = yo and estado = 'pendiente') >= 30 then
    raise exception 'Tenés muchas solicitudes sin responder. Esperá a que te contesten.';
  end if;
  if cardinality(public._amigos(yo)) >= 300 then
    raise exception 'Llegaste al máximo de amigos.';
  end if;
  if (select count(*) from public.amistad_envios where de = yo and at > now() - interval '1 hour') >= 30 then
    raise exception 'Mandaste muchas solicitudes seguidas. Probá más tarde.';
  end if;
  insert into public.amistades (de, a) values (yo, p_user);
  insert into public.amistad_envios (de, a) values (yo, p_user);
  delete from public.amistad_envios where at < now() - interval '2 days';
  perform public._avisar();
  return 'enviada';
end $$;

-- Lo mismo, buscando por usuario de Discord.
create or replace function public.pedir_amistad_por_usuario(p_username text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_buscado text := lower(ltrim(trim(coalesce(p_username, '')), '@'));
  v_id uuid;
  v_nick text;
begin
  if v_buscado = '' or char_length(v_buscado) > 40 then
    raise exception 'Escribí un usuario de Discord';
  end if;
  select id, nick into v_id, v_nick from public.profiles
  where lower(username) = v_buscado and onboarding order by created_at limit 1;
  if not found then
    raise exception 'Ese usuario todavía no está en HaxMatch';
  end if;
  return json_build_object('nick', v_nick, 'estado', public.pedir_amistad(v_id));
end $$;

-- Aceptar o rechazar una solicitud que me mandaron.
create or replace function public.responder_amistad(p_user uuid, p_aceptar boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if p_aceptar is true then
    update public.amistades set estado = 'aceptada' where de = p_user and a = yo and estado = 'pendiente';
  else
    delete from public.amistades where de = p_user and a = yo and estado = 'pendiente';
  end if;
  if not found then
    raise exception 'Esa solicitud ya no está';
  end if;
  perform public._avisar();
end $$;

-- Dejar de ser amigos, o retirar una solicitud que mandé.
create or replace function public.quitar_amigo(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  delete from public.amistades where (de = yo and a = p_user) or (de = p_user and a = yo);
  perform public._avisar();
end $$;

-- Este celular activó los avisos.
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  -- Solo los servicios de avisos de los navegadores (Chrome y Android, iPhone, Firefox, Edge).
  if p_endpoint is null or char_length(p_endpoint) > 1000 or p_endpoint !~
    '^https://(fcm\.googleapis\.com|[a-z0-9-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'Este navegador no permite activar los avisos';
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{16,40}$' then
    raise exception 'Este navegador no permite activar los avisos';
  end if;
  insert into public.push_suscripciones (endpoint, user_id, p256dh, auth)
  values (p_endpoint, yo, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, creado_at = now();
  -- Hasta 5 dispositivos por usuario: se van los más viejos.
  delete from public.push_suscripciones
  where user_id = yo and endpoint not in (
    select endpoint from public.push_suscripciones where user_id = yo order by creado_at desc limit 5);
end $$;

-- Este celular desactivó los avisos.
create or replace function public.quitar_suscripcion(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_suscripciones where endpoint = p_endpoint and user_id = (select auth.uid())
$$;

-- "Mandar un aviso de prueba": me manda una notificación a mis propios celulares,
-- aunque tenga la app abierta. Sirve para comprobar que todo quedó bien conectado.
create or replace function public.probar_aviso()
returns text language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  r jsonb;
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo) then
    raise exception 'Hay que entrar con Discord';
  end if;
  if exists (select 1 from public.presencia where user_id = yo and probo_at > now() - interval '15 seconds') then
    raise exception 'Esperá unos segundos para pedir otro aviso de prueba.';
  end if;
  r := public._enviar_push(yo, 'Aviso de prueba', 'Si ves esto, los avisos de HaxMatch funcionan en este celular.', '/perfil', 'prueba', true);
  if r ->> 'estado' = 'sin configurar' then
    raise exception 'Los avisos todavía no están configurados en el servidor.';
  elsif r ->> 'estado' = 'sin red' then
    raise exception 'A la base le falta la extensión pg_net para poder mandar avisos.';
  elsif r ->> 'estado' = 'sin celulares' then
    raise exception 'No hay ningún celular con los avisos activados en tu cuenta.';
  end if;
  insert into public.presencia (user_id, probo_at, prueba_id) values (yo, now(), (r ->> 'id')::bigint)
  on conflict (user_id) do update set probo_at = now(), prueba_id = excluded.prueba_id;
  return 'enviado';
end $$;

-- Qué pasó con mi último aviso de prueba: si la web de HaxMatch lo recibió y si
-- pudo entregárselo al celular. Devuelve {"estado": "esperando"} mientras no hay respuesta.
create or replace function public.resultado_prueba()
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_id bigint;
  v_codigo int;
  v_cuerpo text;
  v_vencio boolean;
  v_error text;
begin
  select prueba_id into v_id from public.presencia where user_id = yo;
  if v_id is null then
    return json_build_object('estado', 'sin prueba');
  end if;
  -- La tabla de respuestas es de pg_net: se consulta así para que esta función exista aunque falte.
  execute 'select status_code, content::text, timed_out, error_msg from net._http_response where id = $1'
    into v_codigo, v_cuerpo, v_vencio, v_error using v_id;
  if v_codigo is null and v_vencio is null and v_error is null then
    return json_build_object('estado', 'esperando');
  end if;
  return json_build_object(
    'estado', 'respondio',
    'codigo', v_codigo,
    'sin_respuesta', coalesce(v_vencio, false) or v_error is not null,
    'enviados', case when v_codigo = 200 and v_cuerpo like '{%' then ((v_cuerpo::jsonb) ->> 'enviados')::int end,
    'resultados', case when v_codigo = 200 and v_cuerpo like '{%' then (v_cuerpo::jsonb) -> 'resultados' end);
exception when others then
  return json_build_object('estado', 'desconocido');
end $$;

-- La web de HaxMatch avisa que una suscripción ya no sirve (el usuario desinstaló
-- la app o quitó el permiso). Se identifica con la clave compartida.
create or replace function public.baja_suscripcion(p_endpoint text, p_secreto text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secreto is null or p_secreto is distinct from (select valor from public.config_privada where clave = 'push_secreto') then
    raise exception 'No autorizado';
  end if;
  delete from public.push_suscripciones where endpoint = p_endpoint;
end $$;

-- Configuración de los avisos. Solo se puede llamar desde el SQL Editor de Supabase.
create or replace function public.configurar_push(p_url text, p_secreto text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_url, '') !~ '^https://[a-z0-9.-]+/' then
    raise exception 'La dirección tiene que empezar con https://';
  end if;
  if char_length(coalesce(p_secreto, '')) < 32 then
    raise exception 'La clave es demasiado corta';
  end if;
  insert into public.config_privada (clave, valor) values ('push_url', p_url), ('push_secreto', p_secreto)
  on conflict (clave) do update set valor = excluded.valor;
  if not public._hay_red() then
    return 'Avisos configurados, pero falta activar la extensión pg_net (Database > Extensions)';
  end if;
  return 'Avisos configurados';
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._foto_version(uuid, text), public._amigos(uuid), public._nick(uuid),
  public._notificar(uuid, text, text, text, text), public._enviar_push(uuid, text, text, text, text, boolean),
  public._hay_red(), public._aguante(uuid), public._vencer(),
  public._al_crear_mensaje(), public._al_ocupar_lugar(), public._al_empezar_busqueda(),
  public._al_sumarse(), public._al_cambiar_amistad(), public._al_entrar_tanda(),
  public.configurar_push(text, text)
from public, anon, authenticated;

revoke all on function
  public.estado(boolean), public.pedir_amistad(uuid), public.pedir_amistad_por_usuario(text),
  public.responder_amistad(uuid, boolean), public.quitar_amigo(uuid),
  public.guardar_suscripcion(text, text, text), public.quitar_suscripcion(text),
  public.probar_aviso(), public.resultado_prueba(), public.baja_suscripcion(text, text)
from public, anon;

grant execute on function
  public.estado(boolean), public.pedir_amistad(uuid), public.pedir_amistad_por_usuario(text),
  public.responder_amistad(uuid, boolean), public.quitar_amigo(uuid),
  public.guardar_suscripcion(text, text, text), public.quitar_suscripcion(text),
  public.probar_aviso(), public.resultado_prueba()
to authenticated;

-- La baja la llama la web de HaxMatch sin sesión de usuario; la protege la clave compartida.
grant execute on function public.baja_suscripcion(text, text) to anon, authenticated;
