# HaxMatch

App para armar amistosos de HaxBall desde el celular. PWA en React.

**Estado: cuenta, cola, partidos, amigos, avisos y clips reales.** El ingreso con Discord, el perfil, la cola, los mensajes, los grupos, las salas, los partidos y los amigos funcionan entre usuarios de verdad, con el servidor (Supabase) aplicando las reglas. Las notificaciones llegan con la app cerrada. La vinculación con TikTok y los clips están hechos, y empiezan a funcionar cuando se cargan las claves de la app de TikTok (ver "TikTok" más abajo). Los puntos y niveles todavía se calculan en cada dispositivo, y la lista de referidos sigue de muestra.

Publicada en https://haxmatch.lauti.workers.dev

## Cómo correrla

Necesitás Node 20 o más nuevo.

```
npm install
npm run dev        # abre la app en http://localhost:5173, con el servidor real
npm test           # tests de las reglas (puntos, niveles, validación)
npm run test:sql   # prueba los SQL de supabase/ en una base local (249 comprobaciones)
npm run test:push  # prueba el envío de notificaciones (worker/index.js)
npm run test:tiktok  # prueba la vinculación con TikTok contra un TikTok de mentira (38 comprobaciones)
npm run build      # versión para publicar, en dist/
npm run probar     # versión de demostración, sin servidor, en http://localhost:4173
npm run ensayo     # ensayo con varios usuarios a la vez contra una base local
npm run ensayo:produccion   # lo mismo, con la versión que se publica
```

Con `npm run probar` abierto, `node scripts/recorrido.mjs` recorre solo los flujos principales de la demostración.

### Probar con varios usuarios sin tocar Supabase

`node scripts/servidor-ensayo.mjs` levanta en esta computadora la misma base de datos que Supabase (ejecuta los SQL de `supabase/`). No guarda nada: al cerrarlo se pierde todo.

```
node scripts/servidor-ensayo.mjs                                   # en una terminal
npm run build:ensayo && npx vite preview --outDir dist-ensayo --port 4174   # en otra
```

Después abrí `http://localhost:4174/?u=ana` en una ventana y `http://localhost:4174/?u=beto` en otra (ventanas de incógnito distintas, o navegadores distintos). Cada nombre es un usuario.

`npm run ensayo` hace eso solo: abre varios "celulares" y recorre salas, pedidos, grupos, equipo completo, los 15 minutos, amigos, clips con TikTok (de mentira), reportes y cierre de sesión.

Para verla en el celular en la misma red wifi: `npm run dev -- --host` y abrí la dirección que muestra.

## Publicación

La web se publica en Cloudflare, conectado a este repositorio: cada cambio en la rama `main` se publica solo.

| Ajuste en Cloudflare | Valor |
|---|---|
| Nombre del proyecto | `haxmatch` (tiene que coincidir con `name` en `wrangler.jsonc`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |
| Node | 22 (lo toma de `.nvmrc`) |

`wrangler.jsonc` le dice a Cloudflare que publique la carpeta `dist/`, que cualquier dirección abra la app y que lo que empieza con `/api/` lo atienda `worker/index.js`.

### Notificaciones (avisos con la app cerrada)

Se configuran una sola vez:

1. Ejecutar `supabase/03_amigos_avisos.sql` en Supabase.
2. Abrir `https://haxmatch.lauti.workers.dev/api/push/configurar`. Genera tres claves y dice dónde pegarlas: las tres en Cloudflare (como *Secret*) y una línea en el SQL Editor de Supabase.
3. En cada celular: Perfil > "Activar avisos" y después "Mandar un aviso de prueba".

Las claves no están en el repositorio ni las ve nadie más que quien las carga. `VAPID_PUBLICA` y `VAPID_PRIVADA` identifican a HaxMatch ante los servicios de avisos de los navegadores; `PUSH_SECRETO` la comparten la base y la web para que nadie más pueda pedir que se mande un aviso.

Cómo viaja un aviso: algo cambia en la base (un mensaje, un lugar en una sala, un amigo que se pone a buscar) > un disparador decide a quién avisarle > la base le hace un pedido a `/api/push/enviar` > el Worker cifra el aviso para cada celular y se lo entrega al servicio de avisos del navegador > el service worker (`public/sw.js`) lo muestra. Si el usuario tiene la app abierta y a la vista, el service worker no la muestra (salvo en iPhone, donde Apple exige mostrarla): el aviso ya aparece adentro.

Si algún aviso no llega, en Supabase > SQL Editor se puede ver qué contestó la web a los últimos pedidos: `select created, status_code, content, error_msg from net._http_response order by created desc limit 10;`

En iPhone las notificaciones solo funcionan con la app agregada a la pantalla de inicio.

### TikTok (vincular la cuenta y traer los videos)

Necesita los avisos ya configurados (usa la misma clave compartida entre la base y la web). Se configura una sola vez:

1. Ejecutar `supabase/04_clips.sql` en Supabase.
2. Crear una app en [TikTok for Developers](https://developers.tiktok.com), con los productos **Login Kit** y **Display API** y los permisos `user.info.basic` y `video.list`. Datos que pide:

   | Campo | Valor |
   |---|---|
   | Sitio web | `https://haxmatch.lauti.workers.dev` |
   | Términos | `https://haxmatch.lauti.workers.dev/terminos` |
   | Privacidad | `https://haxmatch.lauti.workers.dev/privacidad` |
   | Redirect URI (Web) | `https://haxmatch.lauti.workers.dev/api/tiktok/volver` |

3. Cargar en Cloudflare, como *Secret*, `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET` (los da TikTok en la página de la app) y publicar.
4. `https://haxmatch.lauti.workers.dev/api/tiktok/estado` tiene que decir `{"configurado":true}`. Ahí aparece "Vincular TikTok" en Clips > Mis videos.

Mientras la app de TikTok esté en modo *Sandbox* solo pueden vincular las cuentas de TikTok anotadas como "Target users" (hasta 10). Para que pueda cualquiera hay que mandarla a revisión, con un video que muestre el recorrido.

Cómo funciona: la app le pide a la web (`/api/tiktok/entrar`) empezar una vinculación > el usuario da el permiso en la página de TikTok > TikTok lo devuelve a `/api/tiktok/volver` > el Worker cambia ese permiso por las llaves de acceso, las guarda en la base (en una tabla que la app no puede leer) y trae la lista de videos. De TikTok se guarda solo la lista (título, fecha, duración y enlace): los videos se reproducen desde TikTok. En Clips aparecen los que tienen `#haxball` o `#haxmatch` y que su dueño no ocultó. La lista se actualiza al abrir "Mis videos", con el botón "Actualizar", al deslizar hacia abajo en el primer clip (ahí se piden los videos nuevos de todas las cuentas vinculadas), y cada 6 horas si el proyecto de Supabase tiene `pg_cron`. Al desvincular se borran las llaves y los videos, y se le pide a TikTok que anule el permiso.

## Servidor (Supabase)

- Los datos del proyecto están en `.env.production` y `.env.development`. Son públicos: la dirección y la clave "publishable". **Nunca** van ahí la clave `sb_secret_`, la contraseña de la base ni el Client Secret de Discord.
- Los SQL de `supabase/` se pegan en Supabase > SQL Editor, en orden. Se pueden ejecutar más de una vez.
- Sin esos datos (`npm run probar`), la app funciona en modo demostración: ingreso simulado y todo guardado en el dispositivo.

| Archivo | Qué crea |
|---|---|
| `supabase/01_perfiles.sql` | Tabla de perfiles con sus permisos, alta automática al entrar con Discord, registro (nick y región), código de un amigo y la carpeta de fotos de perfil |
| `supabase/02_cola.sql` | La cola: búsquedas, mensajes, grupos, salas con cupos, partidos, confirmaciones y reportes. La app no toca las tablas: todo pasa por funciones que aplican las reglas. Incluye la señal de tiempo real |
| `supabase/03_amigos_avisos.sql` | Amigos (solicitudes, aceptar, quitar), las suscripciones de cada celular a los avisos, y los disparadores que deciden qué se avisa y a quién |
| `supabase/04_clips.sql` | Clips: la cuenta de TikTok vinculada de cada usuario, la lista de sus videos, cuáles se muestran y las reacciones |

### Cómo funciona la cola

- La app pide `estado_cola`, que devuelve de una vez todo lo que hay que mostrar, y cada acción llama a una función (`crear_busqueda`, `enviar_mensaje`, `responder_mensaje`, `marcar_entro`, `confirmar_match`…).
- Cada vez que algo cambia, el servidor toca la tabla `cambios`. Las apps abiertas la escuchan por Realtime y vuelven a pedir el estado. Además preguntan cada 8 segundos, por si el aviso no llega.
- Ese pedido periódico también es la señal de vida: una búsqueda cuyo dueño no aparece hace 10 minutos sale de la cola.
- El emparejamiento automático corre dentro de esas mismas funciones: a cada sala con lugares libres le acerca un jugador o grupo para que el dueño acepte o rechace.
- Los cambios se hacen de a uno (un candado por transacción), para que dos acciones simultáneas no se pisen.
- Los reportes se ven en Supabase > Table Editor > `reportes`.

## Cómo está armada

| Carpeta | Qué tiene |
|---|---|
| `src/domain/` | Tipos y **reglas de producto** como funciones puras, con tests. Es lo que el backend tiene que replicar. |
| `src/data/store.ts` | Estado de la app y acciones (crear búsqueda, confirmar match, reaccionar…). Con servidor llama a sus funciones y arma los avisos comparando cada estado con el anterior; sin servidor simula todo en el dispositivo. |
| `src/data/servidor.ts` | La cola real: llamadas a las funciones del servidor y traducción de lo que devuelven a la forma que usan las pantallas. |
| `src/data/transporte.ts` | Cómo se llama a una función y cómo se escucha que algo cambió (Supabase o servidor de ensayo). |
| `src/data/supabase.ts`, `src/data/cuenta.ts` | Conexión con Supabase: sesión con Discord, perfil y foto. |
| `src/data/push.ts` | Activar y desactivar los avisos en cada celular, y el aviso de prueba. |
| `src/data/clips.ts` | Clips: lo que se muestra, reaccionar, ocultar, vincular y desvincular TikTok. |
| `worker/index.js` | Parte de servidor de la web (Cloudflare): cifra y manda las notificaciones. |
| `worker/tiktok.js` | Lo que la web habla con TikTok: vincular, renovar el acceso, traer la lista de videos y desvincular. |
| `src/data/seed.ts` | Datos de muestra y comportamiento de los jugadores simulados de la demostración. |
| `supabase/` | SQL de la base de datos. |
| `src/screens/` | Una pantalla por archivo. |
| `src/ui/` | Piezas compartidas: botones, chips, barra inferior, carteles, avisos. |
| `src/styles.css` | Colores, tipografías y componentes de la sección 8 de la especificación. |
| `public/` | Manifest, íconos, service worker de la PWA, y las páginas de Términos y Privacidad (se leen sin entrar a la app). |
| `scripts/recorrido.mjs` | Recorrido automático por los flujos principales de la demostración, con capturas. |
| `scripts/servidor-ensayo.mjs`, `scripts/ensayo.mjs`, `scripts/ensayo-produccion.mjs` | Servidor local y ensayos con varios usuarios a la vez. |
| `scripts/probar-sql.mjs`, `scripts/supabase-local.mjs` | Pruebas de los SQL en una imitación local de Supabase. |
| `scripts/probar-push.mjs`, `scripts/probar-tiktok.mjs`, `scripts/tiktok-falso.mjs` | Pruebas de la parte de servidor de la web: avisos y TikTok (con un TikTok de mentira). |
| `docs/DECISIONES.md` | Decisiones tomadas sobre la especificación y puntos abiertos. |

## Qué es real y qué es de muestra

En la web publicada:

- **Real:** ingreso con Discord, perfil y foto, cola, mensajes, grupos, salas, partidos, confirmaciones, reportes, amigos, notificaciones, clips (vinculación con TikTok, videos, reacciones) y los totales de amistosos jugados y asistencia.
- **En el dispositivo:** puntos, nivel y racha (se calculan en el celular con los partidos que confirma el servidor). Bloquear a un jugador también: lo oculta en ese dispositivo.
- **De muestra:** mientras nadie haya vinculado un TikTok con videos de HaxBall, Clips muestra 6 videos inventados (no se reproducen) para que no quede vacío. Desaparecen cuando hay al menos un clip real.
- **Todavía no:** lista de referidos y nivel de los demás jugadores.

En modo demostración (`npm run probar`) todo está simulado:

- **Ingreso:** entra siempre como `Jugador_Demo`.
- **Otros jugadores:** 9 usuarios inventados. Mati_ acepta y se suma a tu búsqueda; Tobi_GK busca en grupo con Fede_7 (si acepta, se suman los dos); Pibe9 rechaza los mensajes; la sala de Nico (faltan 2) acepta y confirma; la de Rolo (falta 1) acepta pero nunca confirma, para ver un partido sin contar.
- **Mensaje entrante:** a los 15 segundos de buscar partido te escribe Mati_ (al aceptar te sumás a su búsqueda).
- **Emparejamiento automático:** si tenés sala, la app te acerca gente a los 8 segundos y después cada 12. Si buscás partido, te conecta sola con una sala a los 45 segundos. En la pantalla de espera hay un botón de prueba para dispararlo ya, y otro para simular que pasaron los 15 minutos.
- **Herramientas de prueba** (Perfil, Mis videos, Referir): avanzar un día, simular un video nuevo, simular amistosos de un referido, reiniciar los datos.

Códigos de amigo de la demostración: `NICO23`, `MATI10`.

## Próximas etapas

1. Puntos, niveles y referidos en el servidor.
2. Revisión de la app de TikTok, para que pueda vincular cualquiera.
3. Borrar la cuenta desde la app, bloqueos en el servidor y moderación.
