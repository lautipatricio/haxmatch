import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { YO, miNivelUsuario, useStore, usuarioDe } from '../data/store';
import { Avatar, Campana, Conectado, EtiquetaKick, Head, Icon, TabBar } from '../ui';
const MAX = 300;
/** Mensajes seguidos de la misma persona, con menos de esto entre uno y otro, van juntos bajo un solo nombre. */
const JUNTOS_MS = 5 * 60 * 1000;
const hora = (at) => new Date(at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
/** Nombre, nivel y hora arriba del primer mensaje de cada tanda. Tocar el nombre de otro abre su perfil. */
function Autor({ u, at, mio }) {
    const abrir = useStore((s) => s.abrirFicha);
    const contenido = (_jsxs(_Fragment, { children: [_jsx(Avatar, { user: u, size: "sm" }), _jsx("span", { className: "strong cut", children: u.username }), _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id }), u.nivel !== null && _jsxs("span", { className: "pill", children: ["Nivel ", u.nivel] }), _jsx("span", { className: "m chat__hora", children: hora(at) })] }));
    if (mio)
        return _jsx("div", { className: "chat__autor", children: contenido });
    return (_jsx("button", { type: "button", className: "chat__autor", "aria-label": `Ver a ${u.username}`, onClick: () => abrir(u.id), children: contenido }));
}
function Mensaje({ m, conAutor, u, puedeBorrar, porBorrar, onBorrar }) {
    return (_jsxs("div", { className: `chat__msg${conAutor ? ' chat__msg--primero' : ''}`, children: [conAutor && _jsx(Autor, { u: u, at: m.at, mio: m.userId === YO }), _jsxs("div", { className: "chat__linea", children: [_jsx("p", { className: "chat__texto", children: m.texto }), puedeBorrar && (porBorrar ? (_jsx("button", { className: "btn btn--ghost chat__borrar-si", onClick: onBorrar, children: "Borrar" })) : (_jsx("button", { className: "x chat__borrar", "aria-label": "Borrar mensaje", onClick: onBorrar, children: _jsx(Icon, { name: "basura", size: 18 }) })))] })] }));
}
export function Chat() {
    const s = useStore();
    const [texto, setTexto] = useState('');
    const [error, setError] = useState(null);
    const [enviando, setEnviando] = useState(false);
    /** Mensaje con el "Borrar" a la vista, esperando el segundo toque. */
    const [porBorrar, setPorBorrar] = useState(null);
    /** Quien administra: muestra el tacho también en los mensajes de los demás. */
    const [moderar, setModerar] = useState(false);
    const lista = useRef(null);
    /** Si estaba mirando lo último: entonces, cuando llega algo nuevo, se baja solo. */
    const abajo = useRef(true);
    const conectarChat = s.conectarChat;
    useEffect(() => conectarChat(), [conectarChat]);
    // Lo de quien bloqueé no se muestra (con servidor ya no viene, pero el bloqueo recién hecho tarda un momento).
    const mensajes = s.chat.filter((m) => !s.bloqueados.includes(m.userId));
    const ultimo = mensajes[mensajes.length - 1]?.id;
    useLayoutEffect(() => {
        const el = lista.current;
        if (el && abajo.current)
            el.scrollTop = el.scrollHeight;
    }, [ultimo, s.chatListo]);
    // Lo que está en pantalla queda leído (también lo que llega mientras la tengo abierta).
    const marcarVisto = s.marcarChatVisto;
    useEffect(() => { marcarVisto(); }, [ultimo, s.chatListo, marcarVisto]);
    useEffect(() => {
        if (!porBorrar)
            return;
        const t = setTimeout(() => setPorBorrar(null), 4000);
        return () => clearTimeout(t);
    }, [porBorrar]);
    const autor = (userId) => {
        if (userId !== YO)
            return usuarioDe(s, userId);
        return { ...usuarioDe(s, YO), id: YO, username: s.perfil?.nick ?? 'Vos', foto: s.perfil?.foto ?? null, nivel: miNivelUsuario(s) };
    };
    const enviar = async (e) => {
        e.preventDefault();
        if (enviando)
            return;
        setEnviando(true);
        setError(null);
        abajo.current = true;
        const problema = await s.escribirChat(texto);
        setEnviando(false);
        if (problema)
            setError(problema);
        else
            setTexto('');
    };
    const borrar = async (id) => {
        if (porBorrar !== id)
            return setPorBorrar(id);
        setPorBorrar(null);
        const problema = await s.borrarMensajeChat(id);
        if (problema)
            setError(problema);
    };
    const largo = texto.trim().length;
    return (_jsxs("div", { className: "screen", children: [_jsxs(Head, { title: "Chat", children: [s.admin && (_jsx("button", { className: "btn btn--sec", "aria-pressed": moderar, onClick: () => setModerar(!moderar), children: moderar ? 'Listo' : 'Moderar' })), _jsx(Campana, { desde: "/chat" })] }), _jsx("div", { className: "scroll", ref: lista, onScroll: (e) => {
                    const el = e.currentTarget;
                    abajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                }, children: _jsxs("div", { className: "pad chat", children: [_jsx("p", { className: "m chat__nota", children: "Chat de toda la comunidad. Los mensajes duran 24 horas. Toc\u00E1 un nombre para ver su perfil, reportarlo o bloquearlo." }), !s.chatListo ? (_jsx("div", { className: "m center", children: "Cargando mensajes\u2026" })) : s.errorChat && mensajes.length === 0 ? (_jsx("div", { className: "err", role: "alert", children: s.errorChat })) : mensajes.length === 0 ? (_jsxs("div", { className: "vacio", children: [_jsx("div", { className: "h", children: "Todav\u00EDa no hay mensajes" }), _jsx("div", { className: "m", children: "Salud\u00E1 a la comunidad o avis\u00E1 que est\u00E1s buscando partido." })] })) : (_jsx("div", { className: "chat__lista", role: "log", "aria-label": "Mensajes del chat", "aria-live": "polite", children: mensajes.map((m, i) => {
                                const antes = mensajes[i - 1];
                                const conAutor = !antes || antes.userId !== m.userId || m.at - antes.at > JUNTOS_MS;
                                return (_jsx(Mensaje, { m: m, conAutor: conAutor, u: autor(m.userId), puedeBorrar: m.userId === YO || (s.admin && moderar), porBorrar: porBorrar === m.id, onBorrar: () => void borrar(m.id) }, m.id));
                            }) }))] }) }), _jsxs("form", { className: "chat__escribir", onSubmit: (e) => void enviar(e), children: [error && _jsx("div", { className: "err", role: "alert", children: error }), s.suspension ? (_jsxs("div", { className: "m", children: [s.suspension, " Mientras tanto no pod\u00E9s escribir en el chat."] })) : (_jsxs("div", { className: "row", children: [_jsx("input", { id: "chat-texto", className: "field grow", value: texto, maxLength: MAX, autoComplete: "off", enterKeyHint: "send", placeholder: "Escrib\u00ED un mensaje", "aria-label": "Mensaje", onChange: (e) => { setTexto(e.target.value); if (error)
                                    setError(null); } }), _jsx("button", { className: "btn btn--icon", type: "submit", "aria-label": "Enviar", disabled: enviando || largo === 0, children: _jsx(Icon, { name: "enviar", size: 20 }) })] })), largo > MAX - 50 && _jsxs("div", { className: "m chat__quedan", children: ["Te quedan ", MAX - largo, " letras"] })] }), _jsx(TabBar, { on: "chat" })] }));
}
