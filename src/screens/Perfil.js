import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { APOYO_URL, PREVIEW, REAL, TIKTOK_PRONTO } from '../config';
import { cargarFoto, soltarFoto } from '../data/foto';
import { RESULTADO_KICK } from '../data/kick';
import { ACA, ES_COMPU, TEXTO_AVISOS, activarAvisos, desactivarAvisos, estadoAvisos, probarAviso } from '../data/push';
import { DIAS_ENTRE_NICKS, YO, buscarMia, fechaCorta, proximoCambioDeNick, rivalesDe, useStore } from '../data/store';
import { DIAS_PENDIENTE, PUNTOS, diasParaVencer, esPendiente } from '../domain/rules';
import { Avatar, BorrarCuenta, Campana, CerrarSesion, EtiquetaKick, Head, Icon, Portada, Sheet, TabBar, TarjetaNivel, hace, useAhora } from '../ui';
import { Recortador } from '../ui/Recortador';
/** Partidos que el usuario todavía no confirmó. Se muestran como un aviso pendiente. */
function Pendientes() {
    const s = useStore();
    const ahora = useAhora();
    const abierta = buscarMia(s)?.matchId;
    const pendientes = s.matches.filter((m) => m.id !== abierta && esPendiente(m, YO, ahora));
    if (pendientes.length === 0)
        return null;
    return (_jsxs("section", { className: "card card--col card--accent", "aria-label": "Partidos por confirmar", children: [_jsxs("div", { className: "row", children: [_jsx("span", { style: { color: 'var(--accent)', display: 'grid' }, children: _jsx(Icon, { name: "reloj" }) }), _jsxs("div", { className: "h grow", style: { fontSize: 24, color: 'var(--accent)' }, children: ["Por confirmar (", pendientes.length, ")"] })] }), _jsxs("div", { className: "m", children: ["\u00BFJugaste estos partidos? Si los confirm\u00E1s, cuentan. Vencen a los ", DIAS_PENDIENTE, " d\u00EDas."] }), pendientes.map((m) => {
                const dias = diasParaVencer(m, ahora);
                const otroConfirmo = m.participantes.some((p) => p.userId !== YO && p.confirmadoAt !== null);
                return (_jsxs("div", { style: { borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("div", { children: [_jsxs("div", { className: "strong", children: [m.formato && m.formato !== 'Cualquiera' ? m.formato : 'Amistoso', " con ", rivalesDe(s, m)] }), _jsxs("div", { className: "m", children: [hace(ahora - m.createdAt), m.nombreSala && ` · Sala "${m.nombreSala}"`, " \u00B7 vence en ", dias, " ", dias === 1 ? 'día' : 'días'] }), otroConfirmo && _jsxs("div", { className: "m", children: [rivalesDe(s, m), " ya confirm\u00F3."] })] }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn grow", onClick: () => s.confirmarMatch(m.id), children: "S\u00ED, jugu\u00E9" }), _jsx("button", { className: "btn btn--sec grow", onClick: () => s.descartarMatch(m.id), children: "No lo jugu\u00E9" })] })] }, m.id));
            })] }));
}
/** Mis clips: cuántos tengo en Clips y una miniatura de cada uno. Al tocar una, se abre ese clip. */
function MisClips() {
    const s = useStore();
    const ahora = useAhora();
    const mios = s.reels.filter((r) => r.userId === YO).sort((a, b) => b.publicadoAt - a.publicadoAt);
    const enClips = mios.filter((r) => r.visible && r.hashtags.some((h) => h === 'haxball' || h === 'haxmatch'));
    // Las miniaturas de TikTok vencen a las 6 horas: si la lista es vieja, se vuelve a pedir (una vez).
    const info = s.tiktokInfo;
    const vieja = REAL && s.tiktok && !!info && !info.error && info.sincronizadaAt !== null && ahora - info.sincronizadaAt > 5 * 3600 * 1000;
    const actualizar = s.actualizarTikTok;
    const pedida = useRef(false);
    useEffect(() => {
        if (!vieja || pedida.current)
            return;
        pedida.current = true;
        void actualizar();
    }, [vieja, actualizar]);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "sub-fila", children: [_jsxs("h2", { className: "h sub", children: ["Tus clips \u00B7 ", enClips.length] }), _jsx(Link, { className: "enlace", to: "/clips/mis-videos", children: mios.length > enClips.length ? `Ver los ${mios.length} videos` : 'Administrar' })] }), enClips.length === 0 ? (_jsx("div", { className: "m", children: "Todav\u00EDa no ten\u00E9s clips. Sub\u00ED un video a TikTok con #haxball o #haxmatch y aparece ac\u00E1." })) : (_jsx("div", { className: "clips-mini", children: enClips.slice(0, 12).map((r) => (_jsxs(Link, { className: "clip-mini", to: `/clips?v=${encodeURIComponent(r.id)}`, "aria-label": `Ver el clip: ${r.titulo || 'sin título'}`, children: [_jsx(Icon, { name: "play", size: 26 }), _jsx(Portada, { src: r.portada }), _jsx("span", { className: "clip-mini__t", children: r.titulo })] }, r.id))) }))] }));
}
/** Avisos con la app cerrada: se activan por separado en cada celular y en cada computadora. */
function Avisos() {
    const [estado, setEstado] = useState(null);
    const [problema, setProblema] = useState(null);
    const [probado, setProbado] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [probando, setProbando] = useState(false);
    const probar = async () => {
        setOcupado(true);
        setProbando(true);
        setProblema(null);
        setProbado(null);
        const r = await probarAviso();
        if (r.ok)
            setProbado(r.texto);
        else
            setProblema(r.texto);
        // Si la prueba no llegó, la app renueva la suscripción: el estado puede haber cambiado.
        setEstado(await estadoAvisos());
        setProbando(false);
        setOcupado(false);
    };
    useEffect(() => {
        let vivo = true;
        void estadoAvisos().then((e) => { if (vivo)
            setEstado(e); });
        return () => { vivo = false; };
    }, []);
    if (!REAL || estado === null)
        return null;
    const cambiar = async () => {
        setOcupado(true);
        setProbado(null);
        setProblema(estado === 'activos' ? await desactivarAvisos() : await activarAvisos());
        setEstado(await estadoAvisos());
        setOcupado(false);
    };
    const sePuede = estado === 'apagados' || estado === 'activos';
    return (_jsxs("div", { className: "card card--col", children: [_jsxs("div", { className: "row", children: [_jsx("span", { style: { color: estado === 'activos' ? 'var(--accent)' : 'var(--fg2)', display: 'grid' }, children: _jsx(Icon, { name: "campana", stroke: 1.75 }) }), _jsxs("div", { className: "grow", children: [_jsxs("div", { className: "strong", children: ["Avisos en ", ACA] }), _jsx("div", { className: "m", children: TEXTO_AVISOS[estado] })] })] }), problema && _jsx("div", { className: "err", role: "alert", children: problema }), probado && _jsx("div", { className: "ok", role: "status", children: probado }), estado === 'activos' && (_jsx("button", { className: "btn", disabled: ocupado, onClick: () => void probar(), children: probando ? 'Probando…' : 'Mandar un aviso de prueba' })), sePuede && (_jsx("button", { className: `btn${estado === 'activos' ? ' btn--sec' : ''}`, disabled: ocupado, onClick: () => void cambiar(), children: estado === 'activos' ? 'Desactivar avisos' : 'Activar avisos' }))] }));
}
/** Kick: vincular, ver con qué cuenta y desvincular. Al volver de Kick muestra cómo salió. */
function CuentaKick() {
    const canal = useStore((s) => s.kick[YO]);
    const vincular = useStore((s) => s.vincularKick);
    const desvincular = useStore((s) => s.desvincularKick);
    const [parametros, setParametros] = useSearchParams();
    const [aviso, setAviso] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [seguro, setSeguro] = useState(false);
    useEffect(() => {
        const r = parametros.get('kick');
        if (!r)
            return;
        setAviso(RESULTADO_KICK[r] ?? RESULTADO_KICK.error);
        parametros.delete('kick');
        setParametros(parametros, { replace: true });
    }, [parametros, setParametros]);
    const tocar = async () => {
        setOcupado(true);
        setAviso(null);
        const error = canal ? await desvincular() : await vincular();
        setOcupado(false);
        setSeguro(false);
        if (error)
            setAviso({ ok: false, texto: error });
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { nombre: "Kick" }), _jsxs("div", { className: "grow", children: [_jsxs("div", { className: "strong", children: ["Kick", canal && _jsx(EtiquetaKick, { id: YO })] }), _jsx("div", { className: "m cut", children: canal ? `Conectado como ${canal.usuario}` : 'Mostrá tu canal y avisá cuando estás en vivo' })] }), canal ? (seguro
                        ? _jsx("button", { className: "btn btn--danger", disabled: ocupado, onClick: () => void tocar(), children: "Desvincular" })
                        : _jsx("button", { className: "btn btn--sec", onClick: () => setSeguro(true), children: "Quitar" }, "quitar")) : (_jsx("button", { className: "btn", disabled: ocupado, onClick: () => void tocar(), children: "Vincular" }, "vincular"))] }), aviso && _jsx("div", { className: aviso.ok ? 'ok' : 'err', role: aviso.ok ? 'status' : 'alert', children: aviso.texto })] }));
}
/** Si los demás ven el puntito verde cuando tengo la app abierta. */
function MostrarConectado() {
    const mostrar = useStore((s) => s.mostrarConectado);
    const cambiar = useStore((s) => s.cambiarMostrarConectado);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const id = useId();
    const tocar = async () => {
        setOcupado(true);
        setError(await cambiar(!mostrar));
        setOcupado(false);
    };
    return (_jsxs("div", { className: "card card--col", children: [_jsxs("div", { className: "row", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", id: id, children: "Mostrar cuando estoy conectado" }), _jsx("div", { className: "m", children: mostrar
                                    ? 'Los demás ven un puntito verde al lado de tu nombre mientras tenés la app abierta.'
                                    : 'Nadie ve si estás conectado.' })] }), _jsx("button", { className: "switch", role: "switch", "aria-checked": mostrar, "aria-labelledby": id, disabled: ocupado, onClick: () => void tocar() })] }), error && _jsx("div", { className: "err", role: "alert", children: error })] }));
}
/** Guía de instalación. En iPhone las notificaciones solo funcionan con la app en la pantalla de inicio. */
function Instalar() {
    const [evento, setEvento] = useState(null);
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    useEffect(() => {
        const guardar = (e) => { e.preventDefault(); setEvento(e); };
        window.addEventListener('beforeinstallprompt', guardar);
        return () => window.removeEventListener('beforeinstallprompt', guardar);
    }, []);
    if (PREVIEW || instalada)
        return null;
    return (_jsxs("div", { className: "card card--col", children: [_jsxs("div", { className: "strong", children: ["Instal\u00E1 HaxMatch en tu ", ES_COMPU ? 'computadora' : 'celular'] }), esIOS ? (_jsxs("ol", { className: "steps m", children: [_jsx("li", { children: "Abr\u00ED esta p\u00E1gina en Safari." }), _jsx("li", { children: "Toc\u00E1 Compartir." }), _jsx("li", { children: "Eleg\u00ED \"Agregar a inicio\"." })] })) : (_jsx("div", { className: "m", children: ES_COMPU
                    ? 'Queda como un programa más, con su ícono y su propia ventana.'
                    : 'Se abre como una app y te deja recibir avisos de tus amigos.' })), evento?.prompt && _jsx("button", { className: "btn", onClick: () => evento.prompt?.(), children: "Instalar" })] }));
}
/** Foto propia. Al tocarla se abre la galería del celular; después se encuadra la foto elegida. */
function FotoDePerfil({ onElegida, onError }) {
    const perfil = useStore((s) => s.perfil);
    const id = useId();
    const elegir = async (e) => {
        const archivo = e.target.files?.[0];
        // Se limpia para poder volver a elegir la misma foto.
        e.target.value = '';
        if (!archivo)
            return;
        try {
            onElegida(await cargarFoto(archivo));
            onError(null);
        }
        catch (err) {
            onError(err instanceof Error ? err.message : 'No pudimos leer esa imagen. Probá con otra.');
        }
    };
    return (_jsxs("label", { className: "foto", htmlFor: id, children: [_jsx("input", { id: id, type: "file", accept: "image/*", onChange: elegir, "aria-label": perfil?.foto ? 'Cambiar foto de perfil' : 'Elegir foto de perfil de la galería' }), _jsx(Avatar, { nombre: perfil?.nick, foto: perfil?.foto, size: "lg" }), _jsx("span", { className: "foto__ins", children: _jsx(Icon, { name: "camara", size: 14 }) })] }));
}
/** Cambiar el nick. Después de cambiarlo hay que esperar 15 días para volver a hacerlo. */
function CambiarNick() {
    const perfil = useStore((s) => s.perfil);
    const cambiar = useStore((s) => s.cambiarNick);
    const ahoraDemo = useStore((s) => s.ahora);
    const [abierto, setAbierto] = useState(false);
    const [nick, setNick] = useState('');
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const id = useId();
    if (!perfil?.onboarding)
        return null;
    const desde = proximoCambioDeNick(perfil, REAL ? Date.now() : ahoraDemo());
    const abrir = () => {
        setNick(perfil.nick);
        setError(null);
        setAbierto(true);
    };
    const guardar = async (e) => {
        e.preventDefault();
        setOcupado(true);
        const problema = await cambiar(nick);
        setOcupado(false);
        if (problema)
            return setError(problema);
        setAbierto(false);
    };
    return (_jsxs(_Fragment, { children: [_jsx("button", { className: "enlace", onClick: abrir, children: "Cambiar nick" }), abierto && (_jsx(Sheet, { title: "Cambiar nick", children: desde !== null ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: ["Ya cambiaste tu nick hace poco. Pod\u00E9s volver a cambiarlo desde el ", fechaCorta(desde), "."] }), _jsx("button", { className: "btn btn--sec", onClick: () => setAbierto(false), children: "Entendido" })] })) : (_jsxs("form", { className: "lista", onSubmit: (e) => void guardar(e), children: [_jsx("label", { className: "strong", htmlFor: id, children: "Tu nuevo nick" }), _jsx("input", { id: id, className: "field", value: nick, maxLength: 20, autoComplete: "off", autoFocus: true, "aria-describedby": `${id}-nota`, onChange: (e) => { setNick(e.target.value); setError(null); } }), _jsxs("div", { className: "m", id: `${id}-nota`, children: ["Ojo: despu\u00E9s de cambiarlo, vas a tener que esperar ", DIAS_ENTRE_NICKS, " d\u00EDas para volver a cambiarlo."] }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsx("button", { className: "btn", type: "submit", disabled: ocupado || nick.trim().length < 2, children: ocupado ? 'Guardando…' : 'Guardar nick' }), _jsx("button", { className: "btn btn--sec", type: "button", onClick: () => setAbierto(false), children: "Cancelar" })] })) }))] }));
}
export function Perfil() {
    const s = useStore();
    const ahora = useAhora();
    const nav = useNavigate();
    const [errorFoto, setErrorFoto] = useState(null);
    /** Foto recién elegida de la galería, a la espera de que la encuadre. */
    const [porAjustar, setPorAjustar] = useState(null);
    const [guardandoFoto, setGuardandoFoto] = useState(false);
    const terminarAjuste = async (foto) => {
        if (porAjustar)
            soltarFoto(porAjustar);
        setPorAjustar(null);
        if (!foto)
            return;
        setGuardandoFoto(true);
        setErrorFoto(await s.cambiarFoto(foto));
        setGuardandoFoto(false);
    };
    const quitarFoto = async () => {
        setGuardandoFoto(true);
        setErrorFoto(await s.cambiarFoto(null));
        setGuardandoFoto(false);
    };
    const mios = s.matches.filter((m) => m.participantes.some((p) => p.userId === YO));
    const jugados = mios.filter((m) => m.contadoAt !== null);
    const perdidos = mios.filter((m) => m.contadoAt === null && (m.descartado || !esPendiente(m, YO, ahora)) &&
        !m.participantes.find((p) => p.userId === YO)?.confirmadoAt);
    // Con servidor, los totales vienen de toda la historia y no solo de los últimos días.
    // Con puntos en el servidor se toma lo anotado ahí: no baja si otro jugador borra su cuenta.
    const cuantosJugados = REAL && s.resumen ? Math.max(s.resumen.jugados, s.puntosServidor?.conteos.amistoso ?? 0) : jugados.length;
    const cuantosPerdidos = REAL && s.resumen ? s.resumen.perdidos : perdidos.length;
    const anotados = cuantosJugados + cuantosPerdidos;
    const asistencia = anotados === 0 ? '—' : `${Math.round((cuantosJugados / anotados) * 100)}%`;
    const veces = new Map();
    for (const m of jugados)
        for (const p of m.participantes)
            if (p.userId !== YO)
                veces.set(p.userId, (veces.get(p.userId) ?? 0) + 1);
    const masJugado = [...veces.entries()].sort((a, b) => b[1] - a[1])[0];
    const fecha = new Date(ahora).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Perfil", children: _jsx(Campana, {}) }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", style: { '--gap': '20px' }, children: [_jsxs("div", { className: "lista", children: [_jsxs("div", { className: "row", style: { gap: 14 }, children: [_jsx(FotoDePerfil, { onElegida: setPorAjustar, onError: setErrorFoto }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong cut", style: { fontSize: 22, lineHeight: 1.15 }, children: s.perfil?.nick }), _jsxs("div", { className: "m cut", children: ["Perfil p\u00FAblico \u00B7 ", s.perfil?.region.join(', ')] })] }), _jsx(CambiarNick, {})] }), _jsxs("div", { className: "row", children: [_jsx("div", { className: "m grow", children: guardandoFoto ? 'Guardando la foto…' : s.perfil?.foto ? 'Tocá tu foto para cambiarla.' : 'Tocá el recuadro para elegir una foto de tu galería.' }), s.perfil?.foto && (_jsx("button", { className: "btn btn--ghost", style: { flex: 'none' }, disabled: guardandoFoto, onClick: () => void quitarFoto(), children: "Quitar foto" }))] }), errorFoto && _jsx("div", { className: "err", role: "alert", children: errorFoto })] }), _jsx(Pendientes, {}), _jsx(TarjetaNivel, { enlace: true }), _jsxs("div", { className: "stats", children: [_jsxs("div", { className: "stat", children: [_jsx("div", { className: "h num", children: cuantosJugados }), _jsx("div", { className: "m", children: "amistosos jugados" })] }), _jsxs("div", { className: "stat", children: [_jsx("div", { className: "h num", children: asistencia }), _jsx("div", { className: "m", children: "asistencia a partidos anotados" })] })] }), s.tiktok && _jsx("div", { className: "lista", children: _jsx(MisClips, {}) }), _jsxs("div", { className: "lista", children: [_jsxs(Link, { className: "fila-enlace", to: "/perfil/amigos", children: [_jsx("span", { children: "Amigos" }), _jsxs("span", { children: [s.solicitudes.length > 0 && _jsx("span", { className: "punto" }), s.solicitudes.length > 0 ? `${s.solicitudes.length} ${s.solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}` : s.amigos.length > 0 ? s.amigos.length : '', _jsx(Icon, { name: "flecha", size: 20 })] })] }), _jsxs(Link, { className: "fila-enlace", to: "/perfil/referir", children: [_jsx("span", { children: "Referir amigos" }), _jsxs("span", { children: ["+", PUNTOS.referido, " puntos", _jsx(Icon, { name: "flecha", size: 20 })] })] }), s.admin && (_jsxs(Link, { className: "fila-enlace", to: "/admin", children: [_jsx("span", { children: "Panel de administraci\u00F3n" }), _jsx("span", { children: _jsx(Icon, { name: "flecha", size: 20 }) })] }))] }), APOYO_URL && (_jsxs("div", { className: "card card--col", children: [_jsx("div", { className: "strong", children: "Apoy\u00E1 HaxMatch" }), _jsx("div", { className: "m", children: "HaxMatch es gratis. Si te sirve, pod\u00E9s colaborar con lo que quieras para mantenerlo funcionando." }), _jsx("a", { className: "btn", href: APOYO_URL, target: "_blank", rel: "noopener noreferrer", children: "Colaborar" })] })), _jsx(MostrarConectado, {}), _jsx(Avisos, {}), _jsxs("div", { className: "lista", children: [_jsx("h2", { className: "h sub", children: "Tus cuentas" }), _jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { nombre: "D" }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "Discord" }), _jsxs("div", { className: "m cut", children: ["Conectado como ", s.perfil?.username] })] }), _jsx("span", { style: { color: 'var(--accent)' }, children: _jsx(Icon, { name: "check" }) })] }), _jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { nombre: "T" }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "TikTok" }), _jsx("div", { className: "m cut", children: s.tiktok ? `Conectado${s.tiktokInfo?.nombre ? ` como ${s.tiktokInfo.nombre}` : ''}` : TIKTOK_PRONTO ? 'Muy pronto vas a poder vincularlo' : 'Sin vincular' })] }), !s.tiktok && TIKTOK_PRONTO
                                            ? _jsx("span", { className: "pill", children: "Pronto" })
                                            : _jsx(Link, { className: `btn${s.tiktok ? ' btn--sec' : ''}`, to: "/clips/mis-videos", children: s.tiktok ? 'Mis videos' : 'Vincular' })] }), _jsx(CuentaKick, {}), _jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { nombre: "YouTube" }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "YouTube" }), _jsx("div", { className: "m", children: "Sin vincular" })] }), _jsx("span", { className: "pill", children: "Pronto" })] })] }), _jsxs("div", { className: "lista", children: [_jsx("h2", { className: "h sub", children: "Historial (p\u00FAblico)" }), _jsxs("div", { className: "card card--row", children: [_jsx(Avatar, { user: masJugado ? s.usuarios[masJugado[0]] : undefined }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "Con qui\u00E9n m\u00E1s jugaste" }), _jsx("div", { className: "m", children: masJugado ? `${s.usuarios[masJugado[0]]?.username ?? 'Jugador'} · ${masJugado[1]} ${masJugado[1] === 1 ? 'amistoso' : 'amistosos'}${REAL ? ' esta semana' : ''}` : 'Todavía no jugaste amistosos' })] })] }), _jsxs("div", { className: "card card--row", children: [_jsx(Avatar, {}), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "Equipo al que m\u00E1s enfrentaste" }), _jsx("div", { className: "m", children: "Todav\u00EDa sin datos" })] })] })] }), _jsx(Instalar, {}), !REAL && (_jsxs("div", { className: "demo", children: [_jsx("div", { className: "h", children: "Herramientas de prueba" }), _jsxs("div", { className: "m", children: ["Hoy en la demo: ", fecha, ". Avanz\u00E1 un d\u00EDa para probar la racha y los topes diarios."] }), _jsx("button", { className: "btn btn--sec", onClick: s.avanzarDia, children: "Avanzar un d\u00EDa" }), _jsx("button", { className: "btn btn--sec", onClick: () => { s.reiniciar(); nav('/ingresar'); }, children: "Reiniciar datos de prueba" })] })), _jsx(CerrarSesion, {}), REAL && s.bloqueosEnServidor && _jsx(BorrarCuenta, {}), _jsxs("p", { className: "m center", style: { margin: 0 }, children: [_jsx("a", { href: "/terminos", children: "T\u00E9rminos" }), " \u00B7 ", _jsx("a", { href: "/privacidad", children: "Privacidad" })] })] }) }), _jsx(TabBar, { on: "perfil" }), porAjustar && _jsx(Recortador, { foto: porAjustar, onGuardar: (f) => void terminarAjuste(f), onCancelar: () => void terminarAjuste() })] }));
}
