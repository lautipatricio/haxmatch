import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { YO, buscarMia, enSala, nombreDe, useStore, usuarioDe } from '../data/store'
import { DIAS_PENDIENTE } from '../domain/rules'
import { Avatar, Empty, Head, Icon, LinkSala, Persona, Sheet, copiar } from '../ui'

/** Matches donde ya se mostró el cartel "No te olvides", para no repetirlo al volver. */
const recordados = new Set<string>()

/** "Mati_", "Mati_ y Nico", "Mati_, Nico y Lucho". */
function enumerar(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/** Dueño de la sala: se completó y ya entraron todos. La búsqueda terminó y el match quedó armado. */
function MiSalaCompleta({ matchId }: { matchId: string }) {
  const s = useStore()
  const m = s.matches.find((x) => x.id === matchId)
  if (!m) return <Navigate to="/" replace />
  const otros = enSala(m)
  const contado = m.contadoAt !== null
  const puntos = s.eventos.find((e) => e.tipo === 'amistoso' && e.referencia === m.id)?.puntos ?? 0
  // Completa: entraron todos. Si no, es una sala que cerré yo antes de llenarla.
  const todos = otros.length > 0 && otros.every((p) => !!p.entroAt)
  return (
    <div className="screen">
      <Head title={contado ? 'Amistoso confirmado' : todos ? 'Match listo' : 'Sala cerrada'} />
      <div className="scroll">
        <div className="pad">
          <div className="check"><Icon name="check" size={38} stroke={3} /></div>
          <div className="h center" style={{ fontSize: 30 }}>{todos ? 'Tu sala está completa' : 'Tu sala ya no busca'}</div>
          <div className="m center">
            Sala "{m.nombreSala}" · {todos ? 'ya entraron todos. La búsqueda terminó.' : 'la búsqueda terminó.'}
          </div>

          <div className={`card card--col${contado ? ' card--accent' : ''}`} role="status">
            {contado ? (
              <>
                <div className="strong">Partido válido{puntos > 0 ? ` · +${puntos} puntos` : ''}</div>
                {puntos === 0 && <div className="m">Cuenta en tu historial. Hoy ya llegaste al tope de puntos por amistosos.</div>}
              </>
            ) : (
              <>
                <div className="strong">Falta que confirme alguno de los que entraron.</div>
                <div className="m">El partido cuenta cuando uno de ellos toca “Ya entré a la sala”. Les queda pendiente en su Perfil por {DIAS_PENDIENTE} días.</div>
              </>
            )}
          </div>

          <h2 className="h sub">En tu sala</h2>
          {otros.map((p) => {
            const u = usuarioDe(s, p.userId)
            return (
              <div key={p.userId} className="card card--row">
                <Persona user={u}>
                  <span className="strong cut">{u.username}</span>
                  <span className="m cut">{p.entroAt ? (p.confirmadoAt ? 'Adentro · confirmó' : 'Adentro') : 'No llegó a entrar'}</span>
                </Persona>
                {p.entroAt ? (
                  <button className="btn btn--sec" aria-label={`${u.username} se salió`} onClick={() => s.marcarSalio(p.userId, m.id)}>Se salió</button>
                ) : (
                  <button className="btn btn--sec" aria-label={`${u.username} no vino`} onClick={() => s.marcarSalio(p.userId, m.id)}>No vino</button>
                )}
              </div>
            )
          })}
          {todos && <div className="m">Si alguno se va, tocá “Se salió”: se libera su lugar y la sala vuelve a buscar.</div>}

          <Link className="btn btn--lg" to="/">Volver al inicio</Link>
          <div className="chips" style={{ alignItems: 'center' }}>
            <span className="m">Reportar a</span>
            {otros.map((p) => (
              <Link key={p.userId} className="chip" to={`/reportar/${p.userId}`}>
                {usuarioDe(s, p.userId).username}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Pantalla de quien entra a la sala de otro. */
export function MatchListo() {
  const { id } = useParams()
  const s = useStore()
  const m = s.matches.find((x) => x.id === id)
  const [recordatorio, setRecordatorio] = useState(() => !recordados.has(id ?? ''))
  const [copiado, setCopiado] = useState<boolean | null>(null)

  if (!m) {
    return (
      <div className="screen">
        <Empty title="Match no encontrado" text="Puede que se haya cancelado.">
          <Link className="btn" to="/">Volver al inicio</Link>
        </Empty>
      </div>
    )
  }
  if (m.creadoPor === YO) {
    // Mientras mi sala siga abierta, todo se maneja desde la pantalla de búsqueda.
    if (buscarMia(s)?.matchId === m.id) return <Navigate to="/buscando" replace />
    return <MiSalaCompleta matchId={m.id} />
  }

  const yo = m.participantes.find((p) => p.userId === YO)
  const creador = nombreDe(s, m.creadoPor)
  const conmigo = enSala(m, m.creadoPor).filter((p) => p.userId !== YO)
  const contado = m.contadoAt !== null
  // Si el partido ya me cuenta (el dueño marcó que entré y confirmó alguien más), no hace falta que confirme.
  const confirme = !!yo?.confirmadoAt || contado
  const puntos = s.eventos.find((e) => e.tipo === 'amistoso' && e.referencia === m.id)?.puntos ?? 0
  const titulo = m.formato && m.formato !== 'Cualquiera' ? `${m.formato} con ${creador}` : `Sala de ${creador}`

  return (
    <div className="screen">
      <Head title={contado ? 'Amistoso confirmado' : 'Match listo'} />
      <div className="scroll">
        <div className="pad">
          <div className="check"><Icon name="check" size={38} stroke={3} /></div>
          <div className="h center" style={{ fontSize: 30 }}>{titulo}</div>

          <div className="card card--col">
            <div className="m">Nombre de la sala en HaxBall</div>
            <div className="row">
              <div className="h grow" style={{ fontSize: 28, overflowWrap: 'anywhere' }}>{m.nombreSala}</div>
              <button className="btn btn--sec" onClick={async () => setCopiado(await copiar(m.nombreSala))}>
                <Icon name="copiar" size={18} />{copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="m">
              {copiado === false
                ? 'No se pudo copiar. Mantené apretado el nombre para copiarlo.'
                : m.linkSala ? 'O entrá directo con el link:' : 'Buscala por este nombre en HaxBall, desde tu computadora.'}
            </div>
            <LinkSala link={m.linkSala} />
          </div>

          {conmigo.length > 0 && (
            <div className="card">
              <Avatar user={usuarioDe(s, conmigo[0].userId)} />
              <div className="grow">
                <div className="strong">{conmigo.length > 1 ? 'Entran con vos' : 'Entra con vos'}</div>
                <div className="m">{enumerar(conmigo.map((p) => nombreDe(s, p.userId)))}</div>
              </div>
            </div>
          )}

          {!confirme && (
            <button className="btn btn--lg" onClick={() => s.confirmarMatch(m.id)}>Ya entré a la sala</button>
          )}

          {confirme && (
            <div className={`card card--col${contado ? ' card--accent' : ''}`} role="status">
              {contado ? (
                <>
                  <div className="strong">Partido válido{puntos > 0 ? ` · +${puntos} puntos` : ''}</div>
                  {puntos === 0 && <div className="m">Cuenta en tu historial. Hoy ya llegaste al tope de puntos por amistosos.</div>}
                </>
              ) : (
                <>
                  <div className="strong">Confirmaste. Falta que confirme {creador}.</div>
                  <div className="m">El partido cuenta cuando confirma el otro lado. Le queda pendiente en su Perfil por {DIAS_PENDIENTE} días.</div>
                </>
              )}
            </div>
          )}

          <div className="card card--row">
            <Persona user={usuarioDe(s, m.creadoPor)}>
              <span className="strong cut">Quién crea la sala</span>
              <span className="m cut">{creador} · tocá para agregarlo como amigo</span>
            </Persona>
          </div>

          <Link className={`btn${confirme ? '' : ' btn--ghost'}`} to="/">Volver al inicio</Link>
          <Link className="btn btn--ghost" to={`/reportar/${m.creadoPor}`}>Reportar a {creador}</Link>
        </div>
      </div>

      {recordatorio && !confirme && (
        <Sheet title="No te olvides">
          <div>Tocá “Ya entré a la sala” cuando estés adentro. Sin eso, el partido no cuenta como válido.</div>
          <button className="btn" onClick={() => { recordados.add(m.id); setRecordatorio(false) }}>Entendido</button>
        </Sheet>
      )}
    </div>
  )
}
