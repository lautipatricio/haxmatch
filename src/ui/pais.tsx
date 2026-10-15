// Elegir el país: un desplegable con todos los países, con el nombre en el idioma de la app.
import { useMemo, useState } from 'react'
import { idiomaDe, useStore } from '../data/store'
import { codigoPais, listaPaises } from '../domain/paises'
import { Sheet } from './index'

export function SelectorPais({ id, valor, onCambio }: { id: string; valor: string; onCambio: (codigo: string) => void }) {
  const idioma = useStore(idiomaDe)
  const paises = useMemo(() => listaPaises(idioma), [idioma])
  return (
    <select id={id} className="field" value={valor} onChange={(e) => onCambio(e.target.value)} autoComplete="country">
      <option value="" disabled>Elegí tu país</option>
      {paises.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
    </select>
  )
}

/** Cartel para elegir o confirmar el país (desde el Perfil, o la vez que la app lo pregunta). */
export function CartelPais({ titulo, texto, onCerrar }: { titulo: string; texto: string; onCerrar?: () => void }) {
  const actual = useStore((s) => codigoPais(s.perfil?.region[0]) ?? '')
  const cambiar = useStore((s) => s.cambiarPais)
  const [pais, setPais] = useState(actual)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const guardar = async () => {
    setOcupado(true)
    setError(null)
    const e = await cambiar(pais)
    setOcupado(false)
    if (e) setError(e)
    else onCerrar?.()
  }
  return (
    <Sheet title={titulo} onCerrar={onCerrar}>
      <div className="m">{texto}</div>
      <label className="h sub" htmlFor="pais-cartel">País</label>
      <SelectorPais id="pais-cartel" valor={pais} onCambio={(v) => { setPais(v); setError(null) }} />
      {error && <div className="err" role="alert">{error}</div>}
      <button className="btn btn--lg" disabled={!pais || ocupado} onClick={() => void guardar()}>{ocupado ? 'Guardando…' : 'Listo'}</button>
      {onCerrar && <button className="btn btn--sec" onClick={onCerrar}>Cancelar</button>}
    </Sheet>
  )
}
