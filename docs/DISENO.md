# Diseño de HaxMatch ("Noche")

Cómo se ve la app y por qué. Sirve para que una pantalla nueva quede igual a las demás.
Todo está en `src/styles.css`; las piezas compartidas, en `src/ui/index.tsx`.
Los bocetos (las 8 paletas que se compararon y la elegida, la 4) están en el lienzo "HaxMatch · propuestas de diseño".

## Idea

Sobrio y minimalista, para que la app se sienta un producto serio. Fondo azul noche, texto claro y un solo color fuerte (azul). Se usa mucho de noche, al lado del juego: nada que encandile. Poco texto, números grandes y finos, y algo de movimiento suave para que no parezca vacía.

## Colores (paleta 4)

| Nombre | Valor | Para qué |
|---|---|---|
| `--bg` | `#090D14` | Fondo de la app |
| `--card` | `#111827` | Bloques y carteles |
| `--mute` | `#1A2333` | Botones secundarios, líneas entre filas |
| `--line` | `#293241` | Bordes |
| `--fg` | `#EAF2FF` | Texto |
| `--fg2` | `#8A9AB5` | Texto secundario |
| `--accent` | `#3B82F6` | Azul para bordes, texto e íconos sobre el fondo (lo que pide atención, la pestaña elegida) |
| `--accent-fondo` | `#2563EB` | Azul de los botones llenos (con texto blanco se lee bien) |
| `--danger` | `#FF8A7A` | Errores y acciones que no se deshacen |
| `--vivo` | `#4ADE80` | El punto de "en línea" |

Reglas:

- **Un azul lleno por pantalla**, en lo que más importa hacer ahí. Lo que pide atención sin ser la acción principal (algo por confirmar, una búsqueda abierta) lleva **borde** azul, no fondo.
- Cancelar o salir no va en azul ni en rojo lleno: texto rojo (`btn--quieto`) o gris (`btn--ghost`). El rojo lleno (`btn--danger`) queda para confirmar algo que no se deshace, dentro de un cartel.
- El color nunca es la única señal: siempre hay un texto o un ícono al lado.

## Letras

- **Manrope** en toda la app (300 a 700). Títulos grandes finos (300); títulos chicos y botones en 600.
- Tamaños: texto 16; secundario 14 (`.m`); título de pantalla 26; título de sección 14 en gris (`.sub`); etiquetas 11 a 13. Nada más chico que eso.
- Los números que cambian (reloj, puntos) llevan `.num` para que no bailen.

## Inicio y HaxBall

- El Inicio ("¿Qué querés jugar hoy?") va sin barra de abajo: saludo, en línea y jugadores, el título con un brillo que respira y tu foto en el centro con dos anillos que giran. Tocarla lleva a HaxBall.
- Cada cambio de pantalla (también las pestañas de abajo) hace entrar el contenido igual que el Inicio: de a uno, desde un desenfoque (`.vista` en `src/App.tsx` y `:where(.vista)` en los estilos).
- El Inicio no tiene campanita: solo el nombre de la app, el saludo, "● N en línea · M jugadores registrados", el título y la foto.
- "Quiero jugar un amistoso" lleva a Clips: mientras espera mira videos, y arriba queda el aviso "Te avisamos cuando encontremos una coincidencia" (tocándolo, va a la búsqueda).
- En la búsqueda, el reloj es chico y centrado, con la barra abajo. A los 15 minutos sale "Pasaron 15 minutos. ¿Querés seguir buscando?".
- Ícono de la app: la misma idea del Inicio, un círculo claro con un anillo y un arco azul, sobre azul noche.
- Todas las pantallas tienen de fondo las mismas dos manchas de luz azul que se mueven despacio (`Luces`, en `src/ui/index.tsx`). La barra de abajo y la de escribir del chat son translúcidas.
- La barra de abajo va solo con íconos (Jugar es un joystick); la pestaña elegida se marca con un punto azul.
- HaxBall junta todo: cuántos buscan (número grande), "Quiero jugar un amistoso", "Necesito un jugador", quiénes quieren jugar, qué salas buscan gente y quién está en vivo en Kick. Desde acá aparece la barra de abajo; su primera pestaña es "Jugar".

## Formas

- Botones: esquinas de 12 (14 los grandes). Bloques: 20. Fotos: recuadro redondeado (14 en 44 px, 12 en 36, 20 en 64); la del Inicio, redonda.
- Todo lo que se toca mide al menos 44 px de alto.
- Margen lateral de 20. Entre bloques, 12; antes de un título de sección, un poco más.

## Piezas

| Pieza | Clase | Cuándo |
|---|---|---|
| Fila de lista | `card card--row` | Jugadores, salas, cuentas, notificaciones. Sin caja: una línea fina arriba. |
| Bloque | `card` (`card--col` si va en columna) | Algo que es una unidad: el nivel, los avisos, un dato para copiar. |
| Bloque que pide atención | `card card--accent`, `banner` | Partidos por confirmar, búsqueda abierta, match por abrir. |
| Fila que lleva a otra pantalla | `fila-enlace` | Amigos, Referir. Texto, dato y flecha. |
| Lista vacía | `vacio` | Dos renglones, sin caja. |
| Dos números a la par | `stats` + `stat` | Amistosos y asistencia; referidos y puntos. |
| Nivel | `TarjetaNivel` | Perfil (como enlace) y pantalla de nivel. |
| Opciones para elegir | `chip` | Formularios. La elegida va clara; no azul. |
| Etiquetas | `tag`, `tag tag--linea`, `pill` | JUSTO (azul), AMIGO (con borde), Nivel N (gris). |
| Cartel de abajo | `Sheet` | Preguntas y confirmaciones. |
| Título de sección | `h sub` (`sub--accent` si pide atención) | Encima de cada lista. |

Para agrupar filas con su título se usa `<div className="lista">`: mantiene las filas pegadas entre sí aunque la pantalla separe más los bloques.

## Movimiento

- Lo que se toca se achica apenas al apretarlo (entre 2 y 6 %, en 120 a 140 ms). Es la respuesta al toque.
- Los carteles suben desde abajo en 300 ms; los avisos bajan en 240 ms. Nada dura más.
- Lo que entra frena al llegar (`--ease-out`). No hay rebotes. Lo que se mueve solo es lento y suave: la franja de la búsqueda sin vencimiento, y en el Inicio los anillos, el brillo del título y dos manchas de luz del fondo.
- Con "reducir movimiento" activado en el celular, no se mueve nada.
- Los efectos al pasar el mouse existen solo en computadora, para que en el celular nada quede "pegado" después de un toque.

## Al agregar una pantalla

1. Cabecera con `Head` (título y, si corresponde, flecha para volver).
2. Contenido en `scroll` > `pad`.
3. ¿Cuál es la acción principal? Esa sola va en azul lleno.
4. Listas como filas; cajas solo para bloques.
5. Barra inferior (`TabBar`) con la pestaña que corresponda.
6. Correr `npm run probar` y `node scripts/recorrido.mjs` para mirar las capturas.
