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
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const enviar = async () => {
    setOcupado(true)
    const e = await s.reportar({ reportado: userId, motivo, detalle })
    setOcupado(false)
    setError(e)
    if (!e) nav(-1)
  }
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
          <div className="m">Los reportes los revisa el equipo de HaxMatch. Una cuenta reportada puede quedar suspendida.</div>
          {error && <div className="err" role="alert">{error}</div>}
          <div className="card">
            <div className="grow">
              <div className="strong">Bloquear a {nombre}</div>
              <div className="m">
                {s.bloqueosEnServidor
                  ? 'No lo vas a ver en la cola, en el chat ni en Clips, y no puede escribirte, invitarte a su sala ni agregarte. Se desbloquea desde Amigos.'
                  : 'No lo vas a ver en la cola, en el chat ni en Clips. Se desbloquea desde Amigos.'}
              </div>
            </div>
            <button className="switch" role="switch" aria-checked={bloqueado} aria-label={`Bloquear a ${nombre}`}
              onClick={() => s.alternarBloqueo(userId)} />
          </div>
        </div>
      </div>
      <div className="foot" style={{ paddingBottom: 24 }}>
        <button className="btn btn--lg" disabled={ocupado} onClick={() => void enviar()}>{ocupado ? 'Enviando…' : 'Enviar reporte'}</button>
        <button className="btn btn--sec" onClick={() => nav(-1)}>Cancelar</button>
      </div>
    </div>
  )
}
