-- HaxMatch · Paso 1: perfiles y fotos de perfil
-- Se pega completo en Supabase > SQL Editor y se ejecuta con "Run".
-- Se puede ejecutar más de una vez sin romper nada.

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text,
  -- Usuario de Discord. Sirve para que te agreguen como amigo.
  username text not null,
  -- Nombre que la persona eligió mostrar en la app.
  nick text not null check (char_length(nick) between 2 and 20),
  region text[] not null default array['ARG']
    check (cardinality(region) >= 1 and region <@ array['ARG', 'CHI', 'BR', 'UY']),
  foto_url text,
  -- Código de referido, único por usuario.
  codigo text not null unique,
  referido_por uuid references public.profiles (id) on delete set null,
  -- false hasta que termina el registro (nick y región).
  onboarding boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cualquier usuario que entró puede ver los datos públicos de los demás.
drop policy if exists "perfiles: lectura" on public.profiles;
create policy "perfiles: lectura" on public.profiles
  for select to authenticated using (true);

-- Cada uno modifica solo su propio perfil.
drop policy if exists "perfiles: edicion propia" on public.profiles;
create policy "perfiles: edicion propia" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Columnas: se ven las públicas y solo se pueden cambiar nick, región y foto.
-- El código, quién te invitó y el estado del registro los maneja el servidor.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, nick, region, foto_url, created_at) on public.profiles to authenticated;
grant update (nick, region, foto_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------

-- Código de referido: HX + 4 letras o números fáciles de leer (sin 0, O, 1, I).
create or replace function public.nuevo_codigo()
returns text language plpgsql volatile set search_path = '' as $$
declare
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  resultado text;
begin
  loop
    resultado := 'HX';
    for i in 1..4 loop
      resultado := resultado || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where codigo = resultado);
  end loop;
  return resultado;
end $$;

-- ¿De quién es este código? Devuelve el nick, o null si el código no existe.
-- La usa la pantalla de ingreso antes de entrar con Discord.
create or replace function public.quien_invita(p_codigo text)
returns text language sql stable security definer set search_path = '' as $$
  select nick from public.profiles
  where codigo = upper(trim(p_codigo)) and onboarding
$$;

-- Mi perfil completo. La primera vez lo crea con los datos de Discord.
create or replace function public.mi_perfil()
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  datos jsonb := coalesce((select auth.jwt()) -> 'user_metadata', '{}'::jsonb);
  v_username text;
  v_nick text;
  fila public.profiles;
begin
  if yo is null then
    raise exception 'Hay que entrar con Discord';
  end if;

  select * into fila from public.profiles where id = yo;
  if not found then
    v_username := coalesce(nullif(datos ->> 'full_name', ''), nullif(datos ->> 'name', ''), 'Jugador');
    v_nick := left(coalesce(nullif(datos -> 'custom_claims' ->> 'global_name', ''), v_username), 20);
    if char_length(v_nick) < 2 then
      v_nick := 'Jugador';
    end if;
    insert into public.profiles (id, discord_id, username, nick, codigo)
    values (yo, datos ->> 'provider_id', v_username, v_nick, public.nuevo_codigo())
    on conflict (id) do nothing;
    select * into fila from public.profiles where id = yo;
  end if;

  return json_build_object(
    'id', fila.id,
    'username', fila.username,
    'nick', fila.nick,
    'region', fila.region,
    'foto_url', fila.foto_url,
    'codigo', fila.codigo,
    'onboarding', fila.onboarding,
    'referido_por', fila.referido_por,
    'invito', (select nick from public.profiles where id = fila.referido_por)
  );
end $$;

-- Termina el registro: guarda nick y región y, si vino con el código de un
-- amigo, lo anota. El código solo vale para cuentas nuevas y nunca el propio.
create or replace function public.completar_registro(p_nick text, p_region text[], p_codigo text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := (select auth.uid());
  v_nick text := trim(coalesce(p_nick, ''));
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
  if p_region is null or cardinality(p_region) < 1 or not (p_region <@ array['ARG', 'CHI', 'BR', 'UY']) then
    raise exception 'Elegí al menos una región';
  end if;

  if not fila.onboarding and fila.referido_por is null and nullif(trim(coalesce(p_codigo, '')), '') is not null then
    select id into invitador from public.profiles
    where codigo = upper(trim(p_codigo)) and onboarding and id <> yo;
  end if;

  update public.profiles
  set nick = v_nick,
      region = p_region,
      onboarding = true,
      referido_por = coalesce(referido_por, invitador)
  where id = yo;

  return public.mi_perfil();
end $$;

revoke all on function public.nuevo_codigo() from public, anon, authenticated;
revoke all on function public.quien_invita(text) from public;
revoke all on function public.mi_perfil() from public, anon;
revoke all on function public.completar_registro(text, text[], text) from public, anon;
grant execute on function public.quien_invita(text) to anon, authenticated;
grant execute on function public.mi_perfil() to authenticated;
grant execute on function public.completar_registro(text, text[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos de perfil
-- ---------------------------------------------------------------------------

-- Carpeta pública "avatares". Cada usuario guarda su foto en una carpeta con su id.
-- Solo JPEG y hasta 1 MB (la app ya las achica a 256 px).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatares: ver la propia" on storage.objects;
create policy "avatares: ver la propia" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares: subir la propia" on storage.objects;
create policy "avatares: subir la propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares: cambiar la propia" on storage.objects;
create policy "avatares: cambiar la propia" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares: borrar la propia" on storage.objects;
create policy "avatares: borrar la propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
