-- HaxMatch · Paso 9: cuentas de Kick y quién está en vivo
--
-- Va después de los pasos 1 a 8. Se puede correr de nuevo sin romper nada.
--
-- - Cada jugador puede vincular su cuenta de Kick. De Kick se guarda solo su número
--   de usuario, su nombre y la dirección de su canal. Las llaves de acceso no se
--   guardan: se usan una vez para saber quién es y se anulan.
-- - La web de HaxMatch pregunta a Kick cada minuto qué canales vinculados están
--   en vivo y lo anota acá. Los demás ven la etiqueta KICK al lado del nombre y,
--   mientras transmite, que está EN VIVO.
-- - Las funciones que llama la web están protegidas con la clave compartida de los
--   avisos (la misma que usan TikTok y las notificaciones).

create table if not exists public.kick_estados (
  state text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Código de comprobación que exige Kick (PKCE). Vive 15 minutos y se borra al usarlo.
  verificador text not null,
  creado_at timestamptz not null default now()
);

create table if not exists public.kick_cuentas (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kick_id bigint not null unique,
  usuario text not null,
  slug text not null,
  en_vivo boolean not null default false,
  titulo text,
  vivo_desde timestamptz,
  vinculada_at timestamptz not null default now(),
  revisada_at timestamptz
);

alter table public.kick_estados enable row level security;
alter table public.kick_cuentas enable row level security;
revoke all on public.kick_estados, public.kick_cuentas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lo que llama la web de HaxMatch (con la clave compartida)
-- ---------------------------------------------------------------------------

-- Empieza una vinculación. Devuelve el código que viaja a Kick y vuelve.
create or replace function public.kick_empezar(p_secreto text, p_user uuid, p_verificador text)
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
  if coalesce(p_verificador, '') !~ '^[A-Za-z0-9._~-]{43,128}$' then
    raise exception 'Pedido no válido';
  end if;
  delete from public.kick_estados where user_id = p_user or creado_at < now() - interval '1 hour';
  insert into public.kick_estados (state, user_id, verificador) values (v_state, p_user, p_verificador);
  return v_state;
end $$;

-- Kick devolvió al usuario: se toma (y se borra) lo guardado al empezar.
create or replace function public.kick_tomar(p_secreto text, p_state text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v public.kick_estados;
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  delete from public.kick_estados
  where state = p_state and creado_at > now() - interval '15 minutes'
  returning * into v;
  if v.user_id is null then
    raise exception 'vencido';
  end if;
  return json_build_object('user_id', v.user_id, 'verificador', v.verificador);
end $$;

-- Queda vinculada la cuenta de Kick de ese usuario.
create or replace function public.kick_guardar(
  p_secreto text, p_user uuid, p_kick_id bigint, p_usuario text, p_slug text, p_en_vivo boolean, p_titulo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  if p_kick_id is null or coalesce(trim(p_usuario), '') = '' or coalesce(p_slug, '') !~ '^[A-Za-z0-9_-]{1,60}$' then
    raise exception 'incompleto';
  end if;
  if exists (select 1 from public.kick_cuentas where kick_id = p_kick_id and user_id <> p_user) then
    raise exception 'ocupada';
  end if;
  insert into public.kick_cuentas (user_id, kick_id, usuario, slug, en_vivo, titulo, vivo_desde, revisada_at)
  values (p_user, p_kick_id, left(trim(p_usuario), 40), p_slug, coalesce(p_en_vivo, false),
          case when p_en_vivo then left(nullif(trim(coalesce(p_titulo, '')), ''), 140) end,
          case when p_en_vivo then now() end, now())
  on conflict (user_id) do update
    set kick_id = excluded.kick_id, usuario = excluded.usuario, slug = excluded.slug,
        en_vivo = excluded.en_vivo, titulo = excluded.titulo, vivo_desde = excluded.vivo_desde,
        vinculada_at = now(), revisada_at = now();
exception when unique_violation then
  -- Otro jugador vinculó esa misma cuenta en el mismo momento.
  raise exception 'ocupada';
end $$;

-- Los canales vinculados, para preguntarle a Kick cuáles están en vivo.
create or replace function public.kick_lista(p_secreto text)
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  return (select coalesce(json_agg(kick_id order by kick_id), '[]'::json) from public.kick_cuentas);
end $$;

-- Lo que contestó Kick: [{kick_id, en_vivo, titulo, slug}]. Los canales que no
-- vienen en la lista no se tocan (si Kick no contestó por uno, queda como estaba).
-- Devuelve cuántos empezaron o terminaron un directo.
create or replace function public.kick_vivos(p_secreto text, p_canales jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  c jsonb;
  v_vivo boolean;
  v_antes boolean;
  cambios int := 0;
begin
  if public._clave_ok(p_secreto) is not true then
    raise exception 'No autorizado';
  end if;
  if jsonb_typeof(p_canales) is distinct from 'array' then
    raise exception 'Pedido no válido';
  end if;
  for c in select * from jsonb_array_elements(p_canales) loop
    continue when coalesce(c ->> 'kick_id', '') !~ '^[0-9]{1,18}$';
    v_vivo := coalesce((c ->> 'en_vivo')::boolean, false);
    select en_vivo into v_antes from public.kick_cuentas where kick_id = (c ->> 'kick_id')::bigint;
    continue when not found;
    update public.kick_cuentas k
    set en_vivo = v_vivo,
        titulo = case when v_vivo then left(nullif(trim(coalesce(c ->> 'titulo', '')), ''), 140) end,
        vivo_desde = case when v_vivo then coalesce(k.vivo_desde, now()) end,
        slug = case when coalesce(c ->> 'slug', '') ~ '^[A-Za-z0-9_-]{1,60}$' then c ->> 'slug' else k.slug end,
        revisada_at = now()
    where k.kick_id = (c ->> 'kick_id')::bigint;
    if v_antes is distinct from v_vivo then
      cambios := cambios + 1;
    end if;
  end loop;
  -- Las apps lo ven en su próxima vuelta (preguntan cada minuto): no se avisa a todas
  -- cada vez, para no hacer que todos vuelvan a pedir la cola.
  return cambios;
end $$;

-- ---------------------------------------------------------------------------
-- Lo que llama la app
-- ---------------------------------------------------------------------------

-- Los jugadores con Kick vinculado (sin los que tienen un bloqueo conmigo), con su
-- canal y si están en vivo. También viene el mío.
create or replace function public.kick_canales()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  return (
    select coalesce(json_agg(json_build_object(
      'user_id', k.user_id, 'usuario', k.usuario, 'slug', k.slug, 'en_vivo', k.vivo,
      'titulo', case when k.vivo then k.titulo end, 'vivo_desde', case when k.vivo then k.vivo_desde end,
      'nick', p.nick, 'username', p.username, 'foto', public._foto_version(p.id, p.foto_url),
      'nivel', public._nivel(p.puntos)
    ) order by k.vivo desc, k.vivo_desde desc nulls last, p.nick), '[]'::json)
    -- "En vivo" solo si se revisó hace poco: si Kick deja de contestar por un canal
    -- (o por todos), nadie queda marcado en vivo para siempre.
    from (select *, en_vivo and revisada_at > now() - interval '10 minutes' as vivo from public.kick_cuentas) k
    join public.profiles p on p.id = k.user_id
    where p.onboarding and (p.suspendido_hasta is null or p.suspendido_hasta <= now())
      and not exists (select 1 from public.bloqueos b where (b.de = yo and b.a = k.user_id) or (b.a = yo and b.de = k.user_id)));
end $$;

create or replace function public.kick_desvincular()
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  delete from public.kick_cuentas where user_id = yo;
  delete from public.kick_estados where user_id = yo;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public.kick_empezar(text, uuid, text), public.kick_tomar(text, text),
  public.kick_guardar(text, uuid, bigint, text, text, boolean, text),
  public.kick_lista(text), public.kick_vivos(text, jsonb),
  public.kick_canales(), public.kick_desvincular()
from public, anon;

grant execute on function public.kick_canales(), public.kick_desvincular() to authenticated;

-- Estas las llama la web de HaxMatch sin sesión de usuario; las protege la clave compartida.
grant execute on function
  public.kick_empezar(text, uuid, text), public.kick_tomar(text, text),
  public.kick_guardar(text, uuid, bigint, text, text, boolean, text),
  public.kick_lista(text), public.kick_vivos(text, jsonb)
to anon, authenticated;
