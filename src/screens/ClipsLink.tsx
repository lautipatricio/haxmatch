// Clips subidos pegando un link de TikTok o YouTube: subirlos, verlos en revisión
// y, para quien administra, aprobarlos o rechazarlos.
import { useState, type FormEvent } from 'react'
import { YO, nombreDe, useStore, usuarioDe } from '../data/store'
import type { ClipLink } from '../domain/types'
import { Avatar, Sheet, hace, useAhora } from '../ui'

const TITULO_MAX = 80

/** Video de YouTube en el feed. Arranca solo y sin sonido (así lo permiten los navegadores); el sonido, con sus controles. */
export function ReproductorYouTube({ id, titulo }: { id: string; titulo: string }) {
  return (
    <div className="reel__video reel__video--directo">
      <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${id}&rel=0`}
        title={titulo || 'Video de YouTube'} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  )
}

/** Vista previa chica, con los controles del propio video (para revisar antes de aprobar). */
function VistaPrevia({ c }: { c: ClipLink }) {
  const src = c.plataforma === 'tiktok'
    ? `https://www.tiktok.com/player/v1/${c.videoId}?controls=1&progress_bar=1&play_button=1&volume_control=1&music_info=0&description=0&rel=0&autoplay=0`
    : `https://www.youtube-nocookie.com/embed/${c.videoId}?playsinline=1&rel=0`
  return (
    <div className="clip-previa">
      <iframe src={src} title={`Vista previa: ${c.titulo}`} allow="encrypted-media; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  )
}

const plataforma = (c: ClipLink) => (c.plataforma === 'tiktok' ? 'TikTok' : 'YouTube')

/** Pegar el link de un clip y mandarlo a revisar. */
export function SubirClip({ onCerrar }: { onCerrar: () => void }) {
  const subir = useStore((s) => s.subirClip)
  const [enlace, setEnlace] = useState('')
  const [titulo, setTitulo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setError(null)
    const problema = await subir(enlace, titulo)
    setOcupado(false)
    if (problema) setError(problema)
    else onCerrar()
  }
  return (
    <Sheet title="Subir un clip" onCerrar={onCerrar}>
      <form className="lista" onSubmit={(e) => void enviar(e)}>
        <div className="m">Pegá el link de un video público tuyo de TikTok o de YouTube. Lo revisamos y, si es de HaxBall, aparece en Clips.</div>
        <label className="h sub" htmlFor="clip-link">Link del video</label>
        <input id="clip-link" className="field" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false}
          value={enlace} maxLength={300} placeholder="https://www.tiktok.com/@vos/video/…" aria-invalid={!!error}
          onChange={(e) => { setEnlace(e.target.value); setError(null) }} />
        <label className="h sub" htmlFor="clip-titulo">Título</label>
        <input id="clip-titulo" className="field" type="text" autoComplete="off" value={titulo} maxLength={TITULO_MAX}
          placeholder="Golazo desde mitad de cancha" onChange={(e) => { setTitulo(e.target.value); setError(null) }} />
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn btn--lg" type="submit" disabled={ocupado || !enlace.trim() || !titulo.trim()}>
          {ocupado ? 'Enviando…' : 'Mandar a revisar'}
        </button>
        <button className="btn btn--sec" type="button" onClick={onCerrar}>Cancelar</button>
      </form>
    </Sheet>
  )
}

const ESTADO: Record<ClipLink['estado'], string> = { pendiente: 'En revisión', aprobado: 'En Clips', rechazado: 'No aprobado' }

/** Los clips que subí, con cómo va cada uno. */
export function MisClipsSubidos({ onSubir }: { onSubir: () => void }) {
  const mios = useStore((s) => s.misLinks)
  const borrar = useStore((s) => s.borrarClip)
  const ahora = useAhora()
  const [porBorrar, setPorBorrar] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirmar = async (id: string) => {
    if (porBorrar !== id) return setPorBorrar(id)
    setPorBorrar(null)
    setError(await borrar(id))
  }
  return (
    <section className="lista" aria-labelledby="t-subidos">
      <div className="row">
        <h2 id="t-subidos" className="h sub grow">Clips que subiste</h2>
        <button className="btn" onClick={onSubir}>Subir clip</button>
      </div>
      {mios.length === 0 && <div className="m">Pegá el link de un video tuyo de TikTok o YouTube. Lo revisamos antes de que aparezca en Clips.</div>}
      {error && <div className="err" role="alert">{error}</div>}
      {mios.map((c) => (
        <div key={c.id} className="card card--row">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong cut">{c.titulo}</div>
            <div className="m cut">{plataforma(c)} · {hace(ahora - c.creadoAt)}</div>
            {c.estado === 'rechazado' && c.motivo && <div className="m">Motivo: {c.motivo}</div>}
          </div>
          <span className={`pill${c.estado === 'aprobado' ? ' pill--ok' : c.estado === 'rechazado' ? ' pill--no' : ''}`}>{ESTADO[c.estado]}</span>
          <button className={porBorrar === c.id ? 'btn btn--danger' : 'btn btn--ghost'} aria-label={`Borrar "${c.titulo}"`} onClick={() => void confirmar(c.id)}>
            {porBorrar === c.id ? 'Borrar' : 'Quitar'}
          </button>
        </div>
      ))}
    </section>
  )
}

/** Panel: los clips que esperan revisión. */
export function RevisarClips() {
  const s = useStore()
  const ahora = useAhora()
  const [viendo, setViendo] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const revisar = async (c: ClipLink, aprobar: boolean) => {
    setOcupado(c.id)
    setAviso(null)
    const error = await s.revisarClip(c.id, aprobar, aprobar ? '' : motivo)
    setOcupado(null)
    setRechazando(null)
    setMotivo('')
    setAviso(error ? { ok: false, texto: error } : { ok: true, texto: aprobar ? `"${c.titulo}" ya está en Clips.` : `Rechazaste "${c.titulo}".` })
  }
  return (
    <section className="lista" id="clips" aria-labelledby="t-revisar">
      <h2 id="t-revisar" className="h sub">Clips para revisar{s.pendientes.length > 0 && ` (${s.pendientes.length})`}</h2>
      {aviso && <div className={aviso.ok ? 'ok' : 'err'} role="status">{aviso.texto}</div>}
      {s.pendientes.length === 0 && <div className="m">No hay clips esperando revisión.</div>}
      {s.pendientes.map((c) => {
        const u = usuarioDe(s, c.userId)
        return (
          <div key={c.id} className="card card--col">
            <div className="row">
              <Avatar user={c.userId === YO ? undefined : u} nombre={nombreDe(s, c.userId)} size="sm" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="strong cut">{c.titulo}</div>
                <div className="m cut">{nombreDe(s, c.userId)} · {plataforma(c)} · {hace(ahora - c.creadoAt)}</div>
              </div>
            </div>
            {viendo === c.id && <VistaPrevia c={c} />}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn--sec" aria-expanded={viendo === c.id} onClick={() => setViendo(viendo === c.id ? null : c.id)}>
                {viendo === c.id ? 'Ocultar video' : 'Ver video'}
              </button>
              <a className="btn btn--ghost" href={c.enlace} target="_blank" rel="noopener noreferrer">Abrir en {plataforma(c)}</a>
            </div>
            {rechazando === c.id ? (
              <div className="lista">
                <label className="h sub" htmlFor={`motivo-${c.id}`}>Motivo <span className="opcional">(opcional, lo ve quien lo subió)</span></label>
                <input id={`motivo-${c.id}`} className="field" value={motivo} maxLength={200} autoComplete="off" placeholder="No es de HaxBall"
                  onChange={(e) => setMotivo(e.target.value)} />
                <div className="row">
                  <button className="btn btn--danger grow" disabled={ocupado === c.id} onClick={() => void revisar(c, false)}>Rechazar</button>
                  <button className="btn btn--sec" onClick={() => { setRechazando(null); setMotivo('') }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="row">
                <button className="btn grow" disabled={ocupado === c.id} onClick={() => void revisar(c, true)}>Aprobar</button>
                <button className="btn btn--sec grow" disabled={ocupado === c.id} onClick={() => { setRechazando(c.id); setMotivo('') }}>Rechazar…</button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
