-- HaxMatch · Paso 10: cambiar el nick y agregar amigos por su nick
--
-- Va después de los pasos 1 a 9. Se puede correr de nuevo sin romper nada.
--
-- - Cada uno puede cambiar su nick desde el Perfil. Después de cambiarlo, tiene que
--   esperar 15 días para volver a cambiarlo. No puede usar un nick que ya tiene otro
--   jugador (sin importar mayúsculas).
-- - Para agregar a un amigo alcanza con su nick o con su usuario de Discord.

alter table public.profiles add column if not exists nick_cambiado_at timestamptz;

-- Una vez terminado el registro, cambiar el nick (por cualquier camino) respeta las
-- reglas: 15 días entre un cambio y otro, y un nick que no use otro jugador.
create or replace function public._seg_nick()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_desde timestamptz := old.nick_cambiado_at + interval '15 days';
begin
  if old.onboarding and new.nick is distinct from old.nick then
    if v_desde > now() then
      raise exception 'Podés volver a cambiar tu nick desde el %',
        to_char(v_desde at time zone 'America/Argentina/Buenos_Aires', 'DD/MM "a las" HH24:MI');
    end if;
    -- De a uno, para que dos personas no se queden con el mismo nick al mismo tiempo.
    perform pg_advisory_xact_lock(48293014);
    if exists (select 1 from public.profiles where lower(nick) = lower(new.nick) and id <> new.id) then
      raise exception 'Ese nick ya lo usa otro jugador';
    end if;
    new.nick_cambiado_at := now();
  end if;
  return new;
end $$;

drop trigger if exists seg_nick on public.profiles;
create trigger seg_nick before update of nick on public.profiles
  for each row execute function public._seg_nick();

-- Cambiar mi nick. Devuelve el nick nuevo y desde cuándo se puede volver a cambiar.
create or replace function public.cambiar_nick(p_nick text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  fila public.profiles;
  v_nick text := regexp_replace(trim(coalesce(p_nick, '')), '\s+', ' ', 'g');
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  select * into fila from public.profiles where id = yo;
  if not found or not fila.onboarding then
    raise exception 'Primero terminá tu registro';
  end if;
  if v_nick = fila.nick then
    raise exception 'Ese ya es tu nick';
  end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 20 or v_nick ~ '[[:cntrl:]]' then
    raise exception 'El nick tiene que tener entre 2 y 20 caracteres';
  end if;
  -- Los 15 días y que no lo use otro los controla _seg_nick.
  update public.profiles set nick = v_nick where id = yo;
  perform public._avisar();
  return json_build_object('nick', v_nick, 'proximo_cambio', now() + interval '15 days');
end $$;

-- Agregar a un amigo por su usuario de Discord o por su nick. Primero se busca el
-- usuario de Discord (es único); si no hay, el nick. Devuelve {nick, estado}.
create or replace function public.pedir_amistad_por_nombre(p_texto text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_buscado text := lower(ltrim(trim(coalesce(p_texto, '')), '@'));
  v_ids uuid[];
  v_id uuid;
  v_nick text;
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  if v_buscado = '' or char_length(v_buscado) > 40 then
    raise exception 'Escribí su nick o su usuario de Discord';
  end if;
  select id into v_id from public.profiles
  where lower(username) = v_buscado and onboarding order by created_at limit 1;
  if v_id is null then
    select array_agg(id) into v_ids from public.profiles where lower(nick) = v_buscado and onboarding;
    if v_ids is null then
      raise exception 'No encontramos a nadie con ese nick o usuario de Discord';
    end if;
    if cardinality(v_ids) > 1 then
      raise exception 'Hay más de un jugador con ese nick. Agregalo por su usuario de Discord.';
    end if;
    v_id := v_ids[1];
  end if;
  if v_id = yo then
    raise exception 'Ese sos vos';
  end if;
  select nick into v_nick from public.profiles where id = v_id;
  return json_build_object('nick', v_nick, 'estado', public.pedir_amistad(v_id));
end $$;

-- Lo que la app necesita saber de mí y no viene con la cola (paso 8, más cuándo cambié el nick).
create or replace function public.mis_ajustes()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  return (
    select json_build_object(
      'admin', public._es_admin(yo),
      'mostrar_conectado', coalesce(p.mostrar_conectado, true),
      'nick_cambiado_at', p.nick_cambiado_at)
    from public.profiles p where p.id = yo);
end $$;

revoke all on function public._seg_nick() from public, anon, authenticated;
revoke all on function public.cambiar_nick(text), public.pedir_amistad_por_nombre(text), public.mis_ajustes() from public, anon;
grant execute on function public.cambiar_nick(text), public.pedir_amistad_por_nombre(text), public.mis_ajustes() to authenticated;
