import { miRacha, misPuntos, useStore, vecesDe } from '../data/store'
import {
  AMISTOSOS_REFERIDO, NIVEL_SORTEO, NIVELES, PUNTOS, RACHAS, TOPES,
  entraAlSorteo, progresoNivel, proximaRacha,
} from '../domain/rules'
import type { TipoPunto } from '../domain/types'
import { Head, TabBar, useAhora } from '../ui'

export function Nivel() {
  const s = useStore()
  const ahora = useAhora()
  const p = progresoNivel(misPuntos(s))
  const racha = miRacha(s, ahora)
  const proxima = proximaRacha(racha)
  const veces = (tipo: TipoPunto) => vecesDe(s, tipo)

  const filas: Array<[string, string, number]> = [
    ['Amistosos confirmados', `${PUNTOS.amistoso} puntos · hasta ${TOPES.amistososPorDia} por día, ${TOPES.mismoRivalPorDia} con el mismo rival`, veces('amistoso')],
    ['Reels nuevos en Clips', `${PUNTOS.reel} puntos · ${TOPES.reelsPorDia} por día`, veces('reel')],
    ['Reacciones a reels', `${PUNTOS.reaccion} punto · hasta ${TOPES.reaccionesPorDia} reels distintos por día`, veces('reaccion')],
    ['Días conectado', `${PUNTOS.conexion} puntos por día`, veces('conexion')],
    ['Racha de días seguidos', RACHAS.map(([d, pts]) => `${d} días +${pts}`).join(' · '), racha],
    ['Amigos referidos', `${PUNTOS.referido} puntos cuando juega ${AMISTOSOS_REFERIDO} amistosos · hasta ${TOPES.referidosPorMes} por mes`, veces('referido')],
  ]

  return (
    <div className="screen">
      <Head title="Tu nivel" back="/perfil" />
      <div className="scroll">
        <div className="pad">
          <div className="card card--col" style={{ padding: 18 }}>
            <div className="h" style={{ fontSize: 40 }}>Nivel {p.nivel}</div>
            <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.avance * 100)}
              aria-label="Avance al próximo nivel">
              <div style={{ width: `${Math.round(p.avance * 100)}%` }} />
            </div>
            <div className="m num">
              {p.hasta === null
                ? `${p.puntos} puntos · llegaste al nivel máximo`
                : `${p.puntos} de ${p.hasta} puntos · te faltan ${p.hasta - p.puntos} para el Nivel ${p.nivel + 1}`}
            </div>
          </div>
          <div>Todos empiezan en 0. Tu nivel sube con tu actividad en la app, no con tu habilidad.</div>
          {proxima && (
            <div className="m">
              Llevás {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}. A los {proxima[0]} sumás +{proxima[1]}. La racha se corta si falta un día.
            </div>
          )}
          <h2 className="h sub">Qué suma</h2>
          {filas.map(([titulo, detalle, n]) => (
            <div key={titulo} className="card" style={{ padding: '10px 14px' }}>
              <div className="grow">
                <div className="strong">{titulo}</div>
                <div className="m">{detalle}</div>
              </div>
              <div className="h num" style={{ fontSize: 24, color: 'var(--accent)' }}>{n}</div>
            </div>
          ))}
          <div className="card card--col card--accent" style={{ gap: 4 }}>
            <div className="h" style={{ fontSize: 22, color: 'var(--accent)' }}>Sorteo</div>
            <div style={{ fontSize: 14 }}>Participan automáticamente los jugadores de Nivel {NIVEL_SORTEO} o más.</div>
            <div className="m num">
              {entraAlSorteo(p.nivel)
                ? 'Ya estás participando.'
                : `Te faltan ${NIVELES[NIVEL_SORTEO - 1] - p.puntos} puntos para entrar.`}
              {' '}Premio, fecha y reglamento a confirmar.
            </div>
          </div>
        </div>
      </div>
      <TabBar on="perfil" />
    </div>
  )
}
