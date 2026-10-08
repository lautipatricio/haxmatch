# Decisiones sobre la especificación v1

## Diferencias entre el documento y los mockups (resueltas el 6/10/2026)

| Tema | Decisión | Cómo quedó |
|---|---|---|
| Duración de la disponibilidad | Mockup | 15 min o hasta match |
| Región | Mockup, después cambiada | Ver "Ajustes del 6/10 (segunda ronda)" |
| Modo sala | Mockup, después ajustado | Sin modalidad. Nombre, cuántos faltan, posición, cancha, región |
| Textos del Inicio | Documento | "Quiero jugar un amistoso", "Necesito un jugador", "Ver clips", sin subtítulos |
| Pantalla Nivel | Documento | "Qué suma" muestra las 6 acciones de la tabla de puntos, con sus topes |
| Perfil | Mockup | Amistosos jugados, asistencia, "Con quién más jugaste", "Equipo al que más enfrentaste" |
| Clips | Documento | Solo videos de TikTok. Sin "Subir clip" ni "Ver partido completo" |
| Notificaciones | Documento | Sin rango de nivel en los avisos |
| "Mandar sala por Discord" y "Abrir HaxBall" | Se eliminan | El creador solo carga el nombre de la sala. HaxBall se juega en la computadora, así que no hay botón para abrirlo |
| Partidos pendientes | Dentro del Perfil | Tarjeta "Por confirmar" arriba, como un aviso pendiente |

## Cambios pedidos después de la primera versión (6/10/2026)

| Tema | Cómo quedó |
|---|---|
| Opciones de los formularios | Se pueden marcar varias en Formato, Posición, Cancha y Región. "Cualquiera" es excluyente. "Disponible por" y "Cuántos faltan" siguen siendo de una sola opción |
| Clips | Un video por pantalla, a pantalla completa. Se pasa al siguiente deslizando, como TikTok |
| Confirmación de quien crea la sala | El botón dice "Ya entró X a la sala" y el cartel "No te olvides" habla del jugador que se une. Quien se une sigue viendo "Ya entré a la sala" |

Con varias opciones marcadas, el match se arma con la primera opción que les sirve a los dos (por ejemplo, formato 2v2 si uno marcó 2v2 y 3v3 y el otro 1v1 y 2v2).

## Ajustes del 6/10 (segunda ronda)

| Tema | Cómo quedó |
|---|---|
| Región del perfil | En el registro se pueden marcar varias. Los formularios arrancan con esas regiones marcadas |
| Posición | No se pide en el registro. Se elige en cada búsqueda ("Quiero jugar de" o "Posición que buscás") |
| Código de un amigo | Se carga antes del registro, en la pantalla de ingreso ("Registrarme con el código de un amigo"). Tiene que ser válido para avanzar. El registro ya no lo pide. Un link de referido abre esa pantalla con el código cargado |
| Nick | En el onboarding, arriba de todo, opcional. Si queda vacío se usa el usuario de Discord. Entre 2 y 20 caracteres |
| Posiciones | Polifuncional, GK, LD, DFC, LI, MC, ED, EI, DC. "Polifuncional" reemplaza a "Cualquiera" |
| Regiones | ARG, CHI, BR, UY |
| Canchas | Se agrega Real Soccer |
| Textos de los formularios | "Modalidad" en lugar de "Formato" y "Quiero jugar de" en lugar de "Mi posición" |
| Cuántos faltan | 1 a 7, sin "Más" |
| Inicio | Se agregan "Ver perfil" y "Cerrar sesión" (con el rediseño del 7/10 pasaron a la barra inferior y al Perfil) |
| Cola | Dos listas: "Jugadores buscando partidos" y "Salas buscando jugadores" |
| Jugador que acepta mi mensaje | Se suma a mi búsqueda y a mi reloj. No hay match todavía: seguimos buscando juntos |
| Sala que acepta mi mensaje | Se genera el match, aunque la sala no coincida con lo que buscaba. Si busco en grupo, entra el grupo completo |
| Unirse a una sala | Ya no es directo: se manda mensaje y la sala acepta |

## Emparejamiento y salas con cupos (tercera ronda, 6/10/2026)

| Tema | Cómo quedó |
|---|---|
| Match automático | *(Se sacó el 7/10/2026: ahora la sala invita. Ver más abajo.)* La app conecta sola, sin mensajes. A una sala le acerca primero un grupo que sea justo los que le faltan, después jugadores sueltos y después grupos más chicos. A quien busca partido lo mete en una sala donde entre (solo o con su grupo), y prefiere la que le faltan justo los que son |
| Mensajes | Siguen funcionando igual, además del emparejamiento automático |
| Grupo que completa un equipo | Tres jugadores buscando 3v3 ya son un equipo: quien armó el grupo crea la sala, carga el nombre, y pasan a figurar como sala a la que le faltan 3. En 1v1 el "equipo completo" son los dos jugadores y no se busca a nadie más |
| A los 15 minutos | Cartel con: renovar la búsqueda, jugar entre los del grupo (1v1, 1v1v1), crear una sala y seguir buscando, o dejar de buscar. Si nadie responde en 2 minutos, la búsqueda vence |
| Sala que sigue buscando | La búsqueda de la sala no se cierra con el primer jugador: sigue hasta completar los lugares |
| Cuando entra alguien a mi sala | Primer cartel: aceptar o rechazar. Segundo cartel: "Ya entró X a la sala". Después queda el botón "Se salió", que libera el lugar y la sala vuelve a buscar |
| Un partido por sala | Todos los que entran a una misma sala quedan en un solo partido |
| Sala completa | Al llenarse, el reloj queda quieto y ya no se busca a nadie. Cuando el dueño marcó que entraron todos, la búsqueda se cierra sola y aparece "Match listo". Desde ahí sigue estando "Se salió": libera el lugar, la sala vuelve a buscar y el reloj sigue desde donde había quedado |

Qué decidí yo en esta ronda:
- **Compatibilidad para el match automático:** comparten región y cancha ("Cualquiera" acepta todas). No se mira la posición ni la modalidad (las salas no tienen modalidad).
- **Con varias modalidades marcadas** se toma la más chica para saber cuándo el equipo está completo (2v2 y 3v3 marcados: con 2 jugadores ya se arma la sala). Con "Cualquiera" el grupo nunca se completa solo.
- **El emparejamiento automático no pide confirmación a quien busca partido:** aparece directo "Match listo". Del lado de la sala, el dueño siempre acepta o rechaza.
- **Si yo invito a un jugador a mi sala y acepta,** ocupa su lugar sin pasar por el cartel de aceptar (ya lo elegí yo).
- **Un jugador rechazado no se vuelve a acercar** a esa sala.
- **El cartel de los 15 minutos** aparece solo si se eligió "15 min". Con "Hasta match" la búsqueda no tiene límite.
- **Lados para la confirmación:** A es quien creó la sala y el grupo con el que la armó; B son los que entran después. El partido cuenta cuando confirma uno de cada lado: el dueño confirma al tocar "Ya entró X" y el que entra al tocar "Ya entré a la sala". Por eso un equipo completo que arma sala recién suma cuando entra y confirma algún rival. En "jugar entre nosotros" los del grupo son el lado B.
- **"Se salió" después de que el partido ya contó** no le saca el partido a nadie. Si se van todos antes de que cuente, no queda partido.
- **"Cancelar búsqueda" pasa a ser "Cerrar sala"** cuando ya entró alguien.
- **Reportar** a quien entró a mi sala se hace desde la lista "En tu sala".

## Foto de perfil (6/10/2026)

- Se elige desde el Perfil, tocando el recuadro de la foto. Abre la galería del celular (no la cámara).
- Después de elegirla se abre "Ajustar foto": se arrastra para moverla y se hace zoom (con el control, pellizcando o con la rueda), hasta 4 veces. El recuadro muestra cómo va a quedar.
- Todas se guardan cuadradas y del mismo tamaño (256 px), así se ven parejas en toda la app.
- Se puede quitar, y vuelve a mostrarse la inicial.
- En esta versión de prueba se guarda en el dispositivo. Con backend va a Supabase Storage.
- Pendiente para publicar: las fotos son contenido de los usuarios, así que el reporte de jugadores tiene que cubrir "foto inapropiada" y el equipo tiene que poder quitarlas (lo pide la App Store).

## Cuenta real (6/10/2026)

- El ingreso con Discord, el perfil y la foto pasan a guardarse en Supabase. El resto de la app sigue con datos de prueba en cada dispositivo hasta las próximas etapas.
- El perfil se crea solo la primera vez que alguien entra, con su usuario de Discord y un código de referido propio (HX + 4 caracteres).
- El nick sugerido es el nombre visible de Discord. El usuario de Discord se guarda aparte, para que después lo puedan agregar como amigo.
- El código de un amigo se valida antes de ir a Discord y queda anotado al terminar el registro. Solo vale para cuentas nuevas, no se puede usar el propio y después no se puede cambiar.
- Un código empieza a valer cuando su dueño terminó el registro.
- Todos los usuarios que entraron pueden ver el nick, la región, la foto y el usuario de Discord de los demás. Quién invitó a quién no es visible.
- Las fotos van a una carpeta pública, una por usuario. Solo JPEG, hasta 1 MB.

## Cerrar sesión (6/10/2026)

- Pide confirmación antes de cerrar.
- En el Inicio el botón es angosto y va centrado. Antes ocupaba todo el ancho, justo donde en las otras pantallas está la pestaña "Inicio": al tocarla dos veces seguidas, el segundo toque cerraba la sesión. (Con el rediseño del 7/10 el Inicio tiene la barra inferior y el botón quedó solo en el Perfil.)

## Cola real entre usuarios (6/10/2026)

La cola, los mensajes, los grupos, las salas y los partidos pasan al servidor. Los jugadores inventados desaparecen de la web publicada. Decisiones que tomé al pasarlo a usuarios de verdad:

- **Las reglas las aplica el servidor,** no la app: una sola búsqueda activa, cupos de la sala, quién puede aceptar a quién y cuándo cuenta un partido. Desde la app no se pueden tocar los datos directamente.
- *(Desde el 7/10/2026 la app ya no empareja sola: ver "Entrar a la cola de un toque y salas que invitan", más abajo.)*
- **Emparejamiento automático:** a cada sala con lugares libres la app le acerca un jugador o un grupo para que el dueño acepte o rechace (primero el grupo que es justo los que faltan, después jugadores sueltos, después grupos más chicos). Corre cada vez que alguien busca, cancela, acepta o rechaza.
- **El jugador no ve ese pedido.** Cuando la app lo acerca a una sala, solo se entera el dueño. Si lo aceptan, le aparece "Match listo". Si lo rechazan, sigue buscando y no se entera.
- **Un mismo jugador puede quedar propuesto a varias salas a la vez.** Entra a la primera que lo acepta y los otros pedidos se caen. Así nadie queda trabado esperando a un dueño que no contesta.
- **Un equipo completo también le sirve a una sala.** Si tres buscan 3v3 y hay una sala a la que le faltan justo 3, la app se los acerca. El cartel "Equipo completo" sigue apareciendo para crear la sala propia, y ahora tiene "Ahora no, seguir buscando una sala".
- **Los pedidos se mantienen al día.** Si quien escribió a una sala suma gente a su grupo, el pedido se actualiza ("¿Entramos 2 a tu sala?"). Si ya no entran todos, o alguna de las dos partes dejó de buscar, se cae solo. Así ninguna sala queda trabada con un pedido viejo.
- **Hay que estar buscando para escribir.** Sin una búsqueda propia no se le puede mandar mensaje a nadie. Y hasta 10 mensajes sin responder a la vez.
- **Nadie ocupa dos lugares en la misma sala.** Si alguien que ya entró vuelve a buscar, la app no se lo acerca de nuevo a esa sala.
- **En un grupo, los mensajes los manda quien lo armó.** Los que se sumaron ven la cola pero no pueden escribirle a nadie, y su botón dice "Salir del grupo".
- **Si quien armó el grupo deja de buscar,** los demás vuelven a la cola cada uno por su cuenta, con 15 minutos nuevos.
- **Lo que me escriben mientras busco partido** aparece arriba de la pantalla de búsqueda, en "Te escribieron", con Aceptar y No. Antes era solo un aviso de 20 segundos.
- **Después de un "no", hay que esperar 2 minutos** para volver a escribirle a la misma persona.
- **Sin señales de vida por 10 minutos, la búsqueda sale de la cola.** La app avisa que sigue ahí cada 8 segundos mientras está abierta. Con el celular bloqueado o la app en segundo plano eso se corta, así que una búsqueda "Hasta match" también se cae si la app queda cerrada 10 minutos. Se va a poder aflojar cuando haya notificaciones push.
- **Cartel de los 15 minutos:** hay 2 minutos para responderlo. Pasado eso, la búsqueda vence. Lo ve solo quien armó el grupo; a los demás les dice que esa persona decide cómo siguen.
- **Aviso en el Inicio** cuando tenés un match en la sala de otro y todavía no tocaste "Ya entré a la sala" (durante 2 horas), para volver a encontrarlo.
- **A cada uno el partido le cuenta cuando entró o confirmó.** El partido es válido cuando confirma uno de cada lado, pero a alguien que solo fue aceptado (y ni entró ni confirmó) no le suma. Le cuenta cuando el dueño marca "Ya entró" o cuando él toca "Ya entré a la sala". Si el dueño ya marcó que entró y el partido ya es válido, no hace falta que toque nada.
- **"No vino":** al que fue aceptado y nunca entró, el dueño lo puede sacar para liberar el lugar (antes solo se podía con "Se salió", después de "Ya entró"). Está en el cartel "X va a entrar" y en la lista "En tu sala".
- **"Se salió" o "No vino" antes de que el partido cuente:** al jugador le aparece "Ya no estás en la sala de X" y no le queda nada. **Después de que contó:** deja el lugar, pero el partido le queda anotado.
- **Una sala completa se puede reabrir con "Se salió" durante 6 horas.** Una sala que cerró su dueño (o que venció) no se reabre.
- **Un partido se puede confirmar hasta 7 días después.**
- **Reportes:** se guardan en el servidor (hasta 10 por día por usuario) y se leen desde Supabase. Bloquear sigue siendo por dispositivo: oculta al jugador en mis listas, pero la app todavía puede acercármelo a mi sala.
- **Puntos y nivel siguen en el dispositivo.** El servidor dice qué partidos cuentan y el celular suma los puntos con los topes. Por eso el nivel no se ve desde otro celular, y el de los demás jugadores no se muestra. Pasa al servidor en la etapa de puntos.
- **"Amistosos jugados" y "asistencia"** salen del servidor, con toda la historia. "Con quién más jugaste" mira solo la última semana, hasta la etapa de puntos.
- **Amigos:** la pantalla avisa que llegan en la próxima actualización. Los referidos quedan anotados (quién invitó a quién), pero la lista y sus puntos todavía no se muestran.
- **Fotos de los demás:** del servidor solo viaja la versión de la foto, y la dirección la arma la app con la carpeta de cada usuario. Así nadie puede hacer que los demás carguen una imagen de otro sitio.
- **Los cambios en la cola se hacen de a uno** en el servidor, para que dos personas que tocan al mismo tiempo no se pisen (dos salas aceptando al mismo jugador, por ejemplo).
- **Si un pedido al servidor tarda más de 15 segundos,** la app lo corta y avisa, en lugar de quedarse esperando.
- **Datos de otra cuenta en el mismo celular:** si entra una cuenta distinta, los datos guardados en el dispositivo se reinician.

Cómo se probó: 141 comprobaciones de las reglas sobre una copia local de la base, un ensayo automático con 11 usuarios simultáneos en la app (salas, pedidos, grupos, equipo completo, 15 minutos, "No vino", reportes, cierre de sesión), un ensayo de la versión que se publica, y una revisión independiente del servidor y de la app buscando formas de romperlo (encontró 11 problemas, todos corregidos o anotados abajo). Lo que no se pudo probar desde acá, porque necesita el Supabase real: el ingreso con Discord junto con la cola, los avisos en tiempo real (si fallan, la app igual se actualiza sola cada 8 segundos) y dos personas tocando exactamente al mismo tiempo.

## Amigos, avisos y saludo (7/10/2026)

Pedido: saludo con el nombre en el Inicio, notificaciones con la app en segundo plano, poder tocar a quien está buscando para agregarlo como amigo, y TikTok real (hecho en la etapa siguiente, ver más abajo).

- **Inicio:** en lugar de "Amistosos de HaxBall, sin vueltas" dice "Bienvenido, (nick)" (desde el rediseño, "Hola, (nick)"). El lema queda en la pantalla de ingreso.
- **Ficha del jugador:** tocando la foto o el nombre de cualquier jugador (en la cola, en "Buscan con vos", en "En tu sala", en "Te escribieron", en Match listo) se abre su ficha: nombre, usuario de Discord, "Agregar a amigos" y "Reportar o bloquear".
- **Amigos:** se agregan desde la ficha o por usuario de Discord. Son solicitudes: el otro acepta o rechaza. Si los dos se piden amistad, quedan amigos. Hasta 300 amigos y 30 solicitudes por hora.
- **Qué se avisa** (dentro de la app y, con la app cerrada, como notificación del celular):
  - alguien quiere entrar a mi sala, o me escribió;
  - me aceptaron en una sala ("Match listo");
  - alguien va a entrar a mi sala (uno solo por tanda: si entra un grupo de tres, llega un aviso);
  - alguien se sumó a mi búsqueda;
  - un amigo se puso a buscar o abrió una sala;
  - me mandaron una solicitud de amistad, o aceptaron la mía.
- **Con la app abierta y a la vista no aparece la notificación:** el aviso ya se ve adentro. Lo decide el celular al recibirla, que es el único que sabe si la app está a la vista en ese momento. (Antes lo decidía el servidor según la última señal de la app, y se perdían los avisos de los primeros segundos después de salir.) En iPhone se muestra siempre, porque Apple lo exige.
- **Para que nadie moleste:** si alguien cancela y vuelve a buscar una y otra vez, el dueño de una sala recibe hasta 4 avisos suyos en 10 minutos y sus amigos hasta 3. Una solicitud de amistad retirada y vuelta a mandar no avisa de nuevo ese día.
- **Los avisos se activan en cada celular,** desde el Perfil o al tocar "Sí, avisarme" cuando se empieza a buscar. En iPhone hay que tener la app en la pantalla de inicio.
- **"Mandar un aviso de prueba"** en el Perfil: manda una notificación al propio celular y dice si salió o qué falló.
- **Con avisos activados, la búsqueda aguanta 30 minutos sin señales** (en lugar de 10), porque el usuario se entera por la notificación aunque tenga la app en segundo plano.
- **Al cerrar sesión,** ese celular deja de recibir los avisos de esa cuenta.
- **El texto de la notificación no pasa a la vista por ningún intermediario:** va cifrado para ese celular.
- **Bloquear** sigue siendo por dispositivo: un bloqueado todavía puede mandar una solicitud de amistad.

Cómo se probó: 193 comprobaciones del servidor, 25 del envío de avisos (el cifrado se comparó con las dos librerías de referencia), el ensayo con usuarios simultáneos ampliado con amigos, la ruta de la web con el motor de Cloudflare en local, y una segunda revisión independiente (encontró 8 problemas menores; corregidos). Lo que no se puede probar desde acá: que el aviso llegue de verdad a un celular (los servicios de Google y Apple solo se pueden usar desde la web publicada). Para eso está el botón de prueba.

## Clips y TikTok reales (7/10/2026)

Pedido: que se pueda vincular TikTok de verdad y empezar a importar los videos.

- **El permiso se da en la página de TikTok,** no en HaxMatch: la app nunca ve la contraseña. Se piden dos cosas: el nombre de la cuenta y la lista de videos públicos.
- **Las llaves de acceso quedan solo en el servidor,** en una tabla que la app no puede leer. Ni el dueño de la cuenta las ve desde el celular.
- **Los videos no se copian.** Se guarda la lista (título, fecha, duración y enlace) y cada clip se reproduce desde TikTok, con su reproductor. Si el video no se puede reproducir adentro, queda el enlace "Ver en TikTok".
- **El clip arranca solo** cuando queda en pantalla, y vuelve a empezar al terminar. Los navegadores solo dejan arrancar sin sonido, así que la app pide el sonido apenas arranca: donde el celular lo permite suena solo; donde no, el video sigue sin sonido y aparece "Activar sonido". Un toque en el video pausa o sigue. Si el usuario silencia, los clips siguientes arrancan sin sonido. (Comprobado con el reproductor real de TikTok: sin arranque automático no se pone en marcha ni obedece hasta que lo tocan. La primera versión no lo contemplaba y por eso no reproducía.)
- **Clip a pantalla completa** (pedido del 7/10): el video ocupa todo, hasta la barra de navegación, y el autor, el título y la reacción van encima, abajo a la izquierda. Se sacó la barra de controles del reproductor de TikTok. El reproductor de TikTok muestra arriba su logo y el autor, y abajo a la derecha sus me gusta, comentarios y compartir, y no tiene forma de apagarlos. Para que no se vean, el reproductor se hace más alto que la pantalla (240 px hacia arriba y 240 hacia abajo): esas franjas quedan afuera y el video sigue centrado. Un video vertical puede quedar apenas recortado arriba y abajo en pantallas cortas.
- **Sonido:** se elige una vez y vale para todos los clips, también la próxima vez que se abre la app. El botón está arriba a la derecha. En computadora y Android el clip siguiente sigue con sonido solo. En iPhone, Apple no deja que un video nuevo suene sin un toque: cada clip arranca sin sonido y alcanza con tocar el video una vez (el cartel grande "Activar sonido" sale solo la primera vez; después queda un aviso chico junto al botón). Un toque en el video con sonido lo pausa.
- **Botones de volumen del celular:** una página web no se entera de que se apretaron, así que no pueden activar el sonido. Eso solo se puede en una app de tienda (App Store / Play).
- **Clips en el perfil:** "Tus clips (N)" con una miniatura de cada uno; al tocar una se abre ese clip en Clips. La miniatura la da TikTok y vence a las 6 horas: se renueva cada vez que se trae la lista (al abrir el perfil se pide si tiene más de 5 horas). Si no carga, queda el título sobre un fondo liso. No se copia la imagen.
- **Deslizar para actualizar:** estando en el primer clip, deslizar hacia abajo (o girar la rueda del mouse hacia arriba) busca clips nuevos. Además de volver a leer la lista, le pide a TikTok los videos nuevos de las cuentas vinculadas: la de quien desliza siempre, y las de los demás si hace más de 2 minutos que no se revisan (hasta 20 por vez). Al terminar dice cuántos clips nuevos hay y vuelve arriba de todo para mostrarlos.
- **En Clips aparecen solo los que tienen #haxball o #haxmatch** y que su dueño no ocultó. En "Mis videos" el dueño ve todos los suyos y cuáles se muestran.
- **Una cuenta de TikTok, un usuario.** Si ya está vinculada a otro usuario de HaxMatch, avisa y no la vincula.
- **Cuándo se actualiza la lista:** al vincular, al abrir "Mis videos", con el botón "Actualizar" (una vez cada 45 segundos como mucho) y cada 6 horas para todos, si Supabase tiene disponible la tarea programada. Si no la tiene, no se rompe nada.
- **Si un video se borra en TikTok,** desaparece de HaxMatch en la siguiente actualización. Si TikTok falla o contesta algo raro, no se borra nada: se intenta de nuevo más tarde.
- **Si el usuario quita el permiso desde TikTok, o el permiso vence** (dura un año sin usar), "Mis videos" pide volver a vincular. Los videos que ya estaban se mantienen hasta entonces.
- **Desvincular** borra las llaves, todos los videos de ese usuario y sus reacciones recibidas, y le pide a TikTok que anule el permiso.
- **Se revisan hasta los 200 videos más recientes** de cada cuenta. Con más que eso, los viejos que ya estaban no se borran solos.
- **Videos de muestra:** mientras no haya ningún clip real, Clips muestra los 6 inventados para que la pantalla no esté vacía. Con el primer clip real desaparecen.
- **Puntos por video nuevo:** siguen calculándose en el celular, como el resto de los puntos, y solo para videos publicados después de vincular (los que ya estaban no suman). Pasan al servidor en la etapa de puntos.
- **Términos y Privacidad** son dos páginas fijas (`/terminos` y `/privacidad`) que se leen sin entrar a la app: TikTok las exige y las revisa. El contacto publicado es lpatriciogauna@outlook.com. Hay enlaces desde la pantalla de ingreso y desde el Perfil.
- **Mientras TikTok no esté configurado,** "Mis videos" dice que todavía no se puede vincular, en lugar de mostrar un botón que falla.

Cómo se probó: 241 comprobaciones del servidor, 37 de la parte de la web que habla con TikTok (contra un TikTok de mentira que imita sus respuestas, incluidos permisos vencidos, quitados, fallas y respuestas rotas), el ensayo con usuarios simultáneos ampliado con todo el recorrido (vincular, ver, reproducir, reaccionar, video nuevo, ocultar, desvincular), las páginas fijas con el motor de Cloudflare en local, y una tercera revisión independiente. Esa revisión encontró un problema grave (si faltaba la clave compartida, las funciones protegidas quedaban abiertas) y 14 menores; todos corregidos y con su prueba. Lo que no se pudo probar desde acá: el TikTok real. Las direcciones, los nombres de los campos y las respuestas salen de su documentación, pero recién se confirma con la primera vinculación de verdad.

## Puntos, niveles y referidos en el servidor (7/10/2026)

Hasta acá los puntos se calculaban en cada celular: se perdían al cambiar de celular y cualquiera podía tocarlos. Ahora los da y los guarda el servidor.

- **Qué suma y cuánto no cambió:** amistoso 10 (hasta 5 por día con puntos, 3 con el mismo rival), video nuevo en Clips 8 (1 por día), reacción a un clip de otro 1 (hasta 10 clips distintos por día), primer ingreso del día 2, racha de 3, 7, 14 y 30 días seguidos (+5, +15, +30, +60), referido que completa 5 amistosos 50 (hasta 10 por mes).
- **Cada cosa suma una sola vez,** pase lo que pase: sacar y volver a poner una reacción, ocultar y mostrar un video, salir y volver a entrar a una sala, o volver a vincular TikTok no dan puntos de nuevo.
- **El "día" es el de Buenos Aires para todos** (antes era el de cada celular). Queda resuelto ese punto abierto.
- **Video "nuevo"** es el publicado después de vincular la cuenta. Uno viejo que desaparece y vuelve (por ejemplo, pasado a privado y de nuevo a público) no cuenta.
- **Las reacciones suman solo sobre clips que están en Clips** (visibles y con #haxball o #haxmatch).
- **Referidos:** la pantalla Referir ahora muestra de verdad a quién invitaste y cómo va ("Va 3 de 5 amistosos"). Para los 5 amistosos del referido cuentan también los que no le dieron puntos por tope. Al completarlos, a quien lo invitó le llega el aviso.
- **Nivel de los demás:** como el nivel sale del servidor, ya se muestra el de los otros jugadores (en la cola, en los grupos y en Clips).
- **Lo que ya estaba:** al ejecutar el paso 5 se reconstruyen los puntos de los partidos que contaron, los videos nuevos y las reacciones, con sus topes por día. **Los días de conexión anteriores no estaban guardados en el servidor**, así que esos puntos y la racha arrancan de nuevo: el total de cada uno puede bajar un poco respecto de lo que mostraba su celular.
- **Mientras no se ejecute el paso 5,** la app sigue calculando los puntos en el celular como antes.
- **La app no puede darse puntos:** no puede leer ni escribir la tabla de puntos ni el total del perfil, ni llamar a las funciones que los dan.

Cómo se probó: 298 comprobaciones del servidor (49 nuevas, de puntos), el ensayo con usuarios simultáneos (puntos que se mantienen con el celular "vacío", referido que completa sus amistosos, subir de nivel, nivel de los demás) y una cuarta revisión independiente buscando formas de hacer trampa: no encontró fallas graves; marcó 8 puntos menores, de los que se corrigieron 6 (video viejo que volvía a contar, avisos viejos al reconstruir, reacciones a videos fuera de Clips, puntos locales antes de la primera respuesta del servidor, caída momentánea que bajaba el nivel, y el orden de los permisos).

Quedó anotado, sin cambiar: el tope de "3 con el mismo rival" mira al conjunto de rivales de la sala, como estaba definido; con una tercera cuenta en la sala, dos amigos llegan igual al tope de 5 por día. Y un referido puede completar sus 5 amistosos jugando siempre con quien lo invitó. Las dos cosas respetan las reglas escritas; si se quieren endurecer, es una decisión de producto.

## Borrar la cuenta, bloqueos y moderación (7/10/2026)

- **Borrar la cuenta** está en el Perfil. Pide escribir BORRAR. Se va en el momento el perfil con todo lo suyo: foto, puntos, amigos, búsquedas, mensajes, clips y la vinculación con TikTok (se le pide a TikTok que anule el permiso).
- **A los demás no les saca nada:** los partidos que ya contaron les quedan (figuran sin el nombre de quien creó la sala), con sus puntos. Si el que se borra estaba anotado en la sala de otro, ese lugar vuelve a quedar libre. Sus salas que no habían llegado a contar desaparecen.
- **Se puede volver a entrar** con el mismo Discord: es una cuenta nueva, de cero. No cuenta otra vez como referido de nadie, y si la cuenta borrada estaba suspendida, la suspensión sigue.
- **Para eso queda una huella** del identificador de Discord que no se puede revertir, sin nombre ni ningún otro dato, junto con la cantidad de reportes recibidos. Se borra sola al año (salvo que tenga una suspensión vigente). Está explicado en la Política de privacidad.
- **El identificador y el usuario de Discord** de cada perfil se toman de lo que dio Discord al entrar. Antes salían de datos de la sesión que el propio usuario podía editar: alguien podía hacerse pasar por el usuario de otro. Al ejecutar el paso 6 se corrigen los perfiles que ya existían.
- **Bloquear vale en serio:** queda guardado en el servidor (antes solo ocultaba al jugador en ese celular). A quien bloqueo la app no me lo acerca, no puede escribirme ni mandarme solicitud, ni yo a él; tampoco a través de un grupo que lo traiga. Dejamos de ser amigos. Se desbloquea desde Amigos > Bloqueados. Lo bloqueado en el celular pasa solo al servidor.
- **El bloqueado no ve quién lo bloqueó.** Si intenta escribirle, le dice "No se puede contactar a ese jugador".
- **Entre terceros no se impide:** dos jugadores bloqueados entre sí pueden coincidir en la sala de otra persona. Lo que no pasa es que uno entre a la sala o al grupo del otro.
- **Suspender una cuenta** se hace solo desde Supabase, con las funciones `mod_` (ver README). No hay sanciones automáticas por cantidad de reportes: los reportes falsos serían una forma de molestar. Decide quien modera.
- **Qué no puede hacer una cuenta suspendida:** buscar partido, abrir o reabrir una sala, escribirle a otros, mandar o aceptar solicitudes de amistad. Sí puede entrar, ver clips y confirmar partidos que ya había jugado. La app le muestra el motivo y hasta cuándo.
- **Texto del reporte:** decía "varios reportes frenan la subida de nivel", que no era cierto. Ahora dice que una cuenta reportada puede quedar suspendida.

Cómo se probó: 368 comprobaciones del servidor (70 nuevas), el ensayo con usuarios simultáneos (bloquear desde un celular y verlo en otro, suspender y levantar, borrar la cuenta) y una quinta revisión independiente. Esa revisión encontró un problema importante (el identificador de Discord se podía falsear, y con eso esquivar una suspensión) y varios medianos: bloqueos que se podían saltear armando un grupo, partidos de otros que se perdían al borrar una cuenta, suspendidos que podían reabrir una sala o aceptar amigos, y la app borrando la foto antes de saber si la cuenta se iba a poder borrar. Todos corregidos y con su prueba. Lo que no se pudo probar desde acá: borrar un usuario en el Supabase real (es el camino habitual, pero se confirma con la primera cuenta que se borre).

## Rediseño "Cancha" (7/10/2026)

Pedido: que la app se vea más profesional. Se mostraron tres propuestas y se eligió la A, que mantiene los colores y las letras y ordena todo lo demás. Las reglas quedaron en `docs/DISENO.md`. No cambia cómo funciona nada; lo que sí cambia de lugar o de forma:

- **Inicio:** el nombre de la app va chico arriba, con la campana de notificaciones. El saludo pasa a "Hola, (nick)". Las dos entradas dicen para qué sirve cada una; la amarilla es "Quiero jugar un amistoso" (o la de la búsqueda que esté abierta). Abajo aparece **"Amigos buscando"** cuando hay alguno, con el botón "Mensaje" (con servidor, solo si uno también está buscando: es la regla que ya existía).
- **Barra inferior también en el Inicio.** Reemplaza a "Ver clips" y "Ver perfil".
- **Cerrar sesión** ya no está en el Inicio: queda en el Perfil, abajo de todo, con la confirmación de siempre.
- **Búsqueda:** el reloj va grande y a la izquierda, con una barra que muestra cuánto falta para los 15 minutos (o una franja que se mueve, si la búsqueda no vence). Se agrega una flecha para volver al Inicio sin cancelar. "Cancelar búsqueda" es un texto rojo al final, no un botón rojo grande.
- **Perfil:** la foto es un recuadro de esquinas redondeadas (y el encuadre al elegirla también). El nivel es un bloque con la racha y la barra de avance; al tocarlo abre el detalle. "Amigos" y "Referir amigos" son filas con flecha; "Amigos" avisa si hay solicitudes.
- **Clips:** el autor va con su foto, su nombre y el nivel en una etiqueta; la reacción es un botón que se pone amarillo al tocarlo. Los clips de muestra usan el mismo armado que los reales.
- **Aviso de búsqueda abierta:** bloque oscuro con borde amarillo, en lugar de todo amarillo, para que no compita con el botón principal.
- **Notificaciones:** las nuevas se marcan con un punto amarillo. Si se entra desde el Inicio, la flecha vuelve al Inicio.
- **Términos y Privacidad:** mismos títulos en minúscula que la app.

Cómo se probó: el recorrido de la demostración, el ensayo con usuarios simultáneos, el ensayo de la versión que se publica y las pruebas del servidor, todos mirando las capturas; además, un celular chico (320 de ancho) y una pantalla de computadora, y una revisión independiente del cambio (encontró cuatro detalles menores, corregidos). Lo que no se pudo probar desde acá: cómo se siente en un celular de verdad (los toques, las animaciones de los carteles) y el reproductor real de TikTok con el diseño nuevo.

## Entrar a la cola de un toque y salas que invitan (7/10/2026)

Pedido: que "Quiero jugar un amistoso" meta directo en la cola, sin preguntar nada; que "Necesito un jugador" pida lo mismo que antes; y que a quien busca partido le llegue un aviso del estilo "(sala) está necesitando un GK/DFC/MC en la cancha (cancha), ¿querés jugar?". Se definió además que **es el dueño de la sala quien elige**, de la lista de jugadores que buscan, a quién invitar.

| Tema | Cómo quedó |
|---|---|
| Quiero jugar un amistoso | Un toque y a la cola. No hay formulario: va con las regiones del perfil, por 15 minutos renovables. Ya no se elige modalidad, posición, cancha ni "hasta match" |
| Necesito un jugador | El mismo formulario: nombre de la sala, cuántos faltan, posición, cancha y región |
| Quién elige | El dueño de la sala ve "Jugadores buscando partidos" y toca "Invitar" en el que quiera. Puede invitar a varios a la vez |
| La invitación | `"los pibes" está necesitando un GK/DFC en la cancha Big. ¿Querés jugar?` Con "Polifuncional" dice "un jugador" (o "3 jugadores" si faltan varios); con "Cualquiera" no nombra la cancha. Al jugador le aparece como cartel ("Te invitan a jugar"), como aviso dentro de la app y como notificación del celular |
| Si acepta | Entra directo: la sala ya lo eligió. El primero que acepta se queda con el lugar; las otras invitaciones se caen solas y eso no cuenta como un "no" (se lo puede volver a invitar) |
| Si dice que no | A la sala le figura "No puede" y no le puede insistir por 2 minutos; después puede volver a invitarlo |
| Para que nadie moleste | A una misma persona se le puede escribir hasta 4 veces en 10 minutos (aunque se cancele la búsqueda y se vuelva a empezar), y no más de 10 invitaciones sin responder a la vez |
| Grupos | La invitación le llega a quien armó el grupo; si acepta, entran todos. Una sala no puede invitar a un grupo más grande que los lugares que le quedan |
| Pedirle lugar a una sala | Sigue igual: el jugador le escribe a la sala y el dueño acepta o rechaza |
| Emparejamiento automático | Se sacó. La app ya no le acerca jugadores a las salas |
| "Equipo completo" | Se sacó: sin modalidad no se puede saber cuándo un grupo es un equipo. A cambio, quien armó un grupo tiene el botón **"Armar una sala con el grupo"** desde el primer momento (antes había que esperar el cartel de los 15 minutos) |
| "¿Te avisamos?" | Se sacó el cartel que aparecía al empezar a buscar (era una pregunta más). Si el celular no tiene los avisos activados, al final de la pantalla de búsqueda hay un bloque para activarlos |
| Datos de los partidos | Ya no dicen "3v3 con Ana": dicen "Sala de Ana" o "Amistoso con Ana" |

Para que funcione con servidor hay que **volver a ejecutar `supabase/02_cola.sql`** (solo ese). Hasta entonces la app nueva anda igual, con el comportamiento viejo del servidor: sigue acercando jugadores a las salas y la invitación dice "¿Te sumás a mi sala?".

Cómo se probó: 379 comprobaciones del servidor (las de la cola se reescribieron para el flujo nuevo), el recorrido de la demostración, el ensayo con usuarios simultáneos (invitar, decir que no, grupo invitado, armar sala con el grupo) y el de la versión que se publica. Lo que no se pudo probar desde acá: la notificación real en un celular con la app cerrada.

Una revisión independiente del cambio no encontró problemas graves; se corrigieron cuatro detalles: "No puede" quedaba para toda la vida de la sala (ahora 2 minutos, como en el servidor), tocar "Quiero jugar" antes de que cargue la cola mostraba un error de más, el tope de mensajes a una misma persona, y el bloque de avisos que escondía su propio error. Queda anotado, sin corregir: si a un grupo que una sala invitó se le suma después alguien bloqueado por el dueño, la invitación no se cae sola (falla al aceptar, con un texto que deja ver que hay un bloqueo).

## Perfil de otro jugador (7/10/2026)

Pedido: al tocar el nombre de un jugador en la cola, ver su perfil con la cantidad de amistosos jugados y la opción de agregarlo como amigo.

- Tocar a un jugador (foto, nombre o renglón de abajo) ya abría una ficha chica. Ahora es su **perfil**: foto grande, nombre, usuario de Discord, **amistosos jugados**, **nivel**, "Agregar a amigos" y "Reportar o bloquear". Se abre igual desde cualquier lista: la cola, "Buscan con vos", "En tu sala", "Te escribieron", Amigos y Match listo.
- Los amistosos jugados son el mismo número que cada uno ve en su propio Perfil (los partidos que le cuentan).
- El dato se pide al servidor recién al abrir el perfil, con una función nueva (`supabase/07_ficha.sql`). Sin ese paso, el perfil muestra solo el nivel.
- Si hay un bloqueo entre los dos, para cualquiera de los lados, no se muestran los números.
- La política de privacidad ahora dice que los demás ven el nivel y cuántos amistosos jugaste.

Cómo se probó: 11 comprobaciones nuevas del servidor, el recorrido de la demostración y el ensayo con usuarios (una dueña de sala mira el perfil de un jugador antes de invitarlo y ve el amistoso que acaban de jugar).

## Presentación pública, para la revisión de TikTok (7/10/2026)

TikTok no aprueba una app cuyo sitio sea solo una pantalla de ingreso: pide un sitio que explique qué es, con Términos y Privacidad a la vista. Por eso la pantalla de ingreso ahora sigue hacia abajo: la primera vista es la de siempre (nombre y botones para entrar) y debajo cuenta qué es HaxMatch, cómo funciona, qué hace con TikTok, y tiene los enlaces a Términos, Privacidad y Contacto. Se lee sin entrar. El paso a paso para mandar la app a revisión quedó en `docs/TIKTOK_REVISION.md`.

## Avisos en la computadora (7/10/2026)

Pedido: que en la computadora los avisos lleguen como en el celular, "como un mensaje de WhatsApp".

- Los avisos ya se podían activar en una computadora (es el mismo mecanismo), pero la app hablaba siempre de "este celular" y, si algo fallaba, no decía cómo arreglarlo. Ahora los textos dicen "esta computadora" y explican cada caso: avisos bloqueados en el navegador, ventana privada, o Brave (que trae apagado el servicio que usan los avisos).
- **Cuándo se muestra la notificación:** antes no aparecía si la app estaba "a la vista", y en una computadora una pestaña abierta cuenta como a la vista aunque uno esté en otra ventana. Ahora solo se omite si la persona está usando la app en ese momento (la ventana tiene el foco). En el celular no cambia nada.
- Si al abrir el Perfil la app todavía no había instalado su parte de segundo plano, la instala en ese momento en lugar de decir que el navegador no permite avisos.

Lo que no depende de la app: con el navegador cerrado del todo, Windows y Mac solo muestran avisos si el navegador sigue funcionando en segundo plano; y "No molestar" los oculta.

### El aviso de prueba dice hasta dónde llegó

Reporte: al tocar "Mandar un aviso de prueba" en la computadora, llegaba al celular y no a la computadora. La prueba sale hacia todos los dispositivos de la cuenta, y antes decía "listo" con que uno solo lo recibiera. Ahora sigue el aviso paso por paso:

1. Antes de mandar, vuelve a anotar este dispositivo en el servidor. Si no se puede, lo dice y no manda nada.
2. Cuando el aviso llega al navegador, la parte de segundo plano (`public/sw.js`) se lo cuenta a la app abierta, y también si lo pudo mostrar.
3. Según eso, el texto es uno de tres:
   - **Llegó y se mostró.** Si el cartel no se vio, lo oculta el sistema, y la app dice dónde se prende en Windows, Mac, Android o iPhone. En Windows aclara que "No molestar" se prende solo con un juego a pantalla completa.
   - **Llegó y el navegador no dejó mostrarlo.** Explica cómo permitir las notificaciones del sitio.
   - **No llegó.** La primera vez renueva la suscripción de ese dispositivo y pide probar de nuevo. La segunda, da un dato para pedir ayuda: navegador, sistema, servicio de avisos y qué contestó.

La notificación de prueba dice "esta computadora" o "este celular" según dónde aparece.

No se pudo probar con un aviso real (desde acá no se llega a los servicios de avisos). Sí se probó la parte de segundo plano en un Chromium de verdad, haciéndole llegar un aviso simulado, y la lógica de la app con un navegador de mentira (`src/data/push.test.ts`).

### La pestaña titila (7/10/2026)

Los avisos del sistema siguieron sin aparecer en la computadora de Lauti, y pidió otra cosa: que la app titile cuando encuentra partido, "como en FACEIT".

- Cuando pasa algo que no puede esperar y la persona está en otra pestaña o en otra ventana, el título de la pestaña alterna entre "🟡 Nico te invita a su sala" y "⚪ Nico te invita a su sala", y el ícono alterna con una versión amarilla. Al volver a la app, queda como siempre.
- Titila por cuatro cosas: me invitan o me escriben, alguien quiere entrar a mi sala, alguien va a entrar a mi sala, y match listo. Lo demás (amigos, puntos, niveles) no.
- Si la invitación se cae antes de que la persona vuelva, deja de titilar.
- Con la app instalada, además aparece un punto sobre su ícono en la barra de tareas (donde el sistema lo permite).
- No pide permisos y no hace ruido. Hace falta tener HaxMatch abierta en alguna pestaña.
- Los avisos del sistema no se tocaron: en el celular siguen igual, y en la computadora siguen activables.

Límite conocido: una pestaña que lleva más de cinco minutos tapada cambia el título una vez por minuto en lugar de una vez por segundo (lo frena el navegador). Por eso los dos estados son llamativos.

## Google Play (7/10/2026)

Lauti consiguió prestada una cuenta de Google Play (personal, creada el 5/1/2026) y decidió subir la app con la dirección actual. La guía está en `docs/PLAY_STORE.md`.

- La app de Play es un envoltorio de la web (se arma con PWABuilder). No se toca el código de la app.
- Por el tipo y la fecha de la cuenta, Google exige una prueba cerrada de 14 días con 12 personas antes de publicar.
- Se agregó `/borrar-cuenta`, la página pública que Google pide para solicitar el borrado.
- **Corrección en la Política de privacidad:** al entrar con Discord, el servicio de inicio de sesión (Supabase) también recibe y guarda el email de la cuenta de Discord. La política no lo decía. La app no lo lee ni lo muestra, y se borra con la cuenta.
- Falta, cuando Lauti genere el paquete: publicar `/.well-known/assetlinks.json` con las dos huellas (la del paquete y la de Google).
- Google necesita una cuenta de Discord de prueba para revisar la app, porque no hay otra forma de entrar.

## Chat general, conectados y panel (8/10/2026)

Pedido: una solapa de chat general, un puntito verde al lado del nombre de quien está conectado, un panel para ver quiénes se registraron y un botón para colaborar. Lauti eligió: un solo chat para todos, mensajes de 24 horas, el puntito visible para todos con opción de ocultarlo, y el botón escondido hasta tener el link de Cafecito.

- **Chat:** solapa nueva en la barra de abajo (Inicio, Chat, Clips, Perfil). Mensajes de hasta 300 letras, en una sola línea. Topes: 3 cada 10 segundos, 40 cada 10 minutos, y no repetir el mismo mensaje en un minuto. No se ven los mensajes de quien bloqueé ni de quien me bloqueó. Una cuenta suspendida no puede escribir. Cada uno borra los suyos con dos toques. Tocar un nombre abre su perfil (para agregarlo, reportarlo o bloquearlo). El chat no manda notificaciones.
- **Conectado:** "conectado" quiere decir que tiene la app abierta y a la vista. Se calcula con la señal que la app ya mandaba cada 8 segundos; al pasar a segundo plano deja de figurar en el momento, y si se corta internet, a los 30 segundos. El puntito aparece en la cola, en Amigos, en el chat y en el perfil de cada jugador. Se apaga en Perfil > "Mostrar cuando estoy conectado". Con un bloqueo de por medio, ninguno ve al otro.
- **Panel:** Perfil > Panel de administración. Solo lo ven las cuentas de la tabla `admins` (se anota desde el SQL Editor). Muestra registrados, nuevos, activos, conectados, buscando, amistosos y mensajes; los reportes de 30 días con su detalle; los suspendidos, y los últimos 50 registrados. Suspende (1, 3, 7, 30 días o sin fin, con motivo) y levanta suspensiones con las mismas funciones `mod_`. No se puede suspender a otro administrador. En el chat, "Moderar" muestra el tacho en todos los mensajes.
- **Apoyo:** tarjeta "Apoyá HaxMatch" en el Perfil, que aparece cuando se completa `APOYO_URL` en `src/config.ts`.
- **Textos:** Términos (reglas del chat y que moderación puede borrar mensajes y suspender) y Privacidad (qué ven los demás, el chat y el puntito) actualizados.

Puntos abiertos:

- Sin notificaciones del chat ni contador de mensajes sin leer, para no molestar. Se puede agregar si la gente lo pide.
- Los reportes por el chat usan los motivos que ya existían ("Comportamiento tóxico"); el reporte no guarda qué mensaje fue.

## Decisiones que tomé al construir (revisar)

1. **El match siempre es con una sala.** Dos jugadores sin sala ya no generan match: se juntan en una misma búsqueda. Quien creó la sala ve "Ya entró X a la sala" y el que se une ve "Ya entré a la sala".
   - Si otro jugador me invita y acepto, me sumo a su búsqueda y paso a usar su reloj.
   - Un grupo no puede escribirle a una sala a la que le faltan menos jugadores que los que son.
   - En "Jugadores buscando partidos" aparecen todos los que buscan partido, primero los amigos y los más parecidos a lo que busco. No se filtra por modalidad.
2. **Confirmación.** Un lado es quien creó la sala y el otro son los que entran. Alcanza con que confirme uno de cada lado y cuenta para todos.
3. **Las salas no vencen.** El formulario de sala no tiene duración, así que la búsqueda sigue hasta el match o hasta cancelarla.
4. **Un match no tiene modalidad** (el formulario de sala no la pide). Se muestra como "Sala de Nico".
5. **El botón bloqueado del Inicio** conserva una línea que explica por qué está bloqueado.
6. **Botón de volver** en las pantallas internas, y **"Cancelar búsqueda"** en la pantalla de espera (los mockups no los tienen).
8. **YouTube y Kick** aparecen en el Perfil con la etiqueta "Pronto".
9. **Topes de puntos:** un amistoso que no suma por tope se registra igual con 0 puntos. Cuenta para el historial y para los referidos, y no consume el tope.
10. **Racha:** el extra se da una vez al llegar justo a 3, 7, 14 y 30 días. Después de 30 no hay más extras hasta que se corte.

## Puntos abiertos

- **Dos personas que aceptan a la vez.** Está resuelto en el servidor (los cambios van de a uno), pero no se pudo ensayar con dos pedidos realmente simultáneos.
- **El dueño acepta y el jugador entra sin que le pregunten.** Es lo que se pidió ("automático"), pero con gente real puede pasar que el jugador ya no esté mirando. Si no entra, el dueño usa "No vino".
- **Cancelar sin conexión:** la búsqueda desaparece de la pantalla y vuelve al reconectar, con un aviso genérico.
- **Carga:** cada cambio hace que todas las apps abiertas vuelvan a pedir el estado. Alcanza para empezar; con muchos usuarios a la vez hay que afinarlo.
- **Tiempo sin señales:** 10 minutos sin avisos, 30 con avisos activados. Revisar con el uso real.
- **Aviso de "pasaron 15 minutos"** con la app cerrada: hoy no se manda (haría falta una tarea programada en el servidor).
- **Revisión de TikTok:** hasta que la aprueben, solo vinculan las cuentas anotadas en el modo de prueba de TikTok.
- **Clips de un suspendido:** se siguen viendo.
- **Moderación:** los reportes se revisan a mano desde Supabase y se puede suspender. Falta una pantalla para moderar sin entrar a Supabase, y moderar las fotos de perfil.
- **Quien borra su cuenta antes de que lo suspendan** se lleva el detalle de sus reportes (queda solo la cantidad) y no se lo puede suspender hasta que vuelva a entrar.
- **Un suspendido que ya estaba anotado en la sala de otro** sigue anotado: el dueño lo saca con "Se salió" o "No vino".
- **¿"Se salió" tiene que avisarle al jugador o afectar su asistencia?** Hoy solo libera el lugar.
- **"Equipo al que más enfrentaste" y resultados G/P:** la app no registra equipos ni resultados, así que esa tarjeta no tiene de dónde sacar datos. Hoy dice "Todavía sin datos". Hay que definir si se agregan equipos o se cambia la tarjeta.
- **Cómo se arman los equipos de un 2v2, 3v3 o 4v4** dentro de la app (hoy un match son dos personas).
- **Motivo de reporte "Resultado falso":** no hay resultados. ¿Se cambia por "Confirmó un partido que no se jugó"?
- **Inicio sin barra inferior:** desde el Inicio no hay acceso directo al Perfil ni a las notificaciones (hay que pasar por Clips).
- **Carga de los puntos:** cada consulta de estado cuenta los movimientos del usuario. Alcanza por mucho tiempo; con años de uso habrá que guardar los totales por tipo.
- **Cuentas duplicadas para sumar referidos o partidos:** hoy no se detectan. Es parte de la moderación.
- **Vencimiento de salas** y de pendientes (propuesta del documento: 7 días, es lo que está puesto).
- Los pendientes de la sección 7 del documento siguen igual: sorteo y marca.
