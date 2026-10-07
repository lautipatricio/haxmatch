# HaxMatch

App para armar amistosos de HaxBall desde el celular. PWA en React.

**Estado: cuenta real, resto de prueba.** El ingreso con Discord, el perfil (nick, región, foto) y el código de referido ya se guardan en el servidor (Supabase). La cola, los matches, los amigos, los puntos y los clips siguen funcionando con datos de prueba en cada dispositivo.

Publicada en https://haxmatch.lauti.workers.dev

## Cómo correrla

Necesitás Node 20 o más nuevo.

```
npm install
npm run dev        # abre la app en http://localhost:5173, con el servidor real
npm test           # tests de las reglas (puntos, niveles, validación)
npm run test:sql   # prueba los SQL de supabase/ en una base local
npm run build      # versión para publicar, en dist/
npm run probar     # versión de demostración, sin servidor, en http://localhost:4173
```

Con `npm run probar` abierto, `node scripts/recorrido.mjs` recorre solo los flujos principales.

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

## Cómo está armada

| Carpeta | Qué tiene |
|---|---|
| `src/domain/` | Tipos y **reglas de producto** como funciones puras, con tests. Es lo que el backend tiene que replicar. |
| `src/data/store.ts` | Estado de la app y acciones (crear búsqueda, confirmar match, reaccionar…). Hoy trabaja en memoria. Es la única capa que cambia al conectar Supabase. |
| `src/data/seed.ts` | Datos de prueba y comportamiento de los jugadores simulados. |
| `src/data/supabase.ts`, `src/data/cuenta.ts` | Conexión con Supabase: sesión con Discord, perfil y foto. |
| `supabase/` | SQL de la base de datos. |
| `src/screens/` | Una pantalla por archivo. |
| `src/ui/` | Piezas compartidas: botones, chips, barra inferior, carteles, avisos. |
| `src/styles.css` | Colores, tipografías y componentes de la sección 8 de la especificación. |
| `public/` | Manifest, íconos y service worker de la PWA. |
| `scripts/recorrido.mjs` | Recorrido automático por los flujos principales, con capturas. |
| `docs/DECISIONES.md` | Decisiones tomadas sobre la especificación y puntos abiertos. |

## Qué está simulado

- **Ingreso con Discord:** es real en la web publicada. En modo demostración entra siempre como `Jugador_Demo`.
- **Otros jugadores:** 9 usuarios inventados. Mati_ acepta y se suma a tu búsqueda; Tobi_GK busca en grupo con Fede_7 (si acepta, se suman los dos); Pibe9 rechaza los mensajes; la sala de Nico (faltan 2) acepta y confirma; la de Rolo (falta 1) acepta pero nunca confirma, para ver un partido sin contar.
- **Mensaje entrante:** a los 15 segundos de buscar partido te escribe Mati_ (al aceptar te sumás a su búsqueda).
- **Emparejamiento automático:** si tenés sala, la app te acerca gente a los 8 segundos y después cada 12. Si buscás partido, te conecta sola con una sala a los 45 segundos (la demo espera para que puedas probar los mensajes). En la pantalla de espera hay un botón de prueba para dispararlo ya, y otro para simular que pasaron los 15 minutos.
- **TikTok:** "Vincular" importa 4 videos de ejemplo. Los videos no se reproducen.
- **Notificaciones push:** se muestran como avisos dentro de la app.
- **Herramientas de prueba** (Perfil, Mis videos, Referir): avanzar un día, simular un video nuevo, simular amistosos de un referido, reiniciar los datos.

Códigos de amigo de prueba para "Registrarme con el código de un amigo": `NICO23`, `MATI10`.

## Próximas etapas

1. Cola y matches reales entre usuarios, con tiempo real.
2. Amigos y notificaciones (Web Push con VAPID).
3. Puntos, niveles y referidos en el servidor.
4. Clips de TikTok (requiere revisión de TikTok).
