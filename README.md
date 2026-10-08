# HaxMatch

App para armar amistosos de HaxBall desde el celular. PWA en React.

**Estado: todo lo principal funciona con usuarios de verdad.** El ingreso con Discord, el perfil, la cola, los mensajes, los grupos, las salas, los partidos, los amigos, las notificaciones, los clips de TikTok, y los puntos, niveles y referidos: todo lo lleva el servidor (Supabase), que aplica las reglas. Cada paso se activa al ejecutar su archivo de `supabase/`; si falta uno, la app sigue andando con lo anterior.

Publicada en https://haxmatch.lauti.workers.dev

## Cómo correrla

Necesitás Node 20 o más nuevo.

```
npm install
npm run dev        # abre la app en http://localhost:5173, con el servidor real
npm test           # tests de las reglas (puntos, niveles, validación) y del aviso de prueba
npm run test:sql   # prueba los SQL de supabase/ en una base local (442 comprobaciones)
npm run test:push  # prueba el envío de notificaciones (worker/index.js)
npm run test:tiktok  # prueba la vinculación con TikTok contra un TikTok de mentira (38 comprobaciones)
npm run test:kick    # prueba la vinculación con Kick y el "en vivo" contra un Kick de mentira (34 comprobaciones)
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

Mientras la app de TikTok esté en modo *Sandbox* solo pueden vincular las cuentas de TikTok anotadas como "Target users" (hasta 10). Para que pueda cualquiera hay que mandarla a revisión, con un video que muestre el recorrido: el paso a paso está en `docs/TIKTOK_REVISION.md`.

Cómo funciona: la app le pide a la web (`/api/tiktok/entrar`) empezar una vinculación > el usuario da el permiso en la página de TikTok > TikTok lo devuelve a `/api/tiktok/volver` > el Worker cambia ese permiso por las llaves de acceso, las guarda en la base (en una tabla que la app no puede leer) y trae la lista de videos. De TikTok se guarda solo la lista (título, fecha, duración y enlace): los videos se reproducen desde TikTok. En Clips aparecen los que tienen `#haxball` o `#haxmatch` y que su dueño no ocultó. La lista se actualiza al abrir "Mis videos", con el botón "Actualizar", al deslizar hacia abajo en el primer clip (ahí se piden los videos nuevos de todas las cuentas vinculadas), y cada 6 horas si el proyecto de Supabase tiene `pg_cron`. Al desvincular se borran las llaves y los videos, y se le pide a TikTok que anule el permiso.

### Kick

1. Ejecutar `supabase/09_kick.sql` en el SQL Editor.
2. En Kick (con la verificación en dos pasos activada): Configuración > Developer > crear una app con la URL de redirección `https://haxmatch.lauti.workers.dev/api/kick/volver` y solo el permiso `user:read`. Los webhooks quedan apagados: no hacen falta.
3. Cargar en Cloudflare, como *Secret*, `KICK_CLIENT_ID` y `KICK_CLIENT_SECRET` (los da Kick al crear la app) y publicar.
4. `https://haxmatch.lauti.workers.dev/api/kick/estado` tiene que decir `{"configurado":true}`. Ahí funciona "Vincular" en Perfil > Tus cuentas > Kick.

Cómo funciona: la app le pide a la web (`/api/kick/entrar`) empezar una vinculación > el usuario da el permiso en Kick > Kick lo devuelve a `/api/kick/volver` > el Worker usa la llave una sola vez para saber quién es, la anula y guarda su número de usuario, su nombre y su canal. Cada minuto (programado en `wrangler.jsonc`) el Worker le pregunta a Kick, con la llave de la propia app, qué canales vinculados están en vivo. La app pregunta cada 30 segundos y muestra una K verde (o EN VIVO) al lado del nombre y la sección "En vivo en Kick" en el Inicio. Si hace más de 10 minutos que Kick no contesta por un canal, deja de figurar en vivo.

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
| `supabase/05_puntos.sql` | Puntos, niveles y referidos: cada movimiento de puntos, el total de cada perfil, los disparadores que los dan y los topes. Al ejecutarlo reconstruye los puntos de lo que ya estaba guardado |
| `supabase/06_cuenta.sql` | Borrar la cuenta desde la app, bloqueos guardados en el servidor y suspensión de cuentas (funciones `mod_`, solo desde el SQL Editor) |
| `supabase/07_ficha.sql` | El perfil de otro jugador: cuántos amistosos jugó y su nivel (lo que la app muestra al tocarlo en la cola) |
| `supabase/09_kick.sql` | Cuentas de Kick vinculadas y quién está en vivo (lo anota la web cada minuto) |
| `supabase/08_chat_y_panel.sql` | Chat general (mensajes de 24 horas, con topes y respetando los bloqueos), la opción de ocultar el puntito de conectado y el panel de administración (solo para quienes estén en la tabla `admins`) |

### Moderación (reportes y suspensiones)

Lo más cómodo es el **panel de administración** de la app (Perfil > Panel de administración): números, últimos registrados, reportes con su detalle, suspender y levantar suspensiones. En el chat, el botón "Moderar" deja borrar cualquier mensaje. Solo lo ven las cuentas anotadas en la tabla `admins`:

```sql
insert into public.admins (user_id) select id from public.profiles where username = 'usuario_de_discord';
```

También se puede hacer desde Supabase > SQL Editor, pegando una línea y dándole Run. La app no puede llamar a estas funciones.

| Para | Línea |
|---|---|
| Ver a quiénes reportaron en los últimos 30 días | `select * from public.mod_reportes();` |
| Ver el detalle de los reportes de alguien | `select * from public.mod_detalle('usuario');` |
| Suspender 7 días (0 = sin fecha de fin) | `select public.mod_suspender('usuario', 7, 'Insultos en una sala');` |
| Levantar la suspensión | `select public.mod_levantar('usuario');` |

`usuario` es el usuario de Discord, tal como figura en `mod_reportes()`. Una cuenta suspendida no puede buscar partido, abrir sala, escribirle a otros ni agregar o aceptar amigos; la app le muestra el motivo y hasta cuándo. No hay sanciones automáticas: decide quien modera.

Si alguien borra su cuenta y vuelve a entrar con el mismo Discord, una suspensión vigente sigue, y no cuenta otra vez como referido. Para eso queda, por un año, una huella irreversible de su identificador de Discord (tabla `cuentas_borradas`), sin ningún otro dato.

### Cómo funcionan los puntos

- Los da el servidor en el momento en que pasa lo que suma: un partido que cuenta, un video nuevo en Clips, una reacción, el primer ingreso del día, un referido que completa 5 amistosos. Cada cosa suma una sola vez.
- Cada movimiento queda en la tabla `puntos` y el total en el perfil. El nivel sale del total.
- El "día" de los topes y de la racha es el de Buenos Aires, para todos.
- La app pide `estado_completo`, que trae la cola, los amigos, mis puntos, mis referidos y el nivel de los demás. Si la base no tiene el paso 5 pide `estado`, y si tampoco tiene el 3, `estado_cola`.
- Para ver los puntos de alguien: Supabase > Table Editor > `puntos`.

### Cómo funciona la cola

- La app pide `estado_cola`, que devuelve de una vez todo lo que hay que mostrar, y cada acción llama a una función (`crear_busqueda`, `enviar_mensaje`, `responder_mensaje`, `marcar_entro`, `confirmar_match`…).
- Cada vez que algo cambia, el servidor toca la tabla `cambios`. Las apps abiertas la escuchan por Realtime y vuelven a pedir el estado. Además preguntan cada 8 segundos, por si el aviso no llega.
- Ese pedido periódico también es la señal de vida: una búsqueda cuyo dueño no aparece hace 10 minutos sale de la cola.
- **Quien busca partido** entra a la cola de un toque, sin elegir nada: va con las regiones de su perfil y por 15 minutos (renovables).
- **Quien tiene una sala** completa el formulario (nombre, cuántos faltan, posición, cancha, región) y ve la lista de jugadores que están buscando. Elige a quién invitar; al invitado le llega `"(sala)" está necesitando un GK/DFC en la cancha Big. ¿Querés jugar?` y, si acepta, entra directo. Puede invitar a varios: el primero que acepta se queda con el lugar y las demás invitaciones se caen solas.
- Un jugador también puede pedirle lugar a una sala; ahí acepta el dueño.
- **La app no empareja sola.** Lo hacía hasta el 7/10/2026 (le acercaba jugadores a cada sala); `_emparejar` quedó solo para poner al día los pedidos después de cada cambio.
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
| `src/styles.css` | Colores, tipografías y componentes. Las reglas del diseño están en `docs/DISENO.md`. |
| `public/` | Manifest, íconos, service worker de la PWA, y las páginas de Términos y Privacidad (se leen sin entrar a la app). |
| `scripts/recorrido.mjs` | Recorrido automático por los flujos principales de la demostración, con capturas. |
| `scripts/servidor-ensayo.mjs`, `scripts/ensayo.mjs`, `scripts/ensayo-produccion.mjs` | Servidor local y ensayos con varios usuarios a la vez. |
| `scripts/probar-sql.mjs`, `scripts/supabase-local.mjs` | Pruebas de los SQL en una imitación local de Supabase. |
| `scripts/probar-push.mjs`, `scripts/probar-tiktok.mjs`, `scripts/tiktok-falso.mjs` | Pruebas de la parte de servidor de la web: avisos y TikTok (con un TikTok de mentira). |
| `docs/DECISIONES.md` | Decisiones tomadas sobre la especificación y puntos abiertos. |
| `docs/DISENO.md` | El diseño de la app: colores, letras, piezas y reglas para que las pantallas nuevas queden iguales. |
| `docs/TIKTOK_REVISION.md` | Cómo mandar la app de TikTok a revisión: datos, texto para pegar y qué grabar en el video. |

## Qué es real y qué es de muestra

En la web publicada:

- **Real:** ingreso con Discord, perfil y foto, cola, mensajes, grupos, salas, partidos, confirmaciones, reportes, amigos, notificaciones, clips (vinculación con TikTok, videos, reacciones) y los totales de amistosos jugados y asistencia.
- **Real también** (con `supabase/05_puntos.sql`): puntos, nivel, racha, lista de referidos y el nivel de los demás jugadores. Sin ese paso, los puntos se siguen calculando en el celular.
- **Real también** (con `supabase/06_cuenta.sql`): borrar la cuenta, bloqueos y suspensiones. Sin ese paso, bloquear solo oculta al jugador en ese dispositivo.
- **Real también** (con `supabase/07_ficha.sql`): los amistosos jugados en el perfil de otro jugador. Sin ese paso, su perfil muestra solo el nivel.
- **Real también** (con `supabase/08_chat_y_panel.sql` y `03` actualizado): chat general, puntito verde de conectado y panel de administración.
- **Real también** (con `supabase/09_kick.sql` y las claves de Kick en Cloudflare): vincular Kick, la etiqueta al lado del nombre y quién está en vivo.
- **Botón "Apoyá HaxMatch":** aparece en el Perfil cuando se completa `APOYO_URL` en `src/config.ts`.
- **En el dispositivo:** la lista de notificaciones.
- **De muestra:** mientras nadie haya vinculado un TikTok con videos de HaxBall, Clips muestra 6 videos inventados (no se reproducen) para que no quede vacío. Desaparecen cuando hay al menos un clip real.

En modo demostración (`npm run probar`) todo está simulado:

- **Ingreso:** entra siempre como `Jugador_Demo`.
- **Otros jugadores:** 9 usuarios inventados. Mati_ acepta y se suma a tu búsqueda; Tobi_GK busca en grupo con Fede_7 (si acepta, se suman los dos); Pibe9 rechaza los mensajes; la sala de Nico (faltan 2) acepta y confirma; la de Rolo (falta 1) acepta pero nunca confirma, para ver un partido sin contar.
- **Mensaje entrante:** a los 15 segundos de buscar partido te escribe Mati_ (al aceptar te sumás a su búsqueda).
- **Invitación de una sala:** a los 40 segundos de buscar partido te invita una sala con lugar. En la pantalla de espera hay un botón de prueba para que te invite ya, y otro para simular que pasaron los 15 minutos. Si la sala es tuya, invitás vos desde la lista y los jugadores simulados contestan a los 4 segundos.
- **Herramientas de prueba** (Perfil, Mis videos, Referir): avanzar un día, simular un video nuevo, simular amistosos de un referido, reiniciar los datos.

Códigos de amigo de la demostración: `NICO23`, `MATI10`.

## Próximas etapas

1. Revisión de la app de TikTok, para que pueda vincular cualquiera.
2. App de tienda (App Store / Play).
