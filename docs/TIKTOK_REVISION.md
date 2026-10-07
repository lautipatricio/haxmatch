# Mandar la app de TikTok a revisión

Mientras la app de TikTok esté en *Sandbox*, solo pueden vincular las cuentas anotadas como "Target users". Cuando TikTok la aprueba, puede vincular cualquiera.

Qué pide TikTok (según sus [guías de revisión](https://developers.tiktok.com/docs/en/app-review-guidelines), leídas el 7/10/2026):

- Un sitio web de verdad, que explique qué es la app. No sirve una pantalla que sea solo un ingreso. Los enlaces a Términos y Privacidad tienen que verse sin abrir ningún menú.
- Nombre, ícono y descripción de la app. El nombre no puede mencionar a TikTok.
- Solo los productos y permisos que la app usa. Los que sobran demoran la revisión.
- Una explicación de para qué se usa cada producto y cada permiso.
- Al menos un video que muestre el recorrido completo, grabado sobre el *Sandbox*. Hasta 5 videos de 50 MB cada uno. El dominio que se ve en el video tiene que ser el del sitio declarado.
- No aprueban apps de uso personal ni en etapa de pruebas.

La revisión tarda entre unos días y dos semanas.

## 1. Lo que ya está hecho en la app

- La dirección `https://haxmatch.lauti.workers.dev`, sin entrar, muestra qué es HaxMatch, cómo funciona y qué hace con TikTok, con los enlaces a Términos, Privacidad y Contacto.
- `/terminos` y `/privacidad` se leen sin entrar.
- La app pide solo `user.info.basic` y `video.list`.

## 2. Completar los datos en TikTok for Developers

En [developers.tiktok.com](https://developers.tiktok.com) > Manage apps > la app > pestaña **Production** (no Sandbox). Los nombres de los campos pueden variar un poco.

| Campo | Qué poner |
|---|---|
| App icon | `haxmatch-icono-1024.png` (1024 × 1024) |
| App name | `HaxMatch` |
| Category | Gaming (o la más parecida) |
| Description | `HaxMatch helps HaxBall players find friendly matches and watch community clips.` |
| Terms of Service URL | `https://haxmatch.lauti.workers.dev/terminos` |
| Privacy Policy URL | `https://haxmatch.lauti.workers.dev/privacidad` |
| Platforms | Web |
| Website URL | `https://haxmatch.lauti.workers.dev` |
| Products | **Login Kit**, con Redirect URI `https://haxmatch.lauti.workers.dev/api/tiktok/volver` |
| Scopes | `user.info.basic` y `video.list`. Ninguno más |

Si quedó agregado algún otro producto (Share Kit, Content Posting API, Webhooks…), sacarlo.

## 3. La explicación (se pega en "App review")

El campo acepta hasta 1000 caracteres; este texto tiene 981.

```
HaxMatch (https://haxmatch.lauti.workers.dev) is a free web app for the HaxBall gaming community: players sign in with Discord, find friendly matches and watch community clips.

Login Kit: lets a signed-in user link their own TikTok account (Clips > Mis videos > Vincular TikTok). Sign-in to HaxMatch itself uses Discord.

user.info.basic: we read the display name to show which TikTok account is linked ("TikTok vinculado: name") and the open_id to identify it.

video.list: we read the user's public videos (id, description, duration, date, share URL, cover). The user sees them in "Mis videos"; those tagged #haxball or #haxmatch appear in the "Clips" feed, each with a switch to hide it. Videos play from TikTok's embedded player. We never download, store or post anything.

Users can unlink anytime: we delete tokens and the video list and revoke access.

The demo video (sandbox) shows the home page, sign-in, linking, account name, video list, a clip playing, and unlinking.
```

## 4. Grabar el video

Preparación:

- Hacerlo en la computadora, con el navegador en una ventana donde **se vea la barra de direcciones**.
- Usar una cuenta de TikTok que esté como "Target user" del Sandbox y tenga al menos un video público con `#haxball` o `#haxmatch`.
- Antes de grabar: cerrar sesión en HaxMatch y, si esa cuenta de TikTok ya estaba vinculada, desvincularla (Clips > Mis videos > Desvincular TikTok).

Qué grabar, en este orden y sin apuro:

1. Abrir `https://haxmatch.lauti.workers.dev`. Bajar despacio hasta el final, para que se vea la explicación y los enlaces a Términos y Privacidad. Volver arriba.
2. Tocar "Entrar con Discord" y entrar.
3. Ir a **Clips** > **Vincular TikTok** (o "Mis videos") > botón **Vincular TikTok**.
4. En la página de TikTok, dejar un par de segundos a la vista los permisos que pide y autorizar.
5. De vuelta en HaxMatch: dejar a la vista "TikTok vinculado: (nombre)" y la lista de videos. Apagar y prender el interruptor de uno.
6. Ir a **Clips** y dejar que se reproduzca el clip unos segundos.
7. Ir a **Perfil** para mostrar "Tus clips".
8. Volver a Clips > Mis videos > **Desvincular TikTok** > confirmar.

Cómo grabar la pantalla:

- **Windows:** abrir "Recortes" (Snipping Tool) > ícono de la cámara de video > Nuevo > marcar la ventana del navegador > Iniciar. Al terminar, Guardar.
- **Mac:** `Cmd + Shift + 5` > "Grabar parte seleccionada" > marcar la ventana > Grabar. Se corta desde la barra de arriba.

Tiene que pesar menos de 50 MB. Dos minutos alcanzan. Si pesa más, se puede achicar.

## 5. Enviar

Subir el video, pegar la explicación y tocar **Submit for review**.

## 6. Cuando la aprueben

TikTok da para la app aprobada un **Client key** y un **Client secret** distintos de los del Sandbox.

1. En Cloudflare, reemplazar los secretos `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET` por los de Production y volver a publicar.
2. Los que habían vinculado su cuenta en el Sandbox tienen que desvincular y volver a vincular.
3. Probar con una cuenta de TikTok que no estuviera en la lista de "Target users".

## Si la rechazan

El motivo aparece en la página de la app, en **History > Review comments**. Lo más común: que el sitio parezca solo un ingreso, que el video no muestre algún permiso, o que haya productos de más.
