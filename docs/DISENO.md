# Diseño de HaxMatch ("Cancha")

Cómo se ve la app y por qué. Sirve para que una pantalla nueva quede igual a las demás.
Todo está en `src/styles.css`; las piezas compartidas, en `src/ui/index.tsx`.

## Idea

Una app de fútbol que se usa con una mano, apurado, entre partido y partido. Oscura, con verde de cancha de fondo y un solo color fuerte. Poco texto, números grandes, nada que distraiga de las dos cosas que se vienen a hacer: jugar un amistoso o completar una sala.

## Colores

| Nombre | Valor | Para qué |
|---|---|---|
| `--bg` | `#0E1512` | Fondo de la app |
| `--card` | `#17211C` | Bloques y carteles |
| `--mute` | `#24332B` | Botones secundarios, líneas entre filas, fondo de las barras |
| `--line` | `#2F4238` | Bordes |
| `--fg` | `#EAF2EC` | Texto |
| `--fg2` | `#9FB3A6` | Texto secundario |
| `--accent` | `#FFD84D` | **Solo** la acción principal de la pantalla y lo que pide atención |
| `--danger` | `#FF8A7A` | Errores y acciones que no se deshacen |
| `--vivo` | `#6FD08C` | El punto de "hay gente buscando" |

Reglas:

- **Un amarillo lleno por pantalla**, en lo que más importa hacer ahí. Lo que pide atención sin ser la acción principal (algo por confirmar, una búsqueda abierta) lleva **borde** amarillo, no fondo.
- Cancelar o salir no va en amarillo ni en rojo lleno: texto rojo (`btn--quieto`) o gris (`btn--ghost`). El rojo lleno (`btn--danger`) queda para confirmar algo que no se deshace, dentro de un cartel.
- El color nunca es la única señal: siempre hay un texto o un ícono al lado.

## Letras

- **Barlow Condensed** (600; 700 para números y para el botón principal del Inicio): títulos y números. En minúscula, salvo el nombre de la app.
- **Barlow** (400, 500, 600): todo lo demás.
- Tamaños: texto 16; secundario 14 (`.m`); título de pantalla 30; título de sección 14 en gris (`.sub`); etiquetas 11 a 13. Nada más chico que eso.
- Los números que cambian (reloj, puntos) llevan `.num` para que no bailen.

## Formas

- Botones: esquinas de 12 (14 los grandes). Bloques: 20. Fotos: recuadro redondeado (14 en 44 px, 12 en 36, 20 en 64), no círculo.
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
| Opciones para elegir | `chip` | Formularios. La elegida va clara; no amarilla. |
| Etiquetas | `tag`, `tag tag--linea`, `pill` | JUSTO (amarilla), AMIGO (con borde), Nivel N (gris). |
| Cartel de abajo | `Sheet` | Preguntas y confirmaciones. |
| Título de sección | `h sub` (`sub--accent` si pide atención) | Encima de cada lista. |

Para agrupar filas con su título se usa `<div className="lista">`: mantiene las filas pegadas entre sí aunque la pantalla separe más los bloques.

## Movimiento

- Lo que se toca se achica apenas al apretarlo (entre 2 y 6 %, en 120 a 140 ms). Es la respuesta al toque.
- Los carteles suben desde abajo en 300 ms; los avisos bajan en 240 ms. Nada dura más.
- Lo que entra frena al llegar (`--ease-out`). No hay rebotes ni cosas que se muevan solas, salvo la franja de la búsqueda sin vencimiento, que dice "sigo buscando".
- Con "reducir movimiento" activado en el celular, no se mueve nada.
- Los efectos al pasar el mouse existen solo en computadora, para que en el celular nada quede "pegado" después de un toque.

## Al agregar una pantalla

1. Cabecera con `Head` (título y, si corresponde, flecha para volver).
2. Contenido en `scroll` > `pad`.
3. ¿Cuál es la acción principal? Esa sola va en amarillo.
4. Listas como filas; cajas solo para bloques.
5. Barra inferior (`TabBar`) con la pestaña que corresponda.
6. Correr `npm run probar` y `node scripts/recorrido.mjs` para mirar las capturas.
