import { miRacha, misPuntos, useStore, vecesDe } from '../data/store'
import {
  AMISTOSOS_REFERIDO, NIVEL_SORTEO, NIVELES, PUNTOS, RACHAS, TOPES,
  entraAlSorteo, progresoNivel, proximaRacha,
} from '../domain/rules'
import type { TipoPunto } from '../domain/types'
import { Head, TabBar, TarjetaNivel, useAhora } from '../ui'

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
          <TarjetaNivel />
          <div>Todos empiezan en 0. Tu nivel sube con tu actividad en la app, no con tu habilidad.</div>
          {proxima && (
            <div className="m">
              Llevás {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}. A los {proxima[0]} sumás +{proxima[1]}. La racha se corta si falta un día.
            </div>
          )}
          <h2 className="h sub">Qué suma</h2>
          {filas.map(([titulo, detalle, n]) => (
            <div key={titulo} className="card card--row">
              <div className="grow">
                <div className="strong">{titulo}</div>
                <div className="m">{detalle}</div>
              </div>
              <div className="h num" style={{ fontSize: 28, minWidth: 28, textAlign: 'right' }}>{n}</div>
            </div>
          ))}
          <div className="card card--col" style={{ gap: 6, marginTop: 8 }}>
            <div className="h" style={{ fontSize: 24 }}>Sorteo</div>
            <div>Participan automáticamente los jugadores de Nivel {NIVEL_SORTEO} o más.</div>
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
