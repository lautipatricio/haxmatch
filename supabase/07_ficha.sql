-- HaxMatch · Paso 7: el perfil de otro jugador
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Necesita los pasos 1 a 6. Se puede ejecutar más de una vez sin romper nada.
--
-- Qué agrega: al tocar a un jugador en la cola, la app muestra su perfil con
-- cuántos amistosos jugó y su nivel. Son los mismos datos que cada uno ve en su
-- propio Perfil como "públicos".

-- Lo que se ve del perfil de otro. Devuelve vacío si ese usuario no existe, no
-- terminó su registro o hay un bloqueo entre los dos (para cualquiera de los lados).
create or replace function public.ficha_jugador(p_user uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;
  if p_user is null or public._bloqueo_entre(yo, array[p_user]) then
    return null;
  end if;
  return (
    select json_build_object(
      'id', u.id,
      'nivel', public._nivel(u.puntos),
      -- Amistosos jugados: los partidos que le cuentan (entró o confirmó, y el partido es válido).
      -- Se toma también lo anotado en sus puntos, que no baja si otro jugador borra su cuenta.
      'jugados', greatest(
        (select count(*) from public.match_participantes p join public.matches m on m.id = p.match_id
         where p.user_id = u.id and m.contado_at is not null
           and (p.confirmado_at is not null or p.entro_at is not null)),
        (select count(*) from public.puntos x where x.user_id = u.id and x.tipo = 'amistoso')))
    from public.profiles u
    where u.id = p_user and u.onboarding);
end $$;

revoke all on function public.ficha_jugador(uuid) from public, anon;
grant execute on function public.ficha_jugador(uuid) to authenticated;
