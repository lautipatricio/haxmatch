// Prueba los SQL de supabase/ en un Postgres local (PGlite), sin tocar el proyecto real.
// Supabase trae los esquemas "auth" y "storage" ya armados; acá se imitan lo justo
// para poder ejecutar las tablas, permisos y funciones y comprobar las reglas.
// Uso: node scripts/probar-sql.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
let fallas = 0
const ok = (cond, texto) => { console.log(`${cond ? '  ✓' : '  ✗'} ${texto}`); if (!cond) fallas++ }
const falla = async (texto, fn) => {
  try { await fn(); ok(false, `${texto} (tenía que fallar y no falló)`) } catch (e) { ok(true, `${texto} → "${String(e.message).slice(0, 70)}"`) }
}

// ---- Imitación mínima de Supabase ----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('prueba.jwt', true), ''), '{}')::jsonb $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on all functions in schema auth, storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant usage on sequence storage.objects_id_seq to authenticated;
`)

const archivos = readdirSync('supabase').filter((f) => f.endsWith('.sql')).sort()
for (const f of archivos) {
  const sql = readFileSync(`supabase/${f}`, 'utf8')
  await db.exec(sql)
  await db.exec(sql) // Tiene que poder ejecutarse dos veces.
  console.log(`· ${f}: ejecutado dos veces sin errores`)
}

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
await db.exec(`insert into auth.users values ('${A}'), ('${B}')`)
const jwt = (handle, visible) => JSON.stringify({ user_metadata: { full_name: handle, name: `${handle}#0`, provider_id: '123', custom_claims: { global_name: visible } } })

/** Ejecuta una consulta como un usuario que entró (o como visitante si uid es null). */
async function como(uid, datosJwt, sql, params = []) {
  await db.exec(`reset role; select set_config('prueba.uid', '${uid ?? ''}', false); select set_config('prueba.jwt', '${(datosJwt ?? '').replaceAll("'", "''")}', false); set role ${uid ? 'authenticated' : 'anon'};`)
  try { return (await db.query(sql, params)).rows } finally { await db.exec('reset role') }
}
const perfil = async (uid, j) => (await como(uid, j, 'select public.mi_perfil() as p'))[0].p

console.log('\nPerfil')
const a1 = await perfil(A, jwt('lauti_hax', 'Lauti'))
ok(a1.username === 'lauti_hax' && a1.nick === 'Lauti', 'la primera vez crea el perfil con el usuario y el nombre visible de Discord')
ok(/^HX[A-HJ-NP-Z2-9]{4}$/.test(a1.codigo), `genera un código de referido (${a1.codigo})`)
ok(a1.onboarding === false, 'arranca con el registro sin terminar')
const a2 = await perfil(A, jwt('otro_nombre', 'Otro'))
ok(a2.codigo === a1.codigo && a2.nick === 'Lauti', 'volver a entrar no crea otro perfil ni cambia el código')
await falla('un visitante no puede pedir un perfil', () => como(null, null, 'select public.mi_perfil()'))

console.log('\nRegistro')
await falla('rechaza un nick de un carácter', () => como(A, jwt('lauti_hax', 'Lauti'), `select public.completar_registro('X', array['ARG'])`))
await falla('rechaza una región que no existe', () => como(A, jwt('lauti_hax', 'Lauti'), `select public.completar_registro('Lauti10', array['MX'])`))
await falla('rechaza quedarse sin región', () => como(A, jwt('lauti_hax', 'Lauti'), `select public.completar_registro('Lauti10', array[]::text[])`))
const a3 = (await como(A, jwt('lauti_hax', 'Lauti'), `select public.completar_registro('Lauti10', array['ARG','UY'], $1) as p`, [a1.codigo]))[0].p
ok(a3.nick === 'Lauti10' && a3.onboarding === true && a3.region.join() === 'ARG,UY', 'guarda nick y regiones y termina el registro')
ok(a3.referido_por === null, 'no deja usar el código propio')
const a4 = (await como(A, jwt('lauti_hax', 'Lauti'), `select public.completar_registro('', array['ARG']) as p`))[0].p
ok(a4.nick === 'lauti_hax', 'sin nick usa el usuario de Discord')

console.log('\nCódigo de un amigo')
const q = async (codigo) => (await como(null, null, 'select public.quien_invita($1) as n', [codigo]))[0].n
ok(await q(` ${a1.codigo.toLowerCase()} `) === 'lauti_hax', 'un visitante puede validar un código (sin importar mayúsculas ni espacios)')
ok(await q('NOEXISTE') === null, 'un código que no existe devuelve vacío')
await perfil(B, jwt('pepito', 'Pepito'))
const b1 = (await como(B, jwt('pepito', 'Pepito'), `select public.completar_registro('Pepito', array['CHI'], $1) as p`, [a1.codigo]))[0].p
ok(b1.referido_por === A && b1.invito === 'lauti_hax', 'una cuenta nueva queda anotada como invitada por el dueño del código')
const b2 = (await como(B, jwt('pepito', 'Pepito'), `select public.completar_registro('Pepito', array['CHI'], 'OTRO99') as p`))[0].p
ok(b2.referido_por === A, 'una cuenta que ya terminó el registro no puede cambiar quién la invitó')
ok(await q(b1.codigo) === 'Pepito', 'el código de la cuenta nueva empieza a valer cuando termina su registro')

console.log('\nPermisos')
const vistos = await como(B, jwt('pepito', 'Pepito'), 'select id, username, nick, region, foto_url from public.profiles order by username')
ok(vistos.length === 2, 'un usuario ve los datos públicos de los demás')
await falla('no puede leer quién invitó a otro', () => como(B, jwt('pepito', 'Pepito'), 'select referido_por from public.profiles'))
await falla('un visitante no puede leer perfiles', () => como(null, null, 'select nick from public.profiles'))
await como(B, jwt('pepito', 'Pepito'), `update public.profiles set nick = 'Hackeado' where id = '${A}'`)
ok((await perfil(A, jwt('lauti_hax', 'Lauti'))).nick === 'lauti_hax', 'no puede cambiar el perfil de otro')
await como(B, jwt('pepito', 'Pepito'), `update public.profiles set foto_url = 'https://ejemplo/foto.jpg', nick = 'Pepe' where id = '${B}'`)
const b3 = await perfil(B, jwt('pepito', 'Pepito'))
ok(b3.foto_url === 'https://ejemplo/foto.jpg' && b3.nick === 'Pepe', 'sí puede cambiar su foto y su nick')
await falla('no puede cambiarse el código', () => como(B, jwt('pepito', 'Pepito'), `update public.profiles set codigo = 'HXAAAA' where id = '${B}'`))
await falla('no puede anotarse un referido a mano', () => como(B, jwt('pepito', 'Pepito'), `update public.profiles set referido_por = null where id = '${B}'`))
await falla('no puede poner un nick de 30 caracteres', () => como(B, jwt('pepito', 'Pepito'), `update public.profiles set nick = repeat('x', 30) where id = '${B}'`))
await falla('no puede insertar perfiles a mano', () => como(B, jwt('pepito', 'Pepito'), `insert into public.profiles (id, username, nick, codigo) values ('${B}', 'x', 'xx', 'HX0000')`))

console.log('\nFotos')
await como(A, jwt('lauti_hax', 'Lauti'), `insert into storage.objects (bucket_id, name) values ('avatares', '${A}/foto.jpg')`)
ok(true, 'puede subir una foto a su propia carpeta')
await falla('no puede subir una foto a la carpeta de otro', () => como(B, jwt('pepito', 'Pepito'), `insert into storage.objects (bucket_id, name) values ('avatares', '${A}/foto.jpg')`))
const borradas = await como(B, jwt('pepito', 'Pepito'), `delete from storage.objects where bucket_id = 'avatares' returning id`)
ok(borradas.length === 0, 'no puede borrar la foto de otro')
const bucket = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatares'`)).rows[0]
ok(bucket.public === true && Number(bucket.file_size_limit) === 1048576, 'la carpeta de fotos es pública y acepta hasta 1 MB')

console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : '\nTodo bien.')
process.exit(fallas ? 1 : 0)
