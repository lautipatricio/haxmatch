// Imitación local de Supabase para probar los SQL sin tocar el proyecto real.
// Usa PGlite (Postgres dentro de Node) y arma lo mínimo de los esquemas "auth"
// y "storage" para poder ejecutar tablas, permisos y funciones.
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const IMITACION = `
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
  create publication supabase_realtime;
  -- pg_net de mentira: en lugar de mandar el pedido, lo anota para poder revisarlo.
  create schema net;
  create table net.pedidos (id bigserial primary key, url text, body jsonb, headers jsonb);
  create table net._http_response (id bigint, status_code int, content_type text, headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 2000)
  returns bigint language sql as $$ insert into net.pedidos (url, body, headers) values (url, body, headers) returning id $$;
`

/** Crea la base y ejecuta todos los SQL de supabase/, dos veces cada uno (tienen que poder repetirse). */
export async function crearBase({ silencioso = false } = {}) {
  const db = new PGlite()
  await db.exec(IMITACION)
  for (const f of readdirSync('supabase').filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(`supabase/${f}`, 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    if (!silencioso) console.log(`· ${f}: ejecutado dos veces sin errores`)
  }
  return db
}

const literal = (v) => (Array.isArray(v) ? `{${v.map((x) => `"${String(x).replace(/(["\\])/g, '\\$1')}"`).join(',')}}` : v === null || v === undefined ? null : String(v))

/**
 * Acceso a la base como lo haría la app: cada consulta corre con el rol y la
 * identidad de un usuario. Las llamadas se encolan porque hay una sola conexión.
 */
export function crearAcceso(db) {
  let cola = Promise.resolve()
  const tipos = new Map()
  const enTurno = (fn) => {
    const r = cola.then(fn, fn)
    cola = r.catch(() => {})
    return r
  }
  const jwtDe = (u) => JSON.stringify({ user_metadata: { full_name: u.usuario, name: `${u.usuario}#0`, provider_id: u.id, custom_claims: { global_name: u.nombre ?? u.usuario } } })

  async function conRol(u, sql, params) {
    await db.exec(`reset role; select set_config('prueba.uid', '${u?.id ?? ''}', false); select set_config('prueba.jwt', '${u ? jwtDe(u).replaceAll("'", "''") : ''}', false); set role ${u ? 'authenticated' : 'anon'};`)
    try {
      return (await db.query(sql, params)).rows
    } finally {
      await db.exec('reset role')
    }
  }

  return {
    /** Consulta SQL como un usuario ({ id, usuario, nombre }) o como visitante (null). */
    sql: (u, sql, params = []) => enTurno(() => conRol(u, sql, params)),
    /** Llama a una función pública con argumentos por nombre, igual que supabase.rpc. */
    rpc: (u, nombre, args = {}) => enTurno(async () => {
      if (!/^[a-z_]+$/.test(nombre)) throw new Error('Función no válida')
      if (!tipos.has(nombre)) {
        const { rows } = await db.query(
          `select p.proargnames as nombres,
                  (select array_agg(format_type(t, null) order by o) from unnest(p.proargtypes) with ordinality as x (t, o)) as tipos
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = $1`, [nombre])
        if (!rows.length) throw new Error(`No existe la función ${nombre}`)
        tipos.set(nombre, Object.fromEntries((rows[0].nombres ?? []).map((n, i) => [n, rows[0].tipos[i]])))
      }
      const t = tipos.get(nombre)
      const claves = Object.keys(args)
      for (const k of claves) if (!t[k]) throw new Error(`${nombre} no tiene el argumento ${k}`)
      const llamada = `select public.${nombre}(${claves.map((k, i) => `${k} => $${i + 1}::${t[k]}`).join(', ')}) as r`
      return (await conRol(u, llamada, claves.map((k) => literal(args[k]))))[0].r
    }),
    /** Consulta sin restricciones, para preparar o revisar datos en las pruebas. */
    admin: (sql, params = []) => enTurno(async () => (await db.query(sql, params)).rows),
  }
}

/** Da de alta un usuario de prueba (como si hubiera entrado con Discord) y termina su registro. */
export async function altaUsuario(acceso, n, usuario, nombre = usuario, region = ['ARG']) {
  const id = `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const u = { id, usuario, nombre }
  await acceso.admin(`insert into auth.users values ($1) on conflict do nothing`, [id])
  await acceso.rpc(u, 'mi_perfil')
  await acceso.rpc(u, 'completar_registro', { p_nick: nombre, p_region: region })
  return u
}
