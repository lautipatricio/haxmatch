import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { REAL } from '../config';
import { YO, buscarMia, cuantosSon, encajaJusto, enSala, jugadoresBuscando, miSala, nivelTexto, salasBuscando, useStore, usuarioDe, } from '../data/store';
import { FALTAN } from '../domain/types';
import { TEXTO_AVISOS, activarAvisos, estadoAvisos } from '../data/push';
import { Chips, Conectado, Empty, EtiquetaKick, Head, Persona, Sheet, TabBar, mmss, useAhora } from '../ui';
const lista = (v) => (v ?? []).join(', ');
/** Lo que alguien eligió de verdad: "Cualquiera" y "Polifuncional" no dicen nada. */
const concretas = (v) => (v ?? []).filter((x) => x !== 'Cualquiera' && x !== 'Polifuncional');
const faltan = (n) => `falta${n === 1 ? '' : 'n'} ${n ?? 1}`;
const enumerar = (n) => (n.length <= 1 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`);
const MIN = 60 * 1000;
/** Un renglón que resume una búsqueda. De una sala: qué le falta y dónde. De un jugador: con cuántos va y su región. */
export function resumenBusqueda(b) {
    if (b.modo === 'sala') {
        return [`sala "${b.nombreSala}"`, faltan(b.faltan), concretas(b.posicion).join('/'), concretas(b.cancha).join(', ')].filter(Boolean).join(' · ');
    }
    return [cuantosSon(b) > 1 ? `Grupo de ${cuantosSon(b)}` : '', concretas(b.formato).join(', '), lista(b.region)].filter(Boolean).join(' · ');
}
/**
 * Fila de un jugador, un grupo o una sala, con el botón para mandarle un mensaje.
 * Si tengo una sala, el botón es "Invitar": al jugador le llega la invitación y, si acepta, entra.
 * `soloVer`: sin el botón (en el Inicio, cuando todavía no estoy buscando).
 */
export function FilaDisponible({ b, detalle, soloVer }) {
    const s = useStore();
    const ahora = useAhora();
    const u = usuarioDe(s, b.userId);
    const mia = buscarMia(s);
    // Lo que le mandé en esta búsqueda. Un "no" de una búsqueda anterior no cuenta.
    const desde = mia?.creadaAt ?? ahora - 10 * MIN;
    const enviado = s.mensajes.find((m) => m.de === YO && m.a === b.userId && (m.estado === 'pendiente' || m.at >= desde));
    const somos = cuantosSon(mia);
    const son = cuantosSon(b);
    // No entran: mi grupo no cabe en esa sala, o ese grupo no cabe en la mía.
    const noEntran = b.modo === 'sala'
        ? somos > (b.faltan ?? 0)
        : mia?.modo === 'sala' && son > (mia.faltan ?? 0);
    const motivo = b.modo === 'sala' ? `Le ${faltan(b.faltan)} y ustedes son ${somos}` : `Son ${son} y te ${faltan(mia?.faltan)}`;
    // Sumado al grupo de otro: los mensajes los manda quien lo armó.
    const sumado = !!mia?.liderId;
    /** Tengo una sala y esto es un jugador: lo que mando es una invitación. */
    const invito = mia?.modo === 'sala' && b.modo === 'jugador';
    // "No puede": solo si dijo que no, y por los 2 minutos en que el servidor no deja insistirle.
    // Si el pedido se cayó solo (la sala se llenó y después se liberó un lugar), se puede volver a invitar ya.
    // Con un servidor que todavía no manda ese dato, queda como antes: vale por toda la búsqueda.
    const dijoQueNo = enviado?.estado === 'rechazado' && enviado.dijoNo !== false &&
        (enviado.rechazoAt == null || ahora - enviado.rechazoAt < 2 * MIN);
    return (_jsxs("div", { className: "card card--row", children: [_jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, _jsx(Conectado, { id: u.id }), _jsx(EtiquetaKick, { id: u.id }), son > 1 && ` +${son - 1}`, s.amigos.includes(u.id) && _jsx("span", { className: "tag tag--linea", children: "AMIGO" }), encajaJusto(s, b) && Math.max(somos, son) > 1 && _jsx("span", { className: "tag", children: "JUSTO" })] }), _jsx("span", { className: "m cut", children: noEntran ? motivo : detalle ?? `${nivelTexto(u)}${resumenBusqueda(b)}` })] }), soloVer ? null : enviado?.estado === 'pendiente' ? (_jsx("button", { className: "btn btn--sec", disabled: true, children: invito ? 'Invitado' : 'Enviado' })) : dijoQueNo ? (_jsx("button", { className: "btn btn--sec", disabled: true, children: "No puede" })) : (_jsx("button", { className: "btn btn--sec", disabled: noEntran || sumado, onClick: () => s.enviarMensaje(b.userId), children: invito ? 'Invitar' : 'Mensaje' }))] }));
}
function Vacio({ titulo, texto }) {
    return (_jsxs("div", { className: "vacio", children: [_jsx("div", { className: "strong", children: titulo }), _jsx("div", { className: "m", children: texto })] }));
}
/**
 * Seguir de otra forma. Sale solo a los 15 minutos (renovar, jugar entre los del grupo
 * o armar una sala), y también lo abre quien armó un grupo para crear su sala cuando quiera.
 */
function CartelSeguir({ mia, porTiempo, onCerrar }) {
    const s = useStore();
    const nav = useNavigate();
    const somos = cuantosSon(mia);
    const [paso, setPaso] = useState('opciones');
    const [nombre, setNombre] = useState('');
    const [cuantos, setCuantos] = useState(1);
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const entre = somos === 2 ? 'Jugar un 1v1 entre nosotros' : somos === 3 ? 'Jugar un 1v1v1 entre nosotros' : 'Jugar entre nosotros';
    const crear = async () => {
        setOcupado(true);
        const e = await s.convertirEnSala({ nombreSala: nombre, faltan: cuantos, entreNosotros: paso === 'entre' });
        setOcupado(false);
        setError(e);
    };
    if (paso === 'opciones') {
        return (_jsxs(Sheet, { title: porTiempo ? 'Pasaron 15 minutos' : 'Armar una sala', children: [_jsx("div", { children: porTiempo
                        ? `${somos > 1 ? `Siguen siendo ${somos} y no apareció una sala.` : 'Todavía no apareció un partido.'} ¿Cómo seguimos?`
                        : `Son ${somos}. Uno crea la sala en HaxBall y los demás entran.` }), porTiempo && _jsx("button", { className: "btn", onClick: s.renovarBusqueda, children: "Renovar la b\u00FAsqueda" }), somos > 1 && _jsx("button", { className: `btn${porTiempo ? ' btn--sec' : ''}`, onClick: () => setPaso('entre'), children: entre }), _jsx("button", { className: "btn btn--sec", onClick: () => setPaso('sala'), children: somos > 1 ? 'Crear una sala entre nosotros y seguir buscando' : 'Crear una sala y buscar jugadores' }), porTiempo
                    ? _jsx("button", { className: "btn btn--ghost", onClick: () => { s.cancelarBusqueda(); nav('/'); }, children: "Dejar de buscar" })
                    : _jsx("button", { className: "btn btn--ghost", onClick: onCerrar, children: "Ahora no" })] }));
    }
    return (_jsxs(Sheet, { title: paso === 'entre' ? entre : 'Crear una sala', children: [_jsxs("div", { children: ["Cre\u00E1 la sala en HaxBall y escrib\u00ED el nombre.", ' ', paso === 'entre' ? 'Los del grupo entran a tu sala y no se busca a nadie más.' : 'Los del grupo entran a tu sala y después invitás al resto desde la lista.'] }), _jsx("label", { className: "m", htmlFor: "sala-nueva", children: "Nombre de la sala" }), _jsx("input", { id: "sala-nueva", className: "field", value: nombre, maxLength: 40, autoComplete: "off", placeholder: "Como figura en HaxBall", onChange: (e) => { setNombre(e.target.value); setError(null); } }), paso === 'sala' && _jsx(Chips, { label: "Cu\u00E1ntos faltan", options: FALTAN, value: cuantos, onChange: setCuantos }), error && _jsx("div", { className: "err", role: "alert", children: error }), _jsx("button", { className: "btn", disabled: ocupado, onClick: () => void crear(), children: "Crear sala" }), _jsx("button", { className: "btn btn--sec", onClick: () => setPaso('opciones'), children: "Volver" })] }));
}
/** Si este celular todavía no recibe avisos, se ofrece activarlos: así una invitación llega aunque la app esté cerrada. */
function OfrecerAvisos({ sala }) {
    const [estado, setEstado] = useState(null);
    const [problema, setProblema] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    useEffect(() => {
        let vivo = true;
        void estadoAvisos().then((e) => { if (vivo)
            setEstado(e); });
        return () => { vivo = false; };
    }, []);
    // iPhone sin la app instalada: no hay botón que valga, pero sí cómo arreglarlo.
    const faltaInstalar = estado === 'falta-instalar';
    if (estado !== 'apagados' && !faltaInstalar && !problema)
        return null;
    const activar = async () => {
        setOcupado(true);
        setProblema(await activarAvisos());
        setEstado(await estadoAvisos());
        setOcupado(false);
    };
    return (_jsxs("div", { className: "card card--col", children: [_jsxs("div", { className: "row", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: "Enterate aunque cierres la app" }), _jsx("div", { className: "m", children: sala ? 'Te avisamos cuando te respondan o alguien quiera entrar a tu sala.' : 'Te avisamos cuando una sala te invite a jugar.' })] }), estado === 'apagados' && (_jsx("button", { className: "btn btn--sec", style: { flex: 'none' }, disabled: ocupado, onClick: () => void activar(), children: "Activar avisos" }))] }), faltaInstalar && _jsx("div", { className: "m", children: TEXTO_AVISOS['falta-instalar'] }), problema && _jsx("div", { className: "err", role: "alert", children: problema })] }));
}
/** Jugadores que ya tienen lugar en mi sala: primero "Ya entró", después "Se salió". */
function EnMiSala({ onEntro }) {
    const s = useStore();
    const otros = enSala(miSala(s));
    if (otros.length === 0)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: "En tu sala" }), otros.map((p) => {
                const u = usuarioDe(s, p.userId);
                const adentro = !!p.entroAt;
                if (adentro) {
                    return (_jsxs("div", { className: "card card--row", children: [_jsxs(Persona, { user: u, children: [_jsx("span", { className: "strong cut", children: u.username }), _jsx("span", { className: "m cut", children: p.confirmadoAt ? 'Adentro · confirmó' : 'Adentro' })] }), _jsx("button", { className: "btn btn--sec", "aria-label": `${u.username} se salió`, onClick: () => s.marcarSalio(p.userId), children: "Se sali\u00F3" })] }, p.userId));
                }
                // Todavía no entró: o confirma que entró, o libera el lugar si no va a venir.
                return (_jsxs("div", { className: "card card--col card--accent", style: { gap: 12 }, children: [_jsx("div", { className: "row", children: _jsxs(Persona, { user: u, children: [_jsx("span", { className: "strong cut", children: u.username }), _jsx("span", { className: "m cut", children: "Aceptado \u00B7 todav\u00EDa no entr\u00F3" })] }) }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn grow", "aria-label": `Ya entró ${u.username} a la sala`, onClick: () => onEntro(p.userId), children: "Ya entr\u00F3" }), _jsx("button", { className: "btn btn--sec grow", "aria-label": `${u.username} no vino`, onClick: () => s.marcarSalio(p.userId), children: "No vino" })] })] }, p.userId));
            }), _jsxs("div", { className: "chips", style: { alignItems: 'center' }, children: [_jsx("span", { className: "m", children: "Reportar a" }), otros.map((p) => (_jsx(Link, { className: "chip", to: `/reportar/${p.userId}`, children: usuarioDe(s, p.userId).username }, p.userId)))] })] }));
}
export function Buscando() {
    const s = useStore();
    const mia = buscarMia(s);
    const ahora = useAhora();
    const nav = useNavigate();
    const [espera, setEspera] = useState(true);
    /** Jugadores aceptados cuyo cartel "Ya entró" se pospuso con "Todavía no". */
    const [pospuestos, setPospuestos] = useState([]);
    /** Quien armó un grupo abrió el cartel para crear su sala. */
    const [armar, setArmar] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setEspera(false), 600);
        return () => clearTimeout(t);
    }, []);
    const cargando = espera || !s.colaLista;
    // Si alguien pospuesto deja la sala y después vuelve, su cartel aparece de nuevo.
    const enMiSala = enSala(miSala(s)).map((p) => p.userId).join(',');
    useEffect(() => {
        setPospuestos((p) => (p.every((u) => enMiSala.split(',').includes(u)) ? p : p.filter((u) => enMiSala.split(',').includes(u))));
    }, [enMiSala]);
    if (!mia) {
        return (_jsxs("div", { className: "screen", children: [s.colaLista ? (_jsx(Empty, { title: "No est\u00E1s buscando", text: "Tu b\u00FAsqueda termin\u00F3 o venci\u00F3. Pod\u00E9s empezar otra cuando quieras.", children: _jsx(Link, { className: "btn", to: "/", children: "Volver al inicio" }) })) : s.errorCola ? (_jsx(Empty, { title: "Sin conexi\u00F3n con el servidor", text: s.errorCola, children: _jsx("button", { className: "btn", onClick: () => void s.refrescar(), children: "Reintentar" }) })) : (_jsxs("div", { className: "pad", style: { paddingTop: 'calc(24px + var(--safe-top))' }, role: "status", "aria-label": "Cargando", children: [_jsx("div", { className: "skeleton" }), _jsx("div", { className: "skeleton" })] })), _jsx(TabBar, { on: "inicio" })] }));
    }
    const sala = mia.modo === 'sala';
    const jugadores = jugadoresBuscando(s);
    const salas = salasBuscando(s);
    const grupo = mia.grupo ?? [];
    /** Me sumé a la búsqueda de otro: la maneja quien armó el grupo. */
    const lider = mia.liderId ? usuarioDe(s, mia.liderId) : null;
    const completa = sala && (mia.faltan ?? 0) === 0;
    const match = miSala(s);
    const conGente = enSala(match).length > 0;
    const canchas = concretas(mia.cancha);
    const datos = (sala
        ? [completa ? 'Completa' : faltan(mia.faltan).replace('f', 'F'), concretas(mia.posicion).join('/'), lista(mia.region), canchas.length ? `Cancha: ${canchas.join(', ')}` : '']
        : [concretas(mia.formato).join(', '), `Región: ${lista(mia.region)}`]).filter(Boolean).join(' · ');
    const esqueleto = _jsxs(_Fragment, { children: [_jsx("div", { className: "skeleton" }), _jsx("div", { className: "skeleton" })] });
    const vencida = mia.expiraAt !== null && mia.expiraAt <= ahora;
    /** Cuánto dura la búsqueda (si vence) y qué parte ya pasó. Vencida, la barra va llena. */
    const duracion = mia.expiraAt !== null ? Math.round((mia.expiraAt - mia.creadaAt) / 1000) * 1000 : 0;
    const plazo = duracion > 0 ? duracion : null;
    const avance = vencida || !plazo ? 1 : Math.min(1, Math.max(0, (ahora - mia.creadaAt) / plazo));
    // Lo que me llegó y todavía no respondí. En mi sala, y cuando una sala me invita, se muestra
    // como cartel; lo que me escribe otro jugador que busca partido, como lista.
    const pendientes = s.mensajes.filter((m) => m.a === YO && m.estado === 'pendiente');
    const salaDe = (uid) => s.busquedas.find((b) => b.userId === uid && b.estado === 'activa' && b.modo === 'sala');
    const pedido = sala ? pendientes[0] : undefined;
    const invitacion = sala ? undefined : pendientes.find((m) => salaDe(m.de));
    const recibidos = pendientes.filter((m) => !salaDe(m.de));
    const quienes = pedido ? [pedido.de, ...(pedido.con ?? [])] : [];
    const porEntrar = enSala(match).find((p) => !p.entroAt && !pospuestos.includes(p.userId));
    const nombre = (uid) => usuarioDe(s, uid).username;
    let cartel = null;
    if (pedido) {
        const varios = quienes.length > 1;
        const conNivel = quienes.filter((u) => usuarioDe(s, u).nivel !== null);
        cartel = (_jsxs(Sheet, { title: `¿Aceptás a ${enumerar(quienes.map(nombre))}?`, children: [_jsxs("div", { children: [pedido.auto
                            ? `La app ${varios ? `los conectó con tu sala: son un grupo de ${quienes.length}` : 'lo conectó con tu sala'}.`
                            : `Te ${varios ? 'escribieron' : 'escribió'}: ${pedido.texto}`, ' ', "Si ", varios ? 'los' : 'lo', " acept\u00E1s, ", varios ? `ocupan ${quienes.length} lugares` : 'ocupa un lugar', " y la sala sigue buscando al resto."] }), conNivel.length > 0 && _jsx("div", { className: "m", children: conNivel.map((u) => `${nombre(u)} · Nivel ${usuarioDe(s, u).nivel}`).join(' · ') }), _jsx("button", { className: "btn", onClick: () => s.responderMensaje(pedido.id, true), children: "Aceptar" }), _jsx("button", { className: "btn btn--sec", onClick: () => s.responderMensaje(pedido.id, false), children: "Rechazar" })] }));
    }
    else if (porEntrar) {
        const n = nombre(porEntrar.userId);
        cartel = (_jsxs(Sheet, { title: `${n} va a entrar`, children: [_jsxs("div", { children: ["Toc\u00E1 \u201CYa entr\u00F3 ", n, " a la sala\u201D cuando el jugador se encuentre dentro. Sin eso, el partido no cuenta como v\u00E1lido."] }), _jsx("div", { className: "m", children: "Si despu\u00E9s se va, toc\u00E1 \u201CSe sali\u00F3\u201D y se libera su lugar." }), _jsxs("button", { className: "btn", onClick: () => s.marcarEntro(porEntrar.userId), children: ["Ya entr\u00F3 ", n, " a la sala"] }), _jsx("button", { className: "btn btn--sec", onClick: () => setPospuestos((p) => [...p, porEntrar.userId]), children: "Todav\u00EDa no" }), _jsx("button", { className: "btn btn--ghost", onClick: () => s.marcarSalio(porEntrar.userId), children: "No va a venir: liberar su lugar" })] }));
    }
    else if (invitacion) {
        const dueno = usuarioDe(s, invitacion.de);
        cartel = (_jsxs(Sheet, { title: "Te invitan a jugar", children: [_jsx("div", { children: invitacion.texto }), _jsxs("div", { className: "m", children: ["Sala de ", dueno.username, dueno.nivel !== null && ` · Nivel ${dueno.nivel}`, ".", ' ', grupo.length ? `Si aceptás, entran los ${grupo.length + 1} del grupo.` : 'Si aceptás, entrás directo.'] }), _jsx("button", { className: "btn", onClick: () => s.responderMensaje(invitacion.id, true), children: "S\u00ED, quiero jugar" }), _jsx("button", { className: "btn btn--sec", onClick: () => s.responderMensaje(invitacion.id, false), children: "Ahora no" })] }));
    }
    else if (!sala && mia.ofertaHasta) {
        cartel = _jsx(CartelSeguir, { mia: mia, porTiempo: true, onCerrar: () => setArmar(false) });
    }
    else if (!sala && armar && !lider && grupo.length > 0) {
        cartel = _jsx(CartelSeguir, { mia: mia, porTiempo: false, onCerrar: () => setArmar(false) });
    }
    return (_jsxs("div", { className: "screen", children: [_jsxs("div", { className: "screen", children: [_jsx(Head, { chico: true, back: "/", title: completa ? 'Sala completa' : sala ? 'Buscando jugador' : 'Buscando partido' }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", style: { paddingTop: 0 }, children: [_jsxs("div", { className: "reloj", children: [_jsxs("div", { className: "reloj__fila", children: [_jsx("div", { className: "h num reloj__t", role: "timer", children: mmss((mia.completaAt ?? ahora) - mia.creadaAt) }), plazo !== null && !completa && _jsxs("div", { className: "m num", children: ["de ", mmss(plazo)] })] }), _jsx("div", { className: `espera${completa || mia.expiraAt !== null ? '' : ' espera--libre'}`, "aria-hidden": "true", children: _jsx("div", { style: completa || mia.expiraAt === null ? undefined : { transform: `translateX(${Math.round((avance - 1) * 1000) / 10}%)` } }) }), _jsxs("div", { className: "reloj__d", children: [_jsxs("div", { className: "m", children: [datos, sala && ` · Sala "${mia.nombreSala}"`] }), _jsx("div", { className: "m num", children: completa ? 'Ya no se busca a nadie. Cuando entren todos, queda armado el match.'
                                                        : lider && vencida ? `Pasaron los 15 minutos. ${lider.username} decide cómo siguen.`
                                                            : mia.expiraAt ? `Vence en ${mmss(mia.expiraAt - ahora)}` : sala ? 'Sigue buscando hasta completarse' : 'Activa hasta conseguir partido' })] })] }), !sala && recibidos.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub sub--accent", children: "Te escribieron" }), recibidos.map((m) => {
                                            const u = usuarioDe(s, m.de);
                                            const con = m.con ?? [];
                                            return (_jsxs("div", { className: "card card--row card--accent", children: [_jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, con.length > 0 && ` +${con.length}`] }), _jsx("span", { className: "m cut", children: m.texto })] }), _jsxs("div", { className: "acts", children: [_jsx("button", { className: "btn", "aria-label": `Aceptar a ${u.username}`, onClick: () => s.responderMensaje(m.id, true), children: "Aceptar" }), _jsx("button", { className: "btn btn--sec", "aria-label": `Rechazar a ${u.username}`, onClick: () => s.responderMensaje(m.id, false), children: "No" })] })] }, m.id));
                                        }), _jsx("div", { className: "m", children: "Si acept\u00E1s, te sum\u00E1s a su b\u00FAsqueda y siguen buscando juntos." })] })), sala && _jsx(EnMiSala, { onEntro: s.marcarEntro }), grupo.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: "Buscan con vos" }), grupo.map((uid) => {
                                            const u = usuarioDe(s, uid);
                                            return (_jsx("div", { className: "card card--row card--accent", children: _jsxs(Persona, { user: u, children: [_jsxs("span", { className: "strong cut", children: [u.username, s.amigos.includes(uid) && _jsx("span", { className: "tag tag--linea", children: "AMIGO" })] }), _jsxs("span", { className: "m cut", children: [nivelTexto(u), uid === mia.liderId ? 'armó el grupo y maneja la búsqueda' : 'mismo reloj y misma búsqueda'] })] }) }, uid));
                                        }), lider ? (_jsxs("div", { className: "m", children: ["Te sumaste a la b\u00FAsqueda de ", lider.username, ". Los mensajes a otros jugadores y las invitaciones de las salas los maneja ", lider.username, "."] })) : !sala && (
                                        // Quien armó el grupo puede crear la sala cuando quiera, sin esperar los 15 minutos.
                                        _jsx("button", { className: "btn btn--sec", onClick: () => setArmar(true), children: "Armar una sala con el grupo" }))] })), !sala && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: "Salas buscando jugadores" }), cargando ? esqueleto : salas.length === 0 ? (_jsx(Vacio, { titulo: "No hay salas buscando ahora", texto: "Cuando una sala necesite jugadores aparece ac\u00E1." })) : (salas.map((b) => _jsx(FilaDisponible, { b: b }, b.id))), _jsxs("div", { className: "m", children: ["Cuando una sala te invita, te avisamos y eleg\u00EDs si ", grupo.length ? 'entran' : 'entrás', ".", !lider && ' También podés escribirle vos a una sala: si te acepta, entrás.'] })] })), !completa && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "h sub", children: "Jugadores buscando partidos" }), cargando ? esqueleto : jugadores.length === 0 ? (_jsx(Vacio, { titulo: "Nadie m\u00E1s buscando ahora", texto: sala ? 'Cuando alguien se ponga a buscar aparece acá, para que lo invites.' : 'Cuando alguien se ponga a buscar aparece acá.' })) : (jugadores.map((b) => _jsx(FilaDisponible, { b: b }, b.id))), !lider && (_jsx("div", { className: "m", children: sala
                                                ? 'Elegí a quién invitar. Le llega el aviso con los datos de tu sala y, si acepta, ocupa un lugar.'
                                                : 'Si un jugador acepta tu mensaje, se suma a tu búsqueda y siguen buscando juntos.' }))] })), !completa && _jsx(OfrecerAvisos, { sala: sala }), _jsx("button", { className: "btn btn--quieto btn--block", style: { marginTop: 8 }, onClick: () => { s.cancelarBusqueda(); nav('/'); }, children: conGente ? 'Cerrar sala' : lider ? 'Salir del grupo' : 'Cancelar búsqueda' }), !sala && !REAL && (_jsxs("div", { className: "demo", children: [_jsx("div", { className: "h", children: "Herramientas de prueba" }), !lider && _jsx("button", { className: "btn btn--sec", onClick: s.simularInvitacion, children: "Simular que una sala te invita" }), mia.expiraAt !== null && !mia.ofertaHasta && (_jsx("button", { className: "btn btn--sec", onClick: s.simularQuinceMinutos, children: "Simular que pasaron 15 minutos" }))] })), cartel && _jsx("div", { style: { height: 250 }, "aria-hidden": "true" })] }) }), cartel] }), _jsx(TabBar, { on: "inicio" })] }));
}
