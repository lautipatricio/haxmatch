# HaxMatch

App para armar amistosos de HaxBall desde el celular. PWA en React.

**Estado: cuenta, cola y partidos reales.** El ingreso con Discord, el perfil, la cola, los mensajes, los grupos, las salas y los partidos funcionan entre usuarios de verdad, con el servidor (Supabase) aplicando las reglas. Los puntos y niveles todavía se calculan en cada dispositivo, y los clips, los amigos y los referidos siguen de muestra.

Publicada en https://haxmatch.lauti.workers.dev

## Cómo correrla

Necesitás Node 20 o más nuevo.

```
npm install
npm run dev        # abre la app en http://localhost:5173, con el servidor real
npm test           # tests de las reglas (puntos, niveles, validación)
npm run test:sql   # prueba los SQL de supabase/ en una base local (141 comprobaciones)
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

`npm run ensayo` hace eso solo: abre varios "celulares" y recorre salas, pedidos, grupos, equipo completo, los 15 minutos, reportes y cierre de sesión.

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

`wrangler.jsonc` le dice a Cloudflare que publique la carpeta `dist/` y que cualquier dirección abra la app.

## Servidor (Supabase)

- Los datos del proyecto están en `.env.production` y `.env.development`. Son públicos: la dirección y la clave "publishable". **Nunca** van ahí la clave `sb_secret_`, la contraseña de la base ni el Client Secret de Discord.
- Los SQL de `supabase/` se pegan en Supabase > SQL Editor, en orden. Se pueden ejecutar más de una vez.
- Sin esos datos (`npm run probar`), la app funciona en modo demostración: ingreso simulado y todo guardado en el dispositivo.

| Archivo | Qué crea |
|---|---|
| `supabase/01_perfiles.sql` | Tabla de perfiles con sus permisos, alta automática al entrar con Discord, registro (nick y región), código de un amigo y la carpeta de fotos de perfil |
| `supabase/02_cola.sql` | La cola: búsquedas, mensajes, grupos, salas con cupos, partidos, confirmaciones y reportes. La app no toca las tablas: todo pasa por funciones que aplican las reglas. Incluye la señal de tiempo real |

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
| `src/data/seed.ts` | Datos de muestra y comportamiento de los jugadores simulados de la demostración. |
| `supabase/` | SQL de la base de datos. |
| `src/screens/` | Una pantalla por archivo. |
| `src/ui/` | Piezas compartidas: botones, chips, barra inferior, carteles, avisos. |
| `src/styles.css` | Colores, tipografías y componentes de la sección 8 de la especificación. |
| `public/` | Manifest, íconos y service worker de la PWA. |
| `scripts/recorrido.mjs` | Recorrido automático por los flujos principales de la demostración, con capturas. |
| `scripts/servidor-ensayo.mjs`, `scripts/ensayo.mjs`, `scripts/ensayo-produccion.mjs` | Servidor local y ensayos con varios usuarios a la vez. |
| `scripts/probar-sql.mjs`, `scripts/supabase-local.mjs` | Pruebas de los SQL en una imitación local de Supabase. |
| `docs/DECISIONES.md` | Decisiones tomadas sobre la especificación y puntos abiertos. |

## Qué es real y qué es de muestra

En la web publicada:

- **Real:** ingreso con Discord, perfil y foto, cola, mensajes, grupos, salas, partidos, confirmaciones, reportes, y los totales de amistosos jugados y asistencia.
- **En el dispositivo:** puntos, nivel y racha (se calculan en el celular con los partidos que confirma el servidor). Bloquear a un jugador también: lo oculta en ese dispositivo.
- **De muestra:** clips (6 videos inventados, no se reproducen) y la vinculación con TikTok.
- **Todavía no:** amigos, notificaciones push, lista de referidos y nivel de los demás jugadores.

En modo demostración (`npm run probar`) todo está simulado:

- **Ingreso:** entra siempre como `Jugador_Demo`.
- **Otros jugadores:** 9 usuarios inventados. Mati_ acepta y se suma a tu búsqueda; Tobi_GK busca en grupo con Fede_7 (si acepta, se suman los dos); Pibe9 rechaza los mensajes; la sala de Nico (faltan 2) acepta y confirma; la de Rolo (falta 1) acepta pero nunca confirma, para ver un partido sin contar.
- **Mensaje entrante:** a los 15 segundos de buscar partido te escribe Mati_ (al aceptar te sumás a su búsqueda).
- **Emparejamiento automático:** si tenés sala, la app te acerca gente a los 8 segundos y después cada 12. Si buscás partido, te conecta sola con una sala a los 45 segundos. En la pantalla de espera hay un botón de prueba para dispararlo ya, y otro para simular que pasaron los 15 minutos.
- **Herramientas de prueba** (Perfil, Mis videos, Referir): avanzar un día, simular un video nuevo, simular amistosos de un referido, reiniciar los datos.

Códigos de amigo de la demostración: `NICO23`, `MATI10`.

## Próximas etapas

1. Amigos y notificaciones (Web Push con VAPID).
2. Puntos, niveles y referidos en el servidor.
3. Clips de TikTok (requiere revisión de TikTok).
