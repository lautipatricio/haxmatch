import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { miRacha, misPuntos, useStore, vecesDe } from '../data/store';
import { AMISTOSOS_REFERIDO, NIVEL_SORTEO, NIVELES, PUNTOS, RACHAS, TOPES, entraAlSorteo, progresoNivel, proximaRacha, } from '../domain/rules';
import { Head, TabBar, TarjetaNivel, useAhora } from '../ui';
export function Nivel() {
    const s = useStore();
    const ahora = useAhora();
    const p = progresoNivel(misPuntos(s));
    const racha = miRacha(s, ahora);
    const proxima = proximaRacha(racha);
    const veces = (tipo) => vecesDe(s, tipo);
    const filas = [
        ['Amistosos confirmados', `${PUNTOS.amistoso} puntos · hasta ${TOPES.amistososPorDia} por día, ${TOPES.mismoRivalPorDia} con el mismo rival`, veces('amistoso')],
        ['Reels nuevos en Clips', `${PUNTOS.reel} puntos · ${TOPES.reelsPorDia} por día`, veces('reel')],
        ['Reacciones a reels', `${PUNTOS.reaccion} punto · hasta ${TOPES.reaccionesPorDia} reels distintos por día`, veces('reaccion')],
        ['Días conectado', `${PUNTOS.conexion} puntos por día`, veces('conexion')],
        ['Racha de días seguidos', RACHAS.map(([d, pts]) => `${d} días +${pts}`).join(' · '), racha],
        ['Amigos referidos', `${PUNTOS.referido} puntos cuando juega ${AMISTOSOS_REFERIDO} amistosos · hasta ${TOPES.referidosPorMes} por mes`, veces('referido')],
    ];
    return (_jsxs("div", { className: "screen", children: [_jsx(Head, { title: "Tu nivel", back: "/perfil" }), _jsx("div", { className: "scroll", children: _jsxs("div", { className: "pad", children: [_jsx(TarjetaNivel, {}), _jsx("div", { children: "Todos empiezan en 0. Tu nivel sube con tu actividad en la app, no con tu habilidad." }), proxima && (_jsxs("div", { className: "m", children: ["Llev\u00E1s ", racha, " ", racha === 1 ? 'día seguido' : 'días seguidos', ". A los ", proxima[0], " sum\u00E1s +", proxima[1], ". La racha se corta si falta un d\u00EDa."] })), _jsx("h2", { className: "h sub", children: "Qu\u00E9 suma" }), filas.map(([titulo, detalle, n]) => (_jsxs("div", { className: "card card--row", children: [_jsxs("div", { className: "grow", children: [_jsx("div", { className: "strong", children: titulo }), _jsx("div", { className: "m", children: detalle })] }), _jsx("div", { className: "h num", style: { fontSize: 28, minWidth: 28, textAlign: 'right' }, children: n })] }, titulo))), _jsxs("div", { className: "card card--col", style: { gap: 6, marginTop: 8 }, children: [_jsx("div", { className: "h", style: { fontSize: 24 }, children: "Sorteo" }), _jsxs("div", { children: ["Participan autom\u00E1ticamente los jugadores de Nivel ", NIVEL_SORTEO, " o m\u00E1s."] }), _jsxs("div", { className: "m num", children: [entraAlSorteo(p.nivel)
                                            ? 'Ya estás participando.'
                                            : `Te faltan ${NIVELES[NIVEL_SORTEO - 1] - p.puntos} puntos para entrar.`, ' ', "Premio, fecha y reglamento a confirmar."] })] })] }) }), _jsx(TabBar, { on: "perfil" })] }));
}
