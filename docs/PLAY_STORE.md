# Subir HaxMatch a Google Play

La app de Google Play es un envoltorio que abre la misma web de HaxMatch a pantalla completa. Lo que se publica en la web aparece solo en la app: no hay que subir una versión nueva por cada cambio.

Datos de la cuenta: personal, creada el 5/1/2026. Por ser personal y posterior al 13/11/2023, Google exige una **prueba cerrada con al menos 12 personas durante 14 días seguidos** antes de dejar publicar ([requisito](https://support.google.com/googleplay/android-developer/answer/14151465)).

Los nombres de los botones de Play Console pueden variar un poco.

## Lo que ya está hecho

- Página pública para pedir el borrado de la cuenta: `https://haxmatch.lauti.workers.dev/borrar-cuenta`.
- Política de privacidad actualizada: `https://haxmatch.lauti.workers.dev/privacidad`.
- Imágenes de la ficha, en `docs/play/`: `icono-512.png`, `portada-1024x500.png` y seis capturas de celular. Se rehacen con `node scripts/capturas-play.mjs docs/play`.

## 1. Generar el paquete de Android

1. Entrar a [pwabuilder.com](https://www.pwabuilder.com), pegar `https://haxmatch.lauti.workers.dev` y tocar **Start**.
2. Tocar **Package for stores** > **Android** > **Google Play**.
3. Completar:

| Campo | Qué poner |
|---|---|
| Package ID | `com.haxmatch.app` |
| App name | `HaxMatch` |
| Launcher name | `HaxMatch` |
| App version | `1.0.0` |
| Version code | `1` |
| Signing key | **New** (que cree una nueva) |

4. Tocar **Download**. Baja un `.zip`.

Adentro del zip:

- El archivo `.aab`: es el que se sube a Google Play.
- `signing.keystore` y `signing-key-info.txt`: **la firma de la app. Guardarlos en un lugar seguro y no pasárselos a nadie.** Sin ellos no se puede volver a subir una versión nueva del paquete.
- `assetlinks.json`: es público. Hay que pasarle su contenido a Claude para publicarlo en la web (paso 2).

El **Package ID no se puede cambiar nunca más** una vez subida la app.

## 2. Vincular la web con la app

La web tiene que publicar un archivo que dice "esta app es mía". Mientras no esté, la app funciona pero muestra una barra con la dirección arriba.

Hacen falta dos huellas (renglones que empiezan con `SHA256` o tienen forma `AB:CD:12:…`):

1. La del archivo `assetlinks.json` del zip.
2. La que genera Google: después de subir el paquete (paso 5), en Play Console > **Probar y publicar** > **Integridad de la app** (o **Configuración** > **Firma de apps**) > "Certificado de la clave de firma de la app" > **Huella digital del certificado SHA-256**.

Las dos son públicas: se pueden pegar en el chat. Con eso se arma `public/.well-known/assetlinks.json`.

## 3. Crear la app en Play Console

**Crear app**:

| Campo | Qué poner |
|---|---|
| Nombre | `HaxMatch` |
| Idioma predeterminado | Español (Latinoamérica) |
| App o juego | App |
| Gratis o de pago | Gratis |

## 4. Ficha de Play Store

| Campo | Qué poner |
|---|---|
| Nombre de la app | `HaxMatch` |
| Descripción breve (78 de 80) | `Amistosos de HaxBall al toque: entrá a la cola y las salas te invitan a jugar.` |
| Ícono | `docs/play/icono-512.png` |
| Gráfico de funciones | `docs/play/portada-1024x500.png` |
| Capturas de teléfono | Las seis de `docs/play/`, en orden (1 a 6) |
| Categoría | Entretenimiento |
| Email de contacto | `lpatriciogauna@outlook.com` |
| Sitio web | `https://haxmatch.lauti.workers.dev` |

Descripción completa (1368 de 4000):

```
HaxMatch es la forma más rápida de armar un amistoso de HaxBall.

¿Querés jugar? Un toque y entrás a la cola. Las salas que necesitan jugadores te ven en la lista y te invitan. Aceptás, entrás a la sala y listo.

¿Tenés una sala y te falta gente? Decí cuántos te faltan, qué posición y en qué cancha. Vas a ver quiénes están buscando partido y elegís a quién invitar.

QUÉ PODÉS HACER
• Entrar a la cola de un toque, sin formularios.
• Abrir tu sala e invitar jugadores de la lista.
• Buscar con amigos: se suman a tu búsqueda y entran juntos.
• Recibir avisos cuando te invitan o cuando un amigo se pone a buscar.
• Agregar amigos y ver quiénes están buscando ahora.
• Sumar puntos y subir de nivel por cada amistoso jugado.
• Mirar clips de la comunidad y compartir los tuyos vinculando tu cuenta de TikTok.

CÓMO FUNCIONA
1. Entrás con tu cuenta de Discord.
2. Elegís "Quiero jugar un amistoso" o "Necesito un jugador".
3. Cuando hay partido, la app te muestra el nombre de la sala para buscarla en HaxBall.
4. Jugás, confirmás el amistoso y sumás puntos.

JUGÁ TRANQUILO
Podés reportar o bloquear a cualquier jugador desde su perfil, y borrar tu cuenta cuando quieras.

HaxMatch es un proyecto independiente de la comunidad. No está afiliado a HaxBall, Discord ni TikTok. El juego se juega en HaxBall, desde la computadora; HaxMatch sirve para encontrar con quién.
```

## 5. Formularios ("Contenido de la app")

| Formulario | Respuesta |
|---|---|
| Política de privacidad | `https://haxmatch.lauti.workers.dev/privacidad` |
| Anuncios | No contiene anuncios |
| Acceso a la app | Todas las funciones requieren iniciar sesión. Ver abajo |
| Público objetivo | 13 a 15, 16 a 17 y mayores de 18. Ninguna franja de menos de 13 |
| App de noticias | No |
| ID de publicidad | No usa |
| App gubernamental, financiera o de salud | No |

**Acceso a la app.** Google necesita poder entrar para revisarla, y HaxMatch solo deja entrar con Discord. Hay que crear una cuenta de Discord solo para esto (con el email verificado y sin verificación en dos pasos) y cargar su usuario y contraseña en ese formulario. Instrucciones para pegar ahí:

```
Tap "Entrar con Discord" and sign in with the Discord account provided. On first login, tap "Empezar". The app is in Spanish. Main features: "Quiero jugar un amistoso" (join the queue) and "Necesito un jugador" (open a room and invite players).
```

**Clasificación del contenido** (cuestionario):

- Categoría: la opción general ("Todos los demás tipos de apps"), no "Juego" ni "Red social".
- Violencia, contenido sexual, lenguaje ofensivo, drogas, apuestas: No.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí** (nick, foto de perfil, nombre de la sala y mensajes).
- ¿Se puede bloquear y reportar usuarios? **Sí**.
- ¿Comparte la ubicación de los usuarios? No.
- ¿Permite compras? No.

**Seguridad de los datos:**

- ¿La app recopila o comparte datos? Sí, recopila. No comparte con terceros (Supabase y Cloudflare son proveedores que trabajan para la app).
- ¿Los datos viajan cifrados? Sí.
- ¿Se puede pedir que se borren? Sí: `https://haxmatch.lauti.workers.dev/borrar-cuenta`

| Tipo de dato | ¿Obligatorio? | Para qué |
|---|---|---|
| Nombre (nick y usuario de Discord) | Sí | Funciones de la app, administración de la cuenta |
| Dirección de email (la de Discord) | Sí | Administración de la cuenta |
| IDs de usuario (identificador de Discord) | Sí | Funciones de la app, administración de la cuenta |
| Fotos (foto de perfil) | Opcional | Funciones de la app |
| Otros mensajes dentro de la app | Sí | Funciones de la app |
| Interacciones con la app (búsquedas, partidos, reacciones) | Sí | Funciones de la app |
| Otro contenido generado por el usuario (nombre de la sala, reportes) | Opcional | Funciones de la app |
| ID del dispositivo u otros (la suscripción de los avisos) | Opcional | Funciones de la app |

Para todos: se recopilan, no se comparten y no se usan para publicidad.

## 6. La prueba cerrada

1. **Probar y publicar** > **Pruebas** > **Prueba cerrada** > crear un segmento (o usar "Alpha").
2. **Verificadores**: crear una lista de emails con las cuentas de Google de quienes van a probar. Hacen falta 12 como mínimo; conviene juntar 15 o más, por si alguno se baja.
3. **Países**: elegir todos, o al menos Argentina, Uruguay, Chile y Brasil.
4. **Crear versión**: subir el `.aab`. En "Notas de la versión": `Primera versión de HaxMatch.`
5. Enviar a revisión. Cuando Google la apruebe, copiar el **enlace para unirse** y mandárselo a los de la lista.
6. Cada uno tiene que abrir el enlace con su cuenta de Google, aceptar ser verificador e instalar la app desde Play Store.

Los 14 días cuentan desde que hay 12 personas anotadas, y tienen que seguir anotadas los 14 días seguidos. Si una se baja y vuelve a entrar, su cuenta empieza de cero.

## 7. Pedir la publicación

Pasados los 14 días, en el **Panel** aparece **Solicitar acceso a producción**. Google hace preguntas sobre la prueba (cuánta gente probó, qué comentarios hubo, qué se cambió). Las respuestas se arman en ese momento, con lo que haya pasado.

Después: **Producción** > **Crear versión** > usar el mismo paquete > enviar. La revisión suele tardar unos días.

## Si Play Console rechaza el paquete

- **"Tiene que apuntar a Android 16 (nivel de API 36)"**: es el mínimo desde el 31/8/2026 ([requisito](https://developer.android.com/google/play/requirements/target-sdk)). Volver a generar el paquete en PWABuilder; si sigue igual, hay que armarlo de otra forma.
- **Cualquier otro mensaje**: copiar el texto tal cual.

## Más adelante

- **Cambios en la app:** se publican en la web y aparecen solos. Solo hace falta subir un paquete nuevo si cambia el nombre, el ícono o la dirección.
- **Dominio propio:** no hace falta dar de baja la app. Se publica el archivo de vinculación en el dominio nuevo y se sube un paquete que apunte ahí. El costo es para los usuarios: tienen que volver a entrar y a activar los avisos. Además hay que actualizar la dirección en Discord, Supabase y TikTok.
- **Pasar la app a otra cuenta de Google Play:** se puede pedir la transferencia desde la consola.
