import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { YO, buscarMia, enSala, nombreDe, useStore, usuarioDe } from '../data/store';
import { DIAS_PENDIENTE } from '../domain/rules';
import { Avatar, Empty, Head, Icon, Persona, Sheet, copiar } from '../ui';
/** Matches donde ya se mostró el cartel "No te olvides", para no repetirlo al volver. */
const recordados = new Set();
/** "Mati_", "Mati_ y Nico", "Mati_, Nico y Lucho". */
function enumerar(nombres) {
    if (nombres.length <= 1)
        return nombres[0] ?? '';
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}
/** Dueño de la sala: se completó y ya entraron todos. La búsqueda terminó y el match quedó armado. */
function MiSalaCompleta({ matchId }) {
    const s = useStore();
    const m = s.matches.find((x) => x.id === matchId);
    if (!m)
        return _jsx(Navigate, { to: "/", replace: true });
    const otros = enSala(m);
    const contado = m.contadoAt !== null;
    const puntos = s.eventos.find((e) => e.tipo === 'amistoso' && e.referencia === m.id)?.puntos ?? 0;
    // Completa: entraron todos. Si no, es una sala que cerré yo antes de llenarla.
    const todos = otros.length > 0 && otros.every((p) => !!p.entroAt);
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: contado ? 'Amistoso confirmado' : todos ? 'Match listo' : 'Sala cerrada' }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsx("div", { className: "check", children: _jsx(Icon, { name: "check", size: 38, stroke: 3 }) }), _jsx("div", { className: "h center", style: { fontSize: 30 }, children: todos ? 'Tu sala está completa' : 'Tu sala ya no busca' }), _jsxs("div", { className: "m center", children: ["Sala \"", m.nombreSala, "\" \u00B7 ", todos ? 'ya entraron todos. La búsqueda terminó.' : 'la búsqueda terminó.'] }), _jsx("div", { className: `card card--col${contado ? ' card--accent' : ''}`, role: "status", children: contado ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "strong", children: ["Partido v\u00E1lido", puntos > 0 ? ` · +${puntos} puntos` : ''] }), puntos === 0 && _jsx("div", { className: "m", children: "Cuenta en tu historial. Hoy ya llegaste al tope de puntos por amistosos." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "strong", children: "Falta que confirme alguno de los que entraron." }), _jsxs("div", { className: "m", children: ["El partido cuenta cuando uno de ellos toca \u201CYa entr\u00E9 a la sala\u201D. Les queda pendiente en su Perfil por ", DIAS_PENDIENTE, " d\u00EDas."] })] })) }), _jsx("h2", { className: "h sub", children: "En tu sala" }), otros.map((p) => {
                            const u = usuarioDe(s, p.userId);
                            return (_jsxs("div", { className: "card card--row", children: [_jsxs(Persona, { user: u, children: [_jsx("span", { className: "strong cut", children: u.username }), _jsx("span", { className: "m cut", children: p.entroAt ? (p.confirmadoAt ? 'Adentro · confirmó' : 'Adentro') : 'No llegó a entrar' })] }), p.entroAt ? (_jsx("button", { className: "btn btn--sec", "aria-label": `${u.username} se salió`, onClick: () => s.marcarSalio(p.userId, m.id), children: "Se sali\u00F3" })) : (_jsx("button", { className: "btn btn--sec", "aria-label": `${u.username} no vino`, onClick: () => s.marcarSalio(p.userId, m.id), children: "No vino" }))] }, p.userId));
                        }), todos && _jsx("div", { className: "m", children: "Si alguno se va, toc\u00E1 \u201CSe sali\u00F3\u201D: se libera su lugar y la sala vuelve a buscar." }), _jsx(Link, { className: "btn btn--lg", to: "/", children: "Volver al inicio" }), _jsxs("div", { className: "chips", style: { alignItems: 'center' }, children: [_jsx("span", { className: "m", children: "Reportar a" }), otros.map((p) => (_jsx(Link, { className: "chip", to: `/reportar/${p.userId}`, children: usuarioDe(s, p.userId).username }, p.userId)))] })] }) })] }));
}
/** Pantalla de quien entra a la sala de otro. */
export function MatchListo() {
    const { id } = useParams();
    const s = useStore();
    const m = s.matches.find((x) => x.id === id);
    const [recordatorio, setRecordatorio] = useState(() => !recordados.has(id ?? ''));
    const [copiado, setCopiado] = useState(null);
    if (!m) {
        return (_jsx("div", { className: "screen", children: _jsx(Empty, { title: "Match no encontrado", text: "Puede que se haya cancelado.", children: _jsx(Link, { className: "btn", to: "/", children: "Volver al inicio" }) }) }));
    }
    if (m.creadoPor === YO) {
        // Mientras mi sala siga abierta, todo se maneja desde la pantalla de búsqueda.
        if (buscarMia(s)?.matchId === m.id)
            return _jsx(Navigate, { to: "/buscando", replace: true });
        return _jsx(MiSalaCompleta, { matchId: m.id });
    }
    const yo = m.participantes.find((p) => p.userId === YO);
    const creador = nombreDe(s, m.creadoPor);
    const conmigo = enSala(m, m.creadoPor).filter((p) => p.userId !== YO);
    const contado = m.contadoAt !== null;
    // Si el partido ya me cuenta (el dueño marcó que entré y confirmó alguien más), no hace falta que confirme.
    const confirme = !!yo?.confirmadoAt || contado;
    const puntos = s.eventos.find((e) => e.tipo === 'amistoso' && e.referencia === m.id)?.puntos ?? 0;
    const titulo = m.formato && m.formato !== 'Cualquiera' ? `${m.formato} con ${creador}` : `Sala de ${creador}`;
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: contado ? 'Amistoso confirmado' : 'Match listo' }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsx("div", { className: "check", children: _jsx(Icon, { name: "check", size: 38, stroke: 3 }) }), _jsx("div", { className: "h center", style: { fontSize: 30 }, children: titulo }), _jsxs("div", { className: "card card--col", children: [_jsx("div", { className: "m", children: "Nombre de la sala en HaxBall" }), _jsxs("div", { className: "row", children: [_jsx("div", { className: "h grow", style: { fontSize: 28, overflowWrap: 'anywhere' }, children: m.nombreSala }), _jsxs("button", { className: "btn btn--sec", onClick: async () => setCopiado(await copiar(m.nombreSala)), children: [_jsx(Icon, { name: "copiar", size: 18 }), copiado ? 'Copiado' : 'Copiar'] })] }), _jsx("div", { className: "m", children: copiado === false
                                        ? 'No se pudo copiar. Mantené apretado el nombre para copiarlo.'
                                        : 'Buscala por este nombre en HaxBall, desde tu computadora.' })] }), conmigo.length > 0 && (_jsxs("div", { className: "card", children: [_jsx(Avatar, { user: usuarioDe(s, conmigo[0].userId) }), _jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: conmigo.length > 1 ? 'Entran con vos' : 'Entra con vos' }), _jsx("div", { className: "m", children: enumerar(conmigo.map((p) => nombreDe(s, p.userId))) })] })] })), !confirme && (_jsx("button", { className: "btn btn--lg", onClick: () => s.confirmarMatch(m.id), children: "Ya entr\u00E9 a la sala" })), confirme && (_jsx("div", { className: `card card--col${contado ? ' card--accent' : ''}`, role: "status", children: contado ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "strong", children: ["Partido v\u00E1lido", puntos > 0 ? ` · +${puntos} puntos` : ''] }), puntos === 0 && _jsx("div", { className: "m", children: "Cuenta en tu historial. Hoy ya llegaste al tope de puntos por amistosos." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "strong", children: ["Confirmaste. Falta que confirme ", creador, "."] }), _jsxs("div", { className: "m", children: ["El partido cuenta cuando confirma el otro lado. Le queda pendiente en su Perfil por ", DIAS_PENDIENTE, " d\u00EDas."] })] })) })), _jsx("div", { className: "card card--row", children: _jsxs(Persona, { user: usuarioDe(s, m.creadoPor), children: [_jsx("span", { className: "strong cut", children: "Qui\u00E9n crea la sala" }), _jsxs("span", { className: "m cut", children: [creador, " \u00B7 toc\u00E1 para agregarlo como amigo"] })] }) }), _jsx(Link, { className: `btn${confirme ? '' : ' btn--ghost'}`, to: "/", children: "Volver al inicio" }), _jsxs(Link, { className: "btn btn--ghost", to: `/reportar/${m.creadoPor}`, children: ["Reportar a ", creador] })] }) }), recordatorio && !confirme && (_jsxs(Sheet, { title: "No te olvides", children: [_jsx("div", { children: "Toc\u00E1 \u201CYa entr\u00E9 a la sala\u201D cuando est\u00E9s adentro. Sin eso, el partido no cuenta como v\u00E1lido." }), _jsx("button", { className: "btn", onClick: () => { recordados.add(m.id); setRecordatorio(false); }, children: "Entendido" })] }))] }));
}
