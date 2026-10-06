import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { nombreDe, useStore } from '../data/store'
import { MOTIVOS_REPORTE, type MotivoReporte } from '../domain/types'
import { Chips, Head } from '../ui'

export function Reportar() {
  const { userId = '' } = useParams()
  const s = useStore()
  const nav = useNavigate()
  const [motivo, setMotivo] = useState<MotivoReporte>('No apareció')
  const [detalle, setDetalle] = useState('')
  const nombre = nombreDe(s, userId)
  const bloqueado = s.bloqueados.includes(userId)

  return (
    <div className="screen">
      <Head title={`Reportar a ${nombre}`} back />
      <div className="scroll">
        <div className="pad">
          <Chips label="Motivo" options={MOTIVOS_REPORTE} value={motivo} onChange={setMotivo} />
          <label className="h sub" htmlFor="detalle-reporte">Detalle (opcional)</label>
          <textarea id="detalle-reporte" className="field" value={detalle} maxLength={300} placeholder="Contanos qué pasó"
            onChange={(e) => setDetalle(e.target.value)} />
          <div className="m">Los reportes los revisa el equipo. Varios reportes frenan la subida de nivel.</div>
          <div className="card">
            <div className="grow">
              <div className="strong">Bloquear a {nombre}</div>
              <div className="m">No lo vas a ver en la cola ni en Clips.</div>
            </div>
            <button className="switch" role="switch" aria-checked={bloqueado} aria-label={`Bloquear a ${nombre}`}
              onClick={() => s.alternarBloqueo(userId)} />
          </div>
        </div>
      </div>
      <div className="foot" style={{ paddingBottom: 24 }}>
        <button className="btn btn--lg" onClick={() => { s.reportar({ reportado: userId, motivo, detalle }); nav(-1) }}>Enviar reporte</button>
        <button className="btn btn--sec" onClick={() => nav(-1)}>Cancelar</button>
      </div>
    </div>
  )
}
