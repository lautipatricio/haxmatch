import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { YO, useStore } from '../data/store';
import { Empty, Head, Icon, TabBar, hace, useAhora } from '../ui';
function Accion({ n }) {
    const s = useStore();
    if (n.tipo === 'amigo_disponible' || n.tipo === 'amigo_sala') {
        const b = s.busquedas.find((x) => x.id === n.ref && x.estado === 'activa');
        if (!b)
            return null;
        const enviado = s.mensajes.some((m) => m.de === YO && m.a === b.userId && m.estado === 'pendiente');
        return _jsx("button", { className: "btn", disabled: enviado, onClick: () => s.enviarMensaje(b.userId), children: enviado ? 'Enviado' : 'Mensaje' });
    }
    if (n.tipo === 'mensaje') {
        const msg = s.mensajes.find((m) => m.id === n.ref);
        if (msg?.estado !== 'pendiente')
            return msg ? _jsx("span", { className: "pill", children: msg.estado === 'aceptado' ? 'Aceptaste' : 'Rechazaste' }) : null;
        return (_jsxs("div", { className: "acts", children: [_jsx("button", { className: "btn", onClick: () => s.responderMensaje(msg.id, true), children: "Aceptar" }), _jsx("button", { className: "btn btn--sec btn--icon", "aria-label": "Rechazar", onClick: () => s.responderMensaje(msg.id, false), children: _jsx(Icon, { name: "x", size: 18 }) })] }));
    }
    if (n.tipo === 'solicitud' && s.solicitudes.includes(n.ref ?? ''))
        return _jsx(Link, { className: "btn", to: "/perfil/amigos", children: "Ver" });
    if (n.tipo === 'match' && n.ref)
        return _jsx(Link, { className: "btn", to: `/match/${n.ref}`, children: "Ver" });
    return null;
}
export function Notificaciones() {
    const notifs = useStore((s) => s.notifs);
    const marcarLeidas = useStore((s) => s.marcarLeidas);
    const ahora = useAhora();
    // La flecha vuelve a donde se tocó la campana (Inicio o Perfil).
    const desde = useLocation().state?.desde;
    // Se marcan como leídas al salir, así se alcanza a ver cuáles eran nuevas.
    useEffect(() => marcarLeidas, [marcarLeidas]);
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Notificaciones", back: desde === '/' ? '/' : '/perfil' }), notifs.length === 0 ? (_jsx(Empty, { title: "Sin notificaciones", text: "Te avisamos cuando te escriben, cuando entr\u00E1s a una sala y cuando un amigo se pone a buscar." })) : (_jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [notifs.map((n) => (_jsxs("div", { className: "card card--row", children: [!n.leida && _jsx("span", { className: "punto", role: "img", "aria-label": "Nueva" }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: n.titulo }), _jsxs("div", { className: "m", children: [n.detalle, " \u00B7 ", hace(ahora - n.at)] })] }), _jsx(Accion, { n: n })] }, n.id))), _jsx("p", { className: "m center", style: { margin: 0 }, children: "Para recibirlos con la app cerrada o en otra ventana, activ\u00E1 los avisos desde tu Perfil." })] }) })), _jsx(TabBar, { on: desde === '/' ? 'inicio' : 'perfil' })] }));
}
