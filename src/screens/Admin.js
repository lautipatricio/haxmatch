import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { REAL } from '../config';
import { YO, useStore } from '../data/store';
import { leerPanel, levantarDesdePanel, suspenderDesdePanel } from '../data/servidor';
import { Avatar, Head, TabBar, hace, useAhora } from '../ui';
const DIAS = [1, 3, 7, 30, 0];
const textoDias = (d) => (d === 0 ? 'Sin fin' : d === 1 ? '1 día' : `${d} días`);
const fecha = (t) => (t === Infinity ? 'sin fecha de fin' : new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' }));
/** En la demostración el panel muestra los jugadores de muestra. */
function panelDemo(s) {
    const otros = Object.values(s.usuarios).filter((u) => u.id !== YO);
    const ahora = s.ahora();
    const persona = (i) => {
        const u = otros[i % otros.length];
        return { id: u.id, nick: u.username, username: u.username.toLowerCase(), foto: u.foto ?? null, conectado: s.conectados.includes(u.id), creadoAt: ahora - (i + 1) * 5 * 3600 * 1000 };
    };
    return {
        registrados: otros.length + 1, nuevosHoy: 2, nuevos7: 6, activosHoy: 7, activos7: otros.length,
        conectados: s.conectados.length, buscando: s.busquedas.filter((b) => b.estado === 'activa').length,
        amistososHoy: 3, amistosos: 41, mensajesChat: s.chat.length,
        ultimos: otros.map((_, i) => persona(i)),
        reportados: [{
                ...persona(7), reportes: 2, deDistintos: 2, motivos: 'Comportamiento tóxico', ultimo: ahora - 3600 * 1000, suspendidoHasta: null,
                detalle: [
                    { cuando: ahora - 3600 * 1000, motivo: 'Comportamiento tóxico', detalle: 'Insultos en el chat' },
                    { cuando: ahora - 26 * 3600 * 1000, motivo: 'Comportamiento tóxico', detalle: '' },
                ],
            }],
        suspendidos: [],
    };
}
function Numero({ n, texto }) {
    return _jsxs("div", { children: [_jsx("span", { className: "h num", children: n }), _jsx("span", { className: "m", children: texto })] });
}
function Nombre({ u }) {
    return (_jsxs("div", { className: "grow", style: { minWidth: 0 }, children: [_jsxs("div", { className: "strong cut", children: [u.nick, u.conectado && _jsx("span", { className: "en-linea", role: "img", "aria-label": "conectado" })] }), _jsxs("div", { className: "m cut", children: ["@", u.username] })] }));
}
/** Suspender: cuántos días y por qué. */
function Suspender({ u, onListo }) {
    const [abierto, setAbierto] = useState(false);
    const [dias, setDias] = useState(7);
    const [motivo, setMotivo] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    if (!abierto)
        return _jsx("button", { className: "btn btn--sec", onClick: () => setAbierto(true), children: "Suspender" });
    const confirmar = async () => {
        setOcupado(true);
        setError(null);
        const r = REAL ? await suspenderDesdePanel(u.id, dias, motivo) : { texto: `${u.nick} quedó suspendido (${textoDias(dias)}).` };
        setOcupado(false);
        if (r.error)
            return setError(r.error);
        setAbierto(false);
        onListo(r.texto ?? 'Listo.');
    };
    return (_jsxs("div", { className: "reportado", style: { width: '100%', borderTop: '1px solid var(--line)', paddingTop: 12 }, children: [_jsxs("div", { className: "strong", children: ["Suspender a ", u.nick] }), _jsx("div", { className: "chips", role: "group", "aria-label": "Por cu\u00E1nto tiempo", children: DIAS.map((d) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": dias === d, onClick: () => setDias(d), children: textoDias(d) }, d))) }), _jsx("input", { className: "field", value: motivo, maxLength: 200, placeholder: "Motivo (lo va a ver la persona)", "aria-label": "Motivo", onChange: (e) => setMotivo(e.target.value) }), _jsx("div", { className: "m", children: "No va a poder buscar partido, escribir en el chat, invitar ni agregar amigos. Si estaba buscando, deja de buscar." }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsxs("div", { className: "acciones", children: [_jsx("button", { className: "btn", disabled: ocupado, onClick: () => void confirmar(), children: ocupado ? 'Suspendiendo…' : `Suspender · ${textoDias(dias)}` }), _jsx("button", { className: "btn btn--ghost", disabled: ocupado, onClick: () => setAbierto(false), children: "Cancelar" })] })] }));
}
function Levantar({ u, onListo }) {
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const tocar = async () => {
        setOcupado(true);
        const r = REAL ? await levantarDesdePanel(u.id) : { texto: 'Listo: la cuenta ya no está suspendida.' };
        setOcupado(false);
        if (r.error)
            setError(r.error);
        else
            onListo(r.texto ?? 'Listo.');
    };
    return (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn--sec", disabled: ocupado, onClick: () => void tocar(), children: "Levantar la suspensi\u00F3n" }), error && _jsx("div", { className: "err", role: "alert", children: error })] }));
}
export function Admin() {
    const s = useStore();
    const ahora = useAhora();
    const [panel, setPanel] = useState(null);
    const [error, setError] = useState(null);
    const [aviso, setAviso] = useState(null);
    const [cargando, setCargando] = useState(false);
    const cargar = useCallback(async () => {
        if (!REAL)
            return setPanel(panelDemo(useStore.getState()));
        setCargando(true);
        const r = await leerPanel();
        setCargando(false);
        if (r.panel) {
            setPanel(r.panel);
            setError(null);
        }
        else
            setError(r.error ?? 'No pudimos cargar el panel.');
    }, []);
    useEffect(() => {
        void cargar();
        const cada = setInterval(() => void cargar(), 30000);
        return () => clearInterval(cada);
    }, [cargar]);
    // Con servidor, si administro se sabe un momento después de abrir la app.
    if (!s.ajustesListos) {
        return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Panel", back: "/perfil" }), _jsx("div", { className: "pad", children: _jsx("div", { className: "m center", children: "Cargando\u2026" }) }), _jsx(TabBar, { on: "perfil" })] }));
    }
    if (!s.admin)
        return _jsx(Navigate, { to: "/perfil", replace: true });
    const listo = (texto) => {
        setAviso(texto);
        void cargar();
    };
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Panel", back: "/perfil", children: _jsx("button", { className: "btn btn--sec", disabled: cargando, onClick: () => void cargar(), children: cargando ? 'Actualizando…' : 'Actualizar' }) }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", style: { '--gap': '20px' }, children: [aviso && _jsx("div", { className: "ok", role: "status", children: aviso }), error && _jsx("div", { className: "err", role: "alert", children: error }), !panel ? (!error && _jsx("div", { className: "m center", children: "Cargando\u2026" })) : (_jsxs(_Fragment, { children: [_jsxs("section", { className: "panel-numeros", "aria-label": "N\u00FAmeros", children: [_jsx(Numero, { n: panel.registrados, texto: "registrados" }), _jsx(Numero, { n: panel.nuevosHoy, texto: `nuevos hoy · ${panel.nuevos7} en 7 días` }), _jsx(Numero, { n: panel.activosHoy, texto: `entraron hoy · ${panel.activos7} en 7 días` }), _jsx(Numero, { n: panel.conectados, texto: "conectados ahora" }), _jsx(Numero, { n: panel.buscando, texto: "buscando partido ahora" }), _jsx(Numero, { n: panel.amistososHoy, texto: `amistosos hoy · ${panel.amistosos} en total` }), _jsx(Numero, { n: panel.mensajesChat, texto: "mensajes en el chat (24 h)" })] }), _jsxs("section", { className: "lista", "aria-label": "Reportes", children: [_jsx("h2", { className: "h sub", children: "Reportes de los \u00FAltimos 30 d\u00EDas" }), panel.reportados.length === 0 ? (_jsx("div", { className: "vacio", children: _jsx("div", { className: "m", children: "Nadie fue reportado." }) })) : panel.reportados.map((u) => (_jsxs("div", { className: "card card--col reportado", children: [_jsxs("div", { className: "row", children: [_jsx(Avatar, { nombre: u.nick, foto: u.foto }), _jsx(Nombre, { u: u })] }), _jsxs("div", { className: "m", children: [u.reportes, " ", u.reportes === 1 ? 'reporte' : 'reportes', " de ", u.deDistintos, " ", u.deDistintos === 1 ? 'persona' : 'personas distintas', " \u00B7 ", u.motivos, " \u00B7 \u00FAltimo ", hace(ahora - u.ultimo)] }), _jsx("ul", { className: "m", children: u.detalle.map((d, i) => (_jsxs("li", { children: [hace(ahora - d.cuando), ": ", d.motivo, d.detalle ? ` · "${d.detalle}"` : ''] }, i))) }), u.suspendidoHasta ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "m", children: ["Suspendido hasta el ", fecha(u.suspendidoHasta), "."] }), _jsx("div", { className: "acciones", children: _jsx(Levantar, { u: u, onListo: listo }) })] })) : (_jsx("div", { className: "acciones", children: _jsx(Suspender, { u: u, onListo: listo }) }))] }, u.id)))] }), panel.suspendidos.length > 0 && (_jsxs("section", { className: "lista", "aria-label": "Suspendidos", children: [_jsx("h2", { className: "h sub", children: "Suspendidos" }), panel.suspendidos.map((u) => (_jsxs("div", { className: "card card--col reportado", children: [_jsxs("div", { className: "row", children: [_jsx(Avatar, { nombre: u.nick }), _jsx(Nombre, { u: u })] }), _jsxs("div", { className: "m", children: ["Hasta el ", fecha(u.hasta), u.motivo ? ` · ${u.motivo}` : ''] }), _jsx("div", { className: "acciones", children: _jsx(Levantar, { u: u, onListo: listo }) })] }, u.id)))] })), _jsxs("section", { className: "lista", "aria-label": "\u00DAltimos registrados", children: [_jsx("h2", { className: "h sub", children: "\u00DAltimos registrados" }), panel.ultimos.map((u) => (_jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { nombre: u.nick, foto: u.foto }), _jsx(Nombre, { u: u }), _jsx("span", { className: "m", style: { flex: 'none' }, children: u.creadoAt ? hace(ahora - u.creadoAt) : '' })] }, u.id)))] }), _jsx("p", { className: "m", children: "Se actualiza solo cada 30 segundos. Para borrar un mensaje del chat, toc\u00E1 el tacho que aparece al lado." })] }))] }) }), _jsx(TabBar, { on: "perfil" })] }));
}
