export type Formato = '1v1' | '2v2' | '3v3' | '4v4' | 'Cualquiera'
/** "Polifuncional" juega de cualquier cosa: es la opción que abarca a todas. */
export type Posicion = 'Polifuncional' | 'GK' | 'LD' | 'DFC' | 'LI' | 'MC' | 'ED' | 'EI' | 'DC'
export type Cancha = 'Classic' | 'Big' | 'Big Easy' | 'Futsal' | 'Real Futsal' | 'Real Soccer' | 'Cualquiera'
export type Region = 'ARG' | 'CHI' | 'BR' | 'UY'
export type Duracion = '15min' | 'match'
export type Modo = 'jugador' | 'sala'

export const FORMATOS: Formato[] = ['1v1', '2v2', '3v3', '4v4', 'Cualquiera']
export const POSICIONES: Posicion[] = ['Polifuncional', 'GK', 'LD', 'DFC', 'LI', 'MC', 'ED', 'EI', 'DC']
export const CANCHAS: Cancha[] = ['Classic', 'Big', 'Big Easy', 'Futsal', 'Real Futsal', 'Real Soccer', 'Cualquiera']
export const REGIONES: Region[] = ['ARG', 'CHI', 'BR', 'UY']
/** "Cuántos faltan" en modo sala. */
export const FALTAN = [1, 2, 3, 4, 5, 6, 7] as const

export interface Usuario {
  id: string
  /** Nombre que se muestra en la app. */
  username: string
  /** Usuario de Discord, cuando se conoce. */
  discord?: string
  /** Nivel de los demás jugadores. null mientras los niveles no se guarden en el servidor. */
  nivel: number | null
  color: string
  foto?: string | null
  /** Amistosos jugados. Solo en la demostración: con servidor se pide al abrir su perfil. */
  jugados?: number
}

/** Un mensaje del chat general. Duran 24 horas. */
export interface MensajeChat {
  id: string
  userId: string
  texto: string
  at: number
}

export interface Busqueda {
  id: string
  userId: string
  modo: Modo
  /** Se pueden elegir varias opciones. El modo sala no pide formato. */
  formato: Formato[] | null
  posicion: Posicion[]
  cancha: Cancha[]
  region: Region[]
  nombreSala?: string
  /** Sala: link de la sala de HaxBall (opcional). Lo ven el dueño y a quienes la sala les escribió. */
  linkSala?: string | null
  /** Sala: lugares libres en este momento. */
  faltan?: number
  /** Sala: momento en que se llenó. Desde ahí el reloj queda quieto. */
  completaAt?: number | null
  creadaAt: number
  /** null = hasta conseguir partido. */
  expiraAt: number | null
  /** "agrupada": se sumó a la búsqueda de otro jugador y comparte su reloj. */
  estado: 'activa' | 'agrupada' | 'cancelada' | 'vencida' | 'match'
  /** Jugadores que aceptaron sumarse a esta búsqueda. */
  grupo?: string[]
  /** Me sumé a la búsqueda de este jugador: es quien la maneja. */
  liderId?: string
  /** Jugador: el grupo ya es un equipo completo y falta que quien lo armó cree la sala. */
  equipoListo?: boolean
  /** Jugador: se cumplió el tiempo y se le ofreció renovar. Si no responde antes de esta hora, vence. */
  ofertaHasta?: number | null
  /** Sala: partido que reúne a los que fueron entrando. */
  matchId?: string
  /** Sala: jugadores que el dueño rechazó, para no volver a acercárselos. */
  rechazados?: string[]
  /** Respuesta al cartel "¿Te avisamos?". null = todavía no respondió. */
  avisar: boolean | null
}

export interface Participante {
  userId: string
  /** A: quien creó la sala y su grupo. B: los que entran después. */
  equipo: 'A' | 'B'
  /** Confirmación propia ("Ya entré a la sala"). */
  confirmadoAt: number | null
  /** El dueño de la sala marcó "Ya entró". */
  entroAt?: number | null
  /** El dueño marcó "Se salió" cuando el partido ya contaba: dejó el lugar, pero el partido le queda. */
  salioAt?: number | null
}

export interface Match {
  id: string
  /** Quién crea la sala en HaxBall. */
  creadoPor: string
  formato: Formato | null
  cancha: Cancha
  /** Vacío hasta que el creador escribe el nombre. */
  nombreSala: string
  /** Link de la sala de HaxBall, si el dueño lo puso. */
  linkSala?: string | null
  createdAt: number
  participantes: Participante[]
  /** Momento en que el partido pasó a contar como válido. */
  contadoAt: number | null
  /** El usuario dijo que no lo jugó. */
  descartado?: boolean
}

export type TipoPunto = 'amistoso' | 'reel' | 'reaccion' | 'conexion' | 'racha' | 'referido'

export interface EventoPuntos {
  id: string
  userId: string
  tipo: TipoPunto
  puntos: number
  fecha: number
  /** Id de lo que originó el evento (match, reel, referido, día). */
  referencia: string
  /** Para amistosos: rivales, para aplicar el tope por rival. */
  rival?: string
}

export interface Mensaje {
  id: string
  de: string
  a: string
  texto: string
  at: number
  estado: 'pendiente' | 'aceptado' | 'rechazado'
  /** Lo generó el emparejamiento automático de antes (ya no se usa), no una persona. */
  auto?: boolean
  /**
   * Rechazado: ¿dijo que no quien lo recibió? false si se cayó solo (la sala se llenó,
   * alguno dejó de buscar). Sin dato (servidor sin actualizar) se toma como un "no".
   */
  dijoNo?: boolean
  /** Cuándo dijo que no. Por 2 minutos no se le puede volver a escribir. */
  rechazoAt?: number | null
  /** Jugadores que vienen en grupo con quien escribe. */
  con?: string[]
}

export interface Reel {
  id: string
  userId: string
  origen: 'tiktok'
  titulo: string
  hashtags: string[]
  visible: boolean
  publicadoAt: number
  reacciones: number
  /** Solo en los clips de muestra. */
  formato?: Formato
  /** Número del video en TikTok: con eso se arma el reproductor. */
  tiktokId?: string
  /** Dirección del video en TikTok. */
  enlace?: string
  duracion?: number
  /** Miniatura del video. La da TikTok y vence a las 6 horas. */
  portada?: string
  /** Vino con la primera importación, al vincular: no suma puntos. */
  inicial?: boolean
}

export type TipoNotif =
  | 'amigo_disponible' | 'amigo_sala' | 'mensaje' | 'respuesta'
  | 'solicitud' | 'referido' | 'nivel' | 'match'

export interface Notif {
  id: string
  tipo: TipoNotif
  titulo: string
  detalle: string
  at: number
  leida: boolean
  /** Referencia para la acción: mensaje, búsqueda, match o usuario. */
  ref?: string
}

export interface Referido {
  userId: string
  amistosos: number
  acreditado: boolean
  /** Puntos que me sumó al completar (0 si ese mes ya había llegado al tope). Solo con servidor. */
  puntos?: number
}

/** Mis puntos según el servidor. Los movimientos recientes van aparte, en "eventos". */
export interface PuntosServidor {
  total: number
  /** Días seguidos entrando a la app. */
  racha: number
  /** Cuántas veces sumó cada cosa (también las que quedaron en 0 por tope). */
  conteos: Partial<Record<TipoPunto, number>>
  /** Puntos ganados por referidos. */
  deReferidos: number
}

export const MOTIVOS_REPORTE = [
  'No apareció',
  'Abandonó el partido',
  'Comportamiento tóxico',
  'Resultado falso',
] as const
export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number]

export interface Reporte {
  id: string
  reportado: string
  motivo: MotivoReporte
  detalle: string
  at: number
}
