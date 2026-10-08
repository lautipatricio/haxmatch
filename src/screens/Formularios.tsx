import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { buscarMia, useStore } from '../data/store'
import { CANCHAS_SALA, REGLAS_CANCHA, ajustarSala, type CanchaSala } from '../domain/rules'
import { REGIONES, type Posicion, type Region } from '../domain/types'
import { Chips, ChipsMulti, Head, TabBar } from '../ui'

/**
 * "Necesito un jugador". Primero se elige la cancha: de ella depende cuántos
 * pueden faltar y qué posiciones hay. En Classic (1 contra 1) no hay nada más
 * que elegir: falta uno.
 */
export function FormSala() {
  const perfil = useStore((s) => s.perfil)
  const mia = useStore(buscarMia)
  const crear = useStore((s) => s.crearBusqueda)
  const nav = useNavigate()
  const [cancha, setCancha] = useState<CanchaSala | null>(null)
  const [nombreSala, setNombreSala] = useState('')
  const [faltan, setFaltan] = useState<number>(1)
  const [posicion, setPosicion] = useState<Posicion[]>(['Polifuncional'])
  const [region, setRegion] = useState<Region[]>(perfil?.region ?? ['ARG'])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (mia) return <Navigate to="/buscando" replace />

  const elegirCancha = (c: CanchaSala) => {
    const a = ajustarSala(c, faltan, posicion)
    setCancha(c)
    setFaltan(a.faltan)
    setPosicion(a.posicion)
    setError(null)
  }

  const reglas = cancha ? REGLAS_CANCHA[cancha] : null
  const lugares = reglas ? Array.from({ length: reglas.maxFaltan }, (_, i) => i + 1) : []

  const buscar = async () => {
    if (!cancha) return setError('Elegí la cancha.')
    setOcupado(true)
    const e = await crear({ modo: 'sala', formato: null, posicion, cancha: [cancha], region, duracion: 'match', nombreSala, faltan })
    setOcupado(false)
    setError(e)
    if (!e) nav('/buscando')
  }

  return (
    <div className="screen">
      <Head title="Necesito un jugador" back="/" />
      <div className="scroll">
        <div className="pad">
          <h2 className="h sub">Cancha</h2>
          <div className="chips" role="group" aria-label="Cancha">
            {CANCHAS_SALA.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={c === cancha} onClick={() => elegirCancha(c)}>{c}</button>
            ))}
          </div>
          {!cancha && <div className="m">Elegí la cancha para seguir.</div>}

          {cancha && reglas && (
            <>
              <label className="h sub" htmlFor="nombre-sala">Nombre de la sala</label>
              <input id="nombre-sala" className="field" value={nombreSala} maxLength={40} autoComplete="off"
                placeholder="Como figura en HaxBall" aria-describedby={error ? 'error-sala' : undefined}
                onChange={(e) => { setNombreSala(e.target.value); setError(null) }} />
              {reglas.maxFaltan > 1 && <Chips label="Cuántos faltan" options={lugares} value={faltan} onChange={setFaltan} />}
              {reglas.posiciones.length > 0 && (
                <ChipsMulti label="Posición que buscás" options={reglas.posiciones} value={posicion} onChange={setPosicion} todas="Polifuncional" />
              )}
              {cancha === 'Classic' && <div className="m">Classic es de a uno: buscás un jugador, sin posición.</div>}
              <ChipsMulti label="Región" options={REGIONES} value={region} onChange={setRegion} />
            </>
          )}
          {error && <div id="error-sala" className="err" role="alert">{error}</div>}
        </div>
      </div>
      <div className="foot">
        <button className="btn btn--lg btn--block" disabled={ocupado || !cancha} onClick={() => void buscar()}>{ocupado ? 'Un momento…' : 'Buscar jugador'}</button>
      </div>
      <TabBar on="inicio" />
    </div>
  )
}
