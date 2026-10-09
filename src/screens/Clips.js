import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { REAL, TIKTOK_PRONTO } from '../config';
import { RESULTADO_TIKTOK, tiktokHabilitado } from '../data/clips';
import { seedReels } from '../data/seed';
import { YO, buscarMia, feed, misPuntos, nombreDe, useStore } from '../data/store';
import { nivelDe } from '../domain/rules';
import { Avatar, BannerBusqueda, Empty, Head, Icon, Portada, Sheet, TabBar, hace, useAhora } from '../ui';
const TIKTOK = 'https://www.tiktok.com';
// Reproductor de TikTok sin sus textos, sus videos relacionados ni su barra de controles:
// el clip arranca solo y el sonido se maneja con el botón de HaxMatch.
// Va con autoplay=1: sin eso el reproductor de TikTok no se pone en marcha (ni avisa
// que está listo, ni obedece) hasta que alguien toca el video mismo.
const opciones = (controles) => {
    const c = controles ? 1 : 0;
    return `controls=${c}&progress_bar=${c}&play_button=${c}&volume_control=${c}&fullscreen_button=0&timestamp=0&loop=1&autoplay=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`;
};
const CLAVE_SONIDO = 'haxmatch-sonido';
const leerSonido = () => {
    try {
        return window.localStorage.getItem(CLAVE_SONIDO) !== '0';
    }
    catch {
        return true;
    }
};
/** ¿Los clips van con sonido? Se elige una vez y vale para todos los clips, también la próxima vez que se abre la app. */
let quiereSonido = leerSonido();
/** ¿Ya sonó algún clip desde que se abrió la app? El cartel grande de "Activar sonido" sale solo antes de eso. */
let yaSono = false;
const elegirSonido = (si) => {
    quiereSonido = si;
    try {
        window.localStorage.setItem(CLAVE_SONIDO, si ? '1' : '0');
    }
    catch { /* sin almacenamiento: vale mientras la app está abierta */ }
};
/** Aviso del reproductor de TikTok. Los manda como objeto; por las dudas se acepta también como texto. */
function leerAviso(dato) {
    if (typeof dato === 'string') {
        if (!dato.startsWith('{'))
            return null;
        try {
            return JSON.parse(dato);
        }
        catch {
            return null;
        }
    }
    return dato && typeof dato === 'object' ? dato : null;
}
/**
 * Video de TikTok, reproducido desde TikTok (no se copia). Arranca solo cuando
 * el clip queda en pantalla. Los navegadores solo dejan arrancar sin sonido,
 * así que al arrancar se pide el sonido (si el usuario no lo silenció). Si el
 * celular no lo permite sin un toque, el video sigue sin sonido y alcanza con
 * tocarlo una vez.
 * Encima va una capa que recibe los toques: así se puede deslizar al clip
 * siguiente, cosa que sobre el reproductor solo no se podría.
 */
function Reproductor({ id, titulo }) {
    const marco = useRef(null);
    const [listo, setListo] = useState(false);
    const [arranco, setArranco] = useState(false);
    const [pausado, setPausado] = useState(false);
    const [mudo, setMudo] = useState(true);
    /** El celular no dejó activar el sonido sin que el usuario toque. */
    const [trabado, setTrabado] = useState(false);
    /** Si el reproductor no obedece, se saca la capa y se usan los controles de TikTok. */
    const [directo, setDirecto] = useState(false);
    const r = useRef({ listo: false, mudo: true, anda: false, pausaMia: false, pedido: 0, conToque: false, probado: false, reloj: 0 });
    const mandar = useCallback((type) => {
        marco.current?.contentWindow?.postMessage({ 'x-tiktok-player': true, type }, TIKTOK);
    }, []);
    const pedirSonido = useCallback((conToque) => {
        const x = r.current;
        x.probado = true;
        x.conToque = conToque;
        x.pedido = Date.now();
        mandar('unMute');
        // Si un rato después sigue andando y con sonido, ya está: los próximos clips no muestran el cartel grande.
        window.setTimeout(() => { if (x.anda && !x.mudo) {
            yaSono = true;
            setTrabado(false);
        } }, 1800);
    }, [mandar]);
    useEffect(() => {
        const x = r.current;
        const oir = (e) => {
            if (e.origin !== TIKTOK || e.source !== marco.current?.contentWindow)
                return;
            const d = leerAviso(e.data);
            if (!d || d['x-tiktok-player'] !== true)
                return;
            if (d.type === 'onPlayerReady' || d.type === 'onStateChange') {
                x.listo = true;
                setListo(true);
            }
            if (d.type === 'onMute') {
                x.mudo = d.value === true;
                setMudo(x.mudo);
            }
            // No pudo arrancar solo (o falló): que se pueda tocar el video mismo.
            if (d.type === 'onPlayerError')
                setDirecto(true);
            if (d.type === 'onStateChange' && d.value === 1) {
                x.anda = true;
                x.pausaMia = false;
                setArranco(true);
                setPausado(false);
                // Arrancó sin sonido: se pide una vez.
                if (quiereSonido && x.mudo && !x.probado)
                    pedirSonido(false);
            }
            if (d.type === 'onStateChange' && d.value === 2) {
                x.anda = false;
                if (x.pausaMia)
                    setPausado(true);
                else if (Date.now() - x.pedido < 1500) {
                    // Se frenó al pedirle sonido. Puede ser un tropiezo: se le pide que siga. Si no
                    // sigue, es que el celular no deja sonar sin un toque: entonces sigue sin sonido.
                    x.pedido = 0;
                    mandar('play');
                    window.clearTimeout(x.reloj);
                    x.reloj = window.setTimeout(() => {
                        if (x.anda || x.pausaMia)
                            return;
                        mandar('mute');
                        mandar('play');
                        setTrabado(true);
                        // Ni tocando: se muestran los controles del propio video.
                        if (x.conToque)
                            setDirecto(true);
                    }, 700);
                }
            }
        };
        // Si se va a otra app o pestaña, el clip no sigue sonando.
        const alOcultar = () => {
            if (document.visibilityState === 'hidden') {
                x.pausaMia = true;
                mandar('pause');
            }
        };
        window.addEventListener('message', oir);
        document.addEventListener('visibilitychange', alOcultar);
        // Si en un rato el reproductor no dio señales, se deja tocar el video mismo.
        const t = window.setTimeout(() => { if (!x.listo)
            setDirecto(true); }, 10000);
        return () => {
            window.removeEventListener('message', oir);
            document.removeEventListener('visibilitychange', alOcultar);
            window.clearTimeout(t);
            window.clearTimeout(x.reloj);
        };
    }, [mandar, pedirSonido]);
    /** Un toque en el video: si está sin sonido y el usuario lo quiere con sonido, lo activa; si no, pausa o sigue. */
    const tocar = () => {
        const x = r.current;
        if (!listo)
            return;
        if (pausado) {
            x.pausaMia = false;
            mandar('play');
        }
        if (mudo && quiereSonido)
            pedirSonido(true);
        else if (!pausado) {
            x.pausaMia = true;
            mandar('pause');
        }
    };
    const sonido = () => {
        if (mudo) {
            elegirSonido(true);
            pedirSonido(true);
        }
        else {
            elegirSonido(false);
            setTrabado(false);
            mandar('mute');
        }
    };
    const pedir = trabado && mudo && quiereSonido;
    return (_jsxs("div", { className: `reel__video${directo ? ' reel__video--directo' : ''}`, children: [_jsx("iframe", { ref: marco, src: `${TIKTOK}/player/v1/${id}?${opciones(directo)}`, title: titulo || 'Video de TikTok', allow: "autoplay; encrypted-media; fullscreen", referrerPolicy: "strict-origin-when-cross-origin" }, directo ? 'directo' : 'capa'), !directo && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "reel__toque", onClick: tocar, "aria-label": pausado ? 'Reproducir' : pedir ? 'Tocar para activar el sonido' : 'Pausar', children: [pausado && _jsx("span", { children: _jsx(Icon, { name: "play", size: 40 }) }), !arranco && _jsx("span", { className: "m", children: "Cargando el video de TikTok\u2026" })] }), arranco && (_jsxs("button", { type: "button", className: `reel__sonido${pedir && !yaSono ? ' reel__sonido--pedir' : ''}`, "aria-label": mudo ? 'Activar el sonido' : 'Silenciar', "aria-pressed": !mudo, onClick: sonido, children: [_jsx(Icon, { name: mudo ? 'mudo' : 'sonido', stroke: 1.75 }), pedir && _jsx("span", { children: yaSono ? 'Tocá para el sonido' : 'Activar sonido' })] }))] }))] }));
}
/** Cuánto hay que deslizar hacia abajo (ya frenado a la mitad) para que busque clips nuevos. */
const UMBRAL = 64;
/** Feed de clips: un video por pantalla, se pasa al siguiente deslizando (como TikTok). */
export function Clips() {
    const s = useStore();
    const ahora = useAhora();
    const cargar = s.cargarClips;
    const reales = feed(s);
    // Mientras nadie haya vinculado su TikTok, se muestran clips de muestra para que la pantalla no quede vacía.
    const muestras = useMemo(() => seedReels(Date.now()), []);
    const deMuestra = REAL && s.clipsListos && reales.length === 0;
    const reels = deMuestra ? muestras : reales;
    const miNivel = nivelDe(misPuntos(s));
    const lista = useRef(null);
    /** Clip que está en pantalla. Se guarda cuál es (no su posición): la lista puede cambiar mientras se mira. */
    const [enPantalla, setEnPantalla] = useState(null);
    const ids = reels.map((r) => r.id).join(',');
    const posicion = reels.findIndex((r) => r.id === enPantalla);
    const activo = posicion === -1 ? 0 : posicion;
    /** Reacciones a los clips de muestra: no se guardan. */
    const [gustan, setGustan] = useState([]);
    /** Con una búsqueda abierta, arriba va su cartel: lo que está debajo se corre. */
    const conCartel = useStore(buscarMia) !== undefined;
    // Llegar directo a un clip (desde el perfil): /clips?v=<clip>.
    const [parametros, setParametros] = useSearchParams();
    const pedido = parametros.get('v');
    useEffect(() => {
        if (!pedido || !lista.current)
            return;
        const el = [...lista.current.querySelectorAll('.reel')].find((x) => x.dataset.id === pedido);
        if (!el)
            return;
        lista.current.scrollTop = el.offsetTop;
        setEnPantalla(pedido);
        setParametros({}, { replace: true });
    }, [pedido, ids, s.clipsListos]); // eslint-disable-line react-hooks/exhaustive-deps
    // Deslizar hacia abajo estando en el primer clip (o girar la rueda hacia arriba): busca clips nuevos.
    const [tiron, setTiron] = useState(0);
    const [buscando, setBuscando] = useState(false);
    const [novedad, setNovedad] = useState(null);
    const gesto = useRef({ desde: null, tiron: 0, rueda: 0, ruedaAt: -1e9, ruedaArriba: false, ocupado: false });
    const refrescar = s.refrescarClips;
    const actualizar = useCallback(async () => {
        const g = gesto.current;
        if (g.ocupado)
            return;
        g.ocupado = true;
        setNovedad(null);
        setBuscando(true);
        const texto = await refrescar();
        setBuscando(false);
        setNovedad(texto);
        // Los clips nuevos entran arriba de todo: se vuelve ahí para verlos.
        window.requestAnimationFrame(() => lista.current?.scrollTo({ top: 0, behavior: 'smooth' }));
        window.setTimeout(() => { setNovedad(null); g.ocupado = false; }, 2500);
    }, [refrescar]);
    const arriba = () => (lista.current?.scrollTop ?? 1) <= 0;
    const alTocar = (e) => {
        const g = gesto.current;
        g.desde = !g.ocupado && arriba() ? e.touches[0].clientY : null;
        g.tiron = 0;
    };
    const alMover = (e) => {
        const g = gesto.current;
        if (g.desde === null)
            return;
        // Si la lista se movió, es un deslizamiento común y no un pedido de actualizar.
        if (!arriba())
            g.desde = null;
        g.tiron = g.desde === null ? 0 : Math.max(0, Math.min((e.touches[0].clientY - g.desde) * 0.5, 96));
        setTiron(g.tiron);
    };
    const alSoltar = () => {
        const g = gesto.current;
        const llego = g.desde !== null && g.tiron >= UMBRAL;
        g.desde = null;
        g.tiron = 0;
        setTiron(0);
        if (llego)
            void actualizar();
    };
    const alRodar = (e) => {
        const g = gesto.current;
        // Cuenta solo un giro que empezó estando arriba de todo (no el envión de haber vuelto al primero).
        if (e.timeStamp - g.ruedaAt > 400) {
            g.rueda = 0;
            g.ruedaArriba = arriba();
        }
        g.ruedaAt = e.timeStamp;
        if (g.ocupado || !g.ruedaArriba || e.deltaY >= 0) {
            g.rueda = 0;
            return;
        }
        g.rueda -= e.deltaY;
        if (g.rueda > 150) {
            g.rueda = 0;
            g.ruedaArriba = false;
            void actualizar();
        }
    };
    // Con servidor: se traen los clips al entrar y cada tanto mientras la pantalla está abierta.
    useEffect(() => {
        void cargar();
        const t = setInterval(() => void cargar(), 60000);
        return () => clearInterval(t);
    }, [cargar]);
    // Cuál es el clip que está en pantalla: solo ese carga el reproductor, y arranca solo.
    useEffect(() => {
        const caja = lista.current;
        if (!caja)
            return;
        const mirar = new IntersectionObserver((entradas) => {
            for (const e of entradas) {
                if (e.isIntersecting && e.intersectionRatio >= 0.6)
                    setEnPantalla(e.target.dataset.id ?? null);
            }
        }, { root: caja, threshold: [0.6] });
        caja.querySelectorAll('.reel').forEach((el) => mirar.observe(el));
        return () => mirar.disconnect();
    }, [ids]);
    if (REAL && !s.clipsListos) {
        return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Clips" }), _jsxs("div", { className: "pad", role: "status", "aria-label": "Cargando", children: [_jsx("div", { className: "skeleton" }), _jsx("div", { className: "skeleton" })] }), _jsx(TabBar, { on: "clips" })] }));
    }
    if (reels.length === 0) {
        return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Clips" }), _jsx(BannerBusqueda, { detalle: "Te avisamos cuando haya respuesta" }), _jsx(Empty, { title: "Sin clips todav\u00EDa", text: TIKTOK_PRONTO
                        ? 'Los clips salen de TikTok. Muy pronto vas a poder vincular tu cuenta.'
                        : 'Los clips salen de TikTok. Vinculá tu cuenta y usá #haxball o #haxmatch en tus videos.', children: TIKTOK_PRONTO ? _jsx(Pronto, {}) : _jsx(Link, { className: "btn", to: "/clips/mis-videos", children: "Vincular TikTok" }) }), _jsx(TabBar, { on: "clips" })] }));
    }
    return (_jsxs("div", { className: "screen", children: [_jsxs("div", { className: "screen", children: [_jsx("div", { className: `feed${conCartel ? ' feed--cartel' : ''}`, ref: lista, "aria-label": "Clips. Desliz\u00E1 para pasar al siguiente. En el primero, desliz\u00E1 hacia abajo para buscar clips nuevos", onTouchStart: alTocar, onTouchMove: alMover, onTouchEnd: alSoltar, onTouchCancel: alSoltar, onWheel: alRodar, children: reels.map((r, i) => {
                            const mio = r.userId === YO;
                            const autor = s.usuarios[r.userId];
                            const reaccione = deMuestra ? gustan.includes(r.id) : s.misReacciones.includes(r.id);
                            const nivel = mio ? miNivel : autor?.nivel ?? null;
                            // En los clips de TikTok los hashtags ya vienen en la descripción: no se repiten.
                            const detalle = [r.formato, hace(ahora - r.publicadoAt), r.tiktokId ? '' : r.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join(' · ');
                            const reaccionar = () => (deMuestra
                                ? setGustan((g) => (g.includes(r.id) ? g.filter((x) => x !== r.id) : [...g, r.id]))
                                : s.reaccionar(r.id));
                            // Abajo de cada clip: quién lo subió, el título y la reacción.
                            const info = (_jsxs("div", { className: "reel__info", children: [_jsxs("div", { className: "reel__autor", children: [_jsx(Avatar, { user: autor, nombre: nombreDe(s, r.userId), foto: mio ? s.perfil?.foto : null, size: "sm" }), _jsx("span", { className: "strong cut", children: nombreDe(s, r.userId) }), nivel !== null && _jsxs("span", { className: "pill", children: ["Nivel ", nivel] })] }), _jsx("div", { className: "titulo", children: r.titulo }), _jsxs("div", { className: "reel__pie", children: [_jsxs("button", { className: "like num", "aria-pressed": reaccione, "aria-label": reaccione ? 'Quitar reacción' : 'Reaccionar', onClick: reaccionar, children: [_jsx(Icon, { name: "corazon", size: 20, fill: reaccione }), r.reacciones + (reaccione ? 1 : 0)] }), _jsx("span", { className: "m cut grow", children: detalle }), r.enlace && _jsx("a", { className: "reel__enlace", href: r.enlace, target: "_blank", rel: "noopener noreferrer", children: "Ver en TikTok" })] })] }));
                            return (_jsxs("article", { "data-id": r.id, className: `reel${r.tiktokId ? ' reel--video' : ''}`, style: { '--tinte': autor?.color }, "aria-label": `${r.titulo}, de ${nombreDe(s, r.userId)}`, children: [r.tiktokId ? (_jsxs(_Fragment, { children: [i === activo
                                                ? _jsx(Reproductor, { id: r.tiktokId, titulo: r.titulo }, r.tiktokId)
                                                : _jsxs("div", { className: "reel__video reel__video--espera", children: [_jsx(Portada, { src: r.portada }), _jsx("span", { children: _jsx(Icon, { name: "play", size: 40 }) })] }), info] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "reel__play", children: [_jsx("span", { children: _jsx(Icon, { name: "play", size: 36 }) }), _jsx("span", { className: "m", children: REAL
                                                            ? 'Clip de muestra. Cuando alguien vincule su TikTok, acá van a aparecer los clips de verdad.'
                                                            : 'Video de TikTok. En esta versión de prueba no se reproduce.' })] }), info] })), i === 0 && reels.length > 1 && _jsx("div", { className: "reel__pista", children: "Desliz\u00E1 hacia arriba para ver el siguiente" })] }, r.id));
                        }) }), (tiron > 0 || buscando || novedad) && (_jsx("div", { className: "feed-aviso", role: "status", style: !buscando && !novedad ? { opacity: Math.min(1, tiron / UMBRAL), transform: `translate(-50%, ${Math.round(tiron - UMBRAL)}px)` } : undefined, children: buscando ? 'Buscando clips nuevos…' : novedad ?? (tiron >= UMBRAL ? 'Soltá para actualizar' : 'Deslizá para actualizar') })), _jsxs("div", { className: "feed-top", children: [_jsx(Head, { title: "Clips", children: !s.tiktok && TIKTOK_PRONTO
                                    ? _jsx(Pronto, {})
                                    : _jsx(Link, { className: "btn btn--sec", to: "/clips/mis-videos", children: s.tiktok ? 'Mis videos' : 'Vincular TikTok' }) }), _jsx(BannerBusqueda, { detalle: "Te avisamos cuando haya respuesta" })] })] }), _jsx(TabBar, { on: "clips" })] }));
}
/** Vincular TikTok todavía no está abierto: se muestra, pero no se puede tocar. */
function Pronto() {
    return _jsx("button", { className: "btn btn--sec", disabled: true, "aria-label": "Vincular TikTok: pronto", children: "TikTok \u00B7 Pronto" });
}
const conHashtag = (h) => h.some((x) => x === 'haxball' || x === 'haxmatch');
/** Cuenta de TikTok vinculada: estado, actualizar y desvincular. Solo con servidor. */
function CuentaTikTok() {
    const s = useStore();
    const ahora = useAhora();
    const [ocupado, setOcupado] = useState(false);
    const [problema, setProblema] = useState(null);
    const [confirmar, setConfirmar] = useState(false);
    const info = s.tiktokInfo;
    const actualizar = async () => {
        setOcupado(true);
        setProblema(await s.actualizarTikTok());
        setOcupado(false);
    };
    const desvincular = async () => {
        setConfirmar(false);
        setOcupado(true);
        setProblema(await s.desvincularTikTok());
        setOcupado(false);
    };
    const volver = async () => {
        setOcupado(true);
        setProblema(await s.vincularTikTok());
        setOcupado(false);
    };
    return (_jsxs("div", { className: `card card--col${info?.error ? ' card--accent' : ''}`, style: { gap: 12 }, children: [_jsxs("div", { className: "row", style: { gap: 12 }, children: [_jsx(Avatar, { nombre: "T" }), _jsxs("div", { className: "grow", children: [_jsxs("div", { className: "strong cut", children: ["TikTok vinculado", info?.nombre ? `: ${info.nombre}` : ''] }), _jsx("div", { className: "m", children: info?.error ?? (info?.sincronizadaAt ? `Videos actualizados ${hace(ahora - info.sincronizadaAt)}` : 'Trayendo tus videos…') })] })] }), problema && _jsx("div", { className: "err", role: "alert", children: problema }), info?.error ? (_jsx("button", { className: "btn", disabled: ocupado, onClick: () => void volver(), children: "Volver a vincular" })) : (_jsx("button", { className: "btn btn--sec", disabled: ocupado, onClick: () => void actualizar(), children: ocupado ? 'Actualizando…' : 'Actualizar mis videos' })), _jsx("button", { className: "btn btn--ghost", disabled: ocupado, onClick: () => setConfirmar(true), children: "Desvincular TikTok" }), confirmar && (_jsxs(Sheet, { title: "\u00BFDesvincular TikTok?", children: [_jsx("div", { children: "Se borran de HaxMatch todos tus videos y sus reacciones, y se anula el permiso que nos diste en TikTok. En TikTok tus videos quedan como est\u00E1n." }), _jsx("button", { className: "btn btn--danger", onClick: () => void desvincular(), children: "S\u00ED, desvincular" }), _jsx("button", { className: "btn btn--sec", onClick: () => setConfirmar(false), children: "Cancelar" })] }))] }));
}
export function MisVideos() {
    const s = useStore();
    const ahora = useAhora();
    const nav = useNavigate();
    const cargar = s.cargarClips;
    const [parametros] = useSearchParams();
    const vuelta = RESULTADO_TIKTOK[parametros.get('tiktok') ?? ''];
    const [aviso, setAviso] = useState(vuelta ?? null);
    const [habilitado, setHabilitado] = useState(TIKTOK_PRONTO ? false : REAL ? null : true);
    const [ocupado, setOcupado] = useState(false);
    const mios = s.reels.filter((r) => r.userId === YO).sort((a, b) => b.publicadoAt - a.publicadoAt);
    useEffect(() => {
        void cargar();
        if (REAL && !TIKTOK_PRONTO)
            void tiktokHabilitado().then(setHabilitado);
        // El resultado de volver de TikTok se muestra una vez: se saca de la dirección.
        if (parametros.get('tiktok'))
            nav('/clips/mis-videos', { replace: true });
    }, [cargar]); // eslint-disable-line react-hooks/exhaustive-deps
    // Vinculado pero todavía sin videos traídos (TikTok tardó o falló al vincular): se piden una vez.
    const pedidos = useRef(false);
    const faltaTraer = REAL && s.tiktok && !!s.tiktokInfo && s.tiktokInfo.sincronizadaAt === null && !s.tiktokInfo.error;
    const actualizar = s.actualizarTikTok;
    useEffect(() => {
        if (!faltaTraer || pedidos.current)
            return;
        pedidos.current = true;
        void actualizar();
    }, [faltaTraer, actualizar]);
    const vincular = async () => {
        setOcupado(true);
        const problema = await s.vincularTikTok();
        // Si todo va bien, con servidor la página ya se está yendo a TikTok.
        if (problema)
            setAviso({ ok: false, texto: problema });
        setOcupado(false);
    };
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Mis videos", back: "/clips" }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [aviso && _jsx("div", { className: aviso.ok ? 'ok' : 'err', role: "status", children: aviso.texto }), REAL && !s.clipsListos ? (_jsxs("div", { role: "status", "aria-label": "Cargando", children: [_jsx("div", { className: "skeleton" }), _jsx("div", { className: "skeleton" })] })) : !s.tiktok ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "card card--col", children: [_jsx("div", { className: "strong", children: "Vincul\u00E1 tu cuenta de TikTok" }), _jsxs("ul", { className: "steps m", children: [_jsx("li", { children: "Traemos la lista de tus videos p\u00FAblicos a tu biblioteca." }), _jsx("li", { children: "En Clips aparecen solo los que tienen #haxball o #haxmatch." }), _jsx("li", { children: "Cada video tiene un interruptor para mostrarlo u ocultarlo." }), _jsx("li", { children: "Los videos se reproducen desde TikTok. No se copian a HaxMatch." }), REAL && _jsx("li", { children: "Pod\u00E9s desvincular cuando quieras: se borra todo lo que trajimos." })] })] }), habilitado === false ? (_jsxs("div", { className: "card card--col", children: [_jsx("div", { className: "strong", children: "Pronto" }), _jsx("div", { className: "m", children: "Estamos terminando de habilitar la conexi\u00F3n con TikTok. Va a estar disponible en una pr\u00F3xima actualizaci\u00F3n." })] })) : (_jsx("button", { className: "btn btn--lg btn--block", disabled: ocupado || habilitado === null, onClick: () => void vincular(), children: ocupado ? 'Abriendo TikTok…' : 'Vincular TikTok' })), _jsx("p", { className: "m center", style: { margin: 0 }, children: REAL
                                        ? 'Te llevamos a TikTok para que des el permiso. Solo pedimos tu nombre y la lista de tus videos públicos.'
                                        : 'Versión de prueba: la vinculación está simulada.' })] })) : (_jsxs(_Fragment, { children: [REAL && _jsx(CuentaTikTok, {}), _jsx("div", { className: "m", children: "Los videos nuevos con #haxball o #haxmatch se suman solos. El primero de cada d\u00EDa da 8 puntos." }), mios.length === 0 && _jsx("div", { className: "m", children: "Todav\u00EDa no trajimos ning\u00FAn video de tu cuenta." }), mios.map((r) => {
                                    const apto = conHashtag(r.hashtags);
                                    return (_jsxs("div", { className: "card card--row", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong cut", children: r.titulo || 'Video sin descripción' }), _jsx("div", { className: "m cut", children: apto
                                                            ? `${r.hashtags.map((h) => `#${h}`).join(' ')} · ${hace(ahora - r.publicadoAt)}`
                                                            : 'Sin #haxball ni #haxmatch: no aparece en Clips' })] }), _jsx("button", { className: "switch", role: "switch", "aria-checked": apto && r.visible, disabled: !apto, "aria-label": `Mostrar "${r.titulo}" en Clips`, onClick: () => s.alternarVisible(r.id) })] }, r.id));
                                }), !REAL && (_jsxs("div", { className: "demo", children: [_jsx("div", { className: "h", children: "Herramienta de prueba" }), _jsx("button", { className: "btn btn--sec", onClick: s.simularVideoNuevo, children: "Simular un video nuevo con #haxmatch" })] }))] }))] }) }), _jsx(TabBar, { on: "clips" })] }));
}
