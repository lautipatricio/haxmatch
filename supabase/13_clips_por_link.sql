-- HaxMatch · Paso 13: clips por link, con aprobación
--
-- Va después de los pasos 1 a 12. Se puede correr de nuevo sin romper nada.
--
-- Cómo está pensado:
-- - Un jugador pega el link de un video público de TikTok o de YouTube (Shorts o
--   común). Va sin título: el clip directo. El video no se copia: se reproduce desde TikTok o
--   YouTube, como los de la vinculación con TikTok.
-- - Queda "en revisión" y les llega un aviso a quienes administran (tabla admins).
--   Hasta que alguien lo aprueba, solo lo ven su dueño y quienes administran.
-- - Al aprobarlo aparece en Clips para todos y suma los puntos de un reel (el primero
--   de cada día). Al rechazarlo, el dueño ve el motivo. En los dos casos le llega un aviso.
-- - Límites: hasta 3 en revisión a la vez y 10 por día por persona. Una cuenta
--   suspendida no puede subir. El mismo video no se puede subir dos veces.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table if not exists public.clips_link (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plataforma text not null check (plataforma in ('tiktok', 'youtube')),
  video_id text not null,
  enlace text not null,
  titulo text not null default '' check (char_length(titulo) <= 80),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  motivo text check (motivo is null or char_length(motivo) <= 200),
  creado_at timestamptz not null default now(),
  revisado_at timestamptz,
  revisado_por uuid references public.profiles (id) on delete set null,
  unique (plataforma, video_id),
  check (
    (plataforma = 'tiktok' and video_id ~ '^[0-9]{5,25}$') or
    (plataforma = 'youtube' and video_id ~ '^[A-Za-z0-9_-]{11}$'))
);
-- Antes el título era obligatorio: ahora es opcional (la app sube el clip sin título).
alter table public.clips_link alter column titulo set default '';
alter table public.clips_link drop constraint if exists clips_link_titulo_check;
alter table public.clips_link add constraint clips_link_titulo_check check (char_length(titulo) <= 80);
create index if not exists clips_link_por_estado on public.clips_link (estado, creado_at desc);
create index if not exists clips_link_por_usuario on public.clips_link (user_id);

create table if not exists public.clip_link_reacciones (
  clip_id uuid not null references public.clips_link (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  creado_at timestamptz not null default now(),
  primary key (clip_id, user_id)
);

alter table public.clips_link enable row level security;
alter table public.clip_link_reacciones enable row level security;
revoke all on public.clips_link, public.clip_link_reacciones from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funciones internas
-- ---------------------------------------------------------------------------

-- Lee un link y devuelve la plataforma, el número del video y el link limpio.
-- Acepta solo links completos (los cortos de TikTok los abre antes la web).
create or replace function public._leer_link_clip(p_enlace text)
returns table (plataforma text, video_id text, enlace text)
language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_enlace, ''));
  m text[];
begin
  m := regexp_match(v, '^(?:https?://)?(?:www\.|m\.)?tiktok\.com/@([A-Za-z0-9._]{1,40})/video/([0-9]{5,25})(?:[/?#].*)?$');
  if m is not null then
    return query select 'tiktok'::text, m[2], 'https://www.tiktok.com/@' || m[1] || '/video/' || m[2];
    return;
  end if;
  m := regexp_match(v, '^(?:https?://)?(?:www\.|m\.)?youtube\.com/(?:shorts/|watch\?(?:[^#]*&)?v=|live/)([A-Za-z0-9_-]{11})(?:[&?/#].*)?$');
  if m is null then
    m := regexp_match(v, '^(?:https?://)?youtu\.be/([A-Za-z0-9_-]{11})(?:[?/#].*)?$');
  end if;
  if m is not null then
    return query select 'youtube'::text, m[1], 'https://youtu.be/' || m[1];
    return;
  end if;
end $$;

-- Avisa a todos los que administran (menos a quien lo hizo).
create or replace function public._avisar_admins(p_titulo text, p_cuerpo text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a record;
begin
  for a in select user_id from public.admins where user_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid) loop
    perform public._notificar(a.user_id, p_titulo, p_cuerpo, p_url, p_tag);
  end loop;
exception when others then
  null;
end $$;

-- Un clip, como lo ve la app.
create or replace function public._clip_json(c public.clips_link, yo uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'user_id', c.user_id, 'plataforma', c.plataforma, 'video_id', c.video_id, 'enlace', c.enlace,
    'titulo', c.titulo, 'estado', c.estado, 'motivo', c.motivo, 'creado_at', c.creado_at, 'revisado_at', c.revisado_at,
    'nick', u.nick, 'username', u.username, 'foto', public._foto_version(u.id, u.foto_url), 'nivel', public._nivel(u.puntos),
    'reacciones', (select count(*) from public.clip_link_reacciones x where x.clip_id = c.id)::int,
    'reaccione', exists (select 1 from public.clip_link_reacciones x where x.clip_id = c.id and x.user_id = yo))
  from public.profiles u where u.id = c.user_id
$$;

-- ---------------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------------

-- Subir un clip. Devuelve el clip guardado (en revisión).
create or replace function public.subir_clip(p_enlace text, p_titulo text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_plat text;
  v_vid text;
  v_enl text;
  v_titulo text := btrim(regexp_replace(coalesce(p_titulo, ''), '\s+', ' ', 'g'));
  v_nick text;
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
  if char_length(v_titulo) > 80 then
    raise exception 'El título puede tener hasta 80 letras';
  end if;
  -- De a uno por persona, así los límites no se pasan subiendo dos a la vez.
  perform pg_advisory_xact_lock(7214, hashtext(yo::text));
  select user_id into v_dueno from public.clips_link where plataforma = v_plat and video_id = v_vid;
  if found then
    raise exception '%', case when v_dueno = yo then 'Ya subiste ese clip' else 'Ese clip ya lo subió otro jugador' end;
  end if;
  if (select count(*) from public.clips_link where user_id = yo and estado = 'pendiente') >= 3 then
    raise exception 'Ya tenés 3 clips en revisión. Esperá a que los revisemos para subir otro.';
  end if;
  if (select count(*) from public.clips_link where user_id = yo and creado_at > now() - interval '24 hours') >= 10 then
    raise exception 'Llegaste al límite de 10 clips por día. Probá mañana.';
  end if;
  insert into public.clips_link (user_id, plataforma, video_id, enlace, titulo)
  values (yo, v_plat, v_vid, v_enl, v_titulo)
  returning * into c;
  select nick into v_nick from public.profiles where id = yo;
  perform public._avisar_admins('Clip para revisar',
    coalesce(v_nick, 'Un jugador') || ' subió ' || case when v_titulo = '' then 'un clip de ' || case when v_plat = 'tiktok' then 'TikTok' else 'YouTube' end
                                                     else '"' || left(v_titulo, 60) || '"' end,
    '/admin', 'clip-' || c.id);
  return public._clip_json(c, yo)::json;
end $$;

-- Borrar un clip propio (en revisión, aprobado o rechazado).
create or replace function public.borrar_clip(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.clips_link where id = p_id and user_id = (select auth.uid());
  if not found then
    raise exception 'Ese clip no es tuyo';
  end if;
end $$;

-- Todo lo de los clips por link: los aprobados (feed), los míos y, si administro, los que esperan revisión.
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
    'pendientes', case when v_admin then (
      select coalesce(jsonb_agg(public._clip_json(c, yo) order by c.creado_at), '[]'::jsonb)
      from public.clips_link c where c.estado = 'pendiente') end);
end $$;

-- Aprobar (p_aprobar true) o rechazar un clip. Solo quien administra.
create or replace function public.admin_revisar_clip(p_id uuid, p_aprobar boolean, p_motivo text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := public._solo_admin();
  c public.clips_link;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_motivo is not null and char_length(v_motivo) > 200 then
    raise exception 'El motivo puede tener hasta 200 letras';
  end if;
  update public.clips_link
  set estado = case when p_aprobar then 'aprobado' else 'rechazado' end,
      motivo = case when p_aprobar then null else v_motivo end,
      revisado_at = now(), revisado_por = yo
  where id = p_id and estado = 'pendiente'
  returning * into c;
  if not found then
    raise exception 'Ese clip ya fue revisado o lo borraron';
  end if;
  if p_aprobar then
    -- Suma como un reel nuevo: 8 puntos, el primero de cada día.
    perform public._dar_reel(c.user_id, 'link:' || c.id::text, now());
    perform public._notificar(c.user_id, 'Tu clip ya está en Clips', 'Ya lo puede ver toda la comunidad.', '/clips?v=' || c.id, 'clip-' || c.id);
  else
    perform public._notificar(c.user_id, 'Tu clip no se aprobó', coalesce('Motivo: ' || v_motivo, 'Podés subir otro cuando quieras.'), '/clips/mis-videos', 'clip-' || c.id);
  end if;
  return public._clip_json(c, yo)::json;
end $$;

-- Reaccionar a un clip aprobado (p_marcar true) o quitar la reacción. Devuelve cómo quedó.
create or replace function public.reaccionar_clip(p_id uuid, p_marcar boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_dueno uuid;
begin
  if yo is null or not exists (select 1 from public.profiles where id = yo and onboarding) then
    raise exception 'Primero terminá tu registro';
  end if;
  if p_marcar is not true then
    delete from public.clip_link_reacciones where clip_id = p_id and user_id = yo;
    return false;
  end if;
  select user_id into v_dueno from public.clips_link where id = p_id and estado = 'aprobado';
  if not found then
    raise exception 'Ese clip ya no está';
  end if;
  insert into public.clip_link_reacciones (clip_id, user_id) values (p_id, yo) on conflict do nothing;
  -- Reaccionar al clip de otro suma como en los de TikTok (1 punto, hasta 10 por día).
  if v_dueno <> yo then
    perform public._dar_reaccion(yo, 'link:' || p_id::text, now());
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de las funciones
-- ---------------------------------------------------------------------------

revoke all on function
  public._leer_link_clip(text), public._avisar_admins(text, text, text, text), public._clip_json(public.clips_link, uuid)
from public, anon, authenticated;

revoke all on function
  public.subir_clip(text, text), public.borrar_clip(uuid), public.clips_link(),
  public.admin_revisar_clip(uuid, boolean, text), public.reaccionar_clip(uuid, boolean)
from public, anon;
grant execute on function
  public.subir_clip(text, text), public.borrar_clip(uuid), public.clips_link(),
  public.admin_revisar_clip(uuid, boolean, text), public.reaccionar_clip(uuid, boolean)
to authenticated;
