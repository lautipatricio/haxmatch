# HaxMatch

App para armar amistosos de HaxBall desde el celular. PWA en React.

**Estado: prototipo navegable.** Todas las pantallas y las reglas de producto funcionan, pero con datos de prueba: el ingreso con Discord, los demás jugadores, TikTok y las notificaciones están simulados. Todavía no hay backend.

## Cómo correrla

Necesitás Node 20 o más nuevo.

```
npm install
npm run dev        # abre la app en http://localhost:5173
npm test           # tests de las reglas (puntos, niveles, validación)
npm run build      # versión para publicar, en dist/
```

Para verla en el celular en la misma red wifi: `npm run dev -- --host` y abrí la dirección que muestra.

## Publicación

La web se publica con Cloudflare Pages, conectado a este repositorio: cada cambio en la rama `main` se publica solo.

| Ajuste en Cloudflare Pages | Valor |
|---|---|
| Framework preset | Vite (o "None") |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | 22 (lo toma de `.nvmrc`) |

`public/_redirects` hace que cualquier dirección abra la app (necesario para que funcionen los links internos).

## Cómo está armada

| Carpeta | Qué tiene |
|---|---|
| `src/domain/` | Tipos y **reglas de producto** como funciones puras, con tests. Es lo que el backend tiene que replicar. |
| `src/data/store.ts` | Estado de la app y acciones (crear búsqueda, confirmar match, reaccionar…). Hoy trabaja en memoria. Es la única capa que cambia al conectar Supabase. |
| `src/data/seed.ts` | Datos de prueba y comportamiento de los jugadores simulados. |
| `src/screens/` | Una pantalla por archivo. |
| `src/ui/` | Piezas compartidas: botones, chips, barra inferior, carteles, avisos. |
| `src/styles.css` | Colores, tipografías y componentes de la sección 8 de la especificación. |
| `public/` | Manifest, íconos y service worker de la PWA. |
| `scripts/recorrido.mjs` | Recorrido automático por los flujos principales, con capturas. |
| `docs/DECISIONES.md` | Decisiones tomadas sobre la especificación y puntos abiertos. |

## Qué está simulado

- **Ingreso con Discord:** entra siempre como `Jugador_Demo`.
- **Otros jugadores:** 9 usuarios inventados. Mati_ acepta y se suma a tu búsqueda; Tobi_GK busca en grupo con Fede_7 (si acepta, se suman los dos); Pibe9 rechaza los mensajes; la sala de Nico (faltan 2) acepta y confirma; la de Rolo (falta 1) acepta pero nunca confirma, para ver un partido sin contar.
- **Mensaje entrante:** a los 15 segundos de buscar partido te escribe Mati_ (al aceptar te sumás a su búsqueda).
- **Emparejamiento automático:** si tenés sala, la app te acerca gente a los 8 segundos y después cada 12. Si buscás partido, te conecta sola con una sala a los 45 segundos (la demo espera para que puedas probar los mensajes). En la pantalla de espera hay un botón de prueba para dispararlo ya, y otro para simular que pasaron los 15 minutos.
- **TikTok:** "Vincular" importa 4 videos de ejemplo. Los videos no se reproducen.
- **Notificaciones push:** se muestran como avisos dentro de la app.
- **Herramientas de prueba** (Perfil, Mis videos, Referir): avanzar un día, simular un video nuevo, simular amistosos de un referido, reiniciar los datos.

Códigos de amigo de prueba para "Registrarme con el código de un amigo": `NICO23`, `MATI10`.

## Próximas etapas

1. Supabase: tablas de la sección 4, ingreso con Discord y reglas en funciones de base de datos.
2. Reemplazar `src/data/store.ts` por llamadas a Supabase con tiempo real para la cola.
3. Web Push con VAPID.
4. TikTok Login Kit (requiere revisión de TikTok).
