-- HaxMatch · Paso 14: el país de cada jugador, y clips que se publican solos
--
-- Va después de los pasos 1 a 13. Se puede correr de nuevo sin romper nada.
--
-- País:
-- - Cada jugador tiene un país (código de dos letras: AR, CL, BR, UY, MX, ES...). Se guarda
--   en la misma columna "region" de antes, como lista de un solo elemento.
-- - Los que ya estaban registrados pasan al país de la primera región que habían elegido
--   (ARG → AR, CHI → CL, BR → BR, UY → UY). La app les pregunta una vez para confirmarlo.
-- - Al buscar partido o abrir una sala ya no se elige región: va el país del perfil.
-- - La región ya no separa a nadie: cualquiera puede jugar con cualquiera (comparten cancha).
--
-- Clips:
-- - Un clip con un link válido se publica en el momento, sin esperar aprobación.
-- - Quien administra puede quitar cualquiera desde el panel; a quien lo subió le llega el aviso.

-- ---------------------------------------------------------------------------
-- País
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists pais_confirmado boolean not null default false;

-- Región vieja (o país) → código de país.
create or replace function public._pais(p text)
returns text language sql immutable set search_path = '' as $$
  select case upper(btrim(coalesce(p, '')))
    when 'ARG' then 'AR' when 'CHI' then 'CL' when 'BR' then 'BR' when 'UY' then 'UY'
    else case when upper(btrim(coalesce(p, ''))) ~ '^[A-Z]{2}$' then upper(btrim(p)) end end
$$;

-- Antes la región tenía que ser una de las cuatro de siempre: ahora es un país.
alter table public.profiles drop constraint if exists profiles_region_check;
alter table public.profiles alter column region set default array['AR'];
update public.profiles set region = array[public._pais(region[1])]
where cardinality(region) <> 1 or region[1] !~ '^[A-Z]{2}$';
update public.profiles set region = array['AR'] where region[1] is null;
alter table public.profiles drop constraint if exists perfiles_pais;
alter table public.profiles add constraint perfiles_pais check (cardinality(region) = 1 and region[1] ~ '^[A-Z]{2}$');

-- La región ya no hace falta para jugar juntos: alcanza con compartir cancha.
create or replace function public._compatibles(p_region_a text[], p_cancha_a text[], p_region_b text[], p_cancha_b text[])
returns boolean language sql immutable set search_path = '' as $$
  select 'Cualquiera' = any (p_cancha_a) or 'Cualquiera' = any (p_cancha_b) or p_cancha_a && p_cancha_b
$$;

-- Cada búsqueda nueva lleva el país del perfil, mande lo que mande la app.
create or replace function public._busqueda_pais()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select region into new.region from public.profiles where id = new.user_id;
  new.region := coalesce(new.region, array['AR']);
  return new;
end $$;
drop trigger if exists busqueda_pais on public.busquedas;
create trigger busqueda_pais before insert on public.busquedas
  for each row execute function public._busqueda_pais();
-- Las que están abiertas ahora también.
update public.busquedas b set region = p.region
from public.profiles p where p.id = b.user_id and b.estado in ('activa', 'agrupada') and b.region is distinct from p.region;

-- Buscar partido o abrir sala: igual que antes (paso 2), pero sin pedir región.
create or replace function public.crear_busqueda(
  p_modo text, p_formato text[], p_posicion text[], p_cancha text[], p_region text[],
  p_duracion text default 'match', p_nombre_sala text default null, p_faltan int default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_id uuid;
  v_nombre text := trim(coalesce(p_nombre_sala, ''));
  v_region text[];
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
  select region into v_region from public.profiles where id = yo;

  if p_modo = 'sala' then
    if v_nombre = '' or char_length(v_nombre) > 40 then
      raise exception 'Escribí el nombre de la sala';
    end if;
    if p_faltan is null or p_faltan < 1 or p_faltan > 7 then
      raise exception 'Elegí cuántos jugadores faltan';
    end if;
    insert into public.busquedas (user_id, modo, formato, posicion, cancha, region, nombre_sala, faltan)
    values (yo, 'sala', null, p_posicion, p_cancha, v_region, v_nombre, p_faltan)
    returning id into v_id;
  else
    if coalesce(cardinality(p_formato), 0) not between 1 and 5 or array_ndims(p_formato) <> 1
       or not (p_formato <@ array['1v1', '2v2', '3v3', '4v4', 'Cualquiera']) then
      raise exception 'Elegí al menos una modalidad';
    end if;
    insert into public.busquedas (user_id, modo, formato, posicion, cancha, region, expira_at)
    values (yo, 'jugador', p_formato, p_posicion, p_cancha, v_region,
            case when p_duracion = '15min' then now() + interval '15 minutes' end)
    returning id into v_id;
  end if;

  perform public._emparejar();
  perform public._avisar();
  return v_id;
end $$;

-- Registro: igual que antes (paso 1), con el país en vez de las regiones.
create or replace function public.completar_registro(p_nick text, p_region text[], p_codigo text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_nick text := trim(coalesce(p_nick, ''));
  v_pais text := public._pais(p_region[1]);
  fila public.profiles;
  invitador uuid;
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  perform public.mi_perfil();
  select * into fila from public.profiles where id = yo;

  if v_nick = '' then
    v_nick := left(fila.username, 20);
  end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 20 then
    raise exception 'El nick tiene que tener entre 2 y 20 caracteres';
  end if;
  if v_pais is null then
    raise exception 'Elegí tu país';
  end if;

  if not fila.onboarding and fila.referido_por is null and nullif(trim(coalesce(p_codigo, '')), '') is not null then
    select id into invitador from public.profiles
    where codigo = upper(trim(p_codigo)) and onboarding and id <> yo;
  end if;

  update public.profiles
  set nick = v_nick,
      region = array[v_pais],
      pais_confirmado = true,
      onboarding = true,
      referido_por = coalesce(referido_por, invitador)
  where id = yo;

  return public.mi_perfil();
end $$;

-- Elegir o confirmar el país (desde el Perfil, o la vez que la app lo pregunta).
create or replace function public.cambiar_pais(p_pais text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_pais text := public._pais(p_pais);
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  if v_pais is null then
    raise exception 'Elegí tu país';
  end if;
  update public.profiles set region = array[v_pais], pais_confirmado = true where id = yo;
  update public.busquedas set region = array[v_pais] where user_id = yo and estado in ('activa', 'agrupada');
end $$;

-- Lo que la app necesita saber de mí (paso 10), más si ya confirmé el país.
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
      'nick_cambiado_at', p.nick_cambiado_at,
      'pais_confirmado', p.pais_confirmado)
    from public.profiles p where p.id = yo);
end $$;

-- ---------------------------------------------------------------------------
-- Clips que se publican solos
-- ---------------------------------------------------------------------------

-- Los que estaban esperando revisión se publican.
update public.clips_link set estado = 'aprobado', revisado_at = coalesce(revisado_at, now()) where estado = 'pendiente';

create or replace function public.subir_clip(p_enlace text, p_titulo text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_plat text;
  v_vid text;
  v_enl text;
  v_titulo text := left(btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g')), 80);
  c public.clips_link;
  v_dueno uuid;
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  if public._suspension(yo) is not null then
    raise exception '%', public._suspension(yo);
  end if;
  select x.plataforma, x.video_id, x.enlace into v_plat, v_vid, v_enl from public._leer_link_clip(p_enlace) x;
  if v_plat is null then
    raise exception 'Ese link no es de un video de TikTok o de YouTube. Abrí el video y copiá su link.';
  end if;
  perform pg_advisory_xact_lock(7214, hashtext(yo::text));
  select user_id into v_dueno from public.clips_link where plataforma = v_plat and video_id = v_vid;
  if found then
    raise exception '%', case when v_dueno = yo then 'Ya subiste ese clip' else 'Ese clip ya lo subió otro jugador' end;
  end if;
  if (select count(*) from public.clips_link where user_id = yo and creado_at > now() - interval '24 hours') >= 10 then
    raise exception 'Llegaste al límite de 10 clips por día. Probá mañana.';
  end if;
  insert into public.clips_link (user_id, plataforma, video_id, enlace, titulo, estado, revisado_at)
  values (yo, v_plat, v_vid, v_enl, v_titulo, 'aprobado', now())
  returning * into c;
  -- Suma como un reel nuevo: 8 puntos, el primero de cada día.
  perform public._dar_reel(yo, 'link:' || c.id::text, now());
  return public._clip_json(c, yo)::json;
end $$;

-- Todo lo de los clips por link (paso 13). Para quien administra, además, los últimos publicados (para poder quitarlos).
create or replace function public.clips_link()
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_admin boolean;
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  v_admin := public._es_admin(yo);
  return json_build_object(
    'feed', (
      select coalesce(jsonb_agg(q.j order by q.t desc), '[]'::jsonb)
      from (select public._clip_json(c, yo) as j, c.revisado_at as t from public.clips_link c
            where c.estado = 'aprobado'
              and not exists (select 1 from public.bloqueos b where (b.de = yo and b.a = c.user_id) or (b.de = c.user_id and b.a = yo))
            order by c.revisado_at desc limit 100) q),
    'mios', (
      select coalesce(jsonb_agg(public._clip_json(c, yo) order by c.creado_at desc), '[]'::jsonb)
      from public.clips_link c where c.user_id = yo),
    -- Ya no hay clips esperando revisión.
    'pendientes', case when v_admin then '[]'::jsonb end,
    'recientes', case when v_admin then (
      select coalesce(jsonb_agg(q.j order by q.t desc), '[]'::jsonb)
      from (select public._clip_json(c, yo) as j, c.creado_at as t from public.clips_link c
            where c.estado = 'aprobado' order by c.creado_at desc limit 30) q) end);
end $$;

-- Quien administra quita un clip publicado. Queda como "quitado" y a quien lo subió le llega el aviso.
create or replace function public.admin_quitar_clip(p_id uuid, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := public._solo_admin();
  c public.clips_link;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_motivo is not null and char_length(v_motivo) > 200 then
    raise exception 'El motivo puede tener hasta 200 letras';
  end if;
  update public.clips_link set estado = 'rechazado', motivo = v_motivo, revisado_at = now(), revisado_por = yo
  where id = p_id and estado <> 'rechazado'
  returning * into c;
  if not found then
    raise exception 'Ese clip ya no está';
  end if;
  perform public._notificar(c.user_id, 'Quitamos tu clip de Clips', coalesce('Motivo: ' || v_motivo, 'No cumplía las reglas de HaxMatch.'), '/clips/mis-videos', 'clip-' || c.id);
end $$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on function public._pais(text), public._busqueda_pais() from public, anon, authenticated;
revoke all on function public.cambiar_pais(text), public.admin_quitar_clip(uuid, text) from public, anon;
grant execute on function public.cambiar_pais(text), public.admin_quitar_clip(uuid, text) to authenticated;
revoke all on function public.mis_ajustes(), public.subir_clip(text, text), public.clips_link(),
  public.crear_busqueda(text, text[], text[], text[], text[], text, text, int), public.completar_registro(text, text[], text) from public, anon;
grant execute on function public.mis_ajustes(), public.subir_clip(text, text), public.clips_link(),
  public.crear_busqueda(text, text[], text[], text[], text[], text, text, int), public.completar_registro(text, text[], text) to authenticated;
