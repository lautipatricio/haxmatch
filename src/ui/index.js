import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { REAL } from '../config';
import { YO, buscarMia, chatSinLeer, miRacha, misPuntos, nombreDe, useStore, usuarioDe } from '../data/store';
import { leerFicha } from '../data/servidor';
import { enlaceKick } from '../data/kick';
import { progresoNivel } from '../domain/rules';
// ---------- Tiempo ----------
/** Hora actual de la app (respeta "avanzar un día" de la demo), actualizada cada segundo. */
export function useAhora() {
    const ahora = useStore((s) => s.ahora);
    const [, set] = useState(0);
    useEffect(() => {
        const t = setInterval(() => set((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);
    return ahora();
}
export function mmss(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const p = (n) => String(n).padStart(2, '0');
    return s >= 3600 ? `${Math.floor(s / 3600)}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`;
}
export function hace(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 1)
        return 'recién';
    if (min < 60)
        return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24)
        return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} días`;
}
const PATHS = {
    inicio: _jsx("path", { d: "M4 11.5 12 4l8 7.5V20h-5.5v-5h-5v5H4z" }),
    chat: _jsx("path", { d: "M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5H5A1.5 1.5 0 0 1 3.5 16V7A1.5 1.5 0 0 1 5 5.5z" }),
    basura: _jsx("path", { d: "M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6" }),
    enviar: _jsx("path", { d: "M4.5 12 20 4.5 15.5 20l-3.5-6.5zM12 13.5 20 4.5" }),
    clips: _jsxs(_Fragment, { children: [_jsx("rect", { x: "3.5", y: "4.5", width: "17", height: "15", rx: "3" }), _jsx("path", { d: "m10.5 9.5 4.5 2.5-4.5 2.5z" })] }),
    perfil: _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "8.5", r: "3.5" }), _jsx("path", { d: "M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" })] }),
    campana: _jsx("path", { d: "M6.5 10a5.5 5.5 0 0 1 11 0c0 5 2 6.5 2 6.5h-15s2-1.5 2-6.5zM10 19.5h4" }),
    atras: _jsx("path", { d: "m15 6-6 6 6 6" }),
    flecha: _jsx("path", { d: "m9 6 6 6-6 6" }),
    abajo: _jsx("path", { d: "m6 9 6 6 6-6" }),
    check: _jsx("path", { d: "M5 12l5 5 9-10" }),
    play: _jsx("path", { d: "M8 5l11 7-11 7z", fill: "currentColor", stroke: "none" }),
    sonido: _jsxs(_Fragment, { children: [_jsx("path", { d: "M4 9.5v5h3.5L12 18V6L7.5 9.5z" }), _jsx("path", { d: "M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" })] }),
    mudo: _jsxs(_Fragment, { children: [_jsx("path", { d: "M4 9.5v5h3.5L12 18V6L7.5 9.5z" }), _jsx("path", { d: "m16 9.5 5 5M21 9.5l-5 5" })] }),
    x: _jsx("path", { d: "M6 6l12 12M18 6L6 18" }),
    corazon: _jsx("path", { d: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" }),
    copiar: _jsxs(_Fragment, { children: [_jsx("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }), _jsx("path", { d: "M5 15V6a2 2 0 0 1 2-2h9" })] }),
    reloj: _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M12 7v5l3 2" })] }),
    camara: _jsxs(_Fragment, { children: [_jsx("path", { d: "M4 8h3l2-3h6l2 3h3v11H4z" }), _jsx("circle", { cx: "12", cy: "13", r: "3.5" })] }),
};
export function Icon({ name, size = 22, stroke = 2, fill }) {
    return (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: fill ? 'currentColor' : 'none', stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: PATHS[name] }));
}
// ---------- Piezas ----------
/** Miniatura de un video de TikTok. Vence a las horas: si ya no carga, no se muestra nada. */
export function Portada({ src }) {
    const [rota, setRota] = useState(null);
    if (!src || rota === src)
        return null;
    return _jsx("img", { className: "portada", src: src, alt: "", loading: "lazy", decoding: "async", referrerPolicy: "no-referrer", onError: () => setRota(src) });
}
export function Avatar({ user, nombre, size, foto }) {
    const n = user?.username ?? nombre ?? '?';
    const imagen = foto ?? user?.foto;
    return (_jsx("div", { className: `av${size ? ` av--${size}` : ''}`, style: user ? { background: user.color } : undefined, "aria-hidden": "true", children: imagen ? _jsx("img", { src: imagen, alt: "" }) : n.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1) || '?' }));
}
/** Puntito verde al lado del nombre: tiene la app abierta ahora. */
export function Conectado({ id }) {
    const esta = useStore((s) => s.conectados.includes(id));
    if (!esta)
        return null;
    return _jsx("span", { className: "en-linea", role: "img", "aria-label": "conectado", title: "Conectado" });
}
/** Logo de Kick al lado del nombre (el archivo oficial, public/kick.png). Mientras transmite dice EN VIVO. */
export function EtiquetaKick({ id }) {
    const canal = useStore((s) => s.kick[id]);
    if (!canal)
        return null;
    return canal.enVivo
        ? _jsxs("span", { className: "kick kick--vivo", title: `En vivo en Kick: ${canal.usuario}`, children: [_jsx("span", { className: "kick__punto", "aria-hidden": "true" }), "EN VIVO"] })
        : _jsx("img", { className: "kick-logo", src: "/kick.png", alt: `Kick: ${canal.usuario}`, title: `Kick: ${canal.usuario}`, width: 40, height: 13 });
}
/**
 * Foto y nombre de otro jugador. Al tocarlo se abre su ficha, para agregarlo
 * como amigo o reportarlo.
 */
export function Persona({ user, children }) {
    const abrir = useStore((s) => s.abrirFicha);
    return (_jsxs("button", { type: "button", className: "persona grow", "aria-label": `Ver a ${user.username}`, onClick: () => abrir(user.id), children: [_jsx(Avatar, { user: user }), _jsx("span", { className: "grow", children: children })] }));
}
/**
 * Perfil de otro jugador: quién es, cuántos amistosos jugó, su nivel y qué puedo hacer
 * con él (agregarlo como amigo, reportarlo o bloquearlo). Se abre tocándolo en cualquier lista.
 */
export function FichaJugador() {
    const s = useStore();
    const nav = useNavigate();
    const [error, setError] = useState(null);
    const [quitar, setQuitar] = useState(false);
    /** Lo que se le pidió al servidor de este jugador. undefined: todavía no llegó. null: no se pudo saber. */
    const [datos, setDatos] = useState(undefined);
    const id = s.ficha;
    useEffect(() => {
        setError(null);
        setQuitar(false);
        setDatos(undefined);
        if (!id || !REAL)
            return;
        let vivo = true;
        void leerFicha(id).then((d) => { if (vivo)
            setDatos(d ? { id, ...d } : null); });
        return () => { vivo = false; };
    }, [id]);
    if (!id)
        return null;
    const u = usuarioDe(s, id);
    const amigo = s.amigos.includes(id);
    const enviada = s.solicitudesEnviadas.includes(id);
    const recibida = s.solicitudes.includes(id);
    const cerrar = s.cerrarFicha;
    const agregar = async () => setError(await s.pedirAmistad(id));
    // Con servidor, los números son los que acaba de mandar; en la demostración, los de muestra.
    const canal = s.kick[id];
    const delServidor = datos && datos.id === id ? datos : null;
    const jugados = REAL ? delServidor?.jugados : u.jugados;
    const nivel = delServidor?.nivel ?? u.nivel;
    const cargando = REAL && datos === undefined;
    return (_jsx("div", { className: "scrim", style: { zIndex: 40 }, onClick: (e) => { if (e.target === e.currentTarget)
            cerrar(); }, children: _jsxs("div", { className: "sheet ficha", role: "dialog", "aria-label": `Perfil de ${u.username}`, children: [_jsxs("div", { className: "row", style: { gap: 14 }, children: [_jsx(Avatar, { user: u, size: "lg" }), _jsxs("div", { className: "grow", children: [_jsxs("div", { className: "strong cut", style: { fontSize: 22, lineHeight: 1.15 }, children: [u.username, _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id })] }), _jsxs("div", { className: "m cut", children: [u.discord ? `Discord: ${u.discord}` : 'Jugador de HaxMatch', amigo && ' · es tu amigo'] })] })] }), (cargando || jugados !== undefined || nivel !== null) && (_jsxs("div", { className: "stats", "aria-busy": cargando, children: [(cargando || jugados !== undefined) && (_jsxs("div", { className: "stat", children: [_jsx("div", { className: "h num", children: jugados ?? '…' }), _jsx("div", { className: "m", children: jugados === 1 ? 'amistoso jugado' : 'amistosos jugados' })] })), nivel !== null && (_jsxs("div", { className: "stat", children: [_jsx("div", { className: "h num", children: nivel }), _jsx("div", { className: "m", children: "nivel" })] }))] })), canal?.enVivo ? (
                // En vivo: un bloque que se toca entero y lleva a su directo.
                _jsxs("a", { className: "vivo-kick", href: enlaceKick(canal.slug), target: "_blank", rel: "noopener noreferrer", "aria-label": `${u.username} está en vivo en Kick. Ver el directo`, children: [_jsxs("span", { className: "row", style: { gap: 8 }, children: [_jsx(EtiquetaKick, { id: id }), _jsx("span", { className: "strong grow", children: "Est\u00E1 en vivo en Kick" }), _jsx(Icon, { name: "flecha", size: 20 })] }), canal.titulo && _jsx("span", { className: "vivo-kick__titulo", children: canal.titulo }), _jsxs("span", { className: "m", children: ["Toc\u00E1 para ver el directo \u00B7 kick.com/", canal.slug] })] })) : canal && (_jsxs("a", { className: "btn btn--sec", href: enlaceKick(canal.slug), target: "_blank", rel: "noopener noreferrer", children: ["Ver su canal en Kick (", canal.usuario, ")"] })), error && _jsx("div", { className: "err", role: "alert", children: error }), amigo ? (quitar ? (_jsxs(_Fragment, { children: [_jsx("div", { children: "\u00BFDejar de ser amigos? Ya no te vamos a avisar cuando se ponga a buscar." }), _jsx("button", { className: "btn btn--danger", onClick: () => { s.quitarAmigo(id); cerrar(); }, children: "S\u00ED, quitar de amigos" })] })) : (_jsx("button", { className: "btn btn--sec", onClick: () => setQuitar(true), children: "Quitar de amigos" }))) : recibida ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [u.username, " quiere ser tu amigo."] }), _jsx("button", { className: "btn", onClick: () => s.responderSolicitud(id, true), children: "Aceptar solicitud" }), _jsx("button", { className: "btn btn--sec", onClick: () => s.responderSolicitud(id, false), children: "Rechazar" })] })) : enviada ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn--sec", disabled: true, children: "Solicitud enviada" }), _jsx("button", { className: "btn btn--ghost", onClick: () => s.quitarAmigo(id), children: "Retirar la solicitud" })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn", onClick: () => void agregar(), children: "Agregar a amigos" }), _jsx("div", { className: "m", children: REAL ? 'Cuando acepte, te avisamos cada vez que se ponga a buscar partido.' : 'Cuando acepte, lo vas a ver primero en la cola.' })] })), _jsx("button", { className: "btn btn--ghost", onClick: () => { cerrar(); nav(`/reportar/${id}`); }, children: "Reportar o bloquear" }), _jsx("button", { className: "btn btn--sec", onClick: cerrar, children: "Cerrar" })] }) }));
}
export function Head({ title, back, chico, children }) {
    const nav = useNavigate();
    return (_jsxs("header", { className: `head${chico ? ' head--chico' : ''}`, children: [back && (_jsx("button", { className: "back", "aria-label": "Volver", onClick: () => (back === true ? nav(-1) : nav(back)), children: _jsx(Icon, { name: "atras" }) })), _jsx("h1", { className: "h title", children: title }), children] }));
}
export function Chips({ label, options, value, onChange, format }) {
    return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: label }), _jsx("div", { className: "chips", role: "group", "aria-label": label, children: options.map((o) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": o === value, onClick: () => onChange(o), children: format ? format(o) : o }, o))) })] }));
}
/**
 * Chips donde se pueden marcar varias opciones. Si hay una opción "todas"
 * (Cualquiera), es excluyente: marcarla limpia el resto y marcar otra la saca.
 * Siempre queda al menos una marcada.
 */
export function ChipsMulti({ label, options, value, onChange, todas }) {
    const alternar = (o) => {
        if (o === todas)
            return onChange([o]);
        const marcadas = new Set(value.filter((v) => v !== todas));
        if (marcadas.has(o))
            marcadas.delete(o);
        else
            marcadas.add(o);
        const concretas = options.filter((x) => x !== todas);
        // Sin ninguna, o con todas las concretas, equivale a "todas".
        if (todas !== undefined && (marcadas.size === 0 || marcadas.size === concretas.length))
            return onChange([todas]);
        if (marcadas.size === 0)
            return;
        onChange(concretas.filter((x) => marcadas.has(x)));
    };
    return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: label }), _jsx("div", { className: "chips", role: "group", "aria-label": `${label}. Podés elegir varias`, children: options.map((o) => (_jsx("button", { type: "button", className: "chip", "aria-pressed": value.includes(o), onClick: () => alternar(o), children: o }, o))) })] }));
}
export function TabBar({ on }) {
    const sinLeer = useStore((s) => s.notifs.some((n) => !n.leida));
    const chatNuevo = useStore(chatSinLeer);
    return (_jsxs("nav", { className: "tabbar", "aria-label": "Secciones", children: [_jsxs(Link, { to: "/", className: on === 'inicio' ? 'on' : '', "aria-current": on === 'inicio' ? 'page' : undefined, children: [_jsx(Icon, { name: "inicio", size: 24, stroke: 1.75 }), "Inicio"] }), _jsxs(Link, { to: "/chat", className: on === 'chat' ? 'on' : '', "aria-current": on === 'chat' ? 'page' : undefined, children: [_jsx(Icon, { name: "chat", size: 24, stroke: 1.75 }), "Chat", chatNuevo && on !== 'chat' && _jsx("span", { className: "dot", "aria-label": "Hay mensajes sin leer en el chat" })] }), _jsxs(Link, { to: "/clips", className: on === 'clips' ? 'on' : '', "aria-current": on === 'clips' ? 'page' : undefined, children: [_jsx(Icon, { name: "clips", size: 24, stroke: 1.75 }), "Clips"] }), _jsxs(Link, { to: "/perfil", className: on === 'perfil' ? 'on' : '', "aria-current": on === 'perfil' ? 'page' : undefined, children: [_jsx(Icon, { name: "perfil", size: 24, stroke: 1.75 }), "Perfil", sinLeer && _jsx("span", { className: "dot", "aria-label": "Hay notificaciones sin leer" })] })] }));
}
/** Acceso a las notificaciones, con el punto de "hay sin leer". `desde`: a dónde vuelve la flecha de esa pantalla. */
export function Campana({ desde }) {
    const sinLeer = useStore((s) => s.notifs.some((n) => !n.leida));
    return (_jsxs(Link, { className: "btn btn--sec btn--icon", to: "/perfil/notificaciones", state: desde ? { desde } : undefined, "aria-label": sinLeer ? 'Notificaciones, hay sin leer' : 'Notificaciones', children: [_jsx(Icon, { name: "campana", stroke: 1.75 }), sinLeer && _jsx("span", { className: "dot" })] }));
}
/** Nivel, racha y avance al próximo nivel. En el perfil es un enlace al detalle. */
export function TarjetaNivel({ enlace }) {
    const s = useStore();
    const ahora = useAhora();
    const p = progresoNivel(misPuntos(s));
    const racha = miRacha(s, ahora);
    const avance = Math.round(p.avance * 100);
    const idPuntos = useId();
    const dentro = (_jsxs(_Fragment, { children: [_jsxs("span", { className: "nivel__t", children: [_jsxs("span", { className: "h num", children: ["Nivel ", p.nivel] }), racha > 0 && _jsxs("span", { className: "m num", children: [racha, " ", racha === 1 ? 'día seguido' : 'días seguidos'] })] }), _jsx("span", { className: "bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": avance, "aria-label": "Avance al pr\u00F3ximo nivel", children: _jsx("span", { style: { width: `${avance}%` } }) }), _jsx("span", { className: "m num", id: idPuntos, children: p.hasta === null
                    ? `${p.puntos} puntos · llegaste al nivel máximo`
                    : `${p.puntos} de ${p.hasta} puntos · te faltan ${p.hasta - p.puntos} para el Nivel ${p.nivel + 1}` })] }));
    return enlace
        ? _jsx(Link, { className: "card card--col nivel", to: "/perfil/nivel", "aria-label": `Nivel ${p.nivel}. Ver detalle`, "aria-describedby": idPuntos, children: dentro })
        : _jsx("div", { className: "card card--col nivel", children: dentro });
}
export function Sheet({ title, children, clear }) {
    return (_jsx("div", { className: `scrim${clear ? ' scrim--clear' : ''}`, children: _jsxs("div", { className: "sheet", role: "dialog", "aria-label": title, children: [_jsx("div", { className: "h", children: title }), children] }) }));
}
/** Aviso de búsqueda activa. Aparece solo si hay una búsqueda. */
export function BannerBusqueda({ detalle }) {
    const mia = useStore(buscarMia);
    const cancelar = useStore((s) => s.cancelarBusqueda);
    const ahora = useAhora();
    if (!mia)
        return null;
    const texto = mia.modo === 'sala' ? 'Ya estás buscando jugador' : 'Ya estás buscando partido';
    // Sala llena: ya no se busca, solo falta marcar quién entró.
    if (mia.modo === 'sala' && mia.completaAt) {
        return (_jsxs("div", { className: "banner", role: "status", children: [_jsxs(Link, { to: "/buscando", className: "grow", children: [_jsx("div", { className: "strong", children: "Tu sala est\u00E1 completa" }), _jsx("div", { className: "banner__d", children: "Marc\u00E1 qui\u00E9n ya entr\u00F3 para armar el match" })] }), _jsx(Link, { className: "btn", to: "/buscando", children: "Ver" })] }));
    }
    return (_jsxs("div", { className: "banner", role: "status", children: [_jsxs(Link, { to: "/buscando", className: "grow", children: [_jsxs("div", { className: "strong num", children: [texto, " \u00B7 ", mmss(ahora - mia.creadaAt)] }), detalle && _jsx("div", { className: "banner__d", children: detalle })] }), _jsx("button", { className: "btn btn--sec", onClick: cancelar, children: "Cancelar" })] }));
}
/** Aviso de un match recién armado en la sala de otro, para volver a encontrarlo desde el Inicio. */
export function BannerMatch() {
    const s = useStore();
    const ahora = useAhora();
    const DOS_HORAS = 2 * 60 * 60 * 1000;
    const m = s.matches.find((x) => x.creadoPor !== YO && !x.descartado && ahora - x.createdAt < DOS_HORAS &&
        x.participantes.some((p) => p.userId === YO && p.confirmadoAt === null));
    if (!m)
        return null;
    return (_jsxs("div", { className: "banner", role: "status", children: [_jsxs(Link, { to: `/match/${m.id}`, className: "grow", children: [_jsxs("div", { className: "strong", children: ["Ten\u00E9s un match con ", nombreDe(s, m.creadoPor)] }), _jsx("div", { className: "banner__d", children: "Entr\u00E1 a la sala y avis\u00E1 cuando est\u00E9s adentro" })] }), _jsx(Link, { className: "btn", to: `/match/${m.id}`, children: "Abrir" })] }));
}
export function Empty({ title, text, children }) {
    return (_jsxs("div", { className: "empty", children: [_jsx("div", { className: "h", children: title }), _jsx("div", { className: "m", style: { maxWidth: 300 }, children: text }), children] }));
}
function ToastItem({ t }) {
    const cerrar = useStore((s) => s.cerrarToast);
    const responder = useStore((s) => s.responderMensaje);
    const nav = useNavigate();
    useEffect(() => {
        const timer = setTimeout(() => cerrar(t.id), t.mensajeId ? 20000 : 5000);
        return () => clearTimeout(timer);
    }, [t.id, t.mensajeId, cerrar]);
    return (_jsxs("div", { className: "toast", role: "status", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: t.texto }), t.detalle && _jsx("div", { className: "m", children: t.detalle })] }), t.mensajeId ? (_jsxs("div", { className: "acts", children: [_jsx("button", { className: "btn", onClick: () => responder(t.mensajeId, true), children: "Aceptar" }), _jsx("button", { className: "btn btn--sec btn--icon", "aria-label": "Rechazar", onClick: () => responder(t.mensajeId, false), children: _jsx(Icon, { name: "x", size: 18 }) })] })) : (_jsxs("div", { className: "acts", children: [t.to && _jsx("button", { className: "btn", onClick: () => { cerrar(t.id); nav(t.to); }, children: t.toLabel ?? 'Ver' }), _jsx("button", { className: "x", "aria-label": "Cerrar aviso", onClick: () => cerrar(t.id), children: _jsx(Icon, { name: "x", size: 18 }) })] }))] }));
}
export function Toasts() {
    const todos = useStore((s) => s.toasts);
    const buscando = useStore((s) => !!buscarMia(s));
    const { pathname } = useLocation();
    // En la pantalla de búsqueda, lo que me escriben ya se ve ahí (cartel o lista "Te escribieron").
    const toasts = pathname === '/buscando' && buscando ? todos.filter((t) => !t.mensajeId) : todos;
    if (toasts.length === 0)
        return null;
    return _jsx("div", { className: "toasts", children: toasts.map((t) => _jsx(ToastItem, { t: t }, t.id)) });
}
/**
 * Cerrar sesión, con confirmación. El botón es angosto y va centrado para que
 * un toque de más sobre la barra inferior no lo active sin querer.
 */
export function CerrarSesion() {
    const cerrar = useStore((s) => s.cerrarSesion);
    const nav = useNavigate();
    const [abierto, setAbierto] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn--ghost", style: { alignSelf: 'center' }, onClick: () => setAbierto(true), children: "Cerrar sesi\u00F3n" }), abierto && (_jsxs(Sheet, { title: "\u00BFCerrar sesi\u00F3n?", children: [_jsx("div", { children: "Vas a tener que volver a entrar con Discord. Si est\u00E1s buscando, la b\u00FAsqueda se cancela." }), _jsx("button", { className: "btn btn--danger", onClick: () => { cerrar(); nav('/ingresar'); }, children: "S\u00ED, cerrar sesi\u00F3n" }), _jsx("button", { className: "btn btn--sec", onClick: () => setAbierto(false), children: "Cancelar" })] }))] }));
}
/** Borrar la cuenta para siempre. Pide escribir BORRAR, para que no pase por un toque de más. */
export function BorrarCuenta() {
    const borrar = useStore((s) => s.borrarCuenta);
    const nav = useNavigate();
    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const confirmar = async () => {
        setOcupado(true);
        const e = await borrar();
        setOcupado(false);
        if (e)
            setError(e);
        else
            nav('/ingresar', { replace: true });
    };
    return (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn btn--ghost", style: { alignSelf: 'center', color: 'var(--fg2)' }, onClick: () => { setAbierto(true); setTexto(''); setError(null); }, children: "Borrar mi cuenta" }), abierto && (_jsxs(Sheet, { title: "\u00BFBorrar tu cuenta?", children: [_jsx("div", { children: "Se borra para siempre tu perfil con todo lo tuyo: foto, puntos y nivel, amigos, partidos, clips y la vinculaci\u00F3n con TikTok. No se puede deshacer." }), _jsx("label", { className: "m", htmlFor: "confirmar-borrado", children: "Para confirmar, escrib\u00ED BORRAR" }), _jsx("input", { id: "confirmar-borrado", className: "field", value: texto, autoComplete: "off", autoCapitalize: "characters", onChange: (e) => setTexto(e.target.value) }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsx("button", { className: "btn btn--danger", disabled: ocupado || texto.trim().toUpperCase() !== 'BORRAR', onClick: () => void confirmar(), children: ocupado ? 'Borrando…' : 'Borrar mi cuenta para siempre' }), _jsx("button", { className: "btn btn--sec", disabled: ocupado, onClick: () => setAbierto(false), children: "Cancelar" })] }))] }));
}
/** Copia al portapapeles. Devuelve si se pudo. */
export async function copiar(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    }
    catch {
        return false;
    }
}
