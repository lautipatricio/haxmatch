import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { REAL } from '../config'
import { RESULTADO_TIKTOK, tiktokHabilitado } from '../data/clips'
import { seedReels } from '../data/seed'
import { YO, feed, nombreDe, useStore } from '../data/store'
import { nivelDe, totalPuntos } from '../domain/rules'
import type { Reel } from '../domain/types'
import { Avatar, BannerBusqueda, Empty, Head, Icon, Sheet, TabBar, hace, useAhora } from '../ui'

const TIKTOK = 'https://www.tiktok.com'
// Reproductor de TikTok sin sus textos ni videos relacionados: eso lo muestra HaxMatch.
const OPCIONES = 'controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=0&timestamp=0&loop=1&autoplay=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0'

/**
 * Video de TikTok, reproducido desde TikTok (no se copia). Encima va una capa
 * que recibe los toques: así se puede deslizar al clip siguiente, cosa que
 * sobre el reproductor solo no se podría. Un toque reproduce o pausa.
 */
function Reproductor({ id, titulo, activo }: { id: string; titulo: string; activo: boolean }) {
  const marco = useRef<HTMLIFrameElement>(null)
  const [listo, setListo] = useState(false)
  const [andando, setAndando] = useState(false)
  /** Si el reproductor no obedece (algunos celulares exigen tocar el video mismo), se saca la capa. */
  const [directo, setDirecto] = useState(false)
  /** Espera para ver si el reproductor obedeció el "play". */
  const espera = useRef<number | null>(null)
  const noEsperar = () => {
    if (espera.current !== null) window.clearTimeout(espera.current)
    espera.current = null
  }

  const mandar = (type: 'play' | 'pause') =>
    marco.current?.contentWindow?.postMessage({ 'x-tiktok-player': true, type }, TIKTOK)

  useEffect(() => {
    const oir = (e: MessageEvent) => {
      if (e.origin !== TIKTOK || e.source !== marco.current?.contentWindow) return
      const d = e.data as { 'x-tiktok-player'?: boolean; type?: string; value?: unknown } | null
      if (!d || d['x-tiktok-player'] !== true) return
      if (d.type === 'onPlayerReady') setListo(true)
      if (d.type === 'onStateChange') {
        const anda = d.value === 1 || d.value === 3
        setAndando(anda)
        // Obedeció: no hace falta el plan B.
        if (anda) noEsperar()
      }
    }
    window.addEventListener('message', oir)
    return () => {
      window.removeEventListener('message', oir)
      noEsperar()
    }
  }, [])

  // Al pasar a otro clip, este se pausa.
  useEffect(() => {
    if (!activo) {
      noEsperar()
      mandar('pause')
      setAndando(false)
    }
  }, [activo])

  const tocar = () => {
    noEsperar()
    if (andando) {
      mandar('pause')
      return
    }
    // Hasta que el reproductor no avisa que está listo, no hay a quién pedirle nada.
    if (!listo) return
    mandar('play')
    // Si en un momento no arrancó, el celular exige tocar el video mismo: se saca la capa.
    espera.current = window.setTimeout(() => setDirecto(true), 2000)
  }

  return (
    <div className="reel__video">
      <iframe ref={marco} src={`${TIKTOK}/player/v1/${id}?${OPCIONES}`} title={titulo || 'Video de TikTok'}
        allow="autoplay; encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
      {!directo && (
        <button type="button" className="reel__toque" aria-label={andando ? 'Pausar' : 'Reproducir'} onClick={tocar}>
          {!andando && <span><Icon name="play" size={40} /></span>}
          {!listo && <span className="m">Cargando el video de TikTok…</span>}
        </button>
      )}
    </div>
  )
}

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

  // Con servidor: se traen los clips al entrar y cada tanto mientras la pantalla está abierta.
  useEffect(() => {
    void cargar()
    const t = setInterval(() => void cargar(), 60000)
    return () => clearInterval(t)
  }, [cargar])

  // Cuál es el clip que está en pantalla: solo ese (y sus vecinos) cargan el reproductor.
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
        <div className="feed" ref={lista} aria-label="Clips. Deslizá para pasar al siguiente">
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
                  // Solo el clip en pantalla y sus vecinos cargan el reproductor.
                  Math.abs(i - activo) <= 1 && <Reproductor id={r.tiktokId} titulo={r.titulo} activo={i === activo} />
                ) : (
                  <div className="reel__play">
                    <span><Icon name="play" size={40} /></span>
                    <span className="m">
                      {REAL
                        ? 'Clip de muestra. Cuando alguien vincule su TikTok, acá van a aparecer los clips de verdad.'
                        : 'Video de TikTok. En esta versión de prueba no se reproduce.'}
                    </span>
                  </div>
                )}
                <div className="reel__info">
                  <div className="strong cut">@{nombreDe(s, r.userId)}{nivel !== null && ` · Nivel ${nivel}`}</div>
                  <div className="titulo">{r.titulo}</div>
                  <div className="m cut">{detalle}</div>
                  {r.enlace && <a className="m reel__enlace" href={r.enlace} target="_blank" rel="noopener noreferrer">Ver en TikTok</a>}
                </div>
                <div className="reel__acts">
                  <Avatar user={autor} nombre={nombreDe(s, r.userId)} foto={mio ? s.perfil?.foto : null} />
                  <button className="like like--col num" aria-pressed={reaccione} aria-label={reaccione ? 'Quitar reacción' : 'Reaccionar'}
                    onClick={reaccionar}>
                    <Icon name="corazon" size={30} fill={reaccione} />{r.reacciones + (reaccione ? 1 : 0)}
                  </button>
                </div>
                {i === 0 && reels.length > 1 && <div className="reel__pista">Deslizá hacia arriba para ver el siguiente</div>}
              </article>
            )
          })}
        </div>
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
