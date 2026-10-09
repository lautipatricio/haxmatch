import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { REAL } from '../config';
import { YO, buscarMia, nivelTexto, useStore, usuarioDe } from '../data/store';
import { enlaceKick } from '../data/kick';
import { BannerBusqueda, BannerMatch, Campana, Conectado, EtiquetaKick, Icon, Persona, TabBar, hace, useAhora } from '../ui';
import { FilaDisponible, resumenBusqueda } from './Buscando';
/** Lo que va adentro de cada una de las dos entradas: el título es su nombre y el renglón de abajo, su descripción. */
function Modo({ titulo, detalle, idTitulo, idDetalle, flecha = true }) {
    return (_jsxs(_Fragment, { children: [_jsxs("span", { className: "grow", children: [_jsx("span", { className: "h", id: idTitulo, children: titulo }), _jsx("span", { className: "modo__d", id: idDetalle, children: detalle })] }), flecha && _jsx(Icon, { name: "flecha", size: 24 })] }));
}
/** "Quiero jugar un amistoso": un toque y ya está en la cola, sin formulario. */
function BotonJugar({ onError }) {
    const mia = useStore(buscarMia);
    const entrar = useStore((s) => s.entrarALaCola);
    const nav = useNavigate();
    const [ocupado, setOcupado] = useState(false);
    const ids = { idTitulo: useId(), idDetalle: useId() };
    const titulo = 'Quiero jugar un amistoso';
    if (mia?.modo === 'sala') {
        // Una sola búsqueda activa: con una sala abierta, esta opción queda bloqueada hasta cerrarla.
        return (_jsx("button", { className: "modo modo--off", "aria-disabled": "true", "aria-labelledby": ids.idTitulo, "aria-describedby": ids.idDetalle, children: _jsx(Modo, { titulo: titulo, detalle: "Cancel\u00E1 tu b\u00FAsqueda actual para usar esta opci\u00F3n", flecha: false, ...ids }) }));
    }
    const tocar = async () => {
        if (mia)
            return nav('/buscando');
        setOcupado(true);
        onError(null);
        const error = await entrar();
        setOcupado(false);
        // Si ya tenía una búsqueda (la app todavía no se había enterado), no es un error: va a verla.
        if (error && !/búsqueda activa/i.test(error))
            onError(error);
        else
            nav('/buscando');
    };
    return (_jsx("button", { className: "modo modo--principal", disabled: ocupado, onClick: () => void tocar(), "aria-labelledby": ids.idTitulo, "aria-describedby": ids.idDetalle, children: _jsx(Modo, { titulo: titulo, ...ids, detalle: mia ? 'Ya estás buscando. Tocá para ver cómo va.' : ocupado ? 'Entrando a la cola…' : 'Entrás directo a la cola y las salas te invitan' }) }));
}
/** "Necesito un jugador": lleva al formulario de la sala. */
function BotonSala() {
    const mia = useStore(buscarMia);
    const ids = { idTitulo: useId(), idDetalle: useId() };
    const titulo = 'Necesito un jugador';
    if (mia?.modo === 'jugador') {
        return (_jsx("button", { className: "modo modo--off", "aria-disabled": "true", "aria-labelledby": ids.idTitulo, "aria-describedby": ids.idDetalle, children: _jsx(Modo, { titulo: titulo, detalle: "Cancel\u00E1 tu b\u00FAsqueda actual para usar esta opci\u00F3n", flecha: false, ...ids }) }));
    }
    return (_jsx(Link, { className: `modo${mia ? ' modo--principal' : ''}`, to: mia ? '/buscando' : '/sala', "aria-labelledby": ids.idTitulo, "aria-describedby": ids.idDetalle, children: _jsx(Modo, { titulo: titulo, ...ids, detalle: !mia ? 'Tenés sala y elegís a quién invitar' : mia.completaAt ? 'Tu sala está completa. Tocá para ver quién entró.' : 'Tu sala está buscando. Tocá para invitar jugadores.' }) }));
}
/** Jugadores de HaxMatch transmitiendo en Kick ahora. */
function EnVivo() {
    const s = useStore();
    const vivos = Object.values(s.kick).filter((c) => c.enVivo && c.userId !== YO && !s.bloqueados.includes(c.userId));
    if (vivos.length === 0)
        return null;
    return (_jsxs("section", { className: "lista", "aria-label": "En vivo en Kick", children: [_jsx("h2", { className: "h sub", children: "En vivo en Kick" }), vivos.map((c) => {
                const u = usuarioDe(s, c.userId);
                return (_jsxs("div", { className: "card card--row", children: [_jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id })] }), _jsx("span", { className: "m cut", children: c.titulo ?? `kick.com/${c.slug}` })] }), _jsx("a", { className: "btn btn--sec", href: enlaceKick(c.slug), target: "_blank", rel: "noopener noreferrer", "aria-label": `Ver el directo de ${u.username} en Kick`, children: "Ver" })] }, c.userId));
            })] }));
}
/** Amigos que están buscando ahora. Para escribirles hay que estar buscando también. */
function AmigosBuscando() {
    const s = useStore();
    const ahora = useAhora();
    const disponibles = s.busquedas.filter((b) => b.estado === 'activa' && s.amigos.includes(b.userId));
    if (disponibles.length === 0)
        return null;
    const buscando = !!buscarMia(s);
    return (_jsxs("section", { className: "lista", "aria-label": "Amigos buscando", children: [_jsx("h2", { className: "h sub", children: "Amigos buscando" }), disponibles.map((b) => (_jsx(FilaDisponible, { b: b, soloVer: REAL && !buscando, detalle: `${nivelTexto(s.usuarios[b.userId])}${resumenBusqueda(b)} · ${hace(ahora - b.creadaAt)}` }, b.id))), REAL && !buscando && _jsx("div", { className: "m", children: "Para escribirles, primero ponete a buscar partido." })] }));
}
export function Inicio() {
    const busquedas = useStore((s) => s.busquedas);
    const colaLista = useStore((s) => s.colaLista);
    const errorCola = useStore((s) => s.errorCola);
    const nick = useStore((s) => s.perfil?.nick);
    const suspension = useStore((s) => s.suspension);
    /** Por qué no se pudo entrar a la cola (sin conexión, por ejemplo). */
    const [error, setError] = useState(null);
    const activas = busquedas.filter((b) => b.estado === 'activa');
    return (_jsxs("div", { className: "screen", children: [_jsxs("header", { className: "head", children: [_jsxs("div", { className: "marca", "aria-hidden": "true", children: ["HAX", _jsx("span", { children: "MATCH" })] }), _jsx(Campana, { desde: "/" })] }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad inicio", children: [_jsxs("div", { className: "avisos", children: [_jsx(BannerBusqueda, {}), _jsx(BannerMatch, {})] }), _jsxs("div", { className: "hola", children: [_jsxs("h1", { className: `h${(nick?.length ?? 0) > 12 ? ' hola--largo' : ''}`, children: ["Hola, ", nick] }), _jsx("div", { className: `vivo${colaLista && activas.length > 0 ? ' vivo--si' : ''}`, children: _jsx("span", { children: !colaLista
                                            ? errorCola ?? 'Buscando jugadores…'
                                            : activas.length === 0
                                                ? 'Nadie buscando ahora. Sé el primero.'
                                                : `${activas.length} buscando ahora` }) })] }), suspension && (_jsxs("div", { className: "err", role: "alert", children: [suspension, " Mientras tanto no pod\u00E9s buscar partido, escribirle a otros jugadores ni agregar amigos."] })), _jsxs("div", { className: "modos", children: [_jsx(BotonJugar, { onError: setError }), _jsx(BotonSala, {}), error && !suspension && _jsx("div", { className: "err", role: "alert", children: error })] }), _jsx(EnVivo, {}), _jsx(AmigosBuscando, {})] }) }), _jsx(TabBar, { on: "inicio" })] }));
}
