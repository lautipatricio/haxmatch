import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './data/store'
import { Ingresar, Onboarding } from './screens/Acceso'
import { Admin } from './screens/Admin'
import { Amigos } from './screens/Amigos'
import { Buscando } from './screens/Buscando'
import { Chat } from './screens/Chat'
import { Clips, MisVideos } from './screens/Clips'
import { FormSala } from './screens/Formularios'
import { Inicio } from './screens/Inicio'
import { MatchListo } from './screens/MatchListo'
import { Nivel } from './screens/Nivel'
import { Notificaciones } from './screens/Notificaciones'
import { Perfil } from './screens/Perfil'
import { Referir } from './screens/Referir'
import { Reportar } from './screens/Reportar'
import { Empty, FichaJugador, Toasts } from './ui'

/** Solo deja pasar a quien ya entró con Discord y terminó el onboarding. */
function ConSesion() {
  const perfil = useStore((s) => s.perfil)
  if (!perfil) return <Navigate to="/ingresar" replace />
  if (!perfil.onboarding) return <Navigate to="/bienvenida" replace />
  return <Outlet />
}

/** Lleva a una página fija del sitio (fuera de la app). */
function PaginaFija({ archivo }: { archivo: string }) {
  useEffect(() => { window.location.replace(archivo) }, [archivo])
  return null
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
  const iniciarSesion = useStore((s) => s.iniciarSesion)
  const cargandoSesion = useStore((s) => s.cargandoSesion)
  const irA = useStore((s) => s.irA)
  const limpiarIrA = useStore((s) => s.limpiarIrA)
  const conectarCola = useStore((s) => s.conectarCola)
  const perfil = useStore((s) => s.perfil)
  const registrado = !!perfil?.onboarding
  const nav = useNavigate()
  const { pathname } = useLocation()

  // Con servidor: recupera la sesión abierta (o la que vuelve de Discord).
  useEffect(() => { iniciarSesion() }, [iniciarSesion])

  // Con servidor: mientras haya una cuenta abierta, la cola se mantiene al día.
  useEffect(() => (registrado ? conectarCola() : undefined), [registrado, conectarCola])

  // Al tocar una notificación con la app ya abierta, se va a la pantalla que corresponde.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const alAbrir = (e: MessageEvent) => {
      const d = e.data as { tipo?: string; ruta?: string } | null
      if (d?.tipo === 'abrir' && typeof d.ruta === 'string' && d.ruta.startsWith('/')) nav(d.ruta)
    }
    navigator.serviceWorker.addEventListener('message', alAbrir)
    return () => navigator.serviceWorker.removeEventListener('message', alAbrir)
  }, [nav])

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

  if (cargandoSesion) {
    return (
      <div className="app">
        <div className="hero" style={{ gap: 14 }} role="status">
          <h1 className="h logo">Hax<br /><span>Match</span></h1>
          <div className="m">Cargando tu cuenta…</div>
        </div>
        <Toasts />
      </div>
    )
  }

  return (
    <div className="app">
      <Routes>
        {/* Términos y Privacidad son páginas comunes (public/*.html), para que se puedan leer sin entrar ni cargar la app. */}
        <Route path="/terminos" element={<PaginaFija archivo="/terminos.html" />} />
        <Route path="/privacidad" element={<PaginaFija archivo="/privacidad.html" />} />
        <Route path="/ingresar" element={perfil ? <Navigate to={perfil.onboarding ? '/' : '/bienvenida'} replace /> : <Ingresar />} />
        <Route path="/bienvenida" element={!perfil ? <Navigate to="/ingresar" replace /> : perfil.onboarding ? <Navigate to="/" replace /> : <Onboarding />} />
        <Route element={<ConSesion />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/sala" element={<FormSala />} />
          <Route path="/buscando" element={<Buscando />} />
          <Route path="/match/:id" element={<MatchListo />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/admin" element={<Admin />} />
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
      <FichaJugador />
      <Toasts />
      <SinConexion />
    </div>
  )
}
