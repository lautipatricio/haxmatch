import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './data/store'
import { Ingresar, Onboarding } from './screens/Acceso'
import { Amigos } from './screens/Amigos'
import { Buscando } from './screens/Buscando'
import { Clips, MisVideos } from './screens/Clips'
import { FormJugador, FormSala } from './screens/Formularios'
import { Inicio } from './screens/Inicio'
import { MatchListo } from './screens/MatchListo'
import { Nivel } from './screens/Nivel'
import { Notificaciones } from './screens/Notificaciones'
import { Perfil } from './screens/Perfil'
import { Referir } from './screens/Referir'
import { Reportar } from './screens/Reportar'
import { Empty, Toasts } from './ui'

/** Solo deja pasar a quien ya entró con Discord y terminó el onboarding. */
function ConSesion() {
  const perfil = useStore((s) => s.perfil)
  if (!perfil) return <Navigate to="/ingresar" replace />
  if (!perfil.onboarding) return <Navigate to="/bienvenida" replace />
  return <Outlet />
}

function SinConexion() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (online) return null
  return (
    <div className="scrim" style={{ background: 'var(--bg)', alignItems: 'stretch', zIndex: 50 }}>
      <Empty title="Sin conexión" text="Revisá tu internet para ver jugadores y salas.">
        <button className="btn" onClick={() => setOnline(navigator.onLine)}>Reintentar</button>
      </Empty>
    </div>
  )
}

export function App() {
  const tick = useStore((s) => s.tick)
  const irA = useStore((s) => s.irA)
  const limpiarIrA = useStore((s) => s.limpiarIrA)
  const perfil = useStore((s) => s.perfil)
  const nav = useNavigate()
  const { pathname } = useLocation()

  // Reloj de la app: vence búsquedas, registra la conexión del día y mueve a los jugadores simulados.
  useEffect(() => {
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [tick])

  // Cuando se arma un match, la app lleva directo a "Match listo".
  useEffect(() => {
    if (!irA) return
    if (irA !== pathname) nav(irA)
    limpiarIrA()
  }, [irA, pathname, nav, limpiarIrA])

  return (
    <div className="app">
      <Routes>
        <Route path="/ingresar" element={perfil?.onboarding ? <Navigate to="/" replace /> : <Ingresar />} />
        <Route path="/bienvenida" element={!perfil ? <Navigate to="/ingresar" replace /> : perfil.onboarding ? <Navigate to="/" replace /> : <Onboarding />} />
        <Route element={<ConSesion />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/jugar" element={<FormJugador />} />
          <Route path="/sala" element={<FormSala />} />
          <Route path="/buscando" element={<Buscando />} />
          <Route path="/match/:id" element={<MatchListo />} />
          <Route path="/clips" element={<Clips />} />
          <Route path="/clips/mis-videos" element={<MisVideos />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/perfil/nivel" element={<Nivel />} />
          <Route path="/perfil/amigos" element={<Amigos />} />
          <Route path="/perfil/referir" element={<Referir />} />
          <Route path="/perfil/notificaciones" element={<Notificaciones />} />
          <Route path="/reportar/:userId" element={<Reportar />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
      <SinConexion />
    </div>
  )
}
