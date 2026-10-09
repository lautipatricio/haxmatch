import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from './data/store';
import { Ingresar, Onboarding } from './screens/Acceso';
import { Admin } from './screens/Admin';
import { Amigos } from './screens/Amigos';
import { Buscando } from './screens/Buscando';
import { Chat } from './screens/Chat';
import { Clips, MisVideos } from './screens/Clips';
import { FormSala } from './screens/Formularios';
import { Inicio } from './screens/Inicio';
import { MatchListo } from './screens/MatchListo';
import { Nivel } from './screens/Nivel';
import { Notificaciones } from './screens/Notificaciones';
import { Perfil } from './screens/Perfil';
import { Referir } from './screens/Referir';
import { Reportar } from './screens/Reportar';
import { Empty, FichaJugador, Toasts } from './ui';
/** Solo deja pasar a quien ya entró con Discord y terminó el onboarding. */
function ConSesion() {
    const perfil = useStore((s) => s.perfil);
    if (!perfil)
        return _jsx(Navigate, { to: "/ingresar", replace: true });
    if (!perfil.onboarding)
        return _jsx(Navigate, { to: "/bienvenida", replace: true });
    return _jsx(Outlet, {});
}
/** Lleva a una página fija del sitio (fuera de la app). */
function PaginaFija({ archivo }) {
    useEffect(() => { window.location.replace(archivo); }, [archivo]);
    return null;
}
function SinConexion() {
    const [online, setOnline] = useState(() => navigator.onLine);
    useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);
    if (online)
        return null;
    return (_jsx("div", { className: "scrim", style: { background: 'var(--bg)', alignItems: 'stretch', zIndex: 50 }, children: _jsx(Empty, { title: "Sin conexi\u00F3n", text: "Revis\u00E1 tu internet para ver jugadores y salas.", children: _jsx("button", { className: "btn", onClick: () => setOnline(navigator.onLine), children: "Reintentar" }) }) }));
}
export function App() {
    const tick = useStore((s) => s.tick);
    const iniciarSesion = useStore((s) => s.iniciarSesion);
    const cargandoSesion = useStore((s) => s.cargandoSesion);
    const irA = useStore((s) => s.irA);
    const limpiarIrA = useStore((s) => s.limpiarIrA);
    const conectarCola = useStore((s) => s.conectarCola);
    const perfil = useStore((s) => s.perfil);
    const registrado = !!perfil?.onboarding;
    const nav = useNavigate();
    const { pathname } = useLocation();
    // Con servidor: recupera la sesión abierta (o la que vuelve de Discord).
    useEffect(() => { iniciarSesion(); }, [iniciarSesion]);
    // Con servidor: mientras haya una cuenta abierta, la cola se mantiene al día.
    useEffect(() => (registrado ? conectarCola() : undefined), [registrado, conectarCola]);
    // Al tocar una notificación con la app ya abierta, se va a la pantalla que corresponde.
    useEffect(() => {
        if (!('serviceWorker' in navigator))
            return;
        const alAbrir = (e) => {
            const d = e.data;
            if (d?.tipo === 'abrir' && typeof d.ruta === 'string' && d.ruta.startsWith('/'))
                nav(d.ruta);
        };
        navigator.serviceWorker.addEventListener('message', alAbrir);
        return () => navigator.serviceWorker.removeEventListener('message', alAbrir);
    }, [nav]);
    // Reloj de la app: vence búsquedas, registra la conexión del día y mueve a los jugadores simulados.
    useEffect(() => {
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [tick]);
    // Cuando se arma un match, la app lleva directo a "Match listo".
    useEffect(() => {
        if (!irA)
            return;
        if (irA !== pathname)
            nav(irA);
        limpiarIrA();
    }, [irA, pathname, nav, limpiarIrA]);
    if (cargandoSesion) {
        return (_jsxs("div", { className: "app", children: [_jsxs("div", { className: "hero", style: { gap: 14 }, role: "status", children: [_jsxs("h1", { className: "h logo", children: ["Hax", _jsx("br", {}), _jsx("span", { children: "Match" })] }), _jsx("div", { className: "m", children: "Cargando tu cuenta\u2026" })] }), _jsx(Toasts, {})] }));
    }
    return (_jsxs("div", { className: "app", children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/terminos", element: _jsx(PaginaFija, { archivo: "/terminos.html" }) }), _jsx(Route, { path: "/privacidad", element: _jsx(PaginaFija, { archivo: "/privacidad.html" }) }), _jsx(Route, { path: "/ingresar", element: perfil ? _jsx(Navigate, { to: perfil.onboarding ? '/' : '/bienvenida', replace: true }) : _jsx(Ingresar, {}) }), _jsx(Route, { path: "/bienvenida", element: !perfil ? _jsx(Navigate, { to: "/ingresar", replace: true }) : perfil.onboarding ? _jsx(Navigate, { to: "/", replace: true }) : _jsx(Onboarding, {}) }), _jsxs(Route, { element: _jsx(ConSesion, {}), children: [_jsx(Route, { path: "/", element: _jsx(Inicio, {}) }), _jsx(Route, { path: "/sala", element: _jsx(FormSala, {}) }), _jsx(Route, { path: "/buscando", element: _jsx(Buscando, {}) }), _jsx(Route, { path: "/match/:id", element: _jsx(MatchListo, {}) }), _jsx(Route, { path: "/chat", element: _jsx(Chat, {}) }), _jsx(Route, { path: "/admin", element: _jsx(Admin, {}) }), _jsx(Route, { path: "/clips", element: _jsx(Clips, {}) }), _jsx(Route, { path: "/clips/mis-videos", element: _jsx(MisVideos, {}) }), _jsx(Route, { path: "/perfil", element: _jsx(Perfil, {}) }), _jsx(Route, { path: "/perfil/nivel", element: _jsx(Nivel, {}) }), _jsx(Route, { path: "/perfil/amigos", element: _jsx(Amigos, {}) }), _jsx(Route, { path: "/perfil/referir", element: _jsx(Referir, {}) }), _jsx(Route, { path: "/perfil/notificaciones", element: _jsx(Notificaciones, {}) }), _jsx(Route, { path: "/reportar/:userId", element: _jsx(Reportar, {}) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }), _jsx(FichaJugador, {}), _jsx(Toasts, {}), _jsx(SinConexion, {})] }));
}
