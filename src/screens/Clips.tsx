import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { YO, feed, nombreDe, useStore } from '../data/store'
import { nivelDe, totalPuntos } from '../domain/rules'
import { Avatar, BannerBusqueda, Empty, Head, Icon, TabBar, hace, useAhora } from '../ui'

/** Feed de clips: un video por pantalla, se pasa al siguiente deslizando (como TikTok). */
export function Clips() {
  const s = useStore()
  const ahora = useAhora()
  const reels = feed(s)
  const miNivel = nivelDe(totalPuntos(s.eventos, YO))

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
        <div className="feed" aria-label="Clips. Deslizá para pasar al siguiente">
          {reels.map((r, i) => {
            const mio = r.userId === YO
            const autor = s.usuarios[r.userId]
            const reaccione = s.misReacciones.includes(r.id)
            const nivel = mio ? miNivel : autor?.nivel ?? 0
            return (
              <article key={r.id} className="reel" style={{ '--tinte': autor?.color } as CSSProperties}
                aria-label={`${r.titulo}, de ${nombreDe(s, r.userId)}`}>
                <div className="reel__play">
                  <span><Icon name="play" size={40} /></span>
                  <span className="m">Video de TikTok. En esta versión de prueba no se reproduce.</span>
                </div>
                <div className="reel__info">
                  <div className="strong cut">@{nombreDe(s, r.userId)} · Nivel {nivel}</div>
                  <div className="titulo">{r.titulo}</div>
                  <div className="m cut">{r.formato} · {hace(ahora - r.publicadoAt)} · {r.hashtags.map((h) => `#${h}`).join(' ')}</div>
                </div>
                <div className="reel__acts">
                  <Avatar user={autor} nombre={nombreDe(s, r.userId)} foto={mio ? s.perfil?.foto : null} />
                  <button className="like like--col num" aria-pressed={reaccione} aria-label={reaccione ? 'Quitar reacción' : 'Reaccionar'}
                    onClick={() => s.reaccionar(r.id)}>
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

export function MisVideos() {
  const s = useStore()
  const ahora = useAhora()
  const mios = s.reels.filter((r) => r.userId === YO).sort((a, b) => b.publicadoAt - a.publicadoAt)
  const conHashtag = (h: string[]) => h.some((x) => x === 'haxball' || x === 'haxmatch')

  return (
    <div className="screen">
      <Head title="Mis videos" back="/clips" />
      <div className="scroll">
        <div className="pad">
          {!s.tiktok ? (
            <>
              <div className="card card--col">
                <div className="strong">Vinculá tu cuenta de TikTok</div>
                <ul className="steps m">
                  <li>Importamos todos tus videos a tu biblioteca.</li>
                  <li>En Clips aparecen solo los que tienen #haxball o #haxmatch.</li>
                  <li>Cada video tiene un interruptor para mostrarlo u ocultarlo.</li>
                  <li>Los videos se reproducen desde TikTok. No se copian a HaxMatch.</li>
                </ul>
              </div>
              <button className="btn btn--lg btn--block" onClick={s.vincularTikTok}>Vincular TikTok</button>
              <p className="m center" style={{ margin: 0 }}>Versión de prueba: la vinculación está simulada.</p>
            </>
          ) : (
            <>
              <div className="m">Los videos nuevos con #haxball o #haxmatch se suman solos. El primero de cada día da 8 puntos.</div>
              {mios.map((r) => {
                const apto = conHashtag(r.hashtags)
                return (
                  <div key={r.id} className="card card--row">
                    <div className="grow">
                      <div className="strong cut">{r.titulo}</div>
                      <div className="m cut">
                        {apto
                          ? `${r.hashtags.map((h) => `#${h}`).join(' ')} · ${hace(ahora - r.publicadoAt)}`
                          : 'Sin hashtag: no aparece en Clips'}
                      </div>
                    </div>
                    <button className="switch" role="switch" aria-checked={apto && r.visible} disabled={!apto}
                      aria-label={`Mostrar "${r.titulo}" en Clips`} onClick={() => s.alternarVisible(r.id)} />
                  </div>
                )
              })}
              <div className="demo">
                <div className="h">Herramienta de prueba</div>
                <button className="btn btn--sec" onClick={s.simularVideoNuevo}>Simular un video nuevo con #haxmatch</button>
              </div>
            </>
          )}
        </div>
      </div>
      <TabBar on="clips" />
    </div>
  )
}
