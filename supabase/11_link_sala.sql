-- HaxMatch · Paso 11: link de la sala de HaxBall
--
-- Va después de los pasos 1 a 10. Se puede correr de nuevo sin romper nada.
--
-- - Quien abre una sala ("Necesito un jugador") puede agregar el link de su sala de
--   HaxBall. Es opcional.
-- - Solo se aceptan links de salas de HaxBall (haxball.com/play?c=...). Se guardan
--   siempre de la misma forma, para que nadie pueda hacer pasar otro sitio por una sala.
-- - El link lo ven el dueño, los jugadores a los que la sala les escribió (o que le
--   escribieron) en el último día, y los que están en el partido. El resto de la
--   cola sigue viendo solo el nombre de la sala.

alter table public.busquedas add column if not exists link_sala text;
alter table public.matches add column if not exists link_sala text;

-- Deja el link de una sala de HaxBall en su forma de siempre. Vacío: null.
create or replace function public._link_sala(p_link text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v text := trim(coalesce(p_link, ''));
  m text[];
begin
  if v = '' then
    return null;
  end if;
  m := regexp_match(v, '^(?:https?://)?(?:www\.)?haxball\.com/play\?c=([A-Za-z0-9_-]{4,40})(&p=1)?/?$', 'i');
  if m is null then
    raise exception 'Ese link no es de una sala de HaxBall. Tiene que ser como https://www.haxball.com/play?c=...';
  end if;
  return 'https://www.haxball.com/play?c=' || m[1] || coalesce(m[2], '');
end $$;

-- Poner (o sacar, con vacío) el link de mi sala abierta. Devuelve cómo quedó.
create or replace function public.poner_link_sala(p_link text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  mia public.busquedas;
  v text := public._link_sala(p_link);
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  select * into mia from public.busquedas
  where user_id = yo and modo = 'sala' and estado = 'activa' for update;
  if not found then
    raise exception 'No tenés una sala abierta';
  end if;
  update public.busquedas set link_sala = v where id = mia.id;
  if mia.match_id is not null then
    update public.matches set link_sala = v where id = mia.match_id and creado_por = yo;
  end if;
  perform public._avisar();
  return v;
end $$;

-- El partido de una sala lleva el link que tenía la sala al armarse.
create or replace function public._link_al_crear_match()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.link_sala is null then
    new.link_sala := (
      select b.link_sala from public.busquedas b
      where b.user_id = new.creado_por and b.modo = 'sala' and b.estado = 'activa'
      order by b.creada_at desc limit 1);
  end if;
  return new;
end $$;

drop trigger if exists link_al_crear_match on public.matches;
create trigger link_al_crear_match before insert on public.matches
  for each row execute function public._link_al_crear_match();

-- Todo lo que la app muestra (paso 5) más el link de las salas que me corresponde ver.
create or replace function public.estado_app(p_visible boolean default true)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v jsonb;
begin
  v := public.estado_completo(p_visible)::jsonb;
  v := jsonb_set(v, '{busquedas}', coalesce((
    select jsonb_agg(x.b || jsonb_build_object('link_sala', (
      select s.link_sala from public.busquedas s
      where s.id = (x.b ->> 'id')::uuid and s.modo = 'sala'
        and (s.user_id = yo or exists (
          select 1 from public.mensajes m
          where m.creado_at > now() - interval '1 day'
            and ((m.de = s.user_id and (m.a = yo or yo = any (m.con)))
              or (m.a = s.user_id and (m.de = yo or yo = any (m.con)))))))) order by x.n)
    from jsonb_array_elements(v -> 'busquedas') with ordinality as x (b, n)), '[]'::jsonb));
  -- Los partidos que llegan son solo los míos: el link va siempre.
  v := jsonb_set(v, '{matches}', coalesce((
    select jsonb_agg(x.m || jsonb_build_object('link_sala', t.link_sala) order by x.n)
    from jsonb_array_elements(v -> 'matches') with ordinality as x (m, n)
    left join public.matches t on t.id = (x.m ->> 'id')::uuid), '[]'::jsonb));
  return v::json;
end $$;

revoke all on function public._link_sala(text), public._link_al_crear_match() from public, anon, authenticated;
revoke all on function public.poner_link_sala(text), public.estado_app(boolean) from public, anon;
grant execute on function public.poner_link_sala(text), public.estado_app(boolean) to authenticated;
