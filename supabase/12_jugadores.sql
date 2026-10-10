-- HaxMatch · Paso 12: cuántos jugadores hay en HaxMatch
--
-- Va después de los pasos 1 a 11. Se puede correr de nuevo sin romper nada.
--
-- El Inicio muestra cuántos jugadores tiene HaxMatch (los que terminaron el registro,
-- sin contar las cuentas suspendidas). Es solo un número: no dice quiénes son.

create or replace function public.cuantos_jugadores()
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.profiles
  where onboarding and (suspendido_hasta is null or suspendido_hasta <= now())
    and (select auth.uid()) is not null;
$$;

revoke all on function public.cuantos_jugadores() from public, anon;
grant execute on function public.cuantos_jugadores() to authenticated;
