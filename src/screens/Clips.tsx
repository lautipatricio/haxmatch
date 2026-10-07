import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent, type WheelEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { REAL } from '../config'
import { RESULTADO_TIKTOK, tiktokHabilitado } from '../data/clips'
import { seedReels } from '../data/seed'
import { YO, buscarMia, feed, nombreDe, useStore } from '../data/store'
import { nivelDe, totalPuntos } from '../domain/rules'
import type { Reel } from '../domain/types'
import { Avatar, BannerBusqueda, Empty, Head, Icon, Portada, Sheet, TabBar, hace, useAhora } from '../ui'

const TIKTOK = 'https://www.tiktok.com'
// Reproductor de TikTok sin sus textos, sus videos relacionados ni su barra de controles:
// el clip arranca solo y el sonido se maneja con el botón de HaxMatch.
// Va con autoplay=1: sin eso el reproductor de TikTok no se pone en marcha (ni avisa
// que está listo, ni obedece) hasta que alguien toca el video mismo.
const opciones = (controles: boolean) => {
  const c = controles ? 1 : 0
  return `controls=${c}&progress_bar=${c}&play_button=${c}&volume_control=${c}&fullscreen_button=0&timestamp=0&loop=1&autoplay=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`
}

const CLAVE_SONIDO = 'haxmatch-sonido'
const leerSonido = () => {
  try { return window.localStorage.getItem(CLAVE_SONIDO) !== '0' } catch { return true }
}
/** ¿Los clips van con sonido? Se elige una vez y vale para todos los clips, también la próxima vez que se abre la app. */
let quiereSonido = leerSonido()
/** ¿Ya sonó algún clip desde que se abrió la app? El cartel grande de "Activar sonido" sale solo antes de eso. */
let yaSono = false
const elegirSonido = (si: boolean) => {
  quiereSonido = si
  try { window.localStorage.setItem(CLAVE_SONIDO, si ? '1' : '0') } catch { /* sin almacenamiento: vale mientras la app está abierta */ }
}

type AvisoTikTok = { 'x-tiktok-player'?: boolean; type?: string; value?: unknown }
/** El reproductor de TikTok manda sus avisos como texto; se aceptan las dos formas. */
function leerAviso(dato: unknown): AvisoTikTok | null {
  if (typeof dato === 'string') {
    if (!dato.startsWith('{')) return null
    try { return JSON.parse(dato) as AvisoTikTok } catch { return null }
  }
  return dato && typeof dato === 'object' ? dato as AvisoTikTok : null
}

/**
 * Video de TikTok, reproducido desde TikTok (no se copia). Arranca solo cuando
 * el clip queda en pantalla. Los navegadores solo dejan arrancar sin sonido,
 * así que al arrancar se pide el sonido (si el usuario no lo silenció). Si el
 * celular no lo permite sin un toque, el video sigue sin sonido y alcanza con
 * tocarlo una vez.
 * Encima va una capa que recibe los toques: así se puede deslizar al clip
 * siguiente, cosa que sobre el reproductor solo no se podría.
 */
function Reproductor({ id, titulo }: { id: string; titulo: string }) {
  const marco = useRef<HTMLIFrameElement>(null)
  const [listo, setListo] = useState(false)
  const [arranco, setArranco] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [mudo, setMudo] = useState(true)
  /** El celular no dejó activar el sonido sin que el usuario toque. */
  const [trabado, setTrabado] = useState(false)
  /** Si el reproductor no obedece, se saca la capa y se usan los controles de TikTok. */
  const [directo, setDirecto] = useState(false)
  const r = useRef({ listo: false, mudo: true, anda: false, pausaMia: false, pedido: 0, conToque: false, probado: false, reloj: 0 })

  const mandar = useCallback((type: string) => {
    marco.current?.contentWindow?.postMessage({ 'x-tiktok-player': true, type }, TIKTOK)
  }, [])
  const pedirSonido = useCallback((conToque: boolean) => {
    const x = r.current
    x.probado = true; x.conToque = conToque; x.pedido = Date.now()
    mandar('unMute')
    // Si un rato después sigue andando y con sonido, ya está: los próximos clips no muestran el cartel grande.
    window.setTimeout(() => { if (x.anda && !x.mudo) { yaSono = true; setTrabado(false) } }, 1800)
  }, [mandar])

  useEffect(() => {
    const x = r.current
    const oir = (e: MessageEvent) => {
      if (e.origin !== TIKTOK || e.source !== marco.current?.contentWindow) return
      const d = leerAviso(e.data)
      if (!d || d['x-tiktok-player'] !== true) return
      if (d.type === 'onPlayerReady' || d.type === 'onStateChange') { x.listo = true; setListo(true) }
      if (d.type === 'onMute') { x.mudo = d.value === true; setMudo(x.mudo) }
      // No pudo arrancar solo (o falló): que se pueda tocar el video mismo.
      if (d.type === 'onPlayerError') setDirecto(true)
      if (d.type === 'onStateChange' && d.value === 1) {
        x.anda = true; x.pausaMia = false
        setArranco(true); setPausado(false)
        // Arrancó sin sonido: se pide una vez.
        if (quiereSonido && x.mudo && !x.probado) pedirSonido(false)
      }
      if (d.type === 'onStateChange' && d.value === 2) {
        x.anda = false
        if (x.pausaMia) setPausado(true)
        else if (Date.now() - x.pedido < 1500) {
          // Se frenó al pedirle sonido. Puede ser un tropiezo: se le pide que siga. Si no
          // sigue, es que el celular no deja sonar sin un toque: entonces sigue sin sonido.
          x.pedido = 0
          mandar('play')
          window.clearTimeout(x.reloj)
          x.reloj = window.setTimeout(() => {
            if (x.anda || x.pausaMia) return
            mandar('mute'); mandar('play')
            setTrabado(true)
            // Ni tocando: se muestran los controles del propio video.
            if (x.conToque) setDirecto(true)
          }, 700)
        }
      }
    }
    // Si se va a otra app o pestaña, el clip no sigue sonando.
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') { x.pausaMia = true; mandar('pause') }
    }
    window.addEventListener('message', oir)
    document.addEventListener('visibilitychange', alOcultar)
    // Si en un rato el reproductor no dio señales, se deja tocar el video mismo.
    const t = window.setTimeout(() => { if (!x.listo) setDirecto(true) }, 10000)
    return () => {
      window.removeEventListener('message', oir)
      document.removeEventListener('visibilitychange', alOcultar)
      window.clearTimeout(t); window.clearTimeout(x.reloj)
    }
  }, [mandar, pedirSonido])

  /** Un toque en el video: si está sin sonido y el usuario lo quiere con sonido, lo activa; si no, pausa o sigue. */
  const tocar = () => {
    const x = r.current
    if (!listo) return
    if (pausado) { x.pausaMia = false; mandar('play') }
    if (mudo && quiereSonido) pedirSonido(true)
    else if (!pausado) { x.pausaMia = true; mandar('pause') }
  }
  const sonido = () => {
    if (mudo) { elegirSonido(true); pedirSonido(true) }
    else { elegirSonido(false); setTrabado(false); mandar('mute') }
  }
  const pedir = trabado && mudo && quiereSonido

  return (
    <div className="reel__video">
      <iframe ref={marco} key={directo ? 'directo' : 'capa'} src={`${TIKTOK}/player/v1/${id}?${opciones(directo)}`} title={titulo || 'Video de TikTok'}
        allow="autoplay; encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
      {!directo && (
        <>
          <button type="button" className="reel__toque" onClick={tocar}
            aria-label={pausado ? 'Reproducir' : pedir ? 'Tocar para activar el sonido' : 'Pausar'}>
            {pausado && <span><Icon name="play" size={40} /></span>}
            {!arranco && <span className="m">Cargando el video de TikTok…</span>}
          </button>
          {arranco && (
            <button type="button" className={`reel__sonido${pedir && !yaSono ? ' reel__sonido--pedir' : ''}`}
              aria-label={mudo ? 'Activar el sonido' : 'Silenciar'} aria-pressed={!mudo} onClick={sonido}>
              <Icon name={mudo ? 'mudo' : 'sonido'} size={20} />
              {pedir && <span>{yaSono ? 'Tocá para el sonido' : 'Activar sonido'}</span>}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** Cuánto hay que deslizar hacia abajo (ya frenado a la mitad) para que busque clips nuevos. */
const UMBRAL = 64

/** Feed de clips: un video por pantalla, se pasa al siguiente deslizando (como TikTok). */
export function Clips() {
  const s = useStore()
  const ahora = useAhora()
  const cargar = s.cargarClips
  const reales = feed(s)
  // Mientras nadie haya vinculado su TikTok, se muestran clips de muestra para que la pantalla no quede vacía.
  const muestras = useMemo(() => seedReels(Date.now()), [])
  const deMuestra = REAL && s.clipsListos && reales.length === 0
  const reels: Reel[] = deMuestra ? muestras : reales
  const miNivel = nivelDe(totalPuntos(s.eventos, YO))
  const lista = useRef<HTMLDivElement>(null)
  /** Clip que está en pantalla. Se guarda cuál es (no su posición): la lista puede cambiar mientras se mira. */
  const [enPantalla, setEnPantalla] = useState<string | null>(null)
  const ids = reels.map((r) => r.id).join(',')
  const posicion = reels.findIndex((r) => r.id === enPantalla)
  const activo = posicion === -1 ? 0 : posicion
  /** Reacciones a los clips de muestra: no se guardan. */
  const [gustan, setGustan] = useState<string[]>([])
  /** Con una búsqueda abierta, arriba va su cartel: lo que está debajo se corre. */
  const conCartel = useStore(buscarMia) !== undefined

  // Llegar directo a un clip (desde el perfil): /clips?v=<clip>.
  const [parametros, setParametros] = useSearchParams()
  const pedido = parametros.get('v')
  useEffect(() => {
    if (!pedido || !lista.current) return
    const el = [...lista.current.querySelectorAll<HTMLElement>('.reel')].find((x) => x.dataset.id === pedido)
    if (!el) return
    lista.current.scrollTop = el.offsetTop
    setEnPantalla(pedido)
    setParametros({}, { replace: true })
  }, [pedido, ids, s.clipsListos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deslizar hacia abajo estando en el primer clip (o girar la rueda hacia arriba): busca clips nuevos.
  const [tiron, setTiron] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [novedad, setNovedad] = useState<string | null>(null)
  const gesto = useRef({ desde: null as number | null, tiron: 0, rueda: 0, ruedaAt: -1e9, ruedaArriba: false, ocupado: false })
  const refrescar = s.refrescarClips
  const actualizar = useCallback(async () => {
    const g = gesto.current
    if (g.ocupado) return
    g.ocupado = true
    setNovedad(null); setBuscando(true)
    const texto = await refrescar()
    setBuscando(false); setNovedad(texto)
    // Los clips nuevos entran arriba de todo: se vuelve ahí para verlos.
    window.requestAnimationFrame(() => lista.current?.scrollTo({ top: 0, behavior: 'smooth' }))
    window.setTimeout(() => { setNovedad(null); g.ocupado = false }, 2500)
  }, [refrescar])
  const arriba = () => (lista.current?.scrollTop ?? 1) <= 0
  const alTocar = (e: TouchEvent) => {
    const g = gesto.current
    g.desde = !g.ocupado && arriba() ? e.touches[0].clientY : null
    g.tiron = 0
  }
  const alMover = (e: TouchEvent) => {
    const g = gesto.current
    if (g.desde === null) return
    // Si la lista se movió, es un deslizamiento común y no un pedido de actualizar.
    if (!arriba()) g.desde = null
    g.tiron = g.desde === null ? 0 : Math.max(0, Math.min((e.touches[0].clientY - g.desde) * 0.5, 96))
    setTiron(g.tiron)
  }
  const alSoltar = () => {
    const g = gesto.current
    const llego = g.desde !== null && g.tiron >= UMBRAL
    g.desde = null; g.tiron = 0
    setTiron(0)
    if (llego) void actualizar()
  }
  const alRodar = (e: WheelEvent) => {
    const g = gesto.current
    // Cuenta solo un giro que empezó estando arriba de todo (no el envión de haber vuelto al primero).
    if (e.timeStamp - g.ruedaAt > 400) { g.rueda = 0; g.ruedaArriba = arriba() }
    g.ruedaAt = e.timeStamp
    if (g.ocupado || !g.ruedaArriba || e.deltaY >= 0) { g.rueda = 0; return }
    g.rueda -= e.deltaY
    if (g.rueda > 150) { g.rueda = 0; g.ruedaArriba = false; void actualizar() }
  }

  // Con servidor: se traen los clips al entrar y cada tanto mientras la pantalla está abierta.
  useEffect(() => {
    void cargar()
    const t = setInterval(() => void cargar(), 60000)
    return () => clearInterval(t)
  }, [cargar])

  // Cuál es el clip que está en pantalla: solo ese carga el reproductor, y arranca solo.
  useEffect(() => {
    const caja = lista.current
    if (!caja) return
    const mirar = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) setEnPantalla((e.target as HTMLElement).dataset.id ?? null)
      }
    }, { root: caja, threshold: [0.6] })
    caja.querySelectorAll('.reel').forEach((el) => mirar.observe(el))
    return () => mirar.disconnect()
  }, [ids])

  if (REAL && !s.clipsListos) {
    return (
      <div className="screen">
        <Head title="Clips" />
        <div className="pad" role="status" aria-label="Cargando"><div className="skeleton" /><div className="skeleton" /></div>
        <TabBar on="clips" />
      </div>
    )
  }

  if (reels.length === 0) {
    return (
      <div className="screen">
        <Head title="Clips" />
        <BannerBusqueda detalle="Te avisamos cuando haya respuesta" />
        <Empty title="Sin clips todavía" text="Los clips salen de TikTok. Vinculá tu cuenta y usá #haxball o #haxmatch en tus videos.">
          <Link className="btn" to="/clips/mis-videos">Vincular TikTok</Link>
        </Empty>
        <TabBar on="clips" />
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="screen">
        <div className={`feed${conCartel ? ' feed--cartel' : ''}`} ref={lista} aria-label="Clips. Deslizá para pasar al siguiente. En el primero, deslizá hacia abajo para buscar clips nuevos"
          onTouchStart={alTocar} onTouchMove={alMover} onTouchEnd={alSoltar} onTouchCancel={alSoltar} onWheel={alRodar}>
          {reels.map((r, i) => {
            const mio = r.userId === YO
            const autor = s.usuarios[r.userId]
            const reaccione = deMuestra ? gustan.includes(r.id) : s.misReacciones.includes(r.id)
            const nivel = mio ? miNivel : autor?.nivel ?? null
            // En los clips de TikTok los hashtags ya vienen en la descripción: no se repiten.
            const detalle = [r.formato, hace(ahora - r.publicadoAt), r.tiktokId ? '' : r.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join(' · ')
            const reaccionar = () => (deMuestra
              ? setGustan((g) => (g.includes(r.id) ? g.filter((x) => x !== r.id) : [...g, r.id]))
              : s.reaccionar(r.id))
            return (
              <article key={r.id} data-id={r.id} className={`reel${r.tiktokId ? ' reel--video' : ''}`} style={{ '--tinte': autor?.color } as CSSProperties}
                aria-label={`${r.titulo}, de ${nombreDe(s, r.userId)}`}>
                {r.tiktokId ? (
                  <>
                    {/* Solo el clip en pantalla carga el reproductor; los demás muestran su miniatura. */}
                    {i === activo
                      ? <Reproductor key={r.tiktokId} id={r.tiktokId} titulo={r.titulo} />
                      : <div className="reel__video reel__video--espera"><Portada src={r.portada} /><span><Icon name="play" size={40} /></span></div>}
                    {/* Del lado derecho quedan los números de TikTok: lo de HaxMatch va a la izquierda. */}
                    <div className="reel__info reel__info--video">
                      <div className="row" style={{ gap: 8 }}>
                        <Avatar user={autor} nombre={nombreDe(s, r.userId)} foto={mio ? s.perfil?.foto : null} size="sm" />
                        <div className="strong cut">@{nombreDe(s, r.userId)}{nivel !== null && ` · Nivel ${nivel}`}</div>
                      </div>
                      <div className="titulo">{r.titulo}</div>
                      <div className="row" style={{ gap: 10 }}>
                        <button className="like num" aria-pressed={reaccione} aria-label={reaccione ? 'Quitar reacción' : 'Reaccionar'} onClick={reaccionar}>
                          <Icon name="corazon" size={26} fill={reaccione} />{r.reacciones + (reaccione ? 1 : 0)}
                        </button>
                        <span className="m cut">{detalle}</span>
                        {r.enlace && <a className="m reel__enlace" href={r.enlace} target="_blank" rel="noopener noreferrer">Ver en TikTok</a>}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="reel__play">
                      <span><Icon name="play" size={40} /></span>
                      <span className="m">
                        {REAL
                          ? 'Clip de muestra. Cuando alguien vincule su TikTok, acá van a aparecer los clips de verdad.'
                          : 'Video de TikTok. En esta versión de prueba no se reproduce.'}
                      </span>
                    </div>
                    <div className="reel__info">
                      <div className="strong cut">@{nombreDe(s, r.userId)}{nivel !== null && ` · Nivel ${nivel}`}</div>
                      <div className="titulo">{r.titulo}</div>
                      <div className="m cut">{detalle}</div>
                    </div>
                    <div className="reel__acts">
                      <Avatar user={autor} nombre={nombreDe(s, r.userId)} foto={mio ? s.perfil?.foto : null} />
                      <button className="like like--col num" aria-pressed={reaccione} aria-label={reaccione ? 'Quitar reacción' : 'Reaccionar'}
                        onClick={reaccionar}>
                        <Icon name="corazon" size={30} fill={reaccione} />{r.reacciones + (reaccione ? 1 : 0)}
                      </button>
                    </div>
                  </>
                )}
                {i === 0 && reels.length > 1 && <div className="reel__pista">Deslizá hacia arriba para ver el siguiente</div>}
              </article>
            )
          })}
        </div>
        {(tiron > 0 || buscando || novedad) && (
          <div className="feed-aviso" role="status"
            style={!buscando && !novedad ? { opacity: Math.min(1, tiron / UMBRAL), transform: `translate(-50%, ${Math.round(tiron - UMBRAL)}px)` } : undefined}>
            {buscando ? 'Buscando clips nuevos…' : novedad ?? (tiron >= UMBRAL ? 'Soltá para actualizar' : 'Deslizá para actualizar')}
          </div>
        )}
        <div className="feed-top">
          <Head title="Clips">
            <Link className="btn btn--sec" to="/clips/mis-videos">{s.tiktok ? 'Mis videos' : 'Vincular TikTok'}</Link>
          </Head>
          <BannerBusqueda detalle="Te avisamos cuando haya respuesta" />
        </div>
      </div>
      <TabBar on="clips" />
    </div>
  )
}

const conHashtag = (h: string[]) => h.some((x) => x === 'haxball' || x === 'haxmatch')

/** Cuenta de TikTok vinculada: estado, actualizar y desvincular. Solo con servidor. */
function CuentaTikTok() {
  const s = useStore()
  const ahora = useAhora()
  const [ocupado, setOcupado] = useState(false)
  const [problema, setProblema] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const info = s.tiktokInfo
  const actualizar = async () => {
    setOcupado(true)
    setProblema(await s.actualizarTikTok())
    setOcupado(false)
  }
  const desvincular = async () => {
    setConfirmar(false)
    setOcupado(true)
    setProblema(await s.desvincularTikTok())
    setOcupado(false)
  }
  const volver = async () => {
    setOcupado(true)
    setProblema(await s.vincularTikTok())
    setOcupado(false)
  }
  return (
    <div className={`card card--col${info?.error ? ' card--accent' : ''}`}>
      <div className="row">
        <Avatar nombre="T" />
        <div className="grow">
          <div className="strong cut">TikTok vinculado{info?.nombre ? `: ${info.nombre}` : ''}</div>
          <div className="m">
            {info?.error ?? (info?.sincronizadaAt ? `Videos actualizados ${hace(ahora - info.sincronizadaAt)}` : 'Trayendo tus videos…')}
          </div>
        </div>
      </div>
      {problema && <div className="err" role="alert">{problema}</div>}
      {info?.error ? (
        <button className="btn" disabled={ocupado} onClick={() => void volver()}>Volver a vincular</button>
      ) : (
        <button className="btn btn--sec" disabled={ocupado} onClick={() => void actualizar()}>{ocupado ? 'Actualizando…' : 'Actualizar mis videos'}</button>
      )}
      <button className="btn btn--ghost" disabled={ocupado} onClick={() => setConfirmar(true)}>Desvincular TikTok</button>
      {confirmar && (
        <Sheet title="¿Desvincular TikTok?">
          <div>Se borran de HaxMatch todos tus videos y sus reacciones, y se anula el permiso que nos diste en TikTok. En TikTok tus videos quedan como están.</div>
          <button className="btn btn--danger" onClick={() => void desvincular()}>Sí, desvincular</button>
          <button className="btn btn--sec" onClick={() => setConfirmar(false)}>Cancelar</button>
        </Sheet>
      )}
    </div>
  )
}

export function MisVideos() {
  const s = useStore()
  const ahora = useAhora()
  const nav = useNavigate()
  const cargar = s.cargarClips
  const [parametros] = useSearchParams()
  const vuelta = RESULTADO_TIKTOK[parametros.get('tiktok') ?? '']
  const [aviso, setAviso] = useState(vuelta ?? null)
  const [habilitado, setHabilitado] = useState<boolean | null>(REAL ? null : true)
  const [ocupado, setOcupado] = useState(false)
  const mios = s.reels.filter((r) => r.userId === YO).sort((a, b) => b.publicadoAt - a.publicadoAt)

  useEffect(() => {
    void cargar()
    if (REAL) void tiktokHabilitado().then(setHabilitado)
    // El resultado de volver de TikTok se muestra una vez: se saca de la dirección.
    if (parametros.get('tiktok')) nav('/clips/mis-videos', { replace: true })
  }, [cargar]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vinculado pero todavía sin videos traídos (TikTok tardó o falló al vincular): se piden una vez.
  const pedidos = useRef(false)
  const faltaTraer = REAL && s.tiktok && !!s.tiktokInfo && s.tiktokInfo.sincronizadaAt === null && !s.tiktokInfo.error
  const actualizar = s.actualizarTikTok
  useEffect(() => {
    if (!faltaTraer || pedidos.current) return
    pedidos.current = true
    void actualizar()
  }, [faltaTraer, actualizar])

  const vincular = async () => {
    setOcupado(true)
    const problema = await s.vincularTikTok()
    // Si todo va bien, con servidor la página ya se está yendo a TikTok.
    if (problema) setAviso({ ok: false, texto: problema })
    setOcupado(false)
  }

  return (
    <div className="screen">
      <Head title="Mis videos" back="/clips" />
      <div className="scroll">
        <div className="pad">
          {aviso && <div className={aviso.ok ? 'ok' : 'err'} role="status">{aviso.texto}</div>}
          {REAL && !s.clipsListos ? (
            <div role="status" aria-label="Cargando"><div className="skeleton" /><div className="skeleton" /></div>
          ) : !s.tiktok ? (
            <>
              <div className="card card--col">
                <div className="strong">Vinculá tu cuenta de TikTok</div>
                <ul className="steps m">
                  <li>Traemos la lista de tus videos públicos a tu biblioteca.</li>
                  <li>En Clips aparecen solo los que tienen #haxball o #haxmatch.</li>
                  <li>Cada video tiene un interruptor para mostrarlo u ocultarlo.</li>
                  <li>Los videos se reproducen desde TikTok. No se copian a HaxMatch.</li>
                  {REAL && <li>Podés desvincular cuando quieras: se borra todo lo que trajimos.</li>}
                </ul>
              </div>
              {habilitado === false ? (
                <div className="card card--col">
                  <div className="strong">Todavía no se puede vincular</div>
                  <div className="m">Estamos terminando de habilitar la conexión con TikTok. Va a estar disponible en una próxima actualización.</div>
                </div>
              ) : (
                <button className="btn btn--lg btn--block" disabled={ocupado || habilitado === null} onClick={() => void vincular()}>
                  {ocupado ? 'Abriendo TikTok…' : 'Vincular TikTok'}
                </button>
              )}
              <p className="m center" style={{ margin: 0 }}>
                {REAL
                  ? 'Te llevamos a TikTok para que des el permiso. Solo pedimos tu nombre y la lista de tus videos públicos.'
                  : 'Versión de prueba: la vinculación está simulada.'}
              </p>
            </>
          ) : (
            <>
              {REAL && <CuentaTikTok />}
              <div className="m">Los videos nuevos con #haxball o #haxmatch se suman solos. El primero de cada día da 8 puntos.</div>
              {mios.length === 0 && <div className="m">Todavía no trajimos ningún video de tu cuenta.</div>}
              {mios.map((r) => {
                const apto = conHashtag(r.hashtags)
                return (
                  <div key={r.id} className="card card--row">
                    <div className="grow">
                      <div className="strong cut">{r.titulo || 'Video sin descripción'}</div>
                      <div className="m cut">
                        {apto
                          ? `${r.hashtags.map((h) => `#${h}`).join(' ')} · ${hace(ahora - r.publicadoAt)}`
                          : 'Sin #haxball ni #haxmatch: no aparece en Clips'}
                      </div>
                    </div>
                    <button className="switch" role="switch" aria-checked={apto && r.visible} disabled={!apto}
                      aria-label={`Mostrar "${r.titulo}" en Clips`} onClick={() => s.alternarVisible(r.id)} />
                  </div>
                )
              })}
              {!REAL && (
                <div className="demo">
                  <div className="h">Herramienta de prueba</div>
                  <button className="btn btn--sec" onClick={s.simularVideoNuevo}>Simular un video nuevo con #haxmatch</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <TabBar on="clips" />
    </div>
  )
}
