import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { buscarMia, useStore } from '../data/store'
import {
  CANCHAS, FALTAN, FORMATOS, POSICIONES, REGIONES,
  type Cancha, type Duracion, type Formato, type Posicion, type Region,
} from '../domain/types'
import { Chips, ChipsMulti, Head, TabBar } from '../ui'

const DURACIONES: Duracion[] = ['15min', 'match']
const textoDuracion = (d: Duracion) => (d === '15min' ? '15 min' : 'Hasta match')

export function FormJugador() {
  const perfil = useStore((s) => s.perfil)
  const mia = useStore(buscarMia)
  const crear = useStore((s) => s.crearBusqueda)
  const nav = useNavigate()
  const [formato, setFormato] = useState<Formato[]>(['3v3'])
  const [posicion, setPosicion] = useState<Posicion[]>(['Polifuncional'])
  const [cancha, setCancha] = useState<Cancha[]>(['Cualquiera'])
  const [region, setRegion] = useState<Region[]>(perfil?.region ?? ['ARG'])
  const [duracion, setDuracion] = useState<Duracion>('15min')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (mia) return <Navigate to="/buscando" replace />

  const buscar = async () => {
    setOcupado(true)
    const e = await crear({ modo: 'jugador', formato, posicion, cancha, region, duracion })
    setOcupado(false)
    setError(e)
    if (!e) nav('/buscando')
  }

  return (
    <div className="screen">
      <Head title="Jugar un amistoso" back="/" />
      <div className="scroll">
        <div className="pad">
          <div className="m">Podés marcar más de una opción en cada grupo.</div>
          <ChipsMulti label="Modalidad" options={FORMATOS} value={formato} onChange={setFormato} todas="Cualquiera" />
          <ChipsMulti label="Quiero jugar de" options={POSICIONES} value={posicion} onChange={setPosicion} todas="Polifuncional" />
          <ChipsMulti label="Cancha" options={CANCHAS} value={cancha} onChange={setCancha} todas="Cualquiera" />
          <ChipsMulti label="Región" options={REGIONES} value={region} onChange={setRegion} />
          <Chips label="Disponible por" options={DURACIONES} value={duracion} onChange={setDuracion} format={textoDuracion} />
          {error && <div className="err" role="alert">{error}</div>}
        </div>
      </div>
      <div className="foot">
        <button className="btn btn--lg btn--block" disabled={ocupado} onClick={() => void buscar()}>{ocupado ? 'Un momento…' : 'Buscar amistoso'}</button>
      </div>
      <TabBar on="inicio" />
    </div>
  )
}

export function FormSala() {
  const perfil = useStore((s) => s.perfil)
  const mia = useStore(buscarMia)
  const crear = useStore((s) => s.crearBusqueda)
  const nav = useNavigate()
  const [nombreSala, setNombreSala] = useState('')
  const [faltan, setFaltan] = useState<number>(1)
  const [posicion, setPosicion] = useState<Posicion[]>(['Polifuncional'])
  const [cancha, setCancha] = useState<Cancha[]>(['Cualquiera'])
  const [region, setRegion] = useState<Region[]>(perfil?.region ?? ['ARG'])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  if (mia) return <Navigate to="/buscando" replace />

  const buscar = async () => {
    setOcupado(true)
    const e = await crear({ modo: 'sala', formato: null, posicion, cancha, region, duracion: 'match', nombreSala, faltan })
    setOcupado(false)
    setError(e)
    if (!e) nav('/buscando')
  }

  return (
    <div className="screen">
      <Head title="Necesito un jugador" back="/" />
      <div className="scroll">
        <div className="pad">
          <label className="h sub" htmlFor="nombre-sala">Nombre de la sala</label>
          <input id="nombre-sala" className="field" value={nombreSala} maxLength={40} autoComplete="off"
            placeholder="Como figura en HaxBall" aria-describedby={error ? 'error-sala' : undefined}
            onChange={(e) => { setNombreSala(e.target.value); setError(null) }} />
          {error && <div id="error-sala" className="err" role="alert">{error}</div>}
          <Chips label="Cuántos faltan" options={FALTAN} value={faltan} onChange={setFaltan} />
          <div className="m">En posición, cancha y región podés marcar más de una opción.</div>
          <ChipsMulti label="Posición que buscás" options={POSICIONES} value={posicion} onChange={setPosicion} todas="Polifuncional" />
          <ChipsMulti label="Cancha" options={CANCHAS} value={cancha} onChange={setCancha} todas="Cualquiera" />
          <ChipsMulti label="Región" options={REGIONES} value={region} onChange={setRegion} />
        </div>
      </div>
      <div className="foot">
        <button className="btn btn--lg btn--block" disabled={ocupado} onClick={() => void buscar()}>{ocupado ? 'Un momento…' : 'Buscar jugador'}</button>
      </div>
      <TabBar on="inicio" />
    </div>
  )
}
