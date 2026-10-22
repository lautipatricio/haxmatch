-- 16. Ajustes de seguridad (auditoría del 22/10/2026).
-- Cada cambio tiene su prueba en supabase/pruebas/seguridad.sql.

-- 1. rls_auto_enable es la función del disparador que activa RLS en las tablas nuevas.
--    No tiene sentido que se pueda llamar desde la API (/rest/v1/rpc/rls_auto_enable).
do $$
begin
  -- La crea Supabase (no está en estos archivos): si existe, se le saca el permiso.
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- 2. La foto de perfil solo puede ser la propia, subida al bucket "avatares".
--    Antes se podía poner cualquier dirección con un PATCH directo a la tabla.
alter table public.profiles drop constraint if exists perfiles_foto_propia;
alter table public.profiles add constraint perfiles_foto_propia check (
  foto_url is null
  or foto_url ~ ('^https?://[^/]+/storage/v1/object/public/avatares/' || id::text || '/foto\.jpg(\?v=[0-9]+)?$')
);

-- 3. (No se cambia) Leer id, usuario, nick, país y foto de los demás desde la tabla profiles
--    es una decisión del diseño: lo prueba "un usuario ve los datos públicos de los demás"
--    en scripts/probar-sql.mjs. Queda anotado en docs/DECISIONES.md como riesgo aceptado.
