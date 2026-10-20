-- HaxMatch · Paso 15: los clips son solo de TikTok
--
-- Va después de los pasos 1 a 14. Se puede correr de nuevo sin romper nada.
--
-- - Al subir un clip por link se aceptan solo videos de TikTok. Un link de YouTube
--   devuelve un mensaje claro.
-- - Los clips de YouTube que ya estaban se borran (con sus reacciones).

-- Lee un link de TikTok y devuelve la plataforma, el número del video y el link limpio.
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
  end if;
end $$;

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
    if coalesce(p_enlace, '') ~* '(youtube\.com|youtu\.be)' then
      raise exception 'Por ahora solo se pueden subir clips de TikTok.';
    end if;
    raise exception 'Ese link no es de un video de TikTok. Abrí el video y copiá su link.';
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

revoke all on function public.subir_clip(text, text) from public, anon;
grant execute on function public.subir_clip(text, text) to authenticated;

-- Los de YouTube que ya estaban.
delete from public.clip_link_reacciones r using public.clips_link c where r.clip_id = c.id and c.plataforma = 'youtube';
delete from public.clips_link where plataforma = 'youtube';
