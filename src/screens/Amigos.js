import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { REAL } from '../config';
import { nivelTexto, useStore, usuarioDe } from '../data/store';
import { Avatar, Conectado, EtiquetaKick, Head, Icon, Persona, TabBar, hace, useAhora } from '../ui';
import { FilaDisponible, resumenBusqueda } from './Buscando';
export function Amigos() {
    const s = useStore();
    const ahora = useAhora();
    const [usuario, setUsuario] = useState('');
    const [aviso, setAviso] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const agregar = async (e) => {
        e.preventDefault();
        setOcupado(true);
        const r = await s.enviarSolicitud(usuario);
        setOcupado(false);
        setAviso(r);
        if (r.ok)
            setUsuario('');
    };
    const disponibles = s.busquedas.filter((b) => b.estado === 'activa' && s.amigos.includes(b.userId));
    const idsDisponibles = new Set(disponibles.map((b) => b.userId));
    const resto = s.amigos.filter((id) => !idsDisponibles.has(id));
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Amigos", back: "/perfil" }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsxs("form", { className: "row", onSubmit: (e) => void agregar(e), children: [_jsx("input", { id: "buscar-amigo", className: "field grow", value: usuario, placeholder: "Nick o usuario de Discord", "aria-label": "Nick o usuario de Discord", autoComplete: "off", autoCapitalize: "none", onChange: (e) => { setUsuario(e.target.value); setAviso(null); } }), _jsx("button", { className: "btn", type: "submit", style: { minHeight: 52 }, disabled: ocupado, children: "Agregar" })] }), aviso && _jsx("div", { className: aviso.ok ? 'ok' : 'err', role: "status", children: aviso.texto }), _jsx("div", { className: "m", children: "Tambi\u00E9n pod\u00E9s tocar a cualquier jugador en la cola o en una sala para agregarlo." }), s.solicitudes.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("h2", { className: "h sub sub--accent", children: ["Solicitudes (", s.solicitudes.length, ")"] }), s.solicitudes.map((id) => {
                                    const u = usuarioDe(s, id);
                                    return (_jsxs("div", { className: "card card--row card--accent", children: [_jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id })] }), _jsx("span", { className: "m cut", children: "quiere ser tu amigo" })] }), _jsxs("div", { className: "acts", children: [_jsx("button", { className: "btn", "aria-label": `Aceptar a ${u.username}`, onClick: () => s.responderSolicitud(id, true), children: "Aceptar" }), _jsx("button", { className: "btn btn--sec btn--icon", "aria-label": `Rechazar a ${u.username}`, onClick: () => s.responderSolicitud(id, false), children: _jsx(Icon, { name: "x", size: 18 }) })] })] }, id));
                                })] })), _jsx("h2", { className: "h sub", children: "Disponibles ahora" }), disponibles.length === 0 ? (_jsx("div", { className: "m", children: "Ninguno de tus amigos est\u00E1 buscando partido en este momento." })) : (disponibles.map((b) => (_jsx(FilaDisponible, { b: b, detalle: `${nivelTexto(s.usuarios[b.userId])}${resumenBusqueda(b)} · ${hace(ahora - b.creadaAt)}` }, b.id)))), disponibles.length > 0 && !s.busquedas.some((b) => b.userId === 'yo' && b.estado === 'activa') && REAL && (_jsx("div", { className: "m", children: "Para escribirles, primero ponete a buscar partido desde el Inicio." })), (resto.length > 0 || s.solicitudesEnviadas.length > 0 || s.amigos.length === 0) && _jsx("h2", { className: "h sub", children: "Tus amigos" }), s.amigos.length === 0 && s.solicitudesEnviadas.length === 0 && (_jsx("div", { className: "m", children: "Agreg\u00E1 amigos por su nick o su usuario de Discord. Te avisamos cuando se ponen a buscar partido." })), resto.map((id) => {
                            const u = usuarioDe(s, id);
                            return (_jsx("div", { className: "card card--row", children: _jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id })] }), _jsx("span", { className: "m cut", children: REAL ? 'No está buscando' : 'Sin conexión' })] }) }, id));
                        }), s.solicitudesEnviadas.map((id) => {
                            const u = usuarioDe(s, id);
                            return (_jsx("div", { className: "card card--row", children: _jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id })] }), _jsx("span", { className: "m cut", children: "Solicitud enviada" })] }) }, id));
                        }), s.bloqueados.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: "Bloqueados" }), s.bloqueados.map((id) => {
                                    const u = usuarioDe(s, id);
                                    return (_jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { user: u }), _jsx("div", { className: "grow cut", children: _jsx("span", { className: "strong", children: u.username }) }), _jsx("button", { className: "btn btn--sec", onClick: () => s.alternarBloqueo(id), children: "Desbloquear" })] }, id));
                                })] }))] }) }), _jsx(TabBar, { on: "perfil" })] }));
}
