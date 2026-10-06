import { useState } from 'react'
import { APP_URL } from '../config'
import { YO, useStore } from '../data/store'
import { AMISTOSOS_REFERIDO, PUNTOS } from '../domain/rules'
import { Avatar, Head, Icon, TabBar, copiar } from '../ui'

export function Referir() {
  const s = useStore()
  const [aviso, setAviso] = useState<string | null>(null)
  const codigo = s.perfil?.codigo ?? ''
  const link = APP_URL ? `${APP_URL}/?ref=${codigo}` : ''
  const invitacion = link
    ? `Sumate a HaxMatch para armar amistosos de HaxBall: ${link}`
    : `Sumate a HaxMatch para armar amistosos de HaxBall. Usá mi código ${codigo} al entrar.`
  const puntos = s.eventos.filter((e) => e.userId === YO && e.tipo === 'referido').reduce((t, e) => t + e.puntos, 0)
  const completos = s.referidos.filter((r) => r.acreditado).length

  const copiarTexto = async (texto: string, ok: string) => {
    setAviso((await copiar(texto)) ? ok : 'No se pudo copiar. Mantené apretado el texto para copiarlo.')
  }

  return (
    <div className="screen">
      <Head title="Referí amigos" back="/perfil" />
      <div className="scroll">
        <div className="pad">
          <div>Sumás {PUNTOS.referido} puntos cuando tu amigo entra con Discord y juega {AMISTOSOS_REFERIDO} amistosos confirmados.</div>

          <div className="card">
            <div className="grow">
              <div className="m">Tu código</div>
              <div className="h" style={{ fontSize: 30, letterSpacing: 2, userSelect: 'all' }}>{codigo}</div>
            </div>
            <button className="btn" onClick={() => copiarTexto(codigo, 'Código copiado.')}><Icon name="copiar" size={18} />Copiar</button>
          </div>
          {link ? (
            <div className="card">
              <div className="grow">
                <div className="m">Tu link</div>
                <div className="strong" style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{link}</div>
              </div>
              <button className="btn btn--sec" onClick={() => copiarTexto(link, 'Link copiado.')}>Copiar</button>
            </div>
          ) : (
            <div className="m">Tu link de referido se arma con la dirección de la app cuando esté publicada.</div>
          )}

          <div className="row">
            <button className="btn btn--sec grow" onClick={() => copiarTexto(invitacion, 'Invitación copiada. Pegala en Discord.')}>
              Compartir por Discord
            </button>
            <a className="btn btn--sec grow" href={`https://wa.me/?text=${encodeURIComponent(invitacion)}`} target="_blank" rel="noopener noreferrer">
              Compartir por WhatsApp
            </a>
          </div>
          {aviso && <div className="ok" role="status">{aviso}</div>}

          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="card stat"><div className="h num">{completos}</div><div className="m">amigos referidos</div></div>
            <div className="card stat"><div className="h num">{puntos}</div><div className="m">puntos ganados</div></div>
          </div>

          <h2 className="h sub">Tus referidos</h2>
          {s.referidos.length === 0 && <div className="m">Todavía no referiste a nadie.</div>}
          {s.referidos.map((r) => (
            <div key={r.userId} className="card card--row">
              <Avatar user={s.usuarios[r.userId]} size="sm" />
              <div className="grow">
                <div className="strong cut">{s.usuarios[r.userId].username}</div>
                <div className="m">
                  {r.acreditado
                    ? `Completó ${AMISTOSOS_REFERIDO} amistosos · +${PUNTOS.referido} puntos`
                    : `Va ${r.amistosos} de ${AMISTOSOS_REFERIDO} amistosos · todavía no suma`}
                </div>
              </div>
            </div>
          ))}

          {s.referidos.some((r) => !r.acreditado) && (
            <div className="demo">
              <div className="h">Herramienta de prueba</div>
              {s.referidos.filter((r) => !r.acreditado).map((r) => (
                <button key={r.userId} className="btn btn--sec" onClick={() => s.simularAmistosoReferido(r.userId)}>
                  Simular que {s.usuarios[r.userId].username} juega un amistoso
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <TabBar on="perfil" />
    </div>
  )
}
