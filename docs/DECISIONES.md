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
| Inicio | Se agregan "Ver perfil" y "Cerrar sesión" |
| Cola | Dos listas: "Jugadores buscando partidos" y "Salas buscando jugadores" |
| Jugador que acepta mi mensaje | Se suma a mi búsqueda y a mi reloj. No hay match todavía: seguimos buscando juntos |
| Sala que acepta mi mensaje | Se genera el match, aunque la sala no coincida con lo que buscaba. Si busco en grupo, entra el grupo completo |
| Unirse a una sala | Ya no es directo: se manda mensaje y la sala acepta |

## Emparejamiento y salas con cupos (tercera ronda, 6/10/2026)

| Tema | Cómo quedó |
|---|---|
| Match automático | La app conecta sola, sin mensajes. A una sala le acerca primero un grupo que sea justo los que le faltan, después jugadores sueltos y después grupos más chicos. A quien busca partido lo mete en una sala donde entre (solo o con su grupo), y prefiere la que le faltan justo los que son |
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

- Se elige desde el Perfil, tocando el círculo. Abre la galería del celular (no la cámara).
- La app la recorta cuadrada (se queda con el centro) y la achica a 256 px antes de guardarla.
- Se puede quitar, y vuelve a mostrarse la inicial.
- En esta versión de prueba se guarda en el dispositivo. Con backend va a Supabase Storage.
- Pendiente para publicar: las fotos son contenido de los usuarios, así que el reporte de jugadores tiene que cubrir "foto inapropiada" y el equipo tiene que poder quitarlas (lo pide la App Store).

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

- **Grupo armado por otro jugador que se completa.** Si me sumo al grupo de otro y ese grupo completa el equipo, la sala la tiene que crear él. En la demo no está simulado.
- **¿"Se salió" tiene que avisarle al jugador o afectar su asistencia?** Hoy solo libera el lugar.
- **"Equipo al que más enfrentaste" y resultados G/P:** la app no registra equipos ni resultados, así que esa tarjeta no tiene de dónde sacar datos. Hoy dice "Todavía sin datos". Hay que definir si se agregan equipos o se cambia la tarjeta.
- **Cómo se arman los equipos de un 2v2, 3v3 o 4v4** dentro de la app (hoy un match son dos personas).
- **Motivo de reporte "Resultado falso":** no hay resultados. ¿Se cambia por "Confirmó un partido que no se jugó"?
- **Inicio sin barra inferior:** desde el Inicio no hay acceso directo al Perfil ni a las notificaciones (hay que pasar por Clips).
- **Zona horaria del "día"** para topes y racha. Hoy es la del celular. En el backend hay que fijar una.
- **Vencimiento de salas** y de pendientes (propuesta del documento: 7 días, es lo que está puesto).
- Los pendientes de la sección 7 del documento siguen igual: sorteo, marca, revisión de TikTok.
